# -*- coding: utf-8 -*-
"""Stage 4C — publish Mirror to network on creation (share URL guarantee)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping, Optional, Tuple
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
    replace_journey_steps_for_version,
)
from backend.services.mirror_network.journey_window_contract import (
    resolve_requested_parent_slug,
)
from backend.services.mirror_network.same_conversation_parent import (
    resolve_same_conversation_parent,
)

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
    window_index: Optional[int] = None,
    window_start: Optional[int] = None,
    window_end: Optional[int] = None,
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
            # Proof is authoritative — client parentSlug is ignored when present.
            validated_parent_slug = await resolve_parent_slug_from_proof(
                db,
                proof_token=proof_token,
                user_id=user.id,
                guest_token=guest_token,
                conversation_id=conversation_id,
                child_slug=slug,
                consume=True,
            )
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
    bump_version = bool(
        use_journey_identity
        and existing is not None
        and getattr(existing, "artifact_kind", None) == ARTIFACT_KIND_JOURNEY_V1
    )

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
            bump_journey_version=bump_version,
            window_index=window_index if use_journey_identity else None,
            window_start=window_start if use_journey_identity else None,
            window_end=window_end if use_journey_identity else None,
        )
        # Keep provenance conversation_id if newly provided.
        if conversation_id and not existing.conversation_id:
            existing.conversation_id = conversation_id
        node = await update_mirror_network_node(db, existing)
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
            journey_version=1,
            window_index=window_index if use_journey_identity else None,
            window_start=window_start if use_journey_identity else None,
            window_end=window_end if use_journey_identity else None,
            published_at=now,
        )
        try:
            node = await create_mirror_network_node(db, node)
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
                    existing_private=_as_mapping(getattr(raced, "private_payload", None)),
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
                    artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
                    bump_journey_version=True,
                    window_index=window_index,
                    window_start=window_start,
                    window_end=window_end,
                )
                node = await update_mirror_network_node(db, raced)
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
                    existing_private=_as_mapping(getattr(raced, "private_payload", None)),
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

    record = MirrorNetworkNodeRecord.from_orm(node)
    if use_journey_identity and normalized_steps is not None:
        await replace_journey_steps_for_version(
            db,
            journey_slug=record.slug,
            journey_version=int(getattr(node, "journey_version", None) or 1),
            steps=normalized_steps,
        )
    return node_to_public_payload(record)
