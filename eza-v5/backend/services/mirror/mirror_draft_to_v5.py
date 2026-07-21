# -*- coding: utf-8 -*-
"""Map Final Mirror Draft → existing V5 minimal prompt contract (PR C + D0).

Does not invent a parallel image-prompt system.
Title authority: finalDraft.title remains metadata (mappedPrompt.title) for UI/landing.
PR D0: title string must never enter the image provider prompt.
"""

from __future__ import annotations

from backend.core.schemas.mirror_draft import MirrorDraft, sanitize_display_text
from backend.core.schemas.mirror_prepare_director import MirrorV5MappedPrompt

MIRROR_V5_PROMPT_CONTRACT = "saina_mirror_v5_minimal"
# Must stay in sync with openai_prompt_builder.MAX_V5_MINIMAL_PROMPT_LEN.
# Raised so D2 visualNarrative survives after short shared rules.
MIRROR_V5_MAX_PROMPT_CHARS = 2000

MIRROR_TEXT_FREE_SCENE_RULE = (
    "Create a natural editorial scene with no text, typography, captions, title, logo, "
    "watermark, labels, UI, poster layout, or readable signage. "
    "Use abstract or illegible signage only when architecturally necessary."
)

MIRROR_V5_NEGATIVE = (
    "collage, inset, moodboard, dashboard, infographic, stock tourist, "
    "motivational poster, oversaturated HDR, fake lens flare, 3D render, "
    "robot face, neon cyberpunk, watermark, conversation summary, theme list, "
    "subtitle paragraph, text, typography, caption, title, logo, "
    "readable signage, readable letters, UI elements, poster layout"
)

_SEASON_STYLE = {
    "bright_cinematic": "Premium editorial daylight, magazine cover quality, quiet luxury.",
    "night_discovery": "Cinematic night photography, rain reflections, quiet urban atmosphere.",
    "editorial_magazine": "Luxury magazine cover, clean composition, strong negative space.",
    "film_poster": "A24-style quiet drama, cinematic poster, single strong scene.",
    "quiet_luxury": "Quiet luxury evening, warm twilight, restrained elegance.",
    "golden_hour": "Golden hour photography, long soft shadows, warm haze.",
}


def map_mirror_draft_to_v5_prompt(
    draft: MirrorDraft,
    *,
    title_source: str,
    art_direction_source: str,
) -> MirrorV5MappedPrompt:
    title = sanitize_display_text(draft.title, max_len=64)
    topic = sanitize_display_text(str(draft.topicCategory).replace("_", " "), max_len=64)
    season = draft.artDirection
    style = _SEASON_STYLE.get(season, _SEASON_STYLE["editorial_magazine"])
    mood = ", ".join(draft.emotionalTone[:3]) if draft.emotionalTone else None

    motifs = ", ".join(draft.visualMotifs[:5])
    forbidden = ", ".join(draft.forbiddenSymbols[:8])
    palette = ", ".join(draft.palette[:4])

    scene = sanitize_display_text(draft.sceneDescription, max_len=420)
    core = sanitize_display_text(draft.coreIdea, max_len=180)
    composition = sanitize_display_text(draft.composition, max_len=160)
    lighting = sanitize_display_text(draft.lighting, max_len=120)
    camera = sanitize_display_text(draft.camera, max_len=100)

    blocks = [
        MIRROR_TEXT_FREE_SCENE_RULE,
        "Curiosity atmosphere — evoke wonder; do not explain the topic.",
        "No dashboard, scores, bullet lists, summaries, labels, infographics, or conversation text.",
        "",
        f"CATEGORY:\n{topic}",
    ]
    if mood:
        blocks.extend(["", f"MOOD:\n{mood}"])
    blocks.extend(
        [
            "",
            "RENDER BRIEF:",
            style,
            f"Scene: {scene}",
            f"Core idea: {core}",
            f"Composition: {composition}",
            f"Lighting: {lighting}",
            f"Camera: {camera}",
        ]
    )
    if motifs:
        blocks.append(f"Motifs: {motifs}")
    if palette:
        blocks.append(f"Palette: {palette}")
    if forbidden:
        blocks.append(f"Avoid: {forbidden}")

    prompt = "\n".join(blocks).strip()
    if len(prompt) > MIRROR_V5_MAX_PROMPT_CHARS:
        prompt = prompt[: MIRROR_V5_MAX_PROMPT_CHARS - 1].rstrip() + "…"

    neg = MIRROR_V5_NEGATIVE
    if forbidden:
        neg = f"{neg}, {forbidden}"

    return MirrorV5MappedPrompt(
        title=title,
        topicCategory=str(draft.topicCategory),
        season=season,
        mood=mood,
        prompt=prompt,
        negativePrompt=sanitize_display_text(neg, max_len=2000),
        promptContract=MIRROR_V5_PROMPT_CONTRACT,  # type: ignore[arg-type]
        titleSource=title_source,
        artDirectionSource=art_direction_source,
    )
