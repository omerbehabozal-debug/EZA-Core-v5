# -*- coding: utf-8 -*-
"""Public profile eligibility hardening — consumable products only."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from backend.models.mirror_network import ARTIFACT_KIND_JOURNEY_V1
from backend.services.mirror_network.frozen_journey_artifact import FREEZE_STATUS_FROZEN
from backend.services.mirror_network.author_profile import (
    filter_public_profile_eligible_nodes,
    is_public_profile_product_structure,
    list_published_mirrors_for_author,
)


def _frozen_private(*, title: str = "Title", selected_count: int = 8) -> dict:
    return {
        "frozenJourneyArtifact": {
            "freezeStatus": FREEZE_STATUS_FROZEN,
            "selectedCount": selected_count,
            "sceneImageUrl": "https://cdn.example/scene.jpg",
            "publicLanding": {
                "publicTitle": title,
                "publicSummary": "Summary",
            },
        }
    }


def _node(**kwargs):
    now = datetime.now(timezone.utc)
    defaults = {
        "slug": "yansi-a",
        "visibility": "public",
        "safety_status": "open",
        "published_at": now,
        "user_id": uuid4(),
        "public_payload": {"publicTitle": "Open"},
        "private_payload": _frozen_private(),
        "card_title": "Open",
        "scene_image_url": "https://cdn.example/scene.jpg",
        "parent_slug": None,
        "journey_version": 1,
        "created_at": now,
        "artifact_kind": ARTIFACT_KIND_JOURNEY_V1,
        "freeze_status": FREEZE_STATUS_FROZEN,
        "conversation_id": uuid4(),
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_structure_excludes_unpublished_non_frozen_wrong_kind_private_restricted():
    assert is_public_profile_product_structure(_node()) is True
    assert (
        is_public_profile_product_structure(_node(published_at=None, slug="b")) is False
    )
    assert (
        is_public_profile_product_structure(
            _node(freeze_status="non_frozen", slug="c")
        )
        is False
    )
    assert (
        is_public_profile_product_structure(
            _node(artifact_kind="legacy_mirror", slug="e")
        )
        is False
    )
    assert is_public_profile_product_structure(_node(visibility="private", slug="f")) is False
    assert (
        is_public_profile_product_structure(
            _node(visibility="private", safety_status="restricted", slug="g")
        )
        is False
    )
    assert (
        is_public_profile_product_structure(
            _node(visibility="public", safety_status="restricted", slug="g2")
        )
        is False
    )


def test_structure_allows_linked_child_without_requiring_root():
    linked = _node(slug="yansi-c", parent_slug="yansi-a")
    assert is_public_profile_product_structure(linked) is True


@pytest.mark.asyncio
async def test_filter_excludes_replay_invalid_and_keeps_valid(monkeypatch):
    good = _node(slug="good")
    bad_replay = _node(slug="bad-replay")

    async def fake_steps(_db, nodes):
        return {
            (n.slug, 1): [
                {
                    "stepIndex": i + 1,
                    "publicQuestion": f"Q{i}",
                    "publicAnswer": f"A{i}",
                }
                for i in range(8)
            ]
            for n in nodes
        }

    monkeypatch.setattr(
        "backend.services.mirror_network.author_profile._load_steps_for_profile_nodes",
        fake_steps,
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.author_profile.is_replay_ready_from_loaded_child",
        lambda node, steps: node.slug == "good",
    )

    eligible = await filter_public_profile_eligible_nodes(
        MagicMock(), [good, bad_replay]
    )
    assert [n.slug for n in eligible] == ["good"]


@pytest.mark.asyncio
async def test_list_published_matrix_and_no_leak_from_rejected(monkeypatch):
    owner = uuid4()
    now = datetime.now(timezone.utc)
    valid = _node(slug="valid", user_id=owner, published_at=now)
    unpublished = _node(slug="no-pub", user_id=owner, published_at=None)
    unfrozen = _node(slug="unfrozen", user_id=owner, freeze_status="non_frozen")
    wrong_kind = _node(slug="kind", user_id=owner, artifact_kind="other")
    private = _node(slug="priv", user_id=owner, visibility="private")
    restricted = _node(
        slug="rest",
        user_id=owner,
        visibility="public",
        safety_status="restricted",
    )
    linked = _node(slug="linked-child", user_id=owner, parent_slug="valid")
    deleted_source = _node(
        slug="orphan-ok",
        user_id=owner,
        conversation_id=None,
    )

    user = SimpleNamespace(
        id=owner,
        email="secret@example.com",
        public_display_name="Ada",
        is_active=True,
        public_avatar_url=None,
        public_avatar_revision=0,
    )

    class _Scalars:
        def all(self):
            return [
                valid,
                unpublished,
                unfrozen,
                wrong_kind,
                private,
                restricted,
                linked,
                deleted_source,
            ]

    class _Result:
        def scalars(self):
            return _Scalars()

    db = MagicMock()
    db.get = AsyncMock(return_value=user)
    db.execute = AsyncMock(return_value=_Result())

    monkeypatch.setattr(
        "backend.services.mirror_network.author_profile.filter_public_profile_eligible_nodes",
        AsyncMock(return_value=[valid, linked, deleted_source]),
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
        AsyncMock(return_value={}),
    )

    payload = await list_published_mirrors_for_author(db, user_id=owner)
    assert payload is not None
    slugs = [i["slug"] for i in payload["items"]]
    assert slugs == ["valid", "linked-child", "orphan-ok"]
    assert payload["total"] == 3
    serialized = str(payload)
    assert "no-pub" not in serialized
    assert "unfrozen" not in serialized
    assert "secret@example.com" not in serialized
    assert "priv" not in serialized
    assert "rest" not in serialized
    assert "kind" not in serialized


@pytest.mark.asyncio
async def test_list_published_uses_structure_plus_replay_gate(monkeypatch):
    owner = uuid4()
    valid = _node(slug="ok", user_id=owner)
    replay_false = _node(slug="not-ready", user_id=owner)
    user = SimpleNamespace(
        id=owner,
        email="a@b.com",
        public_display_name="Ada",
        is_active=True,
        public_avatar_url=None,
        public_avatar_revision=0,
    )

    class _Scalars:
        def all(self):
            return [valid, replay_false]

    db = MagicMock()
    db.get = AsyncMock(return_value=user)
    db.execute = AsyncMock(
        side_effect=[
            SimpleNamespace(scalars=lambda: _Scalars()),
            SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [])),
        ]
    )

    async def fake_steps(_db, nodes):
        return {(n.slug, 1): [] for n in nodes}

    monkeypatch.setattr(
        "backend.services.mirror_network.author_profile._load_steps_for_profile_nodes",
        fake_steps,
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.author_profile.is_replay_ready_from_loaded_child",
        lambda node, steps: node.slug == "ok",
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
        AsyncMock(return_value={}),
    )

    payload = await list_published_mirrors_for_author(db, user_id=owner)
    assert [i["slug"] for i in payload["items"]] == ["ok"]
    assert payload["total"] == 1
