# -*- coding: utf-8 -*-
"""sourceBlockHash publish claim vs durable generation record."""

from __future__ import annotations

import copy
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.services.mirror.journey_generation_lineage import (
    validate_against_server_generation_record,
    validate_publish_journey_lineage,
)
from backend.services.mirror.journey_window_hashes import (
    compute_scoped_input_hash,
    compute_selected_steps_hash,
    compute_source_block_hash,
    compute_window_hash,
)
from backend.services.mirror_network.publish import (
    _build_claimed_journey_generation_lineage,
)


SCENE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"


def _steps(count: int = 8, *, answer_suffix: str = "", id_suffix: str = ""):
    return [
        {
            "stepIndex": i + 1,
            "sourceOrder": i,
            "sourceUserMessageId": f"u-block-{i + 1}{id_suffix}",
            "sourceAssistantMessageId": f"a-block-{i + 1}{id_suffix}",
            "publicQuestion": f"Soru {i + 1}?\n\nDevam.",
            "publicAnswer": f"Satır bir.\n\nSatır iki.{answer_suffix}"
            if i == 0
            else f"Cevap {i + 1}.",
        }
        for i in range(count)
    ]


def _claimed(steps, *, source_block_hash: str | None, generation_id="gen-block-1"):
    return {
        "journeyId": "journey-block",
        "journeyVersion": 1,
        "sourceConversationId": "conv-block",
        "windowIndex": 0,
        "windowStart": 0,
        "windowEnd": 7,
        "windowHash": compute_window_hash(steps),
        "scopedInputHash": compute_scoped_input_hash(
            journey_id="journey-block",
            journey_version=1,
            source_conversation_id="conv-block",
            window_index=0,
            window_start=0,
            window_end=7,
            steps=steps,
        ),
        "selectedStepsHash": compute_selected_steps_hash(steps),
        "sourceBlockHash": source_block_hash,
        "interpretationHash": "interp-block",
        "publicLandingHash": "landing-block",
        "mappedPromptHash": "prompt-block",
        "generationId": generation_id,
        "sceneAssetId": SCENE,
    }


def _record(steps):
    claimed = _claimed(steps, source_block_hash=compute_source_block_hash(steps))
    return {
        "generationId": claimed["generationId"],
        "journeyId": claimed["journeyId"],
        "journeyVersion": claimed["journeyVersion"],
        "sourceConversationId": claimed["sourceConversationId"],
        "windowHash": claimed["windowHash"],
        "scopedInputHash": claimed["scopedInputHash"],
        "selectedStepsHash": claimed["selectedStepsHash"],
        "sourceBlockHash": claimed["sourceBlockHash"],
        "interpretationHash": claimed["interpretationHash"],
        "mappedPromptHash": claimed["mappedPromptHash"],
        "publicLandingHash": claimed["publicLandingHash"],
        "sceneAssetId": SCENE,
    }


def _validate(claimed, record, steps):
    return validate_against_server_generation_record(
        claimed=claimed,
        record=record,
        actual_public_landing_hash="landing-block",
        actual_scene_asset_id=SCENE,
        selected_steps=steps,
    )


def test_claimed_lineage_preserves_nested_source_block_hash():
    body = SimpleNamespace(
        journeyGenerationLineage={
            "journeyId": "journey-block",
            "windowHash": "h-window",
            "sourceBlockHash": "b-sealed-from-prepare",
            "generationId": "gen-block-1",
        },
        journeyId="ignored-when-nested",
        journeyVersion=None,
        sourceConversationId=None,
        windowIndex=None,
        windowStart=None,
        windowEnd=None,
        windowHash=None,
        sourceBlockHash="b-should-not-override-nested",
        scopedInputHash=None,
        selectedStepsHash=None,
        interpretationHash=None,
        anchorsHash=None,
        publicLandingHash=None,
        mappedPromptHash=None,
        generationId=None,
        sceneAssetId=None,
        conversationId="conv-block",
    )
    claimed = _build_claimed_journey_generation_lineage(body)
    assert claimed["sourceBlockHash"] == "b-sealed-from-prepare"


def test_claimed_lineage_fills_source_block_hash_from_flat_when_nested_omits():
    body = SimpleNamespace(
        journeyGenerationLineage={"journeyId": "journey-block"},
        journeyId=None,
        journeyVersion=None,
        sourceConversationId=None,
        windowIndex=None,
        windowStart=None,
        windowEnd=None,
        windowHash=None,
        sourceBlockHash="b-flat-only",
        scopedInputHash=None,
        selectedStepsHash=None,
        interpretationHash=None,
        anchorsHash=None,
        publicLandingHash=None,
        mappedPromptHash=None,
        generationId=None,
        sceneAssetId=None,
        conversationId="conv-block",
    )
    claimed = _build_claimed_journey_generation_lineage(body)
    assert claimed["sourceBlockHash"] == "b-flat-only"


def test_a_explicit_wrong_source_block_hash_rejected():
    steps = _steps(8)
    record = _record(steps)
    claimed = _claimed(steps, source_block_hash="bdeadbeef")
    with pytest.raises(HTTPException) as exc:
        _validate(claimed, record, steps)
    assert exc.value.detail["code"] == "journey_publish_lineage_mismatch"
    assert exc.value.detail["reason"] == "source_block_hash_mismatch"
    assert "does not match server generation record" in exc.value.detail["message"]


def test_b_missing_claim_with_six_steps_fail_closed():
    full = _steps(8)
    six = full[:6]
    record = _record(six)
    record["sourceBlockHash"] = compute_source_block_hash(full)
    claimed = _claimed(six, source_block_hash=None)
    with pytest.raises(HTTPException) as exc:
        _validate(claimed, record, six)
    assert exc.value.detail["reason"] == "source_block_hash_mismatch"
    assert "missing on lineage" in exc.value.detail["message"]


def test_c_missing_claim_with_seven_steps_fail_closed():
    full = _steps(8)
    seven = full[:7]
    record = _record(seven)
    record["sourceBlockHash"] = compute_source_block_hash(full)
    claimed = _claimed(seven, source_block_hash=None)
    with pytest.raises(HTTPException) as exc:
        _validate(claimed, record, seven)
    assert exc.value.detail["reason"] == "source_block_hash_mismatch"
    assert "missing on lineage" in exc.value.detail["message"]


def test_d_missing_claim_exact_8_recompute_matches_record():
    raw = _steps(8)
    record = _record(raw)
    claimed = _claimed(raw, source_block_hash=None)
    frozen = copy.deepcopy(raw)
    ok = _validate(claimed, record, raw)
    assert ok["generationId"] == "gen-block-1"
    assert ok["interpretationHash"] == "interp-block"
    assert ok["mappedPromptHash"] == "prompt-block"
    assert ok["publicLandingHash"] == "landing-block"
    assert ok["sceneAssetId"] == SCENE
    assert claimed.get("sourceBlockHash") in (None, "")
    assert raw == frozen


def test_e_missing_claim_exact_8_meaningful_text_tamper_rejected():
    original = _steps(8)
    record = _record(original)
    tampered = copy.deepcopy(original)
    tampered[0]["publicAnswer"] = "Satır bir. Satır iki TAMPER."
    claimed = _claimed(original, source_block_hash=None)
    with pytest.raises(HTTPException) as exc:
        _validate(claimed, record, tampered)
    assert exc.value.detail["reason"] == "source_block_hash_mismatch"
    assert "recompute from selectedSteps" in exc.value.detail["message"]


def test_f_missing_claim_exact_8_source_id_tamper_rejected():
    original = _steps(8)
    record = _record(original)
    tampered = copy.deepcopy(original)
    tampered[2]["sourceUserMessageId"] = "u-tampered"
    claimed = _claimed(original, source_block_hash=None)
    with pytest.raises(HTTPException) as exc:
        _validate(claimed, record, tampered)
    assert exc.value.detail["reason"] == "source_block_hash_mismatch"


def test_g_valid_block_hash_but_changed_steps_rejected_by_window_hashes():
    original = _steps(8)
    claimed = _claimed(
        original, source_block_hash=compute_source_block_hash(original)
    )
    tampered = copy.deepcopy(original)
    tampered[0]["publicAnswer"] = "Anlamli degisiklik."
    with pytest.raises(HTTPException) as exc:
        validate_publish_journey_lineage(
            request_conversation_id="conv-block",
            journey_id="journey-block",
            journey_version=1,
            source_conversation_id="conv-block",
            window_index=0,
            window_start=0,
            window_end=7,
            selected_steps=tampered,
            claimed=claimed,
            existing_published_version=None,
        )
    assert exc.value.detail["code"] == "journey_publish_lineage_mismatch"
    assert exc.value.detail["reason"] == "window_mismatch"


def test_h_wrong_generation_id_rejected():
    steps = _steps(8)
    record = _record(steps)
    claimed = _claimed(
        steps, source_block_hash=compute_source_block_hash(steps)
    )
    claimed["generationId"] = "gen-other"
    with pytest.raises(HTTPException) as exc:
        _validate(claimed, record, steps)
    assert exc.value.detail["reason"] == "generation_mismatch"


def test_i_wrong_journey_id_and_version_rejected():
    steps = _steps(8)
    record = _record(steps)
    claimed = _claimed(
        steps, source_block_hash=compute_source_block_hash(steps)
    )
    claimed["journeyId"] = "journey-other"
    with pytest.raises(HTTPException) as exc_j:
        _validate(claimed, record, steps)
    assert exc_j.value.detail["reason"] == "journey_mismatch"

    claimed_ok = _claimed(
        steps, source_block_hash=compute_source_block_hash(steps)
    )
    claimed_ok["journeyVersion"] = 9
    with pytest.raises(HTTPException) as exc_v:
        _validate(claimed_ok, record, steps)
    assert exc_v.value.detail["reason"] == "version_mismatch"


def test_explicit_sealed_claim_six_and_seven_pass_when_matching_record():
    full = _steps(8)
    block_hash = compute_source_block_hash(full)
    for count in (6, 7):
        subset = full[:count]
        record = _record(subset)
        record["sourceBlockHash"] = block_hash
        claimed = _claimed(subset, source_block_hash=block_hash)
        ok = _validate(claimed, record, subset)
        assert ok["generationId"] == "gen-block-1"


def test_historical_ready_omitted_claim_exact_8_raw_newlines_compatible():
    """READY with raw selectedSteps and omitted HTTP sourceBlockHash still binds."""
    raw = _steps(8)
    record = _record(raw)
    claimed = _claimed(raw, source_block_hash=None)
    ok = _validate(claimed, record, raw)
    assert ok["interpretationHash"] == record["interpretationHash"]
    assert ok["mappedPromptHash"] == record["mappedPromptHash"]
    assert ok["generationId"] == record["generationId"]
    assert raw[0]["publicAnswer"].startswith("Satır bir.\n\n")
