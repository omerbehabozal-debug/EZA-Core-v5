"""Studio brand-asset library: storage, links, roles, and version confirmation."""
import uuid

import pytest
from fastapi import FastAPI, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import Base
from backend.models.business_brand_assets import BusinessBrandAsset, BusinessKnowledgeAssetLink
from backend.models.production import Organization
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import service as svc
from backend.services.business_yansi.brand_assets import public_media_allowed
from backend.tests.test_business_yansi import sample, source


_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24


@pytest.fixture
def asset_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path))
    return tmp_path


async def _tables(db: AsyncSession):
    def create(sync_session):
        Base.metadata.create_all(sync_session.connection(), tables=[BusinessBrandAsset.__table__, BusinessKnowledgeAssetLink.__table__])
    await db.run_sync(create)


async def _view(db, business_id, asset_id):
    rows = await library.listed_assets(db, business_id)
    return next(row for row in rows if row["id"] == str(asset_id))


@pytest.mark.asyncio
async def test_image_is_stored_without_exposing_the_storage_key(sample, asset_dir):
    await _tables(sample.db)
    row = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Atölye", "caption": "Giriş", "public_allowed": True},
        image_bytes=_PNG,
    )
    view = await _view(sample.db, sample.business.id, row.id)
    assert view["locator"] is None
    assert view["locator_kind"] == "storage"
    assert "brand-assets/" not in str(view)
    data, mime = await library.stored_preview(sample.db, sample.business.id, sample.viewer.id, row.id)
    assert data == _PNG and mime == "image/png"
    with pytest.raises(HTTPException) as denied:
        await library.stored_preview(sample.db, sample.business.id, sample.outsider.id, row.id)
    assert denied.value.status_code == 403
    with pytest.raises(HTTPException):
        await library.read_stored_image(sample.other.id, row.locator)


@pytest.mark.asyncio
async def test_video_link_and_place_use_stage1_validation(sample, asset_dir):
    await _tables(sample.db)
    video = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "video", "title": "Tur", "caption": "Kısa tur", "locator": "https://cdn.bilign.example/tur.mp4", "public_allowed": False,
    })
    link = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "link", "title": "Site", "caption": "Hakkında", "locator": "https://bilign.example/hakkinda", "public_allowed": True,
    })
    place = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "place", "title": "Atölye", "caption": "Karaköy", "latitude": "41.025", "longitude": "28.974", "public_allowed": True,
    })
    edited = await library.update_asset(sample.db, sample.business.id, sample.editor.id, video.id, {
        "title": "Tur kaydı", "caption": "Kısa tur", "locator": "https://cdn.bilign.example/tur-v2.mp4", "public_allowed": True, "revision": video.revision,
    })
    assert edited.title == "Tur kaydı" and edited.locator_kind == "https" and edited.public_allowed is True
    assert edited.revision == 2
    assert link.locator == "https://bilign.example/hakkinda"
    assert str(place.latitude).startswith("41.025")
    with pytest.raises(HTTPException):
        await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
            "asset_type": "link", "title": "Kötü", "locator": "http://bilign.example", "public_allowed": True,
        })
    with pytest.raises(HTTPException):
        await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
            "asset_type": "place", "title": "Tahmin", "caption": "Adres", "public_allowed": True,
        })


@pytest.mark.asyncio
async def test_asset_can_stay_unlinked_or_confirm_several_records(sample, asset_dir):
    await _tables(sample.db)
    first = await source(sample, title="Birinci", content="Birinci kayıt yeterince açık bir cümledir.")
    second = await source(sample, title="İkinci", content="İkinci kayıt yeterince açık bir cümledir.")
    asset = await library.create_asset(sample.db, sample.business.id, sample.owner.id, {
        "asset_type": "link", "title": "Ortak", "locator": "https://bilign.example/ortak", "public_allowed": True,
    })
    alone = await _view(sample.db, sample.business.id, asset.id)
    assert alone["links"] == []
    linked = await library.set_links(sample.db, sample.business.id, sample.editor.id, asset.id, [first.id, second.id], asset.revision)
    view = await _view(sample.db, sample.business.id, linked.id)
    assert {item["knowledge_title"] for item in view["links"] if item["status"] == "active"} == {"Birinci", "İkinci"}
    assert all(item["confirmation_current"] for item in view["links"] if item["status"] == "active")


@pytest.mark.asyncio
async def test_new_knowledge_version_keeps_the_old_confirmation_until_reapproved(sample, asset_dir):
    await _tables(sample.db)
    current = await source(sample, title="Saatler", content="Atölye hafta içi açıktır.")
    asset = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "place", "title": "Atölye", "caption": "Karaköy", "latitude": "41.02", "longitude": "28.97", "public_allowed": True,
    })
    await library.set_links(sample.db, sample.business.id, sample.editor.id, asset.id, [current.id], asset.revision)
    replacement = await svc.create_knowledge(sample.db, sample.business.id, sample.editor.id, {
        "itemId": str(current.item_id), "title": "Saatler", "content": "Atölye cumartesi de açıktır.", "source": "Güncel duyuru", "publicAllowed": True,
    })
    stale = await _view(sample.db, sample.business.id, asset.id)
    link = stale["links"][0]
    assert link["confirmed_version_id"] == str(current.id)
    assert link["current_published_version_id"] == str(replacement.id)
    assert link["confirmation_current"] is False
    org = await sample.db.get(Organization, sample.business.id)
    stored_asset = await sample.db.get(BusinessBrandAsset, uuid.UUID(stale["id"]))
    stored_link = await sample.db.get(BusinessKnowledgeAssetLink, uuid.UUID(link["id"]))
    assert public_media_allowed(asset=stored_asset, link=stored_link, knowledge=replacement, profile=sample.business, organization=org) is False
    refreshed = await library.set_links(sample.db, sample.business.id, sample.editor.id, asset.id, [replacement.id], stale["revision"])
    approved = await _view(sample.db, sample.business.id, refreshed.id)
    assert approved["links"][0]["confirmation_current"] is True
    stored_link = await sample.db.get(BusinessKnowledgeAssetLink, uuid.UUID(approved["links"][0]["id"]))
    assert public_media_allowed(asset=stored_asset, link=stored_link, knowledge=replacement, profile=sample.business, organization=org) is True


@pytest.mark.asyncio
async def test_roles_isolation_and_archive_block_public_use(sample, asset_dir):
    await _tables(sample.db)
    with pytest.raises(HTTPException) as viewer:
        await library.create_asset(sample.db, sample.business.id, sample.viewer.id, {
            "asset_type": "link", "title": "Gizli", "locator": "https://bilign.example/gizli", "public_allowed": False,
        })
    assert viewer.value.status_code == 403
    with pytest.raises(HTTPException) as outsider:
        await library.list_assets(sample.db, sample.business.id, sample.outsider.id)
    assert outsider.value.status_code == 403
    with pytest.raises(HTTPException) as preview:
        await library.stored_preview(sample.db, sample.business.id, sample.outsider.id, uuid.uuid4())
    assert preview.value.status_code == 403
    assert await library.list_assets(sample.db, sample.business.id, sample.viewer.id) == []
    hidden = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "link", "title": "İç not", "locator": "https://bilign.example/ic", "public_allowed": False,
    })
    knowledge = await source(sample)
    linked = await library.set_links(sample.db, sample.business.id, sample.editor.id, hidden.id, [knowledge.id], hidden.revision)
    org = await sample.db.get(Organization, sample.business.id)
    link = (await _view(sample.db, sample.business.id, linked.id))["links"][0]
    assert public_media_allowed(
        asset=await sample.db.get(BusinessBrandAsset, hidden.id),
        link=await sample.db.get(BusinessKnowledgeAssetLink, uuid.UUID(link["id"])),
        knowledge=knowledge,
        profile=sample.business,
        organization=org,
    ) is False
    archived = await library.archive_asset(sample.db, sample.business.id, sample.owner.id, hidden.id, linked.revision)
    assert archived.status == "archived" and archived.public_allowed is False
    foreign = await library.list_assets(sample.db, sample.business.id, sample.viewer.id)
    assert all(item["business_id"] == str(sample.business.id) for item in foreign)
    with pytest.raises(HTTPException) as missing:
        await library.update_asset(sample.db, sample.other.id, sample.editor.id, hidden.id, {
            "title": "Ele geçirme", "caption": "", "revision": archived.revision, "public_allowed": True, "locator": "https://evil.example",
        })
    assert missing.value.status_code == 404


@pytest.mark.asyncio
async def test_content_route_requires_membership_and_hides_the_key(sample, asset_dir):
    await _tables(sample.db)
    from backend.routers import business_yansi as routes
    import httpx
    row = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Kapak", "caption": "", "public_allowed": True},
        image_bytes=_PNG,
    )
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[routes.get_db] = lambda: sample.db

    async def as_user(user_id):
        app.dependency_overrides[routes.get_current_user] = lambda: {"user_id": user_id}
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            listed = await client.get(f"/api/business-yansi/{sample.business.id}/assets")
            content = await client.get(f"/api/business-yansi/{sample.business.id}/assets/{row.id}/content")
            return listed, content

    listed, content = await as_user(str(sample.viewer.id))
    assert listed.status_code == 200
    assert "brand-assets/" not in listed.text
    assert content.status_code == 200 and content.content == _PNG
    assert content.headers["x-content-type-options"] == "nosniff"
    denied, _hidden = await as_user(str(sample.outsider.id))
    assert denied.status_code == 403
