# -*- coding: utf-8 -*-
"""Mirror sohbet session (Stage 2B) tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from types import SimpleNamespace

from backend.core.schemas.mirror_network import MirrorNetworkPublicPayload
from backend.main import app
from backend.services.mirror_network.fixtures import build_fixture_mirror_node
from backend.services.mirror_network.service import node_to_public_payload
from backend.services.mirror_network.sohbet_session import (
    build_opening_message,
    build_sohbet_session_response,
    build_thought_cards,
    derive_curiosity_anchor,
    resolve_mirror_lineage_ids,
    resolve_public_scene_image_url,
)

client = TestClient(app)

FORBIDDEN_RESPONSE_KEYS = {
    "userId",
    "conversationId",
    "mirrorBody",
    "topicSummary",
    "private_payload",
    "coreCuriosity",
    "hooks",
    "seedQuestions",
}


def _public_payload() -> MirrorNetworkPublicPayload:
    return node_to_public_payload(build_fixture_mirror_node(slug_suffix="sohbet1"))


def test_derive_curiosity_anchor_kyoto():
    anchor = derive_curiosity_anchor(
        curiosity_context="Bu merak alanı, Japonya'da yürüyerek keşif üzerine doğmuş bir sohbetten ilham alır.",
        card_title="Sokak Lambaları",
        core_curiosity="Kyoto yağmurdan sonra nasıl bir atmosfer taşır?",
    )
    assert anchor == "Kyoto'nun akşam ritmini keşfetme"


def test_opening_message_has_two_parts():
    msg = build_opening_message("Kyoto'nun akşam ritmini keşfetme")
    assert "Bu Ayna," in msg
    assert "senin sorularınla devam ediyor" in msg
    assert "sohbetten" not in msg.lower()


def test_thought_cards_max_three_editorial():
    public = _public_payload()
    cards = build_thought_cards(public)
    assert 1 <= len(cards) <= 3
    assert all("?" not in c.label for c in cards)


def test_session_response_excludes_private_fields():
    session = build_sohbet_session_response(_public_payload(), guest_token=None)
    data = session.model_dump()
    for key in FORBIDDEN_RESPONSE_KEYS:
        assert key not in data
    assert "coreCuriosity" not in session.model_dump_json()
    assert session.openingMessage
    assert session.guestToken
    assert session.parentMirrorId == session.mirrorSlug
    assert session.rootMirrorId == session.mirrorSlug
    assert session.seedTopic == session.cardTitle
    assert session.seedCategory == "travel"
    assert session.seedMood == "discovery"
    assert session.sceneImageUrl
    assert session.sceneImageUrl.startswith("https://")


def test_resolve_public_scene_image_url_rejects_data_and_blob():
    assert resolve_public_scene_image_url("https://cdn.example/a.jpg") == "https://cdn.example/a.jpg"
    assert resolve_public_scene_image_url("data:image/png;base64,abc") is None
    assert resolve_public_scene_image_url("blob:https://x") is None
    assert resolve_public_scene_image_url(None) is None


def test_resolve_mirror_lineage_ids_with_parent():
    parent, root = resolve_mirror_lineage_ids(
        slug="child-mirror",
        parent_slug="parent-mirror",
    )
    assert parent == "parent-mirror"
    assert root == "parent-mirror"


def test_start_sohbet_session_endpoint():
    public = _public_payload()
    with (
        patch(
            "backend.routers.mirror_network.assert_can_start_discover_conversation",
            new=AsyncMock(return_value=SimpleNamespace(user_id=None, guest_fingerprint="fp")),
        ),
        patch(
            "backend.routers.mirror_network.record_account_usage_event",
            new=AsyncMock(),
        ),
        patch(
            "backend.routers.mirror_network.create_sohbet_session",
            new=AsyncMock(
                return_value=build_sohbet_session_response(public, guest_token="guest-existing-token-12345")
            ),
        ),
    ):
        response = client.post(
            f"/api/mirror-network/{public.slug}/sohbet/session",
            json={"guestToken": "guest-existing-token-12345"},
        )
    assert response.status_code == 201
    body = response.json()
    assert body["mirrorSlug"] == public.slug
    assert body["openingMessage"]
    assert body["thoughtCards"]
    assert body["parentMirrorId"]
    assert body["rootMirrorId"]
    assert body["seedTopic"] == public.cardTitle
    assert body["seedCategory"] == "travel"
    assert body["seedMood"] == "discovery"
    assert body.get("sceneImageUrl")
    for key in FORBIDDEN_RESPONSE_KEYS:
        assert key not in body
