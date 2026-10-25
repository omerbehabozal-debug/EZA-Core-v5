# -*- coding: utf-8 -*-
"""SAINA quota event type constants."""

from typing import Literal

QuotaEventType = Literal[
    "chat_message",
    "mirror_created",
    "yansi_created",
    "discover_conversation_started",
    "business_brand_message",
]

CHAT_MESSAGE: QuotaEventType = "chat_message"
MIRROR_CREATED: QuotaEventType = "mirror_created"
YANSI_CREATED: QuotaEventType = "yansi_created"
DISCOVER_CONVERSATION_STARTED: QuotaEventType = "discover_conversation_started"
BUSINESS_BRAND_MESSAGE: QuotaEventType = "business_brand_message"

VISUAL_EVENT_TYPES: tuple[QuotaEventType, ...] = (
    MIRROR_CREATED,
)

ALL_QUOTA_EVENT_TYPES: tuple[QuotaEventType, ...] = (
    CHAT_MESSAGE,
    MIRROR_CREATED,
    YANSI_CREATED,
    DISCOVER_CONVERSATION_STARTED,
)
