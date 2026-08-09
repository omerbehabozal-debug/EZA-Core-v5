# -*- coding: utf-8 -*-
"""Journey V1 Phase 3/3.5 — scoped semantic package validation (fail-closed)."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from fastapi import HTTPException, status

from backend.services.mirror.journey_version import resolve_authoritative_journey_version
from backend.services.mirror.journey_window_hashes import (
    attach_step_content_hashes,
    compute_scoped_input_hash,
    compute_selected_steps_hash,
    compute_window_hash,
)
from backend.services.mirror_network.journey_window_contract import (
    JOURNEY_STEP_COUNT,
    normalize_selected_journey_steps,
    validate_journey_window_identity,
)

JOURNEY_SEMANTIC_SCOPE_V1 = "journey_window_v1"


def _scope_invalid(message: str, *, reason: str | None = None) -> HTTPException:
    detail: dict[str, Any] = {
        "code": "journey_semantic_scope_invalid",
        "message": message,
    }
    if reason:
        detail["reason"] = reason
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=detail,
    )


def _as_mapping(value: Any) -> Mapping[str, Any] | None:
    if isinstance(value, Mapping):
        return value
    return None


def _optional_client_hash(scope: Mapping[str, Any], key: str) -> str | None:
    raw = scope.get(key)
    if raw is None:
        return None
    text = str(raw).strip()
    return text or None


def validate_journey_semantic_scope(
    *,
    journey_scope: Mapping[str, Any] | None,
    messages: Sequence[Mapping[str, Any]] | None,
    existing_published_version: int | None = None,
) -> dict[str, Any]:
    """
    When journey semantic scope is present, require a valid window + messages that
    match the frozen selectedSteps exactly. Server recomputes hashes (authority).
    Never fall back to full-chat meaning.
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

    client_version_raw = scope.get("journeyVersion")
    try:
        client_version = (
            int(client_version_raw) if client_version_raw is not None else None
        )
    except (TypeError, ValueError):
        client_version = None

    journey_version = resolve_authoritative_journey_version(
        existing_published_version=existing_published_version,
        client_version=client_version,
    )

    source_conversation_id = (
        str(scope.get("sourceConversationId") or "").strip() or None
    )

    steps_with_hashes = attach_step_content_hashes(steps)
    server_window_hash = compute_window_hash(steps_with_hashes)
    server_selected_steps_hash = compute_selected_steps_hash(steps_with_hashes)
    server_scoped_input_hash = compute_scoped_input_hash(
        journey_id=journey_id,
        journey_version=journey_version,
        source_conversation_id=source_conversation_id or "",
        window_index=window_index,
        window_start=window_start,
        window_end=window_end,
        steps=steps_with_hashes,
        semantic_scope=JOURNEY_SEMANTIC_SCOPE_V1,
    )

    client_window_hash = _optional_client_hash(scope, "windowHash")
    client_scoped_input_hash = _optional_client_hash(scope, "scopedInputHash")
    client_selected_steps_hash = _optional_client_hash(scope, "selectedStepsHash")

    if client_window_hash and client_window_hash != server_window_hash:
        raise _scope_invalid(
            "Client windowHash does not match server-computed windowHash",
            reason="window_hash_mismatch",
        )
    # scopedInputHash includes journeyVersion — skip client compare when server
    # authoritative version differs from what the client assumed.
    client_assumed_version = client_version if client_version is not None else 1
    if (
        client_scoped_input_hash
        and client_assumed_version == journey_version
        and client_scoped_input_hash != server_scoped_input_hash
    ):
        raise _scope_invalid(
            "Client scopedInputHash does not match server-computed scopedInputHash",
            reason="scoped_input_hash_mismatch",
        )
    if (
        client_selected_steps_hash
        and client_selected_steps_hash != server_selected_steps_hash
    ):
        raise _scope_invalid(
            "Client selectedStepsHash does not match server-computed selectedStepsHash",
            reason="selected_steps_hash_mismatch",
        )

    return {
        "semanticScope": JOURNEY_SEMANTIC_SCOPE_V1,
        "journeyId": journey_id,
        "journeyVersion": journey_version,
        "sourceConversationId": source_conversation_id,
        "parentJourneyId": str(scope.get("parentJourneyId") or "").strip() or None,
        "windowIndex": window_index,
        "windowStart": window_start,
        "windowEnd": window_end,
        "windowHash": server_window_hash,
        "scopedInputHash": server_scoped_input_hash,
        "selectedStepsHash": server_selected_steps_hash,
        "selectedSteps": steps_with_hashes,
        "clientWindowHash": client_window_hash,
        "clientScopedInputHash": client_scoped_input_hash,
    }


def append_journey_scope_key(base_scope_key: Optional[str], scope: Mapping[str, Any]) -> str:
    """Isolate prepare cache by journey window fingerprint."""
    base = (base_scope_key or "anonymous").strip() or "anonymous"
    journey_id = str(scope.get("journeyId") or "unknown").strip().lower()
    version = int(scope.get("journeyVersion") or 1)
    window_hash = str(scope.get("windowHash") or scope.get("scopedInputHash") or "nohash")
    scoped = str(scope.get("scopedInputHash") or "")[:24]
    return f"{base}|journey:{journey_id}:v{version}:{window_hash[:48]}:{scoped}"
