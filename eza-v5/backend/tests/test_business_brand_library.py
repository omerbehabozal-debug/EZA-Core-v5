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


_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


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
    assert mime in {"image/png", "image/jpeg", "image/webp"}
    assert data and len(data) > 32
    from backend.services.profile_avatar_store import detect_image_mime
    assert detect_image_mime(data) == mime
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
    assert content.status_code == 200
    assert len(content.content) > 32
    from backend.services.profile_avatar_store import detect_image_mime
    assert detect_image_mime(content.content) in {"image/png", "image/jpeg", "image/webp"}
    assert content.headers["x-content-type-options"] == "nosniff"
    denied, _hidden = await as_user(str(sample.outsider.id))
    assert denied.status_code == 403


@pytest.mark.asyncio
async def test_cover_derivatives_are_hidden_from_library_but_kept_internally(sample, asset_dir):
    await _tables(sample.db)
    original = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {
            "asset_type": "video",
            "title": "Atölye turu",
            "caption": "Orijinal",
            "locator": "https://cdn.bilign.example/atolye.mp4",
            "public_allowed": True,
        },
    )
    image = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {"asset_type": "image", "title": "Vitrin", "caption": "", "public_allowed": True},
        image_bytes=_PNG,
    )
    digest = "ab" * 32
    derivative = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="video",
        title=original.title,
        caption="Kapak türevi",
        locator_kind="storage",
        locator=f"brand-videos/{sample.business.id}/{digest}.mp4",
        public_allowed=True,
        status="published",
        created_by=sample.editor.id,
        revision=1,
        source_asset_id=original.id,
        verified_duration=20_000,
        verified_timescale=1000,
        verified_size_bytes=1200,
        verified_has_audio=False,
    )
    sample.db.add(derivative)
    await sample.db.commit()

    listed = await library.list_assets(sample.db, sample.business.id, sample.viewer.id)
    listed_ids = {item["id"] for item in listed}
    assert str(original.id) in listed_ids
    assert str(image.id) in listed_ids
    assert str(derivative.id) not in listed_ids
    assert all(item["business_id"] == str(sample.business.id) for item in listed)

    # Existing DB rows stay; only the library list hides them (no migration).
    stored = await sample.db.get(BusinessBrandAsset, derivative.id)
    assert stored is not None and stored.source_asset_id == original.id and stored.status == "published"

    # Internal ID resolution still sees the derivative for cover / preview workflows.
    resolved = await library._asset_row(sample.db, sample.business.id, derivative.id)
    assert resolved.id == derivative.id
    assert resolved.source_asset_id == original.id

    archived = await library.archive_asset(
        sample.db, sample.business.id, sample.editor.id, original.id, original.revision,
    )
    assert archived.status == "archived" and archived.public_allowed is False
    still = await sample.db.get(BusinessBrandAsset, derivative.id)
    assert still is not None and still.status == "published" and still.source_asset_id == original.id

    with pytest.raises(HTTPException) as foreign:
        await library._asset_row(sample.db, sample.other.id, derivative.id)
    assert foreign.value.status_code == 404


def _draft_steps(knowledge_id):
    return [
        {"question": f"Soru {index}?", "answer": f"Cevap {index}.", "sources": [str(knowledge_id)]}
        for index in range(1, 9)
    ]


async def _attach_draft_cover(sample, asset_id, knowledge_id):
    from backend.models.business_yansi import BusinessYansiDraft

    row = BusinessYansiDraft(
        business_id=sample.business.id,
        title="Taslak Yansı",
        summary="Özet",
        steps=_draft_steps(knowledge_id),
        knowledge_snapshot=[str(knowledge_id)],
        media_plan={
            "coverAssetId": str(asset_id),
            "blocks": [[] for _ in range(8)],
            "seal": None,
            "coverMode": "explicit",
        },
        source_hash="a" * 64,
        created_by=sample.editor.id,
        status="draft",
        revision=1,
    )
    sample.db.add(row)
    await sample.db.commit()
    return row


@pytest.mark.asyncio
async def test_unused_asset_can_be_deleted_permanently(sample, asset_dir):
    await _tables(sample.db)
    image = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {"asset_type": "image", "title": "Silinecek", "caption": "", "public_allowed": False},
        image_bytes=_PNG,
    )
    path = library.asset_root() / str(sample.business.id) / image.locator.rsplit("/", 1)[-1]
    assert path.is_file()
    result = await library.delete_asset(
        sample.db, sample.business.id, sample.editor.id, image.id, image.revision,
    )
    assert result == {"id": str(image.id), "deleted": True}
    assert await sample.db.get(BusinessBrandAsset, image.id) is None
    assert not path.exists()
    listed = await library.list_assets(sample.db, sample.business.id, sample.viewer.id)
    assert all(item["id"] != str(image.id) for item in listed)


@pytest.mark.asyncio
async def test_delete_rejects_assets_used_by_draft_or_foreign_business(sample, asset_dir):
    await _tables(sample.db)
    knowledge = await source(sample, content="Atölye kapak seçimi için yeterince açık bir cümledir.")
    image = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {"asset_type": "image", "title": "Kapak", "caption": "", "public_allowed": True},
        image_bytes=_PNG,
    )
    await _attach_draft_cover(sample, image.id, knowledge.id)
    with pytest.raises(HTTPException) as blocked:
        await library.delete_asset(sample.db, sample.business.id, sample.editor.id, image.id, image.revision)
    assert blocked.value.status_code == 409
    assert blocked.value.detail["code"] == "asset_in_use"
    assert await sample.db.get(BusinessBrandAsset, image.id) is not None

    with pytest.raises(HTTPException) as foreign:
        await library.delete_asset(sample.db, sample.other.id, sample.editor.id, image.id, image.revision)
    assert foreign.value.status_code in {403, 404}


@pytest.mark.asyncio
async def test_delete_keeps_shared_storage_and_removes_unused_derivatives(sample, asset_dir, monkeypatch):
    await _tables(sample.db)
    first = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {"asset_type": "image", "title": "Bir", "caption": "", "public_allowed": False},
        image_bytes=_PNG,
    )
    second = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {"asset_type": "image", "title": "İki", "caption": "", "public_allowed": False},
        image_bytes=_PNG,
    )
    assert first.locator == second.locator
    path = library.asset_root() / str(sample.business.id) / first.locator.rsplit("/", 1)[-1]
    assert path.is_file()

    await library.delete_asset(sample.db, sample.business.id, sample.editor.id, first.id, first.revision)
    assert path.is_file()
    assert await sample.db.get(BusinessBrandAsset, second.id) is not None

    original = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {
            "asset_type": "video",
            "title": "Tur",
            "caption": "",
            "locator": "https://cdn.bilign.example/tur.mp4",
            "public_allowed": True,
        },
    )
    derivative = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="video",
        title=original.title,
        caption="Türev",
        locator_kind="storage",
        locator=f"brand-videos/{sample.business.id}/{'cd' * 32}.mp4",
        public_allowed=True,
        status="published",
        created_by=sample.editor.id,
        revision=1,
        source_asset_id=original.id,
        verified_duration=10_000,
        verified_timescale=1000,
        verified_size_bytes=800,
        verified_has_audio=False,
    )
    sample.db.add(derivative)
    await sample.db.commit()
    knowledge = await source(sample, title="Türev koruma", content="Kapak türevi referansı korunmalıdır.")
    await _attach_draft_cover(sample, derivative.id, knowledge.id)
    with pytest.raises(HTTPException) as blocked:
        await library.delete_asset(
            sample.db, sample.business.id, sample.editor.id, original.id, original.revision,
        )
    assert blocked.value.status_code == 409
    assert blocked.value.detail["code"] == "asset_in_use"
    assert await sample.db.get(BusinessBrandAsset, original.id) is not None
    assert await sample.db.get(BusinessBrandAsset, derivative.id) is not None

    # Drop the draft reference, then deleting the original clears the unused derivative too.
    from backend.models.business_yansi import BusinessYansiDraft
    from backend.services.business_yansi.video_storage import MemoryVideoStore
    from sqlalchemy import delete as sql_delete

    await sample.db.execute(sql_delete(BusinessYansiDraft).where(BusinessYansiDraft.business_id == sample.business.id))
    await sample.db.commit()
    await sample.db.refresh(original)
    store = MemoryVideoStore()
    store.objects[derivative.locator] = (b"cover", "cd" * 32)

    class _ReadyStore:
        def __init__(self, inner):
            self.inner = inner

        async def delete(self, key: str) -> None:
            await self.inner.delete(key)

        async def aclose(self) -> None:
            return None

    # Local test double: production still requires configured R2 before unique video purge.
    monkeypatch.setattr(library, "_video_store_ready", lambda: _ReadyStore(store))
    await library.delete_asset(
        sample.db, sample.business.id, sample.editor.id, original.id, original.revision,
    )
    assert await sample.db.get(BusinessBrandAsset, original.id) is None
    assert await sample.db.get(BusinessBrandAsset, derivative.id) is None
    assert derivative.locator not in store.objects
    listed = await library.listed_assets(sample.db, sample.business.id)
    assert all(item["id"] not in {str(original.id), str(derivative.id)} for item in listed)


@pytest.mark.asyncio
async def test_present_asset_by_id_includes_hidden_cover_derivatives(sample, asset_dir):
    await _tables(sample.db)
    original = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {
            "asset_type": "video",
            "title": "Kaynak",
            "caption": "",
            "locator": "https://cdn.bilign.example/kaynak.mp4",
            "public_allowed": True,
        },
    )
    derivative = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="video",
        title=original.title,
        caption="Kapak",
        locator_kind="storage",
        locator=f"brand-videos/{sample.business.id}/{'ef' * 32}.mp4",
        public_allowed=True,
        status="published",
        created_by=sample.editor.id,
        revision=1,
        source_asset_id=original.id,
        verified_duration=12_000,
        verified_timescale=1000,
        verified_size_bytes=900,
        verified_has_audio=False,
    )
    sample.db.add(derivative)
    await sample.db.commit()

    listed_ids = {item["id"] for item in await library.listed_assets(sample.db, sample.business.id)}
    assert str(original.id) in listed_ids
    assert str(derivative.id) not in listed_ids

    view = await library.present_asset_by_id(sample.db, sample.business.id, derivative.id)
    assert view["id"] == str(derivative.id)
    assert view["locator"] is None
    assert view["locator_kind"] == "storage"
    assert view["business_id"] == str(sample.business.id)

    with pytest.raises(HTTPException) as foreign:
        await library.present_asset_by_id(sample.db, sample.other.id, derivative.id)
    assert foreign.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_refuses_unique_video_when_storage_unconfigured(sample, asset_dir, monkeypatch):
    await _tables(sample.db)
    original = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {
            "asset_type": "video",
            "title": "Depo",
            "caption": "",
            "locator": "https://cdn.bilign.example/remote.mp4",
            "public_allowed": False,
        },
    )
    derivative = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="video",
        title=original.title,
        caption="Türev",
        locator_kind="storage",
        locator=f"brand-videos/{sample.business.id}/{'11' * 32}.mp4",
        public_allowed=False,
        status="published",
        created_by=sample.editor.id,
        revision=1,
        source_asset_id=original.id,
        verified_duration=9_000,
        verified_timescale=1000,
        verified_size_bytes=700,
        verified_has_audio=False,
    )
    sample.db.add(derivative)
    await sample.db.commit()

    monkeypatch.setattr(library, "_video_store_ready", lambda: None)
    with pytest.raises(HTTPException) as blocked:
        await library.delete_asset(
            sample.db, sample.business.id, sample.editor.id, original.id, original.revision,
        )
    assert blocked.value.status_code == 503
    assert blocked.value.detail["code"] == "video_storage_unconfigured"
    assert await sample.db.get(BusinessBrandAsset, original.id) is not None
    assert await sample.db.get(BusinessBrandAsset, derivative.id) is not None


@pytest.mark.asyncio
async def test_delete_reports_pending_cleanup_when_image_unlink_fails(sample, asset_dir, monkeypatch):
    await _tables(sample.db)
    image = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {"asset_type": "image", "title": "Temizlik", "caption": "", "public_allowed": False},
        image_bytes=_PNG,
    )
    path = library.asset_root() / str(sample.business.id) / image.locator.rsplit("/", 1)[-1]
    assert path.is_file()

    class BrokenPath:
        def __init__(self, real):
            self._real = real

        def is_file(self):
            return True

        def unlink(self):
            raise OSError("locked")

    monkeypatch.setattr(library, "_image_path_for_locator", lambda *_args, **_kwargs: BrokenPath(path))
    result = await library.delete_asset(
        sample.db, sample.business.id, sample.editor.id, image.id, image.revision,
    )
    assert result["deleted"] is True
    assert result["id"] == str(image.id)
    assert result["storageCleanupPending"] == [image.locator]
    assert await sample.db.get(BusinessBrandAsset, image.id) is None
    assert path.is_file()


@pytest.mark.asyncio
async def test_historical_confirmed_asset_id_does_not_block_unused_delete(sample, asset_dir):
    """Proposal JSON may keep confirmedAssetId; only live media_plan references block delete."""
    await _tables(sample.db)
    from backend.models.business_cover_ai import BusinessCoverAiProposal as Proposal

    image = await library.create_asset(
        sample.db,
        sample.business.id,
        sample.editor.id,
        {"asset_type": "image", "title": "AI kapak", "caption": "", "public_allowed": True},
        image_bytes=_PNG,
    )
    sample.db.add(
        Proposal(
            business_id=sample.business.id,
            actor_id=sample.editor.id,
            idempotency_key="history-confirm-1",
            request_hash="b" * 64,
            kind="image_cover",
            status="succeeded",
            request_payload={"draftId": str(uuid.uuid4()), "draftRevision": 1},
            result_payload={"confirmedAssetId": str(image.id)},
            reserved_cost_usd="0.01",
            cost_usd="0.01",
            cost_known=True,
            cost_limit_usd="1.00",
            quota_day=__import__("datetime").date.today(),
            attempts=1,
            max_attempts=1,
        )
    )
    await sample.db.commit()
    result = await library.delete_asset(
        sample.db, sample.business.id, sample.editor.id, image.id, image.revision,
    )
    assert result["deleted"] is True
    assert await sample.db.get(BusinessBrandAsset, image.id) is None
