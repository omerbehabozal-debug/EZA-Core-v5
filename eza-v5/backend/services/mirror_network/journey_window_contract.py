# -*- coding: utf-8 -*-
"""Journey V1 window identity contract — fail-closed validation."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from fastapi import HTTPException, status

JOURNEY_STEP_COUNT = 8
JOURNEY_MAX_PUBLISHABLE_WINDOWS = 2


def _window_invalid(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "code": "journey_window_contract_invalid",
            "message": message,
        },
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


def normalize_selected_journey_steps(
    steps: Sequence[Mapping[str, Any]] | None,
) -> list[dict[str, Any]]:
    """
    Normalize selectedSteps into canonical window-aware rows.

    Accepts either production field names or legacy aliases:
      stepIndex|index, sourceUserMessageId|userMessageId, …
    """
    rows = _as_list(steps)
    if len(rows) != JOURNEY_STEP_COUNT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "journey_steps_required",
                "message": (
                    f"Journey publish requires exactly {JOURNEY_STEP_COUNT} "
                    f"selectedSteps; got {len(rows)}"
                ),
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

        if step_index < 1 or step_index > JOURNEY_STEP_COUNT:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_step_invalid",
                    "message": f"selectedStep.stepIndex must be 1..{JOURNEY_STEP_COUNT}",
                },
            )
        if source_order < 0:
            raise _window_invalid(
                "Each selectedStep requires non-negative sourceOrder"
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
                f"Duplicate selectedStep.sourceOrder={source_order}"
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
    expected = list(range(1, JOURNEY_STEP_COUNT + 1))
    got = [int(row["stepIndex"]) for row in normalized]
    if got != expected:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "journey_step_index_gap",
                "message": "selectedSteps stepIndex must be exactly 1..8 contiguous",
            },
        )

    orders = [int(row["sourceOrder"]) for row in normalized]
    if orders != sorted(orders) or len(set(orders)) != len(orders):
        raise _window_invalid("selectedSteps sourceOrder must be strictly increasing")
    for i in range(1, len(orders)):
        if orders[i] != orders[i - 1] + 1:
            raise _window_invalid(
                "selectedSteps sourceOrder must be contiguous (no gaps)"
            )

    return normalized


def validate_journey_window_identity(
    *,
    window_index: Any,
    window_start: Any,
    window_end: Any,
    steps: Sequence[Mapping[str, Any]],
) -> tuple[int, int, int]:
    """
    Validate declared window identity against frozen steps.

    Does not reconstruct the window from steps — declaration is authoritative
    and must match step sourceOrder bounds exactly.
    """
    try:
        w_index = int(window_index)
        w_start = int(window_start)
        w_end = int(window_end)
    except (TypeError, ValueError) as exc:
        raise _window_invalid(
            "windowIndex, windowStart, and windowEnd are required integers"
        ) from exc

    if w_index < 0 or w_index >= JOURNEY_MAX_PUBLISHABLE_WINDOWS:
        raise _window_invalid(
            f"windowIndex must be 0..{JOURNEY_MAX_PUBLISHABLE_WINDOWS - 1}"
        )
    if w_end - w_start != JOURNEY_STEP_COUNT - 1:
        raise _window_invalid("windowEnd - windowStart must equal 7")
    if w_start != w_index * JOURNEY_STEP_COUNT:
        raise _window_invalid(
            "windowStart must equal windowIndex * 8 for deterministic windows"
        )
    if w_end != w_start + JOURNEY_STEP_COUNT - 1:
        raise _window_invalid("windowEnd must equal windowStart + 7")

    if len(steps) != JOURNEY_STEP_COUNT:
        raise _window_invalid("window requires exactly 8 selectedSteps")

    first = int(steps[0]["sourceOrder"])
    last = int(steps[-1]["sourceOrder"])
    if first != w_start:
        raise _window_invalid("first sourceOrder must equal windowStart")
    if last != w_end:
        raise _window_invalid("last sourceOrder must equal windowEnd")

    for i, row in enumerate(steps):
        expected_order = w_start + i
        if int(row["sourceOrder"]) != expected_order:
            raise _window_invalid(
                "sourceOrder must be contiguous inside the declared window"
            )
        if int(row["sourceOrder"]) < w_start or int(row["sourceOrder"]) > w_end:
            raise _window_invalid("sourceOrder outside declared window")

    return w_index, w_start, w_end


def resolve_requested_parent_slug(
    *,
    parent_slug: Optional[str],
    parent_journey_id: Optional[str],
) -> Optional[str]:
    raw = (parent_slug or "").strip() or (parent_journey_id or "").strip()
    return raw.lower() or None
