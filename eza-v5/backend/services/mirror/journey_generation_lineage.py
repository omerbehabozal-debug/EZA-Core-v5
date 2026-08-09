# -*- coding: utf-8 -*-
"""JourneyGenerationLineage — prepare→publish boundary (Phase 3.6)."""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from fastapi import HTTPException, status

from backend.services.mirror.journey_window_hashes import (
    compute_scoped_input_hash,
    compute_selected_steps_hash,
    compute_window_hash,
)
from backend.services.mirror_network.journey_window_contract import (
    normalize_selected_journey_steps,
    validate_journey_window_identity,
)

JOURNEY_GENERATION_LINEAGE_VERSION = "journey_generation_lineage_v1"


def build_journey_generation_lineage(
    *,
    journey_id: str,
    journey_version: int,
    source_conversation_id: str,
    window_index: int,
    window_start: int,
    window_end: int,
    window_hash: str,
    scoped_input_hash: str,
    selected_steps_hash: str,
    generation_id: str,
    interpretation_hash: str | None = None,
    anchors_hash: str | None = None,
    public_landing_hash: str | None = None,
    mapped_prompt_hash: str | None = None,
    scene_asset_id: str | None = None,
    parent_journey_id: str | None = None,
) -> dict[str, Any]:
    return {
        "contractVersion": JOURNEY_GENERATION_LINEAGE_VERSION,
        "journeyId": str(journey_id).strip().lower(),
        "journeyVersion": int(journey_version),
        "sourceConversationId": str(source_conversation_id).strip(),
        "parentJourneyId": (str(parent_journey_id).strip() or None)
        if parent_journey_id
        else None,
        "windowIndex": int(window_index),
        "windowStart": int(window_start),
        "windowEnd": int(window_end),
        "windowHash": str(window_hash),
        "scopedInputHash": str(scoped_input_hash),
        "selectedStepsHash": str(selected_steps_hash),
        "interpretationHash": interpretation_hash,
        "anchorsHash": anchors_hash,
        "publicLandingHash": public_landing_hash,
        "mappedPromptHash": mapped_prompt_hash,
        "generationId": str(generation_id).strip(),
        "sceneAssetId": scene_asset_id,
    }


def _lineage_mismatch(reason: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "code": "journey_publish_lineage_mismatch",
            "reason": reason,
            "message": message,
        },
    )


def _norm(value: Any) -> str:
    return str(value or "").strip()


def recompute_hashes_from_steps(
    *,
    journey_id: str,
    journey_version: int,
    source_conversation_id: str,
    window_index: int,
    window_start: int,
    window_end: int,
    steps: Sequence[Mapping[str, Any]],
) -> dict[str, str]:
    ordered = normalize_selected_journey_steps(list(steps))
    validate_journey_window_identity(
        window_index=window_index,
        window_start=window_start,
        window_end=window_end,
        steps=ordered,
    )
    return {
        "windowHash": compute_window_hash(ordered),
        "selectedStepsHash": compute_selected_steps_hash(ordered),
        "scopedInputHash": compute_scoped_input_hash(
            journey_id=journey_id,
            journey_version=journey_version,
            source_conversation_id=source_conversation_id,
            window_index=window_index,
            window_start=window_start,
            window_end=window_end,
            steps=ordered,
        ),
    }


def validate_publish_journey_lineage(
    *,
    request_conversation_id: str | None,
    journey_id: str,
    journey_version: int,
    source_conversation_id: str | None,
    window_index: int,
    window_start: int,
    window_end: int,
    selected_steps: Sequence[Mapping[str, Any]],
    claimed: Mapping[str, Any],
    existing_published_version: int | None,
    existing_selected_steps_hash: str | None = None,
    flat_overrides: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Fail-closed equality check before Journey V1 DB write.
    Returns authoritative recomputed hash package + resolved publish version.
    """
    conv = _norm(request_conversation_id)
    source = _norm(source_conversation_id)
    jid = _norm(journey_id).lower()
    claimed_jid = _norm(claimed.get("journeyId")).lower()
    claimed_conv = _norm(
        claimed.get("sourceConversationId") or claimed.get("conversationId")
    )

    if not jid or (claimed_jid and claimed_jid != jid):
        raise _lineage_mismatch("journey_mismatch", "journeyId does not match lineage")
    if claimed_conv and conv and claimed_conv != conv:
        raise _lineage_mismatch(
            "conversation_mismatch", "sourceConversationId does not match conversation"
        )
    if source and conv and source != conv:
        raise _lineage_mismatch(
            "conversation_mismatch",
            "Publish sourceConversationId must equal conversationId",
        )
    if source and claimed_conv and source != claimed_conv:
        raise _lineage_mismatch(
            "conversation_mismatch", "Claimed conversation does not match steps scope"
        )

    # Flat body fields must not disagree with nested generation lineage.
    if flat_overrides:
        for key, reason in (
            ("windowHash", "window_mismatch"),
            ("scopedInputHash", "steps_hash_mismatch"),
            ("selectedStepsHash", "steps_hash_mismatch"),
            ("interpretationHash", "interpretation_mismatch"),
            ("publicLandingHash", "landing_mismatch"),
            ("mappedPromptHash", "prompt_mismatch"),
            ("generationId", "generation_mismatch"),
            ("journeyVersion", "version_mismatch"),
        ):
            flat_val = flat_overrides.get(key)
            claimed_val = claimed.get(key)
            if flat_val is None or claimed_val is None:
                continue
            if _norm(flat_val) != _norm(claimed_val):
                raise _lineage_mismatch(
                    reason,
                    f"Publish {key} disagrees with journeyGenerationLineage",
                )

    try:
        claimed_version = int(claimed.get("journeyVersion"))
    except (TypeError, ValueError) as exc:
        raise _lineage_mismatch(
            "version_mismatch", "journeyVersion missing on generation lineage"
        ) from exc

    if int(journey_version) != claimed_version:
        raise _lineage_mismatch(
            "version_mismatch",
            "Publish journeyVersion must equal generation lineage journeyVersion",
        )

    if existing_published_version is None:
        if claimed_version != 1:
            raise _lineage_mismatch(
                "version_mismatch",
                "New journey must publish journeyVersion=1",
            )
        publish_version = 1
        identical_retry = False
    else:
        current = int(existing_published_version)
        if claimed_version == current:
            identical_retry = True
            publish_version = current
        elif claimed_version == current + 1:
            identical_retry = False
            publish_version = claimed_version
        else:
            raise _lineage_mismatch(
                "version_mismatch",
                f"Stale journey version {claimed_version}; current published is {current}",
            )

    claimed_window_index = claimed.get("windowIndex")
    claimed_window_start = claimed.get("windowStart")
    claimed_window_end = claimed.get("windowEnd")
    if (
        claimed_window_index is not None
        and int(claimed_window_index) != int(window_index)
    ) or (
        claimed_window_start is not None
        and int(claimed_window_start) != int(window_start)
    ) or (
        claimed_window_end is not None and int(claimed_window_end) != int(window_end)
    ):
        raise _lineage_mismatch("window_mismatch", "Window identity does not match lineage")

    recomputed = recompute_hashes_from_steps(
        journey_id=jid,
        journey_version=publish_version,
        source_conversation_id=source or conv,
        window_index=window_index,
        window_start=window_start,
        window_end=window_end,
        steps=selected_steps,
    )

    for key, reason in (
        ("windowHash", "window_mismatch"),
        ("scopedInputHash", "steps_hash_mismatch"),
        ("selectedStepsHash", "steps_hash_mismatch"),
    ):
        claimed_val = _norm(claimed.get(key))
        if not claimed_val:
            raise _lineage_mismatch(reason, f"{key} required on generation lineage")
        if claimed_val != recomputed[key]:
            raise _lineage_mismatch(
                reason, f"{key} does not match server recompute from selectedSteps"
            )

    for key, reason in (
        ("interpretationHash", "interpretation_mismatch"),
        ("publicLandingHash", "landing_mismatch"),
        ("mappedPromptHash", "prompt_mismatch"),
        ("generationId", "generation_mismatch"),
    ):
        claimed_val = _norm(claimed.get(key))
        if not claimed_val:
            raise _lineage_mismatch(reason, f"{key} required on generation lineage")

    if identical_retry:
        existing_hash = _norm(existing_selected_steps_hash)
        if existing_hash and existing_hash != recomputed["selectedStepsHash"]:
            raise _lineage_mismatch(
                "steps_hash_mismatch",
                "Same journeyVersion cannot replace steps with a different selectedStepsHash",
            )

    return {
        "publishVersion": publish_version,
        "identicalRetry": identical_retry,
        **recomputed,
        "interpretationHash": _norm(claimed.get("interpretationHash")),
        "anchorsHash": _norm(claimed.get("anchorsHash")) or None,
        "publicLandingHash": _norm(claimed.get("publicLandingHash")),
        "mappedPromptHash": _norm(claimed.get("mappedPromptHash")),
        "generationId": _norm(claimed.get("generationId")),
        "sceneAssetId": _norm(claimed.get("sceneAssetId")) or None,
    }


def validate_narrative_alignment_binding(
    *,
    claimed_lineage: Mapping[str, Any],
    alignment: Mapping[str, Any] | None,
) -> None:
    if not alignment:
        return
    for key, reason in (
        ("generationId", "generation_mismatch"),
        ("journeyId", "journey_mismatch"),
        ("journeyVersion", "version_mismatch"),
        ("windowHash", "window_mismatch"),
        ("publicLandingHash", "landing_mismatch"),
    ):
        a = _norm(alignment.get(key))
        c = _norm(claimed_lineage.get(key))
        if a and c and a != c:
            raise _lineage_mismatch(
                reason,
                f"Narrative Alignment {key} does not match generation lineage",
            )
    scene_a = _norm(alignment.get("sceneAssetId"))
    scene_c = _norm(claimed_lineage.get("sceneAssetId"))
    if scene_a and scene_c and scene_a != scene_c:
        raise _lineage_mismatch(
            "generation_mismatch",
            "Narrative Alignment sceneAssetId does not match generation lineage",
        )
