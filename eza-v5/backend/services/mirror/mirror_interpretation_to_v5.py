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

# Bump when Interpretation→V5 mapping contract changes (cache isolation).
MIRROR_INTERPRETATION_TO_V5_MAPPER_VERSION = "interpretation-to-v5-v4"

# Shared provider obligation — subject-agnostic; does not prescribe creative choices.
MIRROR_CONTEXTUAL_SPECIFICITY_RULE = (
    "Do not merely name the subject — render distinctive visual details that make it "
    "recognizably itself (architecture, space, materials, culture, environment, era) "
    "only from the narrative. Do not swap it for a generic cinematic trope or unrelated "
    "geographies, cultures, or periods. For personal or abstract topics with no famous "
    "place, do not invent landmarks or cultural symbols; preserve lived scale, setting, "
    "materials, and behavior. Text-free."
)

# SAINA visual language: editorial legibility over dark cinema grading (mobile-first).
MIRROR_EDITORIAL_EXPOSURE_RULE = (
    "Favor premium editorial photography over dark cinematic grading. "
    "Night should feel atmospheric, not underexposed. "
    "Stay clear at mobile thumbnail size — faces, architecture, materials, and key "
    "cues must be instantly readable. Use light as storytelling, not as an obstacle "
    "to visibility. Do not flatten lighting or force bright daytime. "
    "Avoid crushed blacks unless required. Preserve atmosphere."
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
    intent = sanitize_display_text(interpretation.imageIntent, max_len=320)
    narrative = sanitize_display_text(interpretation.visualNarrative, max_len=560)
    summary = sanitize_display_text(interpretation.interpretationSummary, max_len=200)
    atmosphere = sanitize_display_text(interpretation.atmosphereHint or "", max_len=180)
    exclusions = ", ".join(interpretation.exclusions[:8])

    blocks = [
        MIRROR_TEXT_FREE_SCENE_RULE,
        MIRROR_CONTEXTUAL_SPECIFICITY_RULE,
        MIRROR_EDITORIAL_EXPOSURE_RULE,
        "One natural scene — evoke curiosity; not collage, catalog, stock tourism, or dashboard.",
        "",
        f"CATEGORY:\n{topic}",
        "",
        f"IMAGE INTENT:\n{intent}",
        "",
        f"VISUAL NARRATIVE:\n{narrative}",
    ]
    optional: list[str] = []
    if summary:
        optional.extend(["", f"INTERPRETATION NOTE:\n{summary}"])
    if atmosphere:
        optional.extend(["", f"ATMOSPHERE:\n{atmosphere}"])
    if exclusions:
        optional.append(f"Avoid: {exclusions}")

    prompt = "\n".join(blocks + optional).strip()
    # Prefer dropping optional tail before hard-cutting the narrative core.
    while len(prompt) > MIRROR_V5_MAX_PROMPT_CHARS and optional:
        optional.pop()
        prompt = "\n".join(blocks + optional).strip()
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
