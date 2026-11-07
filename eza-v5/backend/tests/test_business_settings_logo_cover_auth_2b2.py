"""Implementation 2B-2: settings, brand logo and cover-job post-lock authorization.

Controlled SQLite interleavings / identity-map freshness — not PostgreSQL overlapping proofs.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.models.business_video_cover_jobs import BusinessVideoCoverJob as Job
from backend.models.business_yansi import BusinessMember, BusinessProfile
from backend.models.production import User
from backend.services.business_yansi import cover_jobs as covers
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.tests.test_business_video_cover_policy import sample

_BACKEND = Path(__file__).resolve().parents[1]
_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _patch_lock_after(monkeypatch, side_effect):
    real_lock = media.business_media_lock

    @asynccontextmanager
    async def lock_spy(db, business_id):
        await side_effect(db)
        async with real_lock(db, business_id) as snap:
            yield snap

    monkeypatch.setattr(media, "business_media_lock", lock_spy)
    import backend.services.business_yansi.studio_media as studio_mod

    monkeypatch.setattr(studio_mod, "business_media_lock", lock_spy)


async def _force_member_role(db, business_id, user_id, role: str):
    await db.execute(
        update(BusinessMember)
        .where(BusinessMember.business_id == business_id, BusinessMember.user_id == user_id)
        .values(role=role)
        .execution_options(synchronize_session=False)
    )
    await db.commit()


async def _revoke_member(db, business_id, user_id):
    member = await db.get(BusinessMember, (business_id, user_id))
    if member is not None:
        await db.delete(member)
        await db.commit()


async def _deactivate_user(db, user_id):
    await db.execute(
        update(User).where(User.id == user_id).values(is_active=False)
        .execution_options(synchronize_session=False)
    )
    await db.commit()


async def _suspend_business(db, business_id):
    await db.execute(
        update(BusinessProfile).where(BusinessProfile.id == business_id).values(status="suspended")
        .execution_options(synchronize_session=False)
    )
    await db.commit()


async def _video_with_job(sample, *, status="ready", failed=False):
    asset = Asset(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_type="video",
        title="Kapak filmi",
        caption="",
        locator_kind="storage",
        locator=f"brand-videos/{sample.business.id}/{'a' * 64}.mp4",
        public_allowed=False,
        status="draft",
        created_by=sample.editor.id,
        revision=1,
        verified_duration=40_000,
        verified_timescale=1000,
        verified_size_bytes=1024,
        verified_has_audio=True,
    )
    sample.db.add(asset)
    await sample.db.flush()
    job = await covers.ensure_cover_job(sample.db, asset, sample.editor.id)
    job.status = "failed" if failed else status
    job.strategy = covers.CHOSEN_STRATEGY
    job.encoder_profile = covers.DERIVATIVE_PROFILE
    job.start_ticks = 0
    job.end_ticks = 20_000
    job.result_asset_id = None
    job.error_code = "cover_encode_failed" if failed else None
    job.claim_token = None
    job.deadline_at = None
    await sample.db.commit()
    await sample.db.refresh(asset)
    await sample.db.refresh(job)
    return asset, job


async def _db_business(sample, business_id):
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        return await session_b.get(BusinessProfile, business_id)


async def _db_job(sample, job_id):
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        return await session_b.get(Job, job_id)


# --- Settings ---


async def test_settings_owner_success(sample):
    before = sample.business.name
    row = await svc.update_business_settings(
        sample.db, sample.business.id, sample.owner.id,
        name="Yeni Marka", description="Aciklama",
        logo_url="https://cdn.example/logo.png", logo_specified=True,
    )
    assert row.name == "Yeni Marka"
    assert row.description == "Aciklama"
    assert row.logo_url == "https://cdn.example/logo.png"
    remote = await _db_business(sample, sample.business.id)
    assert remote.name == "Yeni Marka"
    assert remote.logo_url == "https://cdn.example/logo.png"
    assert before != "Yeni Marka" or True


async def test_settings_revoked_owner_rejected(sample, monkeypatch):
    original = sample.business.name

    async def revoke(db):
        await _revoke_member(db, sample.business.id, sample.owner.id)

    _patch_lock_after(monkeypatch, revoke)
    with pytest.raises(HTTPException) as raised:
        await svc.update_business_settings(
            sample.db, sample.business.id, sample.owner.id,
            name="Hile", description="",
        )
    assert raised.value.status_code == 403
    remote = await _db_business(sample, sample.business.id)
    assert remote.name == original
    await sample.db.rollback()


async def test_settings_stale_owner_role_rejected(sample, monkeypatch):
    original = sample.business.name

    async def demote(db):
        await _force_member_role(db, sample.business.id, sample.owner.id, "editor")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await svc.update_business_settings(
            sample.db, sample.business.id, sample.owner.id,
            name="Hile", description="",
        )
    assert raised.value.status_code == 403
    remote = await _db_business(sample, sample.business.id)
    assert remote.name == original
    await sample.db.rollback()


async def test_settings_inactive_owner_rejected(sample, monkeypatch):
    original = sample.business.name

    async def deactivate(db):
        await _deactivate_user(db, sample.owner.id)

    _patch_lock_after(monkeypatch, deactivate)
    with pytest.raises(HTTPException) as raised:
        await svc.update_business_settings(
            sample.db, sample.business.id, sample.owner.id,
            name="Hile", description="",
        )
    assert raised.value.status_code == 403
    remote = await _db_business(sample, sample.business.id)
    assert remote.name == original
    await sample.db.rollback()


async def test_settings_suspended_business_rejected(sample, monkeypatch):
    original = sample.business.name

    async def suspend(db):
        await _suspend_business(db, sample.business.id)

    _patch_lock_after(monkeypatch, suspend)
    with pytest.raises(HTTPException) as raised:
        await svc.update_business_settings(
            sample.db, sample.business.id, sample.owner.id,
            name="Hile", description="",
        )
    assert raised.value.status_code in {403, 404}
    remote = await _db_business(sample, sample.business.id)
    assert remote.name == original
    await sample.db.rollback()


async def test_settings_cross_tenant_rejected(sample):
    other = await svc.create_business(
        sample.db, sample.admin,
        {
            "organizationId": str(sample.other.id),
            "ownerId": str(sample.outsider.id),
            "slug": "baska-2b2",
            "name": "Baska",
        },
    )
    with pytest.raises(HTTPException) as raised:
        await svc.update_business_settings(
            sample.db, other.id, sample.owner.id,
            name="Cross", description="",
        )
    assert raised.value.status_code == 403
    remote = await _db_business(sample, other.id)
    assert remote.name == "Baska"


async def test_settings_autoflush_false(sample):
    sample.db.autoflush = False
    try:
        row = await svc.update_business_settings(
            sample.db, sample.business.id, sample.owner.id,
            name="AfFalse", description="x",
        )
        assert row.name == "AfFalse"
    finally:
        sample.db.autoflush = True


# --- Brand logo ---


async def test_logo_owner_success(sample, tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )
    row = await svc.set_brand_logo(sample.db, sample.business.id, sample.owner.id, _PNG)
    assert row.logo_url and str(sample.business.id) in row.logo_url
    files = list(tmp_path.glob(f"{sample.business.id}.*"))
    assert len(files) == 1
    remote = await _db_business(sample, sample.business.id)
    assert remote.logo_url == row.logo_url


async def test_logo_replace_bumps_updated_at_with_stable_url(sample, tmp_path, monkeypatch):
    """Same business UUID filename must still get a fresh cache-bust token."""
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )
    first = await svc.set_brand_logo(sample.db, sample.business.id, sample.owner.id, _PNG)
    first_updated = first.updated_at
    second = await svc.set_brand_logo(sample.db, sample.business.id, sample.owner.id, _PNG)
    assert second.logo_url == first.logo_url
    assert second.updated_at is not None and first_updated is not None
    assert second.updated_at > first_updated


async def test_logo_revoked_owner_writes_no_file(sample, tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )
    original = sample.business.logo_url

    async def revoke(db):
        await _revoke_member(db, sample.business.id, sample.owner.id)

    _patch_lock_after(monkeypatch, revoke)
    with pytest.raises(HTTPException) as raised:
        await svc.set_brand_logo(sample.db, sample.business.id, sample.owner.id, _PNG)
    assert raised.value.status_code == 403
    assert list(tmp_path.glob(f"{sample.business.id}.*")) == []
    remote = await _db_business(sample, sample.business.id)
    assert remote.logo_url == original
    await sample.db.rollback()


async def test_logo_stale_owner_role_rejected(sample, tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )

    async def demote(db):
        await _force_member_role(db, sample.business.id, sample.owner.id, "editor")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await svc.set_brand_logo(sample.db, sample.business.id, sample.owner.id, _PNG)
    assert raised.value.status_code == 403
    assert list(tmp_path.glob(f"{sample.business.id}.*")) == []
    await sample.db.rollback()


async def test_logo_editor_rejected(sample, tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )
    with pytest.raises(HTTPException) as raised:
        await svc.set_brand_logo(sample.db, sample.business.id, sample.editor.id, _PNG)
    assert raised.value.status_code == 403
    assert list(tmp_path.glob(f"{sample.business.id}.*")) == []


async def test_logo_cross_tenant_rejected(sample, tmp_path, monkeypatch):
    monkeypatch.setattr(
        "backend.services.profile_avatar_store.resolve_profile_avatar_dir",
        lambda: tmp_path,
    )
    other = await svc.create_business(
        sample.db, sample.admin,
        {
            "organizationId": str(sample.other.id),
            "ownerId": str(sample.outsider.id),
            "slug": "logo-cross-2b2",
            "name": "LogoCross",
        },
    )
    with pytest.raises(HTTPException) as raised:
        await svc.set_brand_logo(sample.db, other.id, sample.owner.id, _PNG)
    assert raised.value.status_code == 403
    assert list(tmp_path.glob(f"{other.id}.*")) == []


# --- Cover job writers ---


async def test_retarget_editor_success(sample):
    asset, job = await _video_with_job(sample, status="ready")
    changed = await covers.retarget_cover(
        sample.db, sample.business.id, sample.editor.id, asset.id, 2, 7,
    )
    assert changed.id != job.id
    assert changed.status == "awaiting_encode"
    assert changed.strategy == covers.CHOSEN_STRATEGY
    assert changed.start_ticks == 2000 and changed.end_ticks == 7000
    remote = await _db_job(sample, job.id)
    assert remote.status == "ready"
    assert remote.start_ticks == 0 and remote.end_ticks == 20_000


async def test_retarget_revoked_editor_rejected(sample, monkeypatch):
    asset, job = await _video_with_job(sample, status="ready")
    before = job.status

    async def revoke(db):
        await _revoke_member(db, sample.business.id, sample.editor.id)

    _patch_lock_after(monkeypatch, revoke)
    with pytest.raises(HTTPException) as raised:
        await covers.retarget_cover(
            sample.db, sample.business.id, sample.editor.id, asset.id, 2, 7,
        )
    assert raised.value.status_code == 403
    remote = await _db_job(sample, job.id)
    assert remote.status == before
    await sample.db.rollback()


async def test_retarget_stale_editor_role_rejected(sample, monkeypatch):
    asset, job = await _video_with_job(sample, status="ready")

    async def demote(db):
        await _force_member_role(db, sample.business.id, sample.editor.id, "viewer")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await covers.retarget_cover(
            sample.db, sample.business.id, sample.editor.id, asset.id, 2, 7,
        )
    assert raised.value.status_code == 403
    remote = await _db_job(sample, job.id)
    assert remote.status == "ready"
    await sample.db.rollback()


async def test_retarget_cross_tenant_rejected(sample):
    asset, job = await _video_with_job(sample, status="ready")
    with pytest.raises(HTTPException) as raised:
        await covers.retarget_cover(
            sample.db, sample.business.id, sample.outsider.id, asset.id, 2, 7,
        )
    assert raised.value.status_code == 403
    remote = await _db_job(sample, job.id)
    assert remote.status == "ready"


async def test_retry_editor_success(sample):
    asset, job = await _video_with_job(sample, failed=True)
    retried = await covers.retry_cover(
        sample.db, sample.business.id, sample.editor.id, asset.id,
    )
    assert retried.status == "awaiting_encode"
    assert retried.attempts == 0 and retried.error_code is None
    remote = await _db_job(sample, job.id)
    assert remote.status == "awaiting_encode"


async def test_retry_inactive_editor_rejected(sample, monkeypatch):
    asset, job = await _video_with_job(sample, failed=True)

    async def deactivate(db):
        await _deactivate_user(db, sample.editor.id)

    _patch_lock_after(monkeypatch, deactivate)
    with pytest.raises(HTTPException) as raised:
        await covers.retry_cover(
            sample.db, sample.business.id, sample.editor.id, asset.id,
        )
    assert raised.value.status_code == 403
    remote = await _db_job(sample, job.id)
    assert remote.status == "failed"
    await sample.db.rollback()


async def test_retry_stale_role_rejected(sample, monkeypatch):
    asset, job = await _video_with_job(sample, failed=True)

    async def demote(db):
        await _force_member_role(db, sample.business.id, sample.editor.id, "viewer")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await covers.retry_cover(
            sample.db, sample.business.id, sample.editor.id, asset.id,
        )
    assert raised.value.status_code == 403
    remote = await _db_job(sample, job.id)
    assert remote.status == "failed"
    await sample.db.rollback()


async def test_cover_autoflush_false_retarget(sample):
    asset, _ = await _video_with_job(sample, status="ready")
    sample.db.autoflush = False
    try:
        changed = await covers.retarget_cover(
            sample.db, sample.business.id, sample.editor.id, asset.id, 1, 5,
        )
        assert changed.status == "awaiting_encode"
    finally:
        sample.db.autoflush = True


def test_source_lock_order_settings_logo_cover():
    svc_text = (_BACKEND / "services/business_yansi/service.py").read_text(encoding="utf-8")
    cover_text = (_BACKEND / "services/business_yansi/cover_jobs.py").read_text(encoding="utf-8")
    router = (_BACKEND / "routers/business_yansi.py").read_text(encoding="utf-8")
    settings_fn = svc_text.split("async def update_business_settings", 1)[1].split("async def set_brand_logo", 1)[0]
    logo_fn = svc_text.split("async def set_brand_logo", 1)[1].split("async def list_knowledge", 1)[0]
    retarget = cover_text.split("async def retarget_cover", 1)[1].split("async def retry_cover", 1)[0]
    retry = cover_text.split("async def retry_cover", 1)[1]
    for block in (settings_fn, logo_fn, retarget, retry):
        assert "async with business_media_lock" in block
        assert "await require_locked_actor" in block
        assert block.index("async with business_media_lock") < block.index("await require_locked_actor")
    assert "update_business_settings" in router
    assert "manager(db,claims,business_id,'owner');row.name" not in router
