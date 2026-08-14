# -*- coding: utf-8 -*-
"""Stage 4C — publish Mirror to network on creation (share URL guarantee)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping, Optional, Sequence, Tuple
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.schemas.mirror_network import (
    MirrorNetworkPublicPayload,
    MirrorNetworkPublishRequest,
)
from backend.models.mirror_network import (
    ARTIFACT_KIND_JOURNEY_V1,
    ARTIFACT_KIND_LEGACY_LANDING,
    MirrorNetworkNode,
)
from backend.models.production import User
from backend.services.mirror_network.continuation_proof import (
    resolve_parent_slug_from_proof,
)
from backend.services.mirror_network.parent_lineage import (
    normalize_parent_slug,
    resolve_stored_parent_slug,
    validate_parent_slug,
)
from backend.services.mirror_network.public_payload import split_curiosity_payloads
from backend.services.mirror.mirror_director_metadata_sanitize import (
    sanitize_intelligence_private_for_persist,
)
from backend.services.mirror.mirror_scene_asset_store import ensure_persistable_mirror_scene_url
from backend.services.mirror_network.repository import (
    create_mirror_network_node,
    get_mirror_network_node_by_conversation,
    get_mirror_network_node_by_slug,
    get_mirror_network_node_by_slug_for_user,
    slug_exists,
    update_mirror_network_node,
)
from backend.services.mirror_network.service import node_to_public_payload
from backend.services.mirror_network.slug import generate_mirror_slug
from backend.services.mirror_network.types import MirrorNetworkNodeRecord
from backend.services.mirror_network.journey_publish_contract import (
    resolve_journey_publish_mode,
)
from backend.services.mirror_network.journey_steps import (
    get_lineage_selected_steps_hash_for_version,
    replace_journey_steps_for_version,
)
from backend.services.mirror_network.journey_window_contract import (
    resolve_requested_parent_slug,
)
from backend.services.mirror_network.same_conversation_parent import (
    resolve_same_conversation_parent,
    resolve_verified_continuation_parent,
)
from backend.services.mirror_network.frozen_journey_artifact import (
    FREEZE_STATUS_FROZEN,
    assert_frozen_content_immutable,
    attach_frozen_journey_artifact,
    build_durable_frozen_journey_artifact,
    read_frozen_journey_artifact_from_private,
)
from backend.services.mirror_network.frozen_step_eza import (
    compute_frozen_eza_snapshots_hash,
    prove_and_normalize_frozen_step_eza_snapshot,
)
import logging

logger = logging.getLogger(__name__)


def _compute_publish_frozen_eza_hash(
    steps: Sequence[Mapping[str, Any]] | None,
) -> str | None:
    """Prove+normalize EZA on each step, then hash (omit unproven)."""
    if not steps:
        return None
    hash_rows: list[dict[str, Any]] = []
    for row in steps:
        assistant_id = str(
            row.get("sourceAssistantMessageId") or row.get("assistantMessageId") or ""
        ).strip() or None
        user_id = str(
            row.get("sourceUserMessageId") or row.get("userMessageId") or ""
        ).strip() or None
        eza_raw = row.get("ezaSnapshot") or row.get("eza_snapshot")
        eza_norm = prove_and_normalize_frozen_step_eza_snapshot(
            eza_raw if isinstance(eza_raw, Mapping) else None,
            source_assistant_message_id=assistant_id,
            source_user_message_id=user_id,
        )
        hash_rows.append(
            {
                "stepIndex": int(
                    row.get("stepIndex")
                    if row.get("stepIndex") is not None
                    else row.get("index")
                    or 0
                ),
                "sourceAssistantMessageId": assistant_id,
                "sourceUserMessageId": user_id,
                "ezaSnapshot": eza_norm,
            }
        )
    return compute_frozen_eza_snapshots_hash(hash_rows)
def map_mirror_safety_level(safety_level: Optional[str]) -> Tuple[str, str]:
    """Map client safety to stored safety_status + visibility."""
    level = (safety_level or "normal").strip().lower()
    if level in ("restricted", "block"):
        return "restricted", "private"
    if level in ("elevated", "review", "caution"):
        return "review", "unlisted"
    return "open", "public"


def _serialize_curiosity_bundle(bundle: Mapping[str, Any]) -> dict[str, Any]:
    """Ensure curiosity bundle is JSON-safe for storage."""
    return dict(bundle)


def resolve_scene_image_url(
    *,
    existing_scene: Optional[str],
    incoming_scene: Optional[str],
) -> Optional[str]:
    """
    Non-null wins: never clear an existing scene image with a null publish.

    - incoming non-null → use incoming
    - incoming null + existing non-null → keep existing
    - both null → null
    """
    existing = ensure_persistable_mirror_scene_url(existing_scene)
    incoming_raw = (incoming_scene or "").strip() or None
    if incoming_raw:
        incoming = ensure_persistable_mirror_scene_url(incoming_raw)
        if incoming:
            return incoming
        return existing
    return existing


def _as_mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        return dict(value)
    return {}


def extract_mirror_lineage(intelligence_private: Mapping[str, Any] | None) -> dict[str, Any]:
    """Read mirrorLineage from intelligencePrivate.intelligenceBrief (or top-level)."""
    root = _as_mapping(intelligence_private)
    brief = _as_mapping(root.get("intelligenceBrief"))
    lineage = _as_mapping(brief.get("mirrorLineage"))
    if lineage:
        return lineage
    # Top-level fallback if client flattened lineage.
    top = _as_mapping(root.get("mirrorLineage"))
    return top


def _parse_generation_accepted_at(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and value.strip():
        text = value.strip()
        try:
            return float(text)
        except ValueError:
            pass
        try:
            # ISO timestamp → epoch ms
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return dt.timestamp() * 1000.0
        except ValueError:
            return None
    return None


def assert_publish_generation_not_stale(
    *,
    existing_private: Mapping[str, Any] | None,
    incoming_lineage: Mapping[str, Any],
) -> None:
    """Reject publish when incoming generation is older than the accepted one.

    Same generationId → allow (scene update / retry).
    Different generationId → allow when replacesGenerationId matches, forceRepublish,
    or incoming generationAcceptedAt is strictly newer than existing.
    """
    existing_lineage = extract_mirror_lineage(existing_private)
    g_old = str(existing_lineage.get("generationId") or "").strip()
    g_new = str(incoming_lineage.get("generationId") or "").strip()
    if not g_old or not g_new or g_old == g_new:
        return

    replaces = str(incoming_lineage.get("replacesGenerationId") or "").strip()
    force = bool(incoming_lineage.get("forceRepublish"))
    if force or (replaces and replaces == g_old):
        return

    old_at = _parse_generation_accepted_at(existing_lineage.get("generationAcceptedAt"))
    new_at = _parse_generation_accepted_at(incoming_lineage.get("generationAcceptedAt"))
    if old_at is not None and new_at is not None and new_at < old_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "stale_publish",
                "message": "Incoming Mirror generation is older than the accepted publish.",
            },
        )
    if old_at is not None and new_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "stale_publish",
                "message": "Publish requires generationAcceptedAt or replacesGenerationId for a new generation.",
            },
        )


def merge_lineage_into_private_payload(
    private_dict: dict[str, Any],
    *,
    incoming_lineage: Mapping[str, Any],
    now: datetime,
) -> dict[str, Any]:
    """Persist generation binding under intelligenceBrief.mirrorLineage."""
    out = dict(private_dict)
    brief = _as_mapping(out.get("intelligenceBrief"))
    lineage = _as_mapping(brief.get("mirrorLineage"))
    lineage.update({k: v for k, v in incoming_lineage.items() if v is not None})
    if lineage.get("generationId") and not lineage.get("generationAcceptedAt"):
        lineage["generationAcceptedAt"] = int(now.timestamp() * 1000)
    brief["mirrorLineage"] = lineage
    out["intelligenceBrief"] = brief
    return out


def _build_claimed_journey_generation_lineage(
    body: MirrorNetworkPublishRequest,
) -> dict[str, Any]:
    """Merge nested lineage + flat publish fields (nested wins when both set)."""
    nested = getattr(body, "journeyGenerationLineage", None)
    claimed: dict[str, Any] = dict(nested) if isinstance(nested, Mapping) else {}
    flat_keys = (
        ("journeyId", getattr(body, "journeyId", None)),
        ("journeyVersion", getattr(body, "journeyVersion", None)),
        ("sourceConversationId", getattr(body, "sourceConversationId", None)),
        ("windowIndex", getattr(body, "windowIndex", None)),
        ("windowStart", getattr(body, "windowStart", None)),
        ("windowEnd", getattr(body, "windowEnd", None)),
        ("windowHash", getattr(body, "windowHash", None)),
        ("scopedInputHash", getattr(body, "scopedInputHash", None)),
        ("selectedStepsHash", getattr(body, "selectedStepsHash", None)),
        ("interpretationHash", getattr(body, "interpretationHash", None)),
        ("anchorsHash", getattr(body, "anchorsHash", None)),
        ("publicLandingHash", getattr(body, "publicLandingHash", None)),
        ("mappedPromptHash", getattr(body, "mappedPromptHash", None)),
        ("generationId", getattr(body, "generationId", None)),
        ("sceneAssetId", getattr(body, "sceneAssetId", None)),
    )
    for key, value in flat_keys:
        if claimed.get(key) is None and value is not None:
            claimed[key] = value
    if not claimed.get("sourceConversationId") and getattr(body, "conversationId", None):
        claimed["sourceConversationId"] = body.conversationId
    return claimed


def _extract_narrative_alignment_binding(
    intelligence_private: Mapping[str, Any] | None,
) -> dict[str, Any] | None:
    lineage = extract_mirror_lineage(intelligence_private)
    raw = lineage.get("narrativeAlignment")
    if not isinstance(raw, Mapping) or not raw:
        return None
    return dict(raw)


def _apply_node_fields(
    node: MirrorNetworkNode,
    *,
    card_title: str,
    card_date: str,
    scene_image_url: Optional[str],
    public_dict: dict[str, Any],
    private_dict: dict[str, Any],
    safety_status: str,
    visibility: str,
    parent_slug: Optional[str],
    now: datetime,
    is_new: bool,
    artifact_kind: Optional[str] = None,
    bump_journey_version: bool = False,
    set_journey_version: Optional[int] = None,
    window_index: Optional[int] = None,
    window_start: Optional[int] = None,
    window_end: Optional[int] = None,
    freeze_status: Optional[str] = None,
    frozen_at: Optional[datetime] = None,
) -> None:
    resolved_scene = resolve_scene_image_url(
        existing_scene=getattr(node, "scene_image_url", None),
        incoming_scene=scene_image_url,
    )
    node.card_title = card_title
    node.card_date = card_date
    node.scene_image_url = resolved_scene
    public_dict = dict(public_dict)
    public_dict["sceneImageUrl"] = resolved_scene
    node.public_payload = public_dict
    node.private_payload = private_dict
    node.safety_status = safety_status
    node.visibility = visibility
    node.parent_slug = parent_slug
    node.published_at = node.published_at or now
    node.updated_at = now
    if artifact_kind is not None:
        node.artifact_kind = artifact_kind
    if bump_journey_version and not is_new:
        current = int(getattr(node, "journey_version", None) or 1)
        node.journey_version = current + 1
    if set_journey_version is not None:
        node.journey_version = int(set_journey_version)
    if is_new:
        node.published_at = now
        if getattr(node, "journey_version", None) is None:
            node.journey_version = 1
    if window_index is not None:
        node.window_index = int(window_index)
    if window_start is not None:
        node.window_start = int(window_start)
    if window_end is not None:
        node.window_end = int(window_end)
    if freeze_status is not None:
        node.freeze_status = freeze_status
    if frozen_at is not None:
        node.frozen_at = frozen_at
        if freeze_status is None:
            node.freeze_status = "frozen"

async def publish_mirror_to_network(
    db: AsyncSession,
    user: User,
    body: MirrorNetworkPublishRequest,
) -> MirrorNetworkPublicPayload:
    """
    Create or update a Mirror Network node for the authenticated user.

    Default (flag off / no journeyId): upsert by conversation_id (legacy).
    Phase 1 journey path (EZA_MIRROR_JOURNEY_V1 + journeyId): upsert by slug/journeyId;
    conversation_id is provenance only — one conversation may own N journeys.
    """
    card_title = body.cardTitle.strip()
    if not card_title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_card_title", "message": "cardTitle is required"},
        )

    safety_status, visibility = map_mirror_safety_level(body.safetyLevel)
    curiosity_bundle = _serialize_curiosity_bundle(body.curiosityBundle or {})
    # Backend authority: strip non-allowlisted Director fields before private_payload write.
    intelligence_private = sanitize_intelligence_private_for_persist(
        body.intelligencePrivate or {}
    )

    conversation_id = (body.conversationId or "").strip() or None
    incoming_scene = (body.sceneImageUrl or "").strip() or None

    raw_steps = None
    if body.selectedSteps is not None:
        raw_steps = [
            step.model_dump() if hasattr(step, "model_dump") else dict(step)
            for step in body.selectedSteps
        ]

    publish_mode, journey_id, normalized_steps, window_tuple = resolve_journey_publish_mode(
        conversation_id=conversation_id,
        journey_id_raw=getattr(body, "journeyId", None),
        selected_steps=raw_steps,
        window_index=getattr(body, "windowIndex", None),
        window_start=getattr(body, "windowStart", None),
        window_end=getattr(body, "windowEnd", None),
    )
    use_journey_identity = publish_mode == "journey"
    window_index = window_tuple[0] if window_tuple else None
    window_start = window_tuple[1] if window_tuple else None
    window_end = window_tuple[2] if window_tuple else None

    # Lineage equality uses the generation-time steps (pre-sanitize).
    lineage_validation_steps = (
        [dict(s) for s in normalized_steps] if normalized_steps is not None else None
    )

    journey_step_original_hashes = None
    journey_publish_version: Optional[int] = None
    journey_selected_steps_hash: Optional[str] = None
    actual_public_landing_hash: Optional[str] = None
    actual_scene_asset_id: Optional[str] = None
    existing = None
    if use_journey_identity:
        assert journey_id is not None
        existing = await get_mirror_network_node_by_slug_for_user(
            db,
            user_id=user.id,
            slug=journey_id,
        )
        if existing is not None and existing.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "journey_forbidden",
                    "message": "journeyId belongs to another user",
                },
            )

        from backend.services.mirror.journey_generation_lineage import (
            validate_narrative_alignment_binding,
            validate_publish_journey_lineage,
        )

        claimed_lineage = _build_claimed_journey_generation_lineage(body)
        existing_version = None
        existing_steps_hash = None
        if existing is not None and getattr(existing, "artifact_kind", None) == ARTIFACT_KIND_JOURNEY_V1:
            existing_version = int(getattr(existing, "journey_version", None) or 1)
            existing_steps_hash = await get_lineage_selected_steps_hash_for_version(
                db,
                journey_slug=journey_id,
                journey_version=existing_version,
            )
            # Prefer lineage hash from prior private payload when steps missing.
            if not existing_steps_hash:
                prior = extract_mirror_lineage(
                    _as_mapping(getattr(existing, "private_payload", None))
                )
                existing_steps_hash = str(prior.get("selectedStepsHash") or "").strip() or None

        if lineage_validation_steps is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_publish_lineage_mismatch",
                    "reason": "steps_hash_mismatch",
                    "message": "selectedSteps required for Journey publish lineage",
                },
            )
        if (
            window_index is None
            or window_start is None
            or window_end is None
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_publish_lineage_mismatch",
                    "reason": "window_mismatch",
                    "message": "Window identity required for Journey publish lineage",
                },
            )

        claimed_version = claimed_lineage.get("journeyVersion")
        try:
            publish_journey_version_claim = int(
                claimed_version
                if claimed_version is not None
                else getattr(body, "journeyVersion", None)
            )
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_publish_lineage_mismatch",
                    "reason": "version_mismatch",
                    "message": "journeyVersion required on generation lineage",
                },
            ) from exc

        lineage_ok = validate_publish_journey_lineage(
            request_conversation_id=conversation_id,
            journey_id=journey_id,
            journey_version=publish_journey_version_claim,
            source_conversation_id=getattr(body, "sourceConversationId", None)
            or claimed_lineage.get("sourceConversationId"),
            window_index=int(window_index),
            window_start=int(window_start),
            window_end=int(window_end),
            selected_steps=lineage_validation_steps,
            claimed=claimed_lineage,
            existing_published_version=existing_version,
            existing_selected_steps_hash=existing_steps_hash,
            flat_overrides={
                "windowHash": getattr(body, "windowHash", None),
                "scopedInputHash": getattr(body, "scopedInputHash", None),
                "selectedStepsHash": getattr(body, "selectedStepsHash", None),
                "interpretationHash": getattr(body, "interpretationHash", None),
                "publicLandingHash": getattr(body, "publicLandingHash", None),
                "mappedPromptHash": getattr(body, "mappedPromptHash", None),
                "generationId": getattr(body, "generationId", None),
                "journeyVersion": getattr(body, "journeyVersion", None),
            },
        )
        journey_publish_version = int(lineage_ok["publishVersion"])
        journey_selected_steps_hash = str(lineage_ok["selectedStepsHash"])

        # Phase 3.6b — prove actual payload against server-owned generation record.
        from backend.services.mirror.journey_generation_lineage import (
            validate_against_server_generation_record,
        )
        from backend.services.mirror.journey_generation_record import (
            get_journey_generation_record,
            seal_public_landing_on_generation,
        )
        from backend.services.mirror.public_landing_hash import (
            compute_public_landing_hash,
            extract_public_landing_from_curiosity,
        )
        from backend.services.mirror.scene_asset_identity import (
            assert_journey_scene_url_acceptable,
        )

        landing_fields = extract_public_landing_from_curiosity(curiosity_bundle)
        actual_public_landing_hash = compute_public_landing_hash(landing_fields)
        try:
            actual_scene_asset_id = assert_journey_scene_url_acceptable(incoming_scene)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_publish_lineage_mismatch",
                    "reason": "scene_asset_mismatch",
                    "message": "Journey V1 requires a valid Mirror scene asset URL",
                },
            ) from None

        generation_id = str(lineage_ok.get("generationId") or "").strip()
        server_record = get_journey_generation_record(generation_id)
        binding = validate_against_server_generation_record(
            claimed={
                **claimed_lineage,
                "interpretationHash": lineage_ok.get("interpretationHash"),
                "mappedPromptHash": lineage_ok.get("mappedPromptHash"),
                "publicLandingHash": lineage_ok.get("publicLandingHash"),
                "generationId": generation_id,
                "sceneAssetId": claimed_lineage.get("sceneAssetId")
                or getattr(body, "sceneAssetId", None),
                "windowHash": lineage_ok.get("windowHash"),
                "scopedInputHash": lineage_ok.get("scopedInputHash"),
                "selectedStepsHash": lineage_ok.get("selectedStepsHash"),
                "journeyId": journey_id,
                "journeyVersion": journey_publish_version,
                "sourceConversationId": getattr(body, "sourceConversationId", None)
                or claimed_lineage.get("sourceConversationId")
                or conversation_id,
            },
            record=server_record,
            actual_public_landing_hash=actual_public_landing_hash,
            actual_scene_asset_id=actual_scene_asset_id,
        )
        # First verified publish seals landing onto the generation record.
        if server_record is not None and not str(
            server_record.get("publicLandingHash") or ""
        ).strip():
            seal_public_landing_on_generation(
                generation_id, public_landing_hash=actual_public_landing_hash
            )

        # Bind Narrative Alignment to the same generation + actual payload.
        na_binding = _extract_narrative_alignment_binding(intelligence_private)
        validate_narrative_alignment_binding(
            claimed_lineage={
                **claimed_lineage,
                "sceneAssetId": binding["sceneAssetId"],
                "publicLandingHash": binding["publicLandingHash"],
                "generationId": binding["generationId"],
                "journeyId": journey_id,
                "journeyVersion": journey_publish_version,
                "windowHash": lineage_ok.get("windowHash"),
            },
            alignment=na_binding,
            actual_scene_asset_id=actual_scene_asset_id,
            actual_public_landing_hash=actual_public_landing_hash,
        )

        from backend.services.mirror.journey_step_sanitization import (
            sanitize_selected_journey_steps,
        )

        sanitized = sanitize_selected_journey_steps(lineage_validation_steps)
        if sanitized.get("status") == "blocked":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_step_privacy_blocked",
                    "message": sanitized.get("blockedReason")
                    or "Selected steps require privacy review before publish.",
                    "flags": sanitized.get("flags") or [],
                },
            )
        normalized_steps = sanitized.get("steps") or lineage_validation_steps
        journey_step_original_hashes = sanitized.get("originalHashes")
    elif conversation_id:
        existing = await get_mirror_network_node_by_conversation(
            db,
            user_id=user.id,
            conversation_id=conversation_id,
        )

    resolved_scene = resolve_scene_image_url(
        existing_scene=existing.scene_image_url if existing else None,
        incoming_scene=incoming_scene,
    )

    if use_journey_identity:
        assert journey_id is not None
        slug = journey_id
        if existing is None and await slug_exists(db, slug):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "journey_slug_taken",
                    "message": "journeyId is already in use",
                },
            )
    else:
        slug = existing.slug if existing else None
        if not slug:
            for _ in range(5):
                candidate = generate_mirror_slug(card_title)
                if not await slug_exists(db, candidate):
                    slug = candidate
                    break
            if not slug:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail={
                        "code": "slug_collision",
                        "message": "Could not allocate share link",
                    },
                )

    requested_parent_slug = resolve_requested_parent_slug(
        parent_slug=body.parentSlug,
        parent_journey_id=getattr(body, "parentJourneyId", None),
    )
    existing_parent_slug = (
        normalize_parent_slug(existing.parent_slug) if existing else None
    )
    proof_token = (body.lineageProofToken or "").strip() or None
    guest_token = (body.guestToken or "").strip() or None

    validated_parent_slug = None
    if not existing_parent_slug and not existing:
        if proof_token:
            # Proof is authoritative for continuation origin.
            origin_parent = await resolve_parent_slug_from_proof(
                db,
                proof_token=proof_token,
                user_id=user.id,
                guest_token=guest_token,
                conversation_id=conversation_id,
                child_slug=slug,
                consume=True,
            )
            if origin_parent:
                if (
                    use_journey_identity
                    and conversation_id
                    and window_index is not None
                ):
                    validated_parent_slug = await resolve_verified_continuation_parent(
                        db,
                        origin_parent_slug=origin_parent,
                        requested_parent_slug=requested_parent_slug,
                        user_id=user.id,
                        conversation_id=conversation_id,
                        child_slug=slug,
                        child_window_index=int(window_index),
                        child_window_start=int(window_start)
                        if window_start is not None
                        else 0,
                    )
                else:
                    # Legacy Discover: proof parent wins; ignore client parentSlug.
                    validated_parent_slug = origin_parent
        elif requested_parent_slug:
            # Mode A: same-conversation deterministic continuation (journey + window).
            # Mode B: everything else still requires lineageProofToken.
            if (
                use_journey_identity
                and conversation_id
                and window_index is not None
                and window_start is not None
            ):
                parent_probe = await get_mirror_network_node_by_slug(
                    db, requested_parent_slug
                )
                same_owner_same_conv = (
                    parent_probe is not None
                    and getattr(parent_probe, "user_id", None) == user.id
                    and (getattr(parent_probe, "conversation_id", None) or "").strip()
                    == conversation_id
                )
                if same_owner_same_conv:
                    validated_parent_slug = await resolve_same_conversation_parent(
                        db,
                        user_id=user.id,
                        conversation_id=conversation_id,
                        requested_parent_slug=requested_parent_slug,
                        child_slug=slug,
                        child_window_index=int(window_index),
                        child_window_start=int(window_start),
                    )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "code": "lineage_proof_required",
                            "message": (
                                "parentSlug requires a server-verified lineageProofToken"
                            ),
                        },
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "lineage_proof_required",
                        "message": "parentSlug requires a server-verified lineageProofToken",
                    },
                )

    parent_slug = resolve_stored_parent_slug(
        existing_parent_slug=existing.parent_slug if existing else None,
        validated_parent_slug=validated_parent_slug,
    )

    try:
        public_payload, private_payload = split_curiosity_payloads(
            slug=slug,
            card_title=card_title,
            card_date=body.cardDate.strip(),
            scene_image_url=resolved_scene,
            user_id=str(user.id),
            conversation_id=conversation_id,
            curiosity_bundle=curiosity_bundle,
            intelligence_private=intelligence_private,
            parent_slug=parent_slug,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "public_payload_audit_failed",
                "message": str(exc),
            },
        ) from exc

    now = datetime.now(timezone.utc)
    public_dict = public_payload.model_dump()
    private_dict = private_payload.model_dump()
    incoming_lineage = extract_mirror_lineage(intelligence_private)
    if use_journey_identity:
        incoming_lineage = {
            **incoming_lineage,
            "journeyId": slug,
            "artifactKind": ARTIFACT_KIND_JOURNEY_V1,
            "journeyVersion": journey_publish_version,
            "selectedStepsHash": journey_selected_steps_hash,
            "windowHash": getattr(body, "windowHash", None)
            or (_build_claimed_journey_generation_lineage(body).get("windowHash")),
            "scopedInputHash": getattr(body, "scopedInputHash", None),
            "interpretationHash": getattr(body, "interpretationHash", None),
            "publicLandingHash": actual_public_landing_hash
            or getattr(body, "publicLandingHash", None),
            "mappedPromptHash": getattr(body, "mappedPromptHash", None),
            "generationId": getattr(body, "generationId", None)
            or incoming_lineage.get("generationId"),
            "sceneAssetId": actual_scene_asset_id
            or getattr(body, "sceneAssetId", None)
            or incoming_lineage.get("sceneAssetId"),
            "sourceBlockHash": getattr(body, "sourceBlockHash", None)
            or incoming_lineage.get("sourceBlockHash"),
            "anchorsHash": getattr(body, "anchorsHash", None)
            or incoming_lineage.get("anchorsHash"),
        }

    if existing:
        assert_publish_generation_not_stale(
            existing_private=_as_mapping(getattr(existing, "private_payload", None)),
            incoming_lineage=incoming_lineage,
        )

    private_dict = merge_lineage_into_private_payload(
        private_dict,
        incoming_lineage=incoming_lineage,
        now=now,
    )

    artifact_kind = (
        ARTIFACT_KIND_JOURNEY_V1
        if use_journey_identity
        else ARTIFACT_KIND_LEGACY_LANDING
    )

    freeze_status_for_write: Optional[str] = None
    frozen_at_for_write: Optional[datetime] = None
    atomic_journey_freeze = bool(
        use_journey_identity and normalized_steps is not None
    )

    if atomic_journey_freeze:
        assert journey_publish_version is not None
        assert journey_selected_steps_hash is not None
        assert actual_public_landing_hash is not None
        assert actual_scene_asset_id is not None

        from backend.services.mirror.public_landing_hash import (
            extract_public_landing_from_curiosity,
        )

        landing_fields = extract_public_landing_from_curiosity(curiosity_bundle)
        journey_frozen_eza_hash = _compute_publish_frozen_eza_hash(normalized_steps)
        existing_frozen = None
        if existing is not None:
            existing_frozen = read_frozen_journey_artifact_from_private(
                _as_mapping(getattr(existing, "private_payload", None)),
                journey_version=int(journey_publish_version),
            )
            if existing_frozen is not None:
                assert_frozen_content_immutable(
                    existing_frozen=existing_frozen,
                    selected_steps_hash=journey_selected_steps_hash,
                    public_landing_hash=actual_public_landing_hash,
                    scene_asset_id=actual_scene_asset_id,
                    generation_id=str(
                        incoming_lineage.get("generationId")
                        or getattr(body, "generationId", None)
                        or ""
                    ).strip()
                    or None,
                    frozen_eza_snapshots_hash=journey_frozen_eza_hash,
                )

        if existing_frozen is not None:
            # Same-version identical retry: reuse seal (idempotent).
            durable_freeze = dict(existing_frozen)
            freeze_status_for_write = FREEZE_STATUS_FROZEN
            frozen_at_for_write = getattr(existing, "frozen_at", None) or now
            private_dict = attach_frozen_journey_artifact(
                private_dict, durable_freeze, archive_previous=False
            )
        else:
            durable_freeze = build_durable_frozen_journey_artifact(
                journey_id=str(slug),
                journey_version=int(journey_publish_version),
                source_conversation_id=conversation_id,
                author_user_id=str(user.id),
                parent_slug=parent_slug,
                block_index=int(window_index) if window_index is not None else None,
                block_start=int(window_start) if window_start is not None else None,
                block_end=int(window_end) if window_end is not None else None,
                source_block_hash=str(
                    incoming_lineage.get("sourceBlockHash")
                    or getattr(body, "sourceBlockHash", None)
                    or ""
                ).strip()
                or None,
                selected_steps=list(normalized_steps),
                public_title=str(
                    landing_fields.get("publicTitle") or card_title or ""
                ).strip()
                or card_title,
                public_summary=str(landing_fields.get("publicSummary") or "").strip(),
                continuation_context=str(
                    landing_fields.get("continuationContext") or ""
                ).strip()
                or None,
                public_landing_hash=str(actual_public_landing_hash),
                public_landing_contract_version=str(
                    landing_fields.get("contractVersion") or "mirror-public-landing-v1"
                ),
                scene_asset_id=str(actual_scene_asset_id),
                scene_image_url=resolved_scene or incoming_scene,
                generation_id=str(
                    incoming_lineage.get("generationId")
                    or getattr(body, "generationId", None)
                    or ""
                ).strip(),
                selected_steps_hash=str(journey_selected_steps_hash),
                scoped_input_hash=str(
                    incoming_lineage.get("scopedInputHash")
                    or getattr(body, "scopedInputHash", None)
                    or ""
                ).strip()
                or None,
                window_hash=str(
                    incoming_lineage.get("windowHash")
                    or getattr(body, "windowHash", None)
                    or ""
                ).strip()
                or None,
                interpretation_hash=str(
                    incoming_lineage.get("interpretationHash")
                    or getattr(body, "interpretationHash", None)
                    or ""
                ).strip()
                or None,
                anchors_hash=str(
                    incoming_lineage.get("anchorsHash")
                    or getattr(body, "anchorsHash", None)
                    or ""
                ).strip()
                or None,
                mapped_prompt_hash=str(
                    incoming_lineage.get("mappedPromptHash")
                    or getattr(body, "mappedPromptHash", None)
                    or ""
                ).strip()
                or None,
                narrative_alignment=_extract_narrative_alignment_binding(
                    intelligence_private
                ),
                sanitization_status="sanitized",
                sanitization_flags=[],
                original_step_hashes=journey_step_original_hashes,
                public_step_hashes=None,
                frozen_at=now,
                frozen_eza_snapshots_hash=journey_frozen_eza_hash,
            )
            freeze_status_for_write = FREEZE_STATUS_FROZEN
            frozen_at_for_write = now
            private_dict = attach_frozen_journey_artifact(private_dict, durable_freeze)
            logger.info(
                "mirror_journey_freeze_ready journey_id=%s journey_version=%s "
                "generation_id=%s slug=%s freeze_status=%s selected_count=%s "
                "selected_steps_hash=%s public_landing_hash=%s scene_asset_id=%s",
                durable_freeze.get("journeyId"),
                durable_freeze.get("journeyVersion"),
                durable_freeze.get("generationId"),
                durable_freeze.get("slug"),
                durable_freeze.get("freezeStatus"),
                durable_freeze.get("selectedCount"),
                durable_freeze.get("selectedStepsHash"),
                durable_freeze.get("publicLandingHash"),
                durable_freeze.get("sceneAssetId"),
            )

    try:
        if existing:
            _apply_node_fields(
                existing,
                card_title=card_title,
                card_date=body.cardDate.strip(),
                scene_image_url=incoming_scene,
                public_dict=public_dict,
                private_dict=private_dict,
                safety_status=safety_status,
                visibility=visibility,
                parent_slug=parent_slug,
                now=now,
                is_new=False,
                artifact_kind=artifact_kind if use_journey_identity else None,
                bump_journey_version=False,
                set_journey_version=journey_publish_version if use_journey_identity else None,
                window_index=window_index if use_journey_identity else None,
                window_start=window_start if use_journey_identity else None,
                window_end=window_end if use_journey_identity else None,
                freeze_status=freeze_status_for_write,
                frozen_at=frozen_at_for_write,
            )
            # Keep provenance conversation_id if newly provided.
            if conversation_id and not existing.conversation_id:
                existing.conversation_id = conversation_id
            node = await update_mirror_network_node(
                db, existing, commit=not atomic_journey_freeze
            )
        else:
            node = MirrorNetworkNode(
                id=uuid4(),
                slug=slug,
                user_id=user.id,
                conversation_id=conversation_id,
                visibility=visibility,
                safety_status=safety_status,
                card_title=card_title,
                card_date=body.cardDate.strip(),
                scene_image_url=resolved_scene,
                public_payload=public_dict,
                private_payload=private_dict,
                parent_slug=parent_slug,
                artifact_kind=artifact_kind,
                journey_version=journey_publish_version if use_journey_identity else 1,
                window_index=window_index if use_journey_identity else None,
                window_start=window_start if use_journey_identity else None,
                window_end=window_end if use_journey_identity else None,
                freeze_status=freeze_status_for_write or "non_frozen",
                frozen_at=frozen_at_for_write,
                published_at=now,
            )
            try:
                node = await create_mirror_network_node(
                    db, node, commit=not atomic_journey_freeze
                )
            except IntegrityError:
                await db.rollback()
                if use_journey_identity:
                    raced = await get_mirror_network_node_by_slug_for_user(
                        db,
                        user_id=user.id,
                        slug=slug,
                    )
                    if raced is None:
                        raise
                    assert_publish_generation_not_stale(
                        existing_private=_as_mapping(
                            getattr(raced, "private_payload", None)
                        ),
                        incoming_lineage=incoming_lineage,
                    )
                    private_dict = merge_lineage_into_private_payload(
                        private_dict,
                        incoming_lineage=incoming_lineage,
                        now=now,
                    )
                    if atomic_journey_freeze:
                        raced_frozen = read_frozen_journey_artifact_from_private(
                            _as_mapping(getattr(raced, "private_payload", None)),
                            journey_version=int(journey_publish_version or 1),
                        )
                        if raced_frozen is not None:
                            assert_frozen_content_immutable(
                                existing_frozen=raced_frozen,
                                selected_steps_hash=journey_selected_steps_hash,
                                public_landing_hash=actual_public_landing_hash,
                                scene_asset_id=actual_scene_asset_id,
                                generation_id=str(
                                    incoming_lineage.get("generationId") or ""
                                ).strip()
                                or None,
                                frozen_eza_snapshots_hash=_compute_publish_frozen_eza_hash(
                                    normalized_steps
                                ),
                            )
                            private_dict = attach_frozen_journey_artifact(
                                private_dict, raced_frozen, archive_previous=False
                            )
                            freeze_status_for_write = FREEZE_STATUS_FROZEN
                            frozen_at_for_write = (
                                getattr(raced, "frozen_at", None) or now
                            )
                    _apply_node_fields(
                        raced,
                        card_title=card_title,
                        card_date=body.cardDate.strip(),
                        scene_image_url=incoming_scene,
                        public_dict=public_dict,
                        private_dict=private_dict,
                        safety_status=safety_status,
                        visibility=visibility,
                        parent_slug=parent_slug,
                        now=now,
                        is_new=False,
                        artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
                        bump_journey_version=False,
                        set_journey_version=journey_publish_version,
                        window_index=window_index,
                        window_start=window_start,
                        window_end=window_end,
                        freeze_status=freeze_status_for_write,
                        frozen_at=frozen_at_for_write,
                    )
                    node = await update_mirror_network_node(
                        db, raced, commit=not atomic_journey_freeze
                    )
                else:
                    if not conversation_id:
                        raise
                    raced = await get_mirror_network_node_by_conversation(
                        db,
                        user_id=user.id,
                        conversation_id=conversation_id,
                    )
                    if raced is None:
                        raise
                    assert_publish_generation_not_stale(
                        existing_private=_as_mapping(
                            getattr(raced, "private_payload", None)
                        ),
                        incoming_lineage=incoming_lineage,
                    )
                    private_dict = merge_lineage_into_private_payload(
                        private_dict,
                        incoming_lineage=incoming_lineage,
                        now=now,
                    )
                    _apply_node_fields(
                        raced,
                        card_title=card_title,
                        card_date=body.cardDate.strip(),
                        scene_image_url=incoming_scene,
                        public_dict=public_dict,
                        private_dict=private_dict,
                        safety_status=safety_status,
                        visibility=visibility,
                        parent_slug=parent_slug,
                        now=now,
                        is_new=False,
                    )
                    node = await update_mirror_network_node(db, raced)

        if atomic_journey_freeze and node is not None:
            await replace_journey_steps_for_version(
                db,
                journey_slug=str(getattr(node, "slug", "") or slug),
                journey_version=int(
                    journey_publish_version
                    or getattr(node, "journey_version", None)
                    or 1
                ),
                steps=list(normalized_steps),
                original_hashes=journey_step_original_hashes,
                selected_steps_hash=journey_selected_steps_hash,
                frozen_eza_snapshots_hash=journey_frozen_eza_hash,
                commit=False,
            )
            try:
                await db.commit()
                await db.refresh(node)
            except Exception:
                await db.rollback()
                logger.exception(
                    "mirror_journey_freeze_commit_failed journey_id=%s slug=%s",
                    getattr(node, "id", None),
                    getattr(node, "slug", None),
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "code": "journey_freeze_persist_failed",
                        "message": (
                            "Published Journey freeze could not be persisted atomically"
                        ),
                    },
                ) from None
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        raise

    record = MirrorNetworkNodeRecord.from_orm(node)
    return node_to_public_payload(record)
