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
from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.util import identity_key

from backend.models.business_yansi import BusinessMember, BusinessProfile
from backend.models.production import Organization, User
from backend.services.business_yansi.service import ROLES, fail, uid


def _locked(model, *criteria):
    return select(model).where(*criteria).with_for_update().execution_options(populate_existing=True)


async def lock_brand(db: AsyncSession, business_id) -> BusinessProfile:
    """FOR UPDATE the brand row without wiping dirty ORM attributes.

    Uses a projected id lock, then ``db.get`` without ``populate_existing``.
    Callers that mutate the returned instance still write through the identity map.
    """
    business_key = uid(business_id)
    with db.no_autoflush:
        locked = await db.execute(
            select(BusinessProfile.id).where(BusinessProfile.id == business_key).with_for_update()
        )
        locked_id = locked.scalar_one_or_none()
        if locked_id is None:
            fail("business_not_found", 404)
        row = await db.get(BusinessProfile, locked_id)
        if row is None:
            fail("business_not_found", 404)
        return row


def _forget_cached_member(db: AsyncSession, business_id, user_id) -> None:
    """A locked SELECT that returns no row leaves a deleted membership in the identity map."""
    stale = db.sync_session.identity_map.get(identity_key(BusinessMember, (business_id, user_id)))
    if stale is not None:
        db.sync_session.expunge(stale)


@dataclass(frozen=True, slots=True)
class AuthoritySnapshot:
    """Immutable authorization decision taken under Business-first locks.

    Built from column projections, not from mutable identity-map attribute state.
    """

    business_id: uuid.UUID
    business_status: str
    verified: bool
    official: bool
    org_status: str
    user_id: uuid.UUID
    user_active: bool
    role: str


def sorted_authority_user_ids(*user_ids: object) -> list[uuid.UUID]:
    """Deterministic User lock order: unique ids sorted by canonical string form."""
    return sorted({uid(value) for value in user_ids}, key=str)


async def require_locked_actor(
    db: AsyncSession,
    business_id,
    actor_id,
    minimum: str = "editor",
    *,
    require_verified: bool = False,
    extra_user_ids: Iterable[object] = (),
) -> AuthoritySnapshot:
    """Revalidate actor authority after the caller holds the Business lock.

    Lock order (never reversed):

    1. BusinessProfile (FOR UPDATE — caller should already hold; re-taken safely)
    2. Organization
    3. User rows in ``sorted_authority_user_ids(actor, *extra)``
    4. BusinessMember rows in the same user order

    Decisions use column snapshots under ``no_autoflush``. Identity-map objects are
    not refreshed with ``populate_existing``, so dirty caller-owned ORM attributes
    on Business/Org/User/Member instances stay untouched.
    """
    if minimum not in ROLES:
        fail("business_access_denied", 403)
    business_key = uid(business_id)
    actor_key = uid(actor_id)
    user_keys = sorted_authority_user_ids(actor_key, *extra_user_ids)

    with db.no_autoflush:
        brand_locked = await db.execute(
            select(
                BusinessProfile.id,
                BusinessProfile.status,
                BusinessProfile.verified,
                BusinessProfile.official,
            )
            .where(BusinessProfile.id == business_key)
            .with_for_update()
        )
        brand = brand_locked.one_or_none()

        org_locked = await db.execute(
            select(Organization.id, Organization.status)
            .where(Organization.id == business_key)
            .with_for_update()
        )
        organization = org_locked.one_or_none()

        users: dict[uuid.UUID, object] = {}
        for user_key in user_keys:
            user_locked = await db.execute(
                select(User.id, User.is_active).where(User.id == user_key).with_for_update()
            )
            users[user_key] = user_locked.one_or_none()

        members: dict[uuid.UUID, object] = {}
        for user_key in user_keys:
            member_locked = await db.execute(
                select(
                    BusinessMember.business_id,
                    BusinessMember.user_id,
                    BusinessMember.role,
                )
                .where(
                    BusinessMember.business_id == business_key,
                    BusinessMember.user_id == user_key,
                )
                .with_for_update()
            )
            member = member_locked.one_or_none()
            members[user_key] = member
            if member is None:
                _forget_cached_member(db, business_key, user_key)

    actor_user = users.get(actor_key)
    actor_member = members.get(actor_key)

    if actor_user is None or not bool(actor_user.is_active):
        fail("business_access_denied", 403)
    if brand is None or organization is None or organization.status != "active" or brand.status != "active":
        fail("business_not_found", 404)
    if actor_member is None or ROLES.get(actor_member.role, 0) < ROLES[minimum]:
        fail("business_access_denied", 403)
    if require_verified and not bool(brand.verified):
        fail("business_verification_required", 409)

    return AuthoritySnapshot(
        business_id=brand.id,
        business_status=str(brand.status),
        verified=bool(brand.verified),
        official=bool(brand.official),
        org_status=str(organization.status),
        user_id=actor_user.id,
        user_active=bool(actor_user.is_active),
        role=str(actor_member.role),
    )


async def require_locked_access(db: AsyncSession, business_id, user_id, minimum: str = "editor") -> None:
    """Draft/ingest compatibility shim: same checks as ``require_locked_actor``."""
    await require_locked_actor(db, business_id, user_id, minimum)


async def lock_editor_rows(db: AsyncSession, business_id, user_id) -> None:
    """Editor-grade authority under an already-held Business lock."""
    await require_locked_access(db, business_id, user_id, "editor")


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


async def assign_member_role(db: AsyncSession, business_id, actor_id, target_user_id, role: str):
    """Assign a target membership under Business-first actor reauthorization.

    Order: Business → require_locked_actor(owner, extra=target) which locks
    Org → Users(sorted) → Memberships(sorted) → then mutate only the target membership.
    Actor authority is never inferred from the target row.
    """
    from backend.services.business_yansi.service import access

    await access(db, business_id, actor_id, "owner")
    if role not in ROLES or role == "owner":
        fail("invalid_member", 422)
    business = await lock_brand(db, business_id)
    target_key = uid(target_user_id)
    await require_locked_actor(
        db, business_id, actor_id, "owner", extra_user_ids=(target_key,),
    )
    # Target User/Membership already locked by require_locked_actor; do not re-lock out of order.
    with db.no_autoflush:
        target_locked = await db.execute(
            select(User.id, User.is_active).where(User.id == target_key)
        )
        target = target_locked.one_or_none()
    if target is None or not bool(target.is_active) or target.id == business.owner_id:
        fail("invalid_member", 422)
    row = await db.get(BusinessMember, (business.id, target.id))
    if row is None:
        row = BusinessMember(business_id=business.id, user_id=target.id, role=role)
        db.add(row)
    else:
        row.role = role
    await db.commit()
    await db.refresh(row)
    return row


async def remove_business_member(db: AsyncSession, business_id, actor_id, target_user_id) -> None:
    """Delete membership under Business → Org → Users → Membership locks.

    Preliminary owner access may run first; this path re-checks owner authority
    after the brand lock so a concurrent demotion cannot race the delete.
    """
    from backend.services.business_yansi.service import access

    await access(db, business_id, actor_id, "owner")
    business = await lock_brand(db, business_id)
    organization = await db.scalar(_locked(Organization, Organization.id == business.id))
    actor_key = uid(actor_id)
    target_key = uid(target_user_id)
    if target_key == business.owner_id:
        fail("cannot_remove_owner", 409)
    for user_key in sorted((actor_key, target_key), key=str):
        await db.scalar(_locked(User, User.id == user_key))
    actor = await db.scalar(
        select(User).where(User.id == actor_key).execution_options(populate_existing=True)
    )
    actor_member = await db.scalar(
        _locked(
            BusinessMember,
            BusinessMember.business_id == business.id,
            BusinessMember.user_id == actor_key,
        )
    )
    if actor_member is None:
        _forget_cached_member(db, business.id, actor_key)
    brand = await db.scalar(
        select(BusinessProfile)
        .where(BusinessProfile.id == business.id)
        .execution_options(populate_existing=True)
    )
    if actor is None or not actor.is_active:
        fail("business_access_denied", 403)
    if brand is None or organization is None or organization.status != "active" or brand.status != "active":
        fail("business_not_found", 404)
    if actor_member is None or ROLES.get(actor_member.role, 0) < ROLES["owner"]:
        fail("business_access_denied", 403)
    target_member = await db.scalar(
        _locked(
            BusinessMember,
            BusinessMember.business_id == business.id,
            BusinessMember.user_id == target_key,
        )
    )
    if target_member is not None:
        await db.delete(target_member)
    _forget_cached_member(db, business.id, target_key)
    await db.commit()


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
