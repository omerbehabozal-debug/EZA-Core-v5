# -*- coding: utf-8 -*-
"""Regression: sealed A1/Q1 must survive message sanitization symmetry.

Live failure: \"Scoped message A1 does not match selectedSteps\" when the same
sealed publicAnswer carried newlines/URLs — messages were sanitize_display_text'd
but selectedSteps.publicAnswer was only strip()'d.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.core.schemas.mirror_prepare_director import MirrorPrepareDirectorDraftRequest
from backend.services.mirror.journey_semantic_scope import validate_journey_semantic_scope


def _eight_steps(*, a1: str, q1: str = "Soru 1?"):
    steps = []
    for i in range(8):
        steps.append(
            {
                "stepIndex": i + 1,
                "sourceOrder": i,
                "sourceUserMessageId": f"u{i}",
                "sourceAssistantMessageId": f"a{i}",
                "publicQuestion": q1 if i == 0 else f"Soru {i + 1}?",
                "publicAnswer": a1 if i == 0 else f"Cevap {i + 1}.",
            }
        )
    return steps


def _messages_from_raw_steps(steps):
    rows = []
    for step in steps:
        rows.append({"role": "user", "text": step["publicQuestion"]})
        rows.append({"role": "assistant", "text": step["publicAnswer"]})
    return rows


def _prepare_body(steps, messages=None):
    return MirrorPrepareDirectorDraftRequest(
        conversationId="conv-1",
        generationRequestId="gen-req-12345678",
        messages=messages if messages is not None else _messages_from_raw_steps(steps),
        journeySemanticScope={
            "semanticScope": "journey_window_v1",
            "journeyId": "journey-a1-symmetry",
            "journeyVersion": 1,
            "sourceConversationId": "conv-1",
            "windowIndex": 0,
            "windowStart": 0,
            "windowEnd": 7,
            "selectedSteps": steps,
        },
    )


def test_a1_newline_whitespace_survives_prepare_dto_and_scope_validation():
    raw_a1 = "Merhaba,\n\nbu bir yanit.\n\nIkinci paragraf."
    steps = _eight_steps(a1=raw_a1)
    body = _prepare_body(steps)
    meta = validate_journey_semantic_scope(
        journey_scope=body.journeySemanticScope.model_dump(),
        messages=[m.model_dump() for m in body.messages],
        request_conversation_id=body.conversationId,
    )
    expected = "Merhaba, bu bir yanit. Ikinci paragraf."
    assert body.messages[1].text == expected
    assert meta["selectedSteps"][0]["publicAnswer"] == expected
    assert meta["selectedSteps"][0]["stepIndex"] == 1


def test_a1_url_collapse_survives_prepare_dto_and_scope_validation():
    raw_a1 = "Bak: https://example.com/path burada"
    steps = _eight_steps(a1=raw_a1)
    body = _prepare_body(steps)
    meta = validate_journey_semantic_scope(
        journey_scope=body.journeySemanticScope.model_dump(),
        messages=[m.model_dump() for m in body.messages],
        request_conversation_id=body.conversationId,
    )
    expected = "Bak: burada"
    assert body.messages[1].text == expected
    assert meta["selectedSteps"][0]["publicAnswer"] == expected


def test_true_a1_content_mismatch_still_fails_closed():
    steps = _eight_steps(a1="Dogru cevap.")
    body = _prepare_body(steps)
    messages = [m.model_dump() for m in body.messages]
    messages[1]["text"] = "TAMAMEN FARKLI"
    with pytest.raises(HTTPException) as exc:
        validate_journey_semantic_scope(
            journey_scope=body.journeySemanticScope.model_dump(),
            messages=messages,
            request_conversation_id=body.conversationId,
        )
    assert exc.value.detail["code"] == "journey_semantic_scope_invalid"
    assert "A1" in exc.value.detail["message"]


def test_selected_six_with_newline_a1_matches():
    raw_a1 = "Line1\nLine2"
    steps = _eight_steps(a1=raw_a1)[:6]
    block = _eight_steps(a1=raw_a1)
    body = MirrorPrepareDirectorDraftRequest(
        conversationId="conv-1",
        generationRequestId="gen-req-12345678",
        messages=_messages_from_raw_steps(steps),
        journeySemanticScope={
            "semanticScope": "journey_window_v1",
            "journeyId": "journey-six",
            "journeyVersion": 1,
            "sourceConversationId": "conv-1",
            "windowIndex": 0,
            "windowStart": 0,
            "windowEnd": 7,
            "selectedSteps": steps,
            "sourceBlockSteps": [
                {
                    "sourceOrder": s["sourceOrder"],
                    "sourceUserMessageId": s["sourceUserMessageId"],
                    "sourceAssistantMessageId": s["sourceAssistantMessageId"],
                    "publicQuestion": s["publicQuestion"],
                    "publicAnswer": s["publicAnswer"],
                }
                for s in block
            ],
        },
    )
    meta = validate_journey_semantic_scope(
        journey_scope=body.journeySemanticScope.model_dump(),
        messages=[m.model_dump() for m in body.messages],
        request_conversation_id=body.conversationId,
    )
    assert meta["selectedCount"] == 6
    assert meta["selectedSteps"][0]["publicAnswer"] == "Line1 Line2"
