"""Phase 7G-4c.1: trusted read-only cover ranking adapter.

Uses the shared in-memory SQLite ``sample`` fixture (same stack as 7G-4a lookup
tests). These are real DB reads against committed rows — not mocked lookup
results — unless a test explicitly stubs a provider. Live cover selection is
not wired. Feature flags stay off.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import event

from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import cover_ranking_adapter as adapter
from backend.services.business_yansi import media_observations as observe
from backend.services.business_yansi import observation_rank as rank
from backend.services.business_yansi.media_observations import content_sha_from_locator
from backend.tests.test_business_video_cover_policy import _confirm, asset_dir, sample
from backend.tests.test_business_yansi import source

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
_BACKEND = Path(__file__).resolve().parents[1]


def _digest(asset) -> str:
    found = content_sha_from_locator(asset.locator)
    assert found is not None
    return found


def _key(asset_or_id) -> str:
    raw = getattr(asset_or_id, "id", asset_or_id)
    return str(raw)


async def _image(sample, title: str, payload: bytes):
    knowledge = await source(sample, content="Atolye kayit metni kapak secimi icin yeterince aciktir.")
    row = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": title, "caption": "", "public_allowed": True},
        image_bytes=_PNG + payload,
    )
    return await _confirm(sample, knowledge, row)


def _ready(sample, asset, *, status="ready", profile=None, content_sha256=None, business_id=None, asset_id=None, summary=None, tags=None):
    digest = content_sha256 or _digest(asset)
    return Observation(
        id=uuid.uuid4(),
        business_id=business_id or sample.business.id,
        asset_id=asset_id or asset.id,
        content_sha256=digest,
        analyzer_profile=profile or observe.PROFILE,
        idempotency_key=uuid.uuid4().hex + uuid.uuid4().hex[:32],
        status=status,
        attempts=1 if status == "ready" else 0,
        max_attempts=3,
        origin="upload",
        created_by=sample.editor.id,
        summary=summary or "Zeytinyagi hasadi ozeti",
        tags=tags if tags is not None else ["zeytinyagi", "hasadi"],
        visible_text=None,
        provider_model="configured-vision",
        input_tokens=10,
        output_tokens=4,
    )


def _storage_image(sample, *, title: str, digest: str, source_asset_id=None, business_id=None):
    owner = business_id or sample.business.id
    return BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=owner,
        asset_type="image",
        title=title,
        caption="",
        locator_kind="storage",
        locator=f"brand-assets/{owner}/{digest}.png",
        public_allowed=False,
        status="draft",
        created_by=sample.editor.id,
        source_asset_id=source_asset_id,
    )


def _listen_sql(sample):
    statements: list[str] = []
    engine = sample.db.bind.sync_engine

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", before_cursor_execute)
    return statements, lambda: event.remove(engine, "before_cursor_execute", before_cursor_execute)


@pytest.fixture(autouse=True)
def _flags_off(monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_OBSERVATION_PROFILE", raising=False)


def test_adapter_module_is_read_only_surface():
    text = (_BACKEND / "services/business_yansi/cover_ranking_adapter.py").read_text(encoding="utf-8").lower()
    for banned in (
        "openai", "httpx", "urlopen", "aiohttp", "call_vision", "ensure_observation",
        "analyze_image", "analyze_video", "populate_existing", "refresh(",
        "db.add", "db.commit", "db.flush", "db.delete",
    ):
        assert banned not in text
    assert "bind_media_plan" not in text
    assert "ensure_observation" not in text
    assert observe.enabled() is False
    assert rank.ranking_enabled() is False


async def test_valid_direct_observation(sample, asset_dir):
    asset = await _image(sample, "Atolye", b"direct-ok")
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [asset],
    )
    key = str(asset.id)
    assert key in observations and key in provenances
    facts = provenances[key]
    assert facts.asset_id == asset.id
    assert facts.business_id == sample.business.id
    assert facts.content_sha256 == _digest(asset)
    assert facts.source_source_asset_id is rank._UNSET
    assert observations[key].asset_id == asset.id
    assert observations[key].status == "ready"


async def test_valid_original_to_derivative_inheritance(sample, asset_dir):
    source_asset = await _image(sample, "Orijinal", b"inherit-ok")
    digest = _digest(source_asset)
    sample.db.add(_ready(sample, source_asset, summary="orijinal gozlem"))
    await sample.db.commit()
    derivative = _storage_image(
        sample, title="Turev", digest=digest, source_asset_id=source_asset.id,
    )
    derivative.locator = source_asset.locator
    sample.db.add(derivative)
    await sample.db.commit()

    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [derivative],
    )
    key = str(derivative.id)
    assert key in observations and key in provenances
    facts = provenances[key]
    assert facts.asset_id == derivative.id
    assert facts.source_asset_id == source_asset.id
    assert facts.source_content_sha256 == digest
    assert facts.source_source_asset_id is None
    assert facts.source_source_asset_id is not rank._UNSET
    assert observations[key].asset_id == source_asset.id


async def test_wrong_tenant_candidate_omitted(sample, asset_dir):
    asset = await _image(sample, "Yerel", b"wrong-tenant")
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    foreign = uuid.uuid4()
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, foreign, [asset],
    )
    assert observations == {} and provenances == {}


async def test_wrong_tenant_source_keeps_unset_parent(sample, asset_dir):
    digest = "a" * 64
    foreign_source_id = uuid.uuid4()
    # Tenant-scoped source projection cannot see a cross-tenant / foreign id.
    local = _storage_image(
        sample, title="LocalDeriv", digest=digest, source_asset_id=foreign_source_id,
    )
    sample.db.add(local)
    await sample.db.commit()

    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [local],
    )
    assert _key(local) in provenances
    assert provenances[_key(local)].source_asset_id == foreign_source_id
    assert provenances[_key(local)].source_source_asset_id is rank._UNSET
    assert provenances[_key(local)].source_content_sha256 is None
    assert _key(local) not in observations


async def test_missing_candidate_omitted(sample, asset_dir):
    missing = SimpleNamespace(id=uuid.uuid4())
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [missing],
    )
    assert observations == {} and provenances == {}


async def test_missing_source_keeps_unset_parent(sample, asset_dir):
    digest = "b" * 64
    orphan = _storage_image(sample, title="Yetim", digest=digest, source_asset_id=uuid.uuid4())
    sample.db.add(orphan)
    await sample.db.commit()
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [orphan],
    )
    assert _key(orphan) in provenances
    assert provenances[_key(orphan)].source_source_asset_id is rank._UNSET
    assert provenances[_key(orphan)].source_content_sha256 is None
    assert _key(orphan) not in observations


async def test_stale_candidate_digest_omits_observation(sample, asset_dir):
    asset = await _image(sample, "Eski", b"stale-cand")
    sample.db.add(_ready(sample, asset, content_sha256="f" * 64))
    await sample.db.commit()
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [asset],
    )
    assert _key(asset) in provenances
    assert provenances[_key(asset)].content_sha256 == _digest(asset)
    assert _key(asset) not in observations


async def test_stale_source_digest_blocks_inheritance(sample, asset_dir):
    source_asset = await _image(sample, "Kaynak", b"stale-src")
    sample.db.add(_ready(sample, source_asset))
    await sample.db.commit()
    other = "c" * 64
    derivative = _storage_image(
        sample, title="TurevEski", digest=other, source_asset_id=source_asset.id,
    )
    sample.db.add(derivative)
    await sample.db.commit()
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [derivative],
    )
    assert _key(derivative) in provenances
    facts = provenances[_key(derivative)]
    # Source loaded with different digest than candidate → both digests recorded;
    # ready_observation refuses inheritance; ranking would also reject mismatch.
    assert facts.source_asset_id == source_asset.id
    assert facts.source_content_sha256 == _digest(source_asset)
    assert facts.content_sha256 == other
    assert facts.source_source_asset_id is None
    assert _key(derivative) not in observations


async def test_invalid_locator_omits_candidate(sample, asset_dir):
    asset = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="image",
        title="Url",
        caption="",
        locator_kind="https",
        locator="https://example.com/x.png",
        public_allowed=False,
        status="draft",
        created_by=sample.editor.id,
    )
    sample.db.add(asset)
    await sample.db.commit()
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [asset],
    )
    assert observations == {} and provenances == {}


async def test_wrong_observation_profile_omits_observation(sample, asset_dir, monkeypatch):
    asset = await _image(sample, "Profil", b"profile-miss")
    sample.db.add(_ready(sample, asset, profile="visual-v1"))
    await sample.db.commit()
    monkeypatch.setenv("BILIGN_BUSINESS_OBSERVATION_PROFILE", "visual-v2")
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [asset],
    )
    assert _key(asset) in provenances
    assert _key(asset) not in observations


async def test_unknown_source_parent_relationship_is_unset(sample, asset_dir):
    digest = "d" * 64
    # Source exists but has an unusable locator → parent stays _UNSET.
    source = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="image",
        title="BadSrc",
        caption="",
        locator_kind="https",
        locator="https://example.com/src.png",
        public_allowed=False,
        status="draft",
        created_by=sample.editor.id,
        source_asset_id=None,
    )
    derivative = _storage_image(
        sample, title="DerivBadSrc", digest=digest, source_asset_id=source.id,
    )
    sample.db.add_all([source, derivative])
    await sample.db.commit()
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [derivative],
    )
    assert _key(derivative) in provenances
    assert provenances[_key(derivative)].source_asset_id == source.id
    assert provenances[_key(derivative)].source_source_asset_id is rank._UNSET
    assert provenances[_key(derivative)].source_content_sha256 is None
    assert _key(derivative) not in observations


async def test_source_is_derivative_sets_non_none_parent(sample, asset_dir):
    digest = "e" * 64
    original = _storage_image(sample, title="Root", digest=digest)
    mid = _storage_image(sample, title="Mid", digest=digest, source_asset_id=None)
    sample.db.add_all([original, mid])
    await sample.db.flush()
    mid.source_asset_id = original.id
    mid.locator = original.locator
    leaf = _storage_image(sample, title="Leaf", digest=digest, source_asset_id=mid.id)
    leaf.locator = original.locator
    sample.db.add(leaf)
    sample.db.add(_ready(sample, original, content_sha256=digest, asset_id=original.id))
    await sample.db.commit()

    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [leaf],
    )
    assert _key(leaf) in provenances
    facts = provenances[_key(leaf)]
    assert facts.source_asset_id == mid.id
    assert facts.source_source_asset_id == original.id
    assert facts.source_source_asset_id is not None
    assert _key(leaf) not in observations  # ready_observation rejects non-original source


async def test_no_observation_still_emits_facts(sample, asset_dir):
    asset = await _image(sample, "Bos", b"no-obs")
    await sample.db.commit()
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [asset],
    )
    assert _key(asset) in provenances
    assert _key(asset) not in observations


async def test_candidate_facts_mapping_consistency(sample, asset_dir):
    first = await _image(sample, "Bir", b"map-1")
    second = await _image(sample, "Iki", b"map-2")
    sample.db.add(_ready(sample, first, summary="bir ozet", tags=["zeytinyagi", "hasadi"]))
    sample.db.add(_ready(sample, second, summary="iki ozet", tags=["lamba", "isigi"]))
    await sample.db.commit()
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [first, second],
    )
    # One canonical string key per candidate (ranker resolves via str(asset.id)).
    assert set(provenances) == {_key(first), _key(second)}
    assert set(observations) == {_key(first), _key(second)}
    assert provenances[_key(first)].asset_id == first.id
    assert provenances[_key(second)].asset_id == second.id
    assert observations[_key(first)].asset_id == first.id
    assert observations[_key(second)].asset_id == second.id
    assert provenances[_key(first)].content_sha256 == _digest(first)
    assert provenances[_key(second)].content_sha256 == _digest(second)


async def test_no_provider_queue_or_generation_calls(sample, asset_dir, monkeypatch):
    asset = await _image(sample, "Saglam", b"no-provider")
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    vision = AsyncMock()
    ensure = AsyncMock()
    monkeypatch.setattr("backend.services.business_yansi.image_observe.call_vision", vision, raising=False)
    monkeypatch.setattr("backend.services.business_yansi.image_observe.analyze_image", vision, raising=False)
    monkeypatch.setattr("backend.services.business_yansi.media_observations.ensure_observation", ensure, raising=False)
    await adapter.build_cover_ranking_inputs(sample.db, sample.business.id, [asset])
    assert vision.await_count == 0 and vision.call_count == 0
    assert ensure.await_count == 0 and ensure.call_count == 0


async def test_no_sql_dml_or_caller_orm_mutation(sample, asset_dir):
    asset = await _image(sample, "Dokunma", b"no-dml")
    row = _ready(sample, asset, summary="kalici")
    sample.db.add(row)
    await sample.db.commit()
    asset.title = "PendingTitle"
    row.summary = "PendingSummary"
    statements, stop = _listen_sql(sample)
    try:
        observations, provenances = await adapter.build_cover_ranking_inputs(
            sample.db, sample.business.id, [asset],
        )
    finally:
        stop()
    assert _key(asset) in provenances and _key(asset) in observations
    assert asset.title == "PendingTitle"
    assert row.summary == "PendingSummary"
    dml = [sql for sql in statements if sql.lstrip().split(None, 1)[0].upper() in {"INSERT", "UPDATE", "DELETE"}]
    assert dml == []
    await sample.db.refresh(row)
    assert row.summary == "kalici"


async def test_adapter_outputs_drive_pure_ranking_helper(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    weak = await _image(sample, "Zeytinyagi", b"rank-weak")
    strong = await _image(sample, "Atolye", b"rank-strong")
    sample.db.add(_ready(
        sample, strong,
        summary="Zeytinyagi hasadi ozeti kayit",
        tags=["zeytinyagi", "hasadi", "ozeti"],
    ))
    await sample.db.commit()
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [weak, strong],
    )
    chosen = rank.select_cover_ranked(
        "Zeytinyagi hasadi",
        "Zeytinyagi hasadi ozeti",
        [weak, strong],
        observations=observations,
        provenances=provenances,
    )
    assert chosen == str(strong.id)


async def test_invalid_provenance_falls_back_in_ranking_helper(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    lexical = await _image(sample, "Zeytinyagi hasadi", b"lex-win")
    weak = await _image(sample, "Atolye", b"lex-weak")
    sample.db.add(_ready(sample, weak, summary="Zeytinyagi hasadi ozeti", tags=["zeytinyagi", "hasadi"]))
    await sample.db.commit()
    # Wrong-tenant adapter call → empty maps → lexical ranking wins.
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, uuid.uuid4(), [weak, lexical],
    )
    assert observations == {} and provenances == {}
    chosen = rank.select_cover_ranked(
        "Zeytinyagi hasadi",
        "Zeytinyagi hasadi ozeti",
        [weak, lexical],
        observations=observations,
        provenances=provenances,
    )
    assert chosen == str(lexical.id)


async def test_malformed_candidate_ids_are_skipped(sample, asset_dir):
    asset = await _image(sample, "Saglam", b"id-ok")
    sample.db.add(_ready(sample, asset, summary="Zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"]))
    await sample.db.commit()
    bad_string = SimpleNamespace(id="not-a-uuid", title="Bad", asset_type="image", caption="")
    bad_object = SimpleNamespace(id=object(), title="Obj", asset_type="image", caption="")
    bad_none = SimpleNamespace(id=None, title="None", asset_type="image", caption="")
    bad_empty = SimpleNamespace(id="", title="Empty", asset_type="image", caption="")

    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [bad_string, bad_object, bad_none, bad_empty, asset],
    )
    assert _key(asset) in provenances and _key(asset) in observations
    assert "not-a-uuid" not in provenances
    assert None not in provenances
    assert "" not in provenances
    # Malformed entries must not raise StatementError or wipe valid mappings.
    assert provenances[_key(asset)].asset_id == asset.id
    assert set(provenances.keys()) == {_key(asset)}


async def test_empty_string_candidate_id_is_skipped(sample, asset_dir):
    asset = await _image(sample, "EmptySkip", b"empty-id")
    sample.db.add(_ready(sample, asset, summary="Zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"]))
    await sample.db.commit()
    empty = SimpleNamespace(id="", title="Empty", asset_type="image", caption="")
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [empty, asset],
    )
    assert set(provenances) == {_key(asset)}
    assert set(observations) == {_key(asset)}
    assert "" not in provenances


async def test_valid_uuid_object_and_string_ids(sample, asset_dir):
    asset = await _image(sample, "UuidForms", b"uuid-forms")
    sample.db.add(_ready(sample, asset, summary="Zeytinyagi hasadi", tags=["zeytinyagi", "hasadi"]))
    await sample.db.commit()
    as_uuid = SimpleNamespace(id=asset.id)
    as_string = SimpleNamespace(id=str(asset.id))

    obs_u, prov_u = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [as_uuid],
    )
    obs_s, prov_s = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [as_string],
    )
    assert set(prov_u) == {_key(asset)} and set(prov_s) == {_key(asset)}
    assert set(obs_u) == {_key(asset)} and set(obs_s) == {_key(asset)}
    assert prov_u[_key(asset)].content_sha256 == prov_s[_key(asset)].content_sha256 == _digest(asset)


async def test_mixed_invalid_pool_preserves_valid_ranking_bonus(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    weak = await _image(sample, "Zeytinyagi", b"mix-weak")
    strong = await _image(sample, "Atolye", b"mix-strong")
    sample.db.add(_ready(
        sample, strong,
        summary="Zeytinyagi hasadi ozeti kayit",
        tags=["zeytinyagi", "hasadi", "ozeti"],
    ))
    await sample.db.commit()
    pool = [
        SimpleNamespace(id="not-a-uuid", title="Bad", asset_type="image", caption=""),
        SimpleNamespace(id=object(), title="Obj", asset_type="image", caption=""),
        weak,
        strong,
        SimpleNamespace(id=None, title="None", asset_type="image", caption=""),
    ]
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, pool,
    )
    assert _key(strong) in observations and _key(strong) in provenances
    # Ranker pool still includes invalid stubs; they contribute no obs bonus and
    # typically zero lexical score — must not suppress the valid assisted winner.
    chosen = rank.select_cover_ranked(
        "Zeytinyagi hasadi",
        "Zeytinyagi hasadi ozeti",
        pool,
        observations=observations,
        provenances=provenances,
    )
    assert chosen == str(strong.id)


async def test_string_id_stub_resolves_via_ranker_key_compatibility(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    asset = await _image(sample, "Atolye", b"str-key")
    sample.db.add(_ready(
        sample, asset,
        summary="Zeytinyagi hasadi ozeti",
        tags=["zeytinyagi", "hasadi"],
    ))
    await sample.db.commit()
    string_stub = SimpleNamespace(
        id=str(asset.id),
        asset_type="image",
        title="Atolye",
        caption="",
        verified_duration=8_000,
        verified_timescale=1000,
        verified_size_bytes=200,
        verified_has_audio=False,
    )
    observations, provenances = await adapter.build_cover_ranking_inputs(
        sample.db, sample.business.id, [string_stub],
    )
    assert set(provenances) == {_key(asset)}
    chosen = rank.select_cover_ranked(
        "Zeytinyagi hasadi",
        "Zeytinyagi hasadi ozeti",
        [string_stub],
        observations=observations,
        provenances=provenances,
    )
    assert chosen == str(asset.id)
