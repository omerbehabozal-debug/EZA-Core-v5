# -*- coding: utf-8 -*-
"""Compose OpenAI image prompts from Mirror visual metadata only."""

from backend.services.mirror.types import MirrorImageRequest

# OpenAI image models accept shorter prompts than our validation max.
MAX_OPENAI_COMBINED_PROMPT_LEN = 4000
_MAX_NEGATIVE_APPEND = 600
_MAX_HINTS_APPEND = 400


def build_openai_mirror_prompt(request: MirrorImageRequest) -> str:
    """
    Merge scene prompt, negative guidance, and quality hints without redundant bloat.
    """
    core = request.prompt.strip()
    parts: list[str] = [core] if core else []

    neg = (request.negative_prompt or "").strip()
    if neg and neg not in core:
        parts.append(f"Avoid: {neg[:_MAX_NEGATIVE_APPEND]}")

    if request.quality_hints:
        hints = "; ".join(h.strip() for h in request.quality_hints[:8] if h.strip())
        if hints and hints not in core:
            parts.append(f"Quality: {hints[:_MAX_HINTS_APPEND]}")

    preset = (request.style_preset or "").strip()
    if preset and preset not in core:
        parts.append(f"Style: {preset}")

    combined = " ".join(parts)
    if len(combined) > MAX_OPENAI_COMBINED_PROMPT_LEN:
        combined = combined[:MAX_OPENAI_COMBINED_PROMPT_LEN].rstrip()
    return combined
