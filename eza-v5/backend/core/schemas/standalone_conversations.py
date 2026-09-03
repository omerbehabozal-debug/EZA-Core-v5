# -*- coding: utf-8 -*-
"""Pydantic schemas — durable standalone conversations (Phase 8.8G-1)."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from backend.services.standalone.persistence_limits import MAX_MESSAGE_CONTENT_LENGTH

ConversationType = Literal["direct", "mirror", "mirror_branch", "continuation"]
MessageRole = Literal["user", "assistant"]


class StandaloneConversationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clientConversationId: str = Field(min_length=1, max_length=64)
    title: Optional[str] = Field(default=None, max_length=200)
    preview: Optional[str] = Field(default=None, max_length=500)
    conversationType: ConversationType = "direct"
    parentClientConversationId: Optional[str] = Field(default=None, max_length=64)
    sourceYansiSlug: Optional[str] = Field(default=None, max_length=120)
    groupId: Optional[str] = Field(default=None, max_length=36)
    treeMetadata: Optional[dict[str, Any]] = None
    conversationSceneUrl: Optional[str] = Field(default=None, max_length=2048)
    conversationSceneSource: Optional[str] = Field(default=None, max_length=32)
    conversationSceneSlug: Optional[str] = Field(default=None, max_length=120)
    titlePinned: bool = False
    pinned: bool = False


class StandaloneConversationPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, max_length=200)
    titlePinned: Optional[bool] = None
    pinned: Optional[bool] = None
    archived: Optional[bool] = None
    initializeTitleOnly: bool = False


class StandaloneConversationMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clientMessageId: str = Field(min_length=1, max_length=64)
    role: MessageRole
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_CONTENT_LENGTH)
    metadata: Optional[dict[str, Any]] = None


class StandaloneConversationMessageDTO(BaseModel):
    id: str
    clientMessageId: str
    role: MessageRole
    content: str
    sequence: int
    createdAt: str


class StandaloneConversationListItem(BaseModel):
    id: str
    clientConversationId: str
    title: Optional[str] = None
    preview: Optional[str] = None
    conversationType: ConversationType
    sourceYansiSlug: Optional[str] = None
    messageCount: int
    createdAt: str
    updatedAt: Optional[str] = None
    lastMessageAt: Optional[str] = None
    archived: bool = False
    pinned: bool = False
    titlePinned: bool = False
    groupId: Optional[str] = None
    conversationSceneUrl: Optional[str] = None
    conversationSceneSource: Optional[str] = None
    conversationSceneSlug: Optional[str] = None


class StandaloneConversationDetail(StandaloneConversationListItem):
    messages: list[StandaloneConversationMessageDTO] = Field(default_factory=list)
