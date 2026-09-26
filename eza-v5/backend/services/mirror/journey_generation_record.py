# -*- coding: utf-8 -*-
"""Server-owned JourneyGenerationRecord (Phase 3.6b).

Short-lived TTL store keyed by generationId. Written at scoped prepare / scene
generation; read at publish for authoritative hash equality. Not Phase 4 frozen
artifact persistence.
"""

from __future__ import annotations

import threading
import time
from typing import Any

_LOCK = threading.Lock()
_STORE: dict[str, tuple[float, dict[str, Any]]] = {}
_TTL_SECONDS = 60 * 60  # 1 hour — cover prepare → scene → publish
_MAX_ENTRIES = 512

JOURNEY_GENERATION_RECORD_VERSION = "journey_generation_record_v1"


def clear_journey_generation_records_for_tests() -> None:
    with _LOCK:
        _STORE.clear()


def _prune_locked(now: float) -> None:
    expired = [k for k, (ts, _) in _STORE.items() if now - ts > _TTL_SECONDS]
    for k in expired:
        _STORE.pop(k, None)
    if len(_STORE) <= _MAX_ENTRIES:
        return
    # Drop oldest.
    ordered = sorted(_STORE.items(), key=lambda item: item[1][0])
    overflow = len(_STORE) - _MAX_ENTRIES
    for key, _ in ordered[:overflow]:
        _STORE.pop(key, None)


def upsert_journey_generation_record(
    generation_id: str,
    fields: dict[str, Any],
) -> dict[str, Any]:
    """Create or merge a generation record. Empty strings become None."""
    gid = str(generation_id or "").strip()
    if not gid:
        raise ValueError("generation_id required")
    now = time.time()
    with _LOCK:
        _prune_locked(now)
        existing: dict[str, Any] = {}
        item = _STORE.get(gid)
        if item is not None:
            existing = dict(item[1])
        merged = {
            **existing,
            **{k: v for k, v in fields.items() if v is not None and str(v).strip() != ""},
            "contractVersion": JOURNEY_GENERATION_RECORD_VERSION,
            "generationId": gid,
        }
        _STORE[gid] = (now, merged)
        return dict(merged)


def get_journey_generation_record(generation_id: str) -> dict[str, Any] | None:
    gid = str(generation_id or "").strip()
    if not gid:
        return None
    now = time.time()
    with _LOCK:
        item = _STORE.get(gid)
        if item is None:
            return None
        ts, payload = item
        if now - ts > _TTL_SECONDS:
            _STORE.pop(gid, None)
            return None
        return dict(payload)


def bind_scene_asset_to_generation(
    generation_id: str,
    *,
    scene_asset_id: str,
    scene_image_url: str | None = None,
) -> dict[str, Any] | None:
    """
    Bind the first canonical scene for a generationId.

    Returns the canonical record on first bind and on an identical re-bind.
    Returns None when inputs are empty, no record exists, or the generation
    is already bound to a different asset. Never overwrites the first asset.
    """
    outcome, record = bind_canonical_scene_asset(
        generation_id,
        scene_asset_id=scene_asset_id,
        scene_image_url=scene_image_url,
    )
    if outcome in ("bound", "idempotent"):
        return record
    return None


def bind_canonical_scene_asset(
    generation_id: str,
    *,
    scene_asset_id: str,
    scene_image_url: str | None = None,
) -> tuple[str, dict[str, Any] | None]:
    """
    Returns (outcome, canonical_record).

    outcome:
      bound — first asset written
      idempotent — same asset already bound
      conflict — different asset rejected; canonical record is the first bind
      no_record — generation was never prepared in this process
      rejected — empty ids
    """
    gid = str(generation_id or "").strip()
    asset = str(scene_asset_id or "").strip().lower()
    if not gid or not asset:
        return "rejected", None
    existing = get_journey_generation_record(gid)
    if existing is None:
        return "no_record", None
    prior = str(existing.get("sceneAssetId") or "").strip().lower()
    if prior and prior == asset:
        return "idempotent", existing
    if prior and prior != asset:
        return "conflict", existing
    url = (scene_image_url or "").strip() or None
    record = upsert_journey_generation_record(
        gid,
        {
            "sceneAssetId": asset,
            "sceneImageUrl": url,
        },
    )
    return "bound", record


def adopt_canonical_scene_binding(
    generation_id: str,
    *,
    scene_asset_id: str,
    scene_image_url: str,
) -> dict[str, Any] | None:
    """
    Point this process cache at an already-sealed canonical scene.

    Used only to discard a duplicate generation that diverged from durable
    proof. The caller must pass the durable canonical asset, never a newer image.
    """
    gid = str(generation_id or "").strip()
    asset = str(scene_asset_id or "").strip().lower()
    url = str(scene_image_url or "").strip()
    if not gid or not asset or not url:
        return None
    existing = get_journey_generation_record(gid)
    if existing is None:
        return None
    prior = str(existing.get("sceneAssetId") or "").strip().lower()
    if prior == asset:
        return existing
    return upsert_journey_generation_record(
        gid,
        {"sceneAssetId": asset, "sceneImageUrl": url},
    )


def seal_public_landing_on_generation(
    generation_id: str,
    *,
    public_landing_hash: str,
) -> dict[str, Any] | None:
    """First seal wins; later seals must match (idempotent)."""
    gid = str(generation_id or "").strip()
    landing_hash = str(public_landing_hash or "").strip()
    if not gid or not landing_hash:
        return None
    existing = get_journey_generation_record(gid)
    if existing is None:
        return None
    prior = str(existing.get("publicLandingHash") or "").strip()
    if prior and prior != landing_hash:
        return None
    return upsert_journey_generation_record(
        gid, {"publicLandingHash": landing_hash}
    )
