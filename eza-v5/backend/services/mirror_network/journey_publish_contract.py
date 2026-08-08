# -*- coding: utf-8 -*-
"""Journey v1 publish contract — fail-closed when flag on for Conversation Mirrors."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from fastapi import HTTPException, status

from backend.services.mirror_network.journey_identity import (
    mirror_journey_v1_enabled,
    normalize_journey_id,
)
from backend.services.mirror_network.journey_window_contract import (
    JOURNEY_STEP_COUNT,
    normalize_selected_journey_steps,
    validate_journey_window_identity,
)

# Re-export for existing tests / callers
validate_selected_journey_steps = normalize_selected_journey_steps


def resolve_journey_publish_mode(
    *,
    conversation_id: Optional[str],
    journey_id_raw: Optional[str],
    selected_steps: Sequence[Mapping[str, Any]] | None,
    window_index: Any = None,
    window_start: Any = None,
    window_end: Any = None,
    flag_enabled: Optional[bool] = None,
    require_window_identity: bool = True,
) -> tuple[str, Optional[str], Optional[list[dict[str, Any]]], Optional[tuple[int, int, int]]]:
    """
    Returns (mode, normalized_journey_id, normalized_steps, window_tuple).

    window_tuple = (windowIndex, windowStart, windowEnd) when journey mode.

    Fail-closed: when flag on AND conversationId present, missing journeyId /
    invalid steps / invalid window raise — never silent legacy fallback.
    """
    enabled = mirror_journey_v1_enabled() if flag_enabled is None else bool(flag_enabled)
    journey_id = normalize_journey_id(journey_id_raw)
    has_conversation = bool((conversation_id or "").strip())

    if not enabled:
        return "legacy", None, None, None

    def _journey_with_steps() -> tuple[str, str, list[dict[str, Any]], tuple[int, int, int]]:
        assert journey_id is not None
        steps = normalize_selected_journey_steps(selected_steps)
        if require_window_identity:
            if window_index is None or window_start is None or window_end is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "code": "journey_window_contract_invalid",
                        "message": (
                            "Journey publish requires windowIndex, windowStart, windowEnd"
                        ),
                    },
                )
            window = validate_journey_window_identity(
                window_index=window_index,
                window_start=window_start,
                window_end=window_end,
                steps=steps,
            )
        else:
            window = (
                int(steps[0]["sourceOrder"] // JOURNEY_STEP_COUNT),
                int(steps[0]["sourceOrder"]),
                int(steps[-1]["sourceOrder"]),
            )
        return "journey", journey_id, steps, window

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
        return _journey_with_steps()

    # Intentional non-conversation / legacy-compatible product path (no conversationId).
    if journey_id:
        return _journey_with_steps()
    return "legacy", None, None, None
