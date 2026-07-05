# -*- coding: utf-8 -*-
"""SAINA quota event type constants."""

from typing import Literal

QuotaEventType = Literal[
    "chat_message",
    "mirror_created",
    "yansi_created",
    "discover_conversation_started",
]

CHAT_MESSAGE: QuotaEventType = "chat_message"
MIRROR_CREATED: QuotaEventType = "mirror_created"
YANSI_CREATED: QuotaEventType = "yansi_created"
DISCOVER_CONVERSATION_STARTED: QuotaEventType = "discover_conversation_started"

VISUAL_EVENT_TYPES: tuple[QuotaEventType, QuotaEventType] = (
    MIRROR_CREATED,
    YANSI_CREATED,
)

ALL_QUOTA_EVENT_TYPES: tuple[QuotaEventType, ...] = (
    CHAT_MESSAGE,
    MIRROR_CREATED,
    YANSI_CREATED,
    DISCOVER_CONVERSATION_STARTED,
)
