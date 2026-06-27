# -*- coding: utf-8 -*-
"""Conversation groups service tests."""

from __future__ import annotations

from types import SimpleNamespace
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.core.schemas.conversation_tree import ConversationTreeMetadata
from backend.main import app
from backend.services.conversation_tree.groups import group_to_response

client = TestClient(app)


def _fake_row(**kwargs):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=kwargs.get("id", uuid4()),
        user_id=kwargs.get("user_id"),
        guest_token=kwargs.get("guest_token", "fp123"),
        title=kwargs.get("title", "Japonya"),
        source=kwargs.get("source", "mirror"),
        parent_group_id=kwargs.get("parent_group_id"),
        sort_order=kwargs.get("sort_order", 1),
        created_at=now,
        updated_at=now,
    )


def test_conversation_tree_metadata_mirror_shape():
    meta = ConversationTreeMetadata(
        groupId="group-1",
        sourceType="mirror",
        startedFromMirrorId="child-slug",
        parentMirrorId="parent-slug",
        rootMirrorId="root-slug",
        seedTopic="Sokak Lambaları",
        seedCategory="travel",
        seedMood="discovery",
        isGuestSession=True,
    )
    data = meta.model_dump()
    assert data["groupId"] == "group-1"
    assert data["sourceType"] == "mirror"
    assert "userId" not in data
    assert "conversationId" not in data


def test_to_response_maps_group_fields():
    row = _fake_row(title="Otomobiller", source="manual")
    resp = group_to_response(row)
    assert resp.title == "Otomobiller"
    assert resp.source == "manual"
    assert resp.id


def test_create_conversation_group_endpoint_mocked():
    row = _fake_row()
    expected = group_to_response(row)

    with patch(
        "backend.routers.conversation_groups.persist_conversation_group",
        new=AsyncMock(return_value=row),
    ):
        response = client.post(
            "/api/conversation-groups",
            json={"title": "Japonya", "source": "mirror", "guestToken": "guest-test-token-abcdefghij"},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Japonya"
    assert body["source"] == "mirror"


def test_list_conversation_groups_endpoint_mocked():
    rows = [_fake_row(title="Mimarlık")]

    with patch(
        "backend.routers.conversation_groups.fetch_conversation_groups",
        new=AsyncMock(return_value=rows),
    ):
        listed = client.get("/api/conversation-groups", params={"guestToken": "guest-list-token"})

    assert listed.status_code == 200
    assert listed.json()[0]["title"] == "Mimarlık"


def test_branch_metadata_fields():
    meta = ConversationTreeMetadata(
        groupId="group-1",
        sourceType="mirror_branch",
        parentConversationId="chat-parent",
        branchFromConversationId="chat-parent",
        branchTitle="Yerel kafeler",
        startedFromMirrorId="mirror-slug",
        rootMirrorId="root-slug",
        seedCategory="travel",
        isGuestSession=True,
    )
    dumped = meta.model_dump_json()
    assert "mirrorBody" not in dumped
    assert meta.branchTitle == "Yerel kafeler"


def test_build_branch_suggestion_cards_max_three():
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
    )
    assert len(cards) <= 3
    assert "?" not in cards[0]
    assert cards
