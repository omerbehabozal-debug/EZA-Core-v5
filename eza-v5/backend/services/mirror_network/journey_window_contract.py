# -*- coding: utf-8 -*-
"""Journey V1 source-block + selection contract (Phase 3.7).

Source block = contiguous 8 eligible Q/A.
Yansı selection = confirmed 6–8 from that block only.
windowIndex/windowStart/windowEnd remain compatibility aliases for blockIndex/range.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from fastapi import HTTPException, status

# Source block size (always 8). Selection may be a 6–8 subset.
JOURNEY_STEP_COUNT = 8
JOURNEY_SOURCE_BLOCK_SIZE = 8
JOURNEY_SELECTED_MIN = 6
JOURNEY_SELECTED_MAX = 8
# Compatibility alias — Journey Mode is unlimited; do not use as a product cap.
JOURNEY_MAX_PUBLISHABLE_WINDOWS = None


def _window_invalid(message: str, *, reason: str | None = None) -> HTTPException:
    detail: dict[str, Any] = {
        "code": "journey_window_contract_invalid",
        "message": message,
    }
    if reason:
        detail["reason"] = reason
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=detail,
    )


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def _step_field(raw: Mapping[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in raw and raw.get(key) is not None:
            return raw.get(key)
    return None


def block_range(block_index: int) -> tuple[int, int]:
    start = int(block_index) * JOURNEY_SOURCE_BLOCK_SIZE
    return start, start + JOURNEY_SOURCE_BLOCK_SIZE - 1


def normalize_selected_journey_steps(
    steps: Sequence[Mapping[str, Any]] | None,
) -> list[dict[str, Any]]:
    """
    Normalize selectedSteps into canonical rows (Phase 3.7: length 6–8).

    Accepts either production field names or legacy aliases:
      stepIndex|index, sourceUserMessageId|userMessageId, …
    """
    rows = _as_list(steps)
    selected_count = len(rows)
    if selected_count < JOURNEY_SELECTED_MIN or selected_count > JOURNEY_SELECTED_MAX:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "journey_steps_required",
                "message": (
                    f"Journey publish requires {JOURNEY_SELECTED_MIN}–"
                    f"{JOURNEY_SELECTED_MAX} selectedSteps; got {selected_count}"
                ),
                "reason": "selected_count_invalid",
            },
        )

    normalized: list[dict[str, Any]] = []
    seen_user: set[str] = set()
    seen_assistant: set[str] = set()
    seen_index: set[int] = set()
    seen_order: set[int] = set()

    for raw in rows:
        if not isinstance(raw, Mapping):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_step_invalid",
                    "message": "Each selectedStep must be an object",
                },
            )
        try:
            step_index = int(_step_field(raw, "stepIndex", "index"))
        except (TypeError, ValueError):
            step_index = -1
        try:
            source_order = int(_step_field(raw, "sourceOrder"))
        except (TypeError, ValueError):
            source_order = -1

        user_id = str(
            _step_field(raw, "sourceUserMessageId", "userMessageId") or ""
        ).strip()
        assistant_id = str(
            _step_field(raw, "sourceAssistantMessageId", "assistantMessageId") or ""
        ).strip()
        question = str(raw.get("publicQuestion") or "").strip()
        answer = str(raw.get("publicAnswer") or "").strip()

        if step_index < 1 or step_index > selected_count:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_step_invalid",
                    "message": f"selectedStep.stepIndex must be 1..{selected_count}",
                    "reason": "step_index_out_of_range",
                },
            )
        if source_order < 0:
            raise _window_invalid(
                "Each selectedStep requires non-negative sourceOrder",
                reason="source_order_invalid",
            )
        if step_index in seen_index:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_step_duplicate_index",
                    "message": f"Duplicate selectedStep.stepIndex={step_index}",
                },
            )
        if source_order in seen_order:
            raise _window_invalid(
                f"Duplicate selectedStep.sourceOrder={source_order}",
                reason="duplicate_source_order",
            )
        if not user_id or not assistant_id or not question or not answer:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_step_invalid",
                    "message": (
                        "Each selectedStep requires sourceUserMessageId, "
                        "sourceAssistantMessageId, publicQuestion, publicAnswer"
                    ),
                },
            )
        if user_id in seen_user or assistant_id in seen_assistant:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_step_duplicate_message",
                    "message": "selectedSteps must not reuse message ids",
                },
            )
        seen_index.add(step_index)
        seen_order.add(source_order)
        seen_user.add(user_id)
        seen_assistant.add(assistant_id)
        normalized.append(
            {
                "stepIndex": step_index,
                "index": step_index,  # persist helper compat
                "sourceOrder": source_order,
                "sourceUserMessageId": user_id,
                "userMessageId": user_id,
                "sourceAssistantMessageId": assistant_id,
                "assistantMessageId": assistant_id,
                "publicQuestion": question,
                "publicAnswer": answer,
            }
        )

    normalized.sort(key=lambda row: int(row["stepIndex"]))
    expected = list(range(1, selected_count + 1))
    got = [int(row["stepIndex"]) for row in normalized]
    if got != expected:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "journey_step_index_gap",
                "message": (
                    f"selectedSteps stepIndex must be exactly 1..{selected_count} contiguous"
                ),
                "reason": "step_index_gap",
            },
        )

    orders = [int(row["sourceOrder"]) for row in normalized]
    if orders != sorted(orders) or len(set(orders)) != len(orders):
        raise _window_invalid(
            "selectedSteps sourceOrder must be strictly increasing",
            reason="source_order_not_chronological",
        )
    # Gaps inside the source block are allowed (deselection). Cross-block rejected below.

    return normalized


def validate_journey_window_identity(
    *,
    window_index: Any,
    window_start: Any,
    window_end: Any,
    steps: Sequence[Mapping[str, Any]],
    source_block_steps: Sequence[Mapping[str, Any]] | None = None,
) -> tuple[int, int, int]:
    """
    Validate declared source-block identity against frozen selected steps.

    Source block is always size 8. Selected steps are a 6–8 subset whose
    sourceOrder values all lie in [blockStart, blockEnd].
    Does not reconstruct a different block to make invalid input pass.
    """
    try:
        w_index = int(window_index)
        w_start = int(window_start)
        w_end = int(window_end)
    except (TypeError, ValueError) as exc:
        raise _window_invalid(
            "windowIndex, windowStart, and windowEnd are required integers",
            reason="block_identity_invalid",
        ) from exc

    if w_index < 0:
        raise _window_invalid(
            "windowIndex/blockIndex must be >= 0",
            reason="block_index_invalid",
        )
    expected_start, expected_end = block_range(w_index)
    if w_end - w_start != JOURNEY_SOURCE_BLOCK_SIZE - 1:
        raise _window_invalid(
            "windowEnd - windowStart must equal 7 (source block size 8)",
            reason="block_range_invalid",
        )
    if w_start != expected_start:
        raise _window_invalid(
            "windowStart must equal windowIndex * 8 for deterministic source blocks",
            reason="block_start_mismatch",
        )
    if w_end != expected_end:
        raise _window_invalid(
            "windowEnd must equal windowStart + 7",
            reason="block_end_mismatch",
        )

    selected_count = len(steps)
    if selected_count < JOURNEY_SELECTED_MIN or selected_count > JOURNEY_SELECTED_MAX:
        raise _window_invalid(
            f"source block selection requires {JOURNEY_SELECTED_MIN}–"
            f"{JOURNEY_SELECTED_MAX} selectedSteps",
            reason="selected_count_invalid",
        )

    for row in steps:
        order = int(row["sourceOrder"])
        if order < w_start or order > w_end:
            raise _window_invalid(
                "sourceOrder outside declared source block",
                reason="cross_block_selection",
            )

    if source_block_steps is not None:
        block_rows = _as_list(source_block_steps)
        if len(block_rows) != JOURNEY_SOURCE_BLOCK_SIZE:
            raise _window_invalid(
                "sourceBlockSteps must contain exactly 8 eligible Q/A pairs",
                reason="source_block_size_invalid",
            )
        block_orders: list[int] = []
        for raw in block_rows:
            if not isinstance(raw, Mapping):
                raise _window_invalid(
                    "Each sourceBlockStep must be an object",
                    reason="source_block_invalid",
                )
            try:
                order = int(_step_field(raw, "sourceOrder"))
            except (TypeError, ValueError) as exc:
                raise _window_invalid(
                    "sourceBlockSteps require sourceOrder",
                    reason="source_block_invalid",
                ) from exc
            block_orders.append(order)
        if sorted(block_orders) != list(range(w_start, w_end + 1)):
            raise _window_invalid(
                "sourceBlockSteps must cover the declared block exactly once",
                reason="source_block_coverage_invalid",
            )
        block_id_set = {
            (
                str(_step_field(raw, "sourceUserMessageId", "userMessageId") or "").strip(),
                str(
                    _step_field(raw, "sourceAssistantMessageId", "assistantMessageId")
                    or ""
                ).strip(),
            )
            for raw in block_rows
            if isinstance(raw, Mapping)
        }
        for row in steps:
            key = (
                str(row.get("sourceUserMessageId") or row.get("userMessageId") or ""),
                str(
                    row.get("sourceAssistantMessageId")
                    or row.get("assistantMessageId")
                    or ""
                ),
            )
            if key not in block_id_set:
                raise _window_invalid(
                    "selected step is not a member of the declared source block",
                    reason="cross_block_selection",
                )

    return w_index, w_start, w_end


def resolve_requested_parent_slug(
    *,
    parent_slug: Optional[str],
    parent_journey_id: Optional[str],
) -> Optional[str]:
    raw = (parent_slug or "").strip() or (parent_journey_id or "").strip()
    return raw.lower() or None
