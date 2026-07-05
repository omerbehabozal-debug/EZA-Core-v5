# -*- coding: utf-8 -*-
"""Tests for SAINA discover quota guard (PR5)."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.core.account.guards import assert_can_start_discover_conversation
from backend.core.account.subject import AccountSubject
from backend.core.account.tiers import AccountTier
from backend.main import app
from backend.security.rate_limit import rate_limit_standalone

client = TestClient(app)

GUEST_TOKEN = "guest-token-abcdefghijklmnop"


@pytest.fixture(autouse=True)
def _noop_rate_limit():
    app.dependency_overrides[rate_limit_standalone] = lambda: None
    yield
    app.dependency_overrides.pop(rate_limit_standalone, None)


@patch("backend.core.account.guards.build_account_usage_snapshot", new_callable=AsyncMock)
@patch("backend.core.account.guards.record_account_usage_event", new_callable=AsyncMock)
@patch("backend.core.account.guards.resolve_account_subject", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_assert_can_start_discover_records_when_allowed(
    mock_subject,
    mock_record,
    mock_usage,
):
    mock_subject.return_value = AccountSubject(
        tier=AccountTier.FREE,
        user_id="user-1",
        guest_fingerprint=None,
        is_authenticated=True,
    )
    mock_usage.return_value = {
        "dailyMessagesUsed": 0,
        "dailyMessagesLimit": 20,
        "dailyDiscoverStartsUsed": 0,
        "dailyDiscoverStartsLimit": 1,
        "visualCreationsUsed": 0,
        "visualCreationsLimit": 0,
        "nextVisualAvailableAt": None,
    }

    db = AsyncMock()
    subject = await assert_can_start_discover_conversation(
        db,
        credentials=None,
        guest_token=None,
        mirror_slug="kyoto-evening",
        record_on_success=True,
    )

    assert subject.tier == AccountTier.FREE
    mock_record.assert_awaited_once()


@patch("backend.core.account.guards.build_account_usage_snapshot", new_callable=AsyncMock)
@patch("backend.core.account.guards.resolve_account_subject", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_assert_can_start_discover_blocks_at_limit(mock_subject, mock_usage):
    mock_subject.return_value = AccountSubject(
        tier=AccountTier.GUEST,
        user_id=None,
        guest_fingerprint="fp-guest",
        is_authenticated=False,
    )
    mock_usage.return_value = {
        "dailyMessagesUsed": 0,
        "dailyMessagesLimit": 5,
        "dailyDiscoverStartsUsed": 1,
        "dailyDiscoverStartsLimit": 1,
        "visualCreationsUsed": 0,
        "visualCreationsLimit": 0,
        "nextVisualAvailableAt": None,
    }

    with pytest.raises(HTTPException) as exc:
        await assert_can_start_discover_conversation(
            AsyncMock(),
            guest_token=GUEST_TOKEN,
            mirror_slug="kyoto-evening",
        )

    assert exc.value.status_code == 403
    assert exc.value.detail["reason"] == "guest_discover_limit_reached"


@patch("backend.core.account.guards.resolve_account_subject", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_assert_can_start_discover_requires_guest_token(mock_subject):
    mock_subject.return_value = AccountSubject(
        tier=AccountTier.GUEST,
        user_id=None,
        guest_fingerprint=None,
        is_authenticated=False,
    )

    with pytest.raises(HTTPException) as exc:
        await assert_can_start_discover_conversation(
            AsyncMock(),
            guest_token=None,
            mirror_slug="kyoto-evening",
        )

    assert exc.value.status_code == 403
    assert exc.value.detail["reason"] == "guest_token_required"


@patch("backend.routers.mirror_network.record_account_usage_event", new_callable=AsyncMock)
@patch("backend.routers.mirror_network.assert_can_start_discover_conversation", new_callable=AsyncMock)
@patch("backend.routers.mirror_network.create_sohbet_session", new_callable=AsyncMock)
def test_sohbet_session_endpoint_records_discover_event(
    mock_create,
    mock_guard,
    mock_record,
):
    from backend.core.schemas.mirror_network import MirrorNetworkPublicPayload
    from backend.services.mirror_network.fixtures import build_fixture_mirror_node
    from backend.services.mirror_network.service import node_to_public_payload
    from backend.services.mirror_network.sohbet_session import build_sohbet_session_response

    public = node_to_public_payload(build_fixture_mirror_node(slug_suffix="discover-quota"))
    mock_guard.return_value = SimpleNamespace(
        user_id=None,
        guest_fingerprint="fp-guest",
    )
    mock_create.return_value = build_sohbet_session_response(public, guest_token=GUEST_TOKEN)

    response = client.post(
        f"/api/mirror-network/{public.slug}/sohbet/session",
        json={"guestToken": GUEST_TOKEN},
    )

    assert response.status_code == 201
    mock_guard.assert_awaited_once()
    mock_record.assert_awaited_once()
    mock_create.assert_awaited_once()
