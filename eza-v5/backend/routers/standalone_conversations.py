# -*- coding: utf-8 -*-
"""Authenticated standalone conversation API — Phase 8.8G-1."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import get_current_user
from backend.core.schemas.standalone_conversations import (
    DEFAULT_CONVERSATION_LIST_LIMIT,
    MAX_CONVERSATION_LIST_LIMIT,
    MAX_CONVERSATION_LIST_OFFSET,
    StandaloneConversationCreate,
    StandaloneConversationDetail,
    StandaloneConversationListItem,
    StandaloneConversationListPage,
    StandaloneConversationMessageCreate,
    StandaloneConversationMessageDTO,
    StandaloneConversationPatch,
    LegacyMigrationRequest,
    LegacyMigrationResponse,
    YansiPreparationDTO,
    YansiPreparationListResponse,
    YansiPreparationPublicationLink,
    YansiPreparationUpsert,
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
from backend.services.standalone.legacy_migration import migrate_legacy_conversations
from backend.services.standalone.yansi_preparations import (
    YansiPreparationNotFoundError,
    link_preparation_publication,
    list_owned_preparations,
    upsert_ready_preparation,
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


@router.get("", response_model=StandaloneConversationListPage)
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    limit: int = Query(DEFAULT_CONVERSATION_LIST_LIMIT, ge=1, le=MAX_CONVERSATION_LIST_LIMIT),
    offset: int = Query(0, ge=0, le=MAX_CONVERSATION_LIST_OFFSET),
) -> StandaloneConversationListPage:
    return await list_standalone_conversations(
        db,
        user_id=_owner_user_id(current_user),
        limit=limit,
        offset=offset,
    )


@router.post(
    "/migrate-legacy",
    response_model=LegacyMigrationResponse,
    status_code=status.HTTP_200_OK,
)
async def migrate_legacy(
    body: LegacyMigrationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> LegacyMigrationResponse:
    """
    Phase 8.8G-3 — dedicated historical import.
    Owner is derived from JWT only. Does not weaken live assistant append.
    """
    return await migrate_legacy_conversations(
        db,
        user_id=_owner_user_id(current_user),
        request=body,
    )


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


@router.get("/{conversation_id}/yansi-preparation", response_model=YansiPreparationListResponse)
async def get_yansi_preparation(
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> YansiPreparationListResponse:
    try:
        items = await list_owned_preparations(
            db,
            user_id=_owner_user_id(current_user),
            conversation_id=conversation_id,
        )
    except YansiPreparationNotFoundError as exc:
        raise _not_found() from exc
    return YansiPreparationListResponse(items=items)


@router.put("/{conversation_id}/yansi-preparation", response_model=YansiPreparationDTO)
async def put_yansi_preparation(
    conversation_id: UUID,
    body: YansiPreparationUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> YansiPreparationDTO:
    try:
        return await upsert_ready_preparation(
            db,
            user_id=_owner_user_id(current_user),
            conversation_id=conversation_id,
            body=body,
        )
    except YansiPreparationNotFoundError as exc:
        raise _not_found() from exc


@router.post(
    "/{conversation_id}/yansi-preparation/publication-link",
    response_model=YansiPreparationDTO,
)
async def post_yansi_preparation_publication_link(
    conversation_id: UUID,
    body: YansiPreparationPublicationLink,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> YansiPreparationDTO:
    try:
        return await link_preparation_publication(
            db,
            user_id=_owner_user_id(current_user),
            conversation_id=conversation_id,
            body=body,
        )
    except YansiPreparationNotFoundError as exc:
        raise _not_found() from exc
