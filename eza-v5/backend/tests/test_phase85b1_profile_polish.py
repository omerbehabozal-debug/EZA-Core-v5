# -*- coding: utf-8 -*-
"""Phase 8.5B.1 — profile polish: deterministic order tie-breaker."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from backend.services.mirror_network.author_profile import (
    PROFILE_LIST_ORDER_BY,
    list_owner_profile_yansilar,
    list_published_mirrors_for_author,
)
from backend.models.mirror_network import MirrorNetworkNode


def test_profile_list_order_by_ends_with_slug_asc():
    assert len(PROFILE_LIST_ORDER_BY) == 3
    compiled = [str(clause) for clause in PROFILE_LIST_ORDER_BY]
    assert "published_at" in compiled[0]
    assert "DESC" in compiled[0].upper()
    assert "created_at" in compiled[1]
    assert "DESC" in compiled[1].upper()
    assert "slug" in compiled[2].lower()
    assert "ASC" in compiled[2].upper()
    assert str(PROFILE_LIST_ORDER_BY[-1]) == str(MirrorNetworkNode.slug.asc())


def _node(slug: str, *, published_at, created_at, visibility="public", safety="open"):
    return SimpleNamespace(
        slug=slug,
        visibility=visibility,
        safety_status=safety,
        published_at=published_at,
        created_at=created_at,
        user_id=uuid4(),
        public_payload={"publicTitle": slug},
        private_payload={},
        card_title=slug,
        scene_image_url=None,
        parent_slug=None,
        journey_version=1,
    )


def _order_clause_text(statement) -> str:
    clauses = getattr(statement, "_order_by_clauses", ()) or ()
    return " ".join(str(c) for c in clauses).lower()


@pytest.mark.asyncio
async def test_public_profile_preserves_slug_tiebreak_order(monkeypatch):
    """Equal timestamps → slug ASC among listable rows."""
    owner = uuid4()
    ts = datetime(2026, 8, 20, 12, 0, tzinfo=timezone.utc)
    ordered = [
        _node("alpha", published_at=ts, created_at=ts),
        _node("bravo", published_at=ts, created_at=ts),
        _node("charlie", published_at=ts, created_at=ts),
    ]
    user = SimpleNamespace(
        id=owner, email="x@y.com", public_display_name="Ada", is_active=True
    )

    class _Scalars:
        def all(self):
            return ordered

    class _Result:
        def scalars(self):
            return _Scalars()

    db = MagicMock()
    db.get = AsyncMock(return_value=user)
    db.execute = AsyncMock(return_value=_Result())

    async def fake_metrics(_db, _pairs):
        return {}

    monkeypatch.setattr(
        "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
        fake_metrics,
    )

    payload = await list_published_mirrors_for_author(db, user_id=owner)
    assert payload is not None
    assert [i["slug"] for i in payload["items"]] == ["alpha", "bravo", "charlie"]

    call_args = db.execute.await_args
    assert call_args is not None
    order_sql = _order_clause_text(call_args.args[0])
    assert "slug" in order_sql
    assert "published_at" in order_sql
    assert "created_at" in order_sql


@pytest.mark.asyncio
async def test_owner_profile_preserves_slug_tiebreak_order():
    owner = uuid4()
    ts = datetime(2026, 8, 20, 12, 0, tzinfo=timezone.utc)
    ordered = [
        _node("alpha", published_at=ts, created_at=ts, visibility="unlisted"),
        _node("bravo", published_at=ts, created_at=ts, visibility="private"),
        _node("charlie", published_at=ts, created_at=ts),
    ]
    user = SimpleNamespace(
        id=owner, email="x@y.com", public_display_name="Ada", is_active=True
    )

    class _Scalars:
        def all(self):
            return ordered

    class _Result:
        def scalars(self):
            return _Scalars()

    db = MagicMock()
    db.get = AsyncMock(return_value=user)
    db.execute = AsyncMock(return_value=_Result())

    payload = await list_owner_profile_yansilar(db, owner_user_id=owner)
    assert payload is not None
    assert [i["slug"] for i in payload["items"]] == ["alpha", "bravo", "charlie"]
    call_args = db.execute.await_args
    assert call_args is not None
    order_sql = _order_clause_text(call_args.args[0])
    assert "slug" in order_sql
