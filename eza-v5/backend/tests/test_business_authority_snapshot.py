"""Phase 7G-4c.3A Implementation 1: AuthoritySnapshot / require_locked_actor.

Controlled SQLite behavior tests — not overlapping PostgreSQL lock proofs.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import update

from backend.models.business_yansi import BusinessMember, BusinessProfile
from backend.models.production import Organization, User
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.video_authority import (
    AuthoritySnapshot,
    lock_brand,
    require_locked_actor,
    require_locked_access,
    sorted_authority_user_ids,
)
from backend.tests.test_business_video_cover_policy import asset_dir, sample


async def test_revoked_membership_denied(sample):
    async with media.business_media_lock(sample.db, sample.business.id):
        member = await sample.db.get(BusinessMember, (sample.business.id, sample.editor.id))
        await sample.db.delete(member)
        await sample.db.flush()
        with pytest.raises(HTTPException) as raised:
            await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
    assert raised.value.status_code == 403
    assert raised.value.detail["code"] == "business_access_denied"
    await sample.db.rollback()


async def test_downgraded_role_denied_for_editor_minimum(sample):
    member = await sample.db.get(BusinessMember, (sample.business.id, sample.editor.id))
    member.role = "viewer"
    await sample.db.commit()
    async with media.business_media_lock(sample.db, sample.business.id):
        with pytest.raises(HTTPException) as raised:
            await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
        assert raised.value.status_code == 403
        snap = await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "viewer")
        assert snap.role == "viewer"


async def test_inactive_user_denied(sample):
    sample.editor.is_active = False
    await sample.db.commit()
    async with media.business_media_lock(sample.db, sample.business.id):
        with pytest.raises(HTTPException) as raised:
            await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
    assert raised.value.status_code == 403


async def test_suspended_business_denied(sample):
    sample.business.status = "suspended"
    await sample.db.commit()
    async with media.business_media_lock(sample.db, sample.business.id):
        with pytest.raises(HTTPException) as raised:
            await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
    assert raised.value.status_code == 404
    assert raised.value.detail["code"] == "business_not_found"


async def test_archived_organization_denied(sample):
    org = await sample.db.get(Organization, sample.business.id)
    org.status = "archived"
    await sample.db.commit()
    async with media.business_media_lock(sample.db, sample.business.id):
        with pytest.raises(HTTPException) as raised:
            await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
    assert raised.value.status_code == 404


async def test_verification_required_but_revoked(sample):
    sample.business.verified = False
    await sample.db.commit()
    async with media.business_media_lock(sample.db, sample.business.id):
        with pytest.raises(HTTPException) as raised:
            await require_locked_actor(
                sample.db, sample.business.id, sample.owner.id, "owner", require_verified=True,
            )
        assert raised.value.status_code == 409
        assert raised.value.detail["code"] == "business_verification_required"
        # Without the flag, owner authority still succeeds.
        snap = await require_locked_actor(sample.db, sample.business.id, sample.owner.id, "owner")
        assert snap.verified is False
        assert isinstance(snap, AuthoritySnapshot)


async def test_stale_identity_map_membership_does_not_grant(sample):
    member = await sample.db.get(BusinessMember, (sample.business.id, sample.editor.id))
    assert member is not None
    await sample.db.execute(
        update(BusinessMember)
        .where(
            BusinessMember.business_id == sample.business.id,
            BusinessMember.user_id == sample.editor.id,
        )
        .values(role="viewer")
        .execution_options(synchronize_session=False)
    )
    await sample.db.commit()
    assert member.role == "editor"  # stale identity map
    async with media.business_media_lock(sample.db, sample.business.id):
        with pytest.raises(HTTPException) as raised:
            await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
    assert raised.value.status_code == 403


async def test_dirty_orm_attributes_remain_unchanged(sample):
    """require_locked_actor must not wipe dirty ORM attrs via populate_existing/refresh.

    Dirties are applied after Business lock acquisition so business_media_lock's own
    populate_existing is outside the assertion scope.
    """
    async with media.business_media_lock(sample.db, sample.business.id):
        brand = sample.business
        org = await sample.db.get(Organization, sample.business.id)
        user = sample.editor
        member = await sample.db.get(BusinessMember, (sample.business.id, sample.editor.id))
        brand.name = "DirtyBrandName"
        org.name = "DirtyOrgName"
        user.email = "dirty-editor@example.test"
        member.role = "owner"  # dirty local lie; committed DB role remains editor
        snap = await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
        assert snap.role == "editor"
        assert brand.name == "DirtyBrandName"
        assert org.name == "DirtyOrgName"
        assert user.email == "dirty-editor@example.test"
        assert member.role == "owner"
    await sample.db.rollback()


async def test_no_unintended_autoflush_of_pending_member(sample):
    pending = BusinessMember(
        business_id=sample.business.id,
        user_id=sample.viewer.id,
        role="editor",
    )
    # viewer already has membership — use a fresh user id so pending stays new
    ghost = User(id=uuid.uuid4(), email=f"ghost-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
    sample.db.add(ghost)
    await sample.db.flush()
    pending = BusinessMember(business_id=sample.business.id, user_id=ghost.id, role="editor")
    sample.db.add(pending)
    assert pending in sample.db.new
    async with media.business_media_lock(sample.db, sample.business.id):
        snap = await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
        assert snap.role == "editor"
        assert pending in sample.db.new
    await sample.db.rollback()


async def test_deterministic_actor_target_lock_ordering(sample):
    low = uuid.UUID("00000000-0000-4000-8000-000000000001")
    high = uuid.UUID("ffffffff-ffff-4fff-8fff-ffffffffffff")
    assert sorted_authority_user_ids(high, low) == [low, high]
    expected_users = sorted({sample.editor.id, sample.owner.id}, key=str)
    assert sorted_authority_user_ids(sample.editor.id, sample.owner.id) == expected_users

    # SQLite may omit FOR UPDATE text; observe statement table order instead.
    order: list[str] = []
    real_execute = sample.db.execute

    async def spy_execute(statement, *args, **kwargs):
        try:
            names = [getattr(t, "name", "") for t in statement.get_final_froms()]
        except Exception:
            names = []
        joined = " ".join(names).lower()
        if "business_profiles" in joined or "businessprofile" in joined:
            order.append("business")
        elif "production_organizations" in joined or "organization" in joined:
            order.append("org")
        elif "production_users" in joined or joined.endswith("user") or "users" == joined:
            order.append("user")
        elif "business_members" in joined or "businessmember" in joined:
            order.append("member")
        return await real_execute(statement, *args, **kwargs)

    sample.db.execute = spy_execute  # type: ignore[method-assign]
    try:
        async with media.business_media_lock(sample.db, sample.business.id):
            await require_locked_actor(
                sample.db,
                sample.business.id,
                sample.editor.id,
                "editor",
                extra_user_ids=(sample.owner.id,),
            )
    finally:
        sample.db.execute = real_execute  # type: ignore[method-assign]

    assert "org" in order
    assert order.index("user") < order.index("member")
    assert order.count("user") >= 2
    assert order.count("member") >= 2


async def test_require_locked_access_delegates_same_denial(sample):
    sample.editor.is_active = False
    await sample.db.commit()
    async with media.business_media_lock(sample.db, sample.business.id):
        with pytest.raises(HTTPException) as via_actor:
            await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
        with pytest.raises(HTTPException) as via_access:
            await require_locked_access(sample.db, sample.business.id, sample.editor.id, "editor")
    assert via_actor.value.status_code == via_access.value.status_code == 403
    assert via_actor.value.detail == via_access.value.detail


async def test_owner_snapshot_fields(sample):
    sample.business.verified = True
    sample.business.official = False
    await sample.db.commit()
    async with media.business_media_lock(sample.db, sample.business.id):
        snap = await require_locked_actor(
            sample.db, sample.business.id, sample.owner.id, "owner", require_verified=True,
        )
    assert snap.business_id == sample.business.id
    assert snap.user_id == sample.owner.id
    assert snap.role == "owner"
    assert snap.verified is True
    assert snap.user_active is True
    assert snap.business_status == "active"
    assert snap.org_status == "active"


# --- Implementation 1A: non-destructive business_media_lock ---


async def test_1a_dirty_business_name_survives_lock_acquisition(sample):
    brand = sample.business
    brand.name = "DirtyBrandBeforeLock"
    brand.description = "dirty-description"
    async with media.business_media_lock(sample.db, sample.business.id) as snap:
        assert brand.name == "DirtyBrandBeforeLock"
        assert brand.description == "dirty-description"
        assert snap.id == brand.id
        assert snap.status == "active"
        assert isinstance(snap.verified, bool)
    await sample.db.rollback()


async def test_1a_dirty_status_and_verification_not_silently_overwritten(sample):
    """Lock snapshot carries DB truth; dirty ORM status/verified stay on the instance."""
    brand = sample.business
    await sample.db.execute(
        update(BusinessProfile)
        .where(BusinessProfile.id == brand.id)
        .values(status="active", verified=False, official=False)
        .execution_options(synchronize_session=False)
    )
    await sample.db.commit()
    await sample.db.refresh(brand)
    brand.status = "suspended"  # dirty lie
    brand.verified = True  # dirty lie
    async with media.business_media_lock(sample.db, sample.business.id) as snap:
        assert snap.status == "active"
        assert snap.verified is False
        assert brand.status == "suspended"
        assert brand.verified is True
        # Authorization must follow DB columns, not dirty ORM.
        with pytest.raises(HTTPException) as raised:
            await require_locked_actor(
                sample.db, sample.business.id, sample.owner.id, "owner", require_verified=True,
            )
        assert raised.value.detail["code"] == "business_verification_required"
        snap_auth = await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
        assert snap_auth.verified is False
        assert snap_auth.business_status == "active"
    assert brand.status == "suspended"
    assert brand.verified is True
    await sample.db.rollback()


async def test_1a_lock_does_not_autoflush_pending_member(sample):
    ghost = User(
        id=uuid.uuid4(),
        email=f"lock-ghost-{uuid.uuid4().hex[:8]}@example.test",
        role="user",
        is_active=True,
    )
    sample.db.add(ghost)
    await sample.db.flush()
    pending = BusinessMember(business_id=sample.business.id, user_id=ghost.id, role="viewer")
    sample.db.add(pending)
    assert pending in sample.db.new
    sample.business.name = "PendingSafeName"
    async with media.business_media_lock(sample.db, sample.business.id):
        assert pending in sample.db.new
        assert sample.business.name == "PendingSafeName"
    await sample.db.rollback()


async def test_1a_lock_brand_preserves_dirty_name(sample):
    brand = sample.business
    brand.name = "LockBrandDirty"
    row = await lock_brand(sample.db, sample.business.id)
    assert row is brand
    assert brand.name == "LockBrandDirty"
    await sample.db.rollback()


async def test_1a_create_draft_auth_unchanged_under_non_destructive_lock(sample, asset_dir, monkeypatch):
    """Smoke: create_draft still re-auths after lock; ranking flag stays off."""
    from unittest.mock import AsyncMock

    from backend.services.business_yansi import brand_asset_library as library
    from backend.services.business_yansi import service as svc
    from backend.tests.test_business_video_cover_policy import _confirm
    from backend.tests.test_business_yansi import source

    monkeypatch.delenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", raising=False)
    vision = AsyncMock()
    monkeypatch.setattr("backend.services.business_yansi.image_observe.call_vision", vision, raising=False)
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    row = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Zeytinyagi hasadi", "caption": "", "public_allowed": True},
        image_bytes=b"\x89PNG\r\n\x1a\n" + b"\x00" * 24 + b"1a-draft",
    )
    await _confirm(sample, knowledge, row)
    steps = [
        {"question": "Zeytinyagi hasadi nedir?", "answer": knowledge.content, "sources": [str(knowledge.id)]}
        for _ in range(8)
    ]
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert draft.media_plan["coverMode"] == "automatic"
    assert draft.media_plan["coverAssetId"]
    assert vision.await_count == 0
