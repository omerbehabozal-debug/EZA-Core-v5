"""Phase 7G-4a: read-only observation lookup and integrity checks.

Scoring and ranking are not wired. Generation stays disabled by default.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import event, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import media_observations as observe
from backend.services.business_yansi import observation_lookup as lookup
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.media_observations import content_sha_from_locator
from backend.tests.brand_library_image_fixtures import distinct_library_png
from backend.tests.test_business_video_cover_policy import _confirm, asset_dir, sample
from backend.tests.test_business_yansi import source

_BACKEND = Path(__file__).resolve().parents[1]


def _digest(asset) -> str:
    found = content_sha_from_locator(asset.locator)
    assert found is not None
    return found


def _second_session(sample):
    return async_sessionmaker(sample.db.bind, expire_on_commit=False)()


async def _image(sample, title: str, payload: bytes):
    knowledge = await source(sample, content="Atolye kayit metni kapak secimi icin yeterince aciktir.")
    row = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": title, "caption": "", "public_allowed": True},
        image_bytes=distinct_library_png(payload),
    )
    return await _confirm(sample, knowledge, row)


def _ready(sample, asset, *, status="ready", profile=None, content_sha256=None, business_id=None, asset_id=None, summary=None):
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
        tags=["zeytinyagi", "hasadi"],
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
def _keep_generation_off(monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", raising=False)


def test_lookup_module_has_no_provider_surface():
    text = (_BACKEND / "services/business_yansi/observation_lookup.py").read_text(encoding="utf-8").lower()
    for banned in (
        "openai", "httpx", "urlopen", "aiohttp", "https://", "vision_model", "call_vision",
        "populate_existing", "refresh(", "current_asset", "ensure_observation", "select_cover",
    ):
        assert banned not in text
    assert observe.enabled() is False


async def test_valid_ready_observation(sample, asset_dir):
    asset = await _image(sample, "Zeytinyagi", b"valid")
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    found = await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset)
    assert found is not None
    assert isinstance(found, lookup.ObservationSnapshot)
    assert found.status == "ready"
    assert found.asset_id == asset.id
    assert found.content_sha256 == _digest(asset)
    assert found.summary == "Zeytinyagi hasadi ozeti"
    assert found.tags == ("zeytinyagi", "hasadi")
    assert found.frames == ()


async def test_missing_observation_returns_none(sample, asset_dir):
    asset = await _image(sample, "Bos", b"missing")
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset) is None


async def test_pending_and_failed_observations_are_ignored(sample, asset_dir):
    queued_asset = await _image(sample, "Bekleyen", b"pending")
    sample.db.add(_ready(sample, queued_asset, status="queued"))
    failed = await _image(sample, "Basarisiz", b"failed")
    sample.db.add(_ready(sample, failed, status="failed"))
    running = await _image(sample, "Calisan", b"running")
    sample.db.add(_ready(sample, running, status="running"))
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, queued_asset) is None
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, failed) is None
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, running) is None


async def test_stale_content_hash_is_rejected(sample, asset_dir):
    asset = await _image(sample, "Eski", b"stale")
    sample.db.add(_ready(sample, asset, content_sha256="f" * 64))
    await sample.db.commit()
    assert _digest(asset) != "f" * 64
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset) is None
    stale = await sample.db.scalar(select(Observation).where(Observation.asset_id == asset.id))
    assert lookup.observation_integrity_ok(stale, asset, sample.business.id) is False


async def test_cross_brand_observation_is_ignored(sample, asset_dir):
    asset = await _image(sample, "Marka", b"cross")
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    foreign = uuid.uuid4()
    assert await lookup.ready_observation_for_asset(sample.db, foreign, asset) is None
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset) is not None


async def test_profile_mismatch_is_ignored(sample, asset_dir, monkeypatch):
    asset = await _image(sample, "Profil", b"profile")
    sample.db.add(_ready(sample, asset, profile="visual-v1"))
    await sample.db.commit()
    monkeypatch.setenv("BILIGN_BUSINESS_OBSERVATION_PROFILE", "visual-v2")
    assert observe.active_profile() == "visual-v2"
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset) is None
    monkeypatch.delenv("BILIGN_BUSINESS_OBSERVATION_PROFILE", raising=False)
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset) is not None


async def test_derivative_with_different_content_does_not_inherit(sample, asset_dir):
    source_asset = await _image(sample, "Kaynak", b"source-bytes")
    sample.db.add(_ready(sample, source_asset))
    await sample.db.commit()
    other_digest = "b" * 64
    derivative = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="video",
        title="Turev",
        caption="",
        locator_kind="storage",
        locator=f"brand-videos/{sample.business.id}/{other_digest}.mp4",
        public_allowed=False,
        status="draft",
        created_by=sample.editor.id,
        source_asset_id=source_asset.id,
        verified_duration=8_000,
        verified_timescale=1000,
        verified_size_bytes=200,
        verified_has_audio=False,
    )
    sample.db.add(derivative)
    await sample.db.commit()
    assert _digest(source_asset) != other_digest
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, derivative) is None


async def test_identical_sha_derivative_may_reuse_source_observation(sample, asset_dir):
    source_asset = await _image(sample, "Ayni", b"same-bytes")
    digest = _digest(source_asset)
    sample.db.add(_ready(sample, source_asset))
    await sample.db.commit()
    twin = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="image",
        title="Kopya",
        caption="",
        locator_kind="storage",
        locator=source_asset.locator,
        public_allowed=False,
        status="draft",
        created_by=sample.editor.id,
        source_asset_id=source_asset.id,
    )
    sample.db.add(twin)
    await sample.db.commit()
    found = await lookup.ready_observation_for_asset(sample.db, sample.business.id, twin)
    assert found is not None
    assert found.asset_id == source_asset.id
    assert found.content_sha256 == digest


async def test_lookup_does_not_call_provider_or_change_ranking(sample, asset_dir, monkeypatch):
    asset = await _image(sample, "Zeytinyagi hasadi", b"provider")
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    vision = AsyncMock()
    monkeypatch.setattr("backend.services.business_yansi.image_observe.call_vision", vision, raising=False)
    monkeypatch.setattr("backend.services.business_yansi.image_observe.analyze_image", vision, raising=False)
    monkeypatch.setattr("backend.services.business_yansi.video_observe.analyze_video", vision, raising=False)
    steps = [{"question": "Zeytinyagi nedir?", "answer": "Zeytinyagi hasadi ozeti"}]
    before = media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset], steps)
    found = await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset)
    after = media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [asset], steps)
    assert found is not None
    assert before == after == str(asset.id)
    assert vision.await_count == 0
    assert vision.call_count == 0


async def test_lookup_does_not_mutate_observation_rows(sample, asset_dir):
    asset = await _image(sample, "Dokunulmaz", b"immutable")
    row = _ready(sample, asset)
    sample.db.add(row)
    await sample.db.commit()
    before = (row.status, row.summary, row.claim_token, row.attempts)
    found = await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset)
    await sample.db.refresh(row)
    assert found.id == row.id
    assert (row.status, row.summary, row.claim_token, row.attempts) == before


async def test_stale_direct_asset_object_after_locator_change(sample, asset_dir):
    asset = await _image(sample, "StaleDirect", b"old-locator")
    old_digest = _digest(asset)
    sample.db.add(_ready(sample, asset, summary="eski gozlem"))
    await sample.db.commit()

    stale = SimpleNamespace(
        id=asset.id,
        business_id=asset.business_id,
        asset_type=asset.asset_type,
        locator_kind=asset.locator_kind,
        locator=asset.locator,
        source_asset_id=asset.source_asset_id,
    )
    new_digest = "c" * 64
    new_locator = f"brand-assets/{sample.business.id}/{new_digest}.png"
    async with _second_session(sample) as writer:
        await writer.execute(
            update(BusinessBrandAsset)
            .where(BusinessBrandAsset.id == asset.id, BusinessBrandAsset.business_id == sample.business.id)
            .values(locator=new_locator)
        )
        writer.add(Observation(
            id=uuid.uuid4(),
            business_id=sample.business.id,
            asset_id=asset.id,
            content_sha256=new_digest,
            analyzer_profile=observe.PROFILE,
            idempotency_key=uuid.uuid4().hex + uuid.uuid4().hex[:32],
            status="ready",
            attempts=1,
            max_attempts=3,
            origin="upload",
            created_by=sample.editor.id,
            summary="yeni gozlem",
            tags=["yeni"],
        ))
        await writer.commit()

    found = await lookup.ready_observation_for_asset(sample.db, sample.business.id, stale)
    assert found is not None
    assert found.content_sha256 == new_digest
    assert found.summary == "yeni gozlem"
    assert found.content_sha256 != old_digest
    assert stale.locator.rsplit(".", 1)[-1] in {"png", "jpg", "webp"}
    assert old_digest in stale.locator


async def test_stale_derivative_object_after_locator_change(sample, asset_dir):
    source_asset = await _image(sample, "KaynakStale", b"der-source")
    digest = _digest(source_asset)
    sample.db.add(_ready(sample, source_asset, summary="kaynak gozlem"))
    await sample.db.commit()
    derivative = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="image",
        title="TurevStale",
        caption="",
        locator_kind="storage",
        locator=source_asset.locator,
        public_allowed=False,
        status="draft",
        created_by=sample.editor.id,
        source_asset_id=source_asset.id,
    )
    sample.db.add(derivative)
    await sample.db.commit()

    stale = SimpleNamespace(
        id=derivative.id,
        business_id=derivative.business_id,
        asset_type=derivative.asset_type,
        locator_kind=derivative.locator_kind,
        locator=derivative.locator,
        source_asset_id=derivative.source_asset_id,
    )
    changed = "d" * 64
    async with _second_session(sample) as writer:
        await writer.execute(
            update(BusinessBrandAsset)
            .where(BusinessBrandAsset.id == derivative.id)
            .values(locator=f"brand-assets/{sample.business.id}/{changed}.png")
        )
        await writer.commit()

    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, stale) is None
    assert stale.locator.rsplit(".", 1)[-1] in {"png", "jpg", "webp"}
    assert digest in stale.locator


async def test_multiple_ready_observations_different_hashes_pick_current(sample, asset_dir):
    asset = await _image(sample, "Coklu", b"multi-hash")
    old_digest = _digest(asset)
    sample.db.add(_ready(sample, asset, content_sha256=old_digest, summary="eski"))
    await sample.db.commit()
    new_digest = "e" * 64
    asset.locator = f"brand-assets/{sample.business.id}/{new_digest}.png"
    sample.db.add(_ready(sample, asset, content_sha256=new_digest, summary="guncel"))
    await sample.db.commit()
    found = await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset)
    assert found is not None
    assert found.content_sha256 == new_digest
    assert found.summary == "guncel"
    older = await sample.db.scalar(
        select(Observation).where(
            Observation.asset_id == asset.id,
            Observation.content_sha256 == old_digest,
        )
    )
    assert older is not None and older.summary == "eski"


async def test_dirty_session_emits_no_dml(sample, asset_dir):
    asset = await _image(sample, "Kirli", b"dirty-session")
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    dirty = Observation(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_id=asset.id,
        content_sha256="1" * 64,
        analyzer_profile=observe.PROFILE,
        idempotency_key=uuid.uuid4().hex + uuid.uuid4().hex[:32],
        status="queued",
        attempts=0,
        max_attempts=3,
        origin="upload",
        created_by=sample.editor.id,
    )
    sample.db.add(dirty)
    asset.title = "Kirli degisti"
    statements, stop = _listen_sql(sample)
    try:
        found = await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset)
    finally:
        stop()
    assert found is not None
    assert isinstance(found, lookup.ObservationSnapshot)
    assert dirty in sample.db.new
    assert asset.title == "Kirli degisti"
    dml = [sql for sql in statements if sql.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))]
    assert dml == []


async def test_pending_direct_asset_title_survives_lookup(sample, asset_dir):
    asset = await _image(sample, "BekleyenBaslik", b"pending-title")
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    asset.title = "Henuz kaydedilmedi"
    found = await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset)
    assert found is not None and found.summary == "Zeytinyagi hasadi ozeti"
    assert asset.title == "Henuz kaydedilmedi"
    assert asset in sample.db.dirty


async def test_pending_source_asset_title_survives_derivative_lookup(sample, asset_dir):
    source_asset = await _image(sample, "KaynakBaslik", b"pending-source-title")
    sample.db.add(_ready(sample, source_asset))
    await sample.db.commit()
    derivative = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="image",
        title="Turev",
        caption="",
        locator_kind="storage",
        locator=source_asset.locator,
        public_allowed=False,
        status="draft",
        created_by=sample.editor.id,
        source_asset_id=source_asset.id,
    )
    sample.db.add(derivative)
    await sample.db.commit()
    source_asset.title = "Kaynak henuz kaydedilmedi"
    found = await lookup.ready_observation_for_asset(sample.db, sample.business.id, derivative)
    assert found is not None and found.asset_id == source_asset.id
    assert source_asset.title == "Kaynak henuz kaydedilmedi"
    assert source_asset in sample.db.dirty


async def test_pending_observation_summary_survives_lookup(sample, asset_dir):
    asset = await _image(sample, "OzetBekleyen", b"pending-summary")
    row = _ready(sample, asset, summary="kalici ozet")
    sample.db.add(row)
    await sample.db.commit()
    row.summary = "henuz kaydedilmemis ozet"
    found = await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset)
    assert isinstance(found, lookup.ObservationSnapshot)
    assert found.summary == "kalici ozet"
    assert row.summary == "henuz kaydedilmemis ozet"
    assert row in sample.db.dirty
    # Snapshot must not share mutable state with the pending ORM row.
    assert found is not row


async def test_unsupported_asset_type_returns_none(sample, asset_dir):
    place = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="place",
        title="Konum",
        caption="",
        latitude=41.0,
        longitude=29.0,
        public_allowed=False,
        status="draft",
        created_by=sample.editor.id,
    )
    sample.db.add(place)
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, place) is None


async def test_unsupported_storage_kind_returns_none(sample, asset_dir):
    asset = await _image(sample, "HttpsKind", b"https-kind")
    digest = _digest(asset)
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    asset.locator_kind = "https"
    asset.locator = f"https://cdn.example.test/{digest}.png"
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset) is None


async def test_remote_url_locator_returns_none(sample, asset_dir):
    asset = await _image(sample, "Remote", b"remote-url")
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    # Bypass ORM checks by presenting a remote locator on a storage-kind shell.
    shell = SimpleNamespace(
        id=asset.id,
        business_id=asset.business_id,
        asset_type="image",
        locator_kind="storage",
        locator="https://cdn.example.test/" + ("a" * 64) + ".png",
        source_asset_id=None,
    )
    # Fresh DB load still has the valid locator — use a DB row with remote locator.
    asset.locator = shell.locator
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset) is None


async def test_incorrect_tenant_prefix_returns_none(sample, asset_dir):
    asset = await _image(sample, "Prefix", b"bad-prefix")
    digest = _digest(asset)
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    foreign = uuid.uuid4()
    asset.locator = f"brand-assets/{foreign}/{digest}.png"
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset) is None


async def test_malformed_digest_filename_returns_none(sample, asset_dir):
    asset = await _image(sample, "Bozuk", b"bad-name")
    sample.db.add(_ready(sample, asset))
    await sample.db.commit()
    asset.locator = f"brand-assets/{sample.business.id}/not-a-digest.png"
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset) is None
    asset.locator = f"brand-assets/{sample.business.id}/{'a' * 64}.exe"
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset) is None


async def test_source_derivative_digest_mismatch_returns_none(sample, asset_dir):
    source_asset = await _image(sample, "KaynakMismatch", b"mismatch-src")
    sample.db.add(_ready(sample, source_asset))
    await sample.db.commit()
    derivative = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="video",
        title="Mismatch",
        caption="",
        locator_kind="storage",
        locator=f"brand-videos/{sample.business.id}/{'f' * 64}.mp4",
        public_allowed=False,
        status="draft",
        created_by=sample.editor.id,
        source_asset_id=source_asset.id,
        verified_duration=5_000,
        verified_timescale=1000,
        verified_size_bytes=100,
        verified_has_audio=False,
    )
    sample.db.add(derivative)
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, derivative) is None


def _storage_image(sample, *, title: str, digest: str, source_asset_id=None):
    return BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="image",
        title=title,
        caption="",
        locator_kind="storage",
        locator=f"brand-assets/{sample.business.id}/{digest}.png",
        public_allowed=False,
        status="draft",
        created_by=sample.editor.id,
        source_asset_id=source_asset_id,
    )


async def test_self_cycle_source_is_rejected(sample, asset_dir):
    digest = "a" * 64
    asset = _storage_image(sample, title="Self", digest=digest)
    sample.db.add(asset)
    await sample.db.flush()
    asset.source_asset_id = asset.id
    await sample.db.commit()
    # No direct ready row: inheritance must not accept A→A.
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, asset) is None


async def test_two_node_cycle_is_rejected(sample, asset_dir):
    digest = "b" * 64
    first = _storage_image(sample, title="A", digest=digest)
    second = _storage_image(sample, title="B", digest=digest)
    sample.db.add_all([first, second])
    await sample.db.flush()
    first.source_asset_id = second.id
    second.source_asset_id = first.id
    # Observation sits on B, but B is not an original (source_asset_id set).
    sample.db.add(_ready(sample, second, content_sha256=digest, asset_id=second.id))
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, first) is None


async def test_three_node_cycle_is_rejected(sample, asset_dir):
    digest = "c" * 64
    a = _storage_image(sample, title="A", digest=digest)
    b = _storage_image(sample, title="B", digest=digest)
    c = _storage_image(sample, title="C", digest=digest)
    sample.db.add_all([a, b, c])
    await sample.db.flush()
    a.source_asset_id = b.id
    b.source_asset_id = c.id
    c.source_asset_id = a.id
    sample.db.add(_ready(sample, b, content_sha256=digest, asset_id=b.id, summary="dongu"))
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, a) is None


async def test_longer_cycle_is_rejected(sample, asset_dir):
    digest = "d" * 64
    nodes = [_storage_image(sample, title=f"N{i}", digest=digest) for i in range(5)]
    sample.db.add_all(nodes)
    await sample.db.flush()
    for index, node in enumerate(nodes):
        node.source_asset_id = nodes[(index + 1) % len(nodes)].id
    sample.db.add(_ready(sample, nodes[1], content_sha256=digest, asset_id=nodes[1].id))
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, nodes[0]) is None


async def test_valid_original_source_inheritance_still_works(sample, asset_dir):
    source_asset = await _image(sample, "Orijinal", b"valid-original-source")
    digest = _digest(source_asset)
    sample.db.add(_ready(sample, source_asset, summary="orijinal gozlem"))
    await sample.db.commit()
    derivative = _storage_image(
        sample, title="TurevGecerli", digest=digest, source_asset_id=source_asset.id,
    )
    derivative.locator = source_asset.locator
    sample.db.add(derivative)
    await sample.db.commit()
    found = await lookup.ready_observation_for_asset(sample.db, sample.business.id, derivative)
    assert found is not None
    assert found.asset_id == source_asset.id
    assert found.summary == "orijinal gozlem"
    assert source_asset.source_asset_id is None


async def test_dangling_source_is_rejected(sample, asset_dir):
    digest = "e" * 64
    orphan = _storage_image(sample, title="Yetim", digest=digest, source_asset_id=uuid.uuid4())
    sample.db.add(orphan)
    await sample.db.commit()
    # No direct ready row; dangling source must not invent inheritance.
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, orphan) is None


async def test_cross_tenant_source_is_rejected(sample, asset_dir):
    digest = "f" * 64
    foreign = uuid.uuid4()
    local = _storage_image(sample, title="Yerel", digest=digest)
    sample.db.add(local)
    await sample.db.flush()
    # Source id points at a non-existent foreign-tenant row; snapshot load is tenant-scoped.
    local.source_asset_id = foreign
    await sample.db.commit()
    assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, local) is None


async def test_cycle_rejection_preserves_pending_edits_and_emits_no_dml(sample, asset_dir, monkeypatch):
    digest = "1" * 64
    a = _storage_image(sample, title="A", digest=digest)
    b = _storage_image(sample, title="B", digest=digest)
    c = _storage_image(sample, title="C", digest=digest)
    sample.db.add_all([a, b, c])
    await sample.db.flush()
    a.source_asset_id = b.id
    b.source_asset_id = c.id
    c.source_asset_id = a.id
    sample.db.add(_ready(sample, b, content_sha256=digest, asset_id=b.id))
    await sample.db.commit()
    a.title = "Bekleyen A"
    b.title = "Bekleyen B"
    vision = AsyncMock()
    monkeypatch.setattr("backend.services.business_yansi.image_observe.call_vision", vision, raising=False)
    monkeypatch.setattr("backend.services.business_yansi.image_observe.analyze_image", vision, raising=False)
    statements, stop = _listen_sql(sample)
    try:
        assert await lookup.ready_observation_for_asset(sample.db, sample.business.id, a) is None
    finally:
        stop()
    assert a.title == "Bekleyen A" and b.title == "Bekleyen B"
    assert a in sample.db.dirty and b in sample.db.dirty
    dml = [sql for sql in statements if sql.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))]
    assert dml == []
    assert vision.await_count == 0 and vision.call_count == 0
