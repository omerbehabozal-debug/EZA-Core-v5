"""Deterministic observation-assisted cover ranking (Phase 7G-4b helper).

Pure scoring only. Does not load observations from the database, call vision
providers, enqueue work, or mutate snapshots. Live create/revise wiring is a
later approved step.

When ``BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED`` is off (the default), results
match the existing lexical ``select_cover`` / ``_rank`` behavior exactly.

The trusted adapter (future 7G-4c) must supply ``RankingAssetFacts`` from
tenant-scoped committed reads. This helper never invents a Business ID when the
candidate object does not expose one; missing authoritative facts fail closed
for observation bonus only (lexical ranking remains available).
"""
from __future__ import annotations

import os
import re
import unicodedata
import uuid
from dataclasses import dataclass
from typing import Any, Mapping

from backend.services.business_yansi.media_observations import active_profile
from backend.services.business_yansi.studio_media import _words, video_may_be_cover

_FLAG = "BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED"
OBS_BONUS_CAP = 3
MIN_OBS_FOR_ZERO_LEXICAL = 2
_ASSISTED_WORD = re.compile(r"[^\W_]{3,}", re.UNICODE)
_SHA256_HEX = re.compile(r"^[0-9a-fA-F]{64}$")

# Raw low-information labels; stored form is NFC + assisted-fold (see below).
_RAW_GENERIC_TERMS = (
    "image", "images", "photo", "photos", "picture", "pictures", "pic", "pics",
    "video", "videos", "clip", "clips", "media", "file", "files", "upload",
    "frame", "frames", "scene", "scenes", "content", "object", "objects",
    "background", "foreground", "color", "colours", "colors", "shot", "shots",
    "gorsel", "görsel", "resim", "foto", "fotograf", "fotoğraf", "medya",
    "dosya", "icerik", "içerik", "sahne", "kare", "goruntu", "görüntü",
)

# Identity sentinel: source-parent relationship not loaded/verified.
# Distinct from ``None``, which means explicitly verified original source.
_UNSET = object()


def _assisted_fold(text: str) -> str:
    """NFC + Turkish-aware fold for assisted matching. Does not alter legacy ``_words``."""
    normalized = unicodedata.normalize("NFC", text)
    return normalized.replace("İ", "i").replace("I", "ı").casefold()


_GENERIC_TERMS = frozenset(_assisted_fold(term) for term in _RAW_GENERIC_TERMS)


@dataclass(frozen=True)
class RankingAssetFacts:
    """Verified media facts required before any observation bonus is awarded.

    The integration layer must populate these from committed tenant-scoped reads
    (for example lookup snapshots). Callers must not invent digests or trust
    client-supplied booleans. ``facts.asset_id`` must identify the candidate
    being ranked (``BusinessBrandAsset.id``); ``facts.business_id`` must be the
    authoritative tenant (``BusinessBrandAsset.business_id`` when the adapter
    loaded the row).

    ``source_source_asset_id`` tri-state (identity comparisons only):

    - ``_UNSET`` (default): unknown; inheritance forbidden
    - ``None``: source verified as original; inheritance may be allowed
    - non-``None`` id: source is itself a derivative; inheritance forbidden
    """

    asset_id: Any
    business_id: Any
    content_sha256: str
    source_asset_id: Any | None = None
    source_content_sha256: str | None = None
    source_source_asset_id: Any = _UNSET


def ranking_enabled() -> bool:
    """True only when observation-assisted cover ranking is explicitly enabled."""
    return os.getenv(_FLAG, "false").strip().lower() in {"1", "true", "yes", "on"}


def _valid_sha256(value: object) -> bool:
    """True only for a 64-character hexadecimal SHA-256 digest string."""
    return isinstance(value, str) and _SHA256_HEX.fullmatch(value) is not None


def _valid_identity(value: object) -> bool:
    """Accept UUID or non-empty str only — never arbitrary object ``str(...)``."""
    if isinstance(value, uuid.UUID):
        return True
    if isinstance(value, str) and value.strip() != "":
        return True
    return False


def _same_identity(left: object, right: object) -> bool:
    if not _valid_identity(left) or not _valid_identity(right):
        return False
    if isinstance(left, uuid.UUID) and isinstance(right, uuid.UUID):
        return left == right
    return str(left) == str(right)


def _context_text(title, summary, steps) -> str:
    parts = [title or "", summary or ""]
    for step in steps or []:
        if isinstance(step, dict):
            parts.append(str(step.get("question") or ""))
            parts.append(str(step.get("answer") or ""))
    return " ".join(parts)


def _asset_key(asset) -> str:
    return str(getattr(asset, "id", ""))


def _assisted_tokens(text: str) -> set[str]:
    if not isinstance(text, str) or not text:
        return set()
    folded = _assisted_fold(text)
    return {
        token
        for token in _ASSISTED_WORD.findall(folded)
        if token not in _GENERIC_TERMS
    }


def _observation_text_or_invalid(observation) -> str | None:
    """Return concat text for matching, or ``None`` when metadata is malformed.

    Arbitrary objects are never stringified into relevance text.
    """
    if observation is None:
        return None
    summary = getattr(observation, "summary", None)
    visible = getattr(observation, "visible_text", None)
    tags = getattr(observation, "tags", None)
    frames = getattr(observation, "frames", None)
    if summary is not None and not isinstance(summary, str):
        return None
    if visible is not None and not isinstance(visible, str):
        return None
    if tags is not None and not isinstance(tags, (list, tuple)):
        return None
    if frames is not None and not isinstance(frames, (list, tuple)):
        return None
    parts: list[str] = []
    if isinstance(summary, str):
        parts.append(summary)
    if isinstance(visible, str):
        parts.append(visible)
    for tag in tags or ():
        if not isinstance(tag, str):
            return None
        parts.append(tag)
    for frame in frames or ():
        # Frame must expose note/tags (e.g. FrameSnapshot). Scalars/maps are invalid.
        if frame is None or not hasattr(frame, "note") or not hasattr(frame, "tags"):
            return None
        note = getattr(frame, "note", None)
        frame_tags = getattr(frame, "tags", None)
        if note is not None and not isinstance(note, str):
            return None
        if frame_tags is not None and not isinstance(frame_tags, (list, tuple)):
            return None
        if isinstance(note, str):
            parts.append(note)
        for tag in frame_tags or ():
            if not isinstance(tag, str):
                return None
            parts.append(tag)
    return " ".join(parts)


def observation_terms(observation) -> set[str] | None:
    """Meaningful assisted tokens, or ``None`` when observation metadata is invalid."""
    text = _observation_text_or_invalid(observation)
    if text is None:
        return None
    return _assisted_tokens(text)


def observation_valid_for_candidate(
    observation,
    facts: RankingAssetFacts | None,
    *,
    candidate,
    profile: str | None = None,
) -> bool:
    """True when a snapshot may contribute an observation bonus for this candidate.

    Facts must bind to the candidate (``facts.asset_id`` ↔ ``candidate.id``).
    Supports direct asset matches and original→derivative inheritance when digests
    match and ``facts.source_source_asset_id is None`` (explicit verified original).
    ``_UNSET`` means provenance was never verified; inheritance is refused.
    """
    if observation is None or facts is None or candidate is None:
        return False
    candidate_id = getattr(candidate, "id", None)
    if not _valid_identity(candidate_id) or not _valid_identity(facts.asset_id):
        return False
    if not _same_identity(facts.asset_id, candidate_id):
        return False
    if not _valid_identity(facts.business_id):
        return False
    # Real BrandAsset rows expose business_id; stubs without the attribute are
    # allowed only when facts+observation already agree (adapter supplies tenant).
    if hasattr(candidate, "business_id"):
        candidate_business = getattr(candidate, "business_id")
        if not _valid_identity(candidate_business):
            return False
        if not _same_identity(candidate_business, facts.business_id):
            return False
    obs_business = getattr(observation, "business_id", None)
    if not _valid_identity(obs_business) or not _same_identity(obs_business, facts.business_id):
        return False
    expected = profile if isinstance(profile, str) and profile else active_profile()
    digest = facts.content_sha256
    if not _valid_sha256(digest):
        return False
    if getattr(observation, "status", None) != "ready":
        return False
    if getattr(observation, "analyzer_profile", None) != expected:
        return False
    stored = getattr(observation, "content_sha256", None)
    if not _valid_sha256(stored) or stored.lower() != digest.lower():
        return False
    obs_asset = getattr(observation, "asset_id", None)
    if not _valid_identity(obs_asset):
        return False
    if _same_identity(obs_asset, facts.asset_id):
        return observation_terms(observation) is not None
    source_id = facts.source_asset_id
    if not _valid_identity(source_id) or not _same_identity(obs_asset, source_id):
        return False
    # Identity only — never coerce missing via getattr(..., None).
    parent = facts.source_source_asset_id
    if parent is _UNSET or parent is not None:
        return False
    source_digest = facts.source_content_sha256
    if not _valid_sha256(source_digest):
        return False
    if source_digest.lower() != digest.lower():
        return False
    return observation_terms(observation) is not None


def _facts_for(asset, provenances: Mapping[Any, RankingAssetFacts] | None) -> RankingAssetFacts | None:
    if not provenances:
        return None
    key = getattr(asset, "id", None)
    if key in provenances:
        return provenances.get(key)
    token = _asset_key(asset)
    if token in provenances:
        return provenances.get(token)
    return None


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


def score_cover_candidate(
    context_words: set[str],
    asset,
    observation=None,
    *,
    facts: RankingAssetFacts | None = None,
    profile: str | None = None,
    assisted_context: set[str] | None = None,
) -> tuple[int, int] | None:
    """Return ``(total, lexical)`` or ``None`` when the candidate is ineligible.

    Lexical overlap still uses legacy ``_words``. Observation bonus uses assisted
    Turkish-aware tokens and requires ``observation_valid_for_candidate``.
    """
    lexical = len(context_words & _words(f"{getattr(asset, 'title', '')} {getattr(asset, 'caption', None) or ''}"))
    obs_hit = 0
    if observation_valid_for_candidate(observation, facts, candidate=asset, profile=profile):
        terms = observation_terms(observation) or set()
        ctx = assisted_context if assisted_context is not None else set()
        obs_hit = len(ctx & terms)
    bonus = min(obs_hit, OBS_BONUS_CAP)
    if lexical == 0:
        if obs_hit < MIN_OBS_FOR_ZERO_LEXICAL:
            return None
        return bonus, lexical
    return lexical + bonus, lexical


def rank_cover_assets(
    title,
    summary,
    assets,
    steps=None,
    observations=None,
    provenances=None,
    profile: str | None = None,
):
    """Rank eligible covers. Best asset first. Empty when nothing qualifies.

    ``observations`` maps candidate asset id → ObservationSnapshot.
    ``provenances`` maps candidate asset id → RankingAssetFacts from verified reads.
    Without matching provenance bound to the candidate, observation bonus is zero.
    Snapshots are never mutated. When the feature flag is disabled, observations
    are ignored.
    """
    covers = [
        asset for asset in (assets or [])
        if getattr(asset, "asset_type", None) in {"image", "video"} and video_may_be_cover(asset)
    ]
    context_text = _context_text(title, summary, steps)
    context_words = _words(context_text)
    assisted_context = _assisted_tokens(context_text)
    assisted = ranking_enabled()
    chosen_profile = profile if isinstance(profile, str) and profile else active_profile()
    scored = []
    for asset in covers:
        if assisted:
            observation = _observation_for(asset, observations)
            facts = _facts_for(asset, provenances)
            marks = score_cover_candidate(
                context_words,
                asset,
                observation,
                facts=facts,
                profile=chosen_profile,
                assisted_context=assisted_context,
            )
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


def select_cover_ranked(
    title,
    summary,
    assets,
    steps=None,
    observations=None,
    provenances=None,
    profile: str | None = None,
) -> str | None:
    """Pick the top-ranked cover id, or ``None`` when the pool ranks empty.

    Explicit brand covers are outside this helper (``accept_cover_choice``).
    """
    ranked = rank_cover_assets(
        title,
        summary,
        assets,
        steps=steps,
        observations=observations,
        provenances=provenances,
        profile=profile,
    )
    if not ranked:
        return None
    return _asset_key(ranked[0])
