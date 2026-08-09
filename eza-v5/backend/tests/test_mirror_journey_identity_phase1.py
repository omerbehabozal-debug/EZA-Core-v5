# -*- coding: utf-8 -*-
"""Phase 1 — Mirror Journey identity (flag + journeyId publish path)."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.core.schemas.mirror_network import MirrorNetworkPublishRequest
from backend.models.mirror_network import (
    ARTIFACT_KIND_JOURNEY_V1,
    ARTIFACT_KIND_LEGACY_LANDING,
)
from backend.services.mirror_network.fixtures import JAPAN_FIXTURE_BUNDLE
from backend.services.mirror_network.journey_identity import normalize_journey_id
from backend.services.mirror_network.publish import publish_mirror_to_network


def _user():
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="journey@test.eza.ai",
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan="plus",
    )


def _eight_steps(start: int = 0):
    return [
        {
            "stepIndex": i + 1,
            "sourceOrder": start + i,
            "sourceUserMessageId": f"u{start + i + 1}",
            "sourceAssistantMessageId": f"a{start + i + 1}",
            "publicQuestion": f"Soru {start + i + 1}?",
            "publicAnswer": f"Cevap {start + i + 1}.",
        }
        for i in range(8)
    ]


def _attach_generation_lineage(payload: dict) -> dict:
    """Phase 3.6 — journey publish requires authoritative generation lineage."""
    from backend.services.mirror.journey_generation_lineage import (
        build_journey_generation_lineage,
        recompute_hashes_from_steps,
    )

    journey_id = str(payload.get("journeyId") or "").strip().lower()
    steps = payload.get("selectedSteps") or _eight_steps(0)
    window_index = int(payload.get("windowIndex", 0))
    window_start = int(payload.get("windowStart", 0))
    window_end = int(payload.get("windowEnd", 7))
    version = int(payload.get("journeyVersion") or 1)
    conv = str(payload.get("conversationId") or "conv-shared-1")
    hashes = recompute_hashes_from_steps(
        journey_id=journey_id,
        journey_version=version,
        source_conversation_id=conv,
        window_index=window_index,
        window_start=window_start,
        window_end=window_end,
        steps=steps,
    )
    lineage = build_journey_generation_lineage(
        journey_id=journey_id,
        journey_version=version,
        source_conversation_id=conv,
        window_index=window_index,
        window_start=window_start,
        window_end=window_end,
        window_hash=hashes["windowHash"],
        scoped_input_hash=hashes["scopedInputHash"],
        selected_steps_hash=hashes["selectedStepsHash"],
        generation_id=str(
            payload.get("generationId")
            or ((payload.get("intelligencePrivate") or {})
                .get("intelligenceBrief", {})
                .get("mirrorLineage", {})
                .get("generationId"))
            or "gen-1"
        ),
        interpretation_hash=str(payload.get("interpretationHash") or "interp-test"),
        public_landing_hash=str(payload.get("publicLandingHash") or "landing-test"),
        mapped_prompt_hash=str(payload.get("mappedPromptHash") or "prompt-test"),
        scene_asset_id=str(payload.get("sceneAssetId") or "scene-test"),
    )
    payload.setdefault("journeyVersion", version)
    payload.setdefault("sourceConversationId", conv)
    payload.setdefault("windowHash", lineage["windowHash"])
    payload.setdefault("scopedInputHash", lineage["scopedInputHash"])
    payload.setdefault("selectedStepsHash", lineage["selectedStepsHash"])
    payload.setdefault("interpretationHash", lineage["interpretationHash"])
    payload.setdefault("publicLandingHash", lineage["publicLandingHash"])
    payload.setdefault("mappedPromptHash", lineage["mappedPromptHash"])
    payload.setdefault("generationId", lineage["generationId"])
    payload.setdefault("sceneAssetId", lineage["sceneAssetId"])
    payload.setdefault("journeyGenerationLineage", lineage)
    return payload


def _body(**extra) -> MirrorNetworkPublishRequest:
    payload = {
        "cardTitle": "Aile SUV Merakı",
        "cardDate": "2026-08-08",
        "conversationId": "conv-shared-1",
        "sceneImageUrl": "https://cdn.example/mirror-scene.jpg",
        "curiosityBundle": JAPAN_FIXTURE_BUNDLE,
        "intelligencePrivate": {
            "intelligenceBrief": {
                "mirrorLineage": {
                    "generationId": "gen-1",
                    "generationAcceptedAt": 1_700_000_000_000,
                }
            }
        },
        "safetyLevel": "normal",
        **extra,
    }
    if payload.get("journeyId") and "selectedSteps" not in payload:
        payload["selectedSteps"] = _eight_steps(0)
    if payload.get("journeyId") and "windowIndex" not in payload:
        payload["windowIndex"] = 0
        payload["windowStart"] = 0
        payload["windowEnd"] = 7
    if payload.get("journeyId"):
        payload = _attach_generation_lineage(payload)
    return MirrorNetworkPublishRequest(**payload)


def test_normalize_journey_id():
    assert normalize_journey_id("  My_Journey/A  ") == "my-journey-a"
    assert normalize_journey_id("") is None
    assert normalize_journey_id("---") is None


@pytest.mark.asyncio
async def test_flag_off_ignores_journey_id_uses_conversation_upsert():
    user = _user()
    db = AsyncMock()
    existing = SimpleNamespace(
        id=uuid.uuid4(),
        slug="existing-legacy",
        user_id=user.id,
        conversation_id="conv-shared-1",
        scene_image_url="https://cdn.example/old.jpg",
        parent_slug=None,
        published_at=None,
        artifact_kind=ARTIFACT_KIND_LEGACY_LANDING,
        journey_version=1,
        private_payload={},
        public_payload={},
    )

    with (
        patch(
            "backend.services.mirror_network.journey_publish_contract.mirror_journey_v1_enabled",
            return_value=False,
        ),
        patch(
            "backend.services.mirror_network.journey_publish_contract.mirror_journey_v1_enabled",
            return_value=False,
        ),
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_conversation",
            new_callable=AsyncMock,
            return_value=existing,
        ) as by_conv,
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_slug_for_user",
            new_callable=AsyncMock,
        ) as by_slug,
        patch(
            "backend.services.mirror_network.publish.update_mirror_network_node",
            new_callable=AsyncMock,
            return_value=existing,
        ),
        patch(
            "backend.services.mirror_network.publish.node_to_public_payload",
            return_value=SimpleNamespace(slug="existing-legacy", shareUrl="/m/existing-legacy"),
        ),
    ):
        await publish_mirror_to_network(
            db,
            user,
            _body(journeyId="should-be-ignored"),
        )
        by_conv.assert_awaited()
        by_slug.assert_not_awaited()


@pytest.mark.asyncio
async def test_flag_on_same_conversation_two_journey_ids_create_two_nodes():
    user = _user()
    db = AsyncMock()
    created: list[SimpleNamespace] = []

    async def _create(_db, node):
        created.append(node)
        return node

    with (
        patch(
            "backend.services.mirror_network.journey_publish_contract.mirror_journey_v1_enabled",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.journey_publish_contract.mirror_journey_v1_enabled",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.publish.replace_journey_steps_for_version",
            new_callable=AsyncMock,
        ),
        patch(
            "backend.services.mirror_network.publish.MirrorNetworkNode",
            side_effect=lambda **kwargs: SimpleNamespace(**kwargs),
        ),
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_slug_for_user",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "backend.services.mirror_network.publish.slug_exists",
            new_callable=AsyncMock,
            return_value=False,
        ),
        patch(
            "backend.services.mirror_network.publish.create_mirror_network_node",
            new_callable=AsyncMock,
            side_effect=_create,
        ),
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_conversation",
            new_callable=AsyncMock,
        ) as by_conv,
        patch(
            "backend.services.mirror_network.publish.MirrorNetworkNodeRecord.from_orm",
            side_effect=lambda node: node,
        ),
        patch(
            "backend.services.mirror_network.publish.node_to_public_payload",
            side_effect=lambda record: SimpleNamespace(
                slug=record.slug, shareUrl=f"/m/{record.slug}"
            ),
        ),
    ):
        await publish_mirror_to_network(db, user, _body(journeyId="journey-a"))
        await publish_mirror_to_network(db, user, _body(journeyId="journey-b"))

        by_conv.assert_not_awaited()
        assert len(created) == 2
        assert {n.slug for n in created} == {"journey-a", "journey-b"}
        assert all(n.conversation_id == "conv-shared-1" for n in created)
        assert all(n.artifact_kind == ARTIFACT_KIND_JOURNEY_V1 for n in created)
        assert all(n.journey_version == 1 for n in created)


@pytest.mark.asyncio
async def test_flag_on_same_journey_id_updates_and_bumps_version():
    user = _user()
    db = AsyncMock()
    existing = SimpleNamespace(
        id=uuid.uuid4(),
        slug="journey-a",
        user_id=user.id,
        conversation_id="conv-shared-1",
        scene_image_url="https://cdn.example/old.jpg",
        parent_slug=None,
        published_at=None,
        artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
        journey_version=1,
        private_payload={"intelligenceBrief": {"mirrorLineage": {"generationId": "gen-1"}}},
        public_payload={},
        card_title="old",
        card_date="2026-08-08",
        safety_status="open",
        visibility="public",
        updated_at=None,
    )

    async def _update(_db, node):
        return node

    with (
        patch(
            "backend.services.mirror_network.journey_publish_contract.mirror_journey_v1_enabled",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.journey_publish_contract.mirror_journey_v1_enabled",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.publish.replace_journey_steps_for_version",
            new_callable=AsyncMock,
        ),
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_slug_for_user",
            new_callable=AsyncMock,
            return_value=existing,
        ),
        patch(
            "backend.services.mirror_network.publish.update_mirror_network_node",
            new_callable=AsyncMock,
            side_effect=_update,
        ),
        patch(
            "backend.services.mirror_network.publish.create_mirror_network_node",
            new_callable=AsyncMock,
        ) as create,
        patch(
            "backend.services.mirror_network.publish.node_to_public_payload",
            return_value=SimpleNamespace(slug="journey-a", shareUrl="/m/journey-a"),
        ),
    ):
        await publish_mirror_to_network(
            db, user, _body(journeyId="journey-a", journeyVersion=2, generationId="gen-2")
        )
        create.assert_not_awaited()
        assert existing.journey_version == 2
        assert existing.artifact_kind == ARTIFACT_KIND_JOURNEY_V1


@pytest.mark.asyncio
async def test_legacy_artifact_kind_default_on_conversation_path():
    user = _user()
    db = AsyncMock()
    created: list = []

    async def _create(_db, node):
        created.append(node)
        return node

    with (
        patch(
            "backend.services.mirror_network.journey_publish_contract.mirror_journey_v1_enabled",
            return_value=False,
        ),
        patch(
            "backend.services.mirror_network.journey_publish_contract.mirror_journey_v1_enabled",
            return_value=False,
        ),
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_conversation",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "backend.services.mirror_network.publish.slug_exists",
            new_callable=AsyncMock,
            return_value=False,
        ),
        patch(
            "backend.services.mirror_network.publish.generate_mirror_slug",
            return_value="legacy-auto-slug",
        ),
        patch(
            "backend.services.mirror_network.publish.MirrorNetworkNode",
            side_effect=lambda **kwargs: SimpleNamespace(**kwargs),
        ),
        patch(
            "backend.services.mirror_network.publish.create_mirror_network_node",
            new_callable=AsyncMock,
            side_effect=_create,
        ),
        patch(
            "backend.services.mirror_network.publish.MirrorNetworkNodeRecord.from_orm",
            side_effect=lambda node: node,
        ),
        patch(
            "backend.services.mirror_network.publish.node_to_public_payload",
            return_value=SimpleNamespace(
                slug="legacy-auto-slug", shareUrl="/m/legacy-auto-slug"
            ),
        ),
    ):
        # Flag off → legacy path; not journey_v1.
        await publish_mirror_to_network(db, user, _body())
        assert len(created) == 1
        assert created[0].artifact_kind == ARTIFACT_KIND_LEGACY_LANDING
        assert created[0].slug == "legacy-auto-slug"


def test_legacy_conversation_lookup_source_excludes_unfiltered_fallback():
    """Regression: never fall back to 'latest any artifact_kind' for a conversation."""
    import inspect

    from backend.services.mirror_network import repository as repo

    src = inspect.getsource(repo.get_mirror_network_node_by_conversation)
    assert "ARTIFACT_KIND_LEGACY_LANDING" in src
    assert "created_at.desc()" in src
    # Must not re-query without artifact_kind filter after a miss.
    assert src.count("db.execute") == 1
