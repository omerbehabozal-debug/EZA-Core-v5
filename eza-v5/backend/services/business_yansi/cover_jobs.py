"""Prepare a Discover cover without touching a sealed plan.

A silent original that already fits the cover limits is reused. Every other
stored video is encoded to a separate silent derivative. The original file is
not opened for writing.
"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from fastapi import HTTPException

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.models.business_brand_assets import BusinessKnowledgeAssetLink as Link
from backend.models.business_video_cover_jobs import BusinessVideoCoverJob as Job
from backend.services.business_yansi.video_ingest import COVER_MAX_SECONDS

STRATEGY = "first_span"
CHOSEN_STRATEGY = "chosen_span"
SPAN_STRATEGIES = {STRATEGY, CHOSEN_STRATEGY}
REUSE_PROFILE = "silent-reuse-v1"
DERIVATIVE_PROFILE = "silent-derivative-v1"
CLASSIFY_DEADLINE_SECONDS = 30
ENCODE_DEADLINE_SECONDS = 180
_CLASSIFY_PREFIX = "c"
_ENCODE_PREFIX = "e"


def job_key(asset_id) -> str:
    return hashlib.sha256(f"cover-default-v1|{asset_id}".encode()).hexdigest()


def _silent(asset) -> bool:
    heard = getattr(asset, "verified_has_audio", None)
    return heard is False or heard == 0


def planned_window(asset):
    """First 20 seconds, in the source timescale. The file itself is not cut."""
    duration = getattr(asset, "verified_duration", None)
    scale = getattr(asset, "verified_timescale", None)
    if type(duration) is not int or type(scale) is not int or scale <= 0 or duration <= 0:
        return None
    end = min(duration, COVER_MAX_SECONDS * scale)
    if end <= 0:
        return None
    return 0, end


def reuse_original(asset) -> bool:
    """The original may be the cover only when it is already a silent, measured fit."""
    from backend.services.business_yansi.studio_media import video_may_be_cover

    if getattr(asset, "locator_kind", None) != "storage" or getattr(asset, "source_asset_id", None) is not None:
        return False
    return video_may_be_cover(asset) and _silent(asset)


async def ensure_cover_job(db, asset, user_id):
    """One default job per source. A repeat returns the row already stored."""
    window = planned_window(asset)
    if window is None or getattr(asset, "asset_type", None) != "video":
        return None
    key = job_key(asset.id)
    existing = await db.scalar(select(Job).where(Job.business_id == asset.business_id, Job.idempotency_key == key))
    if existing is not None:
        return existing
    start, end = window
    row = Job(
        id=uuid.uuid4(),
        business_id=asset.business_id,
        source_asset_id=asset.id,
        idempotency_key=key,
        strategy=STRATEGY,
        start_ticks=start,
        end_ticks=end,
        encoder_profile=REUSE_PROFILE if reuse_original(asset) else DERIVATIVE_PROFILE,
        status="queued",
        attempts=0,
        max_attempts=3,
        created_by=user_id,
    )
    try:
        async with db.begin_nested():
            db.add(row)
            await db.flush()
    except IntegrityError:
        return await db.scalar(select(Job).where(Job.business_id == asset.business_id, Job.idempotency_key == key))
    return row


def _encode_claim(token) -> bool:
    return isinstance(token, str) and token.startswith(_ENCODE_PREFIX)


def _moment(now=None):
    moment = now or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment


def _live(job_id, business_id, token, moment):
    return (
        Job.id == job_id,
        Job.business_id == business_id,
        Job.status == "running",
        Job.claim_token == token,
        Job.deadline_at.is_not(None),
        Job.deadline_at > moment,
    )


async def _expire_job(db, job_id) -> None:
    found = await db.get(Job, job_id)
    if found is not None:
        db.expire(found)


async def _reload_job(db, job_id):
    row = await db.get(Job, job_id)
    if row is not None:
        await db.refresh(row)
    return row


async def fail_owned(db, job_id, business_id, token, code: str, *, retryable: bool, now=None) -> bool:
    """Fail or requeue only while this token still owns the running claim."""
    moment = _moment(now)
    current = await db.scalar(select(Job).where(*_live(job_id, business_id, token, moment)))
    if current is None:
        return False
    attempts, maximum = current.attempts, current.max_attempts
    encode = _encode_claim(token)
    await _expire_job(db, job_id)
    if retryable and attempts < maximum:
        values = {
            "status": "awaiting_encode" if encode else "queued",
            "error_code": None,
            "claim_token": None,
            "deadline_at": None,
        }
    else:
        values = {
            "status": "failed",
            "error_code": code,
            "claim_token": None,
            "deadline_at": None,
        }
    result = await db.execute(
        update(Job)
        .where(*_live(job_id, business_id, token, moment), Job.attempts == attempts)
        .values(**values)
        .execution_options(synchronize_session=False)
    )
    return result.rowcount == 1


async def complete_owned(db, job_id, business_id, token, *, values, now=None) -> bool:
    """Apply a success transition only while this token still owns the claim."""
    moment = _moment(now)
    await _expire_job(db, job_id)
    payload = {
        "claim_token": None,
        "deadline_at": None,
        "error_code": None,
        **values,
    }
    result = await db.execute(
        update(Job)
        .where(*_live(job_id, business_id, token, moment))
        .values(**payload)
        .execution_options(synchronize_session=False)
    )
    return result.rowcount == 1


async def recover_stale(db, *, now=None) -> int:
    """Return an expired claim to the phase that owned it.

    A classification claim goes back to queued. An encode claim goes back to
    awaiting_encode, so a crash during ffmpeg does not look like a new upload.
    The update matches the token and expired deadline that were read.
    """
    moment = _moment(now)
    expired = list((await db.scalars(
        select(Job).where(Job.status == "running", Job.deadline_at.is_not(None), Job.deadline_at < moment)
    )).all())
    restored = 0
    for job in expired:
        job_id, business_id, token = job.id, job.business_id, job.claim_token
        attempts, maximum = job.attempts, job.max_attempts
        encode = _encode_claim(token)
        await _expire_job(db, job_id)
        if attempts < maximum:
            values = {
                "status": "awaiting_encode" if encode else "queued",
                "claim_token": None,
                "deadline_at": None,
                "error_code": None,
            }
        else:
            values = {
                "status": "failed",
                "claim_token": None,
                "deadline_at": None,
                "error_code": "cover_job_stale",
            }
        result = await db.execute(
            update(Job)
            .where(
                Job.id == job_id,
                Job.business_id == business_id,
                Job.status == "running",
                Job.claim_token == token,
                Job.deadline_at.is_not(None),
                Job.deadline_at < moment,
            )
            .values(**values)
            .execution_options(synchronize_session=False)
        )
        if result.rowcount == 1 and attempts < maximum:
            restored += 1
    return restored


async def _claim(db, status: str, *, prefix: str, deadline_seconds: int, now=None):
    candidate = await db.scalar(select(Job).where(Job.status == status).order_by(Job.created_at, Job.id).limit(1))
    if candidate is None:
        return None
    token = prefix + uuid.uuid4().hex
    deadline = (now or datetime.now(timezone.utc)) + timedelta(seconds=deadline_seconds)
    result = await db.execute(
        update(Job)
        .where(Job.id == candidate.id, Job.status == status)
        .values(status="running", attempts=Job.attempts + 1, claim_token=token, deadline_at=deadline)
    )
    if result.rowcount != 1:
        return None
    await db.refresh(candidate)
    return candidate


async def claim_next(db, *, now=None):
    """Claim one queued classification. A second claim of the same row loses."""
    return await _claim(db, "queued", prefix=_CLASSIFY_PREFIX, deadline_seconds=CLASSIFY_DEADLINE_SECONDS, now=now)


async def claim_encode(db, *, now=None):
    """Claim one derivative job. Ready and queued rows are not taken."""
    return await _claim(db, "awaiting_encode", prefix=_ENCODE_PREFIX, deadline_seconds=ENCODE_DEADLINE_SECONDS, now=now)


async def settle(db, job):
    """Finish a claim this worker still owns. A stale token does nothing."""
    if job is None or job.status != "running" or not job.claim_token:
        return None
    token = job.claim_token
    job_id = job.id
    business_id = getattr(job, "business_id", None)
    current = await db.scalar(
        select(Job).where(Job.id == job_id, Job.claim_token == token, Job.status == "running")
    )
    if current is None:
        return None
    business_id = current.business_id
    asset = await db.scalar(select(Asset).where(Asset.id == current.source_asset_id, Asset.business_id == current.business_id))
    if asset is None:
        await fail_owned(db, job_id, business_id, token, "cover_source_missing", retryable=False)
        return await _reload_job(db, job_id)
    if reuse_original(asset):
        wrote = await complete_owned(
            db, job_id, business_id, token,
            values={"status": "ready", "result_asset_id": asset.id, "encoder_profile": REUSE_PROFILE},
        )
        if wrote:
            ready = await db.get(Job, job_id)
            if ready is not None:
                await db.refresh(ready)
                await apply_ready_cover(db, ready)
            return ready
        return None
    wrote = await complete_owned(
        db, job_id, business_id, token,
        values={
            "status": "awaiting_encode",
            "result_asset_id": None,
            "encoder_profile": DERIVATIVE_PROFILE,
            "attempts": 0,
        },
    )
    if not wrote:
        return None
    ready = await db.get(Job, job_id)
    if ready is not None:
        await db.refresh(ready)
    return ready


async def encode_claimed(db, job, store):
    """Encode a claimed derivative. A lost token stores nothing."""
    from types import SimpleNamespace

    from backend.services.business_yansi.cover_encode import (
        CoverEncodeError,
        attach_published_cover,
        publish_cover_object,
        render_cover,
    )
    from backend.services.business_yansi.studio_media import business_media_lock
    from backend.services.business_yansi.video_authority import lock_editor_rows

    if job is None or job.status != "running" or not _encode_claim(job.claim_token):
        return None
    current = await db.scalar(
        select(Job).where(Job.id == job.id, Job.claim_token == job.claim_token, Job.status == "running")
    )
    if current is None:
        return None
    if current.deadline_at is not None and _moment(current.deadline_at) <= _moment():
        return None
    token = current.claim_token
    job_id = current.id
    business_id = current.business_id
    source = await db.scalar(select(Asset).where(Asset.id == current.source_asset_id, Asset.business_id == current.business_id))
    if source is None or source.status == "archived":
        await fail_owned(db, job_id, business_id, token, "cover_source_missing", retryable=False)
        return await _reload_job(db, job_id)
    if store is None:
        await fail_owned(db, job_id, business_id, token, "video_storage_unconfigured", retryable=True)
        return await _reload_job(db, job_id)
    try:
        async with business_media_lock(db, business_id):
            await lock_editor_rows(db, business_id, current.created_by)
            owned = await db.scalar(select(Job).where(*_live(job_id, business_id, token, _moment())))
            if owned is None:
                return None
            existing = await _reusable_derivative(db, source, owned)
            if existing is not None:
                wrote = await complete_owned(
                    db, job_id, business_id, token,
                    values={
                        "status": "ready",
                        "result_asset_id": existing.id,
                        "encoder_profile": DERIVATIVE_PROFILE if existing.source_asset_id is not None else REUSE_PROFILE,
                    },
                )
                if wrote:
                    await mirror_source_links(db, source, existing)
                    ready = await db.get(Job, job_id)
                    if ready is not None:
                        await db.refresh(ready)
                        await apply_ready_cover(db, ready)
                    return ready
                return None
    except HTTPException:
        await fail_owned(db, job_id, business_id, token, "cover_authority_lost", retryable=False)
        ready = await db.get(Job, job_id)
        if ready is not None:
            await db.refresh(ready)
        return ready
    frozen_source = SimpleNamespace(
        id=source.id, business_id=source.business_id, locator=source.locator,
        locator_kind=source.locator_kind, verified_size_bytes=source.verified_size_bytes,
        verified_timescale=source.verified_timescale, title=source.title, caption=source.caption,
        public_allowed=source.public_allowed, status=source.status,
    )
    frozen_job = SimpleNamespace(
        id=job_id, claim_token=token, strategy=current.strategy,
        start_ticks=current.start_ticks, end_ticks=current.end_ticks,
        business_id=business_id, created_by=current.created_by,
    )
    await db.commit()
    try:
        data, info = await render_cover(store, frozen_source, frozen_job)
        final = await publish_cover_object(store, frozen_source, data, info)
    except CoverEncodeError as exc:
        await fail_owned(db, job_id, business_id, token, exc.code, retryable=exc.retryable)
        return await _reload_job(db, job_id)
    try:
        async with business_media_lock(db, business_id):
            await lock_editor_rows(db, business_id, frozen_job.created_by)
            owned = await db.scalar(
                select(Job).where(*_live(job_id, business_id, token, _moment())).with_for_update()
            )
            fresh = await db.scalar(
                select(Asset)
                .where(Asset.id == frozen_source.id, Asset.business_id == business_id)
                .execution_options(populate_existing=True)
            )
            if fresh is not None:
                await db.refresh(fresh)
            if owned is None:
                return None
            if fresh is None or fresh.status == "archived":
                await fail_owned(db, job_id, business_id, token, "cover_source_missing", retryable=False)
                return await _reload_job(db, job_id)
            if fresh.locator != frozen_source.locator or fresh.verified_size_bytes != frozen_source.verified_size_bytes:
                await fail_owned(db, job_id, business_id, token, "cover_source_missing", retryable=False)
                return await _reload_job(db, job_id)
            existing = await _reusable_derivative(db, fresh, owned)
            if existing is None:
                existing = await attach_published_cover(db, fresh, frozen_job.created_by, final, len(data), info)
            await mirror_source_links(db, fresh, existing)
            wrote = await complete_owned(
                db, job_id, business_id, token,
                values={
                    "status": "ready",
                    "result_asset_id": existing.id,
                    "encoder_profile": DERIVATIVE_PROFILE if existing.source_asset_id is not None else REUSE_PROFILE,
                },
            )
            if not wrote:
                return None
            ready = await db.get(Job, job_id)
            if ready is not None:
                await db.refresh(ready)
                await apply_ready_cover(db, ready)
            return ready
    except HTTPException:
        await fail_owned(db, job_id, business_id, token, "cover_authority_lost", retryable=False)
        ready = await db.get(Job, job_id)
        if ready is not None:
            await db.refresh(ready)
        return ready
    except CoverEncodeError as exc:
        await fail_owned(db, job_id, business_id, token, exc.code, retryable=exc.retryable)
        ready = await db.get(Job, job_id)
        if ready is not None:
            await db.refresh(ready)
        return ready


async def process_one(db) -> Job | None:
    await recover_stale(db)
    claimed = await claim_next(db)
    if claimed is None:
        return None
    return await settle(db, claimed)


def cover_is_assignable(asset) -> bool:
    """A stored silent file inside the cover limits. Originals and derivatives both qualify."""
    from backend.services.business_yansi.studio_media import video_may_be_cover

    if getattr(asset, "locator_kind", None) != "storage":
        return False
    return video_may_be_cover(asset) and _silent(asset)


async def _reusable_derivative(db, source, job):
    """Reuse the default derivative. A brand-chosen window needs its own file."""
    if job.strategy == CHOSEN_STRATEGY:
        return None
    return await _existing_derivative(db, source)


async def _existing_derivative(db, source):
    rows = list((await db.scalars(
        select(Asset).where(Asset.business_id == source.business_id, Asset.source_asset_id == source.id)
    )).all())
    for row in rows:
        if cover_is_assignable(row):
            return row
    return None


async def mirror_source_links(db, source, derivative) -> None:
    """Give the derivative the original's active knowledge links. The file is not copied."""
    if source is None or derivative is None or source.id == derivative.id or source.business_id != derivative.business_id:
        return
    wanted = list((await db.scalars(
        select(Link).where(Link.asset_id == source.id, Link.business_id == source.business_id, Link.status == "active")
    )).all())
    current = list((await db.scalars(
        select(Link).where(Link.asset_id == derivative.id, Link.business_id == derivative.business_id)
    )).all())
    by_item = {row.item_id: row for row in current}
    active = set()
    for link in wanted:
        active.add(link.item_id)
        row = by_item.get(link.item_id)
        if row is None:
            db.add(Link(
                business_id=derivative.business_id,
                asset_id=derivative.id,
                item_id=link.item_id,
                confirmed_version_id=link.confirmed_version_id,
                status="active",
            ))
        else:
            row.confirmed_version_id = link.confirmed_version_id
            row.status = "active"
    for row in current:
        if row.item_id not in active and row.status == "active":
            row.status = "retired"
    await db.flush()


async def sync_ready_cover_links(db, business_id) -> None:
    """Catch a derivative up to links added after it was encoded."""
    jobs = list((await db.scalars(
        select(Job).where(Job.business_id == business_id, Job.status == "ready", Job.result_asset_id.is_not(None))
    )).all())
    for job in jobs:
        if job.result_asset_id == job.source_asset_id:
            continue
        source = await db.scalar(select(Asset).where(Asset.id == job.source_asset_id, Asset.business_id == job.business_id))
        result = await db.scalar(select(Asset).where(Asset.id == job.result_asset_id, Asset.business_id == job.business_id))
        await mirror_source_links(db, source, result)


async def apply_ready_cover(db, job) -> int:
    """Make a ready derivative eligible for a later save. Do not edit a Yansı.

    The brand's next create or revise ranks this file with the other covers.
    A finished job does not replace an automatic cover that is already saved.
    """
    if job.status != "ready" or job.result_asset_id is None:
        return 0
    result = await db.scalar(select(Asset).where(Asset.id == job.result_asset_id, Asset.business_id == job.business_id))
    if result is None or not cover_is_assignable(result):
        return 0
    if result.source_asset_id is not None:
        source = await db.scalar(select(Asset).where(Asset.id == result.source_asset_id, Asset.business_id == result.business_id))
        await mirror_source_links(db, source, result)
    return 0


async def latest_for_asset(db, business_id, asset_id):
    return await db.scalar(
        select(Job).where(Job.business_id == business_id, Job.source_asset_id == asset_id).order_by(Job.created_at.desc()).limit(1)
    )


def present_job(job, timescale: int | None = None) -> dict:
    """Status for Studio. Storage keys stay on the server."""
    start = end = None
    if type(timescale) is int and timescale > 0:
        start = job.start_ticks / timescale
        end = job.end_ticks / timescale
    return {
        "status": job.status,
        "resultAssetId": None if job.result_asset_id is None else str(job.result_asset_id),
        "errorCode": job.error_code,
        "startSeconds": start,
        "endSeconds": end,
    }


def _seconds(value) -> float:
    from backend.services.business_yansi.service import fail

    if isinstance(value, bool) or type(value) not in {int, float}:
        fail("cover_segment_rejected", 422)
    number = float(value)
    if number != number or number in {float("inf"), float("-inf")}:
        fail("cover_segment_rejected", 422)
    return number


async def retarget_cover(db, business_id, user_id, asset_id, start_seconds, end_seconds):
    """Queue a brand-chosen window. The original file is not rewritten.

    Segment changes use a conditional UPDATE so a worker that already claimed
    the row cannot lose its token, deadline, or selected window to a stale
    ORM object from an earlier read.

    Authorization: Business lock → require_locked_actor(editor) → asset/job mutate.
    """
    from backend.services.business_yansi.brand_asset_library import _asset_row
    from backend.services.business_yansi.service import access, fail
    from backend.services.business_yansi.studio_media import business_media_lock
    from backend.services.business_yansi.video_authority import require_locked_actor
    from backend.services.business_yansi.video_ingest import COVER_MAX_SECONDS

    await access(db, business_id, user_id, "editor")
    async with business_media_lock(db, business_id):
        await require_locked_actor(db, business_id, user_id, "editor")
        asset = await _asset_row(db, business_id, asset_id)
        if asset.asset_type != "video" or asset.locator_kind != "storage" or not asset.locator:
            fail("cover_source_not_stored", 422)
        if asset.status == "archived":
            fail("archived_asset", 409)
        scale = asset.verified_timescale
        duration = asset.verified_duration
        if type(scale) is not int or type(duration) is not int or scale <= 0 or duration <= 0:
            fail("cover_segment_rejected", 422)
        start_ticks = int(round(_seconds(start_seconds) * scale))
        end_ticks = int(round(_seconds(end_seconds) * scale))
        if start_ticks < 0 or end_ticks > duration or end_ticks <= start_ticks:
            fail("cover_segment_rejected", 422)
        if end_ticks - start_ticks > COVER_MAX_SECONDS * scale:
            fail("cover_segment_rejected", 422)
        job = await latest_for_asset(db, asset.business_id, asset.id)
        if job is None:
            fail("cover_job_not_found", 404)
        reuse = start_ticks == 0 and end_ticks == duration and reuse_original(asset)
        if reuse:
            values = {
                "start_ticks": start_ticks,
                "end_ticks": end_ticks,
                "attempts": 0,
                "error_code": None,
                "claim_token": None,
                "deadline_at": None,
                "strategy": STRATEGY,
                "status": "ready",
                "result_asset_id": asset.id,
                "encoder_profile": REUSE_PROFILE,
            }
        else:
            values = {
                "start_ticks": start_ticks,
                "end_ticks": end_ticks,
                "attempts": 0,
                "error_code": None,
                "claim_token": None,
                "deadline_at": None,
                "strategy": CHOSEN_STRATEGY,
                "status": "awaiting_encode",
                "result_asset_id": None,
                "encoder_profile": DERIVATIVE_PROFILE,
            }
        job_id = job.id
        owner = asset.business_id
        await _expire_job(db, job_id)
        result = await db.execute(
            update(Job)
            .where(
                Job.id == job_id,
                Job.business_id == owner,
                Job.status.in_(("queued", "awaiting_encode", "ready", "failed")),
            )
            .values(**values)
            .execution_options(synchronize_session=False)
        )
        if result.rowcount != 1:
            fail("cover_job_busy", 409)
        refreshed = await _reload_job(db, job_id)
        if reuse and refreshed is not None:
            await apply_ready_cover(db, refreshed)
        await db.commit()
        return await _reload_job(db, job_id)


async def retry_cover(db, business_id, user_id, asset_id):
    """Run a failed preparation again. Approved and published Yansı are not edited.

    Authorization: Business lock → require_locked_actor(editor) → conditional retry UPDATE.
    """
    from backend.services.business_yansi.brand_asset_library import _asset_row
    from backend.services.business_yansi.service import access, fail
    from backend.services.business_yansi.studio_media import business_media_lock
    from backend.services.business_yansi.video_authority import require_locked_actor

    await access(db, business_id, user_id, "editor")
    async with business_media_lock(db, business_id):
        await require_locked_actor(db, business_id, user_id, "editor")
        asset = await _asset_row(db, business_id, asset_id)
        job = await latest_for_asset(db, asset.business_id, asset.id)
        if job is None:
            fail("cover_job_not_found", 404)
        if job.status != "failed":
            fail("cover_retry_rejected", 409)
        nxt = "awaiting_encode" if job.encoder_profile == DERIVATIVE_PROFILE or job.strategy == CHOSEN_STRATEGY else "queued"
        job_id = job.id
        owner = asset.business_id
        await _expire_job(db, job_id)
        result = await db.execute(
            update(Job)
            .where(Job.id == job_id, Job.business_id == owner, Job.status == "failed")
            .values(
                attempts=0, error_code=None, claim_token=None, deadline_at=None,
                result_asset_id=None, status=nxt,
            )
            .execution_options(synchronize_session=False)
        )
        if result.rowcount != 1:
            fail("cover_retry_rejected", 409)
        await db.commit()
        await db.refresh(job)
        return job
