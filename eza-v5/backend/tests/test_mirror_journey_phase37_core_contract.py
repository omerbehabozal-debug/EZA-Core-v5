# -*- coding: utf-8 -*-
"""Phase 3.7 — source block 6–8, hashes, unlimited blocks, scoped D2 turns."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.services.mirror.journey_semantic_scope import validate_journey_semantic_scope
from backend.services.mirror.journey_window_hashes import (
    compute_scoped_input_hash,
    compute_selected_steps_hash,
    compute_source_block_hash,
    compute_window_hash,
)
from backend.services.mirror_network.journey_window_contract import (
    JOURNEY_MAX_PUBLISHABLE_WINDOWS,
    block_range,
    normalize_selected_journey_steps,
    validate_journey_window_identity,
)


def _block_steps(start: int = 0):
    return [
        {
            "stepIndex": i + 1,
            "sourceOrder": start + i,
            "sourceUserMessageId": f"u{start + i}",
            "sourceAssistantMessageId": f"a{start + i}",
            "publicQuestion": f"Soru {start + i}?",
            "publicAnswer": f"Cevap {start + i}.",
        }
        for i in range(8)
    ]


def _subset(steps, orders):
    selected = [s for s in steps if s["sourceOrder"] in orders]
    return [
        {**s, "stepIndex": i + 1, "index": i + 1}
        for i, s in enumerate(sorted(selected, key=lambda r: r["sourceOrder"]))
    ]


def _messages_from_steps(steps):
    out = []
    for s in steps:
        out.append({"role": "user", "text": s["publicQuestion"]})
        out.append({"role": "assistant", "text": s["publicAnswer"]})
    return out


def test_unlimited_block_formula():
    assert JOURNEY_MAX_PUBLISHABLE_WINDOWS is None
    assert block_range(0) == (0, 7)
    assert block_range(1) == (8, 15)
    assert block_range(3) == (24, 31)
    assert block_range(9) == (72, 79)


def test_source_block_hash_stable_across_deselection():
    block = _block_steps(0)
    full = normalize_selected_journey_steps(block)
    six = normalize_selected_journey_steps(_subset(block, [0, 2, 3, 4, 5, 7]))
    seven = normalize_selected_journey_steps(_subset(block, [0, 1, 2, 3, 4, 5, 7]))

    h_block = compute_source_block_hash(block)
    assert h_block == compute_source_block_hash(full)
    assert h_block.startswith("b")

    h8 = compute_selected_steps_hash(full)
    h7 = compute_selected_steps_hash(seven)
    h6 = compute_selected_steps_hash(six)
    assert h8 != h7 != h6
    assert len({h8, h7, h6}) == 3

    scoped8 = compute_scoped_input_hash(
        journey_id="j",
        journey_version=1,
        source_conversation_id="c",
        window_index=0,
        window_start=0,
        window_end=7,
        steps=full,
    )
    scoped6 = compute_scoped_input_hash(
        journey_id="j",
        journey_version=1,
        source_conversation_id="c",
        window_index=0,
        window_start=0,
        window_end=7,
        steps=six,
    )
    assert scoped8 != scoped6
    # windowHash (selection fingerprint) also differs
    assert compute_window_hash(full) != compute_window_hash(six)


def test_cross_block_and_five_reject():
    block = _block_steps(0)
    with pytest.raises(HTTPException) as exc:
        normalize_selected_journey_steps(_subset(block, [0, 1, 2, 3, 4]))
    assert exc.value.detail["code"] == "journey_steps_required"

    cross = _subset(block, [0, 1, 2, 3, 4, 5])
    cross[-1]["sourceOrder"] = 8
    cross[-1]["sourceUserMessageId"] = "u8"
    cross[-1]["sourceAssistantMessageId"] = "a8"
    steps = normalize_selected_journey_steps(cross)
    with pytest.raises(HTTPException) as exc2:
        validate_journey_window_identity(
            window_index=0, window_start=0, window_end=7, steps=steps
        )
    assert exc2.value.detail.get("reason") == "cross_block_selection"


def test_scoped_d2_turn_counts_6_7_8():
    block = _block_steps(0)
    for orders, expected_turns in (
        (list(range(8)), 16),
        ([0, 1, 2, 3, 4, 5, 7], 14),
        ([0, 2, 3, 4, 5, 7], 12),
    ):
        selected = normalize_selected_journey_steps(_subset(block, orders))
        scope = {
            "semanticScope": "journey_window_v1",
            "journeyId": "journey-phase37",
            "journeyVersion": 1,
            "sourceConversationId": "conv-37",
            "windowIndex": 0,
            "windowStart": 0,
            "windowEnd": 7,
            "selectedSteps": selected,
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
        }
        meta = validate_journey_semantic_scope(
            journey_scope=scope,
            messages=_messages_from_steps(selected),
            request_conversation_id="conv-37",
        )
        assert meta["selectedCount"] == len(orders)
        assert meta["sourceBlockHash"] == compute_source_block_hash(block)
        assert len(_messages_from_steps(selected)) == expected_turns
        # Deselected text absent from messages
        deselected = set(range(8)) - set(orders)
        for d in deselected:
            text_q = f"Soru {d}?"
            assert all(m["text"] != text_q for m in _messages_from_steps(selected))


def test_wrong_source_block_hash_rejected():
    block = _block_steps(0)
    selected = normalize_selected_journey_steps(block)
    scope = {
        "semanticScope": "journey_window_v1",
        "journeyId": "journey-phase37",
        "journeyVersion": 1,
        "sourceConversationId": "conv-37",
        "windowIndex": 0,
        "windowStart": 0,
        "windowEnd": 7,
        "sourceBlockHash": "bdeadbeef",
        "selectedSteps": selected,
    }
    with pytest.raises(HTTPException) as exc:
        validate_journey_semantic_scope(
            journey_scope=scope,
            messages=_messages_from_steps(selected),
            request_conversation_id="conv-37",
        )
    assert exc.value.detail.get("reason") == "source_block_hash_mismatch"


def test_high_block_index_scoped():
    block = _block_steps(72)
    selected = normalize_selected_journey_steps(block)
    scope = {
        "semanticScope": "journey_window_v1",
        "journeyId": "journey-n",
        "journeyVersion": 1,
        "sourceConversationId": "conv-n",
        "windowIndex": 9,
        "windowStart": 72,
        "windowEnd": 79,
        "selectedSteps": selected,
    }
    meta = validate_journey_semantic_scope(
        journey_scope=scope,
        messages=_messages_from_steps(selected),
        request_conversation_id="conv-n",
    )
    assert meta["blockIndex"] == 9
    assert meta["selectedCount"] == 8
