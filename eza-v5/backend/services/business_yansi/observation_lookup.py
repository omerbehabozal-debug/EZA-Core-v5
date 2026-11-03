"""Read-only observation lookup for future cover ranking (Phase 7G-4a).

This module never mutates observation rows, never enqueues work, and never
calls a vision provider. Scoring and ranking stay outside this file until a
later phase explicitly wires them.
"""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select

from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.services.business_yansi.brand_assets import _storage_locator
from backend.services.business_yansi.media_observations import (
    active_profile,
    content_sha_from_locator,
    current_asset,
)
from backend.services.business_yansi.service import uid


def _validated_storage_digest(business_id, asset) -> str | None:
    """Return the current private-storage digest, or None when the locator is unsafe."""
    if asset is None:
        return None
    kind = getattr(asset, "asset_type", None)
    if kind not in {"image", "video"}:
        return None
    if getattr(asset, "locator_kind", None) != "storage":
        return None
    locator = getattr(asset, "locator", None)
    if not isinstance(locator, str) or not locator:
        return None
    if "://" in locator or locator.lower().startswith("http"):
        return None
    try:
        _storage_locator(business_id, kind, locator)
    except HTTPException:
        return None
    digest = content_sha_from_locator(locator)
    if not isinstance(digest, str) or len(digest) != 64:
        return None
    return digest


def observation_integrity_ok(
    observation,
    asset,
    business_id,
    *,
    profile: str | None = None,
    digest: str | None = None,
) -> bool:
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
    current = digest if isinstance(digest, str) and len(digest) == 64 else _validated_storage_digest(owner, asset)
    stored = getattr(observation, "content_sha256", None)
    if not isinstance(current, str) or not isinstance(stored, str):
        return False
    return current == stored.lower()


async def _ready_exact(db, business_id, asset_id, profile: str, digest: str):
    """Select the ready observation for this exact brand, asset, profile, and digest."""
    return await db.scalar(
        select(Observation)
        .where(
            Observation.business_id == uid(business_id),
            Observation.asset_id == asset_id,
            Observation.status == "ready",
            Observation.analyzer_profile == profile,
            Observation.content_sha256 == digest,
        )
        .execution_options(populate_existing=True)
    )


async def ready_observation_for_asset(db, business_id, asset, *, profile: str | None = None):
    """Return the ready observation that may safely describe this cover asset.

    The caller-provided asset object is not trusted. Both the cover asset and any
    source asset are reloaded with a tenant-scoped populate_existing read. The
    current locator digest is computed first; the observation query then matches
    that digest exactly so an older ready row cannot hide a newer valid one.

    Queries run under ``no_autoflush`` and never commit, flush, claim, enqueue,
    or call a vision provider.
    """
    if asset is None or getattr(asset, "id", None) is None:
        return None
    owner = uid(business_id)
    asset_id = asset.id
    chosen = profile if isinstance(profile, str) and profile else active_profile()

    with db.no_autoflush:
        fresh = await current_asset(db, asset_id, owner)
        if fresh is None or getattr(fresh, "business_id", None) != owner or fresh.id != asset_id:
            return None
        digest = _validated_storage_digest(owner, fresh)
        if digest is None:
            return None

        direct = await _ready_exact(db, owner, fresh.id, chosen, digest)
        if observation_integrity_ok(direct, fresh, owner, profile=chosen, digest=digest):
            return direct

        source_id = getattr(fresh, "source_asset_id", None)
        if source_id is None or source_id == fresh.id:
            return None

        source = await current_asset(db, source_id, owner)
        if source is None or getattr(source, "business_id", None) != owner:
            return None
        if getattr(source, "source_asset_id", None) == fresh.id:
            return None
        source_digest = _validated_storage_digest(owner, source)
        if source_digest is None or source_digest != digest:
            return None

        inherited = await _ready_exact(db, owner, source.id, chosen, digest)
        if inherited is None:
            return None
        if not observation_integrity_ok(inherited, source, owner, profile=chosen, digest=digest):
            return None
        return inherited
