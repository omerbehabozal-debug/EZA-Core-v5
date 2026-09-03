# -*- coding: utf-8 -*-
"""Pydantic schemas — durable standalone conversations (Phase 8.8G-1 / 8.8G-3)."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from backend.services.standalone.persistence_limits import (
    MAX_CLIENT_ID_LENGTH,
    MAX_MESSAGE_CONTENT_LENGTH,
    MAX_PREVIEW_LENGTH,
    MAX_SCENE_SLUG_LENGTH,
    MAX_SCENE_SOURCE_LENGTH,
    MAX_SCENE_URL_LENGTH,
    MAX_SOURCE_YANSI_SLUG_LENGTH,
    MAX_TITLE_LENGTH,
)

ConversationType = Literal["direct", "mirror", "mirror_branch", "continuation"]
MessageRole = Literal["user", "assistant"]
LegacyMigrationStatus = Literal[
    "migrated",
    "already_server_authoritative",
    "tombstoned",
    "rejected_invalid",
    "empty_transcript",
    "failed_retryable",
]


class StandaloneConversationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clientConversationId: str = Field(min_length=1, max_length=MAX_CLIENT_ID_LENGTH)
    title: Optional[str] = Field(default=None, max_length=MAX_TITLE_LENGTH)
    preview: Optional[str] = Field(default=None, max_length=MAX_PREVIEW_LENGTH)
    conversationType: ConversationType = "direct"
    parentClientConversationId: Optional[str] = Field(
        default=None, max_length=MAX_CLIENT_ID_LENGTH
    )
    sourceYansiSlug: Optional[str] = Field(
        default=None, max_length=MAX_SOURCE_YANSI_SLUG_LENGTH
    )
    groupId: Optional[str] = Field(default=None, max_length=36)
    treeMetadata: Optional[dict[str, Any]] = None
    conversationSceneUrl: Optional[str] = Field(default=None, max_length=MAX_SCENE_URL_LENGTH)
    conversationSceneSource: Optional[str] = Field(
        default=None, max_length=MAX_SCENE_SOURCE_LENGTH
    )
    conversationSceneSlug: Optional[str] = Field(default=None, max_length=MAX_SCENE_SLUG_LENGTH)
    titlePinned: bool = False
    pinned: bool = False


class StandaloneConversationPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, max_length=MAX_TITLE_LENGTH)
    titlePinned: Optional[bool] = None
    pinned: Optional[bool] = None
    archived: Optional[bool] = None
    initializeTitleOnly: bool = False


class StandaloneConversationMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clientMessageId: str = Field(min_length=1, max_length=MAX_CLIENT_ID_LENGTH)
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


# --- Phase 8.8G-3 legacy migration ---

MAX_LEGACY_CONVERSATIONS_PER_REQUEST = 30
MAX_LEGACY_MESSAGES_PER_CONVERSATION = 500


class LegacyMigrationMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clientMessageId: Optional[str] = Field(default=None, max_length=MAX_CLIENT_ID_LENGTH)
    role: MessageRole
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_CONTENT_LENGTH)
    ordinal: int = Field(ge=0, le=MAX_LEGACY_MESSAGES_PER_CONVERSATION)
    createdAt: Optional[str] = Field(default=None, max_length=64)


class LegacyMigrationConversation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clientConversationId: str = Field(min_length=1, max_length=MAX_CLIENT_ID_LENGTH)
    title: Optional[str] = Field(default=None, max_length=MAX_TITLE_LENGTH)
    titlePinned: bool = False
    pinned: bool = False
    conversationType: Optional[str] = Field(default=None, max_length=32)
    parentClientConversationId: Optional[str] = Field(
        default=None, max_length=MAX_CLIENT_ID_LENGTH
    )
    sourceYansiSlug: Optional[str] = Field(
        default=None, max_length=MAX_SOURCE_YANSI_SLUG_LENGTH
    )
    groupId: Optional[str] = Field(default=None, max_length=36)
    treeMetadata: Optional[dict[str, Any]] = None
    conversationSceneUrl: Optional[str] = Field(default=None, max_length=MAX_SCENE_URL_LENGTH)
    conversationSceneSource: Optional[str] = Field(
        default=None, max_length=MAX_SCENE_SOURCE_LENGTH
    )
    conversationSceneSlug: Optional[str] = Field(default=None, max_length=MAX_SCENE_SLUG_LENGTH)
    messages: list[LegacyMigrationMessage] = Field(default_factory=list)


class LegacyMigrationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conversations: list[LegacyMigrationConversation] = Field(
        min_length=1,
        max_length=MAX_LEGACY_CONVERSATIONS_PER_REQUEST,
    )


class LegacyMigrationConversationResult(BaseModel):
    clientConversationId: str
    status: LegacyMigrationStatus
    serverConversationId: Optional[str] = None
    reason: Optional[str] = None
    messageCount: Optional[int] = None


class LegacyMigrationResponse(BaseModel):
    results: list[LegacyMigrationConversationResult]
