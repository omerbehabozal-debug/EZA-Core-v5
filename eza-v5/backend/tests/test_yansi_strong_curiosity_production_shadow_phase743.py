# -*- coding: utf-8 -*-
"""Phase 7.4.3 — production corpus shadow evaluation (internal, CI fixtures)."""

from __future__ import annotations

import copy
import inspect
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from backend.core.schemas.mirror_network import DiscoverMirrorListResponse
from backend.routers import mirror_network as mirror_router
from backend.services.mirror_network import discover as discover_mod
from backend.services.mirror_network.discover import (
    DEFAULT_DISCOVER_MODE,
    MAX_DISCOVER_ELIGIBLE_LOAD,
    list_discover_mirrors,
)
from backend.services.mirror_network import yansi_strong_curiosity_final_shadow as final_mod
from backend.services.mirror_network import yansi_strong_curiosity_production_shadow as prod_mod
from backend.services.mirror_network.yansi_strong_curiosity_evaluation import (
    build_phase74_reference_cohorts,
)
from backend.services.mirror_network.yansi_strong_curiosity_final_shadow import (
    POLICY_VERSION,
    build_phase742_reference_cohorts,
    evaluate_strong_curiosity_final_shadow,
    order_final_shadow_candidates,
)
from backend.services.mirror_network.yansi_strong_curiosity_production_shadow import (
    EVALUATOR_VERSION,
    FORBIDDEN_PRIVACY_KEYS,
    evaluate_production_corpus_shadow,
    render_human_markdown,
    write_internal_artifact,
)
from backend.services.mirror_network.yansi_strong_curiosity_shadow import SHADOW_STRATEGIES


NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)
EZA_V5 = Path(__file__).resolve().parents[2]


def _keys(payload):
    found = set()
    if isinstance(payload, dict):
        for key, value in payload.items():
            found.add(str(key))
            found |= _keys(value)
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            found |= _keys(item)
    return found


def _authors(rows):
    mapping = {}
    for index, row in enumerate(rows):
        mapping[str(row.get("slug"))] = f"author-{(index % 9) + 1}"
    return mapping


@pytest.fixture(scope="module")
def fixture_rows():
    return build_phase742_reference_cohorts(evaluated_at=NOW)


@pytest.fixture(scope="module")
def report(fixture_rows):
    return evaluate_production_corpus_shadow(
        fixture_rows,
        evaluated_at=NOW,
        source="ci_fixture",
        structural_root_count=len(fixture_rows),
        evaluated_eligible_count=len(fixture_rows),
        author_by_slug=_authors(fixture_rows),
        query_count=4,
        duration_ms=12.5,
        real_corpus_run=False,
    )


def test_read_only_source_has_no_writes():
    src = inspect.getsource(prod_mod)
    assert ".commit(" not in src
    assert "session.add" not in src
    assert "db.add" not in src
    assert "INSERT INTO" not in src
    assert "UPDATE " not in src
    assert "DELETE FROM" not in src
    assert "Never commits" in inspect.getsource(prod_mod.run_production_corpus_shadow_evaluation)
    cli_src = (
        Path(__file__).resolve().parents[1]
        / "scripts"
        / "evaluate_strong_curiosity_production_shadow.py"
    ).read_text(encoding="utf-8")
    assert "db.rollback()" in cli_src


def test_no_public_route():
    router_src = inspect.getsource(mirror_router)
    assert "evaluate_production_corpus_shadow" not in router_src
    assert "yansi_strong_curiosity_production_shadow" not in router_src
    assert "/strong-curiosity/production" not in router_src


def test_live_discover_does_not_import_evaluator():
    src = inspect.getsource(discover_mod)
    list_src = inspect.getsource(list_discover_mirrors)
    assert "yansi_strong_curiosity_production_shadow" not in src
    assert "evaluate_production_corpus_shadow" not in list_src
    assert "run_production_corpus_shadow_evaluation" not in list_src
    assert "yansi_strong_curiosity_staging_seed" not in src
    assert "seed_strong_curiosity" not in list_src


def test_no_score_fields(report):
    assert report["evaluatorVersion"] == EVALUATOR_VERSION
    keys = _keys(report)
    for token in (
        "score",
        "curiosityScore",
        "strongCuriosityScore",
        "rankScore",
        "qualityScore",
        "compositeScore",
    ):
        assert token not in keys


def test_no_eza_or_creator_popularity_inputs(report):
    assert report["independence"]["ezaInput"] == "ABSENT"
    assert report["independence"]["creatorPopularityInput"] == "ABSENT"
    assert report["independence"]["personalization"] == "ABSENT"
    assert report["privacy"]["ezaFieldsAbsent"] is True
    assert report["privacy"]["creatorPopularityFieldsAbsent"] is True
    keys = {key.lower() for key in _keys(report)}
    assert "followers" not in keys
    assert "relationshipmap" not in keys
    assert "assistantscore" not in keys


def test_no_private_ids_in_report(report):
    keys = {key.lower() for key in _keys(report)}
    for token in FORBIDDEN_PRIVACY_KEYS:
        assert token.lower() not in keys
    blob = str(report)
    assert "viewer_user_id" not in blob
    assert report["privacy"]["authorListsExported"] is False
    assert report["topK"]["10"]["authorConcentration"]["authorIdsExported"] is False


def test_deterministic_same_snapshot(fixture_rows):
    authors = _authors(fixture_rows)
    a = evaluate_production_corpus_shadow(
        fixture_rows,
        evaluated_at=NOW,
        source="ci_fixture",
        structural_root_count=40,
        author_by_slug=authors,
        real_corpus_run=False,
    )
    b = evaluate_production_corpus_shadow(
        list(reversed(fixture_rows)),
        evaluated_at=NOW,
        source="ci_fixture",
        structural_root_count=40,
        author_by_slug=authors,
        real_corpus_run=False,
    )
    assert [item["slug"] for item in a["topK"]["10"]["items"]] == [
        item["slug"] for item in b["topK"]["10"]["items"]
    ]
    assert a["foundationMovement"]["medianAbsDelta"] == b["foundationMovement"]["medianAbsDelta"]


def test_corpus_truncated_flag(fixture_rows):
    report = evaluate_production_corpus_shadow(
        fixture_rows,
        evaluated_at=NOW,
        source="ci_fixture",
        structural_root_count=15_000,
        evaluated_eligible_count=10_000,
        real_corpus_run=False,
        corpus_cap=MAX_DISCOVER_ELIGIBLE_LOAD,
    )
    assert report["corpus"]["capReached"] is True
    assert report["corpus"]["capStatus"] == "REACHED"
    assert report["corpus"]["corpusStatus"] == "CORPUS_TRUNCATED"
    assert report["corpus"]["truncatedOrdering"] == "slug_asc"


def test_topk_overlap_diagnostics(report):
    overlap = report["leaderboardOverlap"]
    assert overlap["rawStartedDesc"][20]["k"] == 20
    assert overlap["rawDirectChildrenDesc"][50]["k"] == 50
    assert overlap["newest"][20]["overlapShare"] is not None
    assert overlap["listsExportedPublicly"] is False


def test_author_concentration_diagnostics(report):
    conc = report["topK"]["10"]["authorConcentration"]
    assert conc["availability"] == "AVAILABLE"
    assert conc["distinctAuthorCount"] >= 1
    assert conc["maxYansisFromOneAuthor"] >= 1
    assert conc["authorIdsExported"] is False


def test_age_diagnostics(report):
    age = report["mix"]["ageDays"]
    assert age["count"] >= 1
    assert age["median"] is not None
    top_age = report["topK"]["10"]["age"]
    assert "shareOlderThanDays" in top_age
    assert "365" in top_age["shareOlderThanDays"]


def test_family_representation_diagnostics(report):
    family = report["topK"]["10"]["familyRepresentation"]
    assert "availableExternalGenerativity" in family
    assert "generativityOnly" in family
    assert "engagementOnly" in family
    assert family["availableExternalGenerativity"] >= 1


def test_popularity_dependence_diagnostics(report):
    dep = report["popularityDependence"]
    assert "publicStartedCount" in dep
    assert "rankingEligibleStartedCount" in dep
    assert "directChildYansiCount" in dep
    assert dep["rankingEligibleStartedCount"]["thresholdKind"] == "engineering_warning_not_quality"
    assert report["areas"]["rawPopularityResistance"] in {
        "PASS",
        "PARTIAL",
        "FAIL",
        "NOT PROVEN",
    }


def test_foundation_movement_diagnostics(report):
    movement = report["foundationMovement"]
    assert "medianAbsDelta" in movement
    assert "maxPositiveOrdinalDelta" in movement
    assert "movedAtLeast5" in movement
    assert movement["topKOverlap"]["10"]["overlapCount"] >= 1


def test_historical_diagnostics(report):
    assert report["corpus"]["historicalOnlyCount"] >= 1
    assert report["topK"]["10"]["historicalOnlyCount"] == 0
    assert report["areas"]["historicalFairness"] in {"PASS", "PARTIAL", "FAIL", "NOT PROVEN"}


def test_small_sample_diagnostics(report):
    assert "smallSampleCount" in report["topK"]["10"]
    assert "n1StartedCount" in report["topK"]["10"]
    assert "n2StartedCount" in report["topK"]["10"]
    assert report["areas"]["smallSampleSafety"] in {"PASS", "PARTIAL", "FAIL", "NOT PROVEN"}


def test_guest_unavailable_diagnostics(report):
    assert report["guestLimitation"]["guestUniqueHuman"] == "UNAVAILABLE"
    assert report["guestLimitation"]["fingerprinting"] is False
    assert report["areas"]["guestLimitation"] == "UNAVAILABLE"


def test_final_policy_unchanged():
    assert POLICY_VERSION == "strong_curiosity_final_shadow_v742"
    assert prod_mod.FROZEN_FINAL_POLICY_VERSION == POLICY_VERSION
    src = inspect.getsource(prod_mod.evaluate_production_corpus_shadow)
    assert "order_final_shadow_candidates" in src
    assert "representation_band =" not in inspect.getsource(prod_mod)
    final_src = inspect.getsource(final_mod._final_semantic_key)
    assert "-representation_band(row)" in final_src


def test_fixture_limited_live_is_no_go(report):
    assert report["realCorpusRun"] is False
    assert report["limitedLiveReady"] == "NO-GO"
    assert report["limitedLiveExperiment"] == "NO-GO"
    assert "production_corpus_not_evaluated" in report["blockerFindings"]


@pytest.mark.asyncio
async def test_rastlantisal_en_yeni_and_placeholder_unchanged():
    root = SimpleNamespace(
        slug="keep-me",
        parent_slug=None,
        visibility="public",
        safety_status="open",
        title="keep",
        description="",
        scene_image_url="https://cdn.example/a.png",
        public_payload={"publicTitle": "keep"},
        private_payload={},
        card_title="keep",
        published_at=NOW,
        created_at=NOW,
        journey_version=1,
        artifact_kind="journey_v1",
        freeze_status="frozen",
    )
    empty = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    db = AsyncMock()

    def _reset():
        db.execute = AsyncMock(
            side_effect=[
                SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: [root])),
                empty,
                empty,
            ]
        )

    async def boom(*_a, **_k):
        raise AssertionError("production evaluator must not run during Discover list")

    _reset()
    with (
        patch(
            "backend.services.mirror_network.discover.is_replay_ready_from_loaded_child",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.discover.is_public_discover_scene_url",
            return_value=True,
        ),
        patch(
            "backend.services.mirror_network.discover.evaluate_mirror_network_safety",
            return_value=SimpleNamespace(passed=True),
        ),
        patch(
            "backend.services.mirror_network.yansi_metrics.get_yansi_public_metrics_batch",
            new=AsyncMock(
                return_value={
                    ("keep-me", 1): {
                        "experienceStartedCount": 140,
                        "directChildYansiCount": 7,
                    }
                }
            ),
        ),
        patch(
            "backend.services.mirror_network.yansi_strong_curiosity_production_shadow.evaluate_production_corpus_shadow",
            new=boom,
        ),
    ):
        newest = await list_discover_mirrors(db, mode="newest", limit=10)
        _reset()
        random_a = await list_discover_mirrors(
            db, mode="random", limit=10, random_session="seed-stable-01"
        )
        _reset()
        random_b = await list_discover_mirrors(
            db, mode="random", limit=10, random_session="seed-stable-01"
        )
        with patch(
            "backend.services.mirror_network.yansi_strong_curiosity_live.is_strong_curiosity_discover_enabled",
            return_value=False,
        ):
            gm = await list_discover_mirrors(db, mode="strong_curiosity", limit=10)

    assert DEFAULT_DISCOVER_MODE == "random"
    assert [item.slug for item in newest.items] == ["keep-me"]
    assert [item.slug for item in random_a.items] == [item.slug for item in random_b.items]
    assert gm.items == []
    assert gm.total == 0
    assert gm.strongCuriosityReady is False
    dumped = DiscoverMirrorListResponse(items=[], total=0, mode="strong_curiosity").model_dump()
    assert "topK" not in dumped
    assert "orderedCandidates" not in dumped


def test_phase742_regression_still_orders():
    result = evaluate_strong_curiosity_final_shadow(evaluated_at=NOW)
    pos = {item["slug"]: item["ordinal"] for item in result["orderedCandidates"]}
    assert pos["smaller-external-generativity"] < pos["mass-popularity"]
    assert result["liveRanking"] is False
    assert set(SHADOW_STRATEGIES)


def test_phase74_cohorts_still_build():
    rows = build_phase74_reference_cohorts(evaluated_at=NOW)
    assert any(row["slug"] == "mass-popularity" for row in rows)


def test_copy_placeholder_unchanged():
    text = (
        EZA_V5 / "frontend" / "lib" / "eza" / "mirror-network" / "discoverCopy.ts"
    ).read_text(encoding="utf-8")
    assert "Güçlü Merak şu anda kullanılamıyor." in text


def test_markdown_and_artifact_roundtrip(report, tmp_path):
    markdown = render_human_markdown(report)
    assert "Do not commit" in markdown
    assert "Top 10" in markdown
    paths = write_internal_artifact(report, directory=tmp_path)
    assert Path(paths["json"]).exists()
    assert Path(paths["markdown"]).exists()


def test_evaluator_ignores_injected_eza(fixture_rows):
    injected = copy.deepcopy(fixture_rows)
    for row in injected:
        row["assistantScore"] = 99
        row["followers"] = 50_000
        row["relationshipMap"] = {"n": 1}
    left = [item["slug"] for item in order_final_shadow_candidates(fixture_rows)]
    right = [item["slug"] for item in order_final_shadow_candidates(injected)]
    assert left == right


def test_empty_corpus_is_not_proven():
    report = evaluate_production_corpus_shadow(
        [],
        evaluated_at=NOW,
        source="ci_fixture",
        structural_root_count=0,
        evaluated_eligible_count=0,
        real_corpus_run=True,
    )
    assert report["areas"]["rawPopularityResistance"] == "NOT PROVEN"
    assert report["areas"]["generativityRepresentation"] == "NOT PROVEN"
    assert report["areas"]["scopeSafety"] == "NOT PROVEN"
    assert report["limitedLiveReady"] == "NO-GO"
    assert "empty_discover_eligible_corpus" in report["blockerFindings"]


def test_missing_author_map_is_not_proven(fixture_rows):
    report = evaluate_production_corpus_shadow(
        fixture_rows,
        evaluated_at=NOW,
        source="ci_fixture",
        real_corpus_run=False,
    )
    assert report["topK"]["10"]["authorConcentration"]["availability"] == "UNAVAILABLE"
    assert report["areas"]["authorConcentration"] == "NOT PROVEN"
