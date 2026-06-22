# -*- coding: utf-8 -*-
"""Compose OpenAI image prompts from Mirror visual metadata only."""

import logging
from dataclasses import dataclass
from typing import List, Optional

from backend.services.mirror.types import MirrorImageRequest

logger = logging.getLogger(__name__)

# Legacy combined prompts (V1–V4).
MAX_OPENAI_COMBINED_PROMPT_LEN = 8000
_MAX_NEGATIVE_APPEND = 600
_MAX_HINTS_APPEND = 400

# V5 minimal render contract — provider prompt must stay passthrough.
V5_PROMPT_CONTRACT = "saina_mirror_v5_minimal"
V5_RENDER_CONTRACT_MARKER = "SAINA_RENDER_CONTRACT: V5_MINIMAL"
MAX_V5_MINIMAL_PROMPT_LEN = 1400

_LEGACY_APPEND_PREFIXES = ("Avoid:", "Quality:", "Style:")


@dataclass(frozen=True)
class OpenAIPromptBuildResult:
    prompt: str
    contract: str
    v5_minimal: bool
    appended_sections: List[str]
    truncated: bool
    within_limit: bool


def is_v5_minimal_request(request: MirrorImageRequest) -> bool:
    contract = (request.prompt_contract or "").strip()
    if contract == V5_PROMPT_CONTRACT:
        return True
    return V5_RENDER_CONTRACT_MARKER in (request.prompt or "")


def _normalize_v5_prompt(text: str) -> str:
    lines = [line.rstrip() for line in text.splitlines()]
    return "\n".join(lines).strip()


def _strip_v5_marker(text: str) -> str:
    lines: list[str] = []
    for line in text.splitlines():
        if line.strip() == V5_RENDER_CONTRACT_MARKER:
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def build_openai_mirror_prompt(request: MirrorImageRequest) -> str:
    return build_openai_mirror_prompt_result(request).prompt


def build_openai_mirror_prompt_result(request: MirrorImageRequest) -> OpenAIPromptBuildResult:
    if is_v5_minimal_request(request):
        return _build_v5_minimal_prompt(request)
    return _build_legacy_prompt(request)


def _build_v5_minimal_prompt(request: MirrorImageRequest) -> OpenAIPromptBuildResult:
    core = _strip_v5_marker((request.prompt or "").strip())
    prompt = _normalize_v5_prompt(core)
    truncated = False

    if len(prompt) > MAX_V5_MINIMAL_PROMPT_LEN:
        logger.warning(
            "V5 minimal prompt exceeds %s chars (got %s); truncating for provider.",
            MAX_V5_MINIMAL_PROMPT_LEN,
            len(prompt),
        )
        prompt = prompt[:MAX_V5_MINIMAL_PROMPT_LEN].rstrip()
        truncated = True

    return OpenAIPromptBuildResult(
        prompt=prompt,
        contract=V5_PROMPT_CONTRACT,
        v5_minimal=True,
        appended_sections=[],
        truncated=truncated,
        within_limit=len(prompt) <= MAX_V5_MINIMAL_PROMPT_LEN,
    )


def _build_legacy_prompt(request: MirrorImageRequest) -> OpenAIPromptBuildResult:
    core = (request.prompt or "").strip()
    parts: list[str] = [core] if core else []
    appended: list[str] = []

    neg = (request.negative_prompt or "").strip()
    if neg and neg not in core:
        parts.append(f"Avoid: {neg[:_MAX_NEGATIVE_APPEND]}")
        appended.append("Avoid")

    if request.quality_hints:
        hints = "; ".join(h.strip() for h in request.quality_hints[:8] if h.strip())
        if hints and hints not in core:
            parts.append(f"Quality: {hints[:_MAX_HINTS_APPEND]}")
            appended.append("Quality")

    preset = (request.style_preset or "").strip()
    if preset and preset not in core:
        parts.append(f"Style: {preset}")
        appended.append("Style")

    combined = " ".join(parts)
    truncated = False
    if len(combined) > MAX_OPENAI_COMBINED_PROMPT_LEN:
        combined = combined[:MAX_OPENAI_COMBINED_PROMPT_LEN].rstrip()
        truncated = True

    return OpenAIPromptBuildResult(
        prompt=combined,
        contract="legacy",
        v5_minimal=False,
        appended_sections=appended,
        truncated=truncated,
        within_limit=len(combined) <= MAX_OPENAI_COMBINED_PROMPT_LEN,
    )


def detect_legacy_blocks(prompt: str) -> dict[str, bool]:
    return {
        "containsLegacyAvoid": "Avoid:" in prompt,
        "containsQualityBlock": "Quality:" in prompt,
        "containsStyleBlock": "Style:" in prompt,
    }
