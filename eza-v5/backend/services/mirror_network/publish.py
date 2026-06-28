# -*- coding: utf-8 -*-
"""Stage 4C — publish Mirror to network on creation (share URL guarantee)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping, Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.schemas.mirror_network import (
    MirrorNetworkPublicPayload,
    MirrorNetworkPublishRequest,
)
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.production import User
from backend.services.mirror_network.public_payload import split_curiosity_payloads
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


async def publish_mirror_to_network(
    db: AsyncSession,
    user: User,
    body: MirrorNetworkPublishRequest,
) -> MirrorNetworkPublicPayload:
    """
    Create or update a Mirror Network node for the authenticated user.

    Mirror creation and network registration are one product action — no separate publish step.
    """
    card_title = body.cardTitle.strip()
    if not card_title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_card_title", "message": "cardTitle is required"},
        )

    safety_status, visibility = map_mirror_safety_level(body.safetyLevel)
    curiosity_bundle = _serialize_curiosity_bundle(body.curiosityBundle or {})
    intelligence_private = dict(body.intelligencePrivate or {})

    existing = None
    conversation_id = (body.conversationId or "").strip() or None
    if conversation_id:
        existing = await get_mirror_network_node_by_conversation(
            db,
            user_id=user.id,
            conversation_id=conversation_id,
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

    try:
        public_payload, private_payload = split_curiosity_payloads(
            slug=slug,
            card_title=card_title,
            card_date=body.cardDate.strip(),
            scene_image_url=(body.sceneImageUrl or "").strip() or None,
            user_id=str(user.id),
            conversation_id=conversation_id,
            curiosity_bundle=curiosity_bundle,
            intelligence_private=intelligence_private,
            parent_slug=(body.parentSlug or "").strip() or None,
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
        existing.card_title = card_title
        existing.card_date = body.cardDate.strip()
        existing.scene_image_url = (body.sceneImageUrl or "").strip() or None
        existing.public_payload = public_dict
        existing.private_payload = private_dict
        existing.safety_status = safety_status
        existing.visibility = visibility
        existing.published_at = existing.published_at or now
        existing.updated_at = now
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
            scene_image_url=(body.sceneImageUrl or "").strip() or None,
            public_payload=public_dict,
            private_payload=private_dict,
            parent_slug=(body.parentSlug or "").strip() or None,
            published_at=now,
        )
        node = await create_mirror_network_node(db, node)

    record = MirrorNetworkNodeRecord.from_orm(node)
    return node_to_public_payload(record)
