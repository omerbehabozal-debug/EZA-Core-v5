# -*- coding: utf-8 -*-
"""Validated parent_slug resolution for Mirror Network publish (Faz 2.1)."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.mirror_network.repository import get_mirror_network_node_by_slug
from backend.services.mirror_network.safety_gate import evaluate_mirror_network_safety


def _invalid_parent(detail_code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": detail_code, "message": message},
    )


def normalize_parent_slug(value: str | None) -> Optional[str]:
    normalized = (value or "").strip().lower()
    return normalized or None


async def validate_parent_slug(
    db: AsyncSession,
    *,
    parent_slug: str,
    child_slug: str,
) -> str:
    """
    Ensure parent exists, is publicly eligible, and is not self-parent.

    Raises HTTP 400 on invalid parent claims — never silently ignore bad lineage.
    """
    normalized_parent = normalize_parent_slug(parent_slug)
    normalized_child = normalize_parent_slug(child_slug)

    if not normalized_parent:
        raise _invalid_parent("invalid_parent_slug", "parentSlug is required when provided")

    if normalized_parent == normalized_child:
        raise _invalid_parent("invalid_parent_slug", "parentSlug cannot reference the same mirror")

    parent_node = await get_mirror_network_node_by_slug(db, normalized_parent)
    if not parent_node:
        raise _invalid_parent("parent_not_found", "parentSlug does not reference an existing mirror")

    visibility = (parent_node.visibility or "public").lower()
    safety_status = (parent_node.safety_status or "open").lower()

    if visibility == "private":
        raise _invalid_parent("parent_not_eligible", "parentSlug is not publicly eligible")
    if safety_status == "restricted":
        raise _invalid_parent("parent_not_eligible", "parentSlug is not publicly eligible")

    safety = evaluate_mirror_network_safety(parent_node)
    if not safety.passed:
        raise _invalid_parent("parent_not_eligible", "parentSlug is not publicly eligible")

    return normalized_parent


def resolve_stored_parent_slug(
    *,
    existing_parent_slug: str | None,
    validated_parent_slug: str | None,
) -> Optional[str]:
    """
    parent_slug is immutable once set.

    A retry with a different parentSlug keeps the stored parent.
    """
    existing = normalize_parent_slug(existing_parent_slug)
    if existing:
        return existing
    return normalize_parent_slug(validated_parent_slug)
