"""Trusted read-only inputs for observation-assisted cover ranking (Phase 7G-4c.1).

Builds candidate-keyed observation snapshots and ``RankingAssetFacts`` for the
pure ``select_cover_ranked`` helper. Does not wire into live create/revise.

Never generates observations or images, never calls a vision provider, and
never performs SQL DML. Facts come only from tenant-scoped committed
projections (Phase 7G-4a). Snapshots are valid for the current read
transaction only — not a claim of global freshness.
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace
from typing import Any

from backend.services.business_yansi.media_observations import active_profile
from backend.services.business_yansi.observation_lookup import (
    load_asset_snapshot,
    ready_observation_for_asset,
    validated_storage_digest,
)
from backend.services.business_yansi.observation_rank import RankingAssetFacts, _UNSET
from backend.services.business_yansi.service import uid


def _cover_media_kind(asset_type: object) -> bool:
    return asset_type in {"image", "video"}


def _as_asset_uuid(value: object) -> uuid.UUID | None:
    """Accept only UUID objects or canonical ``str(UUID)`` text for DB binds.

    A string is accepted only when it equals ``str(uuid.UUID(value))`` exactly —
    compared against the original string, not a stripped or case-folded copy.
    Uppercase, hyphenless, brace-wrapped, padded, empty, malformed, ``None``,
    ints/bools, and arbitrary objects are rejected. Never ``str(object())``.
    """
    if isinstance(value, uuid.UUID):
        return value
    if isinstance(value, bool) or not isinstance(value, str):
        # bool is a subclass of int; reject both ints and non-strings explicitly.
        return None
    if not value:
        return None
    try:
        parsed = uuid.UUID(value)
    except ValueError:
        return None
    if value != str(parsed):
        return None
    return parsed


def _candidate_map_key(candidate_id: uuid.UUID) -> str:
    """Single canonical map key compatible with ``select_cover_ranked``.

    The pure ranker resolves ``asset.id`` first, then ``str(asset.id)``. Storing
    only the canonical string satisfies both UUID-object and UUID-string pool
    stubs without dual-indexing one asset as two map entries.
    """
    return str(candidate_id)


async def _facts_for_candidate(db, owner, candidate_id) -> RankingAssetFacts | None:
    """Return trusted facts for one candidate, or ``None`` when validation fails.

    Source-parent uses identity tri-state: ``_UNSET`` until a tenant-scoped source
    row is loaded; ``None`` only when that row explicitly has ``source_asset_id is None``.
    """
    fresh = await load_asset_snapshot(db, owner, candidate_id)
    if fresh is None or fresh.business_id != owner or fresh.id != candidate_id:
        return None
    if not _cover_media_kind(fresh.asset_type):
        return None
    digest = validated_storage_digest(owner, fresh)
    if digest is None:
        return None

    pointed_source = fresh.source_asset_id
    source_content_sha256 = None
    source_source_asset_id: Any = _UNSET

    if pointed_source is not None and pointed_source != fresh.id:
        source = await load_asset_snapshot(db, owner, pointed_source)
        if source is not None and source.business_id == owner and source.id == pointed_source:
            source_digest = validated_storage_digest(owner, source)
            if source_digest is not None:
                source_content_sha256 = source_digest
                # Explicit column value — never invent original status.
                source_source_asset_id = source.source_asset_id
            # else: incomplete source locator/digest → keep _UNSET
        # else: missing / wrong-tenant source → keep _UNSET
    # Self-pointer or absent source: leave parent as _UNSET (not verified original).

    return RankingAssetFacts(
        asset_id=fresh.id,
        business_id=fresh.business_id,
        content_sha256=digest,
        source_asset_id=pointed_source,
        source_content_sha256=source_content_sha256,
        source_source_asset_id=source_source_asset_id,
    )


async def build_cover_ranking_inputs(
    db,
    business_id,
    pool,
    *,
    profile: str | None = None,
) -> tuple[dict[Any, Any], dict[Any, RankingAssetFacts]]:
    """Build observation and provenance maps keyed by candidate asset id.

    Returns ``(observations, provenances)``. Candidates that fail authoritative
    validation are omitted from both maps (zero observation bonus; lexical
    fallback remains available to the pure ranking helper).

    The caller-supplied pool objects are used only for ``id`` identity. Digests,
    tenant, locator, and source lineage come from committed projections.
    """
    observations: dict[Any, Any] = {}
    provenances: dict[Any, RankingAssetFacts] = {}
    if not pool:
        return observations, provenances

    owner = uid(business_id)
    chosen = profile if isinstance(profile, str) and profile else active_profile()

    with db.no_autoflush:
        for candidate in pool:
            if candidate is None:
                continue
            candidate_id = _as_asset_uuid(getattr(candidate, "id", None))
            if candidate_id is None:
                continue

            facts = await _facts_for_candidate(db, owner, candidate_id)
            if facts is None:
                continue
            map_key = _candidate_map_key(candidate_id)
            provenances[map_key] = facts

            # Lookup ignores untrusted ORM stubs and re-reads committed state.
            # Always bind a canonical UUID — never the raw pool id.
            snapshot = await ready_observation_for_asset(
                db, owner, SimpleNamespace(id=candidate_id), profile=chosen,
            )
            if snapshot is not None:
                observations[map_key] = snapshot

    return observations, provenances
