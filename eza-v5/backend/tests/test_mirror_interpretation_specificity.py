# -*- coding: utf-8 -*-
"""Interpretation→V5 contextual specificity instruction (subject-agnostic)."""

from __future__ import annotations

import inspect

from backend.core.schemas.mirror_interpretation import MirrorInterpretationV1
from backend.services.mirror.mirror_draft_to_v5 import MIRROR_TEXT_FREE_SCENE_RULE
from backend.services.mirror.mirror_interpretation_to_v5 import (
    MIRROR_CONTEXTUAL_SPECIFICITY_RULE,
    MIRROR_EDITORIAL_EXPOSURE_RULE,
    MIRROR_INTERPRETATION_TO_V5_MAPPER_VERSION,
    map_interpretation_to_v5_prompt,
)


def _interp(**overrides) -> MirrorInterpretationV1:
    base = {
        "title": "Yağmur Altında Kyoto",
        "interpretationSummary": (
            "An evening walk through Gion and Pontocho, rain on machiya streets."
        ),
        "rationale": "User favored lantern-lit narrow streets and a small café pause.",
        "imageIntent": "Feel damp wooden lanes and warm café glow after rain.",
        "visualNarrative": (
            "A narrow Pontocho-like lane at dusk, wet stone and wooden machiya facades, "
            "warm lantern light, a quiet café doorway ahead — one continuous natural moment."
        ),
        "exclusions": ["object collage", "poster typography"],
        "confidence": 0.9,
        "topicCategory": "travel",
        "atmosphereHint": "humid dusk before rain",
    }
    base.update(overrides)
    return MirrorInterpretationV1.model_validate(base)


def test_1_shared_prompt_contains_contextual_specificity():
    mapped = map_interpretation_to_v5_prompt(
        _interp(), title_source="interpretation_llm"
    )
    assert MIRROR_CONTEXTUAL_SPECIFICITY_RULE in mapped.prompt
    assert "recognizably itself" in mapped.prompt
    assert "generic cinematic trope" in mapped.prompt


def test_2_no_kyoto_specific_hardcoding_in_mapper():
    src = inspect.getsource(
        __import__(
            "backend.services.mirror.mirror_interpretation_to_v5",
            fromlist=["*"],
        )
    )
    banned = (
        "Kyoto",
        "Japan",
        "Gion",
        "Pontocho",
        "machiya",
        "Europe",
        "cathedral",
        "dome",
        "geisha",
    )
    for term in banned:
        assert term not in src, f"mapper must not hardcode {term!r}"
    assert "Kyoto" not in MIRROR_CONTEXTUAL_SPECIFICITY_RULE
    assert "Japan" not in MIRROR_CONTEXTUAL_SPECIFICITY_RULE
    assert "Europe" not in MIRROR_CONTEXTUAL_SPECIFICITY_RULE


def test_3_text_free_and_single_scene_rules_remain():
    mapped = map_interpretation_to_v5_prompt(
        _interp(), title_source="interpretation_llm"
    )
    assert MIRROR_TEXT_FREE_SCENE_RULE in mapped.prompt
    assert "One natural scene" in mapped.prompt
    assert "TITLE:" not in mapped.prompt
    assert "no text" in mapped.prompt.lower()


def test_4_interpretation_content_preserved_without_rewrite():
    narrative = (
        "A narrow Pontocho-like lane at dusk, wet stone and wooden machiya facades, "
        "warm lantern light, a quiet café doorway ahead — one continuous natural moment."
    )
    intent = "Feel damp wooden lanes and warm café glow after rain."
    interp = _interp(visualNarrative=narrative, imageIntent=intent)
    mapped = map_interpretation_to_v5_prompt(interp, title_source="interpretation_llm")
    assert f"VISUAL NARRATIVE:\n{narrative}" in mapped.prompt
    assert f"IMAGE INTENT:\n{intent}" in mapped.prompt
    # Mapper adds obligation; does not rewrite narrative wording.
    assert narrative in mapped.prompt


def test_5_abstract_topics_must_not_invent_landmarks():
    assert "do not invent landmarks" in MIRROR_CONTEXTUAL_SPECIFICITY_RULE.lower()
    assert "cultural symbols" in MIRROR_CONTEXTUAL_SPECIFICITY_RULE.lower()
    assert "personal or abstract" in MIRROR_CONTEXTUAL_SPECIFICITY_RULE.lower()
    mapped = map_interpretation_to_v5_prompt(
        _interp(
            title="Gece Düşüncesi",
            interpretationSummary="A quiet personal reflection without a named place.",
            rationale="Conversation stayed inward and abstract.",
            imageIntent="Sense of private pause, not a famous destination.",
            visualNarrative=(
                "A dim room corner with a warm desk lamp and a closed notebook — "
                "lived, personal scale, no landmark."
            ),
            topicCategory="spiritual_reflection",
            atmosphereHint="still indoor evening",
        ),
        title_source="interpretation_llm",
    )
    assert MIRROR_CONTEXTUAL_SPECIFICITY_RULE in mapped.prompt
    low = MIRROR_CONTEXTUAL_SPECIFICITY_RULE.lower()
    assert "no famous place" in low or "personal or abstract" in low


def test_mapper_version_bumped_for_contract_change():
    assert MIRROR_INTERPRETATION_TO_V5_MAPPER_VERSION == "interpretation-to-v5-v4"


def test_6_editorial_exposure_rule_present():
    mapped = map_interpretation_to_v5_prompt(
        _interp(), title_source="interpretation_llm"
    )
    assert MIRROR_EDITORIAL_EXPOSURE_RULE in mapped.prompt
    assert "atmospheric, not underexposed" in mapped.prompt
    assert "premium editorial photography" in mapped.prompt.lower()
    assert "crushed blacks" in mapped.prompt.lower()


def test_7_text_free_rule_prefers_editorial_wording():
    assert "editorial scene" in MIRROR_TEXT_FREE_SCENE_RULE.lower()
    assert "cinematic scene" not in MIRROR_TEXT_FREE_SCENE_RULE.lower()
    mapped = map_interpretation_to_v5_prompt(
        _interp(), title_source="interpretation_llm"
    )
    assert MIRROR_TEXT_FREE_SCENE_RULE in mapped.prompt


def test_8_mobile_thumbnail_legibility_without_flattening():
    mapped = map_interpretation_to_v5_prompt(
        _interp(), title_source="interpretation_llm"
    )
    assert MIRROR_EDITORIAL_EXPOSURE_RULE in mapped.prompt
    assert "mobile thumbnail" in mapped.prompt.lower()
    assert "instantly readable" in mapped.prompt.lower()
    assert "light as storytelling" in mapped.prompt.lower()
    assert "do not flatten lighting" in mapped.prompt.lower()
    assert "force bright daytime" in mapped.prompt.lower()
    # Existing contracts remain intact.
    assert MIRROR_CONTEXTUAL_SPECIFICITY_RULE in mapped.prompt
    assert MIRROR_TEXT_FREE_SCENE_RULE in mapped.prompt
    assert "recognizably itself" in mapped.prompt
    assert "generic cinematic trope" in mapped.prompt
