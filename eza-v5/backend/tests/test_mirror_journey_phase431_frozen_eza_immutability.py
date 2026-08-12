# -*- coding: utf-8 -*-
"""Phase 4.3.1 — Frozen EZA immutability + exact Q/A binding."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.services.mirror_network.frozen_journey_artifact import (
    assert_frozen_content_immutable,
    build_durable_frozen_journey_artifact,
    to_public_frozen_journey_artifact,
)
from backend.services.mirror_network.frozen_step_eza import (
    compute_frozen_eza_snapshots_hash,
    normalize_frozen_step_eza_snapshot,
    project_public_frozen_step_eza,
    prove_and_normalize_frozen_step_eza_snapshot,
)


SCENE_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
URL_A = "https://cdn.example/scene-a.jpg"


def _eza(score: float, assistant_id: str, user_id: str = "user-1") -> dict:
    return prove_and_normalize_frozen_step_eza_snapshot(
        {
            "assistantScore": score,
            "userScore": score - 5,
            "sourceAssistantMessageId": assistant_id,
            "sourceUserMessageId": user_id,
            "behavioral": {
                "schema_version": 1,
                "interaction_id": assistant_id,
                "mode": "standalone",
                "vector": {
                    "input_risk": 0.1,
                    "output_risk": 0.1,
                    "input_health": 0.8,
                    "output_health": 0.9,
                    "alignment_score": 0.7,
                    "eza_final": score,
                    "intent": "explore",
                    "redirect": False,
                    "policy_violation_count": 0,
                },
            },
        },
        source_assistant_message_id=assistant_id,
        source_user_message_id=user_id,
    )


def _steps_with_eza(score: float) -> list[dict]:
    steps = []
    for i in range(1, 7):
        aid = f"a{i}"
        uid = f"u{i}"
        steps.append(
            {
                "stepIndex": i,
                "sourceOrder": i - 1,
                "sourceUserMessageId": uid,
                "sourceAssistantMessageId": aid,
                "publicQuestion": f"Q{i}?",
                "publicAnswer": f"A{i}.",
                "ezaSnapshot": _eza(score + i * 0.01, aid, uid),
            }
        )
    return steps


def _build_freeze(steps: list[dict], *, version: int = 1, gen: str = "gen-1"):
    eza_hash = compute_frozen_eza_snapshots_hash(steps)
    return build_durable_frozen_journey_artifact(
        journey_id="journey-eza-imm",
        journey_version=version,
        source_conversation_id="conv",
        author_user_id="user-a",
        parent_slug=None,
        block_index=0,
        block_start=0,
        block_end=7,
        source_block_hash=None,
        selected_steps=steps,
        public_title="T",
        public_summary="S",
        continuation_context=None,
        public_landing_hash="landing-1",
        public_landing_contract_version="mirror-public-landing-v1",
        scene_asset_id=SCENE_A,
        scene_image_url=URL_A,
        generation_id=gen,
        selected_steps_hash="steps-hash-1",
        scoped_input_hash=None,
        window_hash=None,
        interpretation_hash=None,
        anchors_hash=None,
        mapped_prompt_hash=None,
        narrative_alignment={},
        sanitization_status="clean",
        sanitization_flags=[],
        original_step_hashes=None,
        public_step_hashes=None,
        frozen_eza_snapshots_hash=eza_hash,
    )


def test_a_freeze_v1_eza_91_readable():
    steps = _steps_with_eza(91)
    frozen = _build_freeze(steps)
    assert frozen["frozenEzaSnapshotsHash"]
    assert steps[0]["ezaSnapshot"]["assistantScore"] == pytest.approx(91.01, abs=0.02)


def test_b_same_version_identical_retry_ok():
    steps = _steps_with_eza(91)
    frozen = _build_freeze(steps)
    eza_hash = frozen["frozenEzaSnapshotsHash"]
    assert_frozen_content_immutable(
        existing_frozen=frozen,
        selected_steps_hash="steps-hash-1",
        public_landing_hash="landing-1",
        scene_asset_id=SCENE_A,
        generation_id="gen-1",
        frozen_eza_snapshots_hash=eza_hash,
    )


def test_c_same_version_eza_score_change_rejects():
    steps_91 = _steps_with_eza(91)
    frozen = _build_freeze(steps_91)
    steps_84 = _steps_with_eza(84)
    mutated_hash = compute_frozen_eza_snapshots_hash(steps_84)
    with pytest.raises(HTTPException) as exc:
        assert_frozen_content_immutable(
            existing_frozen=frozen,
            selected_steps_hash="steps-hash-1",
            public_landing_hash="landing-1",
            scene_asset_id=SCENE_A,
            generation_id="gen-1",
            frozen_eza_snapshots_hash=mutated_hash,
        )
    assert exc.value.detail["code"] == "journey_frozen_immutable"
    assert exc.value.detail["reason"] == "eza_snapshot_mismatch"


def test_d_one_step_eza_change_rejects():
    steps = _steps_with_eza(91)
    frozen = _build_freeze(steps)
    mutated = [dict(s) for s in steps]
    mutated[2] = {
        **mutated[2],
        "ezaSnapshot": _eza(50, mutated[2]["sourceAssistantMessageId"], mutated[2]["sourceUserMessageId"]),
    }
    with pytest.raises(HTTPException) as exc:
        assert_frozen_content_immutable(
            existing_frozen=frozen,
            selected_steps_hash="steps-hash-1",
            public_landing_hash="landing-1",
            scene_asset_id=SCENE_A,
            generation_id="gen-1",
            frozen_eza_snapshots_hash=compute_frozen_eza_snapshots_hash(mutated),
        )
    assert exc.value.detail["reason"] == "eza_snapshot_mismatch"


def test_e_v1_and_v2_coexist_with_different_eza():
    v1_steps = _steps_with_eza(91)
    v2_steps = _steps_with_eza(84)
    v1 = _build_freeze(v1_steps, version=1, gen="gen-v1")
    v2 = _build_freeze(v2_steps, version=2, gen="gen-v2")
    assert v1["frozenEzaSnapshotsHash"] != v2["frozenEzaSnapshotsHash"]
    assert v1["journeyVersion"] == 1
    assert v2["journeyVersion"] == 2


def test_f_missing_eza_remains_valid():
    steps = _steps_with_eza(91)
    steps[0] = {**steps[0], "ezaSnapshot": None}
    frozen = _build_freeze(steps)
    assert frozen["frozenEzaSnapshotsHash"]
    public = to_public_frozen_journey_artifact(
        {
            "replayReady": True,
            "slug": "journey-eza-imm",
            "journeyId": "journey-eza-imm",
            "journeyVersion": 1,
            "authorUserId": "user-a",
            "selectedCount": 6,
            "publicTitle": "T",
            "selectedSteps": [
                {
                    "stepIndex": s["stepIndex"],
                    "publicQuestion": s["publicQuestion"],
                    "publicAnswer": s["publicAnswer"],
                    "ezaSnapshot": s["ezaSnapshot"],
                }
                for s in steps
            ],
        }
    )
    assert public is not None
    assert "ezaSnapshot" not in public["steps"][0]
    assert "ezaSnapshot" in public["steps"][1]


def test_g_absent_to_present_is_mutation():
    steps_absent = _steps_with_eza(91)
    steps_absent[0] = {**steps_absent[0], "ezaSnapshot": None}
    frozen = _build_freeze(steps_absent)
    steps_present = _steps_with_eza(91)
    with pytest.raises(HTTPException) as exc:
        assert_frozen_content_immutable(
            existing_frozen=frozen,
            selected_steps_hash="steps-hash-1",
            public_landing_hash="landing-1",
            scene_asset_id=SCENE_A,
            generation_id="gen-1",
            frozen_eza_snapshots_hash=compute_frozen_eza_snapshots_hash(steps_present),
        )
    assert exc.value.detail["reason"] == "eza_snapshot_mismatch"


def test_h_exact_identity_accepted():
    snap = prove_and_normalize_frozen_step_eza_snapshot(
        {
            "assistantScore": 91,
            "sourceAssistantMessageId": "a1",
            "behavioral": {
                "interaction_id": "a1",
                "vector": {"eza_final": 91, "input_health": 0.8, "output_health": 0.9},
            },
        },
        source_assistant_message_id="a1",
        source_user_message_id="u1",
    )
    assert snap is not None
    assert snap["assistantScore"] == 91
    assert snap["sourceAssistantMessageId"] == "a1"


def test_i_wrong_assistant_eza_rejected():
    with pytest.raises(HTTPException) as exc:
        prove_and_normalize_frozen_step_eza_snapshot(
            {
                "assistantScore": 91,
                "sourceAssistantMessageId": "a2",
            },
            source_assistant_message_id="a1",
        )
    assert exc.value.detail["code"] == "journey_eza_snapshot_mismatch"


def test_j_missing_provenance_omitted_not_auto_stamped():
    # Scores only, no identity → omit (fail closed).
    assert (
        prove_and_normalize_frozen_step_eza_snapshot(
            {"assistantScore": 91},
            source_assistant_message_id="a1",
        )
        is None
    )
    # Legacy normalize may still stamp for internal use — prove path must not.
    stamped = normalize_frozen_step_eza_snapshot(
        {"assistantScore": 91},
        source_assistant_message_id="a1",
    )
    assert stamped is not None
    assert stamped["sourceAssistantMessageId"] == "a1"


def test_k_deselected_eza_not_on_selected_hash_rows():
    selected = _steps_with_eza(91)
    deselected_eza = _eza(99, "secret-a", "secret-u")
    hash_a = compute_frozen_eza_snapshots_hash(selected)
    contaminated = selected + [
        {
            "stepIndex": 99,
            "sourceAssistantMessageId": "secret-a",
            "ezaSnapshot": deselected_eza,
        }
    ]
    # Contaminating with an extra step changes hash — selected-only set is authoritative.
    assert compute_frozen_eza_snapshots_hash(contaminated) != hash_a


def test_l_ambiguous_interaction_ids_fail_closed():
    with pytest.raises(HTTPException) as exc:
        prove_and_normalize_frozen_step_eza_snapshot(
            {
                "assistantScore": 91,
                "sourceAssistantMessageId": "a1",
                "behavioral": {
                    "interaction_id": "a2",
                    "vector": {"eza_final": 91, "input_health": 0.8, "output_health": 0.9},
                },
            },
            source_assistant_message_id="a1",
        )
    assert exc.value.detail["code"] == "journey_eza_snapshot_mismatch"


def test_public_never_exposes_frozen_eza_hash_or_source_ids():
    steps = _steps_with_eza(91)
    frozen = _build_freeze(steps)
    package = {
        "replayReady": True,
        "slug": frozen["slug"],
        "journeyId": frozen["journeyId"],
        "journeyVersion": 1,
        "authorUserId": "user-a",
        "selectedCount": 6,
        "publicTitle": "T",
        "selectedSteps": steps,
        "integrity": {
            "frozenEzaSnapshotsHash": frozen["frozenEzaSnapshotsHash"],
            "selectedStepsHash": frozen["selectedStepsHash"],
        },
    }
    public = to_public_frozen_journey_artifact(package)
    assert public is not None
    blob = str(public)
    assert "frozenEzaSnapshotsHash" not in blob
    assert "sourceAssistantMessageId" not in blob
    assert "ezaVisibilityEnabled" not in blob
    assert project_public_frozen_step_eza(steps[0]["ezaSnapshot"])["assistantScore"] == pytest.approx(
        91.01, abs=0.02
    )
