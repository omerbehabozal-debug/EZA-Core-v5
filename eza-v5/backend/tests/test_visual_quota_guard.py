# -*- coding: utf-8 -*-
"""Tests for SAINA visual quota guard (PR4)."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.core.account.guards import assert_can_create_visual
from backend.core.account.subject import AccountSubject
from backend.core.account.tiers import AccountTier
from backend.main import app
from backend.security.rate_limit import rate_limit_standalone
from backend.services.production_auth import create_access_token

client = TestClient(app)

VALID_BODY = {
    "prompt": "premium soft 3D illustration, wellness garden, no text",
    "negativePrompt": "text, letters, logo",
    "seedHint": "mirror-visual-abc123",
    "stylePreset": "eza_mirror_professional_v1",
    "qualityHints": ["9:16 vertical safe composition"],
    "cardDate": "2026-05-21",
    "conversationId": "conv-visual-guard",
    "generationRequestId": "req-guardabc",
}


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


@patch("backend.core.account.guards.build_account_usage_snapshot", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_assert_can_create_visual_blocks_free_tier(mock_usage):
    free_user = _make_user(email="free@test.eza.ai", mirror_plan="free")
    mock_usage.return_value = {
        "dailyMessagesUsed": 0,
        "dailyMessagesLimit": 20,
        "dailyDiscoverStartsUsed": 0,
        "dailyDiscoverStartsLimit": 1,
        "visualCreationsUsed": 0,
        "visualCreationsLimit": 0,
        "nextVisualAvailableAt": None,
    }

    with pytest.raises(HTTPException) as exc:
        await assert_can_create_visual(
            AsyncMock(),
            user=free_user,
        )

    assert exc.value.status_code == 403
    assert exc.value.detail["reason"] == "visual_not_available_on_tier"


@patch("backend.core.account.guards.build_account_usage_snapshot", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_assert_can_create_visual_blocks_cooldown(mock_usage):
    plus_user = _make_user(email="plus@test.eza.ai", mirror_plan="plus")
    mock_usage.return_value = {
        "dailyMessagesUsed": 0,
        "dailyMessagesLimit": 5000,
        "dailyDiscoverStartsUsed": 0,
        "dailyDiscoverStartsLimit": 200,
        "visualCreationsUsed": 1,
        "visualCreationsLimit": 50,
        "nextVisualAvailableAt": "2026-07-07T08:00:00+00:00",
    }

    with pytest.raises(HTTPException) as exc:
        await assert_can_create_visual(
            AsyncMock(),
            user=plus_user,
        )

    assert exc.value.detail["reason"] == "visual_cooldown_active"
    assert exc.value.detail["nextVisualAvailableAt"] is not None


@patch("backend.routers.standalone_mirror.consume_usage_event_atomic", new_callable=AsyncMock)
@patch("backend.services.mirror.mirror_image_service.get_mirror_image_provider")
@patch("backend.core.account.subject.get_production_user_by_id", new_callable=AsyncMock)
@patch("backend.auth.mirror_entitlement.get_production_user_by_id", new_callable=AsyncMock)
def test_generate_scene_free_user_blocked_by_visual_guard(
    mock_get_user,
    mock_get_subject_user,
    mock_get_provider,
    mock_consume,
):
    from backend.core.account.usage_service import UsageQuotaExceeded

    free_user = _make_user(email="free@test.eza.ai", mirror_plan="free")
    mock_get_user.return_value = free_user
    mock_get_subject_user.return_value = free_user
    mock_consume.side_effect = UsageQuotaExceeded(
        reason="visual_not_available_on_tier",
        tier=AccountTier.FREE,
        upgrade_required=True,
    )

    res = client.post(
        "/api/standalone/mirror/generate-scene",
        json={
            **VALID_BODY,
            "conversationId": "conv-free",
            "generationRequestId": "req-freeabcd",
        },
        headers=_auth_header(free_user),
    )
    assert res.status_code == 403
    assert res.json()["detail"]["reason"] == "visual_not_available_on_tier"
