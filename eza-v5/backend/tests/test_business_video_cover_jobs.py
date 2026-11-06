"""Cover jobs are durable, silent reuse is measured, and sealed plans stay put."""
import asyncio
import tempfile
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.core.utils.dependencies import Base
from backend.models.business_video_cover_jobs import BusinessVideoCoverJob
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.cover_jobs import ensure_cover_job, job_key, latest_for_asset, process_one, reuse_original
from backend.services.business_yansi.video_ingest import ingest_upload
from backend.services.business_yansi.video_mp4 import probe_file as live_probe
from backend.services.business_yansi.video_storage import MemoryVideoStore
from backend.tests.test_business_video_cover_policy import _confirm, _steps, asset_dir, sample
from backend.tests.test_business_video_storage import Upload, VideoQuotaRedis, _mp4
from backend.tests.test_business_yansi import source


@pytest.fixture(autouse=True)
def _budget_and_probe(monkeypatch):
    quota = VideoQuotaRedis()

    async def client():
        return quota

    monkeypatch.setattr("backend.services.business_yansi.video_ingest._redis", client)

    async def accept(_path: str) -> None:
        return None

    monkeypatch.setattr("backend.services.business_yansi.video_mp4.probe_file", accept)


async def _keep(sample, body, *, purpose="step", title="Atolye filmi"):
    row = await ingest_upload(
        sample.db, sample.business.id, sample.editor.id, store=MemoryVideoStore(), upload=Upload(body),
        title=title, caption="", purpose=purpose, public_allowed=True,
    )
    await ensure_cover_job(sample.db, row, sample.editor.id)
    await sample.db.flush()
    return row


async def test_silent_original_is_reused_and_a_loud_or_long_one_waits(sample, asset_dir):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    silent = await _confirm(sample, knowledge, await _keep(sample, _mp4(seconds=12), title="Sessiz film"))
    loud = await _confirm(sample, knowledge, await _keep(sample, _mp4(seconds=12, with_audio=True), title="Sesli film"))
    long = await _confirm(sample, knowledge, await _keep(sample, _mp4(seconds=40), purpose="cover", title="Uzun film"))
    assert silent.verified_has_audio is False and reuse_original(silent)
    assert loud.verified_has_audio is True and not reuse_original(loud)
    assert long.verified_duration == 40 * 1000 and not reuse_original(long)
    again = await ensure_cover_job(sample.db, silent, sample.editor.id)
    await sample.db.commit()
    first = await sample.db.scalar(select(BusinessVideoCoverJob).where(BusinessVideoCoverJob.source_asset_id == silent.id))
    assert again.id == first.id and first.idempotency_key == job_key(silent.id)
    finished = {}
    for _ in range(3):
        job = await process_one(sample.db)
        await sample.db.commit()
        finished[job.source_asset_id] = job
    assert finished[silent.id].status == "ready" and finished[silent.id].result_asset_id == silent.id
    assert finished[loud.id].status == "awaiting_encode" and finished[loud.id].result_asset_id is None
    assert finished[loud.id].attempts == 0 and finished[long.id].attempts == 0
    assert finished[long.id].status == "awaiting_encode" and finished[long.id].result_asset_id is None
    from backend.services.business_yansi.cover_jobs import present_job
    shown = present_job(finished[silent.id])
    assert set(shown) == {"jobId", "status", "resultAssetId", "errorCode", "startSeconds", "endSeconds"}
    assert "brand-videos" not in str(shown)
    assert shown["resultAssetId"] == str(silent.id)
    assert await process_one(sample.db) is None


async def test_a_finished_job_does_not_replace_an_automatic_draft(sample, asset_dir):
    from backend.services.business_yansi import brand_asset_library as library

    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    image = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Atolye gorseli", "caption": "", "public_allowed": True,
    }, image_bytes=b"\x89PNG\r\n\x1a\n" + b"\x00" * 24)
    image = await _confirm(sample, knowledge, image)
    steps = _steps(knowledge)
    automatic = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps,
    )
    explicit = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps, cover_asset_id=image.id,
    )
    assert automatic.media_plan["coverMode"] == "automatic"
    assert automatic.media_plan["coverAssetId"] == str(image.id)
    assert explicit.media_plan["coverMode"] == "explicit"
    approved = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps, cover_asset_id=image.id,
    )
    approved = await svc.transition_draft(sample.db, sample.business.id, sample.editor.id, approved.id, "review", approved.revision)
    approved = await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, approved.id, "approved", approved.revision)
    sealed = approved.media_plan["seal"]
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id), "slug": "baska-kapak", "name": "Baska",
    })
    other_knowledge = await svc.create_knowledge(sample.db, other.id, sample.outsider.id, {
        "title": "Baska", "content": "Baska metin yeterince uzundur.", "source": "Baska", "publicAllowed": True,
    })
    foreign_steps = [
        {"question": f"Soru {index}?", "answer": other_knowledge.content, "sources": [str(other_knowledge.id)]}
        for index in range(8)
    ]
    foreign = await svc.create_draft(sample.db, other.id, sample.outsider.id, "Baska", "Baska", foreign_steps)
    foreign_cover = foreign.media_plan["coverAssetId"]
    silent = await _confirm(sample, knowledge, await _keep(sample, _mp4(seconds=8), title="Hazir kapak"))
    done = await process_one(sample.db)
    await sample.db.commit()
    assert done.result_asset_id == silent.id
    await sample.db.refresh(automatic)
    await sample.db.refresh(explicit)
    await sample.db.refresh(approved)
    await sample.db.refresh(foreign)
    assert automatic.media_plan["coverAssetId"] == str(image.id)
    assert automatic.media_plan["coverMode"] == "automatic" and automatic.media_plan["seal"] is None
    ranked = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Hazir kapak", "Hazir kapak", steps,
    )
    assert ranked.media_plan["coverAssetId"] == str(silent.id) and ranked.media_plan["coverMode"] == "automatic"
    assert explicit.media_plan["coverAssetId"] == str(image.id)
    assert approved.media_plan["coverAssetId"] == str(image.id) and approved.media_plan["seal"] == sealed
    assert media.media_seal(approved.media_plan) == sealed
    assert foreign.media_plan["coverAssetId"] == foreign_cover
    assert await latest_for_asset(sample.db, other.id, silent.id) is None
    assert (await latest_for_asset(sample.db, sample.business.id, silent.id)).result_asset_id == silent.id


async def test_claim_is_single_use_and_a_stale_claim_returns(tmp_path):
    from backend.models.production import Organization, User
    from backend.models.business_yansi import BusinessProfile
    from backend.models.business_brand_assets import BusinessBrandAsset
    from backend.services.business_yansi.cover_jobs import claim_next, recover_stale

    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'jobs.db').as_posix()}")
    tables = [User.__table__, Organization.__table__, BusinessProfile.__table__, BusinessBrandAsset.__table__, BusinessVideoCoverJob.__table__]
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
    maker = async_sessionmaker(engine, expire_on_commit=False)

    async def plant():
        async with maker() as db:
            db.add(BusinessVideoCoverJob(
                business_id=__import__("uuid").uuid4(),
                source_asset_id=__import__("uuid").uuid4(),
                idempotency_key="a" * 64,
                strategy="first_span",
                start_ticks=0,
                end_ticks=1000,
                encoder_profile="silent-derivative-v1",
                status="queued",
                attempts=0,
                max_attempts=3,
                created_by=__import__("uuid").uuid4(),
            ))
            await db.commit()

    await plant()

    async def take():
        async with maker() as db:
            job = await claim_next(db)
            await db.commit()
            return None if job is None else job.id

    first, second = await asyncio.gather(take(), take())
    assert (first is None) ^ (second is None)
    async with maker() as db:
        row = await db.scalar(select(BusinessVideoCoverJob))
        row.deadline_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        await db.commit()
        assert await recover_stale(db) == 1
        await db.commit()
        await db.refresh(row)
        assert row.status == "queued" and row.claim_token is None
        row.attempts = row.max_attempts
        row.status = "running"
        row.deadline_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        await db.commit()
        assert await recover_stale(db) == 0
        await db.commit()
        await db.refresh(row)
        assert row.status == "failed" and row.error_code == "cover_job_stale"
    await engine.dispose()


async def test_worker_finishes_a_claim_in_a_second_session(tmp_path, monkeypatch):
    from backend.models.business_brand_assets import BusinessBrandAsset
    from backend.worker.cover_prepare import serve

    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'worker.db').as_posix()}")
    tables = [BusinessBrandAsset.__table__, BusinessVideoCoverJob.__table__]
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as db:
        db.add(BusinessVideoCoverJob(
            business_id=__import__("uuid").uuid4(),
            source_asset_id=__import__("uuid").uuid4(),
            idempotency_key="b" * 64,
            strategy="first_span",
            start_ticks=0,
            end_ticks=1000,
            encoder_profile="silent-derivative-v1",
            status="queued",
            attempts=0,
            max_attempts=3,
            created_by=__import__("uuid").uuid4(),
        ))
        await db.commit()
    from backend.services.business_yansi import cover_jobs

    stop = asyncio.Event()
    original = cover_jobs.settle

    async def finish(db, job):
        done = await original(db, job)
        stop.set()
        return done

    monkeypatch.setattr(cover_jobs, "settle", finish)
    await serve(maker, stop=stop)
    async with maker() as db:
        row = await db.scalar(select(BusinessVideoCoverJob))
        assert row.status == "failed" and row.error_code == "cover_source_missing"
        assert row.attempts == 1 and row.claim_token is None
    await engine.dispose()


def _silent_mp4() -> bytes:
    return _mp4(seconds=8)


async def _keep_in(sample, store, body, *, purpose="step", title="Atolye filmi"):
    row = await ingest_upload(
        sample.db, sample.business.id, sample.editor.id, store=store, upload=Upload(body),
        title=title, caption="", purpose=purpose, public_allowed=True,
    )
    await ensure_cover_job(sample.db, row, sample.editor.id)
    await sample.db.flush()
    return row


def _patch_encoder(monkeypatch, writer):
    async def encode(source_path, dest_path, *, start, duration, bitrate=None):
        writer(dest_path, start, duration, bitrate)

    monkeypatch.setattr("backend.services.business_yansi.cover_encode.encode_window", encode)


async def _encode(sample, store):
    from backend.services.business_yansi.cover_jobs import claim_encode, encode_claimed

    claimed = await claim_encode(sample.db)
    await sample.db.commit()
    done = await encode_claimed(sample.db, claimed, store)
    await sample.db.commit()
    return done


async def test_a_derivative_is_ranked_on_the_next_draft(sample, asset_dir, monkeypatch):
    from backend.models.business_brand_assets import BusinessBrandAsset
    from backend.services.business_yansi import brand_asset_library as library
    from backend.services.business_yansi.video_ingest import COVER_MAX_BYTES, COVER_MAX_SECONDS

    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    image = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Atolye gorseli", "caption": "", "public_allowed": True,
    }, image_bytes=b"\x89PNG\r\n\x1a\n" + b"\x00" * 24)
    image = await _confirm(sample, knowledge, image)
    steps = _steps(knowledge)
    automatic = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps)
    explicit = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps, cover_asset_id=image.id,
    )
    approved = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps, cover_asset_id=image.id,
    )
    approved = await svc.transition_draft(sample.db, sample.business.id, sample.editor.id, approved.id, "review", approved.revision)
    approved = await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, approved.id, "approved", approved.revision)
    sealed = approved.media_plan["seal"]
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id), "slug": "baska-turev", "name": "Baska",
    })
    other_knowledge = await svc.create_knowledge(sample.db, other.id, sample.outsider.id, {
        "title": "Baska", "content": "Baska metin yeterince uzundur.", "source": "Baska", "publicAllowed": True,
    })
    foreign = await svc.create_draft(sample.db, other.id, sample.outsider.id, "Baska", "Baska", [
        {"question": f"Soru {index}?", "answer": other_knowledge.content, "sources": [str(other_knowledge.id)]}
        for index in range(8)
    ])
    foreign_cover = foreign.media_plan["coverAssetId"]
    store = MemoryVideoStore()
    original = await _confirm(sample, knowledge, await _keep_in(
        sample, store, _mp4(seconds=40, with_audio=True), purpose="cover", title="Kirk saniye",
    ))
    original_bytes = store.objects[original.locator][0]
    classified = await process_one(sample.db)
    await sample.db.commit()
    assert classified.status == "awaiting_encode" and classified.attempts == 0
    seen = {}

    def write(dest, start, duration, bitrate):
        seen["start"] = start
        seen["duration"] = duration
        seen["bitrate"] = bitrate
        with open(dest, "wb") as handle:
            handle.write(_silent_mp4())

    _patch_encoder(monkeypatch, write)
    done = await _encode(sample, store)
    derivative = await sample.db.get(BusinessBrandAsset, done.result_asset_id)
    await sample.db.refresh(original)
    await sample.db.refresh(automatic)
    await sample.db.refresh(explicit)
    await sample.db.refresh(approved)
    await sample.db.refresh(foreign)
    assert seen == {"start": 0.0, "duration": 20.0, "bitrate": None}
    assert derivative.id != original.id and derivative.source_asset_id == original.id
    assert derivative.verified_has_audio is False
    assert derivative.verified_duration <= COVER_MAX_SECONDS * derivative.verified_timescale
    assert derivative.verified_size_bytes <= COVER_MAX_BYTES
    assert derivative.locator != original.locator and "/staging/" not in derivative.locator
    assert store.objects[original.locator][0] == original_bytes
    assert original.verified_has_audio is True and original.verified_duration == 40 * 1000
    assert not any("/staging/" in key for key in store.objects)
    assert automatic.media_plan["coverAssetId"] == str(image.id)
    assert automatic.media_plan["coverMode"] == "automatic" and automatic.media_plan["seal"] is None
    assert explicit.media_plan["coverAssetId"] == str(image.id)
    assert approved.media_plan["seal"] == sealed and approved.media_plan["coverAssetId"] == str(image.id)
    assert media.media_seal(approved.media_plan) == sealed
    assert foreign.media_plan["coverAssetId"] == foreign_cover
    later = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Kirk saniye", "Kirk saniye", steps)
    assert later.media_plan["coverAssetId"] == str(derivative.id) and later.media_plan["coverMode"] == "automatic"
    from backend.services.business_yansi.cover_jobs import claim_encode
    assert await claim_encode(sample.db) is None
    job = await sample.db.get(BusinessVideoCoverJob, done.id)
    job.status = "awaiting_encode"
    job.attempts = 0
    job.claim_token = None
    job.deadline_at = None
    job.result_asset_id = None
    await sample.db.commit()

    def fail_if_called(dest, start, duration, bitrate):
        raise AssertionError("encoded again")

    _patch_encoder(monkeypatch, fail_if_called)
    repeated = await _encode(sample, store)
    assert repeated.result_asset_id == derivative.id and repeated.status == "ready"


async def test_oversize_derivative_retries_once_and_a_second_miss_is_not_published(sample, asset_dir, monkeypatch):
    from backend.models.business_brand_assets import BusinessBrandAsset
    from backend.services.business_yansi.video_ingest import COVER_MAX_BYTES
    from sqlalchemy import func

    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    store = MemoryVideoStore()
    original = await _confirm(sample, knowledge, await _keep_in(sample, store, _mp4(seconds=40, with_audio=True), title="Buyuk film"))
    kept = store.objects[original.locator][0]
    await process_one(sample.db)
    await sample.db.commit()
    calls = {"n": 0}

    def write(dest, start, duration, bitrate):
        calls["n"] += 1
        calls["bitrate"] = bitrate
        payload = _silent_mp4() if calls["n"] == 2 else b"x" * (COVER_MAX_BYTES + 1)
        with open(dest, "wb") as handle:
            handle.write(payload)

    _patch_encoder(monkeypatch, write)
    done = await _encode(sample, store)
    derivative = await sample.db.get(BusinessBrandAsset, done.result_asset_id)
    from backend.services.business_yansi.cover_encode import fit_bitrate
    assert calls["n"] == 2 and calls["bitrate"] == fit_bitrate(20.0)
    assert derivative.verified_size_bytes <= COVER_MAX_BYTES and derivative.verified_has_audio is False
    assert store.objects[original.locator][0] == kept
    assert not any("/staging/" in key for key in store.objects)

    again = MemoryVideoStore()
    loud = await _confirm(sample, knowledge, await _keep_in(sample, again, _mp4(seconds=30, with_audio=True), title="Hala buyuk"))
    loud_bytes = again.objects[loud.locator][0]
    await process_one(sample.db)
    await sample.db.commit()

    def always_big(dest, start, duration, bitrate):
        with open(dest, "wb") as handle:
            handle.write(b"x" * (COVER_MAX_BYTES + 1))

    _patch_encoder(monkeypatch, always_big)
    failed = await _encode(sample, again)
    extras = await sample.db.scalar(select(func.count()).select_from(BusinessBrandAsset).where(BusinessBrandAsset.source_asset_id == loud.id))
    assert failed.status == "failed" and failed.error_code == "cover_derivative_too_large"
    assert extras == 0 and again.objects[loud.locator][0] == loud_bytes
    assert set(again.objects) == {loud.locator}


async def test_encode_claim_survives_a_crash_and_a_lost_token_stores_nothing(sample, asset_dir, monkeypatch):
    from backend.models.business_yansi import BusinessMember
    from backend.services.business_yansi.cover_jobs import claim_encode, encode_claimed, recover_stale

    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    store = MemoryVideoStore()
    original = await _confirm(sample, knowledge, await _keep_in(sample, store, _mp4(seconds=25, with_audio=True), title="Kesilen film"))
    kept = bytes(store.objects[original.locator][0])
    await process_one(sample.db)
    await sample.db.commit()
    claimed = await claim_encode(sample.db)
    await sample.db.commit()
    assert claimed.claim_token.startswith("e") and claimed.attempts == 1
    claimed.deadline_at = datetime.now(timezone.utc) - timedelta(seconds=5)
    await sample.db.commit()
    assert await recover_stale(sample.db) == 1
    await sample.db.commit()
    await sample.db.refresh(claimed)
    assert claimed.status == "awaiting_encode" and claimed.claim_token is None and claimed.attempts == 1
    assert store.objects[original.locator][0] == kept

    lost = await claim_encode(sample.db)
    previous = lost.claim_token
    await sample.db.commit()
    lost.claim_token = "e" + ("0" * 32)
    await sample.db.commit()
    stale = type("Claim", (), {"id": lost.id, "claim_token": previous, "status": "running"})()
    assert await encode_claimed(sample.db, stale, store) is None
    assert store.objects[original.locator][0] == kept
    lost.status = "awaiting_encode"
    lost.claim_token = None
    lost.deadline_at = None
    await sample.db.commit()

    member = await sample.db.get(BusinessMember, (sample.business.id, sample.editor.id))
    await sample.db.delete(member)
    await sample.db.commit()
    held = await claim_encode(sample.db)
    await sample.db.commit()

    def write(dest, start, duration, bitrate):
        with open(dest, "wb") as handle:
            handle.write(_silent_mp4())

    _patch_encoder(monkeypatch, write)
    denied = await encode_claimed(sample.db, held, store)
    await sample.db.commit()
    assert denied.status == "failed" and denied.error_code == "cover_authority_lost"
    assert store.objects[original.locator][0] == kept
    assert set(store.objects) == {original.locator}


async def test_two_encode_claims_cannot_own_one_job(tmp_path):
    from backend.models.business_brand_assets import BusinessBrandAsset
    from backend.models.business_yansi import BusinessProfile
    from backend.models.production import Organization, User
    from backend.services.business_yansi.cover_jobs import claim_encode

    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'encode-claim.db').as_posix()}")
    tables = [User.__table__, Organization.__table__, BusinessProfile.__table__, BusinessBrandAsset.__table__, BusinessVideoCoverJob.__table__]
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as db:
        db.add(BusinessVideoCoverJob(
            business_id=__import__("uuid").uuid4(),
            source_asset_id=__import__("uuid").uuid4(),
            idempotency_key="c" * 64,
            strategy="first_span",
            start_ticks=0,
            end_ticks=1000,
            encoder_profile="silent-derivative-v1",
            status="awaiting_encode",
            attempts=0,
            max_attempts=3,
            created_by=__import__("uuid").uuid4(),
        ))
        db.add(BusinessVideoCoverJob(
            business_id=__import__("uuid").uuid4(),
            source_asset_id=__import__("uuid").uuid4(),
            idempotency_key="d" * 64,
            strategy="first_span",
            start_ticks=0,
            end_ticks=1000,
            encoder_profile="silent-reuse-v1",
            status="ready",
            attempts=1,
            max_attempts=3,
            created_by=__import__("uuid").uuid4(),
        ))
        await db.commit()

    async def take():
        async with maker() as db:
            job = await claim_encode(db)
            await db.commit()
            return None if job is None else (job.id, job.status)

    first, second = await asyncio.gather(take(), take())
    assert (first is None) ^ (second is None)
    winner = first or second
    assert winner[1] == "running"
    async with maker() as db:
        ready = await db.scalar(select(BusinessVideoCoverJob).where(BusinessVideoCoverJob.status == "ready"))
        assert ready.encoder_profile == "silent-reuse-v1"
        running = await db.scalar(select(BusinessVideoCoverJob).where(BusinessVideoCoverJob.status == "running"))
        running.attempts = running.max_attempts
        running.deadline_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        await db.commit()
        from backend.services.business_yansi.cover_jobs import recover_stale
        assert await recover_stale(db) == 0
        await db.commit()
        await db.refresh(running)
        assert running.status == "failed" and running.error_code == "cover_job_stale"
        await db.refresh(ready)
        assert ready.status == "ready"
    await engine.dispose()


async def test_a_link_added_after_encode_reaches_the_next_automatic_draft(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    store = MemoryVideoStore()
    original = await _keep_in(sample, store, _mp4(seconds=40, with_audio=True), title="Gec bag")
    await process_one(sample.db)
    await sample.db.commit()

    def write(dest, start, duration, bitrate):
        with open(dest, "wb") as handle:
            handle.write(_silent_mp4())

    _patch_encoder(monkeypatch, write)
    done = await _encode(sample, store)
    await _confirm(sample, knowledge, original)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Gec bag", "Atolye", _steps(knowledge),
    )
    assert draft.media_plan["coverMode"] == "automatic"
    assert draft.media_plan["coverAssetId"] == str(done.result_asset_id)
    assert draft.media_plan["seal"] is None


async def test_real_forty_second_source_becomes_a_silent_cover(sample, asset_dir, monkeypatch):
    from fastapi import HTTPException

    from backend.models.business_brand_assets import BusinessBrandAsset
    from backend.services.business_yansi.video_ingest import COVER_MAX_BYTES, COVER_MAX_SECONDS
    from backend.services.business_yansi.video_mp4 import _tool_path

    try:
        _tool_path("EZA_BUSINESS_VIDEO_FFMPEG", "ffmpeg")
        _tool_path("EZA_BUSINESS_VIDEO_FFPROBE", "ffprobe")
    except HTTPException:
        pytest.skip("ffmpeg is not available")
    monkeypatch.setattr(tempfile, "tempdir", str(asset_dir))
    monkeypatch.setattr("backend.services.business_yansi.video_mp4.probe_file", live_probe)
    binary = _tool_path("EZA_BUSINESS_VIDEO_FFMPEG", "ffmpeg")
    path = asset_dir / "forty.mp4"
    process = await asyncio.create_subprocess_exec(
        binary, "-hide_banner", "-nostdin", "-y",
        "-f", "lavfi", "-i", "testsrc=size=160x120:rate=8",
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=8000",
        "-t", "40", "-shortest",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
        "-video_track_timescale", "1000",
        "-c:a", "aac", "-b:a", "32k",
        "-movflags", "+faststart",
        str(path),
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    assert await process.wait() == 0
    body = path.read_bytes()
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    store = MemoryVideoStore()
    original = await _confirm(sample, knowledge, await _keep_in(sample, store, body, purpose="cover", title="Kirk saniye gercek"))
    original_bytes = bytes(store.objects[original.locator][0])
    assert original.verified_has_audio is True
    assert original.verified_duration > COVER_MAX_SECONDS * original.verified_timescale
    classified = await process_one(sample.db)
    await sample.db.commit()
    assert classified.status == "awaiting_encode"
    done = await _encode(sample, store)
    derivative = await sample.db.get(BusinessBrandAsset, done.result_asset_id)
    await sample.db.refresh(original)
    assert done.status == "ready"
    assert derivative.source_asset_id == original.id
    assert derivative.verified_has_audio is False
    assert derivative.verified_duration <= COVER_MAX_SECONDS * derivative.verified_timescale
    assert 0 < derivative.verified_size_bytes <= COVER_MAX_BYTES
    assert derivative.verified_duration == 20 * derivative.verified_timescale
    assert derivative.locator != original.locator
    assert store.objects[original.locator][0] == original_bytes
    assert original.verified_has_audio is True
    assert not any("/staging/" in key for key in store.objects)


async def test_cancelled_cover_encode_reaps_the_process(tmp_path, monkeypatch):
    from backend.services.business_yansi.cover_encode import encode_window

    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    killed = {}

    class Proc:
        def __init__(self):
            self.returncode = None

        def kill(self):
            killed["yes"] = True
            self.returncode = -9

        async def wait(self):
            if self.returncode is None:
                await asyncio.sleep(30)
            return self.returncode

    async def fake_exec(*_args, **_kwargs):
        return Proc()

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_exec)
    monkeypatch.setattr("backend.services.business_yansi.cover_encode._tool_path", lambda *_args, **_kwargs: "ffmpeg")
    task = asyncio.create_task(encode_window(str(tmp_path / "in.mp4"), str(tmp_path / "out.mp4"), start=0, duration=1))
    await asyncio.sleep(0.05)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert killed.get("yes") is True
    assert list(tmp_path.glob("bilign-cover-*")) == []


async def test_cover_encoding_commits_before_ffmpeg(sample, asset_dir, monkeypatch):
    from backend.services.business_yansi.cover_encode import CoverEncodeError
    from backend.services.business_yansi.cover_jobs import claim_encode, encode_claimed

    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    await _confirm(sample, knowledge, await _keep(sample, _mp4(seconds=12, with_audio=True), title="Sesli film"))
    classified = await process_one(sample.db)
    await sample.db.commit()
    assert classified.status == "awaiting_encode"
    order = []
    commit = sample.db.commit

    async def recording():
        order.append("commit")
        await commit()

    async def render(_store, _source, _job):
        order.append("render")
        raise CoverEncodeError("cover_encode_failed", retryable=True)

    monkeypatch.setattr(sample.db, "commit", recording)
    monkeypatch.setattr("backend.services.business_yansi.cover_encode.render_cover", render)
    claimed = await claim_encode(sample.db)
    await sample.db.commit()
    order.clear()
    await encode_claimed(sample.db, claimed, MemoryVideoStore())
    assert order[:2] == ["commit", "render"]


async def test_stale_cover_worker_cannot_fail_a_newer_claim(tmp_path):
    from backend.services.business_yansi import cover_jobs as covers

    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'cover-fence.db').as_posix()}")
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=[BusinessVideoCoverJob.__table__]))
    maker = async_sessionmaker(engine, expire_on_commit=False)
    job_id = uuid.uuid4()
    business_id = uuid.uuid4()
    old_token = "e" + "a" * 32
    new_token = "e" + "b" * 32
    async with maker() as db:
        db.add(BusinessVideoCoverJob(
            id=job_id, business_id=business_id, source_asset_id=uuid.uuid4(),
            idempotency_key="f" * 64, strategy="first_span", start_ticks=0, end_ticks=1000,
            encoder_profile="silent-derivative-v1", status="running", attempts=1, max_attempts=3,
            claim_token=old_token, deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
            created_by=uuid.uuid4(),
        ))
        await db.commit()
    async with maker() as writer:
        row = await writer.get(BusinessVideoCoverJob, job_id)
        row.claim_token = new_token
        row.deadline_at = datetime.now(timezone.utc) + timedelta(seconds=60)
        await writer.commit()
    async with maker() as stale:
        wrote = await covers.fail_owned(
            stale, job_id, business_id, old_token, "cover_authority_lost", retryable=False,
        )
        await stale.commit()
        assert wrote is False
    async with maker() as db:
        row = await db.get(BusinessVideoCoverJob, job_id)
        assert row.status == "running" and row.claim_token == new_token and row.error_code is None
    await engine.dispose()


async def test_authority_change_during_encode_cannot_clear_a_newer_claim(sample, asset_dir, monkeypatch):
    from backend.services.business_yansi.cover_jobs import claim_encode, encode_claimed, fail_owned

    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    original = await _confirm(sample, knowledge, await _keep(sample, _mp4(seconds=12, with_audio=True), title="Sesli film"))
    classified = await process_one(sample.db)
    await sample.db.commit()
    claimed = await claim_encode(sample.db)
    await sample.db.commit()
    old_token = claimed.claim_token
    new_token = "e" + "c" * 32

    async def render(_store, _source, _job):
        claimed.claim_token = new_token
        claimed.deadline_at = datetime.now(timezone.utc) + timedelta(seconds=180)
        await sample.db.commit()
        from backend.services.business_yansi.cover_encode import CoverEncodeError
        raise CoverEncodeError("cover_encode_failed", retryable=True)

    monkeypatch.setattr("backend.services.business_yansi.cover_encode.render_cover", render)
    await encode_claimed(sample.db, claimed, MemoryVideoStore())
    await sample.db.commit()
    row = await latest_for_asset(sample.db, sample.business.id, original.id)
    assert row.status == "running" and row.claim_token == new_token
    assert await fail_owned(sample.db, row.id, row.business_id, old_token, "cover_authority_lost", retryable=False) is False
    await sample.db.refresh(row)
    assert row.status == "running" and row.claim_token == new_token and row.error_code is None


async def test_retarget_rejects_a_running_claim_without_clearing_it(sample, asset_dir):
    from backend.services.business_yansi.cover_jobs import claim_encode, retarget_cover

    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    original = await _confirm(sample, knowledge, await _keep(sample, _mp4(seconds=40, with_audio=True), title="Sesli film"))
    await process_one(sample.db)
    await sample.db.commit()
    claimed = await claim_encode(sample.db)
    await sample.db.commit()
    token = claimed.claim_token
    start_before, end_before = claimed.start_ticks, claimed.end_ticks
    changed = await retarget_cover(sample.db, sample.business.id, sample.editor.id, original.id, 5, 15)
    assert changed.id != claimed.id
    assert changed.start_ticks == 5000 and changed.end_ticks == 15000
    await sample.db.refresh(claimed)
    assert claimed.status == "running" and claimed.claim_token == token
    assert claimed.start_ticks == start_before and claimed.end_ticks == end_before
