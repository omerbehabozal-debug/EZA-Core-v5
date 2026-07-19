# -*- coding: utf-8 -*-
"""Map MirrorInterpretationV1 → V5 text-free image prompt (PR D2 + D0)."""

from __future__ import annotations

import hashlib

from backend.core.schemas.mirror_draft import sanitize_display_text
from backend.core.schemas.mirror_interpretation import MirrorInterpretationV1
from backend.core.schemas.mirror_prepare_director import MirrorV5MappedPrompt
from backend.services.mirror.mirror_draft_to_v5 import (
    MIRROR_TEXT_FREE_SCENE_RULE,
    MIRROR_V5_MAX_PROMPT_CHARS,
    MIRROR_V5_NEGATIVE,
    MIRROR_V5_PROMPT_CONTRACT,
)


def interpretation_hash(interpretation: MirrorInterpretationV1) -> str:
    payload = "|".join(
        [
            interpretation.title,
            interpretation.imageIntent,
            interpretation.visualNarrative,
            interpretation.interpretationSummary,
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def map_interpretation_to_v5_prompt(
    interpretation: MirrorInterpretationV1,
    *,
    title_source: str,
    art_direction_source: str = "interpretation_v1",
) -> MirrorV5MappedPrompt:
    """Build text-free provider prompt from interpretation (no TITLE typography)."""
    title = sanitize_display_text(interpretation.title, max_len=64)
    topic = sanitize_display_text(
        (interpretation.topicCategory or "general curiosity").replace("_", " "),
        max_len=64,
    )
    intent = sanitize_display_text(interpretation.imageIntent, max_len=420)
    narrative = sanitize_display_text(interpretation.visualNarrative, max_len=700)
    summary = sanitize_display_text(interpretation.interpretationSummary, max_len=280)
    atmosphere = sanitize_display_text(interpretation.atmosphereHint or "", max_len=180)
    exclusions = ", ".join(interpretation.exclusions[:8])

    blocks = [
        MIRROR_TEXT_FREE_SCENE_RULE,
        "Curiosity atmosphere — evoke wonder; do not explain the topic.",
        "One natural scene. Not a poster collage, not an object catalog, not stock tourism.",
        "No dashboard, scores, bullet lists, summaries, labels, infographics, or conversation text.",
        "",
        f"CATEGORY:\n{topic}",
        "",
        f"IMAGE INTENT:\n{intent}",
        "",
        f"VISUAL NARRATIVE:\n{narrative}",
    ]
    if summary:
        blocks.extend(["", f"INTERPRETATION NOTE:\n{summary}"])
    if atmosphere:
        blocks.extend(["", f"ATMOSPHERE:\n{atmosphere}"])
    if exclusions:
        blocks.append(f"Avoid: {exclusions}")

    prompt = "\n".join(blocks).strip()
    if len(prompt) > MIRROR_V5_MAX_PROMPT_CHARS:
        prompt = prompt[: MIRROR_V5_MAX_PROMPT_CHARS - 1].rstrip() + "…"

    neg = MIRROR_V5_NEGATIVE
    if exclusions:
        neg = f"{neg}, {exclusions}"

    return MirrorV5MappedPrompt(
        title=title,
        topicCategory=interpretation.topicCategory or "general_curiosity",
        season="editorial_magazine",
        mood=None,
        prompt=prompt,
        negativePrompt=sanitize_display_text(neg, max_len=2000),
        promptContract=MIRROR_V5_PROMPT_CONTRACT,  # type: ignore[arg-type]
        titleSource=title_source,
        artDirectionSource=art_direction_source,
    )
