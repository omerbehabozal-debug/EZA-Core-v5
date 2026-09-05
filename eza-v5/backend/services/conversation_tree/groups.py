# -*- coding: utf-8 -*-
"""Conversation groups persistence — Stage 3 + Phase 8.8G-5.3.1 authority."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.schemas.conversation_tree import (
    ConversationGroupCreate,
    ConversationGroupPatch,
    ConversationGroupResponse,
)
from backend.models.conversation_groups import ConversationGroup
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.mirror_network.sohbet_session import guest_token_fingerprint

MAX_CLIENT_GROUP_ID_LENGTH = 64


class ConversationGroupNotFoundError(Exception):
    """Owned group not found — map to privacy-safe 404."""


def group_to_response(row: ConversationGroup) -> ConversationGroupResponse:
    return ConversationGroupResponse(
        id=str(row.id),
        title=row.title,
        source=row.source,  # type: ignore[arg-type]
        parentGroupId=str(row.parent_group_id) if row.parent_group_id else None,
        sortOrder=row.sort_order or 0,
        createdAt=row.created_at.isoformat()
        if row.created_at
        else datetime.now(timezone.utc).isoformat(),
        updatedAt=(row.updated_at or row.created_at).isoformat()
        if (row.updated_at or row.created_at)
        else datetime.now(timezone.utc).isoformat(),
        clientGroupId=row.client_group_id,
    )


def _normalize_client_group_id(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None
    if len(text) > MAX_CLIENT_GROUP_ID_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="client_group_id_too_long",
        )
    return text


async def _resolve_owned_parent_or_none(
    db: AsyncSession,
    *,
    user_id: Optional[UUID],
    parent_raw: Optional[str],
) -> Optional[UUID]:
    """Nesting unused by product — only accept owned parent; else null."""
    if not parent_raw or not parent_raw.strip() or user_id is None:
        return None
    try:
        parent_uuid = UUID(parent_raw.strip())
    except ValueError:
        return None
    result = await db.execute(
        select(ConversationGroup.id).where(
            ConversationGroup.id == parent_uuid,
            ConversationGroup.user_id == user_id,
        )
    )
    owned = result.scalar_one_or_none()
    if owned is None:
        return None
    # Self-parent impossible at create (new id). Still guard.
    return parent_uuid


async def get_owned_conversation_group(
    db: AsyncSession,
    *,
    user_id: UUID,
    group_id: UUID,
) -> ConversationGroup:
    result = await db.execute(
        select(ConversationGroup).where(
            ConversationGroup.id == group_id,
            ConversationGroup.user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise ConversationGroupNotFoundError()
    return row


async def find_owned_group_by_client_id(
    db: AsyncSession,
    *,
    user_id: UUID,
    client_group_id: str,
) -> Optional[ConversationGroup]:
    result = await db.execute(
        select(ConversationGroup).where(
            ConversationGroup.user_id == user_id,
            ConversationGroup.client_group_id == client_group_id,
        )
    )
    return result.scalar_one_or_none()


async def persist_conversation_group(
    db: AsyncSession,
    body: ConversationGroupCreate,
    *,
    user_id: Optional[UUID] = None,
) -> ConversationGroup:
    """
    Create or idempotently upsert a conversation group.

    Authenticated: binds user_id from caller (never from body).
    Guest: requires guestToken fingerprint; user_id stays None.
    """
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title_required")

    client_group_id = _normalize_client_group_id(body.clientGroupId)

    if user_id is not None:
        # Authenticated path — ignore body.guestToken for ownership.
        if client_group_id:
            existing = await find_owned_group_by_client_id(
                db, user_id=user_id, client_group_id=client_group_id
            )
            if existing is not None:
                return existing

        parent_uuid = await _resolve_owned_parent_or_none(
            db, user_id=user_id, parent_raw=body.parentGroupId
        )
        row = ConversationGroup(
            user_id=user_id,
            guest_token=None,
            client_group_id=client_group_id,
            title=title,
            source=body.source,
            parent_group_id=parent_uuid,
            sort_order=int(datetime.now(timezone.utc).timestamp()),
        )
        db.add(row)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            if client_group_id:
                raced = await find_owned_group_by_client_id(
                    db, user_id=user_id, client_group_id=client_group_id
                )
                if raced is not None:
                    return raced
            raise
        await db.refresh(row)
        return row

    # Guest path
    if not body.guestToken or not body.guestToken.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication_required",
        )
    guest_token = guest_token_fingerprint(body.guestToken.strip())
    # Guests do not use client_group_id / parent ownership mapping.
    row = ConversationGroup(
        user_id=None,
        guest_token=guest_token,
        client_group_id=None,
        title=title,
        source=body.source,
        parent_group_id=None,
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
    if user_id is None and not guest_token:
        return []

    query = select(ConversationGroup).order_by(ConversationGroup.sort_order.desc())
    if user_id is not None:
        query = query.where(ConversationGroup.user_id == user_id)
    elif guest_token:
        fp = guest_token_fingerprint(guest_token.strip())
        query = query.where(ConversationGroup.guest_token == fp)
    result = await db.execute(query.limit(limit))
    return list(result.scalars().all())


async def patch_conversation_group(
    db: AsyncSession,
    *,
    user_id: UUID,
    group_id: UUID,
    body: ConversationGroupPatch,
) -> ConversationGroup:
    row = await get_owned_conversation_group(db, user_id=user_id, group_id=group_id)
    if body.title is not None:
        title = body.title.strip()
        if not title:
            raise HTTPException(status_code=422, detail="title_required")
        row.title = title
    if body.sortOrder is not None:
        row.sort_order = int(body.sortOrder)
    row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return row


async def delete_conversation_group(
    db: AsyncSession,
    *,
    user_id: UUID,
    group_id: UUID,
) -> None:
    """
    Delete owned group. Conversations survive with group_id=NULL.
    Non-owned → ConversationGroupNotFoundError (404).
    """
    row = await get_owned_conversation_group(db, user_id=user_id, group_id=group_id)

    await db.execute(
        update(StandaloneConversation)
        .where(
            StandaloneConversation.user_id == user_id,
            StandaloneConversation.group_id == group_id,
        )
        .values(group_id=None)
    )
    await db.delete(row)
    await db.commit()


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
        # Phase 8.3 — clear guest fingerprint after claim so the same token
        # cannot be re-claimed into another account (idempotent for this user).
        row.guest_token = None
        claimed.append(row)
        user_by_title[key] = row

    await db.commit()
    for row in claimed:
        await db.refresh(row)

    return claimed, merged
