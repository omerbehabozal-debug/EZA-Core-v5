"""Private video preview, segment changes, and cover retry."""
import uuid

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from backend.auth.deps import get_current_user
from backend.core.utils.dependencies import get_db
from backend.routers import business_yansi as routes
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.cover_jobs import present_job, process_one, retarget_cover, retry_cover
from backend.services.business_yansi.video_ingest import ingest_upload
from backend.services.business_yansi.video_preview import parse_byte_range, preview_video
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


def test_chosen_span_uses_the_stored_window():
    from backend.services.business_yansi.cover_encode import segment_seconds

    assert segment_seconds("chosen_span", 5000, 15000, 1000) == (5.0, 10.0)


def test_byte_range_windows_and_rejection():
    assert parse_byte_range(None, 10) == (0, 9)
    assert parse_byte_range("bytes=-4", 10) == (6, 9)
    assert parse_byte_range("bytes=8-", 10) == (8, 9)
    with pytest.raises(HTTPException) as rejected:
        parse_byte_range("bytes=0-1,2-3", 10)
    assert rejected.value.status_code == 416


async def _film(sample, store, body, title="Atolye filmi"):
    return await ingest_upload(
        sample.db, sample.business.id, sample.editor.id, store=store, upload=Upload(body),
        title=title, caption="", purpose="step", public_allowed=True,
    )


async def test_segment_and_retry_leave_explicit_and_approved_plans(sample, asset_dir):
    from backend.services.business_yansi import brand_asset_library as library

    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    # Valid 1x1 PNG — truncated PNG headers are rejected by prepare_brand_library_image.
    _png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
        b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    image = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Atolye gorseli", "caption": "", "public_allowed": True,
    }, image_bytes=_png)
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
    film = await _confirm(sample, knowledge, await _film(sample, store, _mp4(seconds=40, with_audio=True)))
    original = bytes(store.objects[film.locator][0])
    await process_one(sample.db)
    await sample.db.commit()
    with pytest.raises(HTTPException) as too_long:
        await retarget_cover(sample.db, sample.business.id, sample.editor.id, film.id, 0, 21)
    assert too_long.value.detail["code"] == "cover_segment_rejected"
    with pytest.raises(HTTPException) as viewer:
        await retarget_cover(sample.db, sample.business.id, sample.viewer.id, film.id, 5, 15)
    assert viewer.value.status_code == 403
    changed = await retarget_cover(sample.db, sample.business.id, sample.editor.id, film.id, 5, 15)
    assert changed.status == "awaiting_encode" and changed.strategy == "chosen_span"
    assert changed.start_ticks == 5000 and changed.end_ticks == 15000 and changed.result_asset_id is None
    assert store.objects[film.locator][0] == original
    await sample.db.refresh(explicit)
    await sample.db.refresh(approved)
    assert explicit.media_plan["coverAssetId"] == str(image.id) and explicit.revision == explicit_revision
    assert approved.media_plan["seal"] == sealed and approved.media_plan["coverAssetId"] == str(image.id)
    assert media.media_seal(approved.media_plan) == sealed
    shown = present_job(changed, film.verified_timescale)
    assert shown["startSeconds"] == 5 and shown["endSeconds"] == 15
    assert film.locator not in str(shown) and "brand-videos" not in str(shown)
    changed.status = "failed"
    changed.error_code = "cover_derivative_too_large"
    await sample.db.commit()
    with pytest.raises(HTTPException) as outsider:
        await retry_cover(sample.db, sample.business.id, sample.outsider.id, film.id)
    assert outsider.value.status_code == 403
    retried = await retry_cover(sample.db, sample.business.id, sample.editor.id, film.id)
    assert retried.status == "awaiting_encode" and retried.attempts == 0 and retried.error_code is None
    with pytest.raises(HTTPException) as not_failed:
        await retry_cover(sample.db, sample.business.id, sample.editor.id, film.id)
    assert not_failed.value.detail["code"] == "cover_retry_rejected"
    await sample.db.refresh(approved)
    assert approved.media_plan["seal"] == sealed


async def test_preview_range_stays_inside_the_brand(sample):
    store = MemoryVideoStore()
    film = await _film(sample, store, _mp4(seconds=2))
    body = store.objects[film.locator][0]
    opened = await preview_video(sample.db, sample.business.id, sample.viewer.id, film.id, "bytes=0-3", store)
    assert opened["status"] == 206 and opened["body"] == body[:4]
    assert opened["headers"]["Cache-Control"] == "private, no-store"
    assert opened["headers"]["Accept-Ranges"] == "bytes"
    assert film.locator not in str(opened["headers"]) and "brand-videos" not in str(opened["headers"])
    whole = await preview_video(sample.db, sample.business.id, sample.editor.id, film.id, None, store)
    assert whole["status"] == 200 and whole["body"] == body
    with pytest.raises(HTTPException) as outsider:
        await preview_video(sample.db, sample.business.id, sample.outsider.id, film.id, None, store)
    assert outsider.value.status_code == 403
    with pytest.raises(HTTPException) as missing:
        await preview_video(sample.db, sample.business.id, sample.editor.id, uuid.uuid4(), None, store)
    assert missing.value.detail["code"] == "asset_not_found"
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id), "slug": "baska-onizleme", "name": "Baska",
    })
    foreign = await ingest_upload(
        sample.db, other.id, sample.outsider.id, store=store, upload=Upload(_mp4(seconds=2)),
        title="Baska film", caption="", purpose="step", public_allowed=True,
    )
    with pytest.raises(HTTPException) as cross:
        await preview_video(sample.db, other.id, sample.editor.id, foreign.id, None, store)
    assert cross.value.status_code == 403
    with pytest.raises(HTTPException) as hidden:
        await preview_video(sample.db, sample.business.id, sample.editor.id, foreign.id, None, store)
    assert hidden.value.detail["code"] == "asset_not_found"
    assert foreign.locator not in str(hidden.value.detail)
    app = FastAPI()
    app.include_router(routes.router)

    async def db_override():
        yield sample.db

    app.dependency_overrides[get_db] = db_override

    def same_store():
        return store

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr("backend.services.business_yansi.video_storage.video_store_from_env", same_store)
    monkeypatch.setattr(
        "backend.services.business_yansi.library_media_ticket.resolve_jwt_secret",
        lambda _settings=None: "library-media-ticket-test-secret",
    )
    try:
        from backend.services.business_yansi.library_media_ticket import mint_library_video_ticket

        minted = mint_library_video_ticket(
            user_id=sample.viewer.id,
            business_id=sample.business.id,
            asset_id=film.id,
        )
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://studio") as client:
            response = await client.get(
                f"/api/business-yansi/{sample.business.id}/assets/{film.id}/video",
                params={"ticket": minted["ticket"]},
                headers={"Range": "bytes=1-2"},
            )
        assert response.status_code == 206
        assert response.content == body[1:3]
        assert response.headers["cache-control"] == "private, no-store"
        assert response.headers["content-length"] == "2"
        assert "brand-videos" not in response.headers.get("content-disposition", "")
        assert film.locator not in response.text
    finally:
        monkeypatch.undo()
