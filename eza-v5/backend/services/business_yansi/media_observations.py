"""Durable visual-observation jobs.

The feature is off unless BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED is true.
Analysis runs only when a vision model is configured. A disabled or missing
table leaves the upload and the Yansı untouched. Descriptions are not
knowledge, and a finished job does not edit a draft.
"""
import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.services.business_yansi.service import uid

PROFILE = "visual-v1"
DEADLINE_SECONDS = 60
_CLAIM_PREFIX = "o"
_FLAG = "BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED"
_PROFILE_FLAG = "BILIGN_BUSINESS_OBSERVATION_PROFILE"
_MODEL_FLAG = "BILIGN_BUSINESS_VISION_MODEL"
_CONCURRENCY_FLAG = "BILIGN_BUSINESS_VISION_CONCURRENCY"
_HEX = frozenset("0123456789abcdef")
_PROFILE_CHARS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")


def enabled() -> bool:
    return os.getenv(_FLAG, "false").strip().lower() in {"1", "true", "yes", "on"}


def active_profile() -> str:
    raw = os.getenv(_PROFILE_FLAG, "").strip()
    if raw and len(raw) <= 64 and all(ch in _PROFILE_CHARS for ch in raw):
        return raw
    return PROFILE


def vision_model() -> str:
    return os.getenv(_MODEL_FLAG, "").strip()[:64]


def concurrency() -> int:
    raw = os.getenv(_CONCURRENCY_FLAG, "2").strip()
    try:
        value = int(raw)
    except ValueError:
        value = 2
    return max(1, min(value, 4))


def timeout_seconds() -> float:
    raw = os.getenv("BILIGN_BUSINESS_VISION_TIMEOUT_SECONDS", "20").strip()
    try:
        value = float(raw)
    except ValueError:
        value = 20.0
    return max(1.0, min(value, 60.0))


def analyzer_ready() -> bool:
    """True when a vision model name is configured. The key stays with the client."""
    return bool(vision_model())


def observation_key(business_id, content_sha256: str, profile: str = PROFILE) -> str:
    material = f"observe-v1|{uid(business_id)}|{profile}|{content_sha256}"
    return hashlib.sha256(material.encode()).hexdigest()


def content_sha_from_locator(locator) -> str | None:
    """The digest already stored in a brand object key. Remote URLs are refused."""
    if not isinstance(locator, str) or "://" in locator or locator.lower().startswith("http"):
        return None
    if ".." in locator or "\\" in locator or "/staging/" in locator:
        return None
    stem = locator.rsplit("/", 1)[-1].split(".", 1)[0].lower()
    if len(stem) != 64 or any(ch not in _HEX for ch in stem):
        return None
    return stem


async def ensure_observation(db, asset, user_id, *, content_sha256=None, profile=None, origin="upload"):
    """One queued job per brand, profile, and byte hash. Repeats return that row.

    Same bytes in another brand are a different row. A silent derivative is
    not a second job. HTTPS locators are ignored. A missing table rolls back
    only this savepoint.
    """
    if not enabled():
        return None
    kind = getattr(asset, "asset_type", None)
    if kind not in {"image", "video"}:
        return None
    if kind == "video" and getattr(asset, "source_asset_id", None) is not None:
        return None
    locator = getattr(asset, "locator", None)
    if not isinstance(locator, str) or "://" in locator or locator.lower().startswith("http") or "/staging/" in locator:
        return None
    chosen = profile or active_profile()
    if getattr(asset, "locator_kind", None) != "storage" or origin not in {"upload", "generated"}:
        return None
    digest = (content_sha256 or content_sha_from_locator(getattr(asset, "locator", None)) or "").lower()
    if len(digest) != 64 or any(ch not in _HEX for ch in digest):
        return None
    if getattr(asset, "id", None) is None:
        return None
    try:
        async with db.begin_nested():
            existing = await _same_bytes(db, asset.business_id, chosen, digest)
            if existing is not None:
                return existing
            row = Observation(
                id=uuid.uuid4(),
                business_id=asset.business_id,
                asset_id=asset.id,
                content_sha256=digest,
                analyzer_profile=chosen,
                idempotency_key=observation_key(asset.business_id, digest, chosen),
                status="queued",
                attempts=0,
                max_attempts=3,
                origin=origin,
                summary=None,
                visible_text=None,
                tags=None,
                created_by=uid(user_id),
            )
            db.add(row)
            await db.flush()
            return row
    except IntegrityError:
        return await _same_bytes(db, asset.business_id, chosen, digest)
    except (OperationalError, ProgrammingError):
        return None


async def _same_bytes(db, business_id, profile, digest):
    return await db.scalar(
        select(Observation).where(
            Observation.business_id == business_id,
            Observation.analyzer_profile == profile,
            Observation.content_sha256 == digest,
        )
    )


def _moment(now=None):
    moment = now or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment


def _live(job_id, business_id, token, moment):
    """The claim that may still write: same job, brand, token, and a live deadline."""
    return (
        Observation.id == job_id,
        Observation.business_id == business_id,
        Observation.status == "running",
        Observation.claim_token == token,
        Observation.deadline_at.is_not(None),
        Observation.deadline_at > moment,
    )


def digest_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def digest_path(path: str) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(block)
    return hasher.hexdigest()


def provenance_ok(content_sha256: str, asset, actual: str) -> bool:
    """The stored bytes, the locator, and this observation are one file."""
    if asset is None or not isinstance(actual, str):
        return False
    located = content_sha_from_locator(getattr(asset, "locator", None))
    return actual == content_sha256 and located == content_sha256


def asset_matches(asset, business_id, asset_id, content_sha256: str, actual: str) -> bool:
    """Fresh asset row, same brand, same file identity, and matching bytes."""
    if asset is None or getattr(asset, "id", None) != asset_id:
        return False
    if getattr(asset, "business_id", None) != business_id:
        return False
    return provenance_ok(content_sha256, asset, actual)


def transaction_idle(db) -> bool:
    """True when the session is not inside an open transaction."""
    return not db.in_transaction()


async def current_asset(db, asset_id, business_id):
    """Force a database round-trip. The identity map is not trusted here."""
    row = await db.scalar(
        select(Asset)
        .where(Asset.id == asset_id, Asset.business_id == business_id)
        .execution_options(populate_existing=True)
    )
    if row is not None:
        await db.refresh(row)
    return row


async def _expire_job(db, job_id) -> None:
    found = await db.get(Observation, job_id)
    if found is not None:
        db.expire(found)


async def owned_observation(db, held, *, now=None):
    """Load the row only while this token still owns a live deadline."""
    job_id, token, business_id = held
    if not token:
        return None
    return await db.scalar(select(Observation).where(*_live(job_id, business_id, token, _moment(now))))


async def fail_owned(db, held, code: str, *, retryable: bool, now=None) -> bool:
    """Requeue or fail only if this token still owns the row. A newer claim is left alone."""
    job_id, token, business_id = held
    moment = _moment(now)
    current = await owned_observation(db, held, now=moment)
    if current is None:
        return False
    attempts, maximum = current.attempts, current.max_attempts
    await _expire_job(db, job_id)
    if retryable and attempts < maximum:
        values = {"status": "queued", "error_code": None, "claim_token": None, "deadline_at": None}
    else:
        values = {"status": "failed", "error_code": code, "claim_token": None, "deadline_at": None}
    result = await db.execute(
        update(Observation)
        .where(*_live(job_id, business_id, token, moment), Observation.attempts == attempts)
        .values(**values)
        .execution_options(synchronize_session=False)
    )
    return result.rowcount == 1


async def complete_owned(db, held, *, summary, tags, visible_text, provider_model, input_tokens, output_tokens, frames=None, now=None) -> bool:
    """Store the description and its frames only after this claim still matches.

    The frame rows are added in the same transaction, and only after the
    conditional update matches. A lost or expired claim writes neither.
    """
    job_id, token, business_id = held
    moment = _moment(now)
    await _expire_job(db, job_id)
    result = await db.execute(
        update(Observation)
        .where(*_live(job_id, business_id, token, moment))
        .values(
            status="ready",
            error_code=None,
            claim_token=None,
            deadline_at=None,
            summary=summary,
            tags=tags,
            visible_text=visible_text,
            provider_model=provider_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        return False
    if frames:
        from sqlalchemy import delete

        from backend.models.business_media_observations import BusinessMediaObservationFrame as Frame

        await db.execute(delete(Frame).where(Frame.observation_id == job_id, Frame.business_id == business_id))
        for item in frames:
            db.add(Frame(
                observation_id=job_id,
                business_id=business_id,
                timestamp_ms=item["timestamp_ms"],
                note=item["note"],
                tags=item["tags"],
            ))
    await db.flush()
    return True


async def note_changed_source(db, held, asset, created_by, actual: str) -> bool:
    """Fail the old hash and queue a separate observation for the new identity.

    Either the stored bytes changed under the old locator, or the asset row now
    points at a different digest. The old claim never stores the new description.
    """
    job_id, _token, _business_id = held
    current = await db.get(Observation, job_id)
    previous = None if current is None else current.content_sha256
    wrote = await fail_owned(db, held, "observation_source_stale", retryable=False)
    if not wrote or asset is None:
        return wrote
    located = content_sha_from_locator(getattr(asset, "locator", None))
    candidates = []
    if isinstance(actual, str) and len(actual) == 64 and actual != previous:
        candidates.append(actual)
    if isinstance(located, str) and located != previous and located not in candidates:
        candidates.append(located)
    for digest in candidates:
        await ensure_observation(db, asset, created_by, content_sha256=digest)
    return True


async def finish_authorized(db, held, business_id, user_id, write):
    """Re-check brand authority, then let write() persist inside that short transaction."""
    from fastapi import HTTPException

    from backend.services.business_yansi.studio_media import business_media_lock
    from backend.services.business_yansi.video_authority import lock_editor_rows

    try:
        async with business_media_lock(db, business_id):
            await lock_editor_rows(db, business_id, user_id)
            return await write()
    except HTTPException:
        await fail_owned(db, held, "observation_authority_lost", retryable=False)
        return None


async def recover_stale(db, *, now=None) -> int:
    """Return an expired claim to the queue, or fail it once attempts are spent.

    The update matches the token and deadline that were read. A newer claim
    has a different token, so this recovery does not take it back.
    """
    moment = _moment(now)
    expired = list((await db.scalars(
        select(Observation).where(
            Observation.status == "running",
            Observation.deadline_at.is_not(None),
            Observation.deadline_at < moment,
        )
    )).all())
    restored = 0
    for job in expired:
        job_id, business_id, token = job.id, job.business_id, job.claim_token
        attempts, maximum = job.attempts, job.max_attempts
        await _expire_job(db, job_id)
        if attempts < maximum:
            values = {"status": "queued", "claim_token": None, "deadline_at": None, "error_code": None}
        else:
            values = {"status": "failed", "claim_token": None, "deadline_at": None, "error_code": "observation_job_stale"}
        result = await db.execute(
            update(Observation)
            .where(
                Observation.id == job_id,
                Observation.business_id == business_id,
                Observation.status == "running",
                Observation.claim_token == token,
                Observation.deadline_at.is_not(None),
                Observation.deadline_at < moment,
            )
            .values(**values)
            .execution_options(synchronize_session=False)
        )
        if result.rowcount == 1 and attempts < maximum:
            restored += 1
    return restored


async def claim_next(db, *, now=None):
    """Claim one queued job. A concurrent claim of the same row loses."""
    return await _claim(db, now=now)


async def claim_next_image(db, *, now=None):
    """Claim one queued stored image."""
    return await _claim(db, now=now, kinds=("image",))


async def claim_next_visual(db, *, now=None):
    """Claim one stored image or original video. Derivatives stay unclaimed."""
    return await _claim(db, now=now, kinds=("image", "video"))


async def _claim(db, *, now, kinds=None):
    query = select(Observation).where(
        Observation.status == "queued",
        Observation.attempts < Observation.max_attempts,
    )
    if kinds is not None:
        query = query.join(
            Asset,
            (Asset.id == Observation.asset_id) & (Asset.business_id == Observation.business_id),
        ).where(
            Asset.asset_type.in_(tuple(kinds)),
            Asset.locator_kind == "storage",
            Asset.source_asset_id.is_(None),
        )
    candidate = await db.scalar(query.order_by(Observation.created_at, Observation.id).limit(1))
    if candidate is None:
        return None
    token = _CLAIM_PREFIX + uuid.uuid4().hex
    deadline = (now or datetime.now(timezone.utc)) + timedelta(seconds=DEADLINE_SECONDS)
    result = await db.execute(
        update(Observation)
        .where(Observation.id == candidate.id, Observation.status == "queued", Observation.attempts < Observation.max_attempts)
        .values(status="running", attempts=Observation.attempts + 1, claim_token=token, deadline_at=deadline, error_code=None)
    )
    if result.rowcount != 1:
        return None
    await db.refresh(candidate)
    return candidate


async def retain_claim(db, job):
    """Touch a claim this token still owns. A mismatch writes nothing."""
    if job is None or not job.claim_token:
        return None
    current = await db.scalar(
        select(Observation).where(
            Observation.id == job.id,
            Observation.claim_token == job.claim_token,
            Observation.status == "running",
        )
    )
    if current is None:
        return None
    await db.flush()
    return current


async def observation_count(db, business_id) -> int:
    return int(await db.scalar(
        select(func.count()).select_from(Observation).where(Observation.business_id == business_id)
    ) or 0)
