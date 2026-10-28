# -*- coding: utf-8 -*-
"""Optional Yansı experience type and content nature stay outside publish seals."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from backend.core.schemas.mirror_network import MirrorNetworkPublishRequest
from backend.services.business_yansi.service import source_hash
from backend.services.business_yansi.studio_media import media_seal
from backend.services.mirror.journey_window_hashes import compute_selected_steps_hash
from backend.services.mirror.public_landing_hash import compute_public_landing_hash
from backend.services.mirror_network.discover import _to_discover_item
from backend.services.mirror_network.frozen_journey_artifact import (
    attach_frozen_journey_artifact,
    build_durable_frozen_journey_artifact,
    read_frozen_journey_artifact_from_private,
    to_public_frozen_journey_artifact,
)
from backend.services.mirror_network.service import node_to_public_payload
from backend.services.mirror_network.types import MirrorNetworkNodeRecord
from backend.services.mirror_network.yansi_content_identity import (
    identity_for_publish,
    read_content_identity,
    stamp_new_freeze,
)


def _steps(count: int = 6) -> list[dict]:
    return [
        {
            "stepIndex": index,
            "sourceOrder": index - 1,
            "sourceUserMessageId": f"u{index}",
            "sourceAssistantMessageId": f"a{index}",
            "publicQuestion": f"Soru {index} burada ne anlatıyor?",
            "publicAnswer": f"Cevap {index} kayıttaki cümledir.",
        }
        for index in range(1, count + 1)
    ]


def _freeze(**identity: str | None) -> dict:
    steps = _steps()
    frozen = build_durable_frozen_journey_artifact(
        journey_id="yansi-kimlik",
        journey_version=1,
        source_conversation_id="conv-1",
        author_user_id="owner-1",
        parent_slug=None,
        block_index=0,
        block_start=0,
        block_end=5,
        source_block_hash="block",
        selected_steps=steps,
        public_title="Başlık",
        public_summary="Özet",
        continuation_context="Devam",
        public_landing_hash="landing-hash",
        public_landing_contract_version="mirror-public-landing-v1",
        scene_asset_id="asset-1",
        scene_image_url="https://cdn.example/scene.jpg",
        generation_id="gen-1",
        selected_steps_hash=compute_selected_steps_hash(steps),
        scoped_input_hash="scoped",
        window_hash="window",
        interpretation_hash="interp",
        anchors_hash="anchors",
        mapped_prompt_hash="mapped",
        narrative_alignment={},
        sanitization_status="clean",
        sanitization_flags=[],
        original_step_hashes=None,
        public_step_hashes=None,
    )
    return stamp_new_freeze(
        frozen,
        identity.get("experience_type"),
        identity.get("content_nature"),
    )


def _public(frozen: dict) -> dict:
    landing = frozen["publicLanding"]
    return to_public_frozen_journey_artifact(
        {
            "replayReady": True,
            "slug": frozen["slug"],
            "journeyId": frozen["journeyId"],
            "journeyVersion": frozen["journeyVersion"],
            "authorUserId": frozen["authorUserId"],
            "selectedCount": frozen["selectedCount"],
            "selectedSteps": frozen["selectedSteps"] if "selectedSteps" in frozen else _steps(),
            "publicTitle": landing["publicTitle"],
            "publicSummary": landing["publicSummary"],
            "continuationContext": landing["continuationContext"],
            "sceneImageUrl": frozen["sceneImageUrl"],
            "experienceType": frozen.get("experienceType"),
            "contentNature": frozen.get("contentNature"),
        }
    )


def test_unlabeled_freeze_opens_without_new_fields():
    frozen = _freeze()
    public = _public(frozen)
    assert public is not None
    assert "experienceType" not in public
    assert "contentNature" not in public
    assert public["publicTitle"] == "Başlık"


def test_new_freeze_keeps_both_labels_outside_the_landing_hash():
    plain = _freeze()
    labeled = stamp_new_freeze(plain, "story", "fiction")
    assert labeled["experienceType"] == "story"
    assert labeled["contentNature"] == "fiction"
    assert labeled["publicLanding"] == plain["publicLanding"]
    assert labeled["publicLandingHash"] == plain["publicLandingHash"]
    assert compute_public_landing_hash(labeled["publicLanding"]) == compute_public_landing_hash(
        plain["publicLanding"]
    )
    public = _public(labeled)
    assert public["experienceType"] == "story"
    assert public["contentNature"] == "fiction"


def test_labels_round_trip_through_the_private_payload_document():
    labeled = stamp_new_freeze(_freeze(), "life", "mixed")
    stored = attach_frozen_journey_artifact(None, labeled)
    loaded = read_frozen_journey_artifact_from_private(stored)
    assert loaded is not None
    assert read_content_identity(loaded) == {
        "experienceType": "life",
        "contentNature": "mixed",
    }
    assert loaded["publicLandingHash"] == labeled["publicLandingHash"]


def test_discover_item_returns_labels_and_omits_them_when_absent():
    labeled = stamp_new_freeze(_freeze(), "knowledge", "real")
    node = SimpleNamespace(
        slug="yansi-kimlik",
        card_title="Kart",
        public_payload={},
        private_payload=attach_frozen_journey_artifact(None, labeled),
        published_at=None,
    )
    item = _to_discover_item(node, scene_url="https://cdn.example/scene.jpg", yansi_count=0)
    assert item.experienceType == "knowledge"
    assert item.contentNature == "real"
    assert item.title == "Başlık"

    plain = SimpleNamespace(
        slug="yansi-eski",
        card_title="Eski",
        public_payload={"publicTitle": "Eski başlık"},
        private_payload=attach_frozen_journey_artifact(None, _freeze()),
        published_at=None,
    )
    old = _to_discover_item(plain, scene_url="https://cdn.example/old.jpg", yansi_count=0)
    assert old.experienceType is None
    assert old.contentNature is None


def test_invalid_enum_is_rejected_and_not_stored():
    with pytest.raises(ValidationError):
        MirrorNetworkPublishRequest(
            cardTitle="Başlık",
            cardDate="2026-01-01",
            curiosityBundle={},
            experienceType="official",
        )
    stamped = stamp_new_freeze(_freeze(), "verified", "badge")
    assert read_content_identity(stamped) == {}


def test_existing_freeze_ignores_a_later_label_change():
    stored = stamp_new_freeze(_freeze(), "discussion", "mixed")
    assert identity_for_publish(stored, "fun", "fiction") == {
        "experienceType": "discussion",
        "contentNature": "mixed",
    }
    assert identity_for_publish(None, "fun", "fiction") == {
        "experienceType": "fun",
        "contentNature": "fiction",
    }


def _record(private_payload: dict) -> MirrorNetworkNodeRecord:
    return MirrorNetworkNodeRecord(
        id=uuid.uuid4(),
        slug="yansi-kimlik",
        user_id=uuid.uuid4(),
        conversation_id="conv-1",
        visibility="public",
        safety_status="open",
        card_title="Başlık",
        card_date="2026-10-28",
        scene_image_url="https://cdn.example/scene.jpg",
        public_payload={
            "slug": "yansi-kimlik",
            "shareUrl": "https://standalone.ezacore.ai/m/yansi-kimlik",
            "cardTitle": "Başlık",
            "cardDate": "2026-10-28",
            "coreCuriosity": "Merak",
            "curiosityContext": "Bağlam",
            "landingContext": "Giriş",
            "seed": {"topicCategory": "merak", "mood": "sakin"},
        },
        private_payload=private_payload,
    )


def test_successful_publish_response_echoes_saved_labels():
    labeled = stamp_new_freeze(_freeze(), "story", "fiction")
    before = labeled["publicLandingHash"]
    payload = node_to_public_payload(
        _record(attach_frozen_journey_artifact(None, labeled))
    )
    assert payload.experienceType == "story"
    assert payload.contentNature == "fiction"
    assert labeled["publicLandingHash"] == before


def test_existing_sealed_publish_does_not_take_new_labels_or_a_second_identity():
    sealed = _freeze()
    assert "experienceType" not in sealed
    kept = identity_for_publish(sealed, "life", "real")
    assert kept == {}
    payload = node_to_public_payload(
        _record(attach_frozen_journey_artifact(None, sealed))
    )
    assert payload.experienceType is None
    assert payload.contentNature is None
    assert payload.slug == "yansi-kimlik"
    assert sealed["publicLandingHash"] == payload.publicLandingHash


def test_publish_seals_ignore_content_labels():
    steps = [{"question": "Soru", "answer": "Cevap"}]
    plan = {"coverAssetId": None, "blocks": [[{"type": "image", "assetId": "asset"}]]}
    assert source_hash(steps) == source_hash(steps)
    assert media_seal(plan) == media_seal({**plan, "experienceType": "fun", "contentNature": "real"})
