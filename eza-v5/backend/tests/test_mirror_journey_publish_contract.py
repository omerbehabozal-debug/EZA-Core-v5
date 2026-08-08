# -*- coding: utf-8 -*-
"""Phase 2 PASS — journey publish fail-closed contract."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.services.mirror_network.journey_publish_contract import (
    resolve_journey_publish_mode,
    validate_selected_journey_steps,
)


def _eight_steps(start: int = 0):
    return [
        {
            "stepIndex": i + 1,
            "sourceOrder": start + i,
            "sourceUserMessageId": f"u{start + i + 1}",
            "sourceAssistantMessageId": f"a{start + i + 1}",
            "publicQuestion": f"Soru {start + i + 1}?",
            "publicAnswer": f"Cevap {start + i + 1}.",
        }
        for i in range(8)
    ]


def test_validate_selected_steps_requires_exactly_eight():
    with pytest.raises(HTTPException) as exc:
        validate_selected_journey_steps(_eight_steps()[:7])
    assert exc.value.detail["code"] == "journey_steps_required"

    with pytest.raises(HTTPException) as exc9:
        validate_selected_journey_steps(_eight_steps() + [_eight_steps()[0]])
    assert exc9.value.detail["code"] == "journey_steps_required"


def test_validate_selected_steps_ok():
    rows = validate_selected_journey_steps(_eight_steps())
    assert len(rows) == 8
    assert rows[0]["stepIndex"] == 1
    assert rows[0]["sourceOrder"] == 0


def test_flag_on_conversation_missing_journey_id_fail_closed():
    with pytest.raises(HTTPException) as exc:
        resolve_journey_publish_mode(
            conversation_id="conv-1",
            journey_id_raw=None,
            selected_steps=_eight_steps(),
            window_index=0,
            window_start=0,
            window_end=7,
            flag_enabled=True,
        )
    assert exc.value.detail["code"] == "journey_id_required"


def test_flag_on_conversation_with_journey_and_steps():
    mode, jid, steps, window = resolve_journey_publish_mode(
        conversation_id="conv-1",
        journey_id_raw="aile-suv-abcd",
        selected_steps=_eight_steps(),
        window_index=0,
        window_start=0,
        window_end=7,
        flag_enabled=True,
    )
    assert mode == "journey"
    assert jid == "aile-suv-abcd"
    assert len(steps) == 8
    assert window == (0, 0, 7)


def test_flag_on_no_conversation_allows_legacy():
    mode, jid, steps, window = resolve_journey_publish_mode(
        conversation_id=None,
        journey_id_raw=None,
        selected_steps=None,
        flag_enabled=True,
    )
    assert mode == "legacy"
    assert jid is None
    assert steps is None
    assert window is None


def test_flag_off_legacy_even_with_conversation():
    mode, jid, steps, window = resolve_journey_publish_mode(
        conversation_id="conv-1",
        journey_id_raw=None,
        selected_steps=None,
        flag_enabled=False,
    )
    assert mode == "legacy"
