# -*- coding: utf-8 -*-
"""Pydantic schemas — conversation groups + tree metadata."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

ConversationGroupSource = Literal["manual", "inferred", "mirror", "imported"]
ConversationSourceType = Literal["direct", "mirror", "mirror_branch"]

MAX_CLIENT_GROUP_ID_LENGTH = 64


class ConversationTreeMetadata(BaseModel):
    groupId: Optional[str] = None
    sourceType: ConversationSourceType = "direct"
    startedFromMirrorId: Optional[str] = None
    parentMirrorId: Optional[str] = None
    rootMirrorId: Optional[str] = None
    parentConversationId: Optional[str] = None
    branchFromConversationId: Optional[str] = None
    branchTitle: Optional[str] = None
    seedTopic: Optional[str] = None
    seedCategory: Optional[str] = None
    seedMood: Optional[str] = None
    isGuestSession: Optional[bool] = None


class ConversationGroupCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    source: ConversationGroupSource = "manual"
    guestToken: Optional[str] = None
    parentGroupId: Optional[str] = None
    # Authenticated migration/idempotent upsert key (local group-* ids).
    clientGroupId: Optional[str] = Field(default=None, max_length=MAX_CLIENT_GROUP_ID_LENGTH)


class ConversationGroupPatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    sortOrder: Optional[int] = None


class ConversationGroupResponse(BaseModel):
    id: str
    title: str
    source: ConversationGroupSource
    parentGroupId: Optional[str] = None
    sortOrder: int = 0
    createdAt: str
    updatedAt: str
    clientGroupId: Optional[str] = None


class ClaimGuestConversationGroupsRequest(BaseModel):
    guestToken: str = Field(min_length=8, max_length=256)


class ClaimGuestConversationGroupsResponse(BaseModel):
    claimed: list[ConversationGroupResponse] = Field(default_factory=list)
    merged: int = 0
