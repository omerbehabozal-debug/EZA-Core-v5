# -*- coding: utf-8 -*-
"""Standalone conversation persistence — Phase 8.8G-1."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.schemas.standalone_conversations import (
    StandaloneConversationCreate,
    StandaloneConversationDetail,
    StandaloneConversationListItem,
    StandaloneConversationMessageCreate,
    StandaloneConversationMessageDTO,
    StandaloneConversationPatch,
)
from backend.models.standalone_conversations import (
    CONVERSATION_TYPES,
    MESSAGE_ROLES,
    StandaloneConversation,
    StandaloneConversationMessage,
)
from backend.services.standalone.metadata_security import reject_forbidden_metadata
from backend.services.standalone.persistence_limits import validate_bounded_json


class StandaloneConversationNotFoundError(Exception):
    """Raised when a conversation is absent or not owned by the caller."""


DEFAULT_UNINITIALIZED_TITLE = "Yeni sohbet"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat()


def _conversation_to_list_item(row: StandaloneConversation) -> StandaloneConversationListItem:
    return StandaloneConversationListItem(
        id=str(row.id),
        clientConversationId=row.client_conversation_id,
        title=row.title,
        preview=row.preview,
        conversationType=row.conversation_type,  # type: ignore[arg-type]
        sourceYansiSlug=row.source_yansi_slug,
        messageCount=row.message_count or 0,
        createdAt=_iso(row.created_at) or _utcnow().isoformat(),
        updatedAt=_iso(row.updated_at),
        lastMessageAt=_iso(row.last_message_at),
        archived=row.archived_at is not None,
        pinned=bool(row.pinned),
        titlePinned=bool(row.title_pinned),
        groupId=str(row.group_id) if row.group_id else None,
        conversationSceneUrl=row.conversation_scene_url,
        conversationSceneSource=row.conversation_scene_source,
        conversationSceneSlug=row.conversation_scene_slug,
    )


def _message_to_dto(row: StandaloneConversationMessage) -> StandaloneConversationMessageDTO:
    return StandaloneConversationMessageDTO(
        id=str(row.id),
        clientMessageId=row.client_message_id,
        role=row.role,  # type: ignore[arg-type]
        content=row.content,
        sequence=row.sequence,
        createdAt=_iso(row.created_at) or _utcnow().isoformat(),
    )


def _active_conversation_filters(user_id: UUID, *, include_archived: bool = False):
    filters = [
        StandaloneConversation.user_id == user_id,
        StandaloneConversation.deleted_at.is_(None),
    ]
    if not include_archived:
        filters.append(StandaloneConversation.archived_at.is_(None))
    return filters


async def _get_owned_conversation(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: UUID,
    for_update: bool = False,
) -> StandaloneConversation:
    query = (
        select(StandaloneConversation)
        .where(
            StandaloneConversation.id == conversation_id,
            StandaloneConversation.user_id == user_id,
            StandaloneConversation.deleted_at.is_(None),
        )
    )
    if for_update:
        query = query.with_for_update()
    result = await db.execute(query)
    row = result.scalar_one_or_none()
    if row is None:
        raise StandaloneConversationNotFoundError()
    return row


async def list_standalone_conversations(
    db: AsyncSession,
    *,
    user_id: UUID,
    limit: int = 100,
) -> List[StandaloneConversationListItem]:
    query = (
        select(StandaloneConversation)
        .where(*_active_conversation_filters(user_id))
        .order_by(
            StandaloneConversation.last_message_at.desc().nullslast(),
            StandaloneConversation.updated_at.desc().nullslast(),
            StandaloneConversation.created_at.desc(),
            StandaloneConversation.id.desc(),
        )
        .limit(limit)
    )
    result = await db.execute(query)
    rows = list(result.scalars().all())
    return [_conversation_to_list_item(row) for row in rows]


async def get_standalone_conversation_detail(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: UUID,
) -> StandaloneConversationDetail:
    conv = await _get_owned_conversation(db, user_id=user_id, conversation_id=conversation_id)
    if conv.archived_at is not None:
        raise StandaloneConversationNotFoundError()

    msg_result = await db.execute(
        select(StandaloneConversationMessage)
        .where(StandaloneConversationMessage.conversation_id == conv.id)
        .order_by(StandaloneConversationMessage.sequence.asc())
    )
    messages = [_message_to_dto(row) for row in msg_result.scalars().all()]
    detail = _conversation_to_list_item(conv)
    return StandaloneConversationDetail(**detail.model_dump(), messages=messages)


async def upsert_standalone_conversation(
    db: AsyncSession,
    *,
    user_id: UUID,
    body: StandaloneConversationCreate,
) -> StandaloneConversationListItem:
    if body.conversationType not in CONVERSATION_TYPES:
        raise HTTPException(status_code=422, detail="invalid_conversation_type")

    reject_forbidden_metadata(body.treeMetadata, field_name="tree_metadata")
    validate_bounded_json(body.treeMetadata, field_name="tree_metadata")

    client_id = body.clientConversationId.strip()
    if not client_id:
        raise HTTPException(status_code=400, detail="client_conversation_id_required")

    existing = await db.execute(
        select(StandaloneConversation).where(
            StandaloneConversation.user_id == user_id,
            StandaloneConversation.client_conversation_id == client_id,
            StandaloneConversation.deleted_at.is_(None),
        )
    )
    found = existing.scalar_one_or_none()
    if found is not None:
        return _conversation_to_list_item(found)

    group_uuid: Optional[UUID] = None
    if body.groupId:
        try:
            group_uuid = UUID(body.groupId)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="invalid_group_id") from exc

    now = _utcnow()
    row = StandaloneConversation(
        user_id=user_id,
        client_conversation_id=client_id,
        title=body.title.strip() if body.title else None,
        preview=body.preview,
        conversation_type=body.conversationType,
        parent_client_conversation_id=body.parentClientConversationId,
        source_yansi_slug=(body.sourceYansiSlug or "").strip().lower() or None,
        group_id=group_uuid,
        tree_metadata=body.treeMetadata,
        conversation_scene_url=body.conversationSceneUrl,
        conversation_scene_source=body.conversationSceneSource,
        conversation_scene_slug=body.conversationSceneSlug,
        title_pinned=body.titlePinned,
        pinned=body.pinned,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        retry = await db.execute(
            select(StandaloneConversation).where(
                StandaloneConversation.user_id == user_id,
                StandaloneConversation.client_conversation_id == client_id,
                StandaloneConversation.deleted_at.is_(None),
            )
        )
        found = retry.scalar_one_or_none()
        if found is None:
            raise
        return _conversation_to_list_item(found)

    await db.refresh(row)
    return _conversation_to_list_item(row)


async def patch_standalone_conversation(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: UUID,
    body: StandaloneConversationPatch,
) -> StandaloneConversationListItem:
    now = _utcnow()

    if body.initializeTitleOnly:
        derived = (body.title or "").strip()
        if not derived:
            raise HTTPException(status_code=422, detail="title_required")
        if body.titlePinned is not None or body.pinned is not None or body.archived is not None:
            raise HTTPException(status_code=422, detail="initialize_title_only_exclusive")

        await db.execute(
            update(StandaloneConversation)
            .where(
                StandaloneConversation.id == conversation_id,
                StandaloneConversation.user_id == user_id,
                StandaloneConversation.deleted_at.is_(None),
                StandaloneConversation.title_pinned.is_(False),
                or_(
                    StandaloneConversation.title.is_(None),
                    StandaloneConversation.title == "",
                    StandaloneConversation.title == DEFAULT_UNINITIALIZED_TITLE,
                ),
            )
            .values(title=derived, updated_at=now)
        )
        await db.commit()
        conv = await _get_owned_conversation(
            db, user_id=user_id, conversation_id=conversation_id
        )
        return _conversation_to_list_item(conv)

    # Owned + non-deleted lookup allows archive restore (archived=false).
    conv = await _get_owned_conversation(db, user_id=user_id, conversation_id=conversation_id)

    if body.title is not None:
        conv.title = body.title.strip() or None
    if body.titlePinned is not None:
        conv.title_pinned = body.titlePinned
    if body.pinned is not None:
        conv.pinned = body.pinned
    if body.archived is not None:
        conv.archived_at = now if body.archived else None
    conv.updated_at = now

    await db.commit()
    await db.refresh(conv)
    return _conversation_to_list_item(conv)


async def delete_standalone_conversation(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: UUID,
) -> None:
    """Soft-delete tombstone. Future 8.8G-3 import must not resurrect deleted rows."""
    conv = await _get_owned_conversation(db, user_id=user_id, conversation_id=conversation_id)
    now = _utcnow()
    conv.deleted_at = now
    conv.updated_at = now
    await db.commit()


async def append_standalone_message(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: UUID,
    body: StandaloneConversationMessageCreate,
) -> StandaloneConversationMessageDTO:
    if body.role not in MESSAGE_ROLES:
        raise HTTPException(status_code=422, detail="invalid_message_role")

    reject_forbidden_metadata(body.metadata, field_name="message_metadata")
    validate_bounded_json(body.metadata, field_name="message_metadata")

    client_message_id = body.clientMessageId.strip()
    if not client_message_id:
        raise HTTPException(status_code=400, detail="client_message_id_required")

    for attempt in range(3):
        try:
            return await _append_standalone_message_once(
                db,
                user_id=user_id,
                conversation_id=conversation_id,
                body=body,
                client_message_id=client_message_id,
            )
        except IntegrityError:
            await db.rollback()
            dup_retry = await db.execute(
                select(StandaloneConversationMessage).where(
                    StandaloneConversationMessage.conversation_id == conversation_id,
                    StandaloneConversationMessage.client_message_id == client_message_id,
                )
            )
            existing = dup_retry.scalar_one_or_none()
            if existing is not None:
                return _message_to_dto(existing)
            if attempt >= 2:
                break
    raise HTTPException(status_code=409, detail="message_append_conflict")


async def _append_standalone_message_once(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: UUID,
    body: StandaloneConversationMessageCreate,
    client_message_id: str,
) -> StandaloneConversationMessageDTO:
    conv = await _get_owned_conversation(
        db,
        user_id=user_id,
        conversation_id=conversation_id,
    )
    if conv.archived_at is not None:
        raise StandaloneConversationNotFoundError()

    dup = await db.execute(
        select(StandaloneConversationMessage).where(
            StandaloneConversationMessage.conversation_id == conv.id,
            StandaloneConversationMessage.client_message_id == client_message_id,
        )
    )
    existing = dup.scalar_one_or_none()
    if existing is not None:
        return _message_to_dto(existing)

    now = _utcnow()
    increment = await db.execute(
        update(StandaloneConversation)
        .where(
            StandaloneConversation.id == conv.id,
            StandaloneConversation.user_id == user_id,
            StandaloneConversation.deleted_at.is_(None),
            StandaloneConversation.archived_at.is_(None),
        )
        .values(
            message_count=StandaloneConversation.message_count + 1,
            last_message_at=now,
            updated_at=now,
        )
        .returning(StandaloneConversation.message_count, StandaloneConversation.preview)
    )
    incremented = increment.one_or_none()
    if incremented is None:
        raise StandaloneConversationNotFoundError()

    next_sequence = int(incremented.message_count)
    preview = incremented.preview
    if not preview:
        await db.execute(
            update(StandaloneConversation)
            .where(StandaloneConversation.id == conv.id)
            .values(preview=body.content[:500])
        )

    row = StandaloneConversationMessage(
        conversation_id=conv.id,
        client_message_id=client_message_id,
        role=body.role,
        content=body.content,
        sequence=next_sequence,
        message_metadata=body.metadata,
        created_at=now,
    )

    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        retry = await db.execute(
            select(StandaloneConversationMessage).where(
                StandaloneConversationMessage.conversation_id == conversation_id,
                StandaloneConversationMessage.client_message_id == client_message_id,
            )
        )
        existing = retry.scalar_one_or_none()
        if existing is None:
            raise
        return _message_to_dto(existing)

    return _message_to_dto(row)
