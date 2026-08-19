# -*- coding: utf-8 -*-
"""Phase 8.2 — share + Discover → frozen Yansı loop closure tests."""

from __future__ import annotations

import pytest

from backend.core.account.tiers import get_entitlements_for_tier, AccountTier
from backend.services.mirror_network.publish import map_mirror_safety_level
from backend.services.mirror_network.slug import build_mirror_share_url


def test_share_url_defaults_to_standalone_ezacore(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("EZA_MIRROR_PUBLIC_BASE_URL", raising=False)
    url = build_mirror_share_url("kyoto-journey")
    assert url == "https://standalone.ezacore.ai/m/kyoto-journey"
    assert "saina.app" not in url


def test_share_url_respects_env_override(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("EZA_MIRROR_PUBLIC_BASE_URL", "https://staging.example.com")
    from backend.config import get_settings

    get_settings.cache_clear()
    url = build_mirror_share_url("slug-a")
    get_settings.cache_clear()
    assert url == "https://staging.example.com/m/slug-a"


def test_sensitive_publish_not_discover_open_public():
    safety_status, visibility = map_mirror_safety_level("sensitive")
    assert safety_status == "review"
    assert visibility == "unlisted"


def test_normal_publish_unchanged():
    assert map_mirror_safety_level("normal") == ("open", "public")


def test_free_tier_mirror_limit_at_least_guest():
    guest = get_entitlements_for_tier(AccountTier.GUEST)
    free = get_entitlements_for_tier(AccountTier.FREE)
    assert guest["dailyMirrorLimit"] == 1
    assert free["dailyMirrorLimit"] == 1
    assert free["dailyMirrorLimit"] >= guest["dailyMirrorLimit"]
