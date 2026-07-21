# -*- coding: utf-8 -*-
"""Map MirrorInterpretationV1 → V5 text-free image prompt (PR D2 + D0).

Critical: OpenAI V5 path hard-truncates at MIRROR_V5_MAX_PROMPT_CHARS.
Narrative must come FIRST; shared rules stay short so place/lived detail survives.
Rules stay subject-agnostic — no benchmark-specific subject bans.
"""

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
MIRROR_INTERPRETATION_TO_V5_MAPPER_VERSION = "interpretation-to-v5-v5"

# Short shared obligations — keep under ~500 chars combined so narrative fits.
MIRROR_CONTEXTUAL_SPECIFICITY_RULE = (
    "Render distinctive place/material/cultural detail from the narrative only — "
    "recognizably itself. No generic cinematic tropes, unrelated geographies, "
    "or invented landmarks/symbols. Lived scale when no famous place. Text-free."
)

MIRROR_EDITORIAL_EXPOSURE_RULE = (
    "Premium editorial photography, atmospheric not underexposed. "
    "Architecture, materials, and key cues readable at mobile thumbnail size. "
    "Light as storytelling — do not flatten or force daytime. Avoid crushed blacks."
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
    summary = sanitize_display_text(interpretation.interpretationSummary, max_len=160)
    atmosphere = sanitize_display_text(interpretation.atmosphereHint or "", max_len=120)
    exclusions = ", ".join(interpretation.exclusions[:8])

    # Narrative-first: provider truncation must not drop the scene.
    core_blocks = [
        f"VISUAL NARRATIVE:\n{narrative}",
        "",
        f"IMAGE INTENT:\n{intent}",
        "",
        f"CATEGORY:\n{topic}",
    ]
    if atmosphere:
        core_blocks.extend(["", f"ATMOSPHERE:\n{atmosphere}"])
    if summary:
        core_blocks.extend(["", f"INTERPRETATION NOTE:\n{summary}"])

    rule_blocks = [
        "",
        MIRROR_TEXT_FREE_SCENE_RULE,
        MIRROR_CONTEXTUAL_SPECIFICITY_RULE,
        MIRROR_EDITORIAL_EXPOSURE_RULE,
        "One natural scene — not collage, catalog, stock tourism, or dashboard.",
    ]
    if exclusions:
        rule_blocks.append(f"Avoid: {exclusions}")

    prompt = "\n".join(core_blocks + rule_blocks).strip()

    # Prefer dropping optional interpretation note / atmosphere before cutting narrative.
    optional_drop_order = ("INTERPRETATION NOTE:", "ATMOSPHERE:")
    while len(prompt) > MIRROR_V5_MAX_PROMPT_CHARS:
        dropped = False
        for marker in optional_drop_order:
            if marker not in prompt:
                continue
            lines = prompt.split("\n")
            out: list[str] = []
            skip = False
            for line in lines:
                if line.startswith(marker):
                    skip = True
                    if out and out[-1] == "":
                        out.pop()
                    continue
                if skip:
                    if line == "" or (line.endswith(":") and line.isupper()):
                        skip = False
                        if line == "":
                            continue
                    else:
                        continue
                out.append(line)
            prompt = "\n".join(out).strip()
            dropped = True
            break
        if not dropped:
            break

    if len(prompt) > MIRROR_V5_MAX_PROMPT_CHARS:
        # Last resort: keep narrative+intent head, trim rules from the end.
        head = "\n".join(core_blocks).strip()
        budget = MIRROR_V5_MAX_PROMPT_CHARS - len(head) - 2
        if budget > 80:
            rules = "\n".join(rule_blocks).strip()
            prompt = f"{head}\n\n{rules[:budget].rstrip()}…"
        else:
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
