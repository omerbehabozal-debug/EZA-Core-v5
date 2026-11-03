"""Read-only observation lookup for future cover ranking (Phase 7G-4a).

This module never mutates observation rows, never enqueues work, and never
calls a vision provider. Scoring and ranking stay outside this file until a
later phase explicitly wires them.

Returned snapshots are valid only at lookup time. A ranking consumer that
makes a durable decision must revalidate source identity and provenance at
that decision boundary.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.models.business_media_observations import BusinessMediaObservationFrame as Frame
from backend.services.business_yansi.brand_assets import _storage_locator
from backend.services.business_yansi.media_observations import (
    active_profile,
    content_sha_from_locator,
)
from backend.services.business_yansi.service import uid


@dataclass(frozen=True)
class AssetSnapshot:
    """Committed asset columns only. Not an identity-map instance."""

    id: Any
    business_id: Any
    asset_type: str
    locator_kind: str | None
    locator: str | None
    source_asset_id: Any


@dataclass(frozen=True)
class FrameSnapshot:
    timestamp_ms: int
    note: str | None
    tags: tuple[str, ...]


@dataclass(frozen=True)
class ObservationSnapshot:
    """Immutable observation view for ranking. Detached from the caller session.

    Valid only for the moment of lookup. Later caller mutations of ORM rows must
    not alter this object; ranking must revalidate provenance before persistence.
    """

    id: Any
    business_id: Any
    asset_id: Any
    content_sha256: str
    analyzer_profile: str
    status: str
    summary: str | None
    tags: tuple[str, ...]
    visible_text: str | None
    frames: tuple[FrameSnapshot, ...]


def _freeze_tags(value) -> tuple[str, ...]:
    if not isinstance(value, (list, tuple)):
        return ()
    return tuple(str(item) for item in value if isinstance(item, str))


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


async def _asset_snapshot(db, business_id, asset_id) -> AssetSnapshot | None:
    """Read committed asset columns without touching identity-map instances."""
    row = (
        await db.execute(
            select(
                Asset.id,
                Asset.business_id,
                Asset.asset_type,
                Asset.locator_kind,
                Asset.locator,
                Asset.source_asset_id,
            ).where(Asset.id == asset_id, Asset.business_id == uid(business_id))
        )
    ).mappings().first()
    if row is None:
        return None
    return AssetSnapshot(
        id=row["id"],
        business_id=row["business_id"],
        asset_type=row["asset_type"],
        locator_kind=row["locator_kind"],
        locator=row["locator"],
        source_asset_id=row["source_asset_id"],
    )


async def _observation_snapshot(db, business_id, asset_id, profile: str, digest: str) -> ObservationSnapshot | None:
    """Read the ready observation and its frames as an immutable snapshot."""
    owner = uid(business_id)
    row = (
        await db.execute(
            select(
                Observation.id,
                Observation.business_id,
                Observation.asset_id,
                Observation.content_sha256,
                Observation.analyzer_profile,
                Observation.status,
                Observation.summary,
                Observation.tags,
                Observation.visible_text,
            ).where(
                Observation.business_id == owner,
                Observation.asset_id == asset_id,
                Observation.status == "ready",
                Observation.analyzer_profile == profile,
                Observation.content_sha256 == digest,
            )
        )
    ).mappings().first()
    if row is None:
        return None
    frames = (
        await db.execute(
            select(Frame.timestamp_ms, Frame.note, Frame.tags)
            .where(Frame.observation_id == row["id"], Frame.business_id == owner)
            .order_by(Frame.timestamp_ms, Frame.id)
        )
    ).mappings().all()
    return ObservationSnapshot(
        id=row["id"],
        business_id=row["business_id"],
        asset_id=row["asset_id"],
        content_sha256=row["content_sha256"],
        analyzer_profile=row["analyzer_profile"],
        status=row["status"],
        summary=row["summary"],
        tags=_freeze_tags(row["tags"]),
        visible_text=row["visible_text"],
        frames=tuple(
            FrameSnapshot(
                timestamp_ms=item["timestamp_ms"],
                note=item["note"],
                tags=_freeze_tags(item["tags"]),
            )
            for item in frames
        ),
    )


async def ready_observation_for_asset(db, business_id, asset, *, profile: str | None = None) -> ObservationSnapshot | None:
    """Return a detached snapshot of the ready observation for this cover asset.

    The caller-provided asset object is not trusted and is never refreshed.
    Committed asset and observation state are read through column projections so
    pending identity-map edits stay intact. The current locator digest is
    computed first; the observation query matches that digest exactly.

    Queries run under ``no_autoflush`` and never commit, flush, claim, enqueue,
    or call a vision provider.
    """
    if asset is None or getattr(asset, "id", None) is None:
        return None
    owner = uid(business_id)
    asset_id = asset.id
    chosen = profile if isinstance(profile, str) and profile else active_profile()

    with db.no_autoflush:
        fresh = await _asset_snapshot(db, owner, asset_id)
        if fresh is None or fresh.business_id != owner or fresh.id != asset_id:
            return None
        digest = _validated_storage_digest(owner, fresh)
        if digest is None:
            return None

        direct = await _observation_snapshot(db, owner, fresh.id, chosen, digest)
        if observation_integrity_ok(direct, fresh, owner, profile=chosen, digest=digest):
            return direct

        source_id = fresh.source_asset_id
        if source_id is None or source_id == fresh.id:
            return None

        source = await _asset_snapshot(db, owner, source_id)
        if source is None or source.business_id != owner:
            return None
        if source.source_asset_id == fresh.id:
            return None
        source_digest = _validated_storage_digest(owner, source)
        if source_digest is None or source_digest != digest:
            return None

        inherited = await _observation_snapshot(db, owner, source.id, chosen, digest)
        if inherited is None:
            return None
        if not observation_integrity_ok(inherited, source, owner, profile=chosen, digest=digest):
            return None
        return inherited
