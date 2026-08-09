# -*- coding: utf-8 -*-
"""Phase 3.6 — Publish boundary integrity (generation lineage)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.services.mirror.journey_generation_lineage import (
    build_journey_generation_lineage,
    recompute_hashes_from_steps,
    validate_narrative_alignment_binding,
    validate_publish_journey_lineage,
)
from backend.services.mirror.journey_semantic_scope import (
    JOURNEY_SEMANTIC_SCOPE_V1,
    validate_journey_semantic_scope,
)
from backend.services.mirror.journey_step_sanitization import (
    SANITIZATION_BLOCKED,
    SANITIZATION_SANITIZED,
    sanitize_selected_journey_steps,
)
from backend.services.mirror.journey_window_hashes import (
    compute_scoped_input_hash,
    compute_selected_steps_hash,
    compute_window_hash,
)


def _steps(start: int = 0, answer_suffix: str = "", journey_tag: str = "A"):
    return [
        {
            "stepIndex": i + 1,
            "sourceOrder": start + i,
            "sourceUserMessageId": f"u{journey_tag}{start + i + 1}",
            "sourceAssistantMessageId": f"a{journey_tag}{start + i + 1}",
            "publicQuestion": f"{journey_tag} BMW soru {start + i + 1}?",
            "publicAnswer": f"{journey_tag} BMW cevap {start + i + 1}.{answer_suffix}",
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


def _lineage(steps, *, journey_id="journey-a", version=1, conv="conv-1", **extra):
    window_index = 0 if steps[0]["sourceOrder"] == 0 else 1
    window_start = steps[0]["sourceOrder"]
    window_end = window_start + 7
    hashes = recompute_hashes_from_steps(
        journey_id=journey_id,
        journey_version=version,
        source_conversation_id=conv,
        window_index=window_index,
        window_start=window_start,
        window_end=window_end,
        steps=steps,
    )
    base = build_journey_generation_lineage(
        journey_id=journey_id,
        journey_version=version,
        source_conversation_id=conv,
        window_index=window_index,
        window_start=window_start,
        window_end=window_end,
        window_hash=hashes["windowHash"],
        scoped_input_hash=hashes["scopedInputHash"],
        selected_steps_hash=hashes["selectedStepsHash"],
        generation_id="gen-a-1",
        interpretation_hash="interp-sha-a",
        anchors_hash="anchors-a",
        public_landing_hash="landing-a",
        mapped_prompt_hash="prompt-a",
        scene_asset_id="scene-a",
    )
    base.update(extra)
    return base, hashes


def test_source_conversation_mismatch_on_prepare():
    steps = _steps()
    scope = {
        "semanticScope": JOURNEY_SEMANTIC_SCOPE_V1,
        "journeyId": "journey-a",
        "journeyVersion": 1,
        "sourceConversationId": "other-conv",
        "windowIndex": 0,
        "windowStart": 0,
        "windowEnd": 7,
        "windowHash": compute_window_hash(steps),
        "scopedInputHash": compute_scoped_input_hash(
            journey_id="journey-a",
            journey_version=1,
            source_conversation_id="other-conv",
            window_index=0,
            window_start=0,
            window_end=7,
            steps=steps,
        ),
        "selectedSteps": steps,
    }
    with pytest.raises(HTTPException) as exc:
        validate_journey_semantic_scope(
            journey_scope=scope,
            messages=_messages_from_steps(steps),
            request_conversation_id="conv-1",
        )
    assert exc.value.detail["code"] == "journey_semantic_scope_invalid"
    assert exc.value.detail.get("reason") == "source_conversation_mismatch"


def test_publish_rejects_tampered_window_hash():
    steps = _steps()
    claimed, _ = _lineage(steps)
    claimed["windowHash"] = "hdeadbeef"
    with pytest.raises(HTTPException) as exc:
        validate_publish_journey_lineage(
            request_conversation_id="conv-1",
            journey_id="journey-a",
            journey_version=1,
            source_conversation_id="conv-1",
            window_index=0,
            window_start=0,
            window_end=7,
            selected_steps=steps,
            claimed=claimed,
            existing_published_version=None,
        )
    assert exc.value.detail["code"] == "journey_publish_lineage_mismatch"
    assert exc.value.detail["reason"] == "window_mismatch"


def test_publish_rejects_tampered_scoped_and_selected_hashes():
    steps = _steps()
    claimed, _ = _lineage(steps)
    claimed["scopedInputHash"] = "stale-scoped"
    with pytest.raises(HTTPException) as exc:
        validate_publish_journey_lineage(
            request_conversation_id="conv-1",
            journey_id="journey-a",
            journey_version=1,
            source_conversation_id="conv-1",
            window_index=0,
            window_start=0,
            window_end=7,
            selected_steps=steps,
            claimed=claimed,
            existing_published_version=None,
        )
    assert exc.value.detail["reason"] == "steps_hash_mismatch"

    claimed2, _ = _lineage(steps)
    claimed2["selectedStepsHash"] = "stale-steps"
    with pytest.raises(HTTPException) as exc2:
        validate_publish_journey_lineage(
            request_conversation_id="conv-1",
            journey_id="journey-a",
            journey_version=1,
            source_conversation_id="conv-1",
            window_index=0,
            window_start=0,
            window_end=7,
            selected_steps=steps,
            claimed=claimed2,
            existing_published_version=None,
        )
    assert exc2.value.detail["reason"] == "steps_hash_mismatch"


def test_publish_rejects_wrong_and_stale_version():
    steps = _steps()
    claimed, _ = _lineage(steps, version=1)
    with pytest.raises(HTTPException) as exc:
        validate_publish_journey_lineage(
            request_conversation_id="conv-1",
            journey_id="journey-a",
            journey_version=1,
            source_conversation_id="conv-1",
            window_index=0,
            window_start=0,
            window_end=7,
            selected_steps=steps,
            claimed=claimed,
            existing_published_version=2,
        )
    assert exc.value.detail["reason"] == "version_mismatch"

    claimed_v2, hashes_v2 = _lineage(steps, version=2)
    # Stale prepared v2 while DB already at v3
    with pytest.raises(HTTPException) as exc2:
        validate_publish_journey_lineage(
            request_conversation_id="conv-1",
            journey_id="journey-a",
            journey_version=2,
            source_conversation_id="conv-1",
            window_index=0,
            window_start=0,
            window_end=7,
            selected_steps=steps,
            claimed=claimed_v2,
            existing_published_version=3,
        )
    assert exc2.value.detail["reason"] == "version_mismatch"
    assert hashes_v2["selectedStepsHash"]


def test_publish_rejects_missing_interpretation_landing_prompt_generation():
    steps = _steps()
    for key, reason in (
        ("interpretationHash", "interpretation_mismatch"),
        ("publicLandingHash", "landing_mismatch"),
        ("mappedPromptHash", "prompt_mismatch"),
        ("generationId", "generation_mismatch"),
    ):
        claimed, _ = _lineage(steps)
        claimed[key] = ""
        with pytest.raises(HTTPException) as exc:
            validate_publish_journey_lineage(
                request_conversation_id="conv-1",
                journey_id="journey-a",
                journey_version=1,
                source_conversation_id="conv-1",
                window_index=0,
                window_start=0,
                window_end=7,
                selected_steps=steps,
                claimed=claimed,
                existing_published_version=None,
            )
        assert exc.value.detail["reason"] == reason


def test_flat_vs_nested_hash_disagreement():
    steps = _steps()
    claimed, _ = _lineage(steps)
    with pytest.raises(HTTPException) as exc:
        validate_publish_journey_lineage(
            request_conversation_id="conv-1",
            journey_id="journey-a",
            journey_version=1,
            source_conversation_id="conv-1",
            window_index=0,
            window_start=0,
            window_end=7,
            selected_steps=steps,
            claimed=claimed,
            existing_published_version=None,
            flat_overrides={"interpretationHash": "tampered-interp"},
        )
    assert exc.value.detail["reason"] == "interpretation_mismatch"


def test_identical_retry_allowed_different_content_rejected():
    steps = _steps()
    claimed, hashes = _lineage(steps)
    ok = validate_publish_journey_lineage(
        request_conversation_id="conv-1",
        journey_id="journey-a",
        journey_version=1,
        source_conversation_id="conv-1",
        window_index=0,
        window_start=0,
        window_end=7,
        selected_steps=steps,
        claimed=claimed,
        existing_published_version=1,
        existing_selected_steps_hash=hashes["selectedStepsHash"],
    )
    assert ok["identicalRetry"] is True
    assert ok["publishVersion"] == 1

    mutated = _steps(answer_suffix=" CHANGED")
    claimed_mut, hashes_mut = _lineage(mutated)
    # Same version claim with different steps hash vs stored → reject
    with pytest.raises(HTTPException) as exc:
        validate_publish_journey_lineage(
            request_conversation_id="conv-1",
            journey_id="journey-a",
            journey_version=1,
            source_conversation_id="conv-1",
            window_index=0,
            window_start=0,
            window_end=7,
            selected_steps=mutated,
            claimed=claimed_mut,
            existing_published_version=1,
            existing_selected_steps_hash=hashes["selectedStepsHash"],
        )
    assert exc.value.detail["reason"] == "steps_hash_mismatch"
    assert hashes_mut["selectedStepsHash"] != hashes["selectedStepsHash"]


def test_draft_mutation_does_not_change_frozen_publish_hashes():
    """Case A: publish hashes come from sealed lineage steps, not a newer draft."""
    steps_a = _steps(journey_tag="A")
    claimed_a, hashes_a = _lineage(steps_a)
    newer_draft = _steps(answer_suffix=" NEWER DRAFT", journey_tag="A")
    # Recompute from newer draft would diverge — publish must keep A hashes.
    newer_hash = compute_selected_steps_hash(newer_draft)
    assert newer_hash != hashes_a["selectedStepsHash"]
    ok = validate_publish_journey_lineage(
        request_conversation_id="conv-1",
        journey_id="journey-a",
        journey_version=1,
        source_conversation_id="conv-1",
        window_index=0,
        window_start=0,
        window_end=7,
        selected_steps=steps_a,
        claimed=claimed_a,
        existing_published_version=None,
    )
    assert ok["selectedStepsHash"] == hashes_a["selectedStepsHash"]


def test_journey_a_and_b_lineages_independent():
    steps_a = _steps(start=0, journey_tag="A")
    steps_b = _steps(start=8, journey_tag="B")
    claimed_a, hashes_a = _lineage(steps_a, journey_id="journey-a")
    claimed_b, hashes_b = _lineage(
        steps_b, journey_id="journey-b", version=1, conv="conv-1"
    )
    assert hashes_a["selectedStepsHash"] != hashes_b["selectedStepsHash"]
    assert claimed_a["windowIndex"] == 0
    assert claimed_b["windowIndex"] == 1
    ok_a = validate_publish_journey_lineage(
        request_conversation_id="conv-1",
        journey_id="journey-a",
        journey_version=1,
        source_conversation_id="conv-1",
        window_index=0,
        window_start=0,
        window_end=7,
        selected_steps=steps_a,
        claimed=claimed_a,
        existing_published_version=None,
    )
    ok_b = validate_publish_journey_lineage(
        request_conversation_id="conv-1",
        journey_id="journey-b",
        journey_version=1,
        source_conversation_id="conv-1",
        window_index=1,
        window_start=8,
        window_end=15,
        selected_steps=steps_b,
        claimed=claimed_b,
        existing_published_version=None,
    )
    assert ok_a["selectedStepsHash"] == hashes_a["selectedStepsHash"]
    assert ok_b["selectedStepsHash"] == hashes_b["selectedStepsHash"]
    # Publishing A with B steps must fail
    with pytest.raises(HTTPException):
        validate_publish_journey_lineage(
            request_conversation_id="conv-1",
            journey_id="journey-a",
            journey_version=1,
            source_conversation_id="conv-1",
            window_index=0,
            window_start=0,
            window_end=7,
            selected_steps=steps_b,
            claimed=claimed_a,
            existing_published_version=None,
        )


def test_narrative_alignment_old_scene_rejects_new_scene():
    claimed = {
        "journeyId": "journey-a",
        "journeyVersion": 1,
        "windowHash": "hwindow",
        "generationId": "gen-new",
        "sceneAssetId": "scene-new",
        "publicLandingHash": "landing-new",
    }
    with pytest.raises(HTTPException) as exc:
        validate_narrative_alignment_binding(
            claimed_lineage=claimed,
            alignment={
                "journeyId": "journey-a",
                "journeyVersion": 1,
                "windowHash": "hwindow",
                "generationId": "gen-new",
                "sceneAssetId": "scene-old",
                "publicLandingHash": "landing-new",
            },
            actual_scene_asset_id="scene-new",
            actual_public_landing_hash="landing-new",
        )
    assert exc.value.detail["code"] == "journey_publish_lineage_mismatch"
    assert exc.value.detail["reason"] == "scene_asset_mismatch"


def test_privacy_email_phone_token_private_marker():
    steps = _steps()
    steps[0]["publicQuestion"] = "Yaz aile@ornek.com adresine."
    out = sanitize_selected_journey_steps(steps)
    assert out["status"] == SANITIZATION_SANITIZED
    assert "email" in out["flags"]

    steps2 = _steps()
    steps2[1]["publicAnswer"] = "Ara +90 532 111 22 33"
    out2 = sanitize_selected_journey_steps(steps2)
    assert out2["status"] == SANITIZATION_SANITIZED
    assert "phone" in out2["flags"]

    steps3 = _steps()
    steps3[2]["publicAnswer"] = "token sk-proj-abcdefghijklmnopqrstuvwxyz123456"
    out3 = sanitize_selected_journey_steps(steps3)
    assert "secret_token" in out3["flags"] or out3["status"] in (
        SANITIZATION_SANITIZED,
        SANITIZATION_BLOCKED,
    )

    steps4 = _steps()
    steps4[3]["publicQuestion"] = "SECRET_PERSON_42 kim?"
    out4 = sanitize_selected_journey_steps(steps4)
    assert out4["status"] == SANITIZATION_BLOCKED
    assert "private_marker" in out4["flags"]


def test_privacy_tc_kimlik_and_address_detectors():
    """Existing detectors: tc_kimlik + address → block (no surgical rewrite)."""
    steps = _steps()
    steps[0]["publicAnswer"] = "TC kimliğim 12345678901"
    out = sanitize_selected_journey_steps(steps)
    assert out["status"] == SANITIZATION_BLOCKED
    assert "tc_kimlik" in out["flags"]

    steps2 = _steps()
    steps2[1]["publicAnswer"] = "Kadıköy Caferağa Mah. Moda Cad. No. 12 daire 3"
    out2 = sanitize_selected_journey_steps(steps2)
    assert out2["status"] == SANITIZATION_BLOCKED
    assert "address" in out2["flags"]


def test_next_version_publish_after_v1():
    steps = _steps()
    claimed_v2, _ = _lineage(steps, version=2)
    ok = validate_publish_journey_lineage(
        request_conversation_id="conv-1",
        journey_id="journey-a",
        journey_version=2,
        source_conversation_id="conv-1",
        window_index=0,
        window_start=0,
        window_end=7,
        selected_steps=steps,
        claimed=claimed_v2,
        existing_published_version=1,
    )
    assert ok["publishVersion"] == 2
    assert ok["identicalRetry"] is False
