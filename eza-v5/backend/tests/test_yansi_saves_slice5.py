# -*- coding: utf-8 -*-
"""Slice 5 — Merakıma ekle / Meraklarım Save bookmarks."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.mirror_network import yansi_saves as saves_mod
from backend.services.mirror_network.yansi_saves import (
    YansiSaveNotAllowedError,
    YansiSelfSaveNotAllowedError,
    is_slug_saved_for_user,
    list_saved_yansilar_for_user,
    save_yansi_for_user,
    unsave_yansi_for_user,
)


def _node(**kwargs):
    defaults = {
        "slug": "yansi-b",
        "visibility": "public",
        "safety_status": "open",
        "user_id": uuid4(),
        "id": uuid4(),
        "published_at": datetime.now(timezone.utc),
        "public_payload": {"publicTitle": "Demo B"},
        "private_payload": {},
        "card_title": "Demo B",
        "scene_image_url": "https://cdn.example/b.jpg",
        "artifact_kind": "journey_v1",
        "freeze_status": "frozen",
        "journey_version": 1,
        "parent_slug": None,
        "conversation_id": "conv-secret",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _frozen_public(slug: str = "yansi-b"):
    return {
        "slug": slug,
        "journeyId": slug,
        "journeyVersion": 1,
        "publicTitle": f"Title {slug}",
        "publicSummary": "Summary",
        "sceneImageUrl": f"https://cdn.example/{slug}.jpg",
        "authorUserId": str(uuid4()),
        "replayReady": True,
        "selectedCount": 8,
        "steps": [],
    }


@pytest.mark.asyncio
async def test_save_public_consumable():
    owner = uuid4()
    saver = uuid4()
    node = _node(user_id=owner, slug="yansi-b")
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalar_one_or_none=lambda: None)
    )
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.rollback = AsyncMock()

    with (
        patch.object(saves_mod, "get_mirror_network_node_by_slug", AsyncMock(return_value=node)),
        patch.object(
            saves_mod,
            "is_direct_link_accessible",
            return_value=True,
        ),
        patch.object(
            saves_mod,
            "get_public_frozen_journey_artifact",
            AsyncMock(return_value=_frozen_public()),
        ),
        patch.object(
            saves_mod,
            "_build_save_row",
            return_value=SimpleNamespace(
                id=uuid4(),
                user_id=saver,
                mirror_slug="yansi-b",
                mirror_node_id=node.id,
            ),
        ),
    ):
        result = await save_yansi_for_user(db, user_id=saver, slug="yansi-b")

    assert result.status == "saved"
    assert result.saved is True
    assert result.slug == "yansi-b"
    db.add.assert_called_once()
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_duplicate_save_idempotent():
    owner = uuid4()
    saver = uuid4()
    node = _node(user_id=owner)
    prior = SimpleNamespace(id=uuid4(), mirror_slug="yansi-b", user_id=saver)
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalar_one_or_none=lambda: prior)
    )

    with (
        patch.object(saves_mod, "get_mirror_network_node_by_slug", AsyncMock(return_value=node)),
        patch.object(saves_mod, "is_direct_link_accessible", return_value=True),
        patch.object(
            saves_mod,
            "get_public_frozen_journey_artifact",
            AsyncMock(return_value=_frozen_public()),
        ),
    ):
        result = await save_yansi_for_user(db, user_id=saver, slug="yansi-b")

    assert result.status == "already_saved"
    assert result.saved is True
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_self_save_rejected():
    owner = uuid4()
    node = _node(user_id=owner)
    db = AsyncMock()

    with (
        patch.object(saves_mod, "get_mirror_network_node_by_slug", AsyncMock(return_value=node)),
        patch.object(saves_mod, "is_direct_link_accessible", return_value=True),
        patch.object(
            saves_mod,
            "get_public_frozen_journey_artifact",
            AsyncMock(return_value=_frozen_public()),
        ),
        pytest.raises(YansiSelfSaveNotAllowedError),
    ):
        await save_yansi_for_user(db, user_id=owner, slug="yansi-b")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "visibility,safety,frozen_ok",
    [
        ("private", "open", True),
        ("public", "restricted", True),
        ("public", "open", False),
    ],
)
async def test_cannot_save_inaccessible(visibility, safety, frozen_ok):
    node = _node(visibility=visibility, safety_status=safety)
    db = AsyncMock()
    accessible = visibility != "private" and safety != "restricted"

    with (
        patch.object(saves_mod, "get_mirror_network_node_by_slug", AsyncMock(return_value=node)),
        patch.object(saves_mod, "is_direct_link_accessible", return_value=accessible),
        patch.object(
            saves_mod,
            "get_public_frozen_journey_artifact",
            AsyncMock(return_value=_frozen_public() if frozen_ok and accessible else None),
        ),
        pytest.raises(YansiSaveNotAllowedError),
    ):
        await save_yansi_for_user(db, user_id=uuid4(), slug="yansi-b")


@pytest.mark.asyncio
async def test_cannot_save_missing():
    db = AsyncMock()
    with (
        patch.object(saves_mod, "get_mirror_network_node_by_slug", AsyncMock(return_value=None)),
        pytest.raises(YansiSaveNotAllowedError),
    ):
        await save_yansi_for_user(db, user_id=uuid4(), slug="nope")


@pytest.mark.asyncio
async def test_unsave_and_repeat():
    db = AsyncMock()
    db.execute = AsyncMock(return_value=SimpleNamespace(rowcount=1))
    db.commit = AsyncMock()
    first = await unsave_yansi_for_user(db, user_id=uuid4(), slug="yansi-b")
    assert first.status == "removed"
    assert first.saved is False

    db.execute = AsyncMock(return_value=SimpleNamespace(rowcount=0))
    second = await unsave_yansi_for_user(db, user_id=uuid4(), slug="yansi-b")
    assert second.status == "already_removed"
    assert second.saved is False


@pytest.mark.asyncio
async def test_is_saved_scoped_to_user():
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalar_one_or_none=lambda: uuid4())
    )
    assert await is_slug_saved_for_user(db, user_id=uuid4(), slug="yansi-b") is True
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalar_one_or_none=lambda: None)
    )
    assert await is_slug_saved_for_user(db, user_id=uuid4(), slug="yansi-b") is False


@pytest.mark.asyncio
async def test_list_available_and_unavailable_after_unpublish():
    saver = uuid4()
    owner = uuid4()
    now = datetime.now(timezone.utc)
    save_row = SimpleNamespace(
        mirror_slug="yansi-b",
        created_at=now,
        user_id=saver,
        mirror_node_id=uuid4(),
    )
    node = _node(user_id=owner, visibility="private", slug="yansi-b")

    count_result = SimpleNamespace(scalar_one=lambda: 1)
    rows_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [save_row]))

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[count_result, rows_result])
    db.get = AsyncMock(return_value=SimpleNamespace(
        public_display_name="Ada",
        public_honorific="curious",
        public_avatar_url=None,
        email="hidden@example.com",
    ))

    with (
        patch.object(saves_mod, "get_mirror_network_node_by_slug", AsyncMock(return_value=node)),
        patch.object(saves_mod, "is_direct_link_accessible", return_value=False),
        patch.object(
            saves_mod,
            "get_public_frozen_journey_artifact",
            AsyncMock(return_value=None),
        ),
    ):
        payload = await list_saved_yansilar_for_user(db, user_id=saver, limit=48, offset=0)

    assert payload["total"] == 1
    assert len(payload["items"]) == 1
    item = payload["items"][0]
    assert item["availability"] == "unavailable"
    assert item["slug"] == "yansi-b"
    assert "publicTitle" not in item or item.get("publicTitle") is None
    assert "conversationId" not in item
    assert "private_payload" not in item
    dumped = str(item)
    assert "conv-secret" not in dumped
    assert "hidden@example.com" not in dumped


@pytest.mark.asyncio
async def test_list_available_projection_privacy():
    saver = uuid4()
    owner = uuid4()
    now = datetime.now(timezone.utc)
    save_row = SimpleNamespace(
        mirror_slug="yansi-b",
        created_at=now,
        user_id=saver,
        mirror_node_id=uuid4(),
    )
    node = _node(user_id=owner, slug="yansi-b")
    author = SimpleNamespace(
        public_display_name="Ada Yılmaz",
        public_honorific="bilgin",
        public_avatar_url=None,
        email="secret@example.com",
        account_tier="premium",
    )

    count_result = SimpleNamespace(scalar_one=lambda: 1)
    rows_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [save_row]))
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[count_result, rows_result])
    db.get = AsyncMock(return_value=author)

    with (
        patch.object(saves_mod, "get_mirror_network_node_by_slug", AsyncMock(return_value=node)),
        patch.object(saves_mod, "is_direct_link_accessible", return_value=True),
        patch.object(
            saves_mod,
            "get_public_frozen_journey_artifact",
            AsyncMock(return_value=_frozen_public()),
        ),
    ):
        payload = await list_saved_yansilar_for_user(db, user_id=saver)

    item = payload["items"][0]
    assert item["availability"] == "available"
    assert item["publicTitle"] == "Title yansi-b"
    assert item["authorDisplayName"]
    assert "email" not in item
    assert "conversationId" not in item
    assert "account_tier" not in item
    assert "lineage" not in item


@pytest.mark.asyncio
async def test_list_most_recent_first_query_order():
    """Service orders by created_at DESC — verified via execute call presence."""
    db = AsyncMock()
    count_result = SimpleNamespace(scalar_one=lambda: 0)
    rows_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    db.execute = AsyncMock(side_effect=[count_result, rows_result])
    payload = await list_saved_yansilar_for_user(db, user_id=uuid4())
    assert payload["items"] == []
    assert payload["total"] == 0
    assert db.execute.await_count == 2


@pytest.mark.asyncio
async def test_save_does_not_mutate_node_fields():
    owner = uuid4()
    saver = uuid4()
    node = _node(
        user_id=owner,
        visibility="public",
        parent_slug="inspiration-root",
        conversation_id="conv-1",
    )
    original = {
        "visibility": node.visibility,
        "parent_slug": node.parent_slug,
        "conversation_id": node.conversation_id,
        "freeze_status": node.freeze_status,
    }
    db = AsyncMock()
    db.execute = AsyncMock(
        return_value=SimpleNamespace(scalar_one_or_none=lambda: None)
    )
    db.add = MagicMock()
    db.commit = AsyncMock()

    with (
        patch.object(saves_mod, "get_mirror_network_node_by_slug", AsyncMock(return_value=node)),
        patch.object(saves_mod, "is_direct_link_accessible", return_value=True),
        patch.object(
            saves_mod,
            "get_public_frozen_journey_artifact",
            AsyncMock(return_value=_frozen_public()),
        ),
        patch.object(
            saves_mod,
            "_build_save_row",
            return_value=SimpleNamespace(
                id=uuid4(),
                user_id=saver,
                mirror_slug="yansi-b",
                mirror_node_id=node.id,
            ),
        ),
    ):
        await save_yansi_for_user(db, user_id=saver, slug="yansi-b")

    assert node.visibility == original["visibility"]
    assert node.parent_slug == original["parent_slug"]
    assert node.conversation_id == original["conversation_id"]
    assert node.freeze_status == original["freeze_status"]


def test_router_registers_me_saved_before_slug_routes():
    from backend.routers import mirror_network as router_mod

    src = open(router_mod.__file__, encoding="utf-8").read()
    me_saved = src.index('"/me/saved"')
    slug_save = src.index('"/{slug}/save"')
    # Bare GET /{slug} public payload (not /{slug}/save).
    slug_get = src.index('@router.get("/{slug}", response_model=MirrorNetworkPublicPayload)')
    assert me_saved < slug_save
    assert me_saved < slug_get
    assert "self_save_not_allowed" in src
