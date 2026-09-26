# -*- coding: utf-8 -*-
"""One generationId binds one canonical scene. A later asset cannot replace it."""

from __future__ import annotations

import pytest

from backend.services.mirror.journey_generation_record import (
    bind_canonical_scene_asset,
    bind_scene_asset_to_generation,
    clear_journey_generation_records_for_tests,
    get_journey_generation_record,
    upsert_journey_generation_record,
)
from backend.services.mirror_network.discover import (
    is_canonical_discover_node_structure,
    is_public_discover_scene_url,
)
from backend.services.mirror_network.fixtures import build_fixture_mirror_node


GEN = "gen-bind-x"
ASSET_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
ASSET_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"
URL_A = f"https://api.ezacore.ai/api/public/mirror-scene-assets/{ASSET_A}.png"
URL_B = f"https://api.ezacore.ai/api/public/mirror-scene-assets/{ASSET_B}.png"


@pytest.fixture(autouse=True)
def _clear():
    clear_journey_generation_records_for_tests()
    yield
    clear_journey_generation_records_for_tests()


def _prepare():
    upsert_journey_generation_record(
        GEN,
        {
            "journeyId": "journey-a",
            "journeyVersion": 1,
            "sourceConversationId": "conv-1",
            "interpretationHash": "interp",
            "mappedPromptHash": "prompt",
        },
    )


def test_first_bind_same_bind_and_conflicting_bind():
    _prepare()
    outcome, record = bind_canonical_scene_asset(
        GEN, scene_asset_id=ASSET_A, scene_image_url=URL_A
    )
    assert outcome == "bound"
    assert record["sceneAssetId"] == ASSET_A

    again = bind_scene_asset_to_generation(
        GEN, scene_asset_id=ASSET_A, scene_image_url=URL_A
    )
    assert again is not None
    assert again["sceneAssetId"] == ASSET_A
    assert again["sceneImageUrl"] == URL_A

    outcome_b, kept = bind_canonical_scene_asset(
        GEN, scene_asset_id=ASSET_B, scene_image_url=URL_B
    )
    assert outcome_b == "conflict"
    assert kept["sceneAssetId"] == ASSET_A
    assert bind_scene_asset_to_generation(
        GEN, scene_asset_id=ASSET_B, scene_image_url=URL_B
    ) is None
    stored = get_journey_generation_record(GEN)
    assert stored["sceneAssetId"] == ASSET_A
    assert stored["sceneImageUrl"] == URL_A


def test_duplicate_generate_cannot_replace_canonical_asset():
    _prepare()
    bind_canonical_scene_asset(GEN, scene_asset_id=ASSET_A, scene_image_url=URL_A)
    # A second generate-scene for the same generationId observes the first bind.
    outcome, canonical = bind_canonical_scene_asset(
        GEN, scene_asset_id=ASSET_B, scene_image_url=URL_B
    )
    assert outcome == "conflict"
    assert canonical["sceneImageUrl"] == URL_A
    assert get_journey_generation_record(GEN)["sceneAssetId"] == ASSET_A


def test_sealed_canonical_scene_stays_discover_eligible():
    assert is_public_discover_scene_url(URL_A) is True
    node = build_fixture_mirror_node(slug_suffix="seal")
    node.slug = "exact-slug"
    node.scene_image_url = URL_A
    node.visibility = "public"
    node.safety_status = "open"
    node.artifact_kind = "journey_v1"
    node.freeze_status = "frozen"
    assert node.published_at is not None
    assert is_canonical_discover_node_structure(node) is True
    assert node.scene_image_url == URL_A
