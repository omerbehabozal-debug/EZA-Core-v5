# -*- coding: utf-8 -*-
"""Mirror viral loop QA — API-level checks (fixture-aligned)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.core.schemas.mirror_network import MirrorNetworkPublicPayload
from backend.main import app
from backend.services.mirror_network.fixtures import build_fixture_mirror_node
from backend.services.mirror_network.service import node_to_public_payload
from backend.services.mirror_network.sohbet_session import build_sohbet_session_response

client = TestClient(app)

FORBIDDEN_PUBLIC_KEYS = {
    "userId",
    "conversationId",
    "mirrorBody",
    "topicSummary",
    "private_payload",
    "behavioralSnapshot",
}

FORBIDDEN_SESSION_KEYS = {
    "userId",
    "conversationId",
    "mirrorBody",
    "coreCuriosity",
    "hooks",
    "seedQuestions",
    "private_payload",
}


def _fixture_public() -> MirrorNetworkPublicPayload:
    return node_to_public_payload(build_fixture_mirror_node(slug_suffix="seed01"))


def test_public_mirror_fixture_has_share_url_and_landing_fields():
    public = _fixture_public()
    data = public.model_dump()
    assert public.slug
    assert public.shareUrl.endswith(f"/m/{public.slug}")
    assert public.cardTitle
    assert public.curiosityContext or public.landingContext
    assert public.sceneImageUrl
    for key in FORBIDDEN_PUBLIC_KEYS:
        assert key not in data


def test_sohbet_session_from_fixture_excludes_private_fields():
    public = _fixture_public()
    session = build_sohbet_session_response(public, guest_token="qa-guest-token-abcdefghijklmnop")
    body = session.model_dump()
    for key in FORBIDDEN_SESSION_KEYS:
        assert key not in body
    assert session.openingMessage
    assert session.thoughtCards
    assert session.parentMirrorId
    assert session.rootMirrorId
    assert "sohbetten" not in session.openingMessage.lower()


def test_public_and_session_endpoints_mocked(fixture_public=None):
    public = fixture_public or _fixture_public()
    session = build_sohbet_session_response(public, guest_token="guest-token-abcdefghijklmnop")

    with patch(
        "backend.routers.mirror_network.fetch_public_mirror_by_slug",
        new=AsyncMock(return_value=public),
    ):
        landing = client.get(f"/api/mirror-network/{public.slug}")
    assert landing.status_code == 200
    landing_body = landing.json()
    assert landing_body["cardTitle"] == public.cardTitle
    for key in FORBIDDEN_PUBLIC_KEYS:
        assert key not in landing_body

    with patch(
        "backend.routers.mirror_network.create_sohbet_session",
        new=AsyncMock(return_value=session),
    ):
        sohbet = client.post(
            f"/api/mirror-network/{public.slug}/sohbet/session",
            json={"guestToken": "guest-token-abcdefghijklmnop"},
        )
    assert sohbet.status_code == 201
    sohbet_body = sohbet.json()
    assert sohbet_body["mirrorSlug"] == public.slug
    for key in FORBIDDEN_SESSION_KEYS:
        assert key not in sohbet_body


def test_branch_suggestion_sources_max_three_no_question_marks():
    from backend.services.conversation_tree.branch_suggestions import build_branch_suggestion_cards

    cards = build_branch_suggestion_cards(
        seed_questions=[
            "Kyoto'nun gizli tapınakları?",
            "Yerel kafeler",
            "Akşam yürüyüş rotaları",
            "Ekstra",
        ],
        discovery_signals=["travel"],
        collection_tags=["japan"],
        thought_cards=["Sessiz mahalleler"],
    )
    assert len(cards) <= 3
    assert all("?" not in c for c in cards)
