# -*- coding: utf-8 -*-
"""Tests for SAINA message quota guard (PR3)."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.core.account.guards import assert_can_send_message
from backend.core.account.tiers import AccountTier
from backend.main import app
from backend.security.rate_limit import rate_limit_standalone
from backend.services.production_auth import create_access_token

client = TestClient(app)

GUEST_TOKEN = "guest-token-abcdefghijklmnop"


def _make_user(*, email: str, mirror_plan: str):
    return SimpleNamespace(
        id=uuid.uuid4(),
        email=email,
        password_hash="hash",
        role="user",
        is_active=True,
        mirror_plan=mirror_plan,
    )


def _auth_header(user) -> dict[str, str]:
    token = create_access_token(user)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _noop_rate_limit():
    app.dependency_overrides[rate_limit_standalone] = lambda: None
    yield
    app.dependency_overrides.pop(rate_limit_standalone, None)


@patch("backend.main.assert_can_send_message", new_callable=AsyncMock)
def test_standalone_stream_delegates_to_message_guard(mock_guard):
    mock_guard.return_value = SimpleNamespace(tier=AccountTier.GUEST)
    res = client.post(
        "/api/standalone/stream",
        json={"query": "merhaba"},
        headers={"X-Guest-Token": GUEST_TOKEN},
    )
    assert res.status_code == 200
    mock_guard.assert_awaited_once()


@patch("backend.core.account.guards.build_account_usage_snapshot", new_callable=AsyncMock)
@patch("backend.core.account.guards.record_account_usage_event", new_callable=AsyncMock)
@patch("backend.core.account.guards.resolve_account_subject", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_assert_can_send_message_records_when_allowed(
    mock_subject,
    mock_record,
    mock_usage,
):
    from backend.core.account.subject import AccountSubject

    mock_subject.return_value = AccountSubject(
        tier=AccountTier.FREE,
        user_id="user-1",
        guest_fingerprint=None,
        is_authenticated=True,
    )
    mock_usage.return_value = {
        "dailyMessagesUsed": 2,
        "dailyMessagesLimit": 20,
        "dailyDiscoverStartsUsed": 0,
        "dailyDiscoverStartsLimit": 1,
        "nextVisualAvailableAt": None,
    }

    db = AsyncMock()
    subject = await assert_can_send_message(
        db,
        message_text="hello",
        credentials=None,
        guest_token=None,
    )

    assert subject.tier == AccountTier.FREE
    mock_record.assert_awaited_once()


@patch("backend.core.account.guards.build_account_usage_snapshot", new_callable=AsyncMock)
@patch("backend.core.account.guards.resolve_account_subject", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_assert_can_send_message_blocks_at_limit(mock_subject, mock_usage):
    from backend.core.account.subject import AccountSubject
    from fastapi import HTTPException

    mock_subject.return_value = AccountSubject(
        tier=AccountTier.FREE,
        user_id="user-1",
        guest_fingerprint=None,
        is_authenticated=True,
    )
    mock_usage.return_value = {
        "dailyMessagesUsed": 20,
        "dailyMessagesLimit": 20,
        "dailyDiscoverStartsUsed": 0,
        "dailyDiscoverStartsLimit": 1,
        "nextVisualAvailableAt": None,
    }

    with pytest.raises(HTTPException) as exc:
        await assert_can_send_message(
            AsyncMock(),
            message_text="hello",
            credentials=None,
            guest_token=None,
        )

    assert exc.value.status_code == 403
    detail = exc.value.detail
    assert detail["reason"] == "daily_message_limit_reached"
    assert detail["upgradeRequired"] is True
    assert detail["recommendedTier"] == "mini"


@patch("backend.core.account.guards.resolve_account_subject", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_assert_can_send_message_requires_guest_token(mock_subject):
    from backend.core.account.subject import AccountSubject
    from fastapi import HTTPException

    mock_subject.return_value = AccountSubject(
        tier=AccountTier.GUEST,
        user_id=None,
        guest_fingerprint=None,
        is_authenticated=False,
    )

    with pytest.raises(HTTPException) as exc:
        await assert_can_send_message(
            AsyncMock(),
            message_text="hello",
            credentials=None,
            guest_token=None,
        )

    assert exc.value.status_code == 403
    assert exc.value.detail["reason"] == "guest_token_required"


@patch("backend.main.run_full_pipeline", new_callable=AsyncMock)
@patch("backend.main.assert_can_send_message", new_callable=AsyncMock)
def test_standalone_endpoint_returns_403_when_guard_blocks(mock_guard, mock_pipeline):
    from fastapi import HTTPException

    mock_guard.side_effect = HTTPException(
        status_code=403,
        detail={
            "allowed": False,
            "reason": "daily_message_limit_reached",
            "upgradeRequired": True,
            "currentTier": "free",
            "recommendedTier": "mini",
        },
    )

    res = client.post(
        "/api/standalone",
        json={"query": "merhaba"},
        headers={"X-Guest-Token": GUEST_TOKEN},
    )
    assert res.status_code == 403
    assert res.json()["detail"]["reason"] == "daily_message_limit_reached"
    mock_pipeline.assert_not_awaited()
