"""Implementation 2A remediation: Knowledge freshness, Asset snapshots, orphan storage.

Controlled SQLite interleavings / identity-map freshness — not PostgreSQL lock proofs.
"""
from __future__ import annotations

import hashlib
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.models.business_brand_assets import BusinessKnowledgeAssetLink as Link
from backend.models.business_yansi import BusinessKnowledgeVersion as Knowledge
from backend.models.business_yansi import BusinessMember
from backend.models.production import User
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.video_authority import assign_member_role
from backend.tests.test_business_video_cover_policy import asset_dir, sample
from backend.tests.test_business_yansi import source

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24


def _patch_lock_after(monkeypatch, side_effect):
    real_lock = media.business_media_lock

    @asynccontextmanager
    async def lock_spy(db, business_id):
        await side_effect(db)
        async with real_lock(db, business_id) as snap:
            yield snap

    import backend.services.business_yansi.studio_media as studio_mod

    monkeypatch.setattr(studio_mod, "business_media_lock", lock_spy)


def _image_path(business_id, payload: bytes) -> Path:
    digest = hashlib.sha256(payload).hexdigest()
    return library.asset_root() / str(business_id) / f"{digest}.png"


# --- A: stale Knowledge / set_links ---


async def test_two_session_archived_knowledge_rejected_by_set_links(sample, asset_dir):
    """Session A identity map stays published while Session B archives; set_links must reject."""
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    stale = await sample.db.get(Knowledge, knowledge.id)
    assert stale is not None and stale.status == "published" and stale.public_allowed is True

    asset = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "link", "title": "Atolye", "locator": "https://bilign.example/a", "public_allowed": True},
    )

    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        remote = await session_b.get(Knowledge, knowledge.id)
        remote.status = "archived"
        remote.public_allowed = False
        remote.revision += 1
        await session_b.commit()

    assert stale.status == "published"
    assert stale.public_allowed is True

    with pytest.raises(HTTPException) as raised:
        await library.set_links(
            sample.db, sample.business.id, sample.editor.id, asset.id, [knowledge.id], asset.revision,
        )
    assert raised.value.status_code == 422
    assert raised.value.detail["code"] == "published_knowledge_required"
    links = list(
        (await sample.db.scalars(select(Link).where(Link.asset_id == asset.id, Link.status == "active"))).all()
    )
    assert links == []
    assert stale.title  # identity-map object still present; not wiped by decision read


async def test_two_session_public_allowed_false_rejected_by_set_links(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    stale = await sample.db.get(Knowledge, knowledge.id)
    asset = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "link", "title": "Atolye", "locator": "https://bilign.example/b", "public_allowed": True},
    )

    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        remote = await session_b.get(Knowledge, knowledge.id)
        assert remote.status == "published"
        remote.public_allowed = False
        remote.revision += 1
        await session_b.commit()

    assert stale.public_allowed is True
    with pytest.raises(HTTPException) as raised:
        await library.set_links(
            sample.db, sample.business.id, sample.editor.id, asset.id, [knowledge.id], asset.revision,
        )
    assert raised.value.detail["code"] == "published_knowledge_required"


async def test_cross_business_knowledge_rejected_by_set_links(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    other_biz = await svc.create_business(
        sample.db, sample.admin,
        {"organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id), "slug": "other-brand", "name": "Other"},
    )
    foreign = await svc.create_knowledge(
        sample.db, other_biz.id, sample.outsider.id,
        {"title": "Yabanci", "content": "Baska marka kaydi yeterince aciktir.", "source": "dis", "publicAllowed": True},
    )
    asset = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "link", "title": "Atolye", "locator": "https://bilign.example/c", "public_allowed": True},
    )
    with pytest.raises(HTTPException) as raised:
        await library.set_links(
            sample.db, sample.business.id, sample.editor.id, asset.id, [foreign.id], asset.revision,
        )
    assert raised.value.detail["code"] == "published_knowledge_required"
    # Local knowledge still linkable
    before = asset.revision
    linked = await library.set_links(
        sample.db, sample.business.id, sample.editor.id, asset.id, [knowledge.id], before,
    )
    assert linked.revision == before + 1


async def test_dirty_knowledge_orm_preserved_across_set_links_reject(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    knowledge.title = "DirtyLocalTitle"
    knowledge.status = "published"  # dirty lie vs upcoming archive
    asset = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "link", "title": "Atolye", "locator": "https://bilign.example/d", "public_allowed": True},
    )
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        remote = await session_b.get(Knowledge, knowledge.id)
        remote.status = "archived"
        remote.public_allowed = False
        await session_b.commit()

    with pytest.raises(HTTPException):
        await library.set_links(
            sample.db, sample.business.id, sample.editor.id, asset.id, [knowledge.id], asset.revision,
        )
    assert knowledge.title == "DirtyLocalTitle"


async def test_set_links_decision_read_no_unintended_autoflush(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "link", "title": "Atolye", "locator": "https://bilign.example/e", "public_allowed": True},
    )
    ghost = User(id=uuid.uuid4(), email=f"g-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
    sample.db.add(ghost)
    await sample.db.flush()
    pending = BusinessMember(business_id=sample.business.id, user_id=ghost.id, role="viewer")
    sample.db.add(pending)
    assert pending in sample.db.new
    snap = await library._knowledge_decision_for_link(sample.db, sample.business.id, knowledge.id)
    assert snap.status == "published"
    assert pending in sample.db.new
    await sample.db.rollback()


# --- C: dirty Asset freshness ---


async def test_dirty_asset_title_preserved_after_revision_conflict(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Atolye", "caption": "", "public_allowed": True},
        image_bytes=_PNG + b"dirty-title",
    )
    asset.title = "DirtyPendingTitle"
    with pytest.raises(HTTPException) as raised:
        await library.update_asset(
            sample.db, sample.business.id, sample.editor.id, asset.id,
            {"title": "Yeni", "caption": "", "public_allowed": True, "revision": asset.revision - 1},
        )
    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "revision_conflict"
    assert asset.title == "DirtyPendingTitle"


async def test_dirty_asset_status_and_revision_preserved_on_conflict(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "link", "title": "Atolye", "locator": "https://bilign.example/f", "public_allowed": True},
    )
    committed_revision = asset.revision
    asset.status = "archived"  # dirty lie
    asset.revision = 99  # dirty lie
    with pytest.raises(HTTPException) as raised:
        await library.archive_asset(
            sample.db, sample.business.id, sample.editor.id, asset.id, committed_revision - 1,
        )
    assert raised.value.detail["code"] == "revision_conflict"
    assert asset.status == "archived"
    assert asset.revision == 99
    await sample.db.rollback()


async def test_asset_decision_ignores_unflushed_dirty_revision(sample, asset_dir):
    """Projected decision reads DB columns; dirty ORM revision/title stay on the instance."""
    asset = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "link", "title": "Atolye", "locator": "https://bilign.example/g", "public_allowed": True},
    )
    committed = asset.revision
    async with media.business_media_lock(sample.db, sample.business.id):
        asset.revision = 50
        asset.title = "DirtyPendingTitle"
        snap = await library._asset_decision(sample.db, sample.business.id, asset.id, lock=True)
        assert snap.revision == committed
        assert snap.title == "Atolye"
        assert asset.revision == 50
        assert asset.title == "DirtyPendingTitle"
    await sample.db.rollback()


async def test_successful_update_bumps_authoritative_revision(sample, asset_dir):
    asset = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "link", "title": "Atolye", "locator": "https://bilign.example/h", "public_allowed": True},
    )
    committed = asset.revision
    updated = await library.update_asset(
        sample.db, sample.business.id, sample.editor.id, asset.id,
        {"title": "Guncel", "caption": "", "public_allowed": True, "revision": committed},
    )
    assert updated.title == "Guncel"
    assert updated.revision == committed + 1


# --- B: orphan storage / shared hash ---


async def test_upload_rejected_after_demotion_does_not_store_file(sample, asset_dir, monkeypatch):
    payload = _PNG + b"orphan-reject"
    target = _image_path(sample.business.id, payload)
    assert not target.exists()
    stores: list[bytes] = []
    real_store = library.store_image

    def spy(business_id, image_bytes):
        stores.append(image_bytes)
        return real_store(business_id, image_bytes)

    monkeypatch.setattr(library, "store_image", spy)

    async def demote(db):
        await assign_member_role(db, sample.business.id, sample.owner.id, sample.editor.id, "viewer")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await library.create_asset(
            sample.db, sample.business.id, sample.editor.id,
            {"asset_type": "image", "title": "Orphan", "caption": "", "public_allowed": True},
            image_bytes=payload,
        )
    assert raised.value.status_code == 403
    assert stores == []
    assert not target.exists()
    count = await sample.db.scalar(select(Asset).where(Asset.business_id == sample.business.id, Asset.title == "Orphan"))
    assert count is None


async def test_shared_hash_file_remains_intact_on_rejected_upload(sample, asset_dir, monkeypatch):
    payload = _PNG + b"shared-hash"
    first = await library.create_asset(
        sample.db, sample.business.id, sample.owner.id,
        {"asset_type": "image", "title": "Ilk", "caption": "", "public_allowed": True},
        image_bytes=payload,
    )
    target = _image_path(sample.business.id, payload)
    assert target.is_file()
    before = target.read_bytes()

    async def demote(db):
        await assign_member_role(db, sample.business.id, sample.owner.id, sample.editor.id, "viewer")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException):
        await library.create_asset(
            sample.db, sample.business.id, sample.editor.id,
            {"asset_type": "image", "title": "Ikinci", "caption": "", "public_allowed": True},
            image_bytes=payload,
        )
    assert target.is_file()
    assert target.read_bytes() == before
    await sample.db.refresh(first)
    assert first.locator.endswith(".png")


async def test_cleanup_failure_cannot_remove_referenced_content(sample, asset_dir, monkeypatch):
    """No delete-on-auth-failure path: shared content must survive even if unlink would fail."""
    payload = _PNG + b"no-cleanup"
    await library.create_asset(
        sample.db, sample.business.id, sample.owner.id,
        {"asset_type": "image", "title": "Paylasilan", "caption": "", "public_allowed": True},
        image_bytes=payload,
    )
    target = _image_path(sample.business.id, payload)
    assert target.is_file()

    def boom_unlink(self):
        raise OSError("cleanup exploded")

    monkeypatch.setattr(Path, "unlink", boom_unlink)

    async def demote(db):
        await db.execute(
            update(BusinessMember)
            .where(
                BusinessMember.business_id == sample.business.id,
                BusinessMember.user_id == sample.editor.id,
            )
            .values(role="viewer")
            .execution_options(synchronize_session=False)
        )
        await db.commit()

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException):
        await library.create_asset(
            sample.db, sample.business.id, sample.editor.id,
            {"asset_type": "image", "title": "Red", "caption": "", "public_allowed": True},
            image_bytes=payload,
        )
    assert target.is_file()
    assert target.read_bytes() == payload
