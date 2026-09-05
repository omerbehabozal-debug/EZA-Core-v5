# -*- coding: utf-8 -*-
"""Optional conversation groupId parsing + ownership — Phase 8.8G-5.2 / 5.3.1.

Invalid/non-UUID optional group metadata must be dropped, not reject the
conversation. Valid UUIDs must be ownership-checked before storage.
"""

from __future__ import annotations

from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.conversation_groups import ConversationGroup


def parse_optional_group_uuid(raw: Optional[str]) -> Tuple[Optional[UUID], bool]:
    """
    Returns (uuid_or_none, was_sanitized).

    was_sanitized is True when a non-empty raw value could not be parsed as UUID
    and was therefore dropped.
    """
    if raw is None:
        return None, False
    text = raw.strip()
    if not text:
        return None, False
    try:
        return UUID(text), False
    except ValueError:
        return None, True


async def resolve_optional_owned_group_id(
    db: AsyncSession,
    *,
    user_id: UUID,
    raw: Optional[str],
) -> Tuple[Optional[UUID], str]:
    """
    Soft-resolve optional group metadata for create/migrate.

    Returns (group_id_or_none, outcome) where outcome is one of:
      none | owned | malformed_dropped | unauthorized_dropped

    Never raises. Never leaks whether a cross-owner UUID exists.
    Unauthorized / missing rows → null (same as malformed soft-drop).
    """
    parsed, malformed = parse_optional_group_uuid(raw)
    if malformed:
        return None, "malformed_dropped"
    if parsed is None:
        return None, "none"

    result = await db.execute(
        select(ConversationGroup.id).where(
            ConversationGroup.id == parsed,
            ConversationGroup.user_id == user_id,
        )
    )
    owned = result.scalar_one_or_none()
    if owned is None:
        return None, "unauthorized_dropped"
    return parsed, "owned"
