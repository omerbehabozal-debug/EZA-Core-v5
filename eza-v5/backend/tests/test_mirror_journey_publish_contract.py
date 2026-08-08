# -*- coding: utf-8 -*-
"""Phase 2 PASS — journey publish fail-closed contract."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.services.mirror_network.journey_publish_contract import (
    resolve_journey_publish_mode,
    validate_selected_journey_steps,
)


def _eight_steps():
    return [
        {
            "index": i,
            "userMessageId": f"u{i}",
            "assistantMessageId": f"a{i}",
            "publicQuestion": f"Soru {i}?",
            "publicAnswer": f"Cevap {i}.",
        }
        for i in range(1, 9)
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
    assert rows[0]["index"] == 1


def test_flag_on_conversation_missing_journey_id_fail_closed():
    with pytest.raises(HTTPException) as exc:
        resolve_journey_publish_mode(
            conversation_id="conv-1",
            journey_id_raw=None,
            selected_steps=_eight_steps(),
            flag_enabled=True,
        )
    assert exc.value.detail["code"] == "journey_id_required"


def test_flag_on_conversation_with_journey_and_steps():
    mode, jid, steps = resolve_journey_publish_mode(
        conversation_id="conv-1",
        journey_id_raw="aile-suv-abcd",
        selected_steps=_eight_steps(),
        flag_enabled=True,
    )
    assert mode == "journey"
    assert jid == "aile-suv-abcd"
    assert len(steps) == 8


def test_flag_on_no_conversation_allows_legacy():
    mode, jid, steps = resolve_journey_publish_mode(
        conversation_id=None,
        journey_id_raw=None,
        selected_steps=None,
        flag_enabled=True,
    )
    assert mode == "legacy"
    assert jid is None
    assert steps is None


def test_flag_off_legacy_even_with_conversation():
    mode, jid, steps = resolve_journey_publish_mode(
        conversation_id="conv-1",
        journey_id_raw=None,
        selected_steps=None,
        flag_enabled=False,
    )
    assert mode == "legacy"
