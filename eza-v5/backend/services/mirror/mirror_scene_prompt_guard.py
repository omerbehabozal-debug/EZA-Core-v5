# -*- coding: utf-8 -*-
"""D2 scene generation guards — fail-closed at provider boundary."""

from __future__ import annotations

import hashlib
import logging
import re
from typing import Literal, Optional

logger = logging.getLogger(__name__)

GenerationPipeline = Literal["D2_V5", "LEGACY_V3"]
PromptClassification = Literal["VISUAL_NARRATIVE", "CATEGORY", "OTHER"]

_CATEGORY_RE = re.compile(r"(?im)^\s*CATEGORY\s*:")
_VISUAL_NARRATIVE_RE = re.compile(r"(?im)^\s*VISUAL NARRATIVE\s*:")


class MirrorScenePromptGuardError(Exception):
    """Raised when D2 provider assert fails — do not call OpenAI."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def prompt_sha256(prompt: str) -> str:
    return hashlib.sha256((prompt or "").encode("utf-8")).hexdigest()


def classify_scene_prompt(prompt: str) -> PromptClassification:
    text = prompt or ""
    if _VISUAL_NARRATIVE_RE.search(text):
        return "VISUAL_NARRATIVE"
    if _CATEGORY_RE.search(text):
        return "CATEGORY"
    return "OTHER"


def assert_d2_provider_prompt(
    *,
    prompt: str,
    generation_id: Optional[str],
    generation_pipeline: Optional[str],
    final_scene_prompt_hash: Optional[str] = None,
) -> str:
    """Validate D2 prompt immediately before OpenAI. Returns providerPromptHash."""
    pipeline = (generation_pipeline or "D2_V5").strip().upper()
    provider_hash = prompt_sha256(prompt)

    if pipeline == "LEGACY_V3":
        logger.info(
            "mirror_provider_guard pipeline=LEGACY_V3 generationId=%s providerPromptHash=%s classification=%s",
            (generation_id or "")[:48],
            provider_hash,
            classify_scene_prompt(prompt),
        )
        return provider_hash

    if not (generation_id or "").strip():
        raise MirrorScenePromptGuardError(
            "generation_id_required",
            "D2 scene generation requires generationId.",
        )

    classification = classify_scene_prompt(prompt)
    if classification != "VISUAL_NARRATIVE":
        raise MirrorScenePromptGuardError(
            "d2_prompt_invalid_prefix",
            f"D2 prompt must start with VISUAL NARRATIVE (got {classification}).",
        )
    if _CATEGORY_RE.search(prompt or ""):
        raise MirrorScenePromptGuardError(
            "d2_prompt_contains_category",
            "D2 prompt must not contain CATEGORY:.",
        )

    expected = (final_scene_prompt_hash or "").strip()
    if expected and expected != provider_hash:
        raise MirrorScenePromptGuardError(
            "provider_prompt_hash_mismatch",
            "providerPromptHash does not match finalScenePromptHash.",
        )

    logger.info(
        "mirror_provider_guard pipeline=D2_V5 generationId=%s providerPromptHash=%s "
        "finalScenePromptHash=%s classification=%s hashesEqual=%s",
        generation_id[:48],
        provider_hash,
        expected or provider_hash,
        classification,
        (not expected) or expected == provider_hash,
    )
    return provider_hash
