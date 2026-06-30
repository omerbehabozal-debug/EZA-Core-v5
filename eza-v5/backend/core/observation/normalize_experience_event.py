# -*- coding: utf-8 -*-
"""
EZA Observation — product event → universal event classification.

Universal mapping classifies only; it does not produce decisions or recommendations.
"""

from __future__ import annotations

from typing import Optional

# Minimum universal taxonomy for cross-product observation.
UNIVERSAL_EVENT_MAP = {
    "mirror_created": "content_generated",
    "mirror_shared": "content_shared",
    "mirror_share_opened": "content_share_engaged",
    "landing_viewed": "content_engaged",
    "landing_cta_clicked": "content_engaged",
    "guest_conversation_started": "session_started_from_content",
    "branch_opened": "session_branched",
    "second_user_message_sent": "session_continued",
    "mirror_birth_suggested": "prompt_surfaced",
    "mirror_birth_accepted": "prompt_accepted",
    "branch_suggestion_shown": "prompt_surfaced",
    "guest_tree_claimed": "session_claimed",
    "relationship_pattern_viewed": "insight_viewed",
}

ALLOWED_EXPERIENCE_EVENT_TYPES = frozenset(UNIVERSAL_EVENT_MAP.keys())


def resolve_universal_event_type(event_type: str) -> Optional[str]:
    """Map product event type to universal classification."""
    return UNIVERSAL_EVENT_MAP.get(event_type)
