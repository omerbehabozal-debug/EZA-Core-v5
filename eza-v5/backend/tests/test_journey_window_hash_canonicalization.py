# -*- coding: utf-8 -*-
"""Regression: prepare and publish must hash the same canonical Journey Q/A.

Production failure: journey_publish_lineage_mismatch / window_mismatch because
prepare hashed sanitize_display_text(selectedSteps) while publish hashed raw
Review text (newlines / repeated whitespace). Existing READY artifacts keep
raw selectedSteps and must publish after this server fix with no mutation.
"""

from __future__ import annotations

import copy
import json

import pytest
from fastapi import HTTPException

from backend.core.schemas.mirror_draft import sanitize_display_text
from backend.core.schemas.mirror_prepare_director import (
    MirrorConversationMessageDTO,
    MirrorJourneySelectedStepScopeDTO,
)
from backend.services.mirror.journey_generation_lineage import (
    build_journey_generation_lineage,
    recompute_hashes_from_steps,
    validate_publish_journey_lineage,
)
from backend.services.mirror.journey_semantic_scope import (
    JOURNEY_SEMANTIC_SCOPE_V1,
    validate_journey_semantic_scope,
)
from backend.services.mirror.journey_window_hashes import (
    canonicalize_journey_qa_text,
    canonicalize_selected_journey_steps,
    compute_scoped_input_hash,
    compute_selected_steps_hash,
    compute_window_hash,
)


RAW_MULTILINE_ANSWER = "Satır bir.\n\nSatır iki."
CANONICAL_MULTILINE_ANSWER = "Satır bir. Satır iki."


def _raw_steps():
    steps = []
    for i in range(8):
        answer = RAW_MULTILINE_ANSWER if i == 0 else f"Cevap {i + 1}  tek   satır."
        question = f"Soru {i + 1}?\n\nDevam."
        steps.append(
            {
                "stepIndex": i + 1,
                "sourceOrder": i,
                "sourceUserMessageId": f"u-canon-{i + 1}",
                "sourceAssistantMessageId": f"a-canon-{i + 1}",
                "publicQuestion": question,
                "publicAnswer": answer,
            }
        )
    return steps


def _prepare_dto_steps(raw_steps):
    return [
        MirrorJourneySelectedStepScopeDTO.model_validate(step).model_dump()
        for step in raw_steps
    ]


def _messages_from_steps(steps):
    rows = []
    for step in steps:
        rows.append(
            {
                "role": "user",
                "text": step["publicQuestion"],
                "sequence": int(step["sourceOrder"]) * 2,
            }
        )
        rows.append(
            {
                "role": "assistant",
                "text": step["publicAnswer"],
                "sequence": int(step["sourceOrder"]) * 2 + 1,
            }
        )
    return rows


def _prepare_dto_messages(raw_steps):
    return [
        MirrorConversationMessageDTO.model_validate(row).model_dump()
        for row in _messages_from_steps(raw_steps)
    ]


def _prepare_scope(sanitized_steps, *, journey_id="journey-canon"):
    return {
        "semanticScope": JOURNEY_SEMANTIC_SCOPE_V1,
        "journeyId": journey_id,
        "journeyVersion": 1,
        "sourceConversationId": "conv-canon",
        "windowIndex": 0,
        "windowStart": 0,
        "windowEnd": 7,
        "selectedSteps": sanitized_steps,
    }


def _lineage_from_prepare_meta(meta, *, generation_id="gen-canon-1"):
    return build_journey_generation_lineage(
        journey_id=meta["journeyId"],
        journey_version=meta["journeyVersion"],
        source_conversation_id=meta["sourceConversationId"],
        window_index=meta["windowIndex"],
        window_start=meta["windowStart"],
        window_end=meta["windowEnd"],
        window_hash=meta["windowHash"],
        scoped_input_hash=meta["scopedInputHash"],
        selected_steps_hash=meta["selectedStepsHash"],
        generation_id=generation_id,
        interpretation_hash="interp-canon",
        anchors_hash="anchors-canon",
        public_landing_hash="landing-canon",
        mapped_prompt_hash="prompt-canon",
        scene_asset_id="scene-canon",
        source_block_hash=meta.get("sourceBlockHash"),
        selected_count=meta.get("selectedCount"),
        selected_steps=meta.get("selectedSteps"),
    )


def _publish(*, selected_steps, claimed, journey_id="journey-canon", version=1):
    return validate_publish_journey_lineage(
        request_conversation_id="conv-canon",
        journey_id=journey_id,
        journey_version=version,
        source_conversation_id="conv-canon",
        window_index=0,
        window_start=0,
        window_end=7,
        selected_steps=selected_steps,
        claimed=claimed,
        existing_published_version=None,
    )


def test_a_canonicalization_parity_prepare_dto_vs_publish_hash():
    raw = _raw_steps()
    prepare_steps = _prepare_dto_steps(raw)
    assert prepare_steps[0]["publicAnswer"] == CANONICAL_MULTILINE_ANSWER
    assert canonicalize_journey_qa_text(RAW_MULTILINE_ANSWER) == CANONICAL_MULTILINE_ANSWER
    assert canonicalize_journey_qa_text(raw[0]["publicQuestion"]) == prepare_steps[0][
        "publicQuestion"
    ]

    prepare_window = compute_window_hash(prepare_steps)
    publish_window = compute_window_hash(raw)
    prepare_selected = compute_selected_steps_hash(prepare_steps)
    publish_selected = compute_selected_steps_hash(raw)
    prepare_scoped = compute_scoped_input_hash(
        journey_id="journey-canon",
        journey_version=1,
        source_conversation_id="conv-canon",
        window_index=0,
        window_start=0,
        window_end=7,
        steps=prepare_steps,
    )
    publish_scoped = compute_scoped_input_hash(
        journey_id="journey-canon",
        journey_version=1,
        source_conversation_id="conv-canon",
        window_index=0,
        window_start=0,
        window_end=7,
        steps=raw,
    )
    assert prepare_window == publish_window
    assert prepare_selected == publish_selected
    assert prepare_scoped == publish_scoped
    assert prepare_window.startswith("h")
    assert sanitize_display_text(RAW_MULTILINE_ANSWER, max_len=4000) == (
        CANONICAL_MULTILINE_ANSWER
    )


def test_b_existing_ready_raw_steps_match_prepare_sealed_hash_without_mutation():
    raw = _raw_steps()
    frozen_raw = copy.deepcopy(raw)
    prepare_steps = _prepare_dto_steps(raw)
    claimed_hashes = recompute_hashes_from_steps(
        journey_id="journey-canon",
        journey_version=1,
        source_conversation_id="conv-canon",
        window_index=0,
        window_start=0,
        window_end=7,
        steps=prepare_steps,
    )
    claimed, _unused = (
        build_journey_generation_lineage(
            journey_id="journey-canon",
            journey_version=1,
            source_conversation_id="conv-canon",
            window_index=0,
            window_start=0,
            window_end=7,
            window_hash=claimed_hashes["windowHash"],
            scoped_input_hash=claimed_hashes["scopedInputHash"],
            selected_steps_hash=claimed_hashes["selectedStepsHash"],
            generation_id="gen-ready-existing",
            interpretation_hash="interp-canon",
            public_landing_hash="landing-canon",
            mapped_prompt_hash="prompt-canon",
        ),
        claimed_hashes,
    )
    ok = _publish(selected_steps=raw, claimed=claimed)
    assert ok["windowHash"] == claimed_hashes["windowHash"]
    assert ok["selectedStepsHash"] == claimed_hashes["selectedStepsHash"]
    assert raw[0]["publicAnswer"] == RAW_MULTILINE_ANSWER
    assert raw == frozen_raw


def test_c_prepare_then_publish_multiline_answer():
    raw = _raw_steps()
    prepare_steps = _prepare_dto_steps(raw)
    prepare_messages = _prepare_dto_messages(raw)
    meta = validate_journey_semantic_scope(
        journey_scope=_prepare_scope(prepare_steps),
        messages=prepare_messages,
        request_conversation_id="conv-canon",
    )
    claimed = _lineage_from_prepare_meta(meta)
    ok = _publish(selected_steps=raw, claimed=claimed)
    assert ok["windowHash"] == meta["windowHash"]
    assert ok["generationId"] == "gen-canon-1"
    assert meta["selectedSteps"][0]["publicAnswer"] == CANONICAL_MULTILINE_ANSWER


def test_d_hydrate_json_roundtrip_then_publish():
    raw = _raw_steps()
    prepare_steps = _prepare_dto_steps(raw)
    meta = validate_journey_semantic_scope(
        journey_scope=_prepare_scope(prepare_steps),
        messages=_prepare_dto_messages(raw),
        request_conversation_id="conv-canon",
    )
    artifact = {
        "selectedSteps": raw,
        "lineage": _lineage_from_prepare_meta(meta),
    }
    hydrated = json.loads(json.dumps(artifact, ensure_ascii=False))
    assert hydrated["selectedSteps"][0]["publicAnswer"] == RAW_MULTILINE_ANSWER
    ok = _publish(
        selected_steps=hydrated["selectedSteps"],
        claimed=hydrated["lineage"],
    )
    assert ok["windowHash"] == meta["windowHash"]


def test_e_later_conversation_turns_do_not_change_sealed_window():
    raw = _raw_steps()
    prepare_steps = _prepare_dto_steps(raw)
    meta = validate_journey_semantic_scope(
        journey_scope=_prepare_scope(prepare_steps),
        messages=_prepare_dto_messages(raw),
        request_conversation_id="conv-canon",
    )
    claimed = _lineage_from_prepare_meta(meta)
    later_pair = {
        "stepIndex": 8,
        "sourceOrder": 8,
        "sourceUserMessageId": "u-later",
        "sourceAssistantMessageId": "a-later",
        "publicQuestion": "Dokuzuncu soru?",
        "publicAnswer": "Bu turn seçime girmez.",
    }
    # Sliding "latest 8" (drop first sealed pair, append later Q/A) must not publish.
    latest_eight = copy.deepcopy(raw[1:])
    for i, step in enumerate(latest_eight):
        step["stepIndex"] = i + 1
        step["sourceOrder"] = i
    latest_eight.append(
        {
            **later_pair,
            "stepIndex": 8,
            "sourceOrder": 7,
        }
    )
    with pytest.raises(HTTPException) as exc_latest:
        _publish(selected_steps=latest_eight, claimed=claimed)
    assert exc_latest.value.detail["code"] == "journey_publish_lineage_mismatch"
    assert exc_latest.value.detail["reason"] == "window_mismatch"

    ok = _publish(selected_steps=raw, claimed=claimed)
    assert ok["windowHash"] == meta["windowHash"]



def test_f_meaningful_text_tamper_fails_window_mismatch():
    raw = _raw_steps()
    prepare_steps = _prepare_dto_steps(raw)
    meta = validate_journey_semantic_scope(
        journey_scope=_prepare_scope(prepare_steps),
        messages=_prepare_dto_messages(raw),
        request_conversation_id="conv-canon",
    )
    claimed = _lineage_from_prepare_meta(meta)
    tampered = copy.deepcopy(raw)
    tampered[0]["publicAnswer"] = "Satır bir. Satır iki TAMPER."
    with pytest.raises(HTTPException) as exc:
        _publish(selected_steps=tampered, claimed=claimed)
    assert exc.value.detail["code"] == "journey_publish_lineage_mismatch"
    assert exc.value.detail["reason"] == "window_mismatch"
    assert "windowHash does not match server recompute from selectedSteps" in str(
        exc.value.detail["message"]
    )


def test_g_membership_and_source_id_tamper_fail():
    raw = _raw_steps()
    prepare_steps = _prepare_dto_steps(raw)
    meta = validate_journey_semantic_scope(
        journey_scope=_prepare_scope(prepare_steps),
        messages=_prepare_dto_messages(raw),
        request_conversation_id="conv-canon",
    )
    claimed = _lineage_from_prepare_meta(meta)

    swapped_id = copy.deepcopy(raw)
    swapped_id[3]["sourceUserMessageId"] = "u-tampered-id"
    with pytest.raises(HTTPException) as exc_id:
        _publish(selected_steps=swapped_id, claimed=claimed)
    assert exc_id.value.detail["code"] == "journey_publish_lineage_mismatch"
    assert exc_id.value.detail["reason"] == "window_mismatch"

    dropped = copy.deepcopy(raw)
    dropped[7] = {
        "stepIndex": 8,
        "sourceOrder": 7,
        "sourceUserMessageId": "u-not-in-window",
        "sourceAssistantMessageId": "a-not-in-window",
        "publicQuestion": "Yabancı soru?",
        "publicAnswer": "Yabancı cevap.",
    }
    with pytest.raises(HTTPException) as exc_member:
        _publish(selected_steps=dropped, claimed=claimed)
    assert exc_member.value.detail["code"] == "journey_publish_lineage_mismatch"
    assert exc_member.value.detail["reason"] == "window_mismatch"


def test_h_wrong_journey_and_version_still_fail():
    raw = _raw_steps()
    prepare_steps = _prepare_dto_steps(raw)
    meta = validate_journey_semantic_scope(
        journey_scope=_prepare_scope(prepare_steps),
        messages=_prepare_dto_messages(raw),
        request_conversation_id="conv-canon",
    )
    claimed = _lineage_from_prepare_meta(meta)

    with pytest.raises(HTTPException) as exc_j:
        _publish(
            selected_steps=raw,
            claimed=claimed,
            journey_id="journey-other",
        )
    assert exc_j.value.detail["reason"] == "journey_mismatch"

    with pytest.raises(HTTPException) as exc_v:
        _publish(selected_steps=raw, claimed=claimed, version=2)
    assert exc_v.value.detail["reason"] == "version_mismatch"


def test_whitespace_only_difference_is_intentionally_canonical():
    raw = _raw_steps()
    collapsed = canonicalize_selected_journey_steps(raw)
    assert collapsed[0]["publicAnswer"] == CANONICAL_MULTILINE_ANSWER
    assert compute_window_hash(raw) == compute_window_hash(collapsed)
