# -*- coding: utf-8 -*-
"""Phase 3.6b — Server payload binding (landing/scene/prompt/interp/generation)."""

from __future__ import annotations

import copy

import pytest
from fastapi import HTTPException

from backend.services.mirror.journey_generation_lineage import (
    build_journey_generation_lineage,
    recompute_hashes_from_steps,
    validate_against_server_generation_record,
    validate_narrative_alignment_binding,
)
from backend.services.mirror.journey_generation_record import (
    clear_journey_generation_records_for_tests,
    get_journey_generation_record,
    upsert_journey_generation_record,
)
from backend.services.mirror.public_landing_hash import (
    compute_public_landing_hash,
    extract_public_landing_from_curiosity,
)
from backend.services.mirror.scene_asset_identity import (
    assert_journey_scene_url_acceptable,
    resolve_scene_asset_id_from_url,
)


SCENE_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
SCENE_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"
URL_A = f"https://api.test.eza.ai/api/public/mirror-scene-assets/{SCENE_A}.png"
URL_B = f"https://api.test.eza.ai/api/public/mirror-scene-assets/{SCENE_B}.png"


def _steps(tag: str = "A", start: int = 0):
    return [
        {
            "stepIndex": i + 1,
            "sourceOrder": start + i,
            "sourceUserMessageId": f"u{tag}{start + i + 1}",
            "sourceAssistantMessageId": f"a{tag}{start + i + 1}",
            "publicQuestion": f"{tag} BMW soru {start + i + 1}?",
            "publicAnswer": f"{tag} BMW cevap {start + i + 1}.",
        }
        for i in range(8)
    ]


def _landing(**overrides):
    base = {
        "publicTitle": "Aile için doğru SUV",
        "publicSummary": "BMW X3 ile Mercedes GLC arasında aile konforu.",
        "continuationContext": "Hangi uzun yol özelliği daha kritik?",
        "contractVersion": "mirror-public-landing-v1",
        "semanticSource": "d2_interpretation",
    }
    base.update(overrides)
    return base


@pytest.fixture(autouse=True)
def _clear_records():
    clear_journey_generation_records_for_tests()
    yield
    clear_journey_generation_records_for_tests()


def _seed_record(*, generation_id: str, steps, landing, scene_id=SCENE_A, journey_id="journey-a"):
    hashes = recompute_hashes_from_steps(
        journey_id=journey_id,
        journey_version=1,
        source_conversation_id="conv-1",
        window_index=0 if steps[0]["sourceOrder"] == 0 else 1,
        window_start=steps[0]["sourceOrder"],
        window_end=steps[0]["sourceOrder"] + 7,
        steps=steps,
    )
    landing_hash = compute_public_landing_hash(landing)
    record = upsert_journey_generation_record(
        generation_id,
        {
            "journeyId": journey_id,
            "journeyVersion": 1,
            "sourceConversationId": "conv-1",
            "windowIndex": 0 if steps[0]["sourceOrder"] == 0 else 1,
            "windowStart": steps[0]["sourceOrder"],
            "windowEnd": steps[0]["sourceOrder"] + 7,
            "windowHash": hashes["windowHash"],
            "scopedInputHash": hashes["scopedInputHash"],
            "selectedStepsHash": hashes["selectedStepsHash"],
            "interpretationHash": "interp-server-a",
            "mappedPromptHash": "prompt-server-a",
            "publicLandingHash": landing_hash,
            "sceneAssetId": scene_id,
        },
    )
    lineage = build_journey_generation_lineage(
        journey_id=journey_id,
        journey_version=1,
        source_conversation_id="conv-1",
        window_index=record["windowIndex"],
        window_start=record["windowStart"],
        window_end=record["windowEnd"],
        window_hash=hashes["windowHash"],
        scoped_input_hash=hashes["scopedInputHash"],
        selected_steps_hash=hashes["selectedStepsHash"],
        generation_id=generation_id,
        interpretation_hash="interp-server-a",
        mapped_prompt_hash="prompt-server-a",
        public_landing_hash=landing_hash,
        scene_asset_id=scene_id,
    )
    return lineage, hashes, landing_hash, record


def test_public_landing_hash_exact_accept_and_title_change_reject():
    landing = _landing()
    h1 = compute_public_landing_hash(landing)
    h2 = compute_public_landing_hash(_landing(publicTitle="MUTATED"))
    assert h1 != h2
    # Unrelated metadata not in contract must not affect hash.
    with_extra = dict(landing)
    with_extra["topicCategory"] = "should-not-matter"
    with_extra["semanticAnchors"] = {"x": 1}
    assert compute_public_landing_hash(with_extra) == h1
    assert compute_public_landing_hash(_landing(publicSummary="MUTATED")) != h1
    assert compute_public_landing_hash(_landing(continuationContext="MUTATED")) != h1


def test_extract_landing_from_curiosity_bundle():
    bundle = {"publicLanding": _landing(), "semanticSource": "ignored-when-landing-set"}
    fields = extract_public_landing_from_curiosity(bundle)
    assert fields["publicTitle"] == "Aile için doğru SUV"
    assert compute_public_landing_hash(fields) == compute_public_landing_hash(_landing())


def test_scene_asset_resolve_and_reject_external():
    assert resolve_scene_asset_id_from_url(URL_A) == SCENE_A
    assert assert_journey_scene_url_acceptable(URL_A) == SCENE_A
    with pytest.raises(ValueError):
        assert_journey_scene_url_acceptable("https://cdn.example/other.jpg")


def test_binding_accepts_exact_payload():
    steps = _steps()
    landing = _landing()
    lineage, _, landing_hash, record = _seed_record(
        generation_id="gen-a", steps=steps, landing=landing
    )
    out = validate_against_server_generation_record(
        claimed=lineage,
        record=record,
        actual_public_landing_hash=landing_hash,
        actual_scene_asset_id=SCENE_A,
    )
    assert out["sceneAssetId"] == SCENE_A
    assert out["publicLandingHash"] == landing_hash


def test_A_mutate_public_title_rejects():
    steps = _steps()
    landing = _landing()
    lineage, _, landing_hash, record = _seed_record(
        generation_id="gen-a", steps=steps, landing=landing
    )
    mutated = compute_public_landing_hash(_landing(publicTitle="Changed"))
    assert mutated != landing_hash
    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed=lineage,
            record=record,
            actual_public_landing_hash=mutated,
            actual_scene_asset_id=SCENE_A,
        )
    assert exc.value.detail["reason"] == "public_landing_hash_mismatch"


def test_B_mutate_summary_rejects():
    steps = _steps()
    landing = _landing()
    lineage, _, _, record = _seed_record(
        generation_id="gen-a", steps=steps, landing=landing
    )
    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed=lineage,
            record=record,
            actual_public_landing_hash=compute_public_landing_hash(
                _landing(publicSummary="Changed summary")
            ),
            actual_scene_asset_id=SCENE_A,
        )
    assert exc.value.detail["reason"] == "public_landing_hash_mismatch"


def test_C_swap_scene_url_rejects():
    steps = _steps()
    landing = _landing()
    lineage, _, landing_hash, record = _seed_record(
        generation_id="gen-a", steps=steps, landing=landing
    )
    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed=lineage,
            record=record,
            actual_public_landing_hash=landing_hash,
            actual_scene_asset_id=SCENE_B,
        )
    assert exc.value.detail["reason"] == "scene_asset_mismatch"


def test_D_old_alignment_pass_new_scene_rejects():
    steps = _steps()
    landing = _landing()
    lineage, _, landing_hash, _ = _seed_record(
        generation_id="gen-a", steps=steps, landing=landing
    )
    with pytest.raises(HTTPException) as exc:
        validate_narrative_alignment_binding(
            claimed_lineage={**lineage, "sceneAssetId": SCENE_A},
            alignment={
                "generationId": "gen-a",
                "journeyId": "journey-a",
                "journeyVersion": 1,
                "windowHash": lineage["windowHash"],
                "publicLandingHash": landing_hash,
                "sceneAssetId": SCENE_B,
            },
            actual_scene_asset_id=SCENE_A,
            actual_public_landing_hash=landing_hash,
        )
    assert exc.value.detail["reason"] == "scene_asset_mismatch"


def test_E_tamper_mapped_prompt_hash_rejects():
    steps = _steps()
    landing = _landing()
    lineage, _, landing_hash, record = _seed_record(
        generation_id="gen-a", steps=steps, landing=landing
    )
    claimed = {**lineage, "mappedPromptHash": "tampered-prompt"}
    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed=claimed,
            record=record,
            actual_public_landing_hash=landing_hash,
            actual_scene_asset_id=SCENE_A,
        )
    assert exc.value.detail["reason"] == "prompt_mismatch"


def test_F_tamper_interpretation_hash_rejects():
    steps = _steps()
    landing = _landing()
    lineage, _, landing_hash, record = _seed_record(
        generation_id="gen-a", steps=steps, landing=landing
    )
    claimed = {**lineage, "interpretationHash": "tampered-interp"}
    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed=claimed,
            record=record,
            actual_public_landing_hash=landing_hash,
            actual_scene_asset_id=SCENE_A,
        )
    assert exc.value.detail["reason"] == "interpretation_mismatch"


def test_G_generation_id_from_journey_b_with_a_payload_rejects():
    steps_a = _steps("A")
    steps_b = _steps("B", start=8)
    landing = _landing()
    lineage_a, _, landing_hash, _ = _seed_record(
        generation_id="gen-a", steps=steps_a, landing=landing, journey_id="journey-a"
    )
    _seed_record(
        generation_id="gen-b",
        steps=steps_b,
        landing=landing,
        journey_id="journey-b",
        scene_id=SCENE_B,
    )
    record_b = get_journey_generation_record("gen-b")
    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed={**lineage_a, "generationId": "gen-b"},
            record=record_b,
            actual_public_landing_hash=landing_hash,
            actual_scene_asset_id=SCENE_A,
        )
    assert exc.value.detail["reason"] in {
        "journey_mismatch",
        "steps_hash_mismatch",
        "window_mismatch",
        "scene_asset_mismatch",
        "generation_mismatch",
    }


def test_H_identical_retry_accepted():
    steps = _steps()
    landing = _landing()
    lineage, _, landing_hash, record = _seed_record(
        generation_id="gen-a", steps=steps, landing=landing
    )
    first = validate_against_server_generation_record(
        claimed=lineage,
        record=record,
        actual_public_landing_hash=landing_hash,
        actual_scene_asset_id=SCENE_A,
    )
    second = validate_against_server_generation_record(
        claimed=copy.deepcopy(lineage),
        record=get_journey_generation_record("gen-a"),
        actual_public_landing_hash=landing_hash,
        actual_scene_asset_id=SCENE_A,
    )
    assert first["generationId"] == second["generationId"]


def test_I_steps_same_landing_changed_rejects():
    steps = _steps()
    landing = _landing()
    lineage, _, _, record = _seed_record(
        generation_id="gen-a", steps=steps, landing=landing
    )
    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed=lineage,
            record=record,
            actual_public_landing_hash=compute_public_landing_hash(
                _landing(continuationContext="changed")
            ),
            actual_scene_asset_id=SCENE_A,
        )
    assert exc.value.detail["reason"] == "public_landing_hash_mismatch"


def test_J_landing_same_scene_changed_rejects():
    steps = _steps()
    landing = _landing()
    lineage, _, landing_hash, record = _seed_record(
        generation_id="gen-a", steps=steps, landing=landing
    )
    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed=lineage,
            record=record,
            actual_public_landing_hash=landing_hash,
            actual_scene_asset_id=SCENE_B,
        )
    assert exc.value.detail["reason"] == "scene_asset_mismatch"


def test_unknown_generation_id_rejects():
    steps = _steps()
    landing = _landing()
    lineage, _, landing_hash, _ = _seed_record(
        generation_id="gen-a", steps=steps, landing=landing
    )
    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed={**lineage, "generationId": "gen-unknown"},
            record=None,
            actual_public_landing_hash=landing_hash,
            actual_scene_asset_id=SCENE_A,
        )
    assert exc.value.detail["reason"] == "generation_mismatch"


def test_step_writer_requires_selected_steps_hash():
    import asyncio
    from unittest.mock import AsyncMock, patch

    from backend.services.mirror_network.journey_steps import replace_journey_steps_for_version

    async def _run():
        db = AsyncMock()
        with patch(
            "backend.services.mirror_network.journey_steps.get_lineage_selected_steps_hash_for_version",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(HTTPException) as exc:
                await replace_journey_steps_for_version(
                    db,
                    journey_slug="journey-a",
                    journey_version=1,
                    steps=_steps(),
                    selected_steps_hash=None,
                    require_selected_steps_hash=True,
                )
            assert exc.value.detail["reason"] == "steps_hash_mismatch"

    asyncio.run(_run())
