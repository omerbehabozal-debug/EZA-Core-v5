# -*- coding: utf-8 -*-
"""Deterministic pre-review checks for Mirror Draft (PR B)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from backend.core.schemas.mirror_draft import (
    GENERIC_TITLES,
    MIRROR_ART_DIRECTION_IDS,
    MirrorDraft,
    sanitize_display_text,
)


@dataclass
class DraftPrecheckResult:
    ok: bool
    issues: List[str] = field(default_factory=list)
    normalized_draft: MirrorDraft | None = None


def is_generic_title(title: str) -> bool:
    key = sanitize_display_text(title, max_len=64).lower()
    if key in GENERIC_TITLES:
        return True
    # Exact topic-name titles
    if key in {
        "travel",
        "health",
        "architecture",
        "seyahat",
        "sağlık",
        "saglik",
        "mimarlık",
        "mimarlik",
    }:
        return True
    return False


def run_draft_prechecks(draft: MirrorDraft) -> DraftPrecheckResult:
    issues: list[str] = []
    data = draft.model_dump()

    title = (draft.title or "").strip()
    if not title:
        issues.append("title_empty")
    if len(title) > 64:
        issues.append("title_too_long")
    if is_generic_title(title):
        issues.append("generic_title")

    if draft.artDirection not in MIRROR_ART_DIRECTION_IDS:
        issues.append("unknown_art_direction")

    if not (0.0 <= draft.confidence <= 1.0):
        issues.append("invalid_confidence")

    if len(draft.sceneDescription.strip()) < 24:
        issues.append("scene_too_short")

    motifs_l = [m.lower() for m in draft.visualMotifs]
    if len(motifs_l) != len(set(motifs_l)):
        issues.append("duplicate_motifs")

    forbidden_l = {f.lower() for f in draft.forbiddenSymbols}
    if any(m in forbidden_l for m in motifs_l):
        issues.append("forbidden_motif_intersection")

    if draft.subtitle and draft.subtitle.strip().lower() == title.lower():
        issues.append("subtitle_repeats_title")

    # Re-validate through model (normalization)
    try:
        normalized = MirrorDraft.model_validate(data)
    except Exception:
        return DraftPrecheckResult(ok=False, issues=issues + ["schema_invalid"], normalized_draft=None)

    fatal = {
        "title_empty",
        "scene_too_short",
        "unknown_art_direction",
        "invalid_confidence",
        "schema_invalid",
    }
    if any(i in fatal for i in issues):
        return DraftPrecheckResult(ok=False, issues=issues, normalized_draft=None)

    return DraftPrecheckResult(ok=True, issues=issues, normalized_draft=normalized)
