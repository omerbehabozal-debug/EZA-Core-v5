# -*- coding: utf-8 -*-
"""Journey V1 Phase 3 — scoped semantic package validation (fail-closed)."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from fastapi import HTTPException, status

from backend.services.mirror_network.journey_window_contract import (
    JOURNEY_STEP_COUNT,
    normalize_selected_journey_steps,
    validate_journey_window_identity,
)

JOURNEY_SEMANTIC_SCOPE_V1 = "journey_window_v1"


def _scope_invalid(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "code": "journey_semantic_scope_invalid",
            "message": message,
        },
    )


def _as_mapping(value: Any) -> Mapping[str, Any] | None:
    if isinstance(value, Mapping):
        return value
    return None


def validate_journey_semantic_scope(
    *,
    journey_scope: Mapping[str, Any] | None,
    messages: Sequence[Mapping[str, Any]] | None,
) -> dict[str, Any]:
    """
    When journey semantic scope is present, require a valid window + messages that
    match the frozen selectedSteps exactly. Never fall back to full-chat meaning.
    """
    scope = _as_mapping(journey_scope)
    if scope is None:
        raise _scope_invalid("journeySemanticScope is required for Journey V1 meaning")

    semantic_scope = str(scope.get("semanticScope") or "").strip()
    if semantic_scope != JOURNEY_SEMANTIC_SCOPE_V1:
        raise _scope_invalid(
            f"semanticScope must be {JOURNEY_SEMANTIC_SCOPE_V1}"
        )

    journey_id = str(scope.get("journeyId") or "").strip().lower()
    if not journey_id:
        raise _scope_invalid("journeyId is required on journeySemanticScope")

    raw_steps = scope.get("selectedSteps")
    steps = normalize_selected_journey_steps(
        raw_steps if isinstance(raw_steps, list) else None
    )
    window_index, window_start, window_end = validate_journey_window_identity(
        window_index=scope.get("windowIndex"),
        window_start=scope.get("windowStart"),
        window_end=scope.get("windowEnd"),
        steps=steps,
    )

    rows = list(messages or [])
    expected_len = JOURNEY_STEP_COUNT * 2
    if len(rows) != expected_len:
        raise _scope_invalid(
            f"Scoped messages must contain exactly {expected_len} turns; got {len(rows)}"
        )

    for i, step in enumerate(steps):
        user_row = rows[i * 2]
        asst_row = rows[i * 2 + 1]
        if not isinstance(user_row, Mapping) or not isinstance(asst_row, Mapping):
            raise _scope_invalid("Scoped messages must be objects")
        if str(user_row.get("role") or "") != "user":
            raise _scope_invalid(f"Expected user turn at message index {i * 2}")
        if str(asst_row.get("role") or "") != "assistant":
            raise _scope_invalid(f"Expected assistant turn at message index {i * 2 + 1}")
        if str(user_row.get("text") or "").strip() != str(step["publicQuestion"]).strip():
            raise _scope_invalid(
                f"Scoped message Q{step['stepIndex']} does not match selectedSteps"
            )
        if str(asst_row.get("text") or "").strip() != str(step["publicAnswer"]).strip():
            raise _scope_invalid(
                f"Scoped message A{step['stepIndex']} does not match selectedSteps"
            )

    window_hash = str(scope.get("windowHash") or "").strip() or None
    scoped_input_hash = str(scope.get("scopedInputHash") or "").strip() or None
    journey_version = scope.get("journeyVersion")
    try:
        journey_version_i = int(journey_version) if journey_version is not None else 1
    except (TypeError, ValueError):
        journey_version_i = 1

    return {
        "semanticScope": JOURNEY_SEMANTIC_SCOPE_V1,
        "journeyId": journey_id,
        "journeyVersion": journey_version_i,
        "sourceConversationId": str(scope.get("sourceConversationId") or "").strip()
        or None,
        "parentJourneyId": str(scope.get("parentJourneyId") or "").strip() or None,
        "windowIndex": window_index,
        "windowStart": window_start,
        "windowEnd": window_end,
        "windowHash": window_hash,
        "scopedInputHash": scoped_input_hash,
        "selectedSteps": steps,
    }


def append_journey_scope_key(base_scope_key: Optional[str], scope: Mapping[str, Any]) -> str:
    """Isolate prepare cache by journey window fingerprint."""
    base = (base_scope_key or "anonymous").strip() or "anonymous"
    journey_id = str(scope.get("journeyId") or "unknown").strip().lower()
    version = int(scope.get("journeyVersion") or 1)
    window_hash = str(scope.get("windowHash") or scope.get("scopedInputHash") or "nohash")
    return f"{base}|journey:{journey_id}:v{version}:{window_hash[:48]}"
