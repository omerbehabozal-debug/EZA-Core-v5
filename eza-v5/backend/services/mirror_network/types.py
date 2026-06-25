# -*- coding: utf-8 -*-
"""Mirror Network domain records (ORM-agnostic for tests and services)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID


@dataclass
class MirrorNetworkNodeRecord:
    id: UUID
    slug: str
    user_id: UUID
    conversation_id: Optional[str]
    visibility: str
    safety_status: str
    card_title: str
    card_date: str
    scene_image_url: Optional[str]
    public_payload: Dict[str, Any]
    private_payload: Dict[str, Any]
    parent_slug: Optional[str] = None
    created_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    @classmethod
    def from_orm(cls, node: Any) -> "MirrorNetworkNodeRecord":
        return cls(
            id=node.id,
            slug=node.slug,
            user_id=node.user_id,
            conversation_id=node.conversation_id,
            visibility=node.visibility,
            safety_status=node.safety_status,
            card_title=node.card_title,
            card_date=node.card_date,
            scene_image_url=node.scene_image_url,
            public_payload=dict(node.public_payload or {}),
            private_payload=dict(node.private_payload or {}),
            parent_slug=node.parent_slug,
            created_at=getattr(node, "created_at", None),
            published_at=getattr(node, "published_at", None),
        )
