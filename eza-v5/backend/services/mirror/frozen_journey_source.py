# -*- coding: utf-8 -*-
"""FrozenJourneySource readiness contract (Phase 3.5 → Phase 4 input)."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from backend.services.mirror.journey_step_sanitization import sanitize_selected_journey_steps
from backend.services.mirror.journey_window_hashes import (
    compute_scoped_input_hash,
    compute_selected_steps_hash,
    compute_window_hash,
)


def build_frozen_journey_source(
    *,
    journey_id: str,
    journey_version: int,
    source_conversation_id: str | None,
    window_index: int,
    window_start: int,
    window_end: int,
    selected_steps: Sequence[Mapping[str, Any]],
    interpretation_hash: str | None = None,
    anchors_hash: str | None = None,
    public_landing_hash: str | None = None,
    mapped_prompt_hash: str | None = None,
    run_sanitization: bool = True,
) -> dict[str, Any]:
    """
    Authoritative package Phase 4 will persist. Sanitization may block publication.
    """
    steps = [dict(s) for s in selected_steps]
    server_window_hash = compute_window_hash(steps)
    server_scoped = compute_scoped_input_hash(
        journey_id=journey_id,
        journey_version=journey_version,
        source_conversation_id=source_conversation_id or "",
        window_index=window_index,
        window_start=window_start,
        window_end=window_end,
        steps=steps,
    )
    selected_hash = compute_selected_steps_hash(steps)

    sanitization: dict[str, Any] = {
        "status": "clean",
        "flags": [],
        "originalHashes": [],
        "publicHashes": [],
    }
    public_steps = steps
    if run_sanitization:
        sanitization = sanitize_selected_journey_steps(steps)
        if sanitization["status"] != "blocked":
            public_steps = sanitization["steps"]
            # Recompute public hashes after surgical sanitization.
            server_window_hash = compute_window_hash(public_steps)
            selected_hash = compute_selected_steps_hash(public_steps)
            server_scoped = compute_scoped_input_hash(
                journey_id=journey_id,
                journey_version=journey_version,
                source_conversation_id=source_conversation_id or "",
                window_index=window_index,
                window_start=window_start,
                window_end=window_end,
                steps=public_steps,
            )

    return {
        "journeyId": str(journey_id).strip().lower(),
        "journeyVersion": int(journey_version),
        "sourceConversationId": source_conversation_id,
        "windowIndex": int(window_index),
        "windowStart": int(window_start),
        "windowEnd": int(window_end),
        "selectedSteps": public_steps,
        "serverWindowHash": server_window_hash,
        "serverScopedInputHash": server_scoped,
        "selectedStepsHash": selected_hash,
        "sanitizationStatus": sanitization.get("status"),
        "sanitizationFlags": sanitization.get("flags") or [],
        "originalStepHashes": sanitization.get("originalHashes") or [],
        "publicStepHashes": sanitization.get("publicHashes") or [],
        "interpretationHash": interpretation_hash,
        "anchorsHash": anchors_hash,
        "publicLandingHash": public_landing_hash,
        "mappedPromptHash": mapped_prompt_hash,
        "publicationBlocked": sanitization.get("status") == "blocked",
        "blockedReason": sanitization.get("blockedReason"),
    }
