# -*- coding: utf-8 -*-
"""Optional conversation groupId parsing — Phase 8.8G-5 / 2.2.

Invalid/non-UUID optional group metadata must be dropped, not reject the
conversation. Ownership and transcript validation remain strict elsewhere.
"""

from __future__ import annotations

from typing import Optional, Tuple
from uuid import UUID


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
