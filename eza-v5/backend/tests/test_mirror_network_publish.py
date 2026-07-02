# -*- coding: utf-8 -*-
"""Stage 4C — Mirror Network publish on creation."""

from __future__ import annotations

import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.mirror_network.fixtures import JAPAN_FIXTURE_BUNDLE
from backend.services.mirror_network.publish import (
    map_mirror_safety_level,
    publish_mirror_to_network,
    resolve_scene_image_url,
)
from backend.services.production_auth import create_access_token

client = TestClient(app)

FORBIDDEN_PUBLIC_KEYS = {
    "userId",
    "conversationId",
    "mirrorBody",
    "topicSummary",
    "evidenceLabels",
    "intelligenceBrief",
    "behavioralSnapshot",
    "curiosityPipeline",
}


def _make_user():
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="mirror@test.eza.ai",
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan="plus",
    )


def _auth_header(user) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user)}"}


def _publish_body(conversation_id: str = "conv-publish-1") -> dict:
    return {
        "cardTitle": "Sokak Lambaları",
        "cardDate": "2026-05-31",
        "conversationId": conversation_id,
        "sceneImageUrl": "https://cdn.example/mirror-scene.jpg",
        "curiosityBundle": JAPAN_FIXTURE_BUNDLE,
        "intelligencePrivate": {
            "mirrorBody": "Private mirror body must not leak",
            "topicSummary": "private topic",
            "evidenceLabels": ["Kyoto"],
        },
        "safetyLevel": "normal",
    }


def test_map_mirror_safety_level():
    assert map_mirror_safety_level("normal") == ("open", "public")
    assert map_mirror_safety_level("elevated") == ("review", "unlisted")
    assert map_mirror_safety_level("restricted") == ("restricted", "private")


def test_resolve_scene_image_url_non_null_wins():
    assert resolve_scene_image_url(
        existing_scene="https://cdn.example/a.jpg",
        incoming_scene=None,
    ) == "https://cdn.example/a.jpg"
    assert resolve_scene_image_url(
        existing_scene=None,
        incoming_scene="https://cdn.example/b.jpg",
    ) == "https://cdn.example/b.jpg"


@pytest.mark.asyncio
async def test_null_publish_does_not_clear_existing_scene():
    from backend.core.schemas.mirror_network import MirrorNetworkPublishRequest

    user = _make_user()
    existing = SimpleNamespace(
        id=uuid.uuid4(),
        slug="sokak-lambalari-existing",
        user_id=user.id,
        conversation_id="conv-publish-1",
        visibility="public",
        safety_status="open",
        card_title="Sokak Lambaları",
        card_date="2026-05-31",
        scene_image_url="https://cdn.example/existing-scene.jpg",
        public_payload={"sceneImageUrl": "https://cdn.example/existing-scene.jpg"},
        private_payload={},
        parent_slug=None,
        published_at=None,
        created_at=None,
    )
    db = AsyncMock()

    with (
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_conversation",
            new=AsyncMock(return_value=existing),
        ),
        patch(
            "backend.services.mirror_network.publish.update_mirror_network_node",
            new=AsyncMock(return_value=existing),
        ) as mock_update,
    ):
        body = _publish_body()
        body["sceneImageUrl"] = None
        result = await publish_mirror_to_network(
            db,
            user,
            MirrorNetworkPublishRequest.model_validate(body),
        )

    assert result.sceneImageUrl == "https://cdn.example/existing-scene.jpg"
    mock_update.assert_awaited_once()
    assert existing.scene_image_url == "https://cdn.example/existing-scene.jpg"


@pytest.mark.asyncio
async def test_parallel_publish_interleaving_non_null_wins():
    """
    Deterministic interleaving (not real DB transactions):
    non-null scene insert wins race; null publish IntegrityError recovery must not erase scene.
    """
    from sqlalchemy.exc import IntegrityError

    from backend.core.schemas.mirror_network import MirrorNetworkPublishRequest

    user = _make_user()
    db = AsyncMock()
    db.rollback = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    raced_node = SimpleNamespace(
        id=uuid.uuid4(),
        slug="sokak-lambalari-raced",
        user_id=user.id,
        conversation_id="conv-publish-1",
        visibility="public",
        safety_status="open",
        card_title="Sokak Lambaları",
        card_date="2026-05-31",
        scene_image_url="https://cdn.example/raced-scene.jpg",
        public_payload={"sceneImageUrl": "https://cdn.example/raced-scene.jpg"},
        private_payload={},
        parent_slug=None,
        published_at=None,
        created_at=None,
    )

    async def _create_raises(_db, _node):
        raise IntegrityError("insert", {}, Exception("duplicate"))

    body = _publish_body()
    body["sceneImageUrl"] = None

    with (
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_conversation",
            new=AsyncMock(side_effect=[None, raced_node]),
        ),
        patch(
            "backend.services.mirror_network.publish.slug_exists",
            new=AsyncMock(return_value=False),
        ),
        patch(
            "backend.services.mirror_network.publish.create_mirror_network_node",
            new=AsyncMock(side_effect=_create_raises),
        ),
        patch(
            "backend.services.mirror_network.publish.update_mirror_network_node",
            new=AsyncMock(return_value=raced_node),
        ),
        patch(
            "backend.services.mirror_network.publish.MirrorNetworkNode",
            side_effect=lambda **kwargs: SimpleNamespace(**kwargs),
        ),
    ):
        result = await publish_mirror_to_network(
            db,
            user,
            MirrorNetworkPublishRequest.model_validate(body),
        )

    assert result.sceneImageUrl == "https://cdn.example/raced-scene.jpg"
    assert raced_node.scene_image_url == "https://cdn.example/raced-scene.jpg"


@pytest.mark.asyncio
async def test_publish_mirror_to_network_returns_share_url():
    user = _make_user()
    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    captured: dict = {}

    async def _capture_create(_db, node):
        captured["node"] = node
        return node

    with (
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_conversation",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "backend.services.mirror_network.publish.slug_exists",
            new=AsyncMock(return_value=False),
        ),
        patch(
            "backend.services.mirror_network.publish.create_mirror_network_node",
            new=AsyncMock(side_effect=_capture_create),
        ),
        patch(
            "backend.services.mirror_network.publish.MirrorNetworkNode",
            side_effect=lambda **kwargs: SimpleNamespace(**kwargs),
        ),
    ):
        from backend.core.schemas.mirror_network import MirrorNetworkPublishRequest

        result = await publish_mirror_to_network(
            db,
            user,
            MirrorNetworkPublishRequest.model_validate(_publish_body()),
        )

    assert result.slug
    assert result.shareUrl.endswith(f"/m/{result.slug}")
    assert result.cardTitle == "Sokak Lambaları"
    assert result.shareVoice
    public_json = json.dumps(result.model_dump())
    for key in FORBIDDEN_PUBLIC_KEYS:
        assert key not in public_json
    assert captured["node"].user_id == user.id


@pytest.mark.asyncio
async def test_publish_mirror_to_network_recovers_from_duplicate_insert():
    from sqlalchemy.exc import IntegrityError

    from backend.core.schemas.mirror_network import MirrorNetworkPublishRequest

    user = _make_user()
    db = AsyncMock()
    db.rollback = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    raced_node = SimpleNamespace(
        id=uuid.uuid4(),
        slug="sokak-lambalari-raced",
        user_id=user.id,
        conversation_id="conv-publish-1",
        visibility="public",
        safety_status="open",
        card_title="Sokak Lambaları",
        card_date="2026-05-31",
        scene_image_url="https://cdn.example/mirror-scene.jpg",
        public_payload={},
        private_payload={},
        parent_slug=None,
        published_at=None,
        created_at=None,
    )

    async def _create_raises(_db, _node):
        raise IntegrityError("insert", {}, Exception("duplicate"))

    with (
        patch(
            "backend.services.mirror_network.publish.get_mirror_network_node_by_conversation",
            new=AsyncMock(side_effect=[None, raced_node]),
        ),
        patch(
            "backend.services.mirror_network.publish.slug_exists",
            new=AsyncMock(return_value=False),
        ),
        patch(
            "backend.services.mirror_network.publish.create_mirror_network_node",
            new=AsyncMock(side_effect=_create_raises),
        ),
        patch(
            "backend.services.mirror_network.publish.update_mirror_network_node",
            new=AsyncMock(return_value=raced_node),
        ) as mock_update,
        patch(
            "backend.services.mirror_network.publish.MirrorNetworkNode",
            side_effect=lambda **kwargs: SimpleNamespace(**kwargs),
        ),
    ):
        result = await publish_mirror_to_network(
            db,
            user,
            MirrorNetworkPublishRequest.model_validate(_publish_body()),
        )

    assert result.slug == "sokak-lambalari-raced"
    db.rollback.assert_awaited_once()
    mock_update.assert_awaited_once()


def test_publish_endpoint_requires_auth():
    response = client.post("/api/mirror-network/publish", json=_publish_body())
    assert response.status_code == 401


def test_publish_endpoint_returns_public_payload():
    user = _make_user()
    public_payload = {
        "slug": "sokak-lambalari-abc123",
        "shareUrl": "https://saina.app/m/sokak-lambalari-abc123",
        "cardTitle": "Sokak Lambaları",
        "cardDate": "2026-05-31",
        "sceneImageUrl": "https://cdn.example/mirror-scene.jpg",
        "coreCuriosity": "Kyoto yağmurdan sonra nasıl bir atmosfer taşır?",
        "curiosityContext": "Bu merak alanı...",
        "landingContext": "Bu merak alanı...",
        "hooks": [],
        "seedQuestions": [],
        "discoverySignals": [],
        "collectionTags": [],
        "seed": {
            "topicCategory": "travel",
            "mood": "discovery",
            "subtopics": [],
            "curiosityHooks": [],
            "seedQuestions": [],
            "locale": "tr",
            "safetyTier": "open",
        },
        "shareVoice": "Bazı şehirler gündüz değil, akşam anlaşılır.",
    }

    from backend.core.schemas.mirror_network import MirrorNetworkPublicPayload

    with patch(
        "backend.routers.mirror_network.publish_mirror_to_network",
        new=AsyncMock(return_value=MirrorNetworkPublicPayload.model_validate(public_payload)),
    ), patch(
        "backend.auth.mirror_entitlement.get_production_user_by_id",
        new=AsyncMock(return_value=user),
    ):
        response = client.post(
            "/api/mirror-network/publish",
            json=_publish_body(),
            headers=_auth_header(user),
        )

    assert response.status_code == 201
    body = response.json()
    assert body["shareUrl"]
    assert body["slug"]
    assert body["sceneImageUrl"]
    assert "userId" not in body
    assert "mirrorBody" not in body
    assert "conversationId" not in body
