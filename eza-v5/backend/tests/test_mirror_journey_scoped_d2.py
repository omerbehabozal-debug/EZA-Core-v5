# -*- coding: utf-8 -*-
"""Phase 3 — Journey scoped semantic package validation."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.services.mirror.journey_semantic_scope import (
    JOURNEY_SEMANTIC_SCOPE_V1,
    append_journey_scope_key,
    validate_journey_semantic_scope,
)


def _steps(start: int = 0):
    return [
        {
            "stepIndex": i + 1,
            "sourceOrder": start + i,
            "sourceUserMessageId": f"u{start + i + 1}",
            "sourceAssistantMessageId": f"a{start + i + 1}",
            "publicQuestion": f"BMW GLC soru {start + i + 1}?",
            "publicAnswer": f"BMW GLC cevap {start + i + 1}.",
        }
        for i in range(8)
    ]


def _messages_from_steps(steps):
    rows = []
    for step in steps:
        rows.append({"role": "user", "text": step["publicQuestion"], "sequence": step["sourceOrder"] * 2})
        rows.append(
            {
                "role": "assistant",
                "text": step["publicAnswer"],
                "sequence": step["sourceOrder"] * 2 + 1,
            }
        )
    return rows


def _scope(start: int = 0, **extra):
    steps = _steps(start)
    payload = {
        "semanticScope": JOURNEY_SEMANTIC_SCOPE_V1,
        "journeyId": "journey-bmw",
        "journeyVersion": 1,
        "sourceConversationId": "conv-1",
        "windowIndex": 0 if start == 0 else 1,
        "windowStart": start,
        "windowEnd": start + 7,
        "windowHash": "h-test",
        "scopedInputHash": "s-test",
        "selectedSteps": steps,
    }
    payload.update(extra)
    return payload, steps


def test_validate_scope_ok():
    scope, steps = _scope(0)
    meta = validate_journey_semantic_scope(
        journey_scope=scope,
        messages=_messages_from_steps(steps),
    )
    assert meta["semanticScope"] == JOURNEY_SEMANTIC_SCOPE_V1
    assert meta["journeyId"] == "journey-bmw"
    assert meta["windowIndex"] == 0


def test_validate_scope_rejects_message_mismatch():
    scope, steps = _scope(0)
    messages = _messages_from_steps(steps)
    messages[0]["text"] = "Roma İmparatorluğu soru 1?"
    with pytest.raises(HTTPException) as exc:
        validate_journey_semantic_scope(journey_scope=scope, messages=messages)
    assert exc.value.detail["code"] == "journey_semantic_scope_invalid"


def test_validate_scope_rejects_wrong_count():
    scope, steps = _scope(0)
    messages = _messages_from_steps(steps)[:14]
    with pytest.raises(HTTPException) as exc:
        validate_journey_semantic_scope(journey_scope=scope, messages=messages)
    assert exc.value.detail["code"] == "journey_semantic_scope_invalid"


def test_validate_scope_rejects_missing_scope():
    with pytest.raises(HTTPException) as exc:
        validate_journey_semantic_scope(journey_scope=None, messages=[])
    assert exc.value.detail["code"] == "journey_semantic_scope_invalid"


def test_same_window_different_outside_messages_same_validation():
    """Messages must match selectedSteps; outside-chat text is never in the package."""
    scope, steps = _scope(0)
    messages = _messages_from_steps(steps)
    meta = validate_journey_semantic_scope(journey_scope=scope, messages=messages)
    assert all("Roma" not in step["publicQuestion"] for step in meta["selectedSteps"])
    assert all("BMW" in step["publicQuestion"] for step in meta["selectedSteps"])


def test_child_window_scope_isolated_from_parent_text():
    scope, steps = _scope(8)
    scope["journeyId"] = "journey-comfort"
    scope["parentJourneyId"] = "journey-bmw"
    for step in steps:
        step["publicQuestion"] = step["publicQuestion"].replace("BMW GLC", "uzun yol konfor")
        step["publicAnswer"] = step["publicAnswer"].replace("BMW GLC", "uzun yol konfor")
    scope["selectedSteps"] = steps
    meta = validate_journey_semantic_scope(
        journey_scope=scope,
        messages=_messages_from_steps(steps),
    )
    assert meta["parentJourneyId"] == "journey-bmw"
    assert meta["windowIndex"] == 1
    assert all("BMW" not in s["publicQuestion"] for s in meta["selectedSteps"])


def test_append_journey_scope_key_isolates_cache():
    a = append_journey_scope_key(
        "user:1",
        {"journeyId": "journey-a", "journeyVersion": 1, "windowHash": "hashA"},
    )
    b = append_journey_scope_key(
        "user:1",
        {"journeyId": "journey-a", "journeyVersion": 1, "windowHash": "hashB"},
    )
    assert a != b
    assert "journey:journey-a" in a
