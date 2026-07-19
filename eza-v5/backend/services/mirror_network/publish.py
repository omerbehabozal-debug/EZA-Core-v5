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
from backend.models.mirror_network import MirrorNetworkNode
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
    slug_exists,
    update_mirror_network_node,
)
from backend.services.mirror_network.service import node_to_public_payload
from backend.services.mirror_network.slug import generate_mirror_slug
from backend.services.mirror_network.types import MirrorNetworkNodeRecord


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
    if is_new:
        node.published_at = now


async def publish_mirror_to_network(
    db: AsyncSession,
    user: User,
    body: MirrorNetworkPublishRequest,
) -> MirrorNetworkPublicPayload:
    """
    Create or update a Mirror Network node for the authenticated user.

    Mirror creation and network registration are one product action — no separate publish step.
    Concurrent publishes for the same conversation resolve to a single node (unique constraint).
    Scene image updates use non-null-wins semantics.
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

    existing = None
    if conversation_id:
        existing = await get_mirror_network_node_by_conversation(
            db,
            user_id=user.id,
            conversation_id=conversation_id,
        )

    resolved_scene = resolve_scene_image_url(
        existing_scene=existing.scene_image_url if existing else None,
        incoming_scene=incoming_scene,
    )

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

    requested_parent_slug = normalize_parent_slug(body.parentSlug)
    existing_parent_slug = (
        normalize_parent_slug(existing.parent_slug) if existing else None
    )
    proof_token = (body.lineageProofToken or "").strip() or None
    guest_token = (body.guestToken or "").strip() or None

    if requested_parent_slug and not proof_token and not existing_parent_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "lineage_proof_required",
                "message": "parentSlug requires a server-verified lineageProofToken",
            },
        )

    validated_parent_slug = None
    if not existing_parent_slug and not existing:
        if proof_token:
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
            validated_parent_slug = await validate_parent_slug(
                db,
                parent_slug=requested_parent_slug,
                child_slug=slug,
            )

    parent_slug = resolve_stored_parent_slug(
        existing_parent_slug=existing.parent_slug if existing else None,
        validated_parent_slug=validated_parent_slug,
    )

    is_new_node = existing is None

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
        )
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
            published_at=now,
        )
        try:
            node = await create_mirror_network_node(db, node)
        except IntegrityError:
            await db.rollback()
            if not conversation_id:
                raise
            raced = await get_mirror_network_node_by_conversation(
                db,
                user_id=user.id,
                conversation_id=conversation_id,
            )
            if raced is None:
                raise
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
    return node_to_public_payload(record)
