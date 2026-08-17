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
    frozen_eza_snapshots_hash: str | None = None,
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
    from backend.services.mirror_network.frozen_step_eza import (
        compute_frozen_eza_snapshots_hash,
    )

    eza_hash = str(frozen_eza_snapshots_hash or "").strip() or compute_frozen_eza_snapshots_hash(
        selected_steps
    )
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
        "frozenEzaSnapshotsHash": eza_hash,
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
    frozen_eza_snapshots_hash: str | None = None,
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
    if frozen_eza_snapshots_hash and existing_frozen.get("frozenEzaSnapshotsHash"):
        if str(existing_frozen["frozenEzaSnapshotsHash"]) != str(
            frozen_eza_snapshots_hash
        ):
            _mismatch(
                "eza_snapshot_mismatch",
                "Frozen journeyVersion cannot change frozenEzaSnapshotsHash",
            )


def _internal_step_from_row(row: MirrorJourneyStep) -> dict[str, Any]:
    return {
        "stepIndex": int(row.step_index),
        "sourceOrder": row.source_order,
        "sourceUserMessageId": row.source_user_message_id,
        "sourceAssistantMessageId": row.source_assistant_message_id,
        "publicQuestion": row.public_question,
        "publicAnswer": row.public_answer,
        "questionHash": row.question_hash,
        "answerHash": row.answer_hash,
        "sanitizationFlags": row.sanitization_flags,
        "ezaSnapshot": getattr(row, "eza_snapshot", None),
    }


async def list_frozen_steps_for_version(
    db: AsyncSession,
    *,
    journey_slug: str,
    journey_version: int,
) -> list[dict[str, Any]]:
    """Internal step rows (includes provenance). Not for public HTTP responses."""
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
    return [_internal_step_from_row(row) for row in result.scalars().all()]


async def list_frozen_steps_for_versions_batch(
    db: AsyncSession,
    pairs: Sequence[tuple[str, int]],
) -> dict[tuple[str, int], list[dict[str, Any]]]:
    """
    One steps query for a page of slug+version pairs.

    Same row projection as list_frozen_steps_for_version.
    Does not change GET …/frozen.
    """
    wanted: set[tuple[str, int]] = set()
    slugs: list[str] = []
    seen_slugs: set[str] = set()
    for slug, version in pairs:
        key = ((slug or "").strip().lower(), int(version or 0))
        if not key[0] or key[1] < 1 or key in wanted:
            continue
        wanted.add(key)
        if key[0] not in seen_slugs:
            seen_slugs.add(key[0])
            slugs.append(key[0])
    out: dict[tuple[str, int], list[dict[str, Any]]] = {key: [] for key in wanted}
    if not slugs:
        return out
    result = await db.execute(
        select(MirrorJourneyStep)
        .where(MirrorJourneyStep.journey_slug.in_(slugs))
        .order_by(MirrorJourneyStep.step_index.asc())
    )
    for row in result.scalars().all():
        key = (str(row.journey_slug).strip().lower(), int(row.journey_version))
        if key not in wanted:
            continue
        out[key].append(_internal_step_from_row(row))
    return out


def project_public_frozen_steps(
    steps: Sequence[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """Allowlisted public step projection — stepIndex + public Q/A (+ EZA)."""
    from backend.services.mirror_network.frozen_step_eza import (
        project_public_frozen_step_eza,
    )

    public_steps: list[dict[str, Any]] = []
    for row in sorted(steps, key=lambda s: int(s.get("stepIndex") or 0)):
        question = str(row.get("publicQuestion") or "").strip()
        answer = str(row.get("publicAnswer") or "").strip()
        if not question or not answer:
            continue
        step: dict[str, Any] = {
            "stepIndex": int(row["stepIndex"]),
            "publicQuestion": question,
            "publicAnswer": answer,
        }
        eza_public = project_public_frozen_step_eza(
            row.get("ezaSnapshot") if isinstance(row.get("ezaSnapshot"), Mapping) else None
        )
        if eza_public:
            step["ezaSnapshot"] = eza_public
        public_steps.append(step)
    return public_steps


def steps_sequence_is_valid(
    steps: Sequence[Mapping[str, Any]],
    *,
    selected_count: int,
) -> bool:
    if selected_count < 6 or selected_count > 8:
        return False
    if len(steps) != selected_count:
        return False
    indices: list[int] = []
    for row in steps:
        try:
            idx = int(row.get("stepIndex"))
        except (TypeError, ValueError):
            return False
        question = str(row.get("publicQuestion") or "").strip()
        answer = str(row.get("publicAnswer") or "").strip()
        if not question or not answer:
            return False
        indices.append(idx)
    expected = list(range(1, selected_count + 1))
    return sorted(indices) == expected


def is_frozen_replay_ready(
    *,
    freeze_status: str | None,
    selected_count: int,
    steps: Sequence[Mapping[str, Any]],
    node_publicly_servable: bool,
) -> bool:
    if not node_publicly_servable:
        return False
    if str(freeze_status or "").strip().lower() != FREEZE_STATUS_FROZEN:
        return False
    return steps_sequence_is_valid(steps, selected_count=selected_count)


def to_public_frozen_journey_artifact(
    internal: Mapping[str, Any],
) -> dict[str, Any] | None:
    """
    Explicit allowlist public serializer (Phase 4.1).

    Never returns INTERNAL OBJECT minus blacklisted keys.
    """
    if not bool(internal.get("replayReady")):
        return None
    steps_raw = internal.get("selectedSteps") or internal.get("steps") or []
    if not isinstance(steps_raw, list):
        return None
    public_steps = project_public_frozen_steps(steps_raw)
    selected_count = int(internal.get("selectedCount") or 0)
    if not steps_sequence_is_valid(public_steps, selected_count=selected_count):
        return None
    author = str(internal.get("authorUserId") or "").strip()
    slug = str(internal.get("slug") or "").strip().lower()
    journey_id = str(internal.get("journeyId") or slug).strip().lower()
    if not author or not slug or not journey_id:
        return None
    parent = internal.get("parentSlug")
    parent_slug = str(parent).strip().lower() if parent else None
    return {
        "slug": slug,
        "journeyId": journey_id,
        "journeyVersion": int(internal.get("journeyVersion") or 1),
        "publicTitle": (
            str(internal.get("publicTitle")).strip()
            if internal.get("publicTitle") is not None
            else None
        )
        or None,
        "publicSummary": (
            str(internal.get("publicSummary")).strip()
            if internal.get("publicSummary") is not None
            else None
        )
        or None,
        "continuationContext": (
            str(internal.get("continuationContext")).strip()
            if internal.get("continuationContext") is not None
            else None
        )
        or None,
        "sceneImageUrl": (
            str(internal.get("sceneImageUrl")).strip()
            if internal.get("sceneImageUrl") is not None
            else None
        )
        or None,
        "authorUserId": author,
        "parentSlug": parent_slug or None,
        "selectedCount": selected_count,
        "steps": public_steps,
        "publishedAt": (
            str(internal.get("publishedAt")).strip()
            if internal.get("publishedAt") is not None
            else None
        )
        or None,
        "replayReady": True,
    }


def assemble_frozen_journey_artifact_from_loaded(
    node: MirrorNetworkNode,
    *,
    journey_version: int | None,
    steps: Sequence[Mapping[str, Any]],
) -> dict[str, Any] | None:
    """
    Same freeze/replay assembly as get_frozen_journey_artifact, without I/O.

    Used by the public single-slug path and by the internal batch helper.
    """
    from backend.services.mirror_network.safety_gate import evaluate_mirror_network_safety

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
    step_rows = [dict(row) for row in steps] if steps else []
    selected_count = int(frozen.get("selectedCount") or len(step_rows) or 0)
    safety_ok = evaluate_mirror_network_safety(node).passed
    replay_ready = is_frozen_replay_ready(
        freeze_status=str(frozen.get("freezeStatus") or getattr(node, "freeze_status", None)),
        selected_count=selected_count,
        steps=step_rows,
        node_publicly_servable=safety_ok,
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
        "selectedSteps": step_rows if replay_ready else [],
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
            "frozenEzaSnapshotsHash": frozen.get("frozenEzaSnapshotsHash"),
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


async def get_frozen_journey_artifact(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: int | None = None,
) -> dict[str, Any] | None:
    """
    Internal durable freeze package (includes provenance).

    Does not require JourneyGenerationRecord. Returns None if not frozen.
    Public HTTP must pass this through to_public_frozen_journey_artifact().
    """
    from backend.services.mirror_network.repository import get_mirror_network_node_by_slug

    node = await get_mirror_network_node_by_slug(db, slug)
    if node is None:
        return None
    node_version = int(getattr(node, "journey_version", None) or 1)
    version = int(journey_version) if journey_version is not None else node_version
    frozen = read_frozen_journey_artifact_from_private(
        _as_mapping(getattr(node, "private_payload", None)),
        journey_version=version,
    )
    if frozen is None and version == node_version and node_is_frozen(node):
        return None
    if frozen is None:
        return None
    if not node_is_frozen(node) and version == node_version:
        return None
    steps = await list_frozen_steps_for_version(
        db, journey_slug=node.slug, journey_version=version
    )
    return assemble_frozen_journey_artifact_from_loaded(
        node, journey_version=version, steps=steps
    )


async def get_public_frozen_journey_artifact(
    db: AsyncSession,
    *,
    slug: str,
    journey_version: int | None = None,
) -> dict[str, Any] | None:
    """Public allowlisted projection; None when not replay-ready."""
    internal = await get_frozen_journey_artifact(
        db, slug=slug, journey_version=journey_version
    )
    if internal is None:
        return None
    return to_public_frozen_journey_artifact(internal)


async def get_public_frozen_journey_artifact_batch(
    db: AsyncSession,
    items: Sequence[tuple[str, int]],
    *,
    nodes_by_slug: Mapping[str, MirrorNetworkNode] | None = None,
) -> dict[tuple[str, int], dict[str, Any]]:
    """
    Internal page loader for Phase 6.5/7.x evaluation.

    Reuses already-loaded nodes when provided, then one steps query.
    Same replayReady / selectedCount 6–8 gates as GET …/frozen via
    to_public_frozen_journey_artifact. Does not change that HTTP handler.
    """
    pairs: list[tuple[str, int]] = []
    seen: set[tuple[str, int]] = set()
    for slug, version in items:
        key = ((slug or "").strip().lower(), int(version or 0))
        if not key[0] or key[1] < 1 or key in seen:
            continue
        seen.add(key)
        pairs.append(key)
    if not pairs:
        return {}

    loaded: dict[str, MirrorNetworkNode] = {
        str(slug).strip().lower(): node
        for slug, node in (nodes_by_slug or {}).items()
        if node is not None
    }
    missing = sorted({slug for slug, _ in pairs if slug not in loaded})
    if missing:
        result = await db.execute(
            select(MirrorNetworkNode).where(MirrorNetworkNode.slug.in_(missing))
        )
        for node in result.scalars().all():
            loaded[str(node.slug).strip().lower()] = node

    steps_by_key = await list_frozen_steps_for_versions_batch(db, pairs)
    out: dict[tuple[str, int], dict[str, Any]] = {}
    for slug, version in pairs:
        node = loaded.get(slug)
        if node is None:
            continue
        internal = assemble_frozen_journey_artifact_from_loaded(
            node,
            journey_version=version,
            steps=steps_by_key.get((slug, version), []),
        )
        if internal is None:
            continue
        public = to_public_frozen_journey_artifact(internal)
        if public is None:
            continue
        out[(slug, version)] = public
    return out


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
            }
        )
    return out
