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


async def recover_stale(db, *, now=None) -> int:
    """Return an expired claim to the queue, or fail it once attempts are spent."""
    moment = now or datetime.now(timezone.utc)
    expired = list((await db.scalars(
        select(Observation).where(
            Observation.status == "running",
            Observation.deadline_at.is_not(None),
            Observation.deadline_at < moment,
        )
    )).all())
    restored = 0
    for job in expired:
        job.claim_token = None
        job.deadline_at = None
        if job.attempts < job.max_attempts:
            job.status = "queued"
            job.error_code = None
            restored += 1
        else:
            job.status = "failed"
            job.error_code = "observation_job_stale"
    await db.flush()
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
