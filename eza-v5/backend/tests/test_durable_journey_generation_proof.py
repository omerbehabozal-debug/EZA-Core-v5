# -*- coding: utf-8 -*-
"""Durable SERVER-authored journey generation proof — TTL / restart / worker fallback."""

from __future__ import annotations

import time
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from backend.services.mirror.durable_journey_generation_proof import (
    PROOF_NAMESPACE,
    GenerationProofConflict,
    build_server_generation_proof,
    load_durable_journey_generation_proof,
    lookup_canonical_generated_scene,
    persist_durable_journey_generation_proof,
    proof_as_generation_record,
    resolve_generation_record_for_publish,
    strip_client_generation_proof_namespace,
    strip_client_proof_from_lineage,
)
from backend.services.mirror import journey_generation_record as generation_record_module
from backend.services.mirror.journey_generation_lineage import (
    validate_against_server_generation_record,
)
from backend.services.mirror.journey_generation_record import (
    clear_journey_generation_records_for_tests,
    get_journey_generation_record,
    upsert_journey_generation_record,
)


SCENE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
SCENE_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"
URL = f"https://api.test.eza.ai/api/public/mirror-scene-assets/{SCENE}.png"
URL_B = f"https://api.test.eza.ai/api/public/mirror-scene-assets/{SCENE_B}.png"
USER_ID = uuid.UUID("11111111-2222-4333-8444-555555555555")
CONV = "client-conv-durable-1"
GEN_A = "gen-durable-a"
GEN_B = "gen-durable-b"
GEN_C = "gen-durable-c"


def _base_fields(generation_id: str = GEN_A, **overrides):
    row = {
        "generationId": generation_id,
        "userId": str(USER_ID),
        "sourceConversationId": CONV,
        "journeyId": "journey-a",
        "journeyVersion": 1,
        "windowIndex": 0,
        "windowStart": 0,
        "windowEnd": 7,
        "windowHash": "win-a",
        "scopedInputHash": "scope-a",
        "selectedStepsHash": "steps-a",
        "sourceBlockHash": "block-a",
        "interpretationHash": "interp-a",
        "mappedPromptHash": "prompt-a",
        "sceneAssetId": SCENE,
        "sceneImageUrl": URL,
    }
    row.update(overrides)
    return row


def _claimed_from_proof(proof: dict, **overrides):
    claimed = {
        "generationId": proof["generationId"],
        "journeyId": proof["journeyId"],
        "journeyVersion": proof["journeyVersion"],
        "sourceConversationId": proof["sourceConversationId"],
        "windowHash": proof["windowHash"],
        "scopedInputHash": proof["scopedInputHash"],
        "selectedStepsHash": proof["selectedStepsHash"],
        "sourceBlockHash": proof.get("sourceBlockHash"),
        "interpretationHash": proof["interpretationHash"],
        "mappedPromptHash": proof["mappedPromptHash"],
        "sceneAssetId": proof.get("sceneAssetId"),
        "publicLandingHash": "landing-a",
    }
    claimed.update(overrides)
    return claimed


@pytest.fixture(autouse=True)
def _clear_memory():
    clear_journey_generation_records_for_tests()
    yield
    clear_journey_generation_records_for_tests()


def test_strip_client_cannot_inject_proof_namespace():
    dirty = {
        "sourceType": "mirror",
        PROOF_NAMESPACE: {GEN_A: {"authoredBy": "client", "generationId": GEN_A}},
    }
    cleaned = strip_client_generation_proof_namespace(dirty)
    assert PROOF_NAMESPACE not in cleaned
    assert cleaned["sourceType"] == "mirror"

    lineage = {
        "journeyId": "j",
        PROOF_NAMESPACE: {"forged": True},
        "serverGenerationProof": {"forged": True},
    }
    cleaned_lin = strip_client_proof_from_lineage(lineage)
    assert PROOF_NAMESPACE not in cleaned_lin
    assert "serverGenerationProof" not in cleaned_lin
    assert cleaned_lin["journeyId"] == "j"


def test_build_proof_is_server_authored():
    proof = build_server_generation_proof(_base_fields())
    assert proof["authoredBy"] == "server"
    assert proof["contractVersion"] == "server_journey_generation_proof_v1"
    assert proof["generationId"] == GEN_A


@pytest.mark.asyncio
async def test_persist_and_load_exact_generation_id():
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata=None,
        updated_at=None,
        deleted_at=None,
    )
    db = AsyncMock()

    async def _execute(stmt):
        result = MagicMock()
        result.scalar_one_or_none.return_value = conv
        return result

    db.execute = AsyncMock(side_effect=_execute)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.flush = AsyncMock()

    stored = await persist_durable_journey_generation_proof(
        db,
        user_id=USER_ID,
        client_conversation_id=CONV,
        fields=_base_fields(),
    )
    assert stored is not None
    assert stored["generationId"] == GEN_A
    assert PROOF_NAMESPACE in conv.tree_metadata
    assert GEN_A in conv.tree_metadata[PROOF_NAMESPACE]

    loaded = await load_durable_journey_generation_proof(
        db,
        user_id=USER_ID,
        generation_id=GEN_A,
        client_conversation_id=CONV,
    )
    assert loaded is not None
    assert loaded["selectedStepsHash"] == "steps-a"
    assert loaded["interpretationHash"] == "interp-a"


@pytest.mark.asyncio
async def test_client_put_cannot_overwrite_server_proof_hashes():
    existing_proof = build_server_generation_proof(_base_fields())
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata={PROOF_NAMESPACE: {GEN_A: existing_proof}},
        updated_at=None,
        deleted_at=None,
    )
    db = AsyncMock()

    async def _execute(stmt):
        result = MagicMock()
        result.scalar_one_or_none.return_value = conv
        return result

    db.execute = AsyncMock(side_effect=_execute)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    # Malicious re-persist with tampered hashes — identity hashes must stick.
    await persist_durable_journey_generation_proof(
        db,
        user_id=USER_ID,
        client_conversation_id=CONV,
        fields=_base_fields(
            selectedStepsHash="TAMPERED",
            interpretationHash="TAMPERED",
            mappedPromptHash="TAMPERED",
            windowHash="TAMPERED",
        ),
    )
    kept = conv.tree_metadata[PROOF_NAMESPACE][GEN_A]
    assert kept["selectedStepsHash"] == "steps-a"
    assert kept["interpretationHash"] == "interp-a"
    assert kept["mappedPromptHash"] == "prompt-a"
    assert kept["windowHash"] == "win-a"


@pytest.mark.asyncio
async def test_memory_then_durable_fallback_after_clear():
    upsert_journey_generation_record(GEN_A, _base_fields())
    assert get_journey_generation_record(GEN_A) is not None

    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata=None,
        updated_at=None,
        deleted_at=None,
    )
    db = AsyncMock()

    async def _execute(stmt):
        result = MagicMock()
        result.scalar_one_or_none.return_value = conv
        return result

    db.execute = AsyncMock(side_effect=_execute)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    await persist_durable_journey_generation_proof(
        db,
        user_id=USER_ID,
        client_conversation_id=CONV,
        fields=_base_fields(),
    )

    # Simulate restart / other worker: wipe process memory.
    clear_journey_generation_records_for_tests()
    assert get_journey_generation_record(GEN_A) is None

    record, source = await resolve_generation_record_for_publish(
        db,
        user_id=USER_ID,
        generation_id=GEN_A,
        client_conversation_id=CONV,
    )
    assert source == "durable"
    assert record is not None

    ok = validate_against_server_generation_record(
        claimed=_claimed_from_proof(record),
        record=record,
        actual_public_landing_hash="landing-a",
        actual_scene_asset_id=SCENE,
    )
    assert ok["generationId"] == GEN_A


@pytest.mark.asyncio
async def test_abc_exact_identity_no_latest_substitution():
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata=None,
        updated_at=None,
        deleted_at=None,
    )
    db = AsyncMock()

    async def _execute(stmt):
        result = MagicMock()
        result.scalar_one_or_none.return_value = conv
        return result

    db.execute = AsyncMock(side_effect=_execute)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    for gid, jid in ((GEN_A, "journey-a"), (GEN_B, "journey-b"), (GEN_C, "journey-c")):
        await persist_durable_journey_generation_proof(
            db,
            user_id=USER_ID,
            client_conversation_id=CONV,
            fields=_base_fields(
                generation_id=gid,
                journeyId=jid,
                selectedStepsHash=f"steps-{gid[-1]}",
            ),
        )

    clear_journey_generation_records_for_tests()
    record_b, source = await resolve_generation_record_for_publish(
        db,
        user_id=USER_ID,
        generation_id=GEN_B,
        client_conversation_id=CONV,
    )
    assert source == "durable"
    assert record_b["generationId"] == GEN_B
    assert record_b["journeyId"] == "journey-b"
    assert record_b["selectedStepsHash"] == "steps-b"


@pytest.mark.asyncio
async def test_tampered_claims_rejected_against_durable_proof():
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata=None,
        updated_at=None,
        deleted_at=None,
    )
    db = AsyncMock()

    async def _execute(stmt):
        result = MagicMock()
        result.scalar_one_or_none.return_value = conv
        return result

    db.execute = AsyncMock(side_effect=_execute)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    await persist_durable_journey_generation_proof(
        db,
        user_id=USER_ID,
        client_conversation_id=CONV,
        fields=_base_fields(),
    )
    clear_journey_generation_records_for_tests()
    record, _ = await resolve_generation_record_for_publish(
        db,
        user_id=USER_ID,
        generation_id=GEN_A,
        client_conversation_id=CONV,
    )
    assert record is not None

    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed=_claimed_from_proof(record, selectedStepsHash="FORGED"),
            record=record,
            actual_public_landing_hash="landing-a",
            actual_scene_asset_id=SCENE,
        )
    assert exc.value.detail["reason"] == "steps_hash_mismatch"

    with pytest.raises(HTTPException) as exc2:
        validate_against_server_generation_record(
            claimed=_claimed_from_proof(record, interpretationHash="FORGED"),
            record=record,
            actual_public_landing_hash="landing-a",
            actual_scene_asset_id=SCENE,
        )
    assert exc2.value.detail["reason"] == "interpretation_mismatch"

    with pytest.raises(HTTPException) as exc3:
        validate_against_server_generation_record(
            claimed=_claimed_from_proof(record, mappedPromptHash="FORGED"),
            record=record,
            actual_public_landing_hash="landing-a",
            actual_scene_asset_id=SCENE,
        )
    assert exc3.value.detail["reason"] == "prompt_mismatch"

    with pytest.raises(HTTPException) as exc4:
        validate_against_server_generation_record(
            claimed=_claimed_from_proof(record, windowHash="FORGED"),
            record=record,
            actual_public_landing_hash="landing-a",
            actual_scene_asset_id=SCENE,
        )
    assert exc4.value.detail["reason"] == "window_mismatch"

    with pytest.raises(HTTPException) as exc5:
        validate_against_server_generation_record(
            claimed=_claimed_from_proof(record, journeyId="other-journey"),
            record=record,
            actual_public_landing_hash="landing-a",
            actual_scene_asset_id=SCENE,
        )
    assert exc5.value.detail["reason"] == "journey_mismatch"

    with pytest.raises(HTTPException) as exc6:
        validate_against_server_generation_record(
            claimed=_claimed_from_proof(record, sceneAssetId="ffffffff-ffff-4fff-8fff-ffffffffffff"),
            record=record,
            actual_public_landing_hash="landing-a",
            actual_scene_asset_id=SCENE,
        )
    assert exc6.value.detail["reason"] == "scene_asset_mismatch"


@pytest.mark.asyncio
async def test_wrong_owner_does_not_load_proof():
    other = uuid.UUID("99999999-9999-4999-8999-999999999999")
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata=None,
        updated_at=None,
        deleted_at=None,
    )
    db = AsyncMock()

    async def _execute(stmt):
        result = MagicMock()
        # Owner lookup by other user → miss
        result.scalar_one_or_none.return_value = None
        return result

    db.execute = AsyncMock(side_effect=_execute)
    loaded = await load_durable_journey_generation_proof(
        db,
        user_id=other,
        generation_id=GEN_A,
        client_conversation_id=CONV,
    )
    assert loaded is None


@pytest.mark.asyncio
async def test_missing_proof_after_memory_clear_rejects():
    db = AsyncMock()

    async def _execute(stmt):
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        return result

    db.execute = AsyncMock(side_effect=_execute)
    clear_journey_generation_records_for_tests()
    record, source = await resolve_generation_record_for_publish(
        db,
        user_id=USER_ID,
        generation_id="gen-unknown",
        client_conversation_id=CONV,
    )
    assert source == "missing"
    assert record is None
    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed={"generationId": "gen-unknown"},
            record=None,
            actual_public_landing_hash="x",
            actual_scene_asset_id=SCENE,
        )
    assert exc.value.detail["reason"] == "generation_mismatch"


def _db_for(conv):
    db = AsyncMock()

    async def _execute(stmt):
        result = MagicMock()
        result.scalar_one_or_none.return_value = conv
        return result

    db.execute = AsyncMock(side_effect=_execute)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.flush = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_publish_succeeds_from_durable_proof_after_memory_loss():
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata=None,
        updated_at=None,
        deleted_at=None,
    )
    db = _db_for(conv)
    await persist_durable_journey_generation_proof(
        db,
        user_id=USER_ID,
        client_conversation_id=CONV,
        fields=_base_fields(),
    )
    clear_journey_generation_records_for_tests()
    record, source = await resolve_generation_record_for_publish(
        db,
        user_id=USER_ID,
        generation_id=GEN_A,
        client_conversation_id=CONV,
    )
    assert source == "durable"
    ok = validate_against_server_generation_record(
        claimed=_claimed_from_proof(record),
        record=record,
        actual_public_landing_hash="landing-a",
        actual_scene_asset_id=SCENE,
    )
    assert ok["sceneAssetId"] == SCENE


@pytest.mark.asyncio
async def test_other_worker_with_empty_memory_publishes_durable_scene():
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata={
            PROOF_NAMESPACE: {GEN_A: build_server_generation_proof(_base_fields())}
        },
        updated_at=None,
        deleted_at=None,
    )
    db = _db_for(conv)
    assert get_journey_generation_record(GEN_A) is None
    record, source = await resolve_generation_record_for_publish(
        db,
        user_id=USER_ID,
        generation_id=GEN_A,
        client_conversation_id=CONV,
    )
    assert source == "durable"
    assert record["sceneAssetId"].lower() == SCENE
    validate_against_server_generation_record(
        claimed=_claimed_from_proof(record),
        record=record,
        actual_public_landing_hash="landing-a",
        actual_scene_asset_id=SCENE,
    )


@pytest.mark.asyncio
async def test_ttl_expiry_still_publishes_from_durable_proof():
    upsert_journey_generation_record(GEN_A, _base_fields())
    with generation_record_module._LOCK:
        _ts, payload = generation_record_module._STORE[GEN_A]
        generation_record_module._STORE[GEN_A] = (
            time.time() - generation_record_module._TTL_SECONDS - 5,
            payload,
        )
    assert get_journey_generation_record(GEN_A) is None
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata={
            PROOF_NAMESPACE: {GEN_A: build_server_generation_proof(_base_fields())}
        },
        updated_at=None,
        deleted_at=None,
    )
    record, source = await resolve_generation_record_for_publish(
        _db_for(conv),
        user_id=USER_ID,
        generation_id=GEN_A,
        client_conversation_id=CONV,
    )
    assert source == "durable"
    assert record["sceneImageUrl"] == URL


@pytest.mark.asyncio
async def test_client_scene_b_rejected_against_durable_scene_a():
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata={
            PROOF_NAMESPACE: {GEN_A: build_server_generation_proof(_base_fields())}
        },
        updated_at=None,
        deleted_at=None,
    )
    record, _ = await resolve_generation_record_for_publish(
        _db_for(conv),
        user_id=USER_ID,
        generation_id=GEN_A,
        client_conversation_id=CONV,
    )
    with pytest.raises(HTTPException) as exc:
        validate_against_server_generation_record(
            claimed=_claimed_from_proof(record, sceneAssetId=SCENE_B),
            record=record,
            actual_public_landing_hash="landing-a",
            actual_scene_asset_id=SCENE_B,
        )
    assert exc.value.detail["reason"] == "scene_asset_mismatch"


@pytest.mark.asyncio
async def test_durable_scene_a_and_memory_scene_b_fail_closed():
    upsert_journey_generation_record(GEN_A, _base_fields(sceneAssetId=SCENE_B, sceneImageUrl=URL_B))
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata={
            PROOF_NAMESPACE: {GEN_A: build_server_generation_proof(_base_fields())}
        },
        updated_at=None,
        deleted_at=None,
    )
    with pytest.raises(GenerationProofConflict) as exc:
        await resolve_generation_record_for_publish(
            _db_for(conv),
            user_id=USER_ID,
            generation_id=GEN_A,
            client_conversation_id=CONV,
        )
    assert exc.value.field == "sceneAssetId"
    kept = conv.tree_metadata[PROOF_NAMESPACE][GEN_A]
    assert kept["sceneAssetId"] == SCENE


@pytest.mark.asyncio
async def test_lookup_adopts_memory_to_durable_canonical_scene():
    upsert_journey_generation_record(GEN_A, _base_fields(sceneAssetId=SCENE_B, sceneImageUrl=URL_B))
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata={
            PROOF_NAMESPACE: {GEN_A: build_server_generation_proof(_base_fields())}
        },
        updated_at=None,
        deleted_at=None,
    )
    canonical = await lookup_canonical_generated_scene(
        _db_for(conv),
        generation_id=GEN_A,
        user_id=USER_ID,
        client_conversation_id=CONV,
    )
    assert canonical["sceneImageUrl"] == URL
    assert get_journey_generation_record(GEN_A)["sceneAssetId"] == SCENE


@pytest.mark.asyncio
async def test_second_scene_persist_does_not_replace_sealed_proof():
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata=None,
        updated_at=None,
        deleted_at=None,
    )
    db = _db_for(conv)
    await persist_durable_journey_generation_proof(
        db, user_id=USER_ID, client_conversation_id=CONV, fields=_base_fields()
    )
    stored = await persist_durable_journey_generation_proof(
        db,
        user_id=USER_ID,
        client_conversation_id=CONV,
        fields=_base_fields(sceneAssetId=SCENE_B, sceneImageUrl=URL_B),
    )
    assert stored["sceneAssetId"] == SCENE
    assert conv.tree_metadata[PROOF_NAMESPACE][GEN_A]["sceneImageUrl"] == URL


@pytest.mark.asyncio
async def test_forged_client_proof_is_not_loaded():
    conv = SimpleNamespace(
        user_id=USER_ID,
        client_conversation_id=CONV,
        tree_metadata={
            PROOF_NAMESPACE: {
                GEN_A: {
                    "authoredBy": "client",
                    "generationId": GEN_A,
                    "sceneAssetId": SCENE_B,
                    "sceneImageUrl": URL_B,
                }
            }
        },
        updated_at=None,
        deleted_at=None,
    )
    loaded = await load_durable_journey_generation_proof(
        _db_for(conv),
        user_id=USER_ID,
        generation_id=GEN_A,
        client_conversation_id=CONV,
    )
    assert loaded is None
    record, source = await resolve_generation_record_for_publish(
        _db_for(conv),
        user_id=USER_ID,
        generation_id=GEN_A,
        client_conversation_id=CONV,
    )
    assert source == "missing"
    assert record is None


def test_proof_as_generation_record_shape():
    proof = build_server_generation_proof(_base_fields())
    record = proof_as_generation_record(proof)
    assert record["generationId"] == GEN_A
    assert "authoredBy" not in record
