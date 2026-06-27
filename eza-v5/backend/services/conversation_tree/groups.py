# -*- coding: utf-8 -*-
"""Conversation groups persistence helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.schemas.conversation_tree import ConversationGroupCreate, ConversationGroupResponse
from backend.models.conversation_groups import ConversationGroup
from backend.services.mirror_network.sohbet_session import guest_token_fingerprint


def group_to_response(row: ConversationGroup) -> ConversationGroupResponse:
    return ConversationGroupResponse(
        id=str(row.id),
        userId=str(row.user_id) if row.user_id else None,
        guestToken=row.guest_token,
        title=row.title,
        source=row.source,  # type: ignore[arg-type]
        parentGroupId=str(row.parent_group_id) if row.parent_group_id else None,
        sortOrder=row.sort_order or 0,
        createdAt=row.created_at.isoformat() if row.created_at else datetime.now(timezone.utc).isoformat(),
        updatedAt=(row.updated_at or row.created_at).isoformat()
        if (row.updated_at or row.created_at)
        else datetime.now(timezone.utc).isoformat(),
    )


async def persist_conversation_group(
    db: AsyncSession,
    body: ConversationGroupCreate,
) -> ConversationGroup:
    title = body.title.strip()
    guest_token: Optional[str] = None
    if body.guestToken:
        guest_token = guest_token_fingerprint(body.guestToken.strip())

    parent_uuid: Optional[UUID] = None
    if body.parentGroupId:
        parent_uuid = UUID(body.parentGroupId)

    row = ConversationGroup(
        title=title,
        source=body.source,
        guest_token=guest_token,
        parent_group_id=parent_uuid,
        sort_order=int(datetime.now(timezone.utc).timestamp()),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def fetch_conversation_groups(
    db: AsyncSession,
    *,
    guest_token: Optional[str] = None,
    limit: int = 50,
) -> List[ConversationGroup]:
    query = select(ConversationGroup).order_by(ConversationGroup.sort_order.desc())
    if guest_token:
        fp = guest_token_fingerprint(guest_token.strip())
        query = query.where(ConversationGroup.guest_token == fp)
    result = await db.execute(query.limit(limit))
    return list(result.scalars().all())
