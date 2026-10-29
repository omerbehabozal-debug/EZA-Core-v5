"""Serialize a video asset insert with the authority rows it depends on.

Lock order, and never the reverse:

1. business_profiles.id          (held by business_media_lock during ingest)
2. production_organizations.id   (same uuid as the brand)
3. production_users.id
4. business_members (business_id, user_id)

PostgreSQL UPDATE locks the same row as SELECT FOR UPDATE, so a writer that
commits first is visible to the next insert, and a writer that arrives while
the insert holds these locks waits until that transaction commits. A later
revocation does not delete an asset that already committed.

`studio.lock_business` reads the user before it locks the brand, but it does
not FOR UPDATE the user. Adding a user lock there before the brand lock would
deadlock with this order.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.util import identity_key

from backend.models.business_yansi import BusinessMember, BusinessProfile
from backend.models.production import Organization, User
from backend.services.business_yansi.service import ROLES, fail, uid


def _locked(model, *criteria):
    return select(model).where(*criteria).with_for_update().execution_options(populate_existing=True)


async def lock_brand(db: AsyncSession, business_id) -> BusinessProfile:
    row = await db.scalar(_locked(BusinessProfile, BusinessProfile.id == uid(business_id)))
    if row is None:
        fail("business_not_found", 404)
    return row


def _forget_cached_member(db: AsyncSession, business_id, user_id) -> None:
    """A locked SELECT that returns no row leaves a deleted membership in the identity map."""
    stale = db.sync_session.identity_map.get(identity_key(BusinessMember, (business_id, user_id)))
    if stale is not None:
        db.sync_session.expunge(stale)


async def lock_editor_rows(db: AsyncSession, business_id, user_id) -> None:
    """Organization, then user, then membership. The brand row is already locked.

    The returned rows are the authorization decision. A missing membership is
    removed from the identity map so a later db.get cannot grant the old role.
    """
    business_key = uid(business_id)
    actor = uid(user_id)
    organization = await db.scalar(_locked(Organization, Organization.id == business_key))
    user = await db.scalar(_locked(User, User.id == actor))
    membership = await db.scalar(
        _locked(
            BusinessMember,
            BusinessMember.business_id == business_key,
            BusinessMember.user_id == actor,
        )
    )
    if membership is None:
        _forget_cached_member(db, business_key, actor)
    brand = await db.scalar(
        select(BusinessProfile)
        .where(BusinessProfile.id == business_key)
        .execution_options(populate_existing=True)
    )
    if user is None or not user.is_active:
        fail("business_access_denied", 403)
    if brand is None or organization is None or organization.status != "active" or brand.status != "active":
        fail("business_not_found", 404)
    if membership is None or ROLES.get(membership.role, 0) < ROLES["editor"]:
        fail("business_access_denied", 403)


async def update_brand_verification(db: AsyncSession, business_id, *, verified: bool, official: bool, status: str):
    row = await lock_brand(db, business_id)
    if official and (not verified or row.slug != "bilign"):
        fail("official_bilign_identity_required", 422)
    row.verified = verified
    row.official = official
    row.status = status
    await db.commit()
    await db.refresh(row)
    return row


async def assign_member_role(db: AsyncSession, business_id, target_user_id, role: str):
    """Brand, then the target user, then the membership. Same relative order as ingest."""
    business = await lock_brand(db, business_id)
    user = await db.scalar(_locked(User, User.id == uid(target_user_id)))
    if user is None or not user.is_active or user.id == business.owner_id:
        fail("invalid_member", 422)
    row = await db.scalar(
        _locked(
            BusinessMember,
            BusinessMember.business_id == business.id,
            BusinessMember.user_id == user.id,
        )
    )
    if row is None:
        row = BusinessMember(business_id=business.id, user_id=user.id, role=role)
        db.add(row)
    else:
        row.role = role
    await db.commit()
    await db.refresh(row)
    return row


async def lock_user(db: AsyncSession, user_id) -> User | None:
    """User row only. Do not lock a brand after this; ingest locks the brand first."""
    return await db.scalar(_locked(User, User.id == uid(user_id)))


async def set_user_active(db: AsyncSession, user_id, active: bool) -> User | None:
    user = await lock_user(db, user_id)
    if user is None:
        return None
    user.is_active = active
    await db.commit()
    await db.refresh(user)
    return user


async def lock_organization_status(db: AsyncSession, org_id):
    """Brand profile first when this organization is a business, then the organization."""
    try:
        key = uuid.UUID(str(org_id))
    except (TypeError, ValueError):
        return None
    await db.scalar(_locked(BusinessProfile, BusinessProfile.id == key))
    return await db.scalar(_locked(Organization, Organization.id == key))
