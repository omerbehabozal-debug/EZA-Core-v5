# -*- coding: utf-8 -*-
"""Authenticated standalone conversation API — Phase 8.8G-1."""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import get_current_user
from backend.core.schemas.standalone_conversations import (
    StandaloneConversationCreate,
    StandaloneConversationDetail,
    StandaloneConversationListItem,
    StandaloneConversationMessageCreate,
    StandaloneConversationMessageDTO,
    StandaloneConversationPatch,
)
from backend.core.utils.dependencies import get_db
from backend.services.standalone.conversations import (
    StandaloneConversationNotFoundError,
    append_standalone_message,
    delete_standalone_conversation,
    get_standalone_conversation_detail,
    list_standalone_conversations,
    patch_standalone_conversation,
    upsert_standalone_conversation,
)

router = APIRouter(
    prefix="/api/standalone/conversations",
    tags=["Standalone Conversations"],
)


def _owner_user_id(current_user: dict) -> UUID:
    return UUID(str(current_user["user_id"]))


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "conversation_not_found"},
    )


@router.get("", response_model=List[StandaloneConversationListItem])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> List[StandaloneConversationListItem]:
    return await list_standalone_conversations(db, user_id=_owner_user_id(current_user))


@router.get("/{conversation_id}", response_model=StandaloneConversationDetail)
async def get_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> StandaloneConversationDetail:
    try:
        return await get_standalone_conversation_detail(
            db,
            user_id=_owner_user_id(current_user),
            conversation_id=conversation_id,
        )
    except StandaloneConversationNotFoundError as exc:
        raise _not_found() from exc


@router.post("", response_model=StandaloneConversationListItem, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: StandaloneConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> StandaloneConversationListItem:
    return await upsert_standalone_conversation(
        db,
        user_id=_owner_user_id(current_user),
        body=body,
    )


@router.patch("/{conversation_id}", response_model=StandaloneConversationListItem)
async def update_conversation(
    conversation_id: UUID,
    body: StandaloneConversationPatch,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> StandaloneConversationListItem:
    try:
        return await patch_standalone_conversation(
            db,
            user_id=_owner_user_id(current_user),
            conversation_id=conversation_id,
            body=body,
        )
    except StandaloneConversationNotFoundError as exc:
        raise _not_found() from exc


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def remove_conversation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Response:
    try:
        await delete_standalone_conversation(
            db,
            user_id=_owner_user_id(current_user),
            conversation_id=conversation_id,
        )
    except StandaloneConversationNotFoundError as exc:
        raise _not_found() from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{conversation_id}/messages",
    response_model=StandaloneConversationMessageDTO,
    status_code=status.HTTP_201_CREATED,
)
async def append_message(
    conversation_id: UUID,
    body: StandaloneConversationMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> StandaloneConversationMessageDTO:
    if body.role == "assistant":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="assistant_append_not_allowed",
        )
    try:
        return await append_standalone_message(
            db,
            user_id=_owner_user_id(current_user),
            conversation_id=conversation_id,
            body=body,
        )
    except StandaloneConversationNotFoundError as exc:
        raise _not_found() from exc
