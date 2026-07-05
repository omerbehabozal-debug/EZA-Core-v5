# -*- coding: utf-8 -*-
"""Tests for SAINA relationship map access guard (PR6)."""

import pytest
from fastapi import HTTPException

from backend.core.account.guards import (
    assert_relationship_map_data_access,
    relationship_map_access_for_tier,
)
from backend.core.account.subject import AccountSubject
from backend.core.account.tiers import AccountTier


def test_relationship_map_access_by_tier():
    assert relationship_map_access_for_tier(AccountTier.GUEST) == "locked"
    assert relationship_map_access_for_tier(AccountTier.FREE) == "locked"
    assert relationship_map_access_for_tier(AccountTier.MINI) == "last_90_days"
    assert relationship_map_access_for_tier(AccountTier.STANDARD) == "all"
    assert relationship_map_access_for_tier(AccountTier.PREMIUM) == "all"


def test_assert_relationship_map_data_access_allows_mini():
    subject = AccountSubject(
        tier=AccountTier.MINI,
        user_id="user-mini",
        guest_fingerprint=None,
        is_authenticated=True,
    )
    assert assert_relationship_map_data_access(subject) == "last_90_days"


def test_assert_relationship_map_data_access_blocks_free():
    subject = AccountSubject(
        tier=AccountTier.FREE,
        user_id="user-free",
        guest_fingerprint=None,
        is_authenticated=True,
    )
    with pytest.raises(HTTPException) as exc:
        assert_relationship_map_data_access(subject)

    assert exc.value.status_code == 403
    assert exc.value.detail["reason"] == "relationship_map_locked"
