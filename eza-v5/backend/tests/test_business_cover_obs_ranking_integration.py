"""Phase 7G-4c.2: bind_media_plan observation-assisted cover ranking integration.

Uses the shared in-memory SQLite ``sample`` fixture (same stack as cover-selection
and observation-lookup tests). Not PostgreSQL-backed. Feature flags stay off
unless a test enables ranking temporarily. Generation remains independent/off.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import event

from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import cover_ranking_adapter as adapter
from backend.services.business_yansi import media_observations as observe
from backend.services.business_yansi import observation_rank as rank
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.media_observations import content_sha_from_locator
from backend.tests.test_business_video_cover_policy import _confirm, asset_dir, sample
from backend.tests.test_business_yansi import source

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
_BACKEND = Path(__file__).resolve().parents[1]


def _digest(asset) -> str:
    found = content_sha_from_locator(asset.locator)
    assert found is not None
    return found


def _steps(knowledge, phrase):
    return [
        {"question": f"{phrase} nedir?", "answer": knowledge.content, "sources": [str(knowledge.id)]}
        for _ in range(8)
    ]


async def _image(sample, knowledge, title: str, payload: bytes):
    row = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": title, "caption": "", "public_allowed": True},
        image_bytes=_PNG + payload,
    )
    return await _confirm(sample, knowledge, row)


def _ready_obs(sample, asset, *, summary="Zeytinyagi hasadi ozeti", tags=None, content_sha256=None, profile=None, business_id=None):
    return Observation(
        id=uuid.uuid4(),
        business_id=business_id or sample.business.id,
        asset_id=asset.id,
        content_sha256=content_sha256 or _digest(asset),
        analyzer_profile=profile or observe.PROFILE,
        idempotency_key=uuid.uuid4().hex + uuid.uuid4().hex[:32],
        status="ready",
        attempts=1,
        max_attempts=3,
        origin="upload",
        created_by=sample.editor.id,
        summary=summary,
        tags=tags if tags is not None else ["zeytinyagi", "hasadi", "ozeti"],
        visible_text=None,
        provider_model="configured-vision",
        input_tokens=10,
        output_tokens=4,
    )


def _listen_sql(sample):
    statements: list[str] = []
    engine = sample.db.bind.sync_engine

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", before_cursor_execute)
    return statements, lambda: event.remove(engine, "before_cursor_execute", before_cursor_execute)


@pytest.fixture(autouse=True)
def _flags_default_off(monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_OBSERVATION_PROFILE", raising=False)


def test_integration_module_keeps_generation_and_ranking_flags_off_by_default():
    assert observe.enabled() is False
    assert rank.ranking_enabled() is False
    text = (_BACKEND / "services/business_yansi/studio_media.py").read_text(encoding="utf-8")
    assert "build_cover_ranking_inputs" in text
    assert "ensure_observation" not in text.lower()


async def test_flag_off_matches_legacy_select_cover_and_skips_adapter(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    weak = await _image(sample, knowledge, "Atolye", b"flag-off-weak")
    strong = await _image(sample, knowledge, "Zeytinyagi hasadi", b"flag-off-strong")
    sample.db.add(_ready_obs(sample, weak, summary="Zeytinyagi hasadi ozeti kayit"))
    await sample.db.commit()

    adapter_spy = AsyncMock(side_effect=AssertionError("adapter must not run when ranking flag is off"))
    monkeypatch.setattr(
        "backend.services.business_yansi.cover_ranking_adapter.build_cover_ranking_inputs",
        adapter_spy,
    )

    steps = _steps(knowledge, "Zeytinyagi hasadi")
    legacy = media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [weak, strong], steps)
    plan = await media.bind_media_plan(
        sample.db, sample.business.id, "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert plan["coverMode"] == "automatic"
    assert plan["coverAssetId"] == legacy == str(strong.id)
    assert draft.media_plan["coverAssetId"] == str(strong.id)
    assert adapter_spy.await_count == 0


async def test_flag_on_valid_direct_observation_can_reorder_automatic_cover(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    lexical = await _image(sample, knowledge, "Zeytinyagi", b"on-direct-lex")
    studio = await _image(sample, knowledge, "Atolye", b"on-direct-obs")
    sample.db.add(_ready_obs(
        sample, studio,
        summary="Zeytinyagi hasadi ozeti kayit",
        tags=["zeytinyagi", "hasadi", "ozeti"],
    ))
    await sample.db.commit()
    steps = _steps(knowledge, "Zeytinyagi hasadi")
    assert media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [lexical, studio], steps) == str(lexical.id)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert draft.media_plan["coverMode"] == "automatic"
    assert draft.media_plan["coverAssetId"] == str(studio.id)


async def test_flag_on_valid_inherited_observation_can_reorder(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    lexical = await _image(sample, knowledge, "Zeytinyagi", b"on-inh-lex")
    payload = _PNG + b"on-inh-shared"
    # Source stays off the eligible cover pool (not knowledge-linked).
    original = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "AtolyeKaynak", "caption": "", "public_allowed": True},
        image_bytes=payload,
    )
    digest = _digest(original)
    sample.db.add(_ready_obs(
        sample, original,
        summary="Zeytinyagi hasadi ozeti kayit",
        tags=["zeytinyagi", "hasadi", "ozeti"],
    ))
    await sample.db.commit()
    # Same bytes → identical digest; then mark original→derivative lineage.
    derivative = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Atolye", "caption": "", "public_allowed": True},
        image_bytes=payload,
    )
    derivative.source_asset_id = original.id
    await sample.db.commit()
    derivative = await _confirm(sample, knowledge, derivative)
    assert _digest(derivative) == digest
    assert derivative.source_asset_id == original.id

    steps = _steps(knowledge, "Zeytinyagi hasadi")
    legacy = media.select_cover(
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [lexical, derivative], steps,
    )
    assert legacy == str(lexical.id)

    plan = await media.bind_media_plan(
        sample.db, sample.business.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert plan["coverMode"] == "automatic"
    assert plan["coverAssetId"] == str(derivative.id)
    assert plan["coverAssetId"] != str(original.id)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert draft.media_plan["coverAssetId"] == str(derivative.id)


async def test_flag_on_missing_observation_falls_back_to_lexical(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    weak = await _image(sample, knowledge, "Atolye", b"miss-weak")
    strong = await _image(sample, knowledge, "Zeytinyagi hasadi", b"miss-strong")
    await sample.db.commit()
    steps = _steps(knowledge, "Zeytinyagi hasadi")
    legacy = media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [weak, strong], steps)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert draft.media_plan["coverAssetId"] == legacy == str(strong.id)


async def test_flag_on_stale_and_wrong_tenant_observation_gives_no_bonus(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    lexical = await _image(sample, knowledge, "Zeytinyagi hasadi", b"stale-lex")
    studio = await _image(sample, knowledge, "Atolye", b"stale-obs")
    sample.db.add(_ready_obs(sample, studio, content_sha256="f" * 64, summary="Zeytinyagi hasadi ozeti"))
    await sample.db.commit()
    steps = _steps(knowledge, "Zeytinyagi hasadi")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert draft.media_plan["coverAssetId"] == str(lexical.id)

    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id),
        "slug": "obs-tenant", "name": "ObsTenant",
    })
    foreign = await library.create_asset(
        sample.db, other.id, sample.outsider.id,
        {"asset_type": "image", "title": "Atolye", "caption": "", "public_allowed": True},
        image_bytes=_PNG + b"foreign-obs",
    )
    # Observation for local studio with foreign business id must not boost.
    sample.db.add(_ready_obs(
        sample, studio, business_id=other.id, summary="Zeytinyagi hasadi ozeti",
        tags=["zeytinyagi", "hasadi", "ozeti"],
    ))
    await sample.db.commit()
    again = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert again.media_plan["coverAssetId"] == str(lexical.id)
    assert foreign.business_id == other.id


async def test_flag_on_ineligible_observed_asset_never_selected(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    eligible = await _image(sample, knowledge, "Zeytinyagi hasadi", b"elig-ok")
    # Unlinked / not public-confirmed asset with a ready observation.
    orphan = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Atolye", "caption": "", "public_allowed": True},
        image_bytes=_PNG + b"orphan-obs",
    )
    sample.db.add(_ready_obs(
        sample, orphan,
        summary="Zeytinyagi hasadi ozeti kayit",
        tags=["zeytinyagi", "hasadi", "ozeti"],
    ))
    await sample.db.commit()
    steps = _steps(knowledge, "Zeytinyagi hasadi")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert draft.media_plan["coverAssetId"] == str(eligible.id)
    assert draft.media_plan["coverAssetId"] != str(orphan.id)


async def test_explicit_cover_skips_adapter_and_assisted_ranking(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    matching = await _image(sample, knowledge, "Zeytinyagi hasadi", b"explicit-match")
    lamp = await _image(sample, knowledge, "Lamba isigi", b"explicit-lamp")
    sample.db.add(_ready_obs(
        sample, matching,
        summary="Zeytinyagi hasadi ozeti kayit",
        tags=["zeytinyagi", "hasadi", "ozeti"],
    ))
    await sample.db.commit()
    spy = AsyncMock(side_effect=AssertionError("explicit cover must not call adapter"))
    monkeypatch.setattr(
        "backend.services.business_yansi.cover_ranking_adapter.build_cover_ranking_inputs",
        spy,
    )
    steps = _steps(knowledge, "Zeytinyagi hasadi")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps, cover_asset_id=lamp.id,
    )
    assert draft.media_plan["coverMode"] == "explicit"
    assert draft.media_plan["coverAssetId"] == str(lamp.id)
    assert spy.await_count == 0

    revised = await svc.revise_draft(
        sample.db, sample.business.id, sample.editor.id, draft.id, draft.revision,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps, cover_specified=False,
    )
    assert revised.media_plan["coverMode"] == "explicit"
    assert revised.media_plan["coverAssetId"] == str(lamp.id)
    assert spy.await_count == 0


async def test_deterministic_tie_break_unchanged_with_flag_on(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    later = await _image(sample, knowledge, "Zeytinyagi", b"tie-later")
    earlier = await _image(sample, knowledge, "Zeytinyagi", b"tie-earlier")
    # Force lexicographically earlier id if needed by using known titles only;
    # select_cover / select_cover_ranked both sort by -score, -lexical, str(id).
    steps = _steps(knowledge, "Zeytinyagi")
    legacy = media.select_cover("Zeytinyagi", "", [later, earlier], steps)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi", "Zeytinyagi ozeti", steps,
    )
    assert draft.media_plan["coverAssetId"] == legacy
    assert draft.media_plan["coverAssetId"] == min(str(later.id), str(earlier.id))


async def test_approved_seal_and_cover_immutable_under_ranking_flag(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    cover = await _image(sample, knowledge, "Zeytinyagi hasadi", b"seal-cover")
    steps = _steps(knowledge, "Zeytinyagi hasadi")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert draft.media_plan["coverAssetId"] == str(cover.id)
    draft = await svc.transition_draft(
        sample.db, sample.business.id, sample.editor.id, draft.id, "review", draft.revision,
    )
    draft = await svc.transition_draft(
        sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision,
    )
    sealed = draft.media_plan["seal"]
    held = draft.media_plan["coverAssetId"]
    assert sealed == media.media_seal(draft.media_plan)
    assert "coverMode" not in draft.media_plan

    rival = await _image(sample, knowledge, "Atolye", b"seal-rival")
    sample.db.add(_ready_obs(
        sample, rival,
        summary="Zeytinyagi hasadi ozeti kayit",
        tags=["zeytinyagi", "hasadi", "ozeti"],
    ))
    await sample.db.commit()
    await sample.db.refresh(draft)
    assert draft.media_plan["seal"] == sealed
    assert draft.media_plan["coverAssetId"] == held


async def test_flag_on_no_provider_queue_or_observation_dml(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await _image(sample, knowledge, "Zeytinyagi hasadi", b"no-dml")
    sample.db.add(_ready_obs(sample, asset))
    await sample.db.commit()

    vision = AsyncMock()
    ensure = AsyncMock()
    monkeypatch.setattr("backend.services.business_yansi.image_observe.call_vision", vision, raising=False)
    monkeypatch.setattr("backend.services.business_yansi.image_observe.analyze_image", vision, raising=False)
    monkeypatch.setattr("backend.services.business_yansi.media_observations.ensure_observation", ensure, raising=False)

    statements, stop = _listen_sql(sample)
    try:
        draft = await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge, "Zeytinyagi hasadi"),
        )
    finally:
        stop()

    assert draft.media_plan["coverAssetId"] == str(asset.id)
    assert vision.await_count == 0 and vision.call_count == 0
    assert ensure.await_count == 0 and ensure.call_count == 0
    # Ranking path may SELECT; it must not INSERT/UPDATE/DELETE observation rows.
    obs_dml = [
        sql for sql in statements
        if "business_media_observation" in sql.lower()
        and sql.lstrip().split(None, 1)[0].upper() in {"INSERT", "UPDATE", "DELETE"}
    ]
    assert obs_dml == []


async def test_adapter_database_errors_propagate_from_bind_media_plan(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"db-boom")
    await sample.db.commit()

    async def boom(*args, **kwargs):
        raise RuntimeError("simulated_ranking_db_failure")

    monkeypatch.setattr(
        "backend.services.business_yansi.cover_ranking_adapter.build_cover_ranking_inputs",
        boom,
    )
    with pytest.raises(RuntimeError, match="simulated_ranking_db_failure"):
        await media.bind_media_plan(
            sample.db, sample.business.id,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge, "Zeytinyagi hasadi"),
        )
