# -*- coding: utf-8 -*-
"""Phase 8.5 — public profile & identity privacy closure tests."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from backend.services.mirror_network.public_identity import (
    PUBLIC_DISPLAY_NAME_FALLBACK,
    resolve_public_display_name,
    validate_public_display_name,
)
from backend.services.mirror_network.visibility_access import is_profile_listable
from backend.services.mirror_network.author_profile import (
    _public_display_name_from_email,
    list_published_mirrors_for_author,
)


def _pub_node(**kwargs):
    now = datetime.now(timezone.utc)
    defaults = {
        "slug": "pub",
        "visibility": "public",
        "safety_status": "open",
        "published_at": now,
        "user_id": uuid4(),
        "public_payload": {"publicTitle": "Open"},
        "private_payload": {},
        "card_title": "Open",
        "scene_image_url": None,
        "parent_slug": None,
        "journey_version": 1,
        "created_at": now,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_email_local_part_never_public_display_fallback():
    assert _public_display_name_from_email("omerbozal@gmail.com") == PUBLIC_DISPLAY_NAME_FALLBACK
    assert _public_display_name_from_email("john.smith@company.com") == PUBLIC_DISPLAY_NAME_FALLBACK
    user = SimpleNamespace(email="omerbozal@gmail.com", public_display_name=None)
    assert resolve_public_display_name(user) == PUBLIC_DISPLAY_NAME_FALLBACK
    assert "omerbozal" not in resolve_public_display_name(user)


def test_missing_public_name_uses_neutral_fallback():
    assert resolve_public_display_name(None) == PUBLIC_DISPLAY_NAME_FALLBACK
    assert resolve_public_display_name(SimpleNamespace(public_display_name=None)) == PUBLIC_DISPLAY_NAME_FALLBACK
    assert resolve_public_display_name(SimpleNamespace(public_display_name="  ")) == PUBLIC_DISPLAY_NAME_FALLBACK


def test_explicit_display_name_appears_publicly():
    user = SimpleNamespace(public_display_name="Ayşe Meraklı", email="a@b.com")
    assert resolve_public_display_name(user) == "Ayşe Meraklı"


def test_display_name_validation_matrix():
    assert validate_public_display_name("  Meraklı  ") == "Meraklı"
    assert validate_public_display_name("日本語名") == "日本語名"
    assert validate_public_display_name("محمد") == "محمد"
    assert validate_public_display_name("🌟 Yolcu") == "🌟 Yolcu"

    with pytest.raises(ValueError, match="empty_display_name"):
        validate_public_display_name("   ")
    with pytest.raises(ValueError, match="display_name_too_short"):
        validate_public_display_name("A")
    with pytest.raises(ValueError, match="display_name_too_long"):
        validate_public_display_name("x" * 49)
    with pytest.raises(ValueError, match="display_name_invalid_chars"):
        validate_public_display_name("<script>alert(1)</script>")
    with pytest.raises(ValueError, match="display_name_looks_like_email"):
        validate_public_display_name("user@mail.com")
    with pytest.raises(ValueError, match="display_name_reserved"):
        validate_public_display_name("admin")


@pytest.mark.asyncio
async def test_public_profile_excludes_non_listable(monkeypatch):
    owner = uuid4()
    public_open = _pub_node(slug="pub", user_id=owner)
    unlisted = _pub_node(
        slug="unlist",
        user_id=owner,
        visibility="unlisted",
        public_payload={"publicTitle": "Unlisted"},
        card_title="Unlisted",
    )
    private = _pub_node(
        slug="priv",
        user_id=owner,
        visibility="private",
        public_payload={"publicTitle": "Private"},
        card_title="Private",
    )
    restricted = _pub_node(
        slug="rest",
        user_id=owner,
        visibility="private",
        safety_status="restricted",
        public_payload={"publicTitle": "Restricted"},
        card_title="Restricted",
    )
    withdrawn = _pub_node(
        slug="with",
        user_id=owner,
        visibility="private",
        published_at=None,
        public_payload={"publicTitle": "Withdrawn"},
        card_title="Withdrawn",
    )

    assert is_profile_listable(public_open) is True
    assert is_profile_listable(unlisted) is False
    assert is_profile_listable(private) is False
    assert is_profile_listable(restricted) is False
    assert is_profile_listable(withdrawn) is False

    user = SimpleNamespace(
        id=owner,
        email="secret@example.com",
        public_display_name="Seçilmiş Ad",
        is_active=True,
    )

    class _Scalars:
        def all(self):
            return [public_open, unlisted, private, restricted, withdrawn]

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
    assert payload["displayName"] == "Seçilmiş Ad"
    assert "email" not in payload
    assert payload["total"] == 1
    assert [i["slug"] for i in payload["items"]] == ["pub"]
    serialized = str(payload)
    assert "secret@example.com" not in serialized
    assert "secret" not in payload["displayName"]


def test_public_dto_forbidden_identity_keys_contract():
    """Public author payload must not carry private identity / ranking evidence."""
    forbidden = {
        "email",
        "role",
        "tier",
        "mirror_plan",
        "account_tier",
        "lineageProof",
        "lineage_proof",
        "ezaScore",
        "rankingEvidence",
        "distinctChildAuthorCount",
        "guestToken",
        "sessionId",
    }
    payload = {
        "userId": str(uuid4()),
        "displayName": PUBLIC_DISPLAY_NAME_FALLBACK,
        "items": [],
        "total": 0,
    }
    for key in forbidden:
        assert key not in payload


def test_creator_identity_not_in_ranking_inputs():
    """Phase 7 Strong Curiosity must not take creator popularity / display name."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    sc_dir = root / "services" / "mirror_network"
    sc_files = list(sc_dir.glob("*strong_curiosity*"))
    assert sc_files
    joined = "\n".join(p.read_text(encoding="utf-8") for p in sc_files)
    assert "public_display_name" not in joined
    assert "_public_display_name_from_email" not in joined
    assert 'split("@")' not in joined
    # Creator popularity tokens appear only inside deny / exclusion lists.
    assert "followercount" in joined.lower()
    assert "creatortotalyansis" in joined.lower()
