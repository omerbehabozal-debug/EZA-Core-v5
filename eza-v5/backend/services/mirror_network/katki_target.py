# -*- coding: utf-8 -*-
"""Katkılar Phase 1 — resolve one frozen Yansı version as a contribution target.

Attachment identity is slug + journeyVersion. This module does not create
contributions and does not expose an HTTP route.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1
from backend.services.mirror_network.frozen_journey_artifact import (
    get_frozen_journey_artifact,
    to_public_frozen_journey_artifact,
)
from backend.services.mirror_network.repository import get_mirror_network_node_by_slug
from backend.services.mirror_network.visibility_access import is_direct_link_accessible

# These cannot become a Katkı target. The resolved object has no place for them.
KATKI_FORBIDDEN_ATTACHMENT_KEYS = frozenset(
    {
        "scope",
        "stepIndex",
        "step_index",
        "mirrorJourneyStepId",
        "sourceConversationId",
        "source_conversation_id",
        "source_user_message_id",
        "source_assistant_message_id",
        "sceneAssetId",
        "generationId",
    }
)


class KatkiTargetResolutionError(Exception):
    """Fail closed. `code` is the only public reason."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class KatkiResolvedTarget:
    """Internal target for later phases. Not a public DTO."""

    slug: str
    journey_version: int
    node_id: UUID
    owner_user_id: UUID


def reject_forbidden_katki_attachment(fields: Mapping[str, Any]) -> None:
    """Refuse a payload that tries to name a non-Yansı attachment."""
    found = KATKI_FORBIDDEN_ATTACHMENT_KEYS.intersection(fields)
    if found:
        raise KatkiTargetResolutionError("forbidden_attachment")


def _require_journey_version(journey_version: int | None) -> int:
    if isinstance(journey_version, bool) or not isinstance(journey_version, int):
        raise KatkiTargetResolutionError("missing_version")
    if journey_version < 1:
        raise KatkiTargetResolutionError("missing_version")
    return journey_version


async def resolve_katki_target(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: int | None,
) -> KatkiResolvedTarget:
    """
    Resolve slug + journeyVersion to the frozen Yansı the viewer is on.

    Does not fall back to the node's current version, another version, live
    chat, a step, or a scene/generation id.
    """
    version = _require_journey_version(journey_version)
    normalized = (slug or "").strip().lower()
    if not normalized:
        raise KatkiTargetResolutionError("not_found")

    node = await get_mirror_network_node_by_slug(db, normalized)
    if node is None:
        raise KatkiTargetResolutionError("not_found")
    if getattr(node, "artifact_kind", None) != ARTIFACT_KIND_JOURNEY_V1:
        raise KatkiTargetResolutionError("not_found")
    if getattr(node, "published_at", None) is None:
        raise KatkiTargetResolutionError("not_published")

    visibility = (getattr(node, "visibility", None) or "").strip().lower()
    if visibility == "private":
        raise KatkiTargetResolutionError("unpublished")
    if not is_direct_link_accessible(node):
        raise KatkiTargetResolutionError("hidden")

    internal = await get_frozen_journey_artifact(
        db,
        slug=node.slug,
        journey_version=version,
    )
    if internal is None or int(internal.get("journeyVersion") or 0) != version:
        raise KatkiTargetResolutionError("unknown_version")
    if not internal.get("replayReady"):
        raise KatkiTargetResolutionError("not_replay_ready")

    public = to_public_frozen_journey_artifact(internal)
    if public is None or int(public.get("journeyVersion") or 0) != version:
        raise KatkiTargetResolutionError("not_replay_ready")
    if str(public.get("slug") or "").strip().lower() != str(node.slug).strip().lower():
        raise KatkiTargetResolutionError("not_found")

    return KatkiResolvedTarget(
        slug=str(node.slug).strip().lower(),
        journey_version=version,
        node_id=UUID(str(node.id)),
        owner_user_id=UUID(str(node.user_id)),
    )
