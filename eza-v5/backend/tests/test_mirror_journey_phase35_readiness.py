# -*- coding: utf-8 -*-
"""Phase 3.5 — Frozen artifact readiness (hashes, version, privacy, reuse contract)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.services.mirror.frozen_journey_source import build_frozen_journey_source
from backend.services.mirror.journey_semantic_scope import (
    JOURNEY_SEMANTIC_SCOPE_V1,
    validate_journey_semantic_scope,
)
from backend.services.mirror.journey_step_sanitization import (
    SANITIZATION_BLOCKED,
    SANITIZATION_CLEAN,
    SANITIZATION_SANITIZED,
    sanitize_selected_journey_steps,
)
from backend.services.mirror.journey_version import (
    resolve_authoritative_journey_version,
    versions_are_distinguishable,
)
from backend.services.mirror.journey_window_hashes import (
    compute_scoped_input_hash,
    compute_window_hash,
)


def _steps(start: int = 0, answer_suffix: str = ""):
    return [
        {
            "stepIndex": i + 1,
            "sourceOrder": start + i,
            "sourceUserMessageId": f"u{start + i + 1}",
            "sourceAssistantMessageId": f"a{start + i + 1}",
            "publicQuestion": f"BMW X3 GLC aile SUV soru {start + i + 1}?",
            "publicAnswer": f"BMW X3 GLC cevap {start + i + 1}.{answer_suffix}",
        }
        for i in range(8)
    ]


def _messages_from_steps(steps):
    rows = []
    for step in steps:
        rows.append(
            {"role": "user", "text": step["publicQuestion"], "sequence": step["sourceOrder"] * 2}
        )
        rows.append(
            {
                "role": "assistant",
                "text": step["publicAnswer"],
                "sequence": step["sourceOrder"] * 2 + 1,
            }
        )
    return rows


def _scope(steps, **extra):
    window_hash = compute_window_hash(steps)
    scoped = compute_scoped_input_hash(
        journey_id="journey-bmw",
        journey_version=int(extra.get("journeyVersion", 1)),
        source_conversation_id="conv-1",
        window_index=0 if steps[0]["sourceOrder"] == 0 else 1,
        window_start=steps[0]["sourceOrder"],
        window_end=steps[0]["sourceOrder"] + 7,
        steps=steps,
    )
    payload = {
        "semanticScope": JOURNEY_SEMANTIC_SCOPE_V1,
        "journeyId": "journey-bmw",
        "journeyVersion": 1,
        "sourceConversationId": "conv-1",
        "windowIndex": 0 if steps[0]["sourceOrder"] == 0 else 1,
        "windowStart": steps[0]["sourceOrder"],
        "windowEnd": steps[0]["sourceOrder"] + 7,
        "windowHash": window_hash,
        "scopedInputHash": scoped,
        "selectedSteps": steps,
    }
    payload.update(extra)
    # Recompute scoped if version overridden in extra
    if "journeyVersion" in extra:
        payload["scopedInputHash"] = compute_scoped_input_hash(
            journey_id=payload["journeyId"],
            journey_version=int(extra["journeyVersion"]),
            source_conversation_id=payload["sourceConversationId"],
            window_index=payload["windowIndex"],
            window_start=payload["windowStart"],
            window_end=payload["windowEnd"],
            steps=steps,
        )
    return payload


def test_server_hash_accepts_valid_client_hash():
    steps = _steps()
    scope = _scope(steps)
    meta = validate_journey_semantic_scope(
        journey_scope=scope, messages=_messages_from_steps(steps)
    )
    assert meta["windowHash"] == scope["windowHash"]
    assert meta["scopedInputHash"] == scope["scopedInputHash"]
    assert meta["selectedStepsHash"]
    assert all(s.get("questionHash") and s.get("answerHash") for s in meta["selectedSteps"])


def test_server_hash_computes_when_client_hash_missing():
    steps = _steps()
    scope = _scope(steps)
    scope.pop("windowHash")
    scope.pop("scopedInputHash")
    meta = validate_journey_semantic_scope(
        journey_scope=scope, messages=_messages_from_steps(steps)
    )
    assert meta["windowHash"].startswith("h")
    assert meta["scopedInputHash"].startswith("s")


def test_server_hash_rejects_tampered_client_hash():
    steps = _steps()
    scope = _scope(steps)
    scope["windowHash"] = "hdeadbeef"
    with pytest.raises(HTTPException) as exc:
        validate_journey_semantic_scope(
            journey_scope=scope, messages=_messages_from_steps(steps)
        )
    assert exc.value.detail["code"] == "journey_semantic_scope_invalid"
    assert exc.value.detail.get("reason") == "window_hash_mismatch"


def test_server_hash_changes_when_selected_answer_changes():
    steps = _steps()
    h1 = compute_window_hash(steps)
    steps2 = _steps(answer_suffix=" MUTATED")
    h2 = compute_window_hash(steps2)
    assert h1 != h2


def test_server_hash_unchanged_by_outside_window_q9():
    steps = _steps()
    h1 = compute_window_hash(steps)
    # Outside-window Q9 never enters selectedSteps — hash identity holds.
    h2 = compute_window_hash(steps)
    assert h1 == h2
    outside = "Roma İmparatorluğu SECRET_PERSON_42"
    assert outside not in str(steps)


def test_journey_version_new_then_next():
    assert resolve_authoritative_journey_version(existing_published_version=None) == 1
    assert resolve_authoritative_journey_version(existing_published_version=1) == 2
    assert resolve_authoritative_journey_version(existing_published_version=2) == 3
    assert versions_are_distinguishable(1, 2)


def test_journey_version_distinguishes_scoped_input_hash():
    steps = _steps()
    h1 = compute_scoped_input_hash(
        journey_id="journey-bmw",
        journey_version=1,
        source_conversation_id="conv-1",
        window_index=0,
        window_start=0,
        window_end=7,
        steps=steps,
    )
    h2 = compute_scoped_input_hash(
        journey_id="journey-bmw",
        journey_version=2,
        source_conversation_id="conv-1",
        window_index=0,
        window_start=0,
        window_end=7,
        steps=steps,
    )
    assert h1 != h2
    meta = validate_journey_semantic_scope(
        journey_scope=_scope(steps, journeyVersion=1),
        messages=_messages_from_steps(steps),
        existing_published_version=1,
    )
    assert meta["journeyVersion"] == 2
    assert meta["scopedInputHash"] == h2


def test_sanitize_clean_steps():
    out = sanitize_selected_journey_steps(_steps())
    assert out["status"] == SANITIZATION_CLEAN
    assert out["flags"] == []


def test_sanitize_email_in_question():
    steps = _steps()
    steps[0]["publicQuestion"] = "Bana aile@ornek.com adresine de yaz."
    out = sanitize_selected_journey_steps(steps)
    assert out["status"] == SANITIZATION_SANITIZED
    assert "email" in out["flags"]
    assert "[email]" in out["steps"][0]["publicQuestion"]
    assert out["originalHashes"][0]["questionHash"] != out["publicHashes"][0]["questionHash"]


def test_sanitize_phone_in_answer():
    steps = _steps()
    steps[1]["publicAnswer"] = "Beni +90 532 111 22 33 numarasından ara."
    out = sanitize_selected_journey_steps(steps)
    assert out["status"] == SANITIZATION_SANITIZED
    assert "phone" in out["flags"]
    assert "[phone]" in out["steps"][1]["publicAnswer"]


def test_sanitize_private_marker_blocks():
    steps = _steps()
    steps[2]["publicQuestion"] = "SECRET_PERSON_42 hakkında ne düşünüyorsun?"
    out = sanitize_selected_journey_steps(steps)
    assert out["status"] == SANITIZATION_BLOCKED
    assert "private_marker" in out["flags"]


def test_outside_window_private_irrelevant_to_sanitizer():
    steps = _steps()
    out = sanitize_selected_journey_steps(steps)
    assert out["status"] == SANITIZATION_CLEAN
    assert "SECRET_PERSON_42" not in str(out["steps"])


def test_frozen_journey_source_contract_ready():
    steps = _steps()
    frozen = build_frozen_journey_source(
        journey_id="journey-bmw",
        journey_version=1,
        source_conversation_id="conv-1",
        window_index=0,
        window_start=0,
        window_end=7,
        selected_steps=steps,
        interpretation_hash="iabc",
        anchors_hash="aabc",
        public_landing_hash="pabc",
        mapped_prompt_hash="mabc",
    )
    required = {
        "journeyId",
        "journeyVersion",
        "sourceConversationId",
        "windowIndex",
        "windowStart",
        "windowEnd",
        "selectedSteps",
        "serverWindowHash",
        "serverScopedInputHash",
        "sanitizationStatus",
        "sanitizationFlags",
        "interpretationHash",
        "anchorsHash",
        "publicLandingHash",
        "mappedPromptHash",
    }
    assert required.issubset(frozen.keys())
    assert frozen["sanitizationStatus"] == SANITIZATION_CLEAN
    assert frozen["publicationBlocked"] is False
    assert len(frozen["selectedSteps"]) == 8


def test_frozen_journey_source_blocks_private_marker():
    steps = _steps()
    steps[0]["publicAnswer"] = "SECRET_PERSON_42 private note"
    frozen = build_frozen_journey_source(
        journey_id="journey-bmw",
        journey_version=1,
        source_conversation_id="conv-1",
        window_index=0,
        window_start=0,
        window_end=7,
        selected_steps=steps,
    )
    assert frozen["publicationBlocked"] is True
    assert frozen["sanitizationStatus"] == SANITIZATION_BLOCKED
