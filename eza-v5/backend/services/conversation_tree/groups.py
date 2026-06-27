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
    user_id: Optional[UUID] = None,
    limit: int = 50,
) -> List[ConversationGroup]:
    query = select(ConversationGroup).order_by(ConversationGroup.sort_order.desc())
    if guest_token:
        fp = guest_token_fingerprint(guest_token.strip())
        query = query.where(ConversationGroup.guest_token == fp)
    if user_id is not None:
        query = query.where(ConversationGroup.user_id == user_id)
    result = await db.execute(query.limit(limit))
    return list(result.scalars().all())


def _normalize_title(title: str) -> str:
    return title.strip().casefold()


async def claim_guest_conversation_groups(
    db: AsyncSession,
    *,
    user_id: UUID,
    guest_token: str,
) -> tuple[List[ConversationGroup], int]:
    """Assign guest groups to user; dedupe by normalized title."""
    fp = guest_token_fingerprint(guest_token.strip())

    guest_result = await db.execute(
        select(ConversationGroup).where(
            ConversationGroup.guest_token == fp,
            ConversationGroup.user_id.is_(None),
        )
    )
    guest_rows = list(guest_result.scalars().all())
    if not guest_rows:
        return [], 0

    user_result = await db.execute(
        select(ConversationGroup).where(ConversationGroup.user_id == user_id)
    )
    user_rows = list(user_result.scalars().all())
    user_by_title = {_normalize_title(row.title): row for row in user_rows}

    claimed: List[ConversationGroup] = []
    merged = 0

    for row in guest_rows:
        key = _normalize_title(row.title)
        if key in user_by_title:
            await db.delete(row)
            merged += 1
            continue
        row.user_id = user_id
        claimed.append(row)
        user_by_title[key] = row

    await db.commit()
    for row in claimed:
        await db.refresh(row)

    return claimed, merged
