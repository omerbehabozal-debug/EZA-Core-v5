# -*- coding: utf-8 -*-
"""Durable SERVER-AUTHORED Journey generation proof (no migration).

Stored under StandaloneConversation.tree_metadata[PROOF_NAMESPACE], keyed by
generationId. Written only by prepare / scene-bind paths. Client create and
preparation upsert MUST strip this namespace — never trust client values.

Durable proof is authoritative once it exists. The in-memory
JourneyGenerationRecord is a same-process cache only. If memory and durable
proof disagree on a sealed field, publication fails closed. Memory must not
replace the first canonical scene.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Mapping, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from backend.models.standalone_conversations import StandaloneConversation
from backend.services.mirror.scene_asset_identity import canonicalize_scene_asset_id

logger = logging.getLogger(__name__)


class GenerationProofConflict(Exception):
    """Live cache and durable proof disagree. Callers must fail closed."""

    def __init__(self, field: str):
        self.field = field
        super().__init__(field)


class DurableProofUnavailable(Exception):
    """
    Durable proof could not be established or verified.

    An authenticated Journey must NOT reach READY without durable proof, so
    callers turn this into an explicit generation failure instead of
    returning a scene the client could seal.
    """

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


_AUTHORITY_FIELDS = (
    "journeyId",
    "journeyVersion",
    "sourceConversationId",
    "windowHash",
    "scopedInputHash",
    "selectedStepsHash",
    "sourceBlockHash",
    "interpretationHash",
    "mappedPromptHash",
    "sceneAssetId",
    "publicLandingHash",
)

PROOF_NAMESPACE = "ezaServerJourneyGenerationProofs"
PROOF_CONTRACT_VERSION = "server_journey_generation_proof_v1"
PROOF_AUTHORED_BY = "server"


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def strip_client_generation_proof_namespace(
    metadata: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Remove server-proof namespace from any client-supplied metadata blob."""
    if metadata is None:
        return None
    if not isinstance(metadata, dict):
        return metadata
    if PROOF_NAMESPACE not in metadata:
        return metadata
    cleaned = {k: v for k, v in metadata.items() if k != PROOF_NAMESPACE}
    return cleaned


def strip_client_proof_from_lineage(
    lineage: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Client sealed_lineage must not carry or forge the durable proof blob."""
    if lineage is None:
        return None
    if not isinstance(lineage, dict):
        return lineage
    if PROOF_NAMESPACE not in lineage and "serverGenerationProof" not in lineage:
        return lineage
    cleaned = {
        k: v
        for k, v in lineage.items()
        if k not in (PROOF_NAMESPACE, "serverGenerationProof")
    }
    return cleaned


def build_server_generation_proof(fields: Mapping[str, Any]) -> dict[str, Any]:
    """Build an immutable-shaped proof dict from server-known generation fields."""
    generation_id = _norm(fields.get("generationId"))
    if not generation_id:
        raise ValueError("generationId required for durable proof")
    proof: dict[str, Any] = {
        "contractVersion": PROOF_CONTRACT_VERSION,
        "authoredBy": PROOF_AUTHORED_BY,
        "generationId": generation_id,
        "userId": _norm(fields.get("userId")) or None,
        "sourceConversationId": _norm(fields.get("sourceConversationId")) or None,
        "journeyId": _norm(fields.get("journeyId")).lower() or None,
        "journeyVersion": fields.get("journeyVersion"),
        "windowIndex": fields.get("windowIndex"),
        "windowStart": fields.get("windowStart"),
        "windowEnd": fields.get("windowEnd"),
        "windowHash": _norm(fields.get("windowHash")) or None,
        "scopedInputHash": _norm(fields.get("scopedInputHash")) or None,
        "selectedStepsHash": _norm(fields.get("selectedStepsHash")) or None,
        "sourceBlockHash": _norm(fields.get("sourceBlockHash")) or None,
        "interpretationHash": _norm(fields.get("interpretationHash")) or None,
        "mappedPromptHash": _norm(fields.get("mappedPromptHash")) or None,
        "sceneAssetId": canonicalize_scene_asset_id(fields.get("sceneAssetId")),
        "sceneImageUrl": _norm(fields.get("sceneImageUrl")) or None,
        "publicLandingHash": _norm(fields.get("publicLandingHash")) or None,
        "preparedAt": _norm(fields.get("preparedAt")) or _utcnow_iso(),
    }
    if fields.get("sceneBoundAt"):
        proof["sceneBoundAt"] = _norm(fields.get("sceneBoundAt"))
    # Drop empty optional strings for compactness.
    return {k: v for k, v in proof.items() if v is not None and v != ""}


def proof_as_generation_record(proof: Mapping[str, Any]) -> dict[str, Any]:
    """Shape durable proof for validate_against_server_generation_record."""
    return {
        "generationId": _norm(proof.get("generationId")),
        "journeyId": _norm(proof.get("journeyId")).lower(),
        "journeyVersion": proof.get("journeyVersion"),
        "sourceConversationId": _norm(proof.get("sourceConversationId")),
        "windowIndex": proof.get("windowIndex"),
        "windowStart": proof.get("windowStart"),
        "windowEnd": proof.get("windowEnd"),
        "windowHash": _norm(proof.get("windowHash")),
        "scopedInputHash": _norm(proof.get("scopedInputHash")),
        "selectedStepsHash": _norm(proof.get("selectedStepsHash")),
        "sourceBlockHash": _norm(proof.get("sourceBlockHash")) or None,
        "interpretationHash": _norm(proof.get("interpretationHash")),
        "mappedPromptHash": _norm(proof.get("mappedPromptHash")),
        "sceneAssetId": canonicalize_scene_asset_id(proof.get("sceneAssetId")),
        "sceneImageUrl": _norm(proof.get("sceneImageUrl")) or None,
        "publicLandingHash": _norm(proof.get("publicLandingHash")) or None,
    }


def _read_proof_map(tree_metadata: Any) -> dict[str, Any]:
    if not isinstance(tree_metadata, dict):
        return {}
    raw = tree_metadata.get(PROOF_NAMESPACE)
    if not isinstance(raw, dict):
        return {}
    return dict(raw)


def _is_server_proof(row: Any) -> bool:
    if not isinstance(row, dict):
        return False
    if _norm(row.get("authoredBy")) != PROOF_AUTHORED_BY:
        return False
    if _norm(row.get("contractVersion")) != PROOF_CONTRACT_VERSION:
        return False
    return bool(_norm(row.get("generationId")))


async def _load_owned_conversation_by_client_id(
    db: AsyncSession,
    *,
    user_id: UUID,
    client_conversation_id: str,
    for_update: bool = False,
) -> StandaloneConversation | None:
    """
    Load the owned conversation row.

    for_update issues SELECT ... FOR UPDATE so a read → decide → write
    sequence on the proof namespace cannot interleave across workers. The
    lock is held until the caller's transaction commits or rolls back.
    """
    client_id = _norm(client_conversation_id)
    if not client_id:
        return None
    stmt = select(StandaloneConversation).where(
        StandaloneConversation.user_id == user_id,
        StandaloneConversation.client_conversation_id == client_id,
        StandaloneConversation.deleted_at.is_(None),
    )
    if for_update:
        stmt = stmt.with_for_update()
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def persist_durable_journey_generation_proof(
    db: AsyncSession,
    *,
    user_id: UUID,
    client_conversation_id: str,
    fields: Mapping[str, Any],
    commit: bool = True,
    lock: bool = True,
) -> dict[str, Any] | None:
    """
    Upsert SERVER-authored proof into conversation.tree_metadata.

    Immutable hash fields: once set for a generationId, never overwritten with
    different values. Scene fields may bind once when previously empty.

    The row is locked FOR UPDATE by default so the read-modify-write of the
    JSON namespace cannot lose a concurrent worker's scene bind.
    """
    proof = build_server_generation_proof(
        {
            **fields,
            "userId": str(user_id),
            "sourceConversationId": fields.get("sourceConversationId")
            or client_conversation_id,
        }
    )
    generation_id = proof["generationId"]

    conv = await _load_owned_conversation_by_client_id(
        db,
        user_id=user_id,
        client_conversation_id=client_conversation_id,
        for_update=lock,
    )
    if conv is None:
        logger.info(
            "durable_generation_proof_skip_no_conversation generationId=%s",
            generation_id[:48],
        )
        return None

    tree = dict(conv.tree_metadata) if isinstance(conv.tree_metadata, dict) else {}
    proof_map = _read_proof_map(tree)
    existing = proof_map.get(generation_id)
    if _is_server_proof(existing):
        merged = dict(existing)
        # Never replace authoritative hash / identity fields.
        for key in (
            "journeyId",
            "journeyVersion",
            "sourceConversationId",
            "windowIndex",
            "windowStart",
            "windowEnd",
            "windowHash",
            "scopedInputHash",
            "selectedStepsHash",
            "sourceBlockHash",
            "interpretationHash",
            "mappedPromptHash",
            "userId",
        ):
            if merged.get(key) in (None, "") and proof.get(key) not in (None, ""):
                merged[key] = proof[key]
        # Scene bind: fill once.
        if not canonicalize_scene_asset_id(merged.get("sceneAssetId")) and canonicalize_scene_asset_id(
            proof.get("sceneAssetId")
        ):
            merged["sceneAssetId"] = canonicalize_scene_asset_id(proof.get("sceneAssetId"))
            if proof.get("sceneImageUrl"):
                merged["sceneImageUrl"] = proof["sceneImageUrl"]
            merged["sceneBoundAt"] = proof.get("sceneBoundAt") or _utcnow_iso()
        elif (
            canonicalize_scene_asset_id(merged.get("sceneAssetId"))
            and canonicalize_scene_asset_id(proof.get("sceneAssetId"))
            and canonicalize_scene_asset_id(merged.get("sceneAssetId"))
            != canonicalize_scene_asset_id(proof.get("sceneAssetId"))
        ):
            logger.warning(
                "durable_generation_proof_scene_conflict generationId=%s",
                generation_id[:48],
            )
            return proof_as_generation_record(merged)
        if not _norm(merged.get("publicLandingHash")) and _norm(
            proof.get("publicLandingHash")
        ):
            merged["publicLandingHash"] = proof["publicLandingHash"]
        proof_map[generation_id] = merged
        out = merged
    else:
        # Reject replacing a forged non-server blob under this key.
        if isinstance(existing, dict) and existing and not _is_server_proof(existing):
            logger.warning(
                "durable_generation_proof_reject_forged_blob generationId=%s",
                generation_id[:48],
            )
        proof_map[generation_id] = proof
        out = proof

    tree[PROOF_NAMESPACE] = proof_map
    conv.tree_metadata = tree
    try:
        flag_modified(conv, "tree_metadata")
    except Exception:
        # Non-ORM test doubles / already-tracked JSON assignment.
        pass
    conv.updated_at = datetime.now(timezone.utc)
    if commit:
        await db.commit()
        await db.refresh(conv)
    else:
        await db.flush()
    return proof_as_generation_record(out)


async def bind_durable_canonical_scene(
    db: AsyncSession,
    *,
    user_id: UUID,
    client_conversation_id: str,
    generation_id: str,
    scene_asset_id: str,
    scene_image_url: str,
    seed: Mapping[str, Any] | None = None,
) -> tuple[str, dict[str, Any] | None]:
    """
    Atomically bind the FIRST canonical scene for one generationId.

    SELECT ... FOR UPDATE on the owned conversation row covers the whole
    read → decision → write sequence, so two workers cannot both observe
    "unbound" and then overwrite each other. The loser sees the committed
    first bind and returns it.

    Returns (outcome, canonical_record):
      bound          — this call wrote the first canonical scene
      idempotent     — same asset already bound
      conflict       — a different asset is already canonical; record is it
      no_conversation— no owned conversation row to hold the proof
      no_proof       — no server proof and no sufficient seed to create one

    Transaction ownership: this function flushes only. The caller owns
    commit/rollback and therefore owns lock release.
    """
    gid = _norm(generation_id)
    asset = canonicalize_scene_asset_id(scene_asset_id) or ""
    url = _norm(scene_image_url)
    if not gid or not asset or not url:
        return "no_proof", None

    conv = await _load_owned_conversation_by_client_id(
        db,
        user_id=user_id,
        client_conversation_id=client_conversation_id,
        for_update=True,
    )
    if conv is None:
        return "no_conversation", None

    tree = dict(conv.tree_metadata) if isinstance(conv.tree_metadata, dict) else {}
    proof_map = _read_proof_map(tree)
    existing = proof_map.get(gid)

    if _is_server_proof(existing):
        proof = dict(existing)
    elif seed and _norm(seed.get("interpretationHash")) and _norm(seed.get("mappedPromptHash")):
        proof = build_server_generation_proof(
            {
                **seed,
                "generationId": gid,
                "userId": str(user_id),
                "sourceConversationId": _norm(seed.get("sourceConversationId"))
                or client_conversation_id,
            }
        )
    else:
        return "no_proof", None

    prior_asset = canonicalize_scene_asset_id(proof.get("sceneAssetId")) or ""
    if prior_asset and prior_asset != asset:
        # First canonical scene wins. Never overwrite it with a later image.
        logger.warning(
            "durable_canonical_scene_conflict generationId=%s",
            gid[:48],
        )
        return "conflict", proof_as_generation_record(proof)

    outcome = "idempotent" if prior_asset == asset else "bound"
    proof["sceneAssetId"] = asset
    if outcome == "bound" or not _norm(proof.get("sceneImageUrl")):
        proof["sceneImageUrl"] = url
    proof.setdefault("sceneBoundAt", _utcnow_iso())

    proof_map[gid] = proof
    tree[PROOF_NAMESPACE] = proof_map
    conv.tree_metadata = tree
    try:
        flag_modified(conv, "tree_metadata")
    except Exception:
        # Non-ORM test doubles / already-tracked JSON assignment.
        pass
    conv.updated_at = datetime.now(timezone.utc)
    await db.flush()

    # Read-after-write inside the locked transaction: re-read what was
    # actually written rather than trusting the in-memory object.
    try:
        await db.refresh(conv)
    except Exception:
        logger.exception("durable_canonical_scene_refresh_failed generationId=%s", gid[:48])
        raise
    written = _read_proof_map(conv.tree_metadata).get(gid)
    if not _is_server_proof(written):
        raise DurableProofUnavailable("proof_missing_after_write")
    if (canonicalize_scene_asset_id(written.get("sceneAssetId")) or "") != asset:
        # Someone else's asset is canonical after our write attempt.
        return "conflict", proof_as_generation_record(written)
    return outcome, proof_as_generation_record(written)


def assert_durable_scene_proof_matches(
    proof: Mapping[str, Any] | None,
    *,
    generation_id: str,
    user_id: UUID,
    source_conversation_id: str | None,
    journey_id: str | None,
    journey_version: Any,
    scene_asset_id: str,
    scene_image_url: str,
) -> dict[str, Any]:
    """
    Verify a durable proof is sufficient for an authenticated READY Yansı.

    Raises DurableProofUnavailable when the proof is missing or does not
    describe exactly this generation, owner, Journey, and canonical scene.
    """
    if not proof:
        raise DurableProofUnavailable("proof_missing")
    if _norm(proof.get("generationId")) != _norm(generation_id):
        raise DurableProofUnavailable("generation_mismatch")
    proof_owner = _norm(proof.get("userId"))
    if proof_owner and proof_owner != str(user_id):
        raise DurableProofUnavailable("owner_mismatch")
    if source_conversation_id and _norm(proof.get("sourceConversationId")) != _norm(
        source_conversation_id
    ):
        raise DurableProofUnavailable("conversation_mismatch")
    if journey_id and _norm(proof.get("journeyId")).lower() != _norm(journey_id).lower():
        raise DurableProofUnavailable("journey_mismatch")
    if journey_version is not None and proof.get("journeyVersion") is not None:
        if str(proof.get("journeyVersion")) != str(journey_version):
            raise DurableProofUnavailable("journey_version_mismatch")
    if (canonicalize_scene_asset_id(proof.get("sceneAssetId")) or "") != (
        canonicalize_scene_asset_id(scene_asset_id) or ""
    ):
        raise DurableProofUnavailable("scene_asset_mismatch")
    if _norm(proof.get("sceneImageUrl")) != _norm(scene_image_url):
        raise DurableProofUnavailable("scene_url_mismatch")
    for key in ("windowHash", "selectedStepsHash", "interpretationHash", "mappedPromptHash"):
        if not _norm(proof.get(key)):
            raise DurableProofUnavailable(f"missing_{key}")
    return dict(proof)


async def load_durable_journey_generation_proof(
    db: AsyncSession,
    *,
    user_id: UUID,
    generation_id: str,
    client_conversation_id: str | None = None,
) -> dict[str, Any] | None:
    """
    Load SERVER-authored proof by exact generationId + owner.

    Prefer conversation scoped by client_conversation_id when provided.
    """
    gid = _norm(generation_id)
    if not gid:
        return None

    if client_conversation_id:
        conv = await _load_owned_conversation_by_client_id(
            db,
            user_id=user_id,
            client_conversation_id=client_conversation_id,
        )
        if conv is None:
            return None
        proof = _read_proof_map(conv.tree_metadata).get(gid)
        if not _is_server_proof(proof):
            return None
        if _norm(proof.get("userId")) and _norm(proof.get("userId")) != str(user_id):
            return None
        return proof_as_generation_record(proof)

    # Exact generationId scan within owner conversations (bounded).
    result = await db.execute(
        select(StandaloneConversation).where(
            StandaloneConversation.user_id == user_id,
            StandaloneConversation.deleted_at.is_(None),
            StandaloneConversation.tree_metadata.isnot(None),
        ).limit(500)
    )
    for conv in result.scalars().all():
        proof = _read_proof_map(conv.tree_metadata).get(gid)
        if not _is_server_proof(proof):
            continue
        if _norm(proof.get("userId")) and _norm(proof.get("userId")) != str(user_id):
            continue
        return proof_as_generation_record(proof)
    return None


def _authority_value(record: Mapping[str, Any], key: str) -> str:
    raw = record.get(key)
    if raw is None:
        return ""
    text = str(raw).strip()
    if key in ("journeyId", "sceneAssetId"):
        return text.lower()
    return text


def _first_authority_conflict(
    durable: Mapping[str, Any],
    live: Mapping[str, Any],
) -> str | None:
    for key in _AUTHORITY_FIELDS:
        durable_val = _authority_value(durable, key)
        live_val = _authority_value(live, key)
        if durable_val and live_val and durable_val != live_val:
            return key
    return None


def _merge_durable_over_live(
    durable: Mapping[str, Any],
    live: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """Durable nonempty fields win. Live fills only fields durable has not sealed."""
    merged = dict(live or {})
    for key, value in durable.items():
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        merged[key] = value
    return merged


async def resolve_generation_record_for_publish(
    db: AsyncSession,
    *,
    user_id: UUID,
    generation_id: str,
    client_conversation_id: str | None,
) -> tuple[dict[str, Any] | None, str]:
    """
    Durable proof is authoritative when it exists.

    Returns (record, source) where source is 'durable' | 'memory' | 'missing'.
    Raises GenerationProofConflict when memory and durable disagree.
    Memory alone is only a same-process cache for proofs not yet durable.
    """
    from backend.services.mirror.journey_generation_record import (
        get_journey_generation_record,
    )

    gid = _norm(generation_id)
    live = get_journey_generation_record(gid)
    durable = await load_durable_journey_generation_proof(
        db,
        user_id=user_id,
        generation_id=gid,
        client_conversation_id=client_conversation_id,
    )
    if durable is not None and live is not None:
        conflict = _first_authority_conflict(durable, live)
        if conflict:
            raise GenerationProofConflict(conflict)
        return _merge_durable_over_live(durable, live), "durable"
    if durable is not None:
        return dict(durable), "durable"
    if live is not None:
        return live, "memory"
    return None, "missing"


async def lookup_canonical_generated_scene(
    db: AsyncSession,
    *,
    generation_id: str,
    user_id: UUID | None,
    client_conversation_id: str | None,
) -> dict[str, str] | None:
    """
    If this generationId already has one canonical scene, return it.

    Durable scene wins. A divergent in-memory scene is rewritten to that
    canonical asset so a duplicate generate-scene cannot publish image B.
    Raises GenerationProofConflict only when both scenes exist and durable
    has no URL to return — callers should fail the duplicate request.
    """
    from backend.services.mirror.journey_generation_record import (
        adopt_canonical_scene_binding,
        get_journey_generation_record,
    )

    gid = _norm(generation_id)
    if not gid:
        return None
    live = get_journey_generation_record(gid)
    durable = None
    if user_id is not None:
        durable = await load_durable_journey_generation_proof(
            db,
            user_id=user_id,
            generation_id=gid,
            client_conversation_id=client_conversation_id,
        )
    durable_asset = (
        canonicalize_scene_asset_id(_authority_value(durable, "sceneAssetId"))
        if durable
        else ""
    )
    durable_url = _norm(durable.get("sceneImageUrl")) if durable else ""
    live_asset = (
        canonicalize_scene_asset_id(_authority_value(live, "sceneAssetId"))
        if live
        else ""
    )
    live_url = _norm(live.get("sceneImageUrl")) if live else ""

    if durable_asset and durable_url:
        if live_asset and live_asset != durable_asset:
            adopt_canonical_scene_binding(
                gid,
                scene_asset_id=durable_asset,
                scene_image_url=durable_url,
            )
        return {"sceneAssetId": durable_asset, "sceneImageUrl": durable_url}
    if live_asset and live_url:
        return {"sceneAssetId": live_asset, "sceneImageUrl": live_url}
    if durable_asset and live_asset and durable_asset != live_asset:
        raise GenerationProofConflict("sceneAssetId")
    return None
