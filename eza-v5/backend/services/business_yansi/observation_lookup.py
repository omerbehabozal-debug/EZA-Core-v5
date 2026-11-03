"""Read-only observation lookup for future cover ranking (Phase 7G-4a).

This module never mutates observation rows, never enqueues work, and never
calls a vision provider. Scoring and ranking stay outside this file until a
later phase explicitly wires them.
"""
from __future__ import annotations

from sqlalchemy import select

from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.services.business_yansi.media_observations import (
    active_profile,
    content_sha_from_locator,
    current_asset,
)
from backend.services.business_yansi.service import uid


def observation_integrity_ok(observation, asset, business_id, *, profile: str | None = None) -> bool:
    """True when a ready observation still describes this brand's current file."""
    if observation is None or asset is None:
        return False
    owner = uid(business_id)
    if getattr(observation, "business_id", None) != owner:
        return False
    if getattr(asset, "business_id", None) != owner:
        return False
    if getattr(observation, "asset_id", None) != getattr(asset, "id", None):
        return False
    if getattr(observation, "status", None) != "ready":
        return False
    expected = profile if isinstance(profile, str) and profile else active_profile()
    if getattr(observation, "analyzer_profile", None) != expected:
        return False
    digest = content_sha_from_locator(getattr(asset, "locator", None))
    stored = getattr(observation, "content_sha256", None)
    if not isinstance(digest, str) or not isinstance(stored, str):
        return False
    return digest == stored.lower() and len(digest) == 64


async def _ready_for_asset_id(db, business_id, asset_id, *, profile: str):
    return await db.scalar(
        select(Observation).where(
            Observation.business_id == uid(business_id),
            Observation.asset_id == asset_id,
            Observation.status == "ready",
            Observation.analyzer_profile == profile,
        )
    )


async def ready_observation_for_asset(db, business_id, asset, *, profile: str | None = None):
    """Return the ready observation that may safely describe this cover asset.

    Lookup is tenant-scoped and limited to status=ready rows whose analyzer
    profile matches the active profile (or an explicit override).

    Derivative covers do not inherit a source observation unless the current
    locator digest is identical to the source locator digest. Different
    content hashes never inherit.
    """
    if asset is None or getattr(asset, "id", None) is None:
        return None
    owner = uid(business_id)
    if getattr(asset, "business_id", None) != owner:
        return None
    chosen = profile if isinstance(profile, str) and profile else active_profile()
    direct = await _ready_for_asset_id(db, owner, asset.id, profile=chosen)
    if observation_integrity_ok(direct, asset, owner, profile=chosen):
        return direct

    source_id = getattr(asset, "source_asset_id", None)
    if source_id is None:
        return None
    cover_digest = content_sha_from_locator(getattr(asset, "locator", None))
    if cover_digest is None:
        return None
    source = await current_asset(db, source_id, owner)
    if source is None:
        return None
    source_digest = content_sha_from_locator(getattr(source, "locator", None))
    if source_digest is None or source_digest != cover_digest:
        return None
    inherited = await _ready_for_asset_id(db, owner, source.id, profile=chosen)
    if inherited is None:
        return None
    if not observation_integrity_ok(inherited, source, owner, profile=chosen):
        return None
    if inherited.content_sha256 != cover_digest:
        return None
    return inherited
