# -*- coding: utf-8 -*-
"""Canonical Mirror image size for OpenAI provider."""

from __future__ import annotations

from backend.config import Settings
from backend.services.mirror.mirror_image_size import (
    MIRROR_CANONICAL_IMAGE_SIZE,
    MIRROR_OPENAI_ALLOWED_IMAGE_SIZES,
    normalize_mirror_image_size,
)
from backend.services.mirror.providers.openai_provider import (
    ALLOWED_IMAGE_SIZES,
    OpenAIMirrorImageProvider,
)


def test_canonical_size_is_allowed_provider_option():
    assert MIRROR_CANONICAL_IMAGE_SIZE in MIRROR_OPENAI_ALLOWED_IMAGE_SIZES
    assert MIRROR_CANONICAL_IMAGE_SIZE == "1024x1024"
    assert MIRROR_CANONICAL_IMAGE_SIZE in ALLOWED_IMAGE_SIZES


def test_settings_code_default_is_canonical_square():
    assert Settings.model_fields["EZA_MIRROR_IMAGE_SIZE"].default == MIRROR_CANONICAL_IMAGE_SIZE


def test_normalize_falls_back_to_canonical():
    assert normalize_mirror_image_size("999x999") == MIRROR_CANONICAL_IMAGE_SIZE
    assert normalize_mirror_image_size(None) == MIRROR_CANONICAL_IMAGE_SIZE
    assert normalize_mirror_image_size("1536x1024") == "1536x1024"


def test_provider_explicit_canonical_size():
    provider = OpenAIMirrorImageProvider(
        api_key="sk-test", size=MIRROR_CANONICAL_IMAGE_SIZE
    )
    assert provider._size == MIRROR_CANONICAL_IMAGE_SIZE


def test_size_not_injected_into_prompt_builder_contract():
    """Pixel size belongs on the API `size` field, not the NL prompt."""
    from backend.services.mirror.mirror_interpretation_to_v5 import (
        MIRROR_SAFE_COMPOSITION_RULE,
        MIRROR_SHARED_RENDER_RULES,
    )

    blob = f"{MIRROR_SHARED_RENDER_RULES}\n{MIRROR_SAFE_COMPOSITION_RULE}".lower()
    assert "1024" not in blob
    assert "1536" not in blob
    assert "aspect ratio" not in blob
    assert "px" not in blob
