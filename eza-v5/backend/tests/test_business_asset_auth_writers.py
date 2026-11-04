"""Implementation 2A: asset writers + assign_member_role post-lock authorization.

Controlled SQLite interleavings / state freshness — not PostgreSQL overlapping proofs.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

import pytest
from fastapi import HTTPException
from sqlalchemy import update

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.models.business_yansi import BusinessMember, BusinessProfile
from backend.models.production import Organization, User
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.video_authority import (
    assign_member_role,
    sorted_authority_user_ids,
)
from backend.tests.test_business_video_cover_policy import _confirm, asset_dir, sample
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


async def _image(sample, knowledge, title: str, payload: bytes):
    row = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": title, "caption": "", "public_allowed": True},
        image_bytes=_PNG + payload,
    )
    return await _confirm(sample, knowledge, row)


# --- Member role assignment ---


async def test_actor_owner_demoted_before_role_assignment(sample, monkeypatch):
    """Controlled interleave: actor loses owner before assign_member_role's protected path."""
    target = User(
        id=uuid.uuid4(), email=f"tgt-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True,
    )
    sample.db.add(target)
    await sample.db.commit()

    real_lock = __import__(
        "backend.services.business_yansi.video_authority", fromlist=["lock_brand"]
    ).lock_brand
    from backend.services.business_yansi import video_authority as va

    async def demote_then_lock(db, business_id):
        member = await db.get(BusinessMember, (sample.business.id, sample.owner.id))
        # Owner membership cannot usually be demoted via assign; force DB role for TOCTOU.
        await db.execute(
            update(BusinessMember)
            .where(
                BusinessMember.business_id == sample.business.id,
                BusinessMember.user_id == sample.owner.id,
            )
            .values(role="viewer")
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        return await real_lock(db, business_id)

    monkeypatch.setattr(va, "lock_brand", demote_then_lock)
    with pytest.raises(HTTPException) as raised:
        await assign_member_role(
            sample.db, sample.business.id, sample.owner.id, target.id, "editor",
        )
    assert raised.value.status_code == 403
    await sample.db.rollback()


async def test_actor_membership_revoked_before_role_assignment(sample, monkeypatch):
    target = User(
        id=uuid.uuid4(), email=f"tgt2-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True,
    )
    sample.db.add(target)
    await sample.db.commit()
    from backend.services.business_yansi import video_authority as va

    real_lock = va.lock_brand

    async def revoke_then_lock(db, business_id):
        member = await db.get(BusinessMember, (sample.business.id, sample.owner.id))
        if member is not None:
            await db.delete(member)
            await db.commit()
        return await real_lock(db, business_id)

    monkeypatch.setattr(va, "lock_brand", revoke_then_lock)
    with pytest.raises(HTTPException) as raised:
        await assign_member_role(
            sample.db, sample.business.id, sample.owner.id, target.id, "viewer",
        )
    assert raised.value.status_code == 403
    await sample.db.rollback()


async def test_actor_deactivated_before_role_assignment(sample, monkeypatch):
    target = User(
        id=uuid.uuid4(), email=f"tgt3-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True,
    )
    sample.db.add(target)
    await sample.db.commit()
    from backend.services.business_yansi import video_authority as va

    real_lock = va.lock_brand

    async def deactivate_then_lock(db, business_id):
        await db.execute(
            update(User).where(User.id == sample.owner.id).values(is_active=False)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        return await real_lock(db, business_id)

    monkeypatch.setattr(va, "lock_brand", deactivate_then_lock)
    with pytest.raises(HTTPException) as raised:
        await assign_member_role(
            sample.db, sample.business.id, sample.owner.id, target.id, "editor",
        )
    assert raised.value.status_code == 403
    await sample.db.rollback()


async def test_target_user_deactivated_rejected(sample):
    target = User(
        id=uuid.uuid4(), email=f"dead-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=False,
    )
    sample.db.add(target)
    await sample.db.commit()
    with pytest.raises(HTTPException) as raised:
        await assign_member_role(
            sample.db, sample.business.id, sample.owner.id, target.id, "editor",
        )
    assert raised.value.status_code == 422
    assert raised.value.detail["code"] == "invalid_member"


async def test_cross_business_actor_rejected(sample):
    from backend.services.business_yansi import service as svc

    other = await svc.create_business(
        sample.db, sample.admin, {
            "organizationId": str(sample.other.id),
            "ownerId": str(sample.outsider.id),
            "slug": "cross-auth-" + uuid.uuid4().hex[:8],
            "name": "CrossAuth",
        },
    )
    with pytest.raises(HTTPException) as raised:
        await assign_member_role(
            sample.db, other.id, sample.owner.id, sample.editor.id, "viewer",
        )
    assert raised.value.status_code in {403, 404}


# --- Asset writers ---


async def test_editor_demoted_before_create_asset(sample, asset_dir, monkeypatch):
    async def demote(db):
        await assign_member_role(db, sample.business.id, sample.owner.id, sample.editor.id, "viewer")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await library.create_asset(
            sample.db, sample.business.id, sample.editor.id,
            {"asset_type": "image", "title": "X", "caption": "", "public_allowed": True},
            image_bytes=_PNG + b"demote-create",
        )
    assert raised.value.status_code == 403


async def test_editor_demoted_before_update_asset(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await _image(sample, knowledge, "Atolye", b"demote-upd")

    async def demote(db):
        await assign_member_role(db, sample.business.id, sample.owner.id, sample.editor.id, "viewer")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await library.update_asset(
            sample.db, sample.business.id, sample.editor.id, asset.id,
            {"title": "Yeni", "caption": "", "public_allowed": True, "revision": asset.revision},
        )
    assert raised.value.status_code == 403


async def test_editor_demoted_before_archive_asset(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await _image(sample, knowledge, "Atolye", b"demote-arch")

    async def demote(db):
        await assign_member_role(db, sample.business.id, sample.owner.id, sample.editor.id, "viewer")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await library.archive_asset(
            sample.db, sample.business.id, sample.editor.id, asset.id, asset.revision,
        )
    assert raised.value.status_code == 403


async def test_editor_demoted_before_set_links(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Atolye", "caption": "", "public_allowed": True},
        image_bytes=_PNG + b"demote-links",
    )

    async def demote(db):
        await assign_member_role(db, sample.business.id, sample.owner.id, sample.editor.id, "viewer")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await library.set_links(
            sample.db, sample.business.id, sample.editor.id, asset.id, [knowledge.id], asset.revision,
        )
    assert raised.value.status_code == 403


async def test_membership_removed_before_asset_mutation(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await _image(sample, knowledge, "Atolye", b"revoke-mut")

    async def revoke(db):
        member = await db.get(BusinessMember, (sample.business.id, sample.editor.id))
        if member is not None:
            await db.delete(member)
            await db.commit()

    _patch_lock_after(monkeypatch, revoke)
    with pytest.raises(HTTPException) as raised:
        await library.archive_asset(
            sample.db, sample.business.id, sample.editor.id, asset.id, asset.revision,
        )
    assert raised.value.status_code == 403


async def test_business_suspended_before_asset_mutation(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await _image(sample, knowledge, "Atolye", b"susp-mut")

    async def suspend(db):
        from backend.services.business_yansi.video_authority import update_brand_verification
        await update_brand_verification(
            db, sample.business.id, verified=False, official=False, status="suspended",
        )

    _patch_lock_after(monkeypatch, suspend)
    with pytest.raises(HTTPException) as raised:
        await library.update_asset(
            sample.db, sample.business.id, sample.editor.id, asset.id,
            {"title": asset.title, "caption": "", "public_allowed": True, "revision": asset.revision},
        )
    assert raised.value.status_code == 404


async def test_organization_archived_before_asset_mutation(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await _image(sample, knowledge, "Atolye", b"org-arch")

    async def archive_org(db):
        await db.execute(
            update(Organization)
            .where(Organization.id == sample.business.id)
            .values(status="archived")
            .execution_options(synchronize_session=False)
        )
        await db.commit()

    _patch_lock_after(monkeypatch, archive_org)
    with pytest.raises(HTTPException) as raised:
        await library.create_asset(
            sample.db, sample.business.id, sample.editor.id,
            {"asset_type": "link", "title": "X", "caption": "", "locator": "https://example.test/a", "public_allowed": False},
        )
    assert raised.value.status_code == 404


async def test_dirty_orm_preserved_across_asset_auth(sample, asset_dir):
    from backend.services.business_yansi.video_authority import require_locked_actor

    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await _image(sample, knowledge, "Atolye", b"dirty-orm")
    async with media.business_media_lock(sample.db, sample.business.id):
        sample.business.name = "DirtyBizDuringAuth"
        asset.title = "DirtyTitleLocal"
        await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
        assert sample.business.name == "DirtyBizDuringAuth"
        assert asset.title == "DirtyTitleLocal"
    await sample.db.rollback()


async def test_no_unintended_autoflush_on_update(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await _image(sample, knowledge, "Atolye", b"no-flush")
    ghost = User(id=uuid.uuid4(), email=f"g-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
    sample.db.add(ghost)
    await sample.db.flush()
    pending = BusinessMember(business_id=sample.business.id, user_id=ghost.id, role="viewer")
    sample.db.add(pending)
    assert pending in sample.db.new
    # update commits and would flush pending if still in session — remove before call after
    # verifying auth path under lock does not flush early: spy via create then rollback pattern.
    from backend.services.business_yansi.video_authority import require_locked_actor

    async with media.business_media_lock(sample.db, sample.business.id):
        await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
        assert pending in sample.db.new
    await sample.db.rollback()


async def test_deterministic_actor_target_order_helper():
    a = uuid.UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    b = uuid.UUID("00000000-0000-4000-8000-000000000001")
    assert sorted_authority_user_ids(a, b) == [b, a]


async def test_successful_assign_and_create_still_work(sample, asset_dir):
    await assign_member_role(
        sample.db, sample.business.id, sample.owner.id, sample.viewer.id, "editor",
    )
    member = await sample.db.get(BusinessMember, (sample.business.id, sample.viewer.id))
    assert member.role == "editor"
    row = await library.create_asset(
        sample.db, sample.business.id, sample.viewer.id,
        {"asset_type": "image", "title": "Ok", "caption": "", "public_allowed": True},
        image_bytes=_PNG + b"ok-create",
    )
    assert row.created_by == sample.viewer.id
