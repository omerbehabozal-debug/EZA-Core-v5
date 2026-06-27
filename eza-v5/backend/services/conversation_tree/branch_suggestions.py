# -*- coding: utf-8 -*-
"""Branch suggestion card builder — public-safe sources only."""

from __future__ import annotations

from typing import Iterable, List

MAX_BRANCH_CARDS = 3
FALLBACK_LABEL = "Bu konuyu farklı açıdan keşfet"


def _editorialize(text: str) -> str:
    raw = (text or "").strip().rstrip("?")
    if not raw:
        return ""
    if len(raw) > 48:
        return f"{raw[:45].rstrip()}…"
    return raw[0].upper() + raw[1:] if raw else ""


def build_branch_suggestion_cards(
    *,
    seed_questions: Iterable[str] | None = None,
    discovery_signals: Iterable[str] | None = None,
    collection_tags: Iterable[str] | None = None,
    thought_cards: Iterable[str] | None = None,
) -> List[str]:
    ordered: List[str] = []
    for bucket in (thought_cards, seed_questions, discovery_signals, collection_tags):
        if not bucket:
            continue
        for item in bucket:
            label = _editorialize(str(item))
            if label:
                ordered.append(label)

    cards: List[str] = []
    seen: set[str] = set()
    for label in ordered:
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)
        cards.append(label)
        if len(cards) >= MAX_BRANCH_CARDS:
            break

    return cards or [FALLBACK_LABEL]
