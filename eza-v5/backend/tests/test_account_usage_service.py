# -*- coding: utf-8 -*-
"""Unit tests for SAINA account usage rollup (PR2)."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from backend.core.account.guest_identity import resolve_guest_fingerprint
from backend.core.account.quota_events import (
    CHAT_MESSAGE,
    DISCOVER_CONVERSATION_STARTED,
    MIRROR_CREATED,
)
from backend.core.account.tiers import AccountTier, get_entitlements_for_tier
from backend.core.account.usage_service import (
    build_account_usage_snapshot,
    compute_next_visual_available_at,
    record_account_usage_event,
    utc_day_start,
)
from backend.services.mirror_network.sohbet_session import guest_token_fingerprint


def test_resolve_guest_fingerprint():
    token = "guest-token-abcdefghijklmnop"
    assert resolve_guest_fingerprint(token) == guest_token_fingerprint(token)
    assert resolve_guest_fingerprint("short") is None
    assert resolve_guest_fingerprint(None) is None


def test_utc_day_start():
    now = datetime(2026, 7, 5, 15, 30, tzinfo=timezone.utc)
    assert utc_day_start(now) == datetime(2026, 7, 5, 0, 0, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_record_account_usage_event_requires_subject():
    db = AsyncMock()
    with pytest.raises(ValueError, match="user_id or guest_fingerprint"):
        await record_account_usage_event(db, event_type=CHAT_MESSAGE)


@pytest.mark.asyncio
async def test_record_account_usage_event_guest():
    db = AsyncMock()
    with patch("backend.core.account.usage_service.AccountUsageEvent") as mock_model:
        mock_event = mock_model.return_value
        event = await record_account_usage_event(
            db,
            event_type=CHAT_MESSAGE,
            guest_fingerprint="abc123",
            metadata={"chars": 42},
        )
        mock_model.assert_called_once_with(
            user_id=None,
            guest_fingerprint="abc123",
            event_type=CHAT_MESSAGE,
            source_id=None,
            event_metadata={"chars": 42},
        )
        assert event is mock_event
        db.add.assert_called_once_with(mock_event)
        db.flush.assert_awaited_once()


@pytest.mark.asyncio
@patch("backend.core.account.usage_service.count_usage_events", new_callable=AsyncMock)
@patch(
    "backend.core.account.usage_service.compute_next_visual_available_at",
    new_callable=AsyncMock,
)
async def test_build_snapshot_guest_lifetime(mock_next_visual, mock_count):
    mock_count.side_effect = [4, 1, 0]
    mock_next_visual.return_value = None

    entitlements = get_entitlements_for_tier(AccountTier.GUEST)
    usage = await build_account_usage_snapshot(
        AsyncMock(),
        tier=AccountTier.GUEST,
        entitlements=entitlements,
        user_id=None,
        guest_fingerprint="fp-guest",
    )

    assert usage["dailyMessagesUsed"] == 4
    assert usage["dailyDiscoverStartsUsed"] == 1
    assert mock_count.await_args_list[0].kwargs["since"] is None
    assert mock_count.await_args_list[2].kwargs["since"] is None


@pytest.mark.asyncio
@patch("backend.core.account.usage_service.count_usage_events", new_callable=AsyncMock)
@patch(
    "backend.core.account.usage_service.compute_next_visual_available_at",
    new_callable=AsyncMock,
)
async def test_build_snapshot_free_daily(mock_next_visual, mock_count):
    mock_count.side_effect = [12, 0, 0]
    mock_next_visual.return_value = None
    fixed_now = datetime(2026, 7, 5, 10, 0, tzinfo=timezone.utc)

    entitlements = get_entitlements_for_tier(AccountTier.FREE)
    usage = await build_account_usage_snapshot(
        AsyncMock(),
        tier=AccountTier.FREE,
        entitlements=entitlements,
        user_id="user-1",
        guest_fingerprint=None,
        now=fixed_now,
    )

    assert usage["dailyMessagesUsed"] == 12
    assert usage["dailyMessagesLimit"] == 20
    assert mock_count.await_args_list[0].kwargs["since"] == utc_day_start(fixed_now)


@pytest.mark.asyncio
@patch("backend.core.account.usage_service.get_last_usage_event_at", new_callable=AsyncMock)
async def test_mini_cooldown_next_visual(mock_last_at):
    last = datetime(2026, 7, 5, 8, 0, tzinfo=timezone.utc)
    mock_last_at.return_value = last
    now = datetime(2026, 7, 5, 12, 0, tzinfo=timezone.utc)

    entitlements = get_entitlements_for_tier(AccountTier.MINI)
    next_at = await compute_next_visual_available_at(
        AsyncMock(),
        tier=AccountTier.MINI,
        entitlements=entitlements,
        user_id="user-mini",
        guest_fingerprint=None,
        now=now,
    )

    expected = (last + timedelta(hours=48)).isoformat()
    assert next_at == expected


@pytest.mark.asyncio
@patch("backend.core.account.usage_service.count_usage_events", new_callable=AsyncMock)
async def test_standard_daily_visual_limit(mock_count):
    mock_count.return_value = 1
    now = datetime(2026, 7, 5, 18, 0, tzinfo=timezone.utc)

    entitlements = get_entitlements_for_tier(AccountTier.STANDARD)
    next_at = await compute_next_visual_available_at(
        AsyncMock(),
        tier=AccountTier.STANDARD,
        entitlements=entitlements,
        user_id="user-std",
        guest_fingerprint=None,
        now=now,
    )

    assert next_at == (utc_day_start(now) + timedelta(days=1)).isoformat()


@pytest.mark.asyncio
@patch("backend.core.account.usage_service.count_usage_events", new_callable=AsyncMock)
async def test_guest_visual_limit_no_next_timestamp(mock_count):
    mock_count.return_value = 1
    entitlements = get_entitlements_for_tier(AccountTier.GUEST)

    next_at = await compute_next_visual_available_at(
        AsyncMock(),
        tier=AccountTier.GUEST,
        entitlements=entitlements,
        user_id=None,
        guest_fingerprint="fp-guest",
    )

    assert next_at is None
