# -*- coding: utf-8 -*-
"""Map MirrorInterpretationV1 → V5 text-free image prompt (PR D2 + D0).

Mirror is narrator/editor: fidelity + quality constraints only.
The image model is the artist — visual language emerges from VISUAL NARRATIVE.

Prompt budget (Option 2 — separately budgeted composition contract):
- VISUAL NARRATIVE first (hard reserved body ≥450)
- Shared constraints ≤350 chars (style-neutral)
- Safe-composition contract ≤180 chars (universal crop protection; not a genre)
- Optionals yield before narrative; composition never displaces narrative
"""

from __future__ import annotations

import hashlib

from backend.core.schemas.mirror_draft import sanitize_display_text
from backend.core.schemas.mirror_interpretation import MirrorInterpretationV1
from backend.core.schemas.mirror_prepare_director import MirrorV5MappedPrompt
from backend.services.mirror.mirror_draft_to_v5 import (
    MIRROR_V5_MAX_PROMPT_CHARS,
    MIRROR_V5_NEGATIVE,
    MIRROR_V5_PROMPT_CONTRACT,
)

# Bump when Interpretation→V5 mapping contract changes (cache isolation).
MIRROR_INTERPRETATION_TO_V5_MAPPER_VERSION = "interpretation-to-v5-v6"

# Shared contract: universal constraints only — style-neutral (no house genre).
# Visual language emerges from VISUAL NARRATIVE / interpretation, not from these lines.
MIRROR_SHARED_RULES_MAX_CHARS = 350
# Separately budgeted crop-safe composition (not counted against shared ≤350).
MIRROR_COMPOSITION_RULES_MAX_CHARS = 180
# Hard floor for narrative body surviving truncation pressure.
MIRROR_V5_RESERVED_NARRATIVE_CHARS = 450

MIRROR_TEXT_FREE_SCENE_RULE = (
    "Text-free scene: no typography, captions, logos, watermarks, UI, or signage."
)

MIRROR_CONTEXTUAL_SPECIFICITY_RULE = (
    "Follow the visual narrative; keep authentic place, materials, culture, and context. "
    "No unrelated geographies; lived scale if no famous place."
)

# Visibility / exposure quality — not an aesthetic genre.
MIRROR_VISIBILITY_RULE = (
    "Key details clear in small previews — avoid underexposure and crushed blacks."
)

MIRROR_ONE_SCENE_RULE = "One coherent natural scene — not collage or catalog."

MIRROR_SHARED_RENDER_RULES = "\n".join(
    [
        MIRROR_TEXT_FREE_SCENE_RULE,
        MIRROR_CONTEXTUAL_SPECIFICITY_RULE,
        MIRROR_VISIBILITY_RULE,
        MIRROR_ONE_SCENE_RULE,
    ]
)

# Composition constraint only — no genre, no forced centered portrait / symmetry.
MIRROR_SAFE_COMPOSITION_RULE = (
    "Keep essential story elements within a generous central safe region, "
    "with enough surrounding environment for natural phone, tablet, desktop, "
    "and social crops."
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


def _drop_labeled_section(prompt: str, marker: str) -> str:
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
    return "\n".join(out).strip()


def _constraints_block(shared: str, composition: str) -> str:
    """Shared rules then safe-composition (composition is not optional metadata)."""
    shared = (shared or "").rstrip()
    composition = (composition or "").strip()
    if shared and composition:
        return f"{shared}\n{composition}"
    return shared or composition


def _fit_constraints_into_room(room: int, shared: str, composition: str) -> str:
    """Fit contracts into remaining chars. Prefer composition over shared; never invent."""
    if room <= 0:
        return ""
    composition = (composition or "").strip()
    shared = (shared or "").rstrip()
    if not composition:
        return shared[:room].rstrip()
    if len(composition) <= room and not shared:
        return composition
    # Prefer keeping full composition; trim shared into leftover.
    if len(composition) + 1 <= room:
        shared_room = room - len(composition) - 1
        shared_fit = shared[:shared_room].rstrip() if shared_room > 0 else ""
        return _constraints_block(shared_fit, composition) if shared_fit else composition
    # Extreme pressure: composition prefix only (still after narrative in caller).
    return composition[:room].rstrip()


def _assemble(
    narrative_body: str,
    shared: str,
    composition: str,
    *,
    intent: str,
    topic: str,
    atmosphere: str,
    summary: str,
    exclusions: str,
) -> str:
    """Narrative first; contracts; optionals last. Caller enforces budgets."""
    constraints = _constraints_block(shared, composition)
    parts = [f"VISUAL NARRATIVE:\n{narrative_body}", "", constraints]
    # Optionals — lowest priority last (dropped first under pressure).
    if intent:
        parts.extend(["", f"IMAGE INTENT:\n{intent}"])
    if topic:
        parts.extend(["", f"CATEGORY:\n{topic}"])
    if atmosphere:
        parts.extend(["", f"ATMOSPHERE:\n{atmosphere}"])
    if summary:
        parts.extend(["", f"INTERPRETATION NOTE:\n{summary}"])
    if exclusions:
        parts.extend(["", f"Avoid: {exclusions}"])
    return "\n".join(parts).strip()


def map_interpretation_to_v5_prompt(
    interpretation: MirrorInterpretationV1,
    *,
    title_source: str,
    art_direction_source: str = "interpretation_v1",
) -> MirrorV5MappedPrompt:
    """Build text-free provider prompt from interpretation (no TITLE typography)."""
    if len(MIRROR_SHARED_RENDER_RULES) > MIRROR_SHARED_RULES_MAX_CHARS:
        raise RuntimeError(
            "MIRROR_SHARED_RENDER_RULES exceeds "
            f"{MIRROR_SHARED_RULES_MAX_CHARS} chars "
            f"(got {len(MIRROR_SHARED_RENDER_RULES)})"
        )
    if len(MIRROR_SAFE_COMPOSITION_RULE) > MIRROR_COMPOSITION_RULES_MAX_CHARS:
        raise RuntimeError(
            "MIRROR_SAFE_COMPOSITION_RULE exceeds "
            f"{MIRROR_COMPOSITION_RULES_MAX_CHARS} chars "
            f"(got {len(MIRROR_SAFE_COMPOSITION_RULE)})"
        )

    title = sanitize_display_text(interpretation.title, max_len=64)
    topic = sanitize_display_text(
        (interpretation.topicCategory or "general curiosity").replace("_", " "),
        max_len=64,
    )
    intent = sanitize_display_text(interpretation.imageIntent, max_len=320)
    narrative_body = sanitize_display_text(interpretation.visualNarrative, max_len=560)
    summary = sanitize_display_text(interpretation.interpretationSummary, max_len=160)
    atmosphere = sanitize_display_text(interpretation.atmosphereHint or "", max_len=120)
    exclusions = ", ".join(interpretation.exclusions[:8])

    shared = MIRROR_SHARED_RENDER_RULES
    composition = MIRROR_SAFE_COMPOSITION_RULE
    limit = MIRROR_V5_MAX_PROMPT_CHARS
    reserved = min(len(narrative_body), MIRROR_V5_RESERVED_NARRATIVE_CHARS)

    prompt = _assemble(
        narrative_body,
        shared,
        composition,
        intent=intent,
        topic=topic,
        atmosphere=atmosphere,
        summary=summary,
        exclusions=exclusions,
    )

    # 1) Drop optional metadata before touching narrative (lowest priority first).
    optional_drop_order = (
        "INTERPRETATION NOTE:",
        "ATMOSPHERE:",
        "Avoid:",
        "CATEGORY:",
        "IMAGE INTENT:",
    )
    while len(prompt) > limit:
        dropped = False
        for marker in optional_drop_order:
            if marker in prompt:
                prompt = _drop_labeled_section(prompt, marker)
                dropped = True
                break
        if not dropped:
            break

    # 2) If still over: shrink contracts so full narrative (or reserved floor) survives.
    # Composition is preferred over shared; neither may displace narrative.
    narr_block = f"VISUAL NARRATIVE:\n{narrative_body}"
    if len(prompt) > limit:
        room = limit - len(narr_block) - 2
        fitted = _fit_constraints_into_room(room, shared, composition)
        if fitted:
            prompt = f"{narr_block}\n\n{fitted}"
        else:
            keep_n = max(reserved, min(len(narrative_body), limit - 40))
            narr_block = f"VISUAL NARRATIVE:\n{narrative_body[:keep_n]}"
            room = max(0, limit - len(narr_block) - 2)
            fitted = _fit_constraints_into_room(room, shared, composition)
            prompt = f"{narr_block}\n\n{fitted}".strip() if fitted else narr_block

    # 3) Hard guarantee: reserved narrative prefix present when body is long enough.
    if len(narrative_body) >= MIRROR_V5_RESERVED_NARRATIVE_CHARS:
        must_keep = narrative_body[:MIRROR_V5_RESERVED_NARRATIVE_CHARS]
        if must_keep not in prompt:
            narr_block = f"VISUAL NARRATIVE:\n{narrative_body}"
            room = limit - len(narr_block) - 2
            fitted = _fit_constraints_into_room(
                max(0, room), MIRROR_SHARED_RENDER_RULES, MIRROR_SAFE_COMPOSITION_RULE
            )
            prompt = f"{narr_block}\n\n{fitted}".strip() if fitted else narr_block
            if len(prompt) > limit:
                # Last resort: narrative-only up to limit (still prefers scene over rules).
                prompt = narr_block[: limit - 1].rstrip() + "…"

    if len(prompt) > limit:
        prompt = prompt[: limit - 1].rstrip() + "…"

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
