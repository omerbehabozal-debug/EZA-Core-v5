# -*- coding: utf-8 -*-
"""Journey v1 publish contract — fail-closed when flag on for Conversation Mirrors."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from fastapi import HTTPException, status

from backend.services.mirror_network.journey_identity import (
    mirror_journey_v1_enabled,
    normalize_journey_id,
)

JOURNEY_STEP_COUNT = 8


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def validate_selected_journey_steps(
    steps: Sequence[Mapping[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Require exactly 8 frozen Q/A pairs with stable ids + non-empty text."""
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
            index = int(raw.get("index"))
        except (TypeError, ValueError):
            index = -1
        user_id = str(raw.get("userMessageId") or "").strip()
        assistant_id = str(raw.get("assistantMessageId") or "").strip()
        question = str(raw.get("publicQuestion") or "").strip()
        answer = str(raw.get("publicAnswer") or "").strip()

        if index < 1 or index > JOURNEY_STEP_COUNT:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_step_invalid",
                    "message": f"selectedStep.index must be 1..{JOURNEY_STEP_COUNT}",
                },
            )
        if index in seen_index:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_step_duplicate_index",
                    "message": f"Duplicate selectedStep.index={index}",
                },
            )
        if not user_id or not assistant_id or not question or not answer:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_step_invalid",
                    "message": (
                        "Each selectedStep requires userMessageId, "
                        "assistantMessageId, publicQuestion, publicAnswer"
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
        seen_index.add(index)
        seen_user.add(user_id)
        seen_assistant.add(assistant_id)
        normalized.append(
            {
                "index": index,
                "userMessageId": user_id,
                "assistantMessageId": assistant_id,
                "publicQuestion": question,
                "publicAnswer": answer,
            }
        )

    normalized.sort(key=lambda row: int(row["index"]))
    expected = list(range(1, JOURNEY_STEP_COUNT + 1))
    got = [int(row["index"]) for row in normalized]
    if got != expected:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "journey_step_index_gap",
                "message": "selectedSteps indices must be exactly 1..8 contiguous",
            },
        )
    return normalized


def resolve_journey_publish_mode(
    *,
    conversation_id: Optional[str],
    journey_id_raw: Optional[str],
    selected_steps: Sequence[Mapping[str, Any]] | None,
    flag_enabled: Optional[bool] = None,
) -> tuple[str, Optional[str], Optional[list[dict[str, Any]]]]:
    """
    Returns (mode, normalized_journey_id, normalized_steps).

    mode:
      - legacy: conversation upsert path (flag off, or intentional non-conversation)
      - journey: journeyId identity path

    Fail-closed: when flag on AND conversationId present, missing journeyId /
    invalid steps raise — never silent legacy fallback.
    """
    enabled = mirror_journey_v1_enabled() if flag_enabled is None else bool(flag_enabled)
    journey_id = normalize_journey_id(journey_id_raw)
    has_conversation = bool((conversation_id or "").strip())

    if not enabled:
        return "legacy", None, None

    if has_conversation:
        if not journey_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "journey_id_required",
                    "message": (
                        "EZA_MIRROR_JOURNEY_V1 requires journeyId for Conversation "
                        "Mirror publish; legacy conversation upsert is disabled"
                    ),
                },
            )
        steps = validate_selected_journey_steps(selected_steps)
        return "journey", journey_id, steps

    # Intentional non-conversation / legacy-compatible product path (no conversationId).
    if journey_id:
        steps = validate_selected_journey_steps(selected_steps)
        return "journey", journey_id, steps
    return "legacy", None, None
