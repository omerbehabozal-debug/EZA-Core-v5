# -*- coding: utf-8 -*-
"""Heuristic + minimal safe Mirror Draft builders (PR B fallback)."""

from __future__ import annotations

from backend.core.schemas.mirror_director import MirrorMeaningAnalysis
from backend.core.schemas.mirror_draft import (
    MirrorArtDirectionId,
    MirrorDraft,
    MirrorDraftEvidenceMap,
    MirrorNarrativeAngle,
)


_TOPIC_ART: dict[str, MirrorArtDirectionId] = {
    "travel": "night_discovery",
    "health": "quiet_luxury",
    "architecture": "editorial_magazine",
    "technology_ai": "editorial_magazine",
    "finance": "editorial_magazine",
    "food_culture": "golden_hour",
    "family": "bright_cinematic",
    "education": "editorial_magazine",
    "spiritual_reflection": "quiet_luxury",
    "vehicle": "film_poster",
    "general_curiosity": "bright_cinematic",
    "other": "editorial_magazine",
}

_TOPIC_ANGLE: dict[str, MirrorNarrativeAngle] = {
    "travel": "adaptive_plan",
    "health": "personal_milestone",
    "architecture": "architectural_precision",
    "technology_ai": "playful_curiosity",
    "general_curiosity": "playful_curiosity",
}


def build_heuristic_mirror_draft(analysis: MirrorMeaningAnalysis) -> MirrorDraft:
    topic = analysis.topicCategory if analysis.primaryTopic == "other" else analysis.primaryTopic
    motifs = list(analysis.visualMotifs[:6]) or list(analysis.secondaryTopics[:4])
    if not motifs:
        motifs = [topic.replace("_", " ")]

    entities = [s for s in analysis.secondaryTopics if s][:3]
    entity_bit = entities[0] if entities else topic.replace("_", " ")
    title = _heuristic_title(analysis, entity_bit)
    art = _TOPIC_ART.get(topic, "editorial_magazine")
    angle = _TOPIC_ANGLE.get(topic, "other")

    rainy = any("rain" in m.lower() or "yağmur" in m.lower() or "yagmur" in m.lower() for m in motifs + analysis.emotionalTone)
    if rainy and topic == "travel":
        art = "night_discovery"
        angle = "unexpected_discovery"
        if "yağmur" not in title.lower() and "rain" not in title.lower():
            title = f"Yağmur Altında {entity_bit}"[:64]

    scene = analysis.suggestedComposition
    if len(scene) < 24:
        scene = (
            f"A concrete editorial scene for {entity_bit}: "
            f"{analysis.narrative[:180]} Motifs: {', '.join(motifs[:3])}."
        )

    evidence = MirrorDraftEvidenceMap(
        titleEvidence=[analysis.narrative[:120], analysis.userIntent[:80]],
        motifEvidence=motifs[:6],
        narrativeEvidence=[analysis.narrative[:160]],
    )

    return MirrorDraft.model_validate(
        {
            "title": title[:64],
            "subtitle": None,
            "coreIdea": analysis.narrative[:240] if len(analysis.narrative) >= 8 else analysis.userIntent[:240],
            "narrativeAngle": angle,
            "artDirection": art,
            "sceneDescription": scene[:700],
            "visualMotifs": motifs[:8],
            "forbiddenSymbols": list(analysis.forbiddenSymbols[:12])
            or ["bathroom mirror", "cosmetics", "medical imagery", "gym imagery"],
            "palette": list(analysis.suggestedPalette[:5]) or ["warm amber", "deep indigo", "soft ivory"],
            "composition": analysis.suggestedComposition[:220]
            if len(analysis.suggestedComposition) >= 8
            else "single-scene editorial cover with clear subject and negative space for title",
            "lighting": _lighting_for(art),
            "camera": "35mm editorial lens, eye-level, shallow depth",
            "typographyMood": "restrained editorial",
            "emotionalTone": list(analysis.emotionalTone[:5]) or ["curious", "calm"],
            "topicCategory": topic,
            "confidence": min(0.85, max(0.35, analysis.confidence * 0.9)),
            "evidence": evidence.model_dump(),
        }
    )


def build_minimal_safe_draft(*, topic: str = "general_curiosity") -> MirrorDraft:
    return MirrorDraft.model_validate(
        {
            "title": "Sakin Bir An",
            "subtitle": None,
            "coreIdea": "A quiet editorial moment drawn from the conversation's calm curiosity.",
            "narrativeAngle": "reflective_pause",
            "artDirection": "editorial_magazine",
            "sceneDescription": (
                "A single calm interior or street-side setting with soft daylight, "
                "one clear subject, and quiet negative space for typography."
            ),
            "visualMotifs": ["soft daylight", "quiet interior edge"],
            "forbiddenSymbols": ["bathroom mirror", "cosmetics", "medical imagery", "logo"],
            "palette": ["ivory", "charcoal", "muted gold"],
            "composition": "clean editorial single scene with upper third title space",
            "lighting": "soft daylight, restrained contrast",
            "camera": "40mm editorial, centered calm frame",
            "typographyMood": "quiet minimal",
            "emotionalTone": ["calm", "curious"],
            "topicCategory": topic if topic else "general_curiosity",
            "confidence": 0.3,
            "evidence": {
                "titleEvidence": ["safe_fallback"],
                "motifEvidence": [],
                "narrativeEvidence": [],
            },
        }
    )


def _heuristic_title(analysis: MirrorMeaningAnalysis, entity_bit: str) -> str:
    topic = analysis.primaryTopic
    if topic == "travel":
        return f"{entity_bit} Akşamı"[:64] if entity_bit else "Sessiz Rota"
    if topic == "health":
        return "Adım Ritmi"[:64]
    if topic == "architecture":
        return "Yaya Aksı"[:64]
    return (entity_bit[:1].upper() + entity_bit[1:])[:64] if entity_bit else "Günün Aynası"


def _lighting_for(art: MirrorArtDirectionId) -> str:
    mapping = {
        "bright_cinematic": "soft cinematic window light, warm fill",
        "night_discovery": "practical night lights, wet reflections, low-key",
        "editorial_magazine": "clean softbox daylight, restrained contrast",
        "film_poster": "dramatic key light, deep cinematic shadows",
        "quiet_luxury": "diffused morning light, soft ivory highlights",
        "golden_hour": "warm golden hour key, long soft shadows",
    }
    return mapping.get(art, "soft editorial daylight")
