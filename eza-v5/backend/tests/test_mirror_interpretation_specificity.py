# -*- coding: utf-8 -*-
"""Interpretation→V5 prompt budget: narrative-first, compressed shared rules."""

from __future__ import annotations

import inspect

from backend.core.schemas.mirror_interpretation import MirrorInterpretationV1
from backend.services.mirror.mirror_draft_to_v5 import MIRROR_V5_MAX_PROMPT_CHARS
from backend.services.mirror.mirror_interpretation_to_v5 import (
    MIRROR_CONTEXTUAL_SPECIFICITY_RULE,
    MIRROR_INTERPRETATION_TO_V5_MAPPER_VERSION,
    MIRROR_ONE_SCENE_RULE,
    MIRROR_SAFE_COMPOSITION_RULE,
    MIRROR_COMPOSITION_RULES_MAX_CHARS,
    MIRROR_SHARED_RENDER_RULES,
    MIRROR_SHARED_RULES_MAX_CHARS,
    MIRROR_TEXT_FREE_SCENE_RULE,
    MIRROR_VISIBILITY_RULE,
    MIRROR_V5_RESERVED_NARRATIVE_CHARS,
    map_interpretation_to_v5_prompt,
)
from backend.services.mirror.openai_prompt_builder import (
    MAX_V5_MINIMAL_PROMPT_LEN,
    build_openai_mirror_prompt,
)
from backend.services.mirror.types import MirrorImageRequest

MARDIN_NARRATIVE = (
    "A narrow, cobblestone street in Mardin during the golden hour, where the warm "
    "hues of the sun bathe the ancient stone buildings. In the foreground, a simple "
    "wooden chair sits on a small terrace, with a clothesline gently swaying in the "
    "soft breeze. The silhouette of a distant mosque rises against the sky, adding a "
    "spiritual touch to the scene. Long shadows stretch across the street, creating a "
    "play of light and dark that evokes a sense of history and daily life intertwined."
)


def _interp(**overrides) -> MirrorInterpretationV1:
    base = {
        "title": "Evening Walk",
        "interpretationSummary": (
            "An evening walk through narrow streets after rain, quiet doorway pause."
        ),
        "rationale": "User favored lantern-lit narrow streets and a small café pause.",
        "imageIntent": "Feel damp wooden lanes and warm café glow after rain.",
        "visualNarrative": (
            "A narrow lane at dusk, wet stone and wooden facades, "
            "warm lantern light, a quiet café doorway ahead — one continuous natural moment."
        ),
        "exclusions": ["object collage", "poster typography"],
        "confidence": 0.9,
        "topicCategory": "travel",
        "atmosphereHint": "humid dusk before rain",
    }
    base.update(overrides)
    return MirrorInterpretationV1.model_validate(base)


def test_shared_rules_within_target_budget():
    assert 250 <= len(MIRROR_SHARED_RENDER_RULES) <= MIRROR_SHARED_RULES_MAX_CHARS
    assert MIRROR_SHARED_RULES_MAX_CHARS == 350
    assert MIRROR_TEXT_FREE_SCENE_RULE in MIRROR_SHARED_RENDER_RULES
    assert MIRROR_CONTEXTUAL_SPECIFICITY_RULE in MIRROR_SHARED_RENDER_RULES
    assert MIRROR_VISIBILITY_RULE in MIRROR_SHARED_RENDER_RULES
    assert MIRROR_ONE_SCENE_RULE in MIRROR_SHARED_RENDER_RULES


def test_mapper_version_v6():
    assert MIRROR_INTERPRETATION_TO_V5_MAPPER_VERSION == "interpretation-to-v5-v6"


def test_safe_composition_contract_budget_and_presence():
    assert 120 <= len(MIRROR_SAFE_COMPOSITION_RULE) <= MIRROR_COMPOSITION_RULES_MAX_CHARS
    assert MIRROR_COMPOSITION_RULES_MAX_CHARS == 180
    assert "central safe region" in MIRROR_SAFE_COMPOSITION_RULE
    assert "phone, tablet, desktop" in MIRROR_SAFE_COMPOSITION_RULE
    assert "social crops" in MIRROR_SAFE_COMPOSITION_RULE
    mapped = map_interpretation_to_v5_prompt(_interp(), title_source="interpretation_llm")
    assert MIRROR_SAFE_COMPOSITION_RULE in mapped.prompt
    # After shared rules, before optional IMAGE INTENT when present.
    rules_idx = mapped.prompt.index(MIRROR_ONE_SCENE_RULE)
    comp_idx = mapped.prompt.index(MIRROR_SAFE_COMPOSITION_RULE)
    assert rules_idx < comp_idx


def test_limits_aligned_across_stack():
    assert MIRROR_V5_MAX_PROMPT_CHARS == 2000
    assert MAX_V5_MINIMAL_PROMPT_LEN == 2000
    assert MIRROR_V5_RESERVED_NARRATIVE_CHARS >= 450
    assert MIRROR_V5_RESERVED_NARRATIVE_CHARS <= 500


def test_prompt_order_narrative_before_shared_rules():
    mapped = map_interpretation_to_v5_prompt(_interp(), title_source="interpretation_llm")
    assert mapped.prompt.startswith("VISUAL NARRATIVE:")
    narr_idx = mapped.prompt.index("VISUAL NARRATIVE:")
    rules_idx = mapped.prompt.index(MIRROR_TEXT_FREE_SCENE_RULE)
    assert narr_idx < rules_idx


def test_four_product_obligations_present():
    mapped = map_interpretation_to_v5_prompt(_interp(), title_source="interpretation_llm")
    assert MIRROR_TEXT_FREE_SCENE_RULE in mapped.prompt
    assert MIRROR_CONTEXTUAL_SPECIFICITY_RULE in mapped.prompt
    assert MIRROR_VISIBILITY_RULE in mapped.prompt
    assert MIRROR_ONE_SCENE_RULE in mapped.prompt
    assert "Follow the visual narrative" in mapped.prompt
    assert "authentic place, materials, culture, and context" in mapped.prompt
    assert "small previews" in mapped.prompt
    assert "underexposure" in mapped.prompt.lower()
    assert "One coherent natural scene" in mapped.prompt
    assert "Text-free scene: no typography" in mapped.prompt


def test_shared_contract_is_style_neutral():
    """Provider shared rules must not impose a fixed artistic genre."""
    banned = (
        "editorial",
        "cinematic",
        "documentary",
        "fine art",
        "photoreal",
        "magazine",
        "lifestyle",
        "concept art",
        "watercolor",
        "film still",
        "wallpaper",
    )
    low = MIRROR_SHARED_RENDER_RULES.lower()
    for term in banned:
        assert term not in low, f"shared contract must not impose genre {term!r}"
    low_comp = MIRROR_SAFE_COMPOSITION_RULE.lower()
    for term in (*banned, "poster"):
        assert term not in low_comp, f"composition contract must not impose genre {term!r}"
    assert "poster" not in low
    mapped = map_interpretation_to_v5_prompt(
        _interp(visualNarrative=MARDIN_NARRATIVE),
        title_source="interpretation_llm",
    )
    # Constraint region only (after narrative block) — exclude optional Avoid lines.
    after_narr = mapped.prompt.split("\n\n", 1)[1]
    constraint_only = after_narr.split("IMAGE INTENT:", 1)[0].lower()
    for term in banned:
        assert term not in constraint_only, f"provider prompt constraints impose genre {term!r}"
    assert "poster" not in constraint_only


def test_composition_never_displaces_full_narrative():
    mapped = map_interpretation_to_v5_prompt(
        _interp(visualNarrative=MARDIN_NARRATIVE),
        title_source="interpretation_llm",
    )
    assert MARDIN_NARRATIVE in mapped.prompt
    assert MIRROR_SAFE_COMPOSITION_RULE in mapped.prompt
    # Worst-case stack stays under provider limit.
    narr_hdr = f"VISUAL NARRATIVE:\n{MARDIN_NARRATIVE}"
    contracts = f"{MIRROR_SHARED_RENDER_RULES}\n{MIRROR_SAFE_COMPOSITION_RULE}"
    worst = len(narr_hdr) + 2 + len(contracts)
    assert worst <= MIRROR_V5_MAX_PROMPT_CHARS
    assert len(mapped.prompt) <= MIRROR_V5_MAX_PROMPT_CHARS


def test_no_faces_readable_bias_phrase():
    assert "face" not in MIRROR_VISIBILITY_RULE.lower()
    assert "faces" not in MIRROR_SHARED_RENDER_RULES.lower()
    mapped = map_interpretation_to_v5_prompt(_interp(), title_source="interpretation_llm")
    assert "faces must" not in mapped.prompt.lower()


def test_no_duplicate_text_free_tail_on_specificity():
    assert "text-free" not in MIRROR_CONTEXTUAL_SPECIFICITY_RULE.lower()


def test_mardin_full_narrative_survives():
    assert len(MARDIN_NARRATIVE) >= MIRROR_V5_RESERVED_NARRATIVE_CHARS
    mapped = map_interpretation_to_v5_prompt(
        _interp(
            title="Evening Essence",
            visualNarrative=MARDIN_NARRATIVE,
            imageIntent=(
                "A stranger should sense a tranquil connection to heritage "
                "and the beauty of its streets at dusk."
            ),
            exclusions=["modern elements", "crowded scenes", "tourist attractions"],
            atmosphereHint="tranquil and nostalgic",
            interpretationSummary="Captures architecture and cultural richness at dusk.",
        ),
        title_source="interpretation_llm",
    )
    assert mapped.prompt.startswith("VISUAL NARRATIVE:")
    assert "clothesline" in mapped.prompt
    assert "wooden chair" in mapped.prompt
    assert "mosque" in mapped.prompt
    assert "cobblestone" in mapped.prompt
    assert MARDIN_NARRATIVE in mapped.prompt
    assert MARDIN_NARRATIVE[:MIRROR_V5_RESERVED_NARRATIVE_CHARS] in mapped.prompt
    assert len(mapped.prompt) <= MIRROR_V5_MAX_PROMPT_CHARS


def test_reserved_narrative_budget_enforced_under_optional_pressure(monkeypatch):
    """Under a tight limit, optionals/shared yield before reserved narrative body."""
    monkeypatch.setattr(
        "backend.services.mirror.mirror_interpretation_to_v5.MIRROR_V5_MAX_PROMPT_CHARS",
        700,
    )
    mapped = map_interpretation_to_v5_prompt(
        _interp(
            visualNarrative=MARDIN_NARRATIVE,
            imageIntent="y" * 200,
            interpretationSummary="x" * 160,
            atmosphereHint="z" * 80,
            exclusions=["a", "b", "c", "d", "e", "f", "g", "h"],
        ),
        title_source="interpretation_llm",
    )
    assert mapped.prompt.startswith("VISUAL NARRATIVE:")
    assert MARDIN_NARRATIVE[:MIRROR_V5_RESERVED_NARRATIVE_CHARS] in mapped.prompt
    assert "clothesline" in mapped.prompt
    assert "mosque" in mapped.prompt
    assert len(mapped.prompt) <= 700


def test_optionals_never_precede_narrative():
    mapped = map_interpretation_to_v5_prompt(
        _interp(visualNarrative=MARDIN_NARRATIVE),
        title_source="interpretation_llm",
    )
    assert mapped.prompt.index("VISUAL NARRATIVE:") < mapped.prompt.index(
        MIRROR_TEXT_FREE_SCENE_RULE
    )
    assert MARDIN_NARRATIVE in mapped.prompt


def test_provider_receives_complete_intended_prompt():
    mapped = map_interpretation_to_v5_prompt(
        _interp(visualNarrative=MARDIN_NARRATIVE),
        title_source="interpretation_llm",
    )
    req = MirrorImageRequest(
        prompt=mapped.prompt,
        negative_prompt=mapped.negativePrompt,
        seed_hint="audit",
        style_preset="eza_mirror_professional_v1",
        quality_hints=["style lens: curious_panda"],
        prompt_contract=mapped.promptContract,
        card_date="2026-07-21",
    )
    provider_prompt = build_openai_mirror_prompt(req)
    assert provider_prompt == mapped.prompt
    assert "clothesline" in provider_prompt
    assert "curious_panda" not in provider_prompt
    assert len(provider_prompt) <= MAX_V5_MINIMAL_PROMPT_LEN


def test_no_benchmark_specific_prohibitions_in_mapper_source():
    src = inspect.getsource(
        __import__(
            "backend.services.mirror.mirror_interpretation_to_v5",
            fromlist=["*"],
        )
    ).lower()
    for banned in (
        "mardin",
        "trench",
        "portrait hero",
        "statue",
        "sculpture",
        "panda",
        "japan",
        "kyoto",
        "osaka",
    ):
        assert banned not in src, f"mapper must not hardcode {banned!r}"


def test_title_never_in_prompt():
    mapped = map_interpretation_to_v5_prompt(
        _interp(title="Secret Title XYZ"),
        title_source="interpretation_llm",
    )
    assert "TITLE:" not in mapped.prompt
    assert "Secret Title XYZ" not in mapped.prompt
