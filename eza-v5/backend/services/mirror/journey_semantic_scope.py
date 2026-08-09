# -*- coding: utf-8 -*-
"""Journey V1 Phase 3/3.5/3.7 — scoped semantic package validation (fail-closed)."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from fastapi import HTTPException, status

from backend.services.mirror.journey_version import resolve_authoritative_journey_version
from backend.services.mirror.journey_window_hashes import (
    attach_step_content_hashes,
    compute_scoped_input_hash,
    compute_selected_steps_hash,
    compute_source_block_hash,
    compute_window_hash,
)
from backend.services.mirror_network.journey_window_contract import (
    JOURNEY_SELECTED_MAX,
    JOURNEY_SELECTED_MIN,
    JOURNEY_SOURCE_BLOCK_SIZE,
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


def _normalize_block_rows(
    raw_steps: Any,
) -> list[dict[str, Any]]:
    rows = raw_steps if isinstance(raw_steps, list) else []
    out: list[dict[str, Any]] = []
    for raw in rows:
        if not isinstance(raw, Mapping):
            continue
        try:
            source_order = int(
                raw.get("sourceOrder")
                if raw.get("sourceOrder") is not None
                else -1
            )
        except (TypeError, ValueError):
            source_order = -1
        user_id = str(
            raw.get("sourceUserMessageId") or raw.get("userMessageId") or ""
        ).strip()
        assistant_id = str(
            raw.get("sourceAssistantMessageId") or raw.get("assistantMessageId") or ""
        ).strip()
        question = str(raw.get("publicQuestion") or "").strip()
        answer = str(raw.get("publicAnswer") or "").strip()
        out.append(
            {
                "sourceOrder": source_order,
                "sourceUserMessageId": user_id,
                "userMessageId": user_id,
                "sourceAssistantMessageId": assistant_id,
                "assistantMessageId": assistant_id,
                "publicQuestion": question,
                "publicAnswer": answer,
            }
        )
    return out


def validate_journey_semantic_scope(
    *,
    journey_scope: Mapping[str, Any] | None,
    messages: Sequence[Mapping[str, Any]] | None,
    existing_published_version: int | None = None,
    request_conversation_id: str | None = None,
) -> dict[str, Any]:
    """
    When journey semantic scope is present, require a valid source block + selected
    6–8 messages that match frozen selectedSteps exactly. Server recomputes hashes.
    Never fall back to full-chat meaning or V3.
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

    source_conversation_id = (
        str(scope.get("sourceConversationId") or "").strip() or None
    )
    request_conv = str(request_conversation_id or "").strip() or None
    if request_conv and source_conversation_id and request_conv != source_conversation_id:
        raise _scope_invalid(
            "journeySemanticScope.sourceConversationId must equal conversationId",
            reason="source_conversation_mismatch",
        )
    if request_conv and not source_conversation_id:
        source_conversation_id = request_conv

    raw_steps = scope.get("selectedSteps")
    steps = normalize_selected_journey_steps(
        raw_steps if isinstance(raw_steps, list) else None
    )
    selected_count = len(steps)

    # Prefer explicit sourceBlockSteps; when selection is exact-8 covering the
    # block, selected steps themselves are the source block.
    raw_block = scope.get("sourceBlockSteps")
    if isinstance(raw_block, list) and raw_block:
        source_block_steps = _normalize_block_rows(raw_block)
    elif selected_count == JOURNEY_SOURCE_BLOCK_SIZE:
        source_block_steps = [
            {
                "sourceOrder": int(s["sourceOrder"]),
                "sourceUserMessageId": s["sourceUserMessageId"],
                "userMessageId": s["sourceUserMessageId"],
                "sourceAssistantMessageId": s["sourceAssistantMessageId"],
                "assistantMessageId": s["sourceAssistantMessageId"],
                "publicQuestion": s["publicQuestion"],
                "publicAnswer": s["publicAnswer"],
            }
            for s in steps
        ]
    else:
        raise _scope_invalid(
            "sourceBlockSteps (exact 8) required when selectedCount is 6 or 7",
            reason="source_block_required",
        )

    if len(source_block_steps) != JOURNEY_SOURCE_BLOCK_SIZE:
        raise _scope_invalid(
            "sourceBlockSteps must contain exactly 8 eligible Q/A pairs",
            reason="source_block_size_invalid",
        )

    block_index = scope.get("blockIndex")
    if block_index is None:
        block_index = scope.get("windowIndex")
    block_start = scope.get("blockStart")
    if block_start is None:
        block_start = scope.get("windowStart")
    block_end = scope.get("blockEnd")
    if block_end is None:
        block_end = scope.get("windowEnd")

    window_index, window_start, window_end = validate_journey_window_identity(
        window_index=block_index,
        window_start=block_start,
        window_end=block_end,
        steps=steps,
        source_block_steps=source_block_steps,
    )

    rows = list(messages or [])
    expected_len = selected_count * 2
    if len(rows) != expected_len:
        raise _scope_invalid(
            f"Scoped messages must contain exactly {expected_len} turns "
            f"for selectedCount={selected_count}; got {len(rows)}",
            reason="scoped_message_count_mismatch",
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

    steps_with_hashes = attach_step_content_hashes(steps)
    block_with_hashes = attach_step_content_hashes(source_block_steps)
    server_window_hash = compute_window_hash(steps_with_hashes)
    server_source_block_hash = compute_source_block_hash(block_with_hashes)
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
    client_source_block_hash = _optional_client_hash(scope, "sourceBlockHash")
    client_scoped_input_hash = _optional_client_hash(scope, "scopedInputHash")
    client_selected_steps_hash = _optional_client_hash(scope, "selectedStepsHash")

    if client_window_hash and client_window_hash != server_window_hash:
        raise _scope_invalid(
            "Client windowHash does not match server-computed windowHash",
            reason="window_hash_mismatch",
        )
    if (
        client_source_block_hash
        and client_source_block_hash != server_source_block_hash
    ):
        raise _scope_invalid(
            "Client sourceBlockHash does not match server-computed sourceBlockHash",
            reason="source_block_hash_mismatch",
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
        "blockIndex": window_index,
        "blockStart": window_start,
        "blockEnd": window_end,
        "selectedCount": selected_count,
        "windowHash": server_window_hash,
        "sourceBlockHash": server_source_block_hash,
        "scopedInputHash": server_scoped_input_hash,
        "selectedStepsHash": server_selected_steps_hash,
        "selectedSteps": steps_with_hashes,
        "sourceBlockSteps": block_with_hashes,
        "clientWindowHash": client_window_hash,
        "clientSourceBlockHash": client_source_block_hash,
        "clientScopedInputHash": client_scoped_input_hash,
        "selectedMin": JOURNEY_SELECTED_MIN,
        "selectedMax": JOURNEY_SELECTED_MAX,
    }


def append_journey_scope_key(base_scope_key: Optional[str], scope: Mapping[str, Any]) -> str:
    """Isolate prepare cache by journey window fingerprint."""
    base = (base_scope_key or "anonymous").strip() or "anonymous"
    journey_id = str(scope.get("journeyId") or "unknown").strip().lower()
    version = int(scope.get("journeyVersion") or 1)
    window_hash = str(scope.get("windowHash") or scope.get("scopedInputHash") or "nohash")
    scoped = str(scope.get("scopedInputHash") or "")[:24]
    block = str(scope.get("sourceBlockHash") or "")[:24]
    return f"{base}|journey:{journey_id}:v{version}:{window_hash[:48]}:{scoped}:{block}"
