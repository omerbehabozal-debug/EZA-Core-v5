# -*- coding: utf-8 -*-
"""Phase 4 — durable FrozenJourneyArtifact seal (publish-time freeze).

Reuses mirror_network_nodes + mirror_journey_steps as the durable store.
The freeze seal lives on the node (columns + private_payload.frozenJourneyArtifact).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping, Optional, Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import (
    ARTIFACT_KIND_JOURNEY_V1,
    MirrorJourneyStep,
    MirrorNetworkNode,
)
from backend.services.mirror.frozen_journey_source import build_frozen_journey_source

FREEZE_STATUS_FROZEN = "frozen"
FREEZE_STATUS_NON_FROZEN = "non_frozen"

FROZEN_JOURNEY_ARTIFACT_CONTRACT = "frozen_journey_artifact_v1"


def _as_mapping(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, Mapping) else {}


def build_durable_frozen_journey_artifact(
    *,
    journey_id: str,
    journey_version: int,
    source_conversation_id: str | None,
    author_user_id: str,
    parent_slug: str | None,
    block_index: int | None,
    block_start: int | None,
    block_end: int | None,
    source_block_hash: str | None,
    selected_steps: Sequence[Mapping[str, Any]],
    public_title: str,
    public_summary: str,
    continuation_context: str | None,
    public_landing_hash: str,
    public_landing_contract_version: str | None,
    scene_asset_id: str | None,
    scene_image_url: str | None,
    generation_id: str,
    selected_steps_hash: str,
    scoped_input_hash: str | None,
    window_hash: str | None,
    interpretation_hash: str | None,
    anchors_hash: str | None,
    mapped_prompt_hash: str | None,
    narrative_alignment: Mapping[str, Any] | None,
    sanitization_status: str | None,
    sanitization_flags: Sequence[Any] | None,
    original_step_hashes: Sequence[Mapping[str, Any]] | None,
    public_step_hashes: Sequence[Mapping[str, Any]] | None,
    frozen_at: datetime | None = None,
) -> dict[str, Any]:
    """
    Canonical durable freeze package.

    Author policy: reference-only (authorUserId). Display name is resolved at
    read time from the current public profile model — not snapshotted here.
    """
    now = frozen_at or datetime.now(timezone.utc)
    source = build_frozen_journey_source(
        journey_id=journey_id,
        journey_version=journey_version,
        source_conversation_id=source_conversation_id,
        window_index=int(block_index if block_index is not None else 0),
        window_start=int(block_start if block_start is not None else 0),
        window_end=int(block_end if block_end is not None else 7),
        selected_steps=selected_steps,
        interpretation_hash=interpretation_hash,
        anchors_hash=anchors_hash,
        public_landing_hash=public_landing_hash,
        mapped_prompt_hash=mapped_prompt_hash,
        run_sanitization=False,  # already sanitized at publish boundary
    )
    selected_count = len(source.get("selectedSteps") or selected_steps)
    return {
        "contractVersion": FROZEN_JOURNEY_ARTIFACT_CONTRACT,
        "freezeStatus": FREEZE_STATUS_FROZEN,
        "journeyId": str(journey_id).strip().lower(),
        "journeyVersion": int(journey_version),
        "slug": str(journey_id).strip().lower(),
        "artifactKind": ARTIFACT_KIND_JOURNEY_V1,
        "sourceConversationId": source_conversation_id,
        "authorUserId": str(author_user_id),
        "parentJourneyId": (parent_slug or None),
        "parentSlug": (parent_slug or None),
        "blockIndex": block_index,
        "blockStart": block_start,
        "blockEnd": block_end,
        "sourceBlockHash": source_block_hash,
        "selectedCount": selected_count,
        "selectedStepsHash": selected_steps_hash or source.get("selectedStepsHash"),
        "scopedInputHash": scoped_input_hash or source.get("serverScopedInputHash"),
        "windowHash": window_hash or source.get("serverWindowHash"),
        "interpretationHash": interpretation_hash,
        "anchorsHash": anchors_hash,
        "mappedPromptHash": mapped_prompt_hash,
        "publicLanding": {
            "publicTitle": public_title,
            "publicSummary": public_summary,
            "continuationContext": continuation_context,
            "contractVersion": public_landing_contract_version
            or "mirror-public-landing-v1",
            "publicLandingHash": public_landing_hash,
        },
        "publicLandingHash": public_landing_hash,
        "sceneAssetId": scene_asset_id,
        "sceneImageUrl": scene_image_url,
        "generationId": generation_id,
        "narrativeAlignment": dict(narrative_alignment or {}),
        "sanitization": {
            "status": sanitization_status or source.get("sanitizationStatus") or "clean",
            "flags": list(sanitization_flags or source.get("sanitizationFlags") or []),
            "originalStepHashes": list(
                original_step_hashes or source.get("originalStepHashes") or []
            ),
            "publicStepHashes": list(
                public_step_hashes or source.get("publicStepHashes") or []
            ),
        },
        "frozenAt": now.isoformat(),
        "publishedAt": now.isoformat(),
    }


def attach_frozen_journey_artifact(
    private_payload: Mapping[str, Any] | None,
    frozen: Mapping[str, Any],
    *,
    archive_previous: bool = True,
) -> dict[str, Any]:
    """
    Persist current freeze seal and archive prior version seals.

    Version history lives under intelligenceBrief.frozenJourneyVersions[str(v)]
    so Option A (slug → latest node) can still address older journeyVersions
    for audit/replay without overwriting durable v1 landing/scene provenance.
    """
    private = dict(private_payload or {})
    brief = _as_mapping(private.get("intelligenceBrief"))
    versions = _as_mapping(brief.get("frozenJourneyVersions"))
    if archive_previous:
        prior = brief.get("frozenJourneyArtifact")
        if isinstance(prior, Mapping) and prior.get("freezeStatus") == FREEZE_STATUS_FROZEN:
            prior_version = prior.get("journeyVersion")
            if prior_version is not None:
                key = str(int(prior_version))
                incoming_version = frozen.get("journeyVersion")
                # Do not clobber an already-archived seal for a different version.
                if key not in versions or (
                    incoming_version is not None and int(incoming_version) == int(prior_version)
                ):
                    versions[key] = dict(prior)
    version_key = str(int(frozen.get("journeyVersion") or 1))
    versions[version_key] = dict(frozen)
    brief["frozenJourneyVersions"] = versions
    brief["frozenJourneyArtifact"] = dict(frozen)
    brief["freezeStatus"] = FREEZE_STATUS_FROZEN
    private["intelligenceBrief"] = brief
    return private


def read_frozen_journey_artifact_from_private(
    private_payload: Mapping[str, Any] | None,
    *,
    journey_version: int | None = None,
) -> dict[str, Any] | None:
    private = _as_mapping(private_payload)
    brief = _as_mapping(private.get("intelligenceBrief"))
    versions = _as_mapping(brief.get("frozenJourneyVersions"))
    if journey_version is not None:
        keyed = versions.get(str(int(journey_version)))
        if isinstance(keyed, Mapping) and keyed.get("freezeStatus") == FREEZE_STATUS_FROZEN:
            return dict(keyed)
        current = brief.get("frozenJourneyArtifact")
        if (
            isinstance(current, Mapping)
            and current.get("freezeStatus") == FREEZE_STATUS_FROZEN
            and int(current.get("journeyVersion") or 0) == int(journey_version)
        ):
            return dict(current)
        return None
    frozen = brief.get("frozenJourneyArtifact")
    if isinstance(frozen, Mapping) and frozen.get("freezeStatus") == FREEZE_STATUS_FROZEN:
        return dict(frozen)
    return None


def node_is_frozen(node: MirrorNetworkNode) -> bool:
    status = (getattr(node, "freeze_status", None) or "").strip().lower()
    if status == FREEZE_STATUS_FROZEN:
        return True
    return read_frozen_journey_artifact_from_private(
        _as_mapping(getattr(node, "private_payload", None))
    ) is not None


def assert_frozen_content_immutable(
    *,
    existing_frozen: Mapping[str, Any],
    selected_steps_hash: str | None,
    public_landing_hash: str | None,
    scene_asset_id: str | None,
    generation_id: str | None,
) -> None:
    """Same journeyVersion may only retry identical verified content."""
    from fastapi import HTTPException, status

    def _mismatch(reason: str, message: str) -> None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "journey_frozen_immutable",
                "reason": reason,
                "message": message,
            },
        )

    if selected_steps_hash and existing_frozen.get("selectedStepsHash"):
        if str(existing_frozen["selectedStepsHash"]) != str(selected_steps_hash):
            _mismatch(
                "selected_steps_hash_mismatch",
                "Frozen journeyVersion cannot change selectedStepsHash",
            )
    if public_landing_hash and existing_frozen.get("publicLandingHash"):
        if str(existing_frozen["publicLandingHash"]) != str(public_landing_hash):
            _mismatch(
                "public_landing_hash_mismatch",
                "Frozen journeyVersion cannot change publicLandingHash",
            )
    if scene_asset_id and existing_frozen.get("sceneAssetId"):
        if str(existing_frozen["sceneAssetId"]) != str(scene_asset_id):
            _mismatch(
                "scene_asset_mismatch",
                "Frozen journeyVersion cannot change sceneAssetId",
            )
    if generation_id and existing_frozen.get("generationId"):
        if str(existing_frozen["generationId"]) != str(generation_id):
            _mismatch(
                "generation_id_mismatch",
                "Frozen journeyVersion cannot change generationId",
            )


async def list_frozen_steps_for_version(
    db: AsyncSession,
    *,
    journey_slug: str,
    journey_version: int,
) -> list[dict[str, Any]]:
    slug = (journey_slug or "").strip().lower()
    version = int(journey_version or 1)
    if not slug:
        return []
    result = await db.execute(
        select(MirrorJourneyStep)
        .where(
            MirrorJourneyStep.journey_slug == slug,
            MirrorJourneyStep.journey_version == version,
        )
        .order_by(MirrorJourneyStep.step_index.asc())
    )
    rows = list(result.scalars().all())
    out: list[dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "stepIndex": int(row.step_index),
                "sourceOrder": row.source_order,
                "sourceUserMessageId": row.source_user_message_id,
                "sourceAssistantMessageId": row.source_assistant_message_id,
                "publicQuestion": row.public_question,
                "publicAnswer": row.public_answer,
                "questionHash": row.question_hash,
                "answerHash": row.answer_hash,
                "sanitizationFlags": row.sanitization_flags,
            }
        )
    return out


async def get_frozen_journey_artifact(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: int | None = None,
) -> dict[str, Any] | None:
    """
    Durable public+steps freeze package.

    Does not require JourneyGenerationRecord. Returns None if not frozen.

    Option A: omitting journey_version returns the node's current published
    version. Explicit journey_version may resolve an archived frozen seal for
    an older version (steps + landing/scene provenance) when present.
    """
    from backend.services.mirror_network.repository import get_mirror_network_node_by_slug

    node = await get_mirror_network_node_by_slug(db, slug)
    if node is None:
        return None
    if getattr(node, "artifact_kind", None) != ARTIFACT_KIND_JOURNEY_V1:
        return None

    node_version = int(getattr(node, "journey_version", None) or 1)
    version = int(journey_version) if journey_version is not None else node_version

    frozen = read_frozen_journey_artifact_from_private(
        _as_mapping(getattr(node, "private_payload", None)),
        journey_version=version,
    )
    if frozen is None and version == node_version and node_is_frozen(node):
        # Legacy: freeze_status set but seal missing — still not replay-ready.
        return None
    if frozen is None:
        return None
    if not node_is_frozen(node) and version == node_version:
        return None

    public = _as_mapping(getattr(node, "public_payload", None))
    landing = _as_mapping(frozen.get("publicLanding"))
    steps = await list_frozen_steps_for_version(
        db, journey_slug=node.slug, journey_version=version
    )
    selected_count = int(frozen.get("selectedCount") or len(steps) or 0)
    # Replay-ready only when freezeStatus is frozen AND 6–8 steps exist.
    replay_ready = (
        str(frozen.get("freezeStatus") or "").strip().lower() == FREEZE_STATUS_FROZEN
        and 6 <= selected_count <= 8
        and len(steps) == selected_count
    )
    return {
        "contractVersion": frozen.get("contractVersion")
        or FROZEN_JOURNEY_ARTIFACT_CONTRACT,
        "freezeStatus": FREEZE_STATUS_FROZEN if replay_ready else FREEZE_STATUS_NON_FROZEN,
        "replayReady": replay_ready,
        "artifactId": str(node.id),
        "journeyId": node.slug,
        "journeyVersion": version,
        "slug": node.slug,
        "artifactKind": ARTIFACT_KIND_JOURNEY_V1,
        "sourceConversationId": frozen.get("sourceConversationId")
        or getattr(node, "conversation_id", None),
        "authorUserId": frozen.get("authorUserId") or str(node.user_id),
        "parentSlug": frozen.get("parentSlug") or getattr(node, "parent_slug", None),
        "parentJourneyId": frozen.get("parentJourneyId")
        or getattr(node, "parent_slug", None),
        "blockIndex": frozen.get("blockIndex")
        if frozen.get("blockIndex") is not None
        else getattr(node, "window_index", None),
        "blockStart": frozen.get("blockStart")
        if frozen.get("blockStart") is not None
        else getattr(node, "window_start", None),
        "blockEnd": frozen.get("blockEnd")
        if frozen.get("blockEnd") is not None
        else getattr(node, "window_end", None),
        "selectedCount": selected_count,
        "selectedSteps": steps if replay_ready else [],
        "publicTitle": landing.get("publicTitle")
        or (public.get("publicTitle") if version == node_version else None)
        or (node.card_title if version == node_version else None),
        "publicSummary": landing.get("publicSummary")
        or (public.get("publicSummary") if version == node_version else None)
        or (public.get("curiosityContext") if version == node_version else None),
        "continuationContext": landing.get("continuationContext")
        or (public.get("continuationContext") if version == node_version else None),
        "sceneAssetId": frozen.get("sceneAssetId"),
        "sceneImageUrl": frozen.get("sceneImageUrl")
        or (node.scene_image_url if version == node_version else None),
        "publishedAt": frozen.get("publishedAt")
        or (node.published_at.isoformat() if node.published_at else None),
        "frozenAt": frozen.get("frozenAt")
        or (
            getattr(node, "frozen_at", None).isoformat()
            if getattr(node, "frozen_at", None)
            else None
        ),
        "integrity": {
            "sourceBlockHash": frozen.get("sourceBlockHash"),
            "selectedStepsHash": frozen.get("selectedStepsHash"),
            "scopedInputHash": frozen.get("scopedInputHash"),
            "windowHash": frozen.get("windowHash"),
            "interpretationHash": frozen.get("interpretationHash"),
            "anchorsHash": frozen.get("anchorsHash"),
            "mappedPromptHash": frozen.get("mappedPromptHash"),
            "publicLandingHash": frozen.get("publicLandingHash"),
            "generationId": frozen.get("generationId"),
            "sceneAssetId": frozen.get("sceneAssetId"),
            "journeyVersion": version,
        },
        "sanitization": frozen.get("sanitization") or {},
        "narrativeAlignment": frozen.get("narrativeAlignment") or {},
    }


async def list_published_journey_nodes_for_conversation(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: str,
) -> list[MirrorNetworkNode]:
    """Owner rehydration: durable published journey_v1 nodes for a conversation."""
    from backend.services.mirror_network.repository import list_journey_nodes_for_conversation

    nodes = await list_journey_nodes_for_conversation(
        db, user_id=user_id, conversation_id=conversation_id
    )
    return [n for n in nodes if node_is_frozen(n) or getattr(n, "published_at", None)]


async def list_owner_published_journeys_for_conversation(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: str,
) -> list[dict[str, Any]]:
    """Minimal Ayna rehydration: published journey identities from durable nodes."""
    nodes = await list_published_journey_nodes_for_conversation(
        db, user_id=user_id, conversation_id=conversation_id
    )
    out: list[dict[str, Any]] = []
    for node in nodes:
        frozen = read_frozen_journey_artifact_from_private(
            _as_mapping(getattr(node, "private_payload", None))
        ) or {}
        public = _as_mapping(getattr(node, "public_payload", None))
        landing = _as_mapping(frozen.get("publicLanding"))
        out.append(
            {
                "slug": node.slug,
                "journeyId": node.slug,
                "journeyVersion": int(getattr(node, "journey_version", None) or 1),
                "artifactKind": getattr(node, "artifact_kind", None),
                "freezeStatus": getattr(node, "freeze_status", None)
                or frozen.get("freezeStatus")
                or FREEZE_STATUS_NON_FROZEN,
                "publicTitle": landing.get("publicTitle")
                or public.get("publicTitle")
                or node.card_title,
                "publicSummary": landing.get("publicSummary")
                or public.get("publicSummary"),
                "continuationContext": landing.get("continuationContext")
                or public.get("continuationContext"),
                "sceneImageUrl": frozen.get("sceneImageUrl") or node.scene_image_url,
                "sceneAssetId": frozen.get("sceneAssetId"),
                "parentSlug": frozen.get("parentSlug") or getattr(node, "parent_slug", None),
                "authorUserId": frozen.get("authorUserId") or str(node.user_id),
                "selectedCount": frozen.get("selectedCount"),
                "publishedAt": (
                    node.published_at.isoformat() if node.published_at else None
                ),
                "frozenAt": (
                    getattr(node, "frozen_at", None).isoformat()
                    if getattr(node, "frozen_at", None)
                    else frozen.get("frozenAt")
                ),
                "sourceConversationId": getattr(node, "conversation_id", None),
            }
        )
    return out
