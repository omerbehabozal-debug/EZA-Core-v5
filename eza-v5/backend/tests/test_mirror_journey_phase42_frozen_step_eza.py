# -*- coding: utf-8 -*-
"""Phase 4.2 — Frozen step EZA interaction snapshot."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from backend.core.schemas.mirror_network import (
    PublicFrozenJourneyStep,
    PublicFrozenStepEzaSnapshot,
)
from backend.services.mirror_network.frozen_step_eza import (
    FROZEN_STEP_EZA_CONTRACT,
    assert_eza_bound_to_assistant,
    normalize_frozen_step_eza_snapshot,
    project_public_frozen_step_eza,
)
from backend.services.mirror_network.frozen_journey_artifact import (
    project_public_frozen_steps,
    to_public_frozen_journey_artifact,
)


def _behavioral(**overrides):
    base = {
        "schema_version": 1,
        "interaction_id": "eza-msg-1",
        "mode": "standalone",
        "vector": {
            "input_risk": 0.2,
            "output_risk": 0.1,
            "input_health": 0.82,
            "output_health": 0.91,
            "alignment_score": 0.8,
            "eza_final": 95,
            "intent": "explore",
            "alignment_verdict": "aligned",
            "redirect": False,
            "redirect_reason": None,
            "redirect_benign": True,
            "policy_violation_count": 0,
            "deception_score": 0.01,
            "legal_risk_score": 0.0,
            "psych_pressure_score": 0.0,
        },
        "asymmetry": {
            "health_gap": 0.09,
            "risk_delta_output_minus_input": -0.1,
            "index": 0.12,
        },
    }
    base.update(overrides)
    return base


def test_normalize_keeps_canonical_interaction_fields():
    snap = normalize_frozen_step_eza_snapshot(
        {
            "assistantScore": 95,
            "userScore": 88,
            "behavioral": _behavioral(),
        },
        source_assistant_message_id="eza-msg-1",
        source_user_message_id="user-msg-1",
    )
    assert snap is not None
    assert snap["contractVersion"] == FROZEN_STEP_EZA_CONTRACT
    assert snap["assistantScore"] == 95
    assert snap["userScore"] == 88
    assert snap["sourceAssistantMessageId"] == "eza-msg-1"
    assert snap["behavioral"]["vector"]["output_health"] == pytest.approx(0.91)
    # Deep detectors not stored.
    assert "deception_score" not in snap["behavioral"]["vector"]


def test_normalize_scores_only_without_behavioral():
    snap = normalize_frozen_step_eza_snapshot(
        {"assistantScore": 77, "userScore": 70},
        source_assistant_message_id="eza-2",
    )
    assert snap is not None
    assert snap["assistantScore"] == 77
    assert snap["behavioral"] is None


def test_normalize_missing_returns_none():
    assert normalize_frozen_step_eza_snapshot({}) is None
    assert normalize_frozen_step_eza_snapshot(None) is None


def test_normalize_rejects_relationship_map_payload():
    assert (
        normalize_frozen_step_eza_snapshot(
            {
                "assistantScore": 90,
                "relationshipMap": {"islands": []},
            }
        )
        is None
    )


def test_public_projection_allowlist_and_strips_internal():
    internal = normalize_frozen_step_eza_snapshot(
        {
            "assistantScore": 95,
            "userScore": 80,
            "behavioral": _behavioral(),
        },
        source_assistant_message_id="eza-msg-1",
    )
    public = project_public_frozen_step_eza(internal)
    assert public is not None
    assert set(public.keys()) <= {
        "assistantScore",
        "userScore",
        "ezaFinal",
        "outputHealth",
        "inputHealth",
        "alignmentScore",
        "redirect",
        "redirectBenign",
        "intent",
    }
    assert public["assistantScore"] == 95
    assert "behavioral" not in public
    assert "asymmetry" not in public
    assert "sourceAssistantMessageId" not in public
    assert "deception_score" not in str(public)
    assert "relationshipMap" not in str(public)


def test_public_dto_rejects_extra_internal_fields():
    with pytest.raises(ValidationError):
        PublicFrozenStepEzaSnapshot.model_validate(
            {
                "assistantScore": 90,
                "relationshipMap": {"x": 1},
            }
        )
    with pytest.raises(ValidationError):
        PublicFrozenJourneyStep.model_validate(
            {
                "stepIndex": 1,
                "publicQuestion": "q?",
                "publicAnswer": "a.",
                "ezaSnapshot": {
                    "assistantScore": 90,
                    "eza_score_breakdown": {"final_score": 90},
                },
            }
        )


def test_cross_step_binding_mismatch_rejected():
    snap = normalize_frozen_step_eza_snapshot(
        {"assistantScore": 90},
        source_assistant_message_id="eza-A",
    )
    with pytest.raises(HTTPException) as exc:
        assert_eza_bound_to_assistant(
            snapshot=snap,
            source_assistant_message_id="eza-B",
        )
    assert exc.value.detail["code"] == "journey_eza_snapshot_mismatch"


def test_public_steps_include_eza_and_omit_for_missing():
    steps = [
        {
            "stepIndex": 1,
            "publicQuestion": "Q1?",
            "publicAnswer": "A1.",
            "sourceUserMessageId": "u1",
            "sourceAssistantMessageId": "a1",
            "questionHash": "qh",
            "ezaSnapshot": normalize_frozen_step_eza_snapshot(
                {"assistantScore": 95, "behavioral": _behavioral()},
                source_assistant_message_id="a1",
            ),
        },
        {
            "stepIndex": 2,
            "publicQuestion": "Q2?",
            "publicAnswer": "A2.",
            "sourceUserMessageId": "u2",
            "sourceAssistantMessageId": "a2",
            "ezaSnapshot": None,
        },
    ]
    public_steps = project_public_frozen_steps(steps)
    assert len(public_steps) == 2
    assert public_steps[0]["ezaSnapshot"]["assistantScore"] == 95
    assert "ezaSnapshot" not in public_steps[1]
    assert "sourceUserMessageId" not in public_steps[0]
    assert "questionHash" not in public_steps[0]


def test_deselected_secret_with_eza_not_in_public_package():
    package = {
        "replayReady": True,
        "slug": "j-eza",
        "journeyId": "j-eza",
        "journeyVersion": 1,
        "authorUserId": "user-1",
        "selectedCount": 6,
        "publicTitle": "T",
        "selectedSteps": [
            {
                "stepIndex": i,
                "publicQuestion": f"Q{i}?",
                "publicAnswer": f"A{i}.",
                "ezaSnapshot": normalize_frozen_step_eza_snapshot(
                    {"assistantScore": 80 + i},
                    source_assistant_message_id=f"a{i}",
                ),
            }
            for i in range(1, 7)
        ],
        "integrity": {"generationId": "gen-secret"},
        "sourceConversationId": "conv-secret",
    }
    public = to_public_frozen_journey_artifact(package)
    assert public is not None
    assert "SECRET" not in str(public)
    assert "relationshipMap" not in str(public)
    assert "generationId" not in public
    assert all("ezaSnapshot" in s for s in public["steps"])
    blob = str(public)
    assert "ezaVisibilityEnabled" not in blob
    assert "ezaDataProcessingEnabled" not in blob


def test_v1_snapshot_immutable_vs_v2_new_snapshot():
    v1 = normalize_frozen_step_eza_snapshot(
        {"assistantScore": 70, "behavioral": _behavioral(interaction_id="eza-v1")},
        source_assistant_message_id="eza-v1",
    )
    # Later algorithm would produce 99 — frozen v1 must keep 70.
    later = normalize_frozen_step_eza_snapshot(
        {"assistantScore": 99, "behavioral": _behavioral(interaction_id="eza-v2")},
        source_assistant_message_id="eza-v2",
    )
    assert v1["assistantScore"] == 70
    assert later["assistantScore"] == 99
    assert project_public_frozen_step_eza(v1)["assistantScore"] == 70


def test_public_frozen_rejects_profile_fields_on_artifact_steps():
    with pytest.raises(ValidationError):
        PublicFrozenJourneyStep.model_validate(
            {
                "stepIndex": 1,
                "publicQuestion": "q?",
                "publicAnswer": "a.",
                "ezaSnapshot": {
                    "assistantScore": 90,
                    "behavioralHistory": [{"eza_final": 90}],
                },
            }
        )


@pytest.mark.parametrize("n", [6, 7, 8])
def test_public_steps_6_7_8_with_optional_eza(n):
    steps = []
    for i in range(1, n + 1):
        row = {
            "stepIndex": i,
            "publicQuestion": f"Q{i}?",
            "publicAnswer": f"A{i}.",
        }
        if i % 2 == 1:
            row["ezaSnapshot"] = normalize_frozen_step_eza_snapshot(
                {"assistantScore": 60 + i},
                source_assistant_message_id=f"a{i}",
            )
        steps.append(row)
    public = project_public_frozen_steps(steps)
    assert len(public) == n
    assert [s["stepIndex"] for s in public] == list(range(1, n + 1))
    assert "ezaSnapshot" in public[0]
    assert "ezaSnapshot" not in public[1]
