"""Phase 7G-4b: pure observation-assisted cover ranking helper.

Not wired into create/revise. Generation and ranking flags stay off by default.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.services.business_yansi import observation_lookup as lookup
from backend.services.business_yansi import observation_rank as rank
from backend.services.business_yansi import studio_media as media

_BACKEND = Path(__file__).resolve().parents[1]
_DIGEST = "a" * 64
_BUSINESS = uuid.UUID("00000000-0000-4000-8000-0000000000bb")


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


def _facts(
    asset,
    *,
    digest=_DIGEST,
    business_id=_BUSINESS,
    source_asset_id=None,
    source_digest=None,
    source_source_asset_id=rank._UNSET,
):
    return rank.RankingAssetFacts(
        asset_id=asset.id,
        business_id=business_id,
        content_sha256=digest,
        source_asset_id=source_asset_id,
        source_content_sha256=source_digest,
        source_source_asset_id=source_source_asset_id,
    )


def _snap(
    *,
    asset_id,
    summary="",
    tags=(),
    visible_text=None,
    frames=(),
    business_id=_BUSINESS,
    content_sha256=_DIGEST,
    analyzer_profile="visual-v1",
    status="ready",
):
    return lookup.ObservationSnapshot(
        id=uuid.uuid4(),
        business_id=business_id,
        asset_id=asset_id,
        content_sha256=content_sha256,
        analyzer_profile=analyzer_profile,
        status=status,
        summary=summary,
        tags=tuple(tags) if isinstance(tags, (list, tuple)) else tags,
        visible_text=visible_text,
        frames=tuple(frames) if isinstance(frames, (list, tuple)) else frames,
    )


def _bundle(asset, observation, facts=None):
    return {
        "observations": {asset.id: observation},
        "provenances": {asset.id: facts or _facts(asset)},
    }


@pytest.fixture(autouse=True)
def _flags_off(monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_OBSERVATION_PROFILE", raising=False)


def test_module_has_no_provider_or_lookup_side_effects():
    text = (_BACKEND / "services/business_yansi/observation_rank.py").read_text(encoding="utf-8").lower()
    for banned in ("openai", "httpx", "urlopen", "aiohttp", "call_vision", "ensure_observation", "ready_observation_for_asset", "select(", "session"):
        assert banned not in text
    assert rank.ranking_enabled() is False


def test_flag_disabled_matches_legacy_select_cover_exactly():
    image = _Asset("00000000-0000-4000-8000-000000000010", "image", "Zeytinyagi")
    closer = _Asset("00000000-0000-4000-8000-000000000099", "video", "Zeytinyagi hasadi ozeti")
    tied = _Asset("00000000-0000-4000-8000-000000000002", "video", "Zeytinyagi")
    earlier = _Asset("00000000-0000-4000-8000-000000000001", "image", "Zeytinyagi")
    lamp = _Asset("00000000-0000-4000-8000-000000000030", "image", "Lamba isigi")
    steps = [{"question": "Lamba isigi nerede?", "answer": "Lamba isigi aksam yanar."}]
    obs = {closer.id: _snap(asset_id=closer.id, summary="Tamamen farkli konu metni", tags=["farkli", "konu", "metni"])}
    provenances = {closer.id: _facts(closer), image.id: _facts(image)}
    cases = [
        ("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [image, closer], None),
        ("Zeytinyagi kaydi", "", [image, tied], None),
        ("Zeytinyagi kaydi", "", [tied, earlier], None),
        ("Baska konu", "Baska ozet", [image, lamp], steps),
        ("Baska konu", "Baska ozet", [image, tied], None),
    ]
    for title, summary, assets, case_steps in cases:
        legacy = media.select_cover(title, summary, assets, case_steps)
        assisted = rank.select_cover_ranked(
            title, summary, assets, case_steps, observations=obs, provenances=provenances,
        )
        assert assisted == legacy


def test_valid_observation_bonus_can_reorder(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    weak = _Asset("00000000-0000-4000-8000-000000000010", "image", "Zeytinyagi")
    strong = _Asset("00000000-0000-4000-8000-000000000020", "image", "Atolye")
    obs = {
        strong.id: _snap(asset_id=strong.id, summary="Zeytinyagi hasadi ozeti kayit", tags=["zeytinyagi", "hasadi", "ozeti"]),
    }
    provenances = {weak.id: _facts(weak), strong.id: _facts(strong)}
    assert media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [weak, strong]) == str(weak.id)
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [weak, strong],
        observations=obs, provenances=provenances,
    ) == str(strong.id)


def test_observation_bonus_is_capped_at_three(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000011", "image", "Zeytinyagi")
    context = media._words("alfa beta gamma delta epsilon zeytinyagi")
    assisted = rank._assisted_tokens("alfa beta gamma delta epsilon zeytinyagi")
    observation = _snap(
        asset_id=asset.id,
        summary="alfa beta gamma delta epsilon zeytinyagi ekstra",
        tags=["alfa", "beta", "gamma", "delta", "epsilon"],
    )
    marks = rank.score_cover_candidate(
        context, asset, observation, facts=_facts(asset), assisted_context=assisted,
    )
    assert marks is not None
    total, lexical = marks
    assert lexical >= 1
    assert total == lexical + rank.OBS_BONUS_CAP


def test_duplicate_observation_terms_count_once(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000012", "image", "Atolye")
    context = media._words("zeytinyagi hasadi ozeti")
    assisted = rank._assisted_tokens("zeytinyagi hasadi ozeti")
    observation = _snap(
        asset_id=asset.id,
        summary="zeytinyagi zeytinyagi zeytinyagi",
        tags=["zeytinyagi", "zeytinyagi", "hasadi"],
    )
    terms = rank.observation_terms(observation)
    assert terms == {"zeytinyagi", "hasadi"}
    marks = rank.score_cover_candidate(
        context, asset, observation, facts=_facts(asset), assisted_context=assisted,
    )
    assert marks == (2, 0)


def test_generic_tags_are_suppressed(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000013", "image", "Atolye")
    context = media._words("image video photo medya zeytinyagi hasadi")
    assisted = rank._assisted_tokens("image video photo medya zeytinyagi hasadi")
    observation = _snap(
        asset_id=asset.id,
        summary="image video photo",
        tags=["medya", "gorsel", "zeytinyagi", "hasadi"],
    )
    terms = rank.observation_terms(observation)
    assert "image" not in terms and "video" not in terms and "medya" not in terms
    assert "zeytinyagi" in terms and "hasadi" in terms
    marks = rank.score_cover_candidate(
        context, asset, observation, facts=_facts(asset), assisted_context=assisted,
    )
    assert marks == (2, 0)


def test_zero_lexical_with_one_observation_match_is_excluded(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000014", "image", "Atolye")
    observation = _snap(asset_id=asset.id, summary="zeytinyagi", tags=["image", "photo"])
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset],
        **_bundle(asset, observation),
    ) is None


def test_zero_lexical_with_two_meaningful_matches_is_eligible(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000015", "image", "Atolye")
    observation = _snap(asset_id=asset.id, summary="zeytinyagi hasadi", tags=["photo"])
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset],
        **_bundle(asset, observation),
    ) == str(asset.id)


def test_missing_observation_falls_back_to_lexical(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    weak = _Asset("00000000-0000-4000-8000-000000000016", "image", "Atolye")
    strong = _Asset("00000000-0000-4000-8000-000000000017", "image", "Zeytinyagi hasadi")
    provenances = {weak.id: _facts(weak), strong.id: _facts(strong)}
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [weak, strong],
        observations={}, provenances=provenances,
    ) == str(strong.id)


def test_stable_tie_breaking_prefers_lexical_then_asset_id(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    first = _Asset("00000000-0000-4000-8000-000000000001", "image", "Zeytinyagi")
    second = _Asset("00000000-0000-4000-8000-000000000002", "image", "Zeytinyagi")
    provenances = {first.id: _facts(first), second.id: _facts(second)}
    assert rank.select_cover_ranked(
        "Zeytinyagi", "", [second, first], observations={}, provenances=provenances,
    ) == str(first.id)
    boosted = _Asset("00000000-0000-4000-8000-000000000003", "image", "Zeytinyagi")
    plain = _Asset("00000000-0000-4000-8000-000000000004", "image", "Zeytinyagi hasadi")
    obs = {boosted.id: _snap(asset_id=boosted.id, summary="hasadi", tags=[])}
    provenances = {boosted.id: _facts(boosted), plain.id: _facts(plain)}
    chosen = rank.select_cover_ranked(
        "Zeytinyagi hasadi", "", [boosted, plain], observations=obs, provenances=provenances,
    )
    assert chosen == str(plain.id)


def test_explicit_cover_path_is_outside_this_helper():
    chosen = _Asset("00000000-0000-4000-8000-000000000040", "image", "Atolye")
    other = _Asset("00000000-0000-4000-8000-000000000041", "image", "Zeytinyagi hasadi")
    explicit = media.accept_cover_choice(str(chosen.id), [chosen, other])
    ranked = rank.select_cover_ranked("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [chosen, other])
    assert explicit == str(chosen.id)
    assert ranked == str(other.id)


def test_no_provider_calls_during_ranking(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    vision = AsyncMock()
    monkeypatch.setattr("backend.services.business_yansi.image_observe.call_vision", vision, raising=False)
    monkeypatch.setattr("backend.services.business_yansi.image_observe.analyze_image", vision, raising=False)
    asset = _Asset("00000000-0000-4000-8000-000000000050", "image", "Zeytinyagi")
    obs = {asset.id: _snap(asset_id=asset.id, summary="zeytinyagi hasadi", tags=["hasadi"])}
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "", [asset], observations=obs, provenances={asset.id: _facts(asset)},
    ) == str(asset.id)
    assert vision.await_count == 0 and vision.call_count == 0


def test_observation_snapshot_is_not_mutated(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000051", "image", "Atolye")
    snapshot = _snap(asset_id=asset.id, summary="zeytinyagi hasadi", tags=("zeytinyagi", "hasadi"))
    before = (snapshot.summary, snapshot.tags, snapshot.frames)
    rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset], **_bundle(asset, snapshot),
    )
    assert (snapshot.summary, snapshot.tags, snapshot.frames) == before
    with pytest.raises(Exception):
        snapshot.summary = "degisti"  # type: ignore[misc]


@pytest.mark.parametrize("status", ["queued", "running", "failed"])
def test_non_ready_observation_awards_zero_bonus(monkeypatch, status):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000060", "image", "Atolye")
    observation = _snap(asset_id=asset.id, summary="zeytinyagi hasadi ozeti", tags=["zeytinyagi", "hasadi"], status=status)
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset], **_bundle(asset, observation),
    ) is None


def test_wrong_asset_observation_awards_zero_bonus(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000061", "image", "Atolye")
    other = uuid.UUID("00000000-0000-4000-8000-000000000062")
    observation = _snap(asset_id=other, summary="zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"])
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset], **_bundle(asset, observation),
    ) is None


def test_wrong_business_observation_awards_zero_bonus(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000063", "image", "Atolye")
    observation = _snap(
        asset_id=asset.id, business_id=uuid.uuid4(),
        summary="zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"],
    )
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset], **_bundle(asset, observation),
    ) is None


def test_wrong_profile_observation_awards_zero_bonus(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000064", "image", "Atolye")
    observation = _snap(
        asset_id=asset.id, analyzer_profile="visual-v2",
        summary="zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"],
    )
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset], **_bundle(asset, observation),
    ) is None


def test_wrong_content_sha_observation_awards_zero_bonus(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000065", "image", "Atolye")
    observation = _snap(
        asset_id=asset.id, content_sha256="b" * 64,
        summary="zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"],
    )
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset], **_bundle(asset, observation),
    ) is None


def test_unset_source_parent_rejects_inheritance(monkeypatch):
    """A: omitted/default _UNSET → inherited bonus = 0."""
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    source_id = uuid.UUID("00000000-0000-4000-8000-000000000070")
    derivative = _Asset("00000000-0000-4000-8000-000000000071", "image", "Atolye")
    observation = _snap(asset_id=source_id, summary="zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"])
    # Default source_source_asset_id is _UNSET (unknown provenance).
    facts = _facts(derivative, source_asset_id=source_id, source_digest=_DIGEST)
    assert facts.source_source_asset_id is rank._UNSET
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [derivative],
        observations={derivative.id: observation},
        provenances={derivative.id: facts},
    ) is None
    # Constructing RankingAssetFacts without the field also defaults to _UNSET.
    bare = rank.RankingAssetFacts(
        asset_id=derivative.id,
        business_id=_BUSINESS,
        content_sha256=_DIGEST,
        source_asset_id=source_id,
        source_content_sha256=_DIGEST,
    )
    assert bare.source_source_asset_id is rank._UNSET
    assert rank.observation_valid_for_candidate(observation, bare) is False


def test_valid_identical_sha_inheritance_awards_bonus(monkeypatch):
    """B: explicit source_source_asset_id=None → verified original inheritance may score."""
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    source_id = uuid.UUID("00000000-0000-4000-8000-000000000072")
    derivative = _Asset("00000000-0000-4000-8000-000000000073", "image", "Atolye")
    observation = _snap(asset_id=source_id, summary="zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"])
    facts = _facts(
        derivative,
        source_asset_id=source_id,
        source_digest=_DIGEST,
        source_source_asset_id=None,
    )
    assert facts.source_source_asset_id is None
    assert facts.source_source_asset_id is not rank._UNSET
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [derivative],
        observations={derivative.id: observation},
        provenances={derivative.id: facts},
    ) == str(derivative.id)


def test_inheritance_rejected_when_source_is_not_original(monkeypatch):
    """C: source_source_asset_id=<another id> → inherited bonus = 0."""
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    source_id = uuid.UUID("00000000-0000-4000-8000-000000000074")
    derivative = _Asset("00000000-0000-4000-8000-000000000075", "image", "Atolye")
    observation = _snap(asset_id=source_id, summary="zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"])
    facts = _facts(
        derivative,
        source_asset_id=source_id,
        source_digest=_DIGEST,
        source_source_asset_id=uuid.uuid4(),
    )
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [derivative],
        observations={derivative.id: observation},
        provenances={derivative.id: facts},
    ) is None


def test_inheritance_rejected_when_source_digest_missing(monkeypatch):
    """D: missing source digest → inherited bonus = 0."""
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    source_id = uuid.UUID("00000000-0000-4000-8000-000000000076")
    derivative = _Asset("00000000-0000-4000-8000-000000000077", "image", "Atolye")
    observation = _snap(asset_id=source_id, summary="zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"])
    facts = _facts(
        derivative,
        source_asset_id=source_id,
        source_digest=None,
        source_source_asset_id=None,
    )
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [derivative],
        observations={derivative.id: observation},
        provenances={derivative.id: facts},
    ) is None


def test_inheritance_rejected_when_source_digest_differs(monkeypatch):
    """E: different source/candidate digests → inherited bonus = 0."""
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    source_id = uuid.UUID("00000000-0000-4000-8000-000000000078")
    derivative = _Asset("00000000-0000-4000-8000-000000000079", "image", "Atolye")
    observation = _snap(asset_id=source_id, summary="zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"])
    facts = _facts(
        derivative,
        digest=_DIGEST,
        source_asset_id=source_id,
        source_digest="b" * 64,
        source_source_asset_id=None,
    )
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [derivative],
        observations={derivative.id: observation},
        provenances={derivative.id: facts},
    ) is None


def test_direct_observation_unaffected_by_unset_source_parent(monkeypatch):
    """F: direct observation matching ignores missing source-parent facts."""
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-00000000007a", "image", "Atolye")
    observation = _snap(asset_id=asset.id, summary="zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"])
    facts = _facts(asset)  # source_source_asset_id remains _UNSET
    assert facts.source_source_asset_id is rank._UNSET
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset],
        observations={asset.id: observation},
        provenances={asset.id: facts},
    ) == str(asset.id)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"tags": 42},
        {"frames": 42},
        {"summary": {"zeytin": "hasat"}},
        {"tags": ["zeytinyagi", 7]},
        {"frames": [42]},
        {"frames": [SimpleNamespace(note={"a": 1}, tags=["zeytinyagi"])]},
        {"frames": [SimpleNamespace(note="zeytinyagi hasadi", tags=42)]},
        {"frames": [SimpleNamespace(note="zeytinyagi", tags=["hasadi", 3])]},
        {"visible_text": ["not", "text"]},
    ],
)
def test_malformed_observation_metadata_awards_zero_bonus(monkeypatch, kwargs):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000080", "image", "Atolye")
    base = dict(asset_id=asset.id, summary="zeytinyagi hasadi", tags=("zeytinyagi", "hasadi"), frames=())
    base.update(kwargs)
    # Bypass _snap tuple coercion for intentional malformed payloads.
    observation = lookup.ObservationSnapshot(
        id=uuid.uuid4(),
        business_id=_BUSINESS,
        asset_id=base["asset_id"],
        content_sha256=_DIGEST,
        analyzer_profile="visual-v1",
        status="ready",
        summary=base.get("summary", "zeytinyagi hasadi"),
        tags=base.get("tags", ("zeytinyagi", "hasadi")),
        visible_text=base.get("visible_text"),
        frames=base.get("frames", ()),
    )
    assert rank.observation_terms(observation) is None
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset],
        observations={asset.id: observation},
        provenances={asset.id: _facts(asset)},
    ) is None


def test_turkish_generic_only_observation_is_not_eligible(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000090", "image", "Atolye")
    observation = _snap(asset_id=asset.id, summary="RESİM İÇERİK", tags=["GÖRSEL", "MEDYA"])
    terms = rank.observation_terms(observation)
    assert terms == set()
    assert rank.select_cover_ranked(
        "Resim icerik gorsel medya", "", [asset], **_bundle(asset, observation),
    ) is None


def test_turkish_normalization_matches_dotted_i_and_punctuation(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000091", "image", "Atolye")
    observation = _snap(asset_id=asset.id, summary="ZEYTİNYAĞI, hasadı!", tags=["ÖZETİ"])
    terms = rank.observation_terms(observation)
    assert "zeytinyağı" in terms or "zeytinyagi" in terms or any("zeytin" in t for t in terms)
    # Context uses the same assisted fold for bonus matching.
    assert rank.select_cover_ranked(
        "Zeytinyağı hasadı özeti", "", [asset], **_bundle(asset, observation),
    ) == str(asset.id)


def test_missing_provenance_awards_zero_bonus(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = _Asset("00000000-0000-4000-8000-000000000092", "image", "Atolye")
    observation = _snap(asset_id=asset.id, summary="zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"])
    assert rank.select_cover_ranked(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset],
        observations={asset.id: observation},
        provenances={},
    ) is None
