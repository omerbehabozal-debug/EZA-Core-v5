# -*- coding: utf-8 -*-
"""Conversation groups API — guest-first + authenticated authority (G5.3.1)."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import get_current_user, security
from backend.auth.jwt import get_user_from_token
from backend.core.schemas.conversation_tree import (
    ClaimGuestConversationGroupsRequest,
    ClaimGuestConversationGroupsResponse,
    ConversationGroupCreate,
    ConversationGroupPatch,
    ConversationGroupResponse,
)
from backend.core.utils.dependencies import get_db
from backend.services.conversation_tree.groups import (
    ConversationGroupNotFoundError,
    claim_guest_conversation_groups,
    delete_conversation_group,
    fetch_conversation_groups,
    group_to_response,
    patch_conversation_group,
    persist_conversation_group,
)

router = APIRouter(prefix="/api/conversation-groups", tags=["Conversation Groups"])


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "conversation_group_not_found"},
    )


def _optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials],
) -> Optional[UUID]:
    if credentials is None:
        return None
    user = get_user_from_token(credentials.credentials)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="unauthorized",
        )
    return UUID(str(user["user_id"]))


@router.post("", response_model=ConversationGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation_group(
    body: ConversationGroupCreate,
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> ConversationGroupResponse:
    """
    Authenticated: binds group.user_id to bearer user (idempotent via clientGroupId).
    Guest: requires guestToken; never receives authenticated ownership.
    """
    user_id = _optional_user_id(credentials)
    if user_id is None and not (body.guestToken and body.guestToken.strip()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication_required",
        )
    row = await persist_conversation_group(db, body, user_id=user_id)
    return group_to_response(row)


@router.get("", response_model=List[ConversationGroupResponse])
async def list_conversation_groups(
    guestToken: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> List[ConversationGroupResponse]:
    user_id: Optional[UUID] = None
    if credentials is not None:
        user = get_user_from_token(credentials.credentials)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="unauthorized",
            )
        user_id = UUID(str(user["user_id"]))

    guest = guestToken.strip() if guestToken else None
    if user_id is None and not guest:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication_required",
        )

    rows = await fetch_conversation_groups(
        db,
        # Auth identity wins; never list guest rows when authenticated.
        guest_token=None if user_id is not None else guest,
        user_id=user_id,
    )
    return [group_to_response(r) for r in rows]


@router.patch("/{group_id}", response_model=ConversationGroupResponse)
async def patch_group(
    group_id: UUID,
    body: ConversationGroupPatch,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ConversationGroupResponse:
    user_id = UUID(str(current_user["user_id"]))
    try:
        row = await patch_conversation_group(
            db, user_id=user_id, group_id=group_id, body=body
        )
    except ConversationGroupNotFoundError as exc:
        raise _not_found() from exc
    return group_to_response(row)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> Response:
    user_id = UUID(str(current_user["user_id"]))
    try:
        await delete_conversation_group(db, user_id=user_id, group_id=group_id)
    except ConversationGroupNotFoundError as exc:
        raise _not_found() from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/claim-guest", response_model=ClaimGuestConversationGroupsResponse)
async def claim_guest_groups(
    body: ClaimGuestConversationGroupsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ClaimGuestConversationGroupsResponse:
    guest_token = body.guestToken.strip()
    if not guest_token:
        raise HTTPException(status_code=400, detail="guest_token_required")

    user_id = UUID(str(current_user["user_id"]))
    claimed_rows, merged = await claim_guest_conversation_groups(
        db,
        user_id=user_id,
        guest_token=guest_token,
    )
    return ClaimGuestConversationGroupsResponse(
        claimed=[group_to_response(row) for row in claimed_rows],
        merged=merged,
    )
