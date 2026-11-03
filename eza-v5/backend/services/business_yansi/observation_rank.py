"""Deterministic observation-assisted cover ranking (Phase 7G-4b helper).

Pure scoring only. Does not load observations from the database, call vision
providers, enqueue work, or mutate snapshots. Live create/revise wiring is a
later approved step.

When ``BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED`` is off (the default), results
match the existing lexical ``select_cover`` / ``_rank`` behavior exactly.
"""
from __future__ import annotations

import os
from typing import Any, Mapping

from backend.services.business_yansi.studio_media import _words, video_may_be_cover

_FLAG = "BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED"
OBS_BONUS_CAP = 3
MIN_OBS_FOR_ZERO_LEXICAL = 2

# Low-information observation tokens excluded from meaningful-match counting.
_GENERIC_TERMS = frozenset({
    "image", "images", "photo", "photos", "picture", "pictures", "pic", "pics",
    "video", "videos", "clip", "clips", "media", "file", "files", "upload",
    "frame", "frames", "scene", "scenes", "content", "object", "objects",
    "background", "foreground", "color", "colours", "colors", "shot", "shots",
    "gorsel", "görsel", "resim", "foto", "fotograf", "fotoğraf", "medya",
    "dosya", "icerik", "içerik", "sahne", "kare", "goruntu", "görüntü",
})


def ranking_enabled() -> bool:
    """True only when observation-assisted cover ranking is explicitly enabled."""
    return os.getenv(_FLAG, "false").strip().lower() in {"1", "true", "yes", "on"}


def _context_text(title, summary, steps) -> str:
    parts = [title or "", summary or ""]
    for step in steps or []:
        if isinstance(step, dict):
            parts.append(str(step.get("question") or ""))
            parts.append(str(step.get("answer") or ""))
    return " ".join(parts)


def _asset_key(asset) -> str:
    return str(getattr(asset, "id", ""))


def _observation_terms(observation) -> set[str]:
    """Distinct normalized meaningful terms from an immutable observation snapshot."""
    if observation is None:
        return set()
    parts: list[str] = [
        str(getattr(observation, "summary", None) or ""),
        str(getattr(observation, "visible_text", None) or ""),
    ]
    tags = getattr(observation, "tags", ()) or ()
    for tag in tags:
        if isinstance(tag, str):
            parts.append(tag)
    for frame in getattr(observation, "frames", ()) or ():
        parts.append(str(getattr(frame, "note", None) or ""))
        for tag in getattr(frame, "tags", ()) or ():
            if isinstance(tag, str):
                parts.append(tag)
    words = _words(" ".join(parts))
    return {term for term in words if term not in _GENERIC_TERMS}


def _observation_for(asset, observations: Mapping[Any, Any] | None):
    if not observations:
        return None
    key = getattr(asset, "id", None)
    if key in observations:
        return observations.get(key)
    token = _asset_key(asset)
    if token in observations:
        return observations.get(token)
    return None


def score_cover_candidate(context_words: set[str], asset, observation=None) -> tuple[int, int] | None:
    """Return ``(total, lexical)`` or ``None`` when the candidate is ineligible.

    Observation bonus is ``min(distinct meaningful overlaps, 3)``. A zero-lexical
    candidate requires at least two distinct meaningful observation matches.
    """
    lexical = len(context_words & _words(f"{getattr(asset, 'title', '')} {getattr(asset, 'caption', None) or ''}"))
    obs_hit = len(context_words & _observation_terms(observation))
    bonus = min(obs_hit, OBS_BONUS_CAP)
    if lexical == 0:
        if obs_hit < MIN_OBS_FOR_ZERO_LEXICAL:
            return None
        return bonus, lexical
    return lexical + bonus, lexical


def rank_cover_assets(title, summary, assets, steps=None, observations=None):
    """Rank eligible covers. Best asset first. Empty when nothing qualifies.

    ``observations`` maps asset id (UUID or str) to an ObservationSnapshot-like
    object. Snapshots are never mutated. When the feature flag is disabled,
    observations are ignored and scoring matches legacy lexical ranking.
    """
    covers = [
        asset for asset in (assets or [])
        if getattr(asset, "asset_type", None) in {"image", "video"} and video_may_be_cover(asset)
    ]
    context_words = _words(_context_text(title, summary, steps))
    assisted = ranking_enabled()
    scored = []
    for asset in covers:
        observation = _observation_for(asset, observations) if assisted else None
        if assisted:
            marks = score_cover_candidate(context_words, asset, observation)
            if marks is None:
                continue
            total, lexical = marks
        else:
            lexical = len(context_words & _words(f"{asset.title} {asset.caption or ''}"))
            if not lexical:
                continue
            total = lexical
        scored.append((total, lexical, _asset_key(asset), asset))
    scored.sort(key=lambda item: (-item[0], -item[1], item[2]))
    return [item[3] for item in scored]


def select_cover_ranked(title, summary, assets, steps=None, observations=None) -> str | None:
    """Pick the top-ranked cover id, or ``None`` when the pool ranks empty.

    Explicit brand covers are outside this helper (``accept_cover_choice``).
    """
    ranked = rank_cover_assets(title, summary, assets, steps=steps, observations=observations)
    if not ranked:
        return None
    return _asset_key(ranked[0])
