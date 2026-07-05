# -*- coding: utf-8 -*-
"""Tests for atomic visual quota consume."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.exc import IntegrityError

from backend.core.account.tiers import AccountTier, get_entitlements_for_tier
from backend.core.account.usage_service import (
    UsageConsumeResult,
    UsageQuotaExceeded,
    consume_usage_event_atomic,
)


def _guest_entitlements():
    return get_entitlements_for_tier(AccountTier.GUEST)


@pytest.mark.asyncio
async def test_same_source_id_retry_returns_existing_without_second_insert():
    existing = SimpleNamespace(id=uuid.uuid4())
    db = AsyncMock()

    with (
        patch(
            "backend.core.account.usage_service._acquire_subject_quota_lock",
            new_callable=AsyncMock,
        ),
        patch(
            "backend.core.account.usage_service._find_usage_event_by_source",
            new_callable=AsyncMock,
            return_value=existing,
        ) as mock_find,
    ):
        result = await consume_usage_event_atomic(
            db,
            event_type="mirror_created",
            guest_fingerprint="fp-guest",
            source_id="visual:conv-1:req-abcdef12",
            tier=AccountTier.GUEST,
            entitlements=_guest_entitlements(),
        )

    assert result.created is False
    assert result.event is existing
    mock_find.assert_awaited_once()
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_integrity_error_returns_existing_event_not_500():
    existing = SimpleNamespace(
        user_id="user-1",
        guest_fingerprint=None,
        event_type="mirror_created",
        source_id="visual:conv-1:req-abcdef12",
    )
    db = AsyncMock()
    db.begin_nested = MagicMock(return_value=AsyncMock())
    db.begin_nested.return_value.__aenter__ = AsyncMock(return_value=None)
    db.begin_nested.return_value.__aexit__ = AsyncMock(return_value=None)
    db.flush = AsyncMock(side_effect=IntegrityError("insert", {}, Exception()))

    find_results = [None, existing]

    async def _find_side_effect(*args, **kwargs):
        return find_results.pop(0)

    with (
        patch(
            "backend.core.account.usage_service._acquire_subject_quota_lock",
            new_callable=AsyncMock,
        ),
        patch(
            "backend.core.account.usage_service._find_usage_event_by_source",
            side_effect=_find_side_effect,
        ),
        patch(
            "backend.core.account.usage_service._assert_visual_quota_available",
            new_callable=AsyncMock,
        ),
        patch("backend.core.account.usage_service.AccountUsageEvent") as mock_event_cls,
    ):
        mock_event_cls.return_value = SimpleNamespace(source_id="visual:conv-1:req-abcdef12")
        result = await consume_usage_event_atomic(
            db,
            event_type="mirror_created",
            user_id="user-1",
            source_id="visual:conv-1:req-abcdef12",
            tier=AccountTier.STANDARD,
            entitlements=get_entitlements_for_tier(AccountTier.STANDARD),
        )

    assert result.created is False
    assert result.event is existing


@pytest.mark.asyncio
async def test_limit_exceeded_raises_domain_error_not_generic():
    db = AsyncMock()
    with (
        patch(
            "backend.core.account.usage_service._acquire_subject_quota_lock",
            new_callable=AsyncMock,
        ),
        patch(
            "backend.core.account.usage_service._find_usage_event_by_source",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "backend.core.account.usage_service._assert_visual_quota_available",
            new_callable=AsyncMock,
            side_effect=UsageQuotaExceeded(
                reason="visual_daily_limit_reached",
                tier=AccountTier.GUEST,
            ),
        ),
    ):
        with pytest.raises(UsageQuotaExceeded) as exc:
            await consume_usage_event_atomic(
                db,
                event_type="mirror_created",
                guest_fingerprint="fp-guest",
                source_id="visual:guest:fp-guest:req-abcdef12",
                tier=AccountTier.GUEST,
                entitlements=_guest_entitlements(),
            )

    assert exc.value.reason == "visual_daily_limit_reached"


@pytest.mark.asyncio
async def test_successful_consume_returns_created_true():
    db = AsyncMock()
    db.begin_nested = MagicMock(return_value=AsyncMock())
    db.begin_nested.return_value.__aenter__ = AsyncMock(return_value=None)
    db.begin_nested.return_value.__aexit__ = AsyncMock(return_value=None)
    db.flush = AsyncMock()

    with (
        patch(
            "backend.core.account.usage_service._acquire_subject_quota_lock",
            new_callable=AsyncMock,
        ),
        patch(
            "backend.core.account.usage_service._find_usage_event_by_source",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "backend.core.account.usage_service._assert_visual_quota_available",
            new_callable=AsyncMock,
        ),
        patch("backend.core.account.usage_service.AccountUsageEvent") as mock_event_cls,
    ):
        created_event = SimpleNamespace(source_id="visual:conv-1:req-abcdef12")
        mock_event_cls.return_value = created_event
        result = await consume_usage_event_atomic(
            db,
            event_type="mirror_created",
            user_id="user-1",
            source_id="visual:conv-1:req-abcdef12",
            tier=AccountTier.PREMIUM,
            entitlements=get_entitlements_for_tier(AccountTier.PREMIUM),
        )

    assert isinstance(result, UsageConsumeResult)
    assert result.created is True
    db.add.assert_called_once()
