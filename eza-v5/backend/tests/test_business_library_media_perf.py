"""Content Library P0 media performance: thumbnails, tickets, and Range windows."""
from __future__ import annotations

import io

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from PIL import Image

from backend.auth.deps import get_current_user
from backend.core.utils.dependencies import get_db
from backend.routers import business_yansi as routes
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi.library_media_ticket import (
    mint_library_video_ticket,
    parse_library_video_ticket,
)
from backend.services.business_yansi.video_ingest import ingest_upload
from backend.services.business_yansi.video_preview import parse_byte_range, preview_headers, preview_video
from backend.services.business_yansi.video_storage import MemoryVideoStore
from backend.tests.test_business_video_storage import Upload, VideoQuotaRedis, _mp4
from backend.tests.test_business_yansi import sample


@pytest.fixture
def asset_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture(autouse=True)
def _budget_and_probe(monkeypatch):
    quota = VideoQuotaRedis()

    async def client():
        return quota

    monkeypatch.setattr("backend.services.business_yansi.video_ingest._redis", client)

    async def accept(_path: str) -> None:
        return None

    monkeypatch.setattr("backend.services.business_yansi.video_mp4.probe_file", accept)


def _png_bytes(*, width: int, height: int) -> bytes:
    image = Image.new("RGB", (width, height), (40, 80, 120))
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def test_byte_range_bounded_open_and_invalid():
    assert parse_byte_range("bytes=0-3", 10) == (0, 3)
    assert parse_byte_range("bytes=8-", 10) == (8, 9)
    assert parse_byte_range(None, 10) == (0, 9)
    with pytest.raises(HTTPException) as rejected:
        parse_byte_range("bytes=0-1,2-3", 10)
    assert rejected.value.status_code == 416
    with pytest.raises(HTTPException) as past_end:
        parse_byte_range("bytes=20-30", 10)
    assert past_end.value.status_code == 416
    headers = preview_headers(0, 3, 10, ranged=True)
    assert headers["Content-Length"] == "4"
    assert headers["Content-Range"] == "bytes 0-3/10"
    assert headers["Cache-Control"] == "private, no-store"


def test_library_video_ticket_round_trip_and_expiry(monkeypatch):
    monkeypatch.setattr(
        "backend.services.business_yansi.library_media_ticket.resolve_jwt_secret",
        lambda _settings=None: "library-media-ticket-test-secret",
    )
    minted = mint_library_video_ticket(
        user_id="11111111-1111-1111-1111-111111111111",
        business_id="22222222-2222-2222-2222-222222222222",
        asset_id="33333333-3333-3333-3333-333333333333",
        ttl_seconds=60,
    )
    assert minted["expiresIn"] == 60
    defaulted = mint_library_video_ticket(
        user_id="11111111-1111-1111-1111-111111111111",
        business_id="22222222-2222-2222-2222-222222222222",
        asset_id="33333333-3333-3333-3333-333333333333",
    )
    assert defaulted["expiresIn"] == 600
    parsed = parse_library_video_ticket(minted["ticket"])
    assert parsed["user_id"].startswith("11111111")
    assert parsed["business_id"].startswith("22222222")
    assert parsed["asset_id"].startswith("33333333")
    with pytest.raises(HTTPException) as bad:
        parse_library_video_ticket(minted["ticket"][:-4] + "dead")
    assert bad.value.status_code == 401
    monkeypatch.setattr(
        "backend.services.business_yansi.library_media_ticket.time.time",
        lambda: minted["expiresAt"] + 5,
    )
    with pytest.raises(HTTPException) as expired:
        parse_library_video_ticket(minted["ticket"])
    assert expired.value.status_code == 401


async def test_card_thumbnail_is_smaller_than_original_and_keeps_ids(sample, asset_dir):
    original = _png_bytes(width=1600, height=900)
    row = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {"asset_type": "image", "title": "Atolye", "caption": "", "public_allowed": False},
        image_bytes=original,
    )
    original_id = row.id
    original_locator = row.locator
    full, full_mime = await library.stored_preview(sample.db, sample.business.id, sample.viewer.id, row.id)
    thumb, thumb_mime = await library.stored_card_thumbnail(sample.db, sample.business.id, sample.viewer.id, row.id)
    assert full_mime.startswith("image/")
    assert thumb_mime == "image/jpeg"
    assert len(thumb) < len(full)
    with Image.open(io.BytesIO(thumb)) as image:
        assert max(image.size) <= 720
        assert image.size[0] > image.size[1]  # landscape preserved as orientation
    await sample.db.refresh(row)
    assert row.id == original_id
    assert row.locator == original_locator
    archived = await library.archive_asset(sample.db, sample.business.id, sample.editor.id, row.id, row.revision)
    with pytest.raises(HTTPException) as blocked:
        await library.stored_card_thumbnail(sample.db, sample.business.id, sample.viewer.id, archived.id)
    assert blocked.value.status_code == 409


async def test_portrait_and_square_thumbnails_keep_aspect(sample, asset_dir):
    portrait = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {"asset_type": "image", "title": "Dikey", "caption": "", "public_allowed": False},
        image_bytes=_png_bytes(width=600, height=1200),
    )
    square = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {"asset_type": "image", "title": "Kare", "caption": "", "public_allowed": False},
        image_bytes=_png_bytes(width=900, height=900),
    )
    portrait_thumb, _ = await library.stored_card_thumbnail(sample.db, sample.business.id, sample.viewer.id, portrait.id)
    square_thumb, _ = await library.stored_card_thumbnail(sample.db, sample.business.id, sample.viewer.id, square.id)
    with Image.open(io.BytesIO(portrait_thumb)) as image:
        assert image.size[1] > image.size[0]
        assert max(image.size) <= 720
    with Image.open(io.BytesIO(square_thumb)) as image:
        assert image.size[0] == image.size[1]
        assert max(image.size) <= 720


async def test_video_stream_ticket_range_and_tenant_isolation(sample, monkeypatch):
    monkeypatch.setattr(
        "backend.services.business_yansi.library_media_ticket.resolve_jwt_secret",
        lambda _settings=None: "library-media-ticket-test-secret",
    )
    store = MemoryVideoStore()
    film = await ingest_upload(
        sample.db,
        sample.business.id,
        sample.editor.id,
        store=store,
        upload=Upload(_mp4(seconds=2)),
        title="Atolye filmi",
        caption="",
        purpose="step",
        public_allowed=True,
    )
    body = store.objects[film.locator][0]
    app = FastAPI()
    app.include_router(routes.router)

    async def db_override():
        yield sample.db

    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_current_user] = lambda: {"user_id": str(sample.viewer.id), "role": "user"}
    monkeypatch.setattr(
        "backend.services.business_yansi.video_storage.video_store_from_env",
        lambda: store,
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://studio") as client:
        minted = await client.post(
            f"/api/business-yansi/{sample.business.id}/assets/{film.id}/video-stream",
        )
        assert minted.status_code == 200
        stream_path = minted.json()["streamPath"]
        assert "ticket=" in stream_path
        ranged = await client.get(stream_path, headers={"Range": "bytes=0-3"})
        assert ranged.status_code == 206
        assert ranged.content == body[:4]
        assert ranged.headers["content-length"] == "4"
        assert ranged.headers["accept-ranges"] == "bytes"
        assert "brand-videos" not in ranged.headers.get("content-disposition", "")
        outsider_app = FastAPI()
        outsider_app.include_router(routes.router)
        outsider_app.dependency_overrides[get_db] = db_override
        outsider_app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(sample.outsider.id),
            "role": "user",
        }
        outsider_app_transport = ASGITransport(app=outsider_app)
        async with AsyncClient(transport=outsider_app_transport, base_url="http://studio") as outsider:
            denied = await outsider.post(
                f"/api/business-yansi/{sample.business.id}/assets/{film.id}/video-stream",
            )
            assert denied.status_code == 403

    with pytest.raises(HTTPException) as foreign_ticket:
        await preview_video(
            sample.db,
            sample.business.id,
            sample.outsider.id,
            film.id,
            "bytes=0-1",
            store,
        )
    assert foreign_ticket.value.status_code == 403
