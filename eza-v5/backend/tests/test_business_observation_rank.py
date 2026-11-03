"""Phase 7G-4b: pure observation-assisted cover ranking helper.

Not wired into create/revise. Generation and ranking flags stay off by default.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from backend.services.business_yansi import observation_lookup as lookup
from backend.services.business_yansi import observation_rank as rank
from backend.services.business_yansi import studio_media as media

_BACKEND = Path(__file__).resolve().parents[1]


class _Asset:
    def __init__(self, asset_id, asset_type, title, caption=""):
        self.id = asset_id
        self.asset_type = asset_type
        self.title = title
        self.caption = caption
        self.verified_duration = 8_000
        self.verified_timescale = 1000
        self.verified_size_bytes = 200
        self.verified_has_audio = False


def _snap(*, asset_id, summary="", tags=(), visible_text=None, frames=()):
    return lookup.ObservationSnapshot(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        asset_id=asset_id,
        content_sha256="a" * 64,
        analyzer_profile="visual-v1",
        status="ready",
        summary=summary,
        tags=tuple(tags),
        visible_text=visible_text,
        frames=tuple(frames),
    )


@pytest.fixture(autouse=True)
def _flags_off(monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)


def test_module_has_no_provider_or_lookup_side_effects():
    text = (_BACKEND / "services/business_yansi/observation_rank.py").read_text(encoding="utf-8").lower()
    for banned in ("openai", "httpx", "urlopen", "aiohttp", "call_vision", "ensure_observation", "ready_observation_for_asset"):
        assert banned not in text
    assert rank.ranking_enabled() is False


def test_flag_disabled_matches_legacy_select_cover_exactly():
    image = _Asset("00000000-0000-4000-8000-000000000010", "image", "Zeytinyagi")
    closer = _Asset("00000000-0000-4000-8000-000000000099", "video", "Zeytinyagi hasadi ozeti")
    tied = _Asset("00000000-0000-4000-8000-000000000002", "video", "Zeytinyagi")
    earlier = _Asset("00000000-0000-4000-8000-000000000001", "image", "Zeytinyagi")
    lamp = _Asset("00000000-0000-4000-8000-000000000030", "image", "Lamba isigi")
    steps = [{"question": "Lamba isigi nerede?", "answer": "Lamba isigi aksam yanar."}]
    obs = {
        closer.id: _snap(asset_id=closer.id, summary="Tamamen farkli konu metni", tags=["farkli", "konu", "metni"]),
    }
    cases = [
        ("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [image, closer], None),
        ("Zeytinyagi kaydi", "", [image, tied], None),
        ("Zeytinyagi kaydi", "", [tied, earlier], None),
        ("Baska konu", "Baska ozet", [image, lamp], steps),
        ("Baska konu", "Baska ozet", [image, tied], None),
    ]
    for title, summary, assets, case_steps in cases:
        legacy = media.select_cover(title, summary, assets, case_steps)
        assisted = rank.select_cover_ranked(title, summary, assets, case_steps, observations=obs)
        assert assisted == legacy


def test_valid_observation_bonus_can_reorder(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    weak = _Asset("00000000-0000-4000-8000-000000000010", "image", "Zeytinyagi")
    strong = _Asset("00000000-0000-4000-8000-000000000020", "image", "Atolye")
    # Lexical alone: weak wins (zeytinyagi overlap). With obs on strong matching context, strong can win.
    obs = {
        strong.id: _snap(
            asset_id=strong.id,
            summary="Zeytinyagi hasadi ozeti kayit",
            tags=["zeytinyagi", "hasadi", "ozeti"],
        ),
    }
    assert media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [weak, strong]) == str(weak.id)
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [weak, strong], observations=obs,
    ) == str(strong.id)


def test_observation_bonus_is_capped_at_three(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000011", "image", "Zeytinyagi")
    context = media._words("alfa beta gamma delta epsilon zeytinyagi")
    observation = _snap(
        asset_id=asset.id,
        summary="alfa beta gamma delta epsilon zeytinyagi ekstra",
        tags=["alfa", "beta", "gamma", "delta", "epsilon"],
    )
    marks = rank.score_cover_candidate(context, asset, observation)
    assert marks is not None
    total, lexical = marks
    assert lexical >= 1
    assert total == lexical + rank.OBS_BONUS_CAP
    assert rank.OBS_BONUS_CAP == 3


def test_duplicate_observation_terms_count_once(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000012", "image", "Atolye")
    context = media._words("zeytinyagi hasadi ozeti")
    observation = _snap(
        asset_id=asset.id,
        summary="zeytinyagi zeytinyagi zeytinyagi",
        tags=["zeytinyagi", "zeytinyagi", "hasadi"],
    )
    terms = rank._observation_terms(observation)
    assert terms == {"zeytinyagi", "hasadi"}
    marks = rank.score_cover_candidate(context, asset, observation)
    assert marks == (2, 0)  # zero lexical title; two meaningful obs matches


def test_generic_tags_are_suppressed(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000013", "image", "Atolye")
    context = media._words("image video photo medya zeytinyagi hasadi")
    observation = _snap(
        asset_id=asset.id,
        summary="image video photo",
        tags=["medya", "gorsel", "zeytinyagi", "hasadi"],
    )
    terms = rank._observation_terms(observation)
    assert "image" not in terms and "video" not in terms and "medya" not in terms
    assert "zeytinyagi" in terms and "hasadi" in terms
    marks = rank.score_cover_candidate(context, asset, observation)
    assert marks == (2, 0)


def test_zero_lexical_with_one_observation_match_is_excluded(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000014", "image", "Atolye")
    context = media._words("zeytinyagi hasadi ozeti")
    observation = _snap(asset_id=asset.id, summary="zeytinyagi", tags=["image", "photo"])
    assert rank.score_cover_candidate(context, asset, observation) is None
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset],
        observations={asset.id: observation},
    ) is None


def test_zero_lexical_with_two_meaningful_matches_is_eligible(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000015", "image", "Atolye")
    observation = _snap(asset_id=asset.id, summary="zeytinyagi hasadi", tags=["photo"])
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset],
        observations={asset.id: observation},
    ) == str(asset.id)


def test_missing_observation_falls_back_to_lexical(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    weak = _Asset("00000000-0000-4000-8000-000000000016", "image", "Atolye")
    strong = _Asset("00000000-0000-4000-8000-000000000017", "image", "Zeytinyagi hasadi")
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [weak, strong], observations={},
    ) == str(strong.id)
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [weak, strong], observations=None,
    ) == media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [weak, strong])


def test_stable_tie_breaking_prefers_lexical_then_asset_id(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    first = _Asset("00000000-0000-4000-8000-000000000001", "image", "Zeytinyagi")
    second = _Asset("00000000-0000-4000-8000-000000000002", "image", "Zeytinyagi")
    # Equal totals and lexical → lexicographic id.
    assert rank.select_cover_ranked("Zeytinyagi", "", [second, first], observations={}) == str(first.id)
    # Same total via obs bonus on second would still lose on lexical tie-break when totals equal.
    boosted = _Asset("00000000-0000-4000-8000-000000000003", "image", "Zeytinyagi")
    plain = _Asset("00000000-0000-4000-8000-000000000004", "image", "Zeytinyagi hasadi")
    obs = {boosted.id: _snap(asset_id=boosted.id, summary="hasadi", tags=[])}
    # plain lexical=2 (zeytinyagi, hasadi); boosted lexical=1 + bonus 1 hasadi = 2; lexical tie-break prefers plain
    chosen = rank.select_cover_ranked("Zeytinyagi hasadi", "", [boosted, plain], observations=obs)
    assert chosen == str(plain.id)


def test_explicit_cover_path_is_outside_this_helper():
    """Automatic helper never replaces accept_cover_choice."""
    chosen = _Asset("00000000-0000-4000-8000-000000000040", "image", "Atolye")
    other = _Asset("00000000-0000-4000-8000-000000000041", "image", "Zeytinyagi hasadi")
    explicit = media.accept_cover_choice(str(chosen.id), [chosen, other])
    ranked = rank.select_cover_ranked("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [chosen, other])
    assert explicit == str(chosen.id)
    assert ranked == str(other.id)
    assert explicit != ranked


def test_no_provider_calls_during_ranking(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    vision = AsyncMock()
    monkeypatch.setattr("backend.services.business_yansi.image_observe.call_vision", vision, raising=False)
    monkeypatch.setattr("backend.services.business_yansi.image_observe.analyze_image", vision, raising=False)
    asset = _Asset("00000000-0000-4000-8000-000000000050", "image", "Zeytinyagi")
    obs = {asset.id: _snap(asset_id=asset.id, summary="zeytinyagi hasadi", tags=["hasadi"])}
    assert rank.select_cover_ranked("Zeytinyagi hasadi", "", [asset], observations=obs) == str(asset.id)
    assert vision.await_count == 0
    assert vision.call_count == 0


def test_observation_snapshot_is_not_mutated(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000051", "image", "Atolye")
    snapshot = _snap(asset_id=asset.id, summary="zeytinyagi hasadi", tags=("zeytinyagi", "hasadi"))
    before = (snapshot.summary, snapshot.tags, snapshot.frames)
    rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset],
        observations={asset.id: snapshot},
    )
    assert (snapshot.summary, snapshot.tags, snapshot.frames) == before
    with pytest.raises(Exception):
        snapshot.summary = "degisti"  # type: ignore[misc]
