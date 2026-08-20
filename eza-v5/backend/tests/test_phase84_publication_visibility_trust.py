# -*- coding: utf-8 -*-
"""Phase 8.4 — publication visibility & trust closure tests."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from backend.services.mirror_network.publish import map_mirror_safety_level
from backend.services.mirror_network.visibility_access import (
    is_children_parent_accessible,
    is_direct_link_accessible,
    is_profile_listable,
    public_access_allowed,
)
from backend.services.mirror_network.yansi_visibility_controls import (
    YansiOwnershipError,
    apply_yansi_safety_removal,
    set_yansi_visibility_for_owner,
    unpublish_yansi_for_owner,
)
from backend.services.mirror_network.yansi_report import (
    ALLOWED_REASONS,
    create_yansi_report,
)


def _node(**kwargs):
    defaults = {
        "slug": "demo-yansi",
        "visibility": "public",
        "safety_status": "open",
        "user_id": uuid4(),
        "id": uuid4(),
        "published_at": object(),
        "public_payload": {"publicTitle": "Demo"},
        "card_title": "Demo",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_unlisted_policy_matrix():
    public_open = _node(visibility="public", safety_status="open")
    unlisted_review = _node(visibility="unlisted", safety_status="review")
    private = _node(visibility="private", safety_status="open")
    restricted = _node(visibility="private", safety_status="restricted")

    assert is_profile_listable(public_open) is True
    assert is_direct_link_accessible(public_open) is True
    assert public_access_allowed(public_open, "discover_listing") is True

    assert is_profile_listable(unlisted_review) is False
    assert is_direct_link_accessible(unlisted_review) is True
    assert is_children_parent_accessible(unlisted_review) is True
    assert public_access_allowed(unlisted_review, "profile_listing") is False
    assert public_access_allowed(unlisted_review, "direct_link") is True

    assert is_profile_listable(private) is False
    assert is_direct_link_accessible(private) is False
    assert is_direct_link_accessible(restricted) is False


def test_sensitive_publish_mapping_unchanged():
    assert map_mirror_safety_level("sensitive") == ("review", "unlisted")
    assert map_mirror_safety_level("normal") == ("open", "public")


@pytest.mark.asyncio
async def test_owner_unpublish_idempotent_and_authz(monkeypatch):
    owner = uuid4()
    other = uuid4()
    node = _node(user_id=owner, visibility="public", safety_status="open")

    async def fake_get(_db, slug):
        return node if slug == node.slug else None

    monkeypatch.setattr(
        "backend.services.mirror_network.yansi_visibility_controls.get_mirror_network_node_by_slug",
        fake_get,
    )

    db = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    first = await unpublish_yansi_for_owner(db, slug=node.slug, owner_user_id=owner)
    assert first.status == "unpublished"
    assert node.visibility == "private"

    second = await unpublish_yansi_for_owner(db, slug=node.slug, owner_user_id=owner)
    assert second.status == "already_unpublished"

    with pytest.raises(YansiOwnershipError):
        await unpublish_yansi_for_owner(db, slug=node.slug, owner_user_id=other)


@pytest.mark.asyncio
async def test_set_visibility_public_to_unlisted(monkeypatch):
    owner = uuid4()
    node = _node(user_id=owner, visibility="public", safety_status="open")

    async def fake_get(_db, slug):
        return node

    monkeypatch.setattr(
        "backend.services.mirror_network.yansi_visibility_controls.get_mirror_network_node_by_slug",
        fake_get,
    )
    db = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    result = await set_yansi_visibility_for_owner(
        db, slug=node.slug, owner_user_id=owner, visibility="unlisted"
    )
    assert result.status == "updated"
    assert node.visibility == "unlisted"
    assert is_profile_listable(node) is False
    assert is_direct_link_accessible(node) is True


@pytest.mark.asyncio
async def test_safety_removal_blocks_public_access(monkeypatch):
    node = _node(visibility="public", safety_status="open")

    async def fake_get(_db, slug):
        return node

    monkeypatch.setattr(
        "backend.services.mirror_network.yansi_visibility_controls.get_mirror_network_node_by_slug",
        fake_get,
    )
    db = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    result = await apply_yansi_safety_removal(db, slug=node.slug)
    assert result.status == "removed"
    assert node.visibility == "private"
    assert node.safety_status == "restricted"
    assert is_direct_link_accessible(node) is False
    assert is_profile_listable(node) is False

    again = await apply_yansi_safety_removal(db, slug=node.slug)
    assert again.status == "already_removed"


@pytest.mark.asyncio
async def test_report_duplicate_and_privacy(monkeypatch):
    # Ensure legacy mappers resolve before constructing YansiReport rows.
    from backend.models.user import LegacyUser  # noqa: F401
    from backend.models.role import Role  # noqa: F401
    from backend.models.institution import Institution  # noqa: F401
    from backend.models.mirror_network import YansiReport

    reporter = uuid4()
    node = _node(visibility="unlisted", safety_status="review")

    async def fake_get(_db, slug):
        return node

    monkeypatch.setattr(
        "backend.services.mirror_network.yansi_report.get_mirror_network_node_by_slug",
        fake_get,
    )

    existing = None

    class _Exec:
        def scalar_one_or_none(self):
            return existing

    db = MagicMock()
    db.execute = AsyncMock(return_value=_Exec())
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    first = await create_yansi_report(
        db, slug=node.slug, reporter_user_id=reporter, reason="privacy"
    )
    assert first.status == "created"
    assert first.reason == "privacy"
    assert "inappropriate" in ALLOWED_REASONS
    db.add.assert_called_once()
    added = db.add.call_args[0][0]
    assert isinstance(added, YansiReport)
    assert not hasattr(added, "ip_address")
    assert not hasattr(added, "user_agent")
    assert not hasattr(added, "eza_score")

    existing = SimpleNamespace(
        id=uuid4(), mirror_slug=node.slug, reason="privacy", reporter_user_id=reporter
    )
    second = await create_yansi_report(
        db, slug=node.slug, reporter_user_id=reporter, reason="other"
    )
    assert second.status == "already_reported"


def test_router_registers_phase84_endpoints():
    from pathlib import Path

    src = Path("routers/mirror_network.py").read_text(encoding="utf-8")
    assert "/{slug}/unpublish" in src
    assert "/{slug}/report" in src
    assert "/{slug}/safety-remove" in src
    assert "/{slug}/visibility" in src
    assert "require_yansi_trust_admin_dependency" in src
    assert "Depends(require_internal())" not in src


def test_author_profile_uses_profile_listable_gate():
    from pathlib import Path

    src = Path("services/mirror_network/author_profile.py").read_text(encoding="utf-8")
    assert "is_profile_listable" in src
    assert "is_children_parent_accessible" in src


def test_audit_script_is_read_only():
    from pathlib import Path

    src = Path("scripts/audit_sensitive_public_yansi_rows.py").read_text(encoding="utf-8")
    assert "SELECT COUNT" in src
    assert "Does NOT mutate" in src
    assert "op.execute" not in src
    assert ".update(" not in src
    assert "DELETE FROM" not in src.upper()
    assert "aggregate_yansi_visibility_audit" in src
    assert "discover_eligible_with_review" not in src
