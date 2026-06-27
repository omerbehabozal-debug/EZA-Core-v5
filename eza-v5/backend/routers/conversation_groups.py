# -*- coding: utf-8 -*-
"""Conversation groups API — guest-first; optional auth."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import get_current_user
from backend.core.schemas.conversation_tree import (
    ClaimGuestConversationGroupsRequest,
    ClaimGuestConversationGroupsResponse,
    ConversationGroupCreate,
    ConversationGroupResponse,
)
from backend.core.utils.dependencies import get_db
from backend.services.conversation_tree.groups import (
    claim_guest_conversation_groups,
    fetch_conversation_groups,
    group_to_response,
    persist_conversation_group,
)
from uuid import UUID

router = APIRouter(prefix="/api/conversation-groups", tags=["Conversation Groups"])


@router.post("", response_model=ConversationGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation_group(
    body: ConversationGroupCreate,
    db: AsyncSession = Depends(get_db),
) -> ConversationGroupResponse:
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title_required")
    row = await persist_conversation_group(db, body)
    return group_to_response(row)


@router.get("", response_model=List[ConversationGroupResponse])
async def list_conversation_groups(
    guestToken: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> List[ConversationGroupResponse]:
    rows = await fetch_conversation_groups(db, guest_token=guestToken)
    return [group_to_response(r) for r in rows]


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
