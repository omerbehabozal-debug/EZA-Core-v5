# -*- coding: utf-8 -*-
"""Keyword and score thresholds for standalone observation tagging."""

from __future__ import annotations

import re
import unicodedata
from typing import List, Sequence, Tuple

# Risk / alignment thresholds (0–1 risk scores; alignment 0–100)
INPUT_RISK_HIGH = 0.45
INPUT_RISK_VERY_HIGH = 0.65
OUTPUT_RISK_LOW = 0.32
ALIGNMENT_HIGH = 78.0
ALIGNMENT_LOW = 45.0

REFUSAL_MARKERS: Tuple[str, ...] = (
    "üzgünüm",
    "yapamam",
    "yardımcı olamam",
    "politika",
    "güvenlik",
    "sınır",
    "uygun değil",
    "cannot help",
    "can't help",
    "i cannot",
)

EXPLANATION_MARKERS: Tuple[str, ...] = (
    "çünkü",
    "bu nedenle",
    "şöyle",
    "dolayısıyla",
    "açıklamak gerekirse",
    "because",
    "therefore",
)

STRUCTURE_MARKERS: Tuple[str, ...] = (
    "\n- ",
    "\n* ",
    "\n1.",
    "\n1)",
    "##",
    "**",
    "adım",
    "madde",
)

USER_RULES: Sequence[Tuple[str, Tuple[str, ...], Tuple[str, ...]]] = (
    (
        "decision_direction",
        (
            "sence",
            "hangisi",
            "ne yapmalıyım",
            "karar",
            "mantıklı mı",
            "seçmeli",
            "tercih",
        ),
        ("choice_comparison", "advice_request"),
    ),
    (
        "clarity_simplification",
        (
            "kısaca",
            "net",
            "özet",
            "basit anlat",
            "tam olarak",
            "sadeleştir",
        ),
        ("brevity_request", "precision_request"),
    ),
    (
        "ideation_creation",
        (
            "fikir",
            "tasarla",
            "konsept",
            "prompt",
            "oluştur",
            "tasarım",
        ),
        ("creation_request", "concept_request"),
    ),
    (
        "deep_thinking",
        (
            "neden",
            "mantığı",
            "arka plan",
            "nasıl çalışır",
            "köken",
        ),
        ("causal_inquiry", "mechanism_inquiry"),
    ),
    (
        "trust_verification",
        (
            "emin misin",
            "doğru mu",
            "kaynak",
            "kanıt",
            "teyit",
            "doğrula",
        ),
        ("verification_request", "evidence_request"),
    ),
    (
        "planning_structure",
        (
            "plan",
            "aşama",
            "sıra",
            "yol haritası",
            "takvim",
            "roadmap",
        ),
        ("planning_request", "sequencing"),
    ),
    (
        "fast_practical",
        (
            "hemen",
            "adım adım",
            "çöz",
            "uygula",
            "hızlı",
            "pratik",
        ),
        ("action_request", "speed_request"),
    ),
    (
        "curiosity_exploration",
        (
            "merak",
            "keşfet",
            "ilginç",
            "alternatif",
            "farklı açı",
        ),
        ("exploration_tone", "open_question"),
    ),
)


def normalize_text(text: str) -> str:
    if not text:
        return ""
    lowered = text.lower().strip()
    lowered = unicodedata.normalize("NFKC", lowered)
    return re.sub(r"\s+", " ", lowered)


def contains_any(text: str, needles: Sequence[str]) -> List[str]:
    hits: List[str] = []
    for n in needles:
        if n in text:
            hits.append(n.replace(" ", "_"))
    return hits


def match_user_keywords(text: str) -> Tuple[str, List[str], float]:
    """Return (category, signals, confidence)."""
    t = normalize_text(text)
    if not t:
        return "balanced_calm", ["neutral_input"], 0.52

    best_cat = "balanced_calm"
    best_signals: List[str] = ["neutral_input"]
    best_conf = 0.52

    for category, keywords, signal_names in USER_RULES:
        hits = contains_any(t, keywords)
        if hits:
            conf = min(0.92, 0.62 + 0.06 * len(hits))
            if conf > best_conf or best_cat == "balanced_calm":
                best_cat = category
                best_signals = list(signal_names) + hits[:2]
                best_conf = conf

    return best_cat, best_signals, best_conf


def has_structure(output: str) -> bool:
    t = output or ""
    if len(t) > 400 and any(m in t for m in EXPLANATION_MARKERS):
        return True
    if any(m in t for m in STRUCTURE_MARKERS):
        return True
    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    if len(lines) >= 4 and sum(1 for ln in lines if ln[:2] in ("- ", "* ", "• ")) >= 2:
        return True
    return False


def has_refusal_tone(output: str) -> bool:
    t = normalize_text(output)
    return any(m in t for m in REFUSAL_MARKERS)


def is_short_direct_answer(output: str) -> bool:
    t = (output or "").strip()
    return 0 < len(t) <= 280 and "\n" not in t and t.count(".") <= 2
