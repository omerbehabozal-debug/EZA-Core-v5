"""Real-file cover journey: duration limits, worker, preview, and sealed plans.

Synthetic boxes are not used here. ffmpeg builds the files, the server
measures them, and the cover worker produces the silent cover.
"""
import asyncio
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from backend.models.business_brand_assets import BusinessBrandAsset
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.cover_jobs import claim_encode, encode_claimed, process_one, retarget_cover, retry_cover
from backend.services.business_yansi.video_ingest import COVER_MAX_BYTES, COVER_MAX_SECONDS, STEP_MAX_BYTES, STEP_MAX_SECONDS, ingest_upload
from backend.services.business_yansi.video_mp4 import _tool_path
from backend.services.business_yansi.video_preview import preview_video
from backend.services.business_yansi.video_storage import MemoryVideoStore
from backend.tests.test_business_video_cover_policy import _confirm, _steps, asset_dir, sample
from backend.tests.test_business_video_storage import Upload, VideoQuotaRedis
from backend.tests.test_business_yansi import source
from backend.worker.cover_prepare import serve


@pytest.fixture(autouse=True)
def _quota(monkeypatch):
    quota = VideoQuotaRedis()

    async def client():
        return quota

    monkeypatch.setattr("backend.services.business_yansi.video_ingest._redis", client)


def _ffmpeg():
    try:
        return _tool_path("EZA_BUSINESS_VIDEO_FFMPEG", "ffmpeg"), _tool_path("EZA_BUSINESS_VIDEO_FFPROBE", "ffprobe")
    except HTTPException:
        pytest.skip("ffmpeg is not available")


async def _render(binary, path, seconds, *, audio):
    command = [
        binary, "-hide_banner", "-nostdin", "-y",
        "-f", "lavfi", "-i", "testsrc=size=160x120:rate=8",
    ]
    if audio:
        command += ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=8000", "-shortest"]
    command += [
        "-t", str(seconds),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
        "-video_track_timescale", "1000",
        "-movflags", "+faststart",
    ]
    if audio:
        command += ["-c:a", "aac", "-b:a", "32k"]
    else:
        command += ["-an"]
    command.append(str(path))
    process = await asyncio.create_subprocess_exec(
        *command, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
    )
    assert await process.wait() == 0, seconds
    return path.read_bytes()


async def _store(sample, store, body, title):
    row = await ingest_upload(
        sample.db, sample.business.id, sample.editor.id, store=store, upload=Upload(body),
        title=title, caption="", purpose="step", public_allowed=True,
    )
    from backend.services.business_yansi.cover_jobs import ensure_cover_job
    await ensure_cover_job(sample.db, row, sample.editor.id)
    await sample.db.flush()
    return row


async def _finish(sample, store):
    while await process_one(sample.db) is not None:
        await sample.db.commit()
    await sample.db.commit()
    while True:
        claimed = await claim_encode(sample.db)
        await sample.db.commit()
        if claimed is None:
            return
        await encode_claimed(sample.db, claimed, store)
        await sample.db.commit()


def _seconds(row):
    return row.verified_duration / row.verified_timescale


async def test_real_uploads_keep_the_original_and_prepare_a_silent_cover(sample, asset_dir, monkeypatch):
    monkeypatch.setattr(tempfile, "tempdir", str(asset_dir))
    binary, _probe = _ffmpeg()
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    image = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Atolye gorseli", "caption": "", "public_allowed": True,
    }, image_bytes=b"\x89PNG\r\n\x1a\n" + b"\x00" * 24)
    image = await _confirm(sample, knowledge, image)
    steps = _steps(knowledge)
    explicit = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps, cover_asset_id=image.id,
    )
    approved = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps, cover_asset_id=image.id,
    )
    approved = await svc.transition_draft(sample.db, sample.business.id, sample.editor.id, approved.id, "review", approved.revision)
    approved = await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, approved.id, "approved", approved.revision)
    sealed = approved.media_plan["seal"]
    explicit_revision = explicit.revision
    store = MemoryVideoStore()
    silent = await _confirm(sample, knowledge, await _store(sample, store, await _render(binary, asset_dir / "s5.mp4", 5, audio=False), "Sessiz bes"))
    loud = await _store(sample, store, await _render(binary, asset_dir / "a5.mp4", 5, audio=True), "Sesli bes")
    boundary = await _store(sample, store, await _render(binary, asset_dir / "s20.mp4", 20, audio=False), "Sessiz yirmi")
    long = await _store(sample, store, await _render(binary, asset_dir / "a40.mp4", 40, audio=True), "Sesli kirk")
    minute = await _store(sample, store, await _render(binary, asset_dir / "s60.mp4", 60, audio=False), "Sessiz altmis")
    originals = {
        row.id: bytes(store.objects[row.locator][0])
        for row in (silent, loud, boundary, long, minute)
    }
    automatic = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps,
    )
    assert automatic.media_plan["coverMode"] == "automatic" and automatic.media_plan["seal"] is None
    for row, expect_audio, expect_seconds in (
        (silent, False, 5),
        (loud, True, 5),
        (boundary, False, 20),
        (long, True, 40),
        (minute, False, 60),
    ):
        assert row.verified_has_audio is expect_audio
        assert _seconds(row) == expect_seconds
        assert row.verified_size_bytes == len(originals[row.id]) <= STEP_MAX_BYTES
    with pytest.raises(HTTPException) as too_long:
        await _store(sample, store, await _render(binary, asset_dir / "s61.mp4", 61, audio=False), "Cok uzun")
    assert too_long.value.detail["code"] == "video_too_long"
    assert set(store.objects) == {row.locator for row in (silent, loud, boundary, long, minute)}
    await _finish(sample, store)
    for row in (silent, loud, boundary, long, minute):
        await sample.db.refresh(row)
        assert store.objects[row.locator][0] == originals[row.id]
        assert not row.locator.startswith("http")
    await sample.db.refresh(automatic)
    await sample.db.refresh(explicit)
    await sample.db.refresh(approved)
    assert automatic.media_plan["coverAssetId"] == str(image.id)
    assert automatic.media_plan["seal"] is None
    assert explicit.media_plan["coverAssetId"] == str(image.id) and explicit.revision == explicit_revision
    assert approved.media_plan["seal"] == sealed and media.media_seal(approved.media_plan) == sealed
    assert approved.status == "approved"
    for row, reused in ((silent, True), (boundary, True), (loud, False), (long, False), (minute, False)):
        from backend.services.business_yansi.cover_jobs import latest_for_asset

        job = await latest_for_asset(sample.db, row.business_id, row.id)
        assert job.status == "ready"
        cover = await sample.db.get(BusinessBrandAsset, job.result_asset_id)
        assert cover.verified_has_audio is False
        assert cover.verified_size_bytes <= COVER_MAX_BYTES
        assert _seconds(cover) <= COVER_MAX_SECONDS
        opened = await preview_video(sample.db, sample.business.id, sample.viewer.id, row.id, "bytes=0-3", store)
        cover_view = await preview_video(sample.db, sample.business.id, sample.viewer.id, cover.id, None, store)
        assert opened["body"] == originals[row.id][:4]
        assert opened["headers"]["Cache-Control"] == "private, no-store"
        assert row.locator not in str(opened["headers"]) and "brand-videos" not in str(cover_view["headers"])
        assert cover_view["body"] == store.objects[cover.locator][0]
        if reused:
            assert job.result_asset_id == row.id
        else:
            assert job.result_asset_id != row.id and cover.source_asset_id == row.id
            assert _seconds(cover) == min(20, _seconds(row))
    with pytest.raises(HTTPException) as outsider:
        await preview_video(sample.db, sample.business.id, sample.outsider.id, silent.id, None, store)
    assert outsider.value.status_code == 403
    changed = await retarget_cover(sample.db, sample.business.id, sample.editor.id, long.id, 2, 7)
    assert changed.status == "awaiting_encode" and changed.strategy == "chosen_span"
    await _finish(sample, store)
    await sample.db.refresh(changed)
    segment = await sample.db.get(BusinessBrandAsset, changed.result_asset_id)
    assert changed.status == "ready" and _seconds(segment) == 5
    assert store.objects[long.locator][0] == originals[long.id]
    await sample.db.refresh(explicit)
    await sample.db.refresh(approved)
    assert explicit.media_plan["coverAssetId"] == str(image.id)
    assert approved.media_plan["seal"] == sealed
    changed.status = "failed"
    changed.error_code = "cover_encode_failed"
    changed.result_asset_id = None
    await sample.db.commit()
    retried = await retry_cover(sample.db, sample.business.id, sample.editor.id, long.id)
    assert retried.status == "awaiting_encode" and retried.attempts == 0 and retried.error_code is None
    await _finish(sample, store)
    await sample.db.refresh(retried)
    assert retried.status == "ready" and retried.result_asset_id is not None
    assert store.objects[long.locator][0] == originals[long.id]
    assert not any("/staging/" in key for key in store.objects)
    assert (STEP_MAX_BYTES, STEP_MAX_SECONDS) == (40 * 1024 * 1024, 60)
    from backend.services.business_yansi import video_ingest as ingest_module

    monkeypatch.setattr(ingest_module, "STEP_MAX_BYTES", 32)
    monkeypatch.setattr(ingest_module, "CHUNK_BYTES", 16)
    before = set(store.objects)
    with pytest.raises(HTTPException) as oversized:
        await ingest_upload(
            sample.db, sample.business.id, sample.editor.id, store=store, upload=Upload(b"x" * 80),
            title="Cok buyuk", caption="", purpose="step", public_allowed=False,
        )
    assert oversized.value.detail["code"] == "video_too_large"
    assert set(store.objects) == before


async def test_cover_worker_starts_and_recovers_an_interrupted_encode(sample, asset_dir, monkeypatch):
    monkeypatch.setattr(tempfile, "tempdir", str(asset_dir))
    from backend.models.business_video_cover_jobs import BusinessVideoCoverJob
    from sqlalchemy import select

    binary, _probe = _ffmpeg()
    store = MemoryVideoStore()
    original = await _store(sample, store, await _render(binary, asset_dir / "one.mp4", 1, audio=True), "Kisa ses")
    kept = bytes(store.objects[original.locator][0])
    stop = asyncio.Event()
    seen = {"n": 0}

    @asynccontextmanager
    async def classify_only():
        seen["n"] += 1
        yield sample.db
        if seen["n"] >= 2:
            stop.set()

    await serve(classify_only, store=store, stop=stop)
    job = await sample.db.scalar(select(BusinessVideoCoverJob).where(BusinessVideoCoverJob.source_asset_id == original.id))
    assert job.status == "awaiting_encode" and job.result_asset_id is None
    claimed = await claim_encode(sample.db)
    await sample.db.commit()
    claimed.attempts = claimed.max_attempts
    claimed.deadline_at = datetime.now(timezone.utc) - timedelta(seconds=5)
    await sample.db.commit()
    stop.clear()

    @asynccontextmanager
    async def recover_only():
        yield sample.db
        stop.set()

    await serve(recover_only, store=store, stop=stop)
    await sample.db.refresh(claimed)
    assert claimed.status == "failed" and claimed.error_code == "cover_job_stale"
    assert store.objects[original.locator][0] == kept
    retried = await retry_cover(sample.db, sample.business.id, sample.editor.id, original.id)
    assert retried.status == "awaiting_encode"
    stop.clear()
    seen["n"] = 0

    @asynccontextmanager
    async def encode_once():
        seen["n"] += 1
        if seen["n"] >= 3:
            stop.set()
        yield sample.db

    await serve(encode_once, store=store, stop=stop)
    await sample.db.refresh(retried)
    assert retried.status == "ready" and retried.result_asset_id is not None
    assert store.objects[original.locator][0] == kept
    assert not any("/staging/" in key for key in store.objects)
