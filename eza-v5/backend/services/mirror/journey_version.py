# -*- coding: utf-8 -*-
"""Authoritative journeyVersion for prepare/publish (Phase 3.5)."""

from __future__ import annotations

from typing import Optional


def resolve_authoritative_journey_version(
    *,
    existing_published_version: Optional[int],
    client_version: Optional[int] = None,
) -> int:
    """
    new journey → 1
    existing published journey → currentVersion + 1 (next artifact / republish)
    """
    if existing_published_version is None:
        return 1
    try:
        current = int(existing_published_version)
    except (TypeError, ValueError):
        current = 1
    if current < 1:
        current = 1
    return current + 1


def versions_are_distinguishable(v1: int, v2: int) -> bool:
    return int(v1) != int(v2) and int(v1) >= 1 and int(v2) >= 1
