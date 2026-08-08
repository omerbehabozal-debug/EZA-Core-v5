# -*- coding: utf-8 -*-
"""D2 fail-closed provider boundary + scene generation guards."""

from __future__ import annotations

import hashlib
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from backend.services.mirror.mirror_image_service import generate_mirror_scene
from backend.services.mirror.mirror_scene_prompt_guard import (
    MirrorScenePromptGuardError,
    assert_d2_provider_prompt,
    classify_scene_prompt,
    prompt_sha256,
)
from backend.services.mirror.types import MirrorImageResult


D2_PROMPT = (
    "VISUAL NARRATIVE:\n"
    "A quiet stone courtyard at dusk, laundry line, distant minaret silhouette."
)


def test_classify_visual_narrative():
    assert classify_scene_prompt(D2_PROMPT) == "VISUAL_NARRATIVE"


def test_classify_category():
    assert classify_scene_prompt("CATEGORY: architecture\nsoft daylight") == "CATEGORY"


def test_assert_d2_blocks_category():
    with pytest.raises(MirrorScenePromptGuardError) as exc:
        assert_d2_provider_prompt(
            prompt="CATEGORY: architecture\nsoft architectural daylight",
            generation_id="gen-1",
            generation_pipeline="D2_V5",
            final_scene_prompt_hash=None,
        )
    assert exc.value.code == "d2_prompt_invalid_prefix"


def test_assert_d2_blocks_category_inside_visual_narrative():
    bad = "VISUAL NARRATIVE:\nstone\n\nCATEGORY: architecture\n"
    with pytest.raises(MirrorScenePromptGuardError) as exc:
        assert_d2_provider_prompt(
            prompt=bad,
            generation_id="gen-1",
            generation_pipeline="D2_V5",
        )
    assert exc.value.code == "d2_prompt_contains_category"


def test_assert_d2_blocks_hash_mismatch():
    with pytest.raises(MirrorScenePromptGuardError) as exc:
        assert_d2_provider_prompt(
            prompt=D2_PROMPT,
            generation_id="gen-1",
            generation_pipeline="D2_V5",
            final_scene_prompt_hash="0" * 64,
        )
    assert exc.value.code == "provider_prompt_hash_mismatch"


def test_assert_d2_requires_generation_id():
    with pytest.raises(MirrorScenePromptGuardError) as exc:
        assert_d2_provider_prompt(
            prompt=D2_PROMPT,
            generation_id=None,
            generation_pipeline="D2_V5",
        )
    assert exc.value.code == "generation_id_required"


def test_assert_d2_success_hashes_equal():
    h = prompt_sha256(D2_PROMPT)
    out = assert_d2_provider_prompt(
        prompt=D2_PROMPT,
        generation_id="gen-ok",
        generation_pipeline="D2_V5",
        final_scene_prompt_hash=h,
    )
    assert out == h


def test_assert_unset_pipeline_fail_closed_as_d2():
    """Missing pipeline is treated as D2_V5 — CATEGORY prompts must fail closed."""
    with pytest.raises(MirrorScenePromptGuardError) as exc:
        assert_d2_provider_prompt(
            prompt="CATEGORY: architecture\nsoft daylight",
            generation_id=None,
            generation_pipeline=None,
        )
    assert exc.value.code == "generation_id_required"


def test_assert_unknown_pipeline_fail_closed_as_d2():
    with pytest.raises(MirrorScenePromptGuardError) as exc:
        assert_d2_provider_prompt(
            prompt="CATEGORY: architecture\nsoft daylight",
            generation_id="gen-unknown",
            generation_pipeline="SOMETHING_ELSE",
        )
    assert exc.value.code == "d2_prompt_invalid_prefix"


def test_assert_empty_pipeline_requires_generation_id_for_valid_d2_prompt():
    with pytest.raises(MirrorScenePromptGuardError) as exc:
        assert_d2_provider_prompt(
            prompt=D2_PROMPT,
            generation_id=None,
            generation_pipeline="",
        )
    assert exc.value.code == "generation_id_required"


def test_assert_legacy_allows_category():
    h = assert_d2_provider_prompt(
        prompt="CATEGORY: architecture\nsoft daylight",
        generation_id=None,
        generation_pipeline="LEGACY_V3",
    )
    assert len(h) == 64


@pytest.mark.asyncio
async def test_generate_scene_d2_blocks_provider_on_category():
    mock_provider = AsyncMock()
    mock_provider.generate_scene = AsyncMock(
        return_value=MirrorImageResult(
            scene_image_url="https://example.com/scene.png",
            provider="mock",
        )
    )
    with patch(
        "backend.services.mirror.mirror_image_service.get_mirror_image_provider",
        return_value=mock_provider,
    ):
        with pytest.raises(HTTPException) as exc:
            await generate_mirror_scene(
                prompt="CATEGORY: architecture\natrium",
                negative_prompt="text",
                seed_hint="seed-d2-block",
                style_preset="eza_mirror_professional_v1",
                card_date="2026-07-25",
                generation_id="gen-block-cat",
                generation_pipeline="D2_V5",
                final_scene_prompt_hash=hashlib.sha256(
                    b"CATEGORY: architecture\natrium"
                ).hexdigest(),
            )
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] in {
        "d2_prompt_invalid_prefix",
        "d2_prompt_contains_category",
        "d2_prompt_invalid",
    }
    mock_provider.generate_scene.assert_not_called()


@pytest.mark.asyncio
async def test_generate_scene_d2_blocks_hash_mismatch_before_provider():
    mock_provider = AsyncMock()
    mock_provider.generate_scene = AsyncMock()
    with patch(
        "backend.services.mirror.mirror_image_service.get_mirror_image_provider",
        return_value=mock_provider,
    ):
        with pytest.raises(HTTPException) as exc:
            await generate_mirror_scene(
                prompt=D2_PROMPT,
                negative_prompt="text",
                seed_hint="seed-hash-mismatch",
                style_preset="eza_mirror_professional_v1",
                card_date="2026-07-25",
                prompt_contract="saina_mirror_v5_minimal",
                generation_id="gen-hash-mismatch",
                generation_pipeline="D2_V5",
                final_scene_prompt_hash="a" * 64,
            )
    assert exc.value.detail["code"] == "provider_prompt_hash_mismatch"
    mock_provider.generate_scene.assert_not_called()


@pytest.mark.asyncio
async def test_generate_scene_d2_success_calls_provider_once():
    mock_provider = AsyncMock()
    mock_provider.generate_scene = AsyncMock(
        return_value=MirrorImageResult(
            scene_image_url="https://example.com/mardin.png",
            provider="mock",
        )
    )
    h = prompt_sha256(D2_PROMPT)
    with patch(
        "backend.services.mirror.mirror_image_service.get_mirror_image_provider",
        return_value=mock_provider,
    ):
        result = await generate_mirror_scene(
            prompt=D2_PROMPT,
            negative_prompt="text",
            seed_hint="seed-d2-ok",
            style_preset="eza_mirror_professional_v1",
            card_date="2026-07-25",
            prompt_contract="saina_mirror_v5_minimal",
            generation_id="gen-d2-ok",
            generation_pipeline="D2_V5",
            final_scene_prompt_hash=h,
        )
    assert result.scene_image_url.endswith("mardin.png")
    mock_provider.generate_scene.assert_awaited_once()
