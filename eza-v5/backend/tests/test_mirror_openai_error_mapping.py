# -*- coding: utf-8 -*-
"""generate-scene OpenAI error mapping."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.security.rate_limit import rate_limit_standalone
from backend.services.mirror.types import MirrorImageProviderError
from backend.services.production_auth import create_access_token

client = TestClient(app)

VALID_BODY = {
    "prompt": "premium soft 3D illustration, wellness garden, no text",
    "negativePrompt": "text, letters, logo",
    "seedHint": "mirror-visual-abc123",
    "stylePreset": "eza_mirror_professional_v1",
    "qualityHints": ["9:16 vertical safe composition"],
    "cardDate": "2026-05-21",
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


class _FailingOpenAIProvider:
    async def generate_scene(self, request):
        raise MirrorImageProviderError(
            "Mirror sahnesi şu an hazırlanamadı.",
            source="openai",
            http_status=429,
            diagnostic={
                "httpStatus": 429,
                "errorCode": "insufficient_quota",
                "errorType": "insufficient_quota",
                "errorMessage": "You exceeded your current quota",
                "requestId": "req_mirror_test",
                "likelyCause": "billing",
                "suggestedFix": "Check billing",
                "diagnosticHint": "Check billing",
            },
        )


@patch("backend.services.mirror.mirror_image_service.get_mirror_image_provider")
@patch("backend.auth.mirror_entitlement.get_production_user_by_id", new_callable=AsyncMock)
def test_generate_scene_openai_quota_returns_402_not_502(mock_get_user, mock_get_provider):
    async def _noop_rate_limit() -> None:
        return None

    app.dependency_overrides[rate_limit_standalone] = _noop_rate_limit
    try:
        user = _make_user(email="plus@test.eza.ai", mirror_plan="plus")
        mock_get_user.return_value = user
        mock_get_provider.return_value = _FailingOpenAIProvider()
        res = client.post(
            "/api/standalone/mirror/generate-scene",
            json=VALID_BODY,
            headers=_auth_header(user),
        )
        assert res.status_code == 402
        detail = res.json()["detail"]
        assert detail["source"] == "openai"
        assert detail["errorCode"] == "insufficient_quota"
        assert detail["code"] == "openai_insufficient_quota"
        assert detail["requestId"] == "req_mirror_test"
    finally:
        app.dependency_overrides.pop(rate_limit_standalone, None)
