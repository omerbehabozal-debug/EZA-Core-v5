# -*- coding: utf-8 -*-
"""Canonical Mirror scene image size for OpenAI Images API (gpt-image-1)."""

from __future__ import annotations

# Provider-supported sizes for gpt-image-1 (API `size` parameter).
MIRROR_OPENAI_ALLOWED_IMAGE_SIZES = frozenset(
    {"1024x1024", "1024x1536", "1536x1024", "auto"}
)

# One master image for all surfaces (phone/tablet/desktop/social/sidebar crops).
# Square is the best crop-safe compromise across portrait posters, landscape chrome,
# and square thumbs — without inventing unsupported pixel dimensions.
MIRROR_CANONICAL_IMAGE_SIZE = "1024x1024"


def normalize_mirror_image_size(size: str | None) -> str:
    s = (size or "").strip()
    if s in MIRROR_OPENAI_ALLOWED_IMAGE_SIZES:
        return s
    return MIRROR_CANONICAL_IMAGE_SIZE
