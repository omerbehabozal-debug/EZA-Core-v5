# -*- coding: utf-8 -*-
"""Lightweight heuristic meaning from snapshot — Director Meaning LLM fallback (PR C)."""

from __future__ import annotations

import re

from backend.core.schemas.mirror_director import MirrorMeaningAnalysis
from backend.services.mirror.conversation_snapshot import MirrorConversationSnapshot

_DOMAIN = [
    (
        "travel",
        3.2,
        re.compile(
            r"\b(kyoto|tokyo|roma|rome|gion|seyahat|gezi|tatil|yağmur|yagmur|kafe|otel|museum|müze)\b",
            re.I,
        ),
    ),
    (
        "health",
        3.0,
        re.compile(r"\b(kalori|kilo|adım|adim|10\s*bin|fitness|diyet|egzersiz)\b", re.I),
    ),
    (
        "architecture",
        3.0,
        re.compile(
            r"\b(kaldırım|kaldirim|yaya aks|yürüyüş yolu|yuruyus yolu|tezg[aâ]h|banyo|mermer|cephe|proje)\b",
            re.I,
        ),
    ),
    (
        "technology_ai",
        2.4,
        re.compile(r"\b(yapay zeka|ai\b|model|algoritma|prompt)\b", re.I),
    ),
    (
        "finance",
        2.4,
        re.compile(r"\b(borsa|yatırım|yatirim|bütçe|butce|faiz)\b", re.I),
    ),
]


def build_heuristic_meaning_from_snapshot(snapshot: MirrorConversationSnapshot) -> MirrorMeaningAnalysis:
    texts = [m.text for m in snapshot.messages if m.role == "user"]
    blob = "\n".join(texts)
    scores: list[tuple[str, float]] = []
    for topic, weight, pattern in _DOMAIN:
        hits = pattern.findall(blob)
        if hits:
            scores.append((topic, weight + 0.15 * len(hits)))
    scores.sort(key=lambda x: x[1], reverse=True)
    primary = scores[0][0] if scores else "general_curiosity"
    confidence = 0.55
    if scores:
        confidence = min(0.9, 0.55 + scores[0][1] * 0.05)

    forbidden = ["bathroom mirror", "cosmetics", "medical imagery", "gym imagery"]
    if primary == "architecture" and re.search(r"banyo|tezg", blob, re.I):
        forbidden = ["cosmetics product shoot", "spa cliché collage", "medical imagery"]

    narrative = texts[-1][:200] if texts else "A quiet editorial moment from the conversation."
    intent = texts[0][:200] if texts else "explore_topic"

    return MirrorMeaningAnalysis.model_validate(
        {
            "primaryTopic": primary,
            "topicCategory": primary,
            "secondaryTopics": [],
            "userIntent": intent or "explore",
            "emotionalTone": ["curious", "calm"],
            "narrative": narrative if len(narrative) >= 8 else f"Conversation about {primary}.",
            "visualMotifs": [],
            "forbiddenSymbols": forbidden,
            "suggestedPalette": ["warm amber", "soft ivory", "deep indigo"],
            "suggestedComposition": (
                "editorial single-scene cover composition matching the conversation narrative"
            ),
            "confidence": confidence,
        }
    )
