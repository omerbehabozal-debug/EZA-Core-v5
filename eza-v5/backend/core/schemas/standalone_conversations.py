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

# Phase 8.8G-3 / 8.8G-3.2
MAX_LEGACY_CONVERSATIONS_PER_REQUEST = 30
MAX_LEGACY_MESSAGES_PER_CONVERSATION = 500

# Phase 8.8G-3.2 — authenticated conversation list pagination
DEFAULT_CONVERSATION_LIST_LIMIT = 100
MAX_CONVERSATION_LIST_LIMIT = 100
MAX_CONVERSATION_LIST_OFFSET = 100_000

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
    # Optional membership: omit = no change; null = ungroup; UUID = assign (owned).
    groupId: Optional[str] = Field(default=None, max_length=36)


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
    hasReadyYansi: bool = False
    publishedYansiSlug: Optional[str] = None


class StandaloneConversationDetail(StandaloneConversationListItem):
    messages: list[StandaloneConversationMessageDTO] = Field(default_factory=list)


# --- Phase 8.8G-3 legacy migration ---


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


class StandaloneConversationListPage(BaseModel):
    """Phase 8.8G-3.2 — bounded paginated conversation list."""

    items: list[StandaloneConversationListItem] = Field(default_factory=list)
    limit: int
    offset: int
    total: int
    hasMore: bool


# --- Phase 8.8G-4 unpublished Yansı preparation ---

YansiPreparationStatus = Literal["ready"]


class YansiPreparationSelectedStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stepIndex: int = Field(ge=0, le=32)
    sourceOrder: int = Field(ge=0, le=500)
    sourceUserMessageId: str = Field(min_length=1, max_length=MAX_CLIENT_ID_LENGTH)
    sourceAssistantMessageId: str = Field(min_length=1, max_length=MAX_CLIENT_ID_LENGTH)
    publicQuestion: str = Field(min_length=1, max_length=4_000)
    publicAnswer: str = Field(min_length=1, max_length=4_000)


class YansiPreparationUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    journeyId: str = Field(min_length=1, max_length=64)
    journeyVersion: int = Field(ge=1, le=10_000)
    windowIndex: int = Field(ge=0, le=500)
    windowHash: str = Field(min_length=1, max_length=128)
    selectedStepsHash: str = Field(min_length=1, max_length=128)
    sourceBlockHash: Optional[str] = Field(default=None, max_length=128)
    generationId: str = Field(min_length=1, max_length=128)
    publicTitle: str = Field(min_length=1, max_length=MAX_TITLE_LENGTH)
    publicSummary: str = Field(min_length=1, max_length=2000)
    continuationContext: Optional[str] = Field(default=None, max_length=2000)
    sceneImageUrl: str = Field(min_length=1, max_length=MAX_SCENE_URL_LENGTH)
    sceneAssetId: Optional[str] = Field(default=None, max_length=128)
    sceneFocalX: Optional[float] = Field(default=None, ge=0, le=1)
    sceneFocalY: Optional[float] = Field(default=None, ge=0, le=1)
    sealedLineage: dict[str, Any]
    sealedPublicLanding: Optional[dict[str, Any]] = None
    sourceIdentity: Optional[str] = Field(default=None, max_length=160)


class YansiPreparationPublicationLink(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1, max_length=MAX_SOURCE_YANSI_SLUG_LENGTH)
    journeyId: Optional[str] = Field(default=None, max_length=64)
    journeyVersion: Optional[int] = Field(default=None, ge=1, le=10_000)


class YansiPreparationDTO(BaseModel):
    id: str
    conversationId: str
    sourceIdentity: str
    journeyId: str
    journeyVersion: int
    windowIndex: int
    windowHash: str
    selectedStepsHash: str
    sourceBlockHash: Optional[str] = None
    generationId: str
    status: YansiPreparationStatus
    publicTitle: str
    publicSummary: str
    continuationContext: Optional[str] = None
    sceneImageUrl: str
    sceneAssetId: Optional[str] = None
    sceneFocalX: Optional[float] = None
    sceneFocalY: Optional[float] = None
    sealedLineage: dict[str, Any]
    sealedPublicLanding: Optional[dict[str, Any]] = None
    publishedSlug: Optional[str] = None
    createdAt: str
    updatedAt: Optional[str] = None


class YansiPreparationListResponse(BaseModel):
    items: list[YansiPreparationDTO] = Field(default_factory=list)

