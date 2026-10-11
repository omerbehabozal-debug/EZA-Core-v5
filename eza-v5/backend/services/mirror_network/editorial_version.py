"""Lazy, persisted deterministic generation, serialised across workers by DB lock."""
from datetime import datetime, timedelta, timezone
import logging
from sqlalchemy import select
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.yansi_editorial import YansiEditorialVersion
from backend.services.mirror_network.frozen_journey_artifact import get_public_frozen_journey_artifact
from backend.services.mirror_network.editorial_structure import (
    TEMPLATE_VERSION, ORIGINAL_LANGUAGE, source_hash, build_metadata, validate_metadata,
)


async def get_editorial_version(db, *, slug, journey_version=None):
    # The same public eligibility/safety projection is required on every hit.
    public = await get_public_frozen_journey_artifact(db, slug=slug, journey_version=journey_version)
    if public is None:
        return None
    # Lock the existing parent rather than a not-yet-existing derived row.
    # All workers claim the same publication atomically. Generation is cheap,
    # synchronous and transactional; a crash releases the lock without a lease.
    node = (await db.execute(select(MirrorNetworkNode).where(
        MirrorNetworkNode.slug == public["slug"]).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
    if node is None:
        return None
    public = await get_public_frozen_journey_artifact(db, slug=public["slug"], journey_version=public["journeyVersion"])
    if public is None:
        await db.rollback()
        return None
    identity = dict(slug=public["slug"], journey_version=public["journeyVersion"],
                    language=ORIGINAL_LANGUAGE, template_version=TEMPLATE_VERSION, source_hash=source_hash(public))
    row = (await db.execute(select(YansiEditorialVersion).filter_by(**identity))).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is None:
        row = YansiEditorialVersion(**identity, status="pending", attempts=0)
        db.add(row)
    if row.status == "ready":
        try:
            validate_metadata(public, row.structure)
        except ValueError:
            row.status = "failed"
            row.structure = None
    retry_after = row.retry_after
    if retry_after is not None and retry_after.tzinfo is None:
        retry_after = retry_after.replace(tzinfo=timezone.utc)
    if row.status != "ready" and row.attempts < 3 and (retry_after is None or retry_after <= now):
        row.status = "processing"
        row.attempts += 1
        try:
            row.structure = validate_metadata(public, build_metadata(public))
            row.status = "ready"
            row.retry_after = None
        except Exception:
            logging.getLogger(__name__).warning("editorial_generation_failed")
            row.status = "failed"
            row.structure = None
            row.retry_after = now + timedelta(minutes=5 * row.attempts)
    payload = {"slug": identity["slug"], "journeyVersion": identity["journey_version"],
               "language": ORIGINAL_LANGUAGE, "templateVersion": TEMPLATE_VERSION,
               "sourceHash": identity["source_hash"], "offsetEncoding": "utf-16",
               "status": row.status, "steps": row.structure if row.status == "ready" else []}
    await db.commit()
    return payload
