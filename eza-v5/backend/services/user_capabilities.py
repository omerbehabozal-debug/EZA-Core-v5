"""Product-scoped capabilities. BiligN platform admin is independent of EZA role=admin."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.production import User, UserCapability

BILIGN_PLATFORM_ADMIN = 'bilign.platform_admin'
KNOWN_CAPABILITIES = frozenset({BILIGN_PLATFORM_ADMIN})


def fail(code: str, status: int = 403):
    raise HTTPException(status, detail={'code': code})


def _uid(value) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        fail('invalid_id', 422)


async def list_active_capabilities(db: AsyncSession, user_id) -> list[str]:
    rows = (
        await db.scalars(
            select(UserCapability.capability).where(
                UserCapability.user_id == _uid(user_id),
                UserCapability.revoked_at.is_(None),
            )
        )
    ).all()
    return sorted({str(c) for c in rows if c in KNOWN_CAPABILITIES})


async def has_capability(db: AsyncSession, user_id, capability: str) -> bool:
    if capability not in KNOWN_CAPABILITIES:
        return False
    row = await db.scalar(
        select(UserCapability.id).where(
            UserCapability.user_id == _uid(user_id),
            UserCapability.capability == capability,
            UserCapability.revoked_at.is_(None),
        )
    )
    return row is not None


async def require_capability(db: AsyncSession, user_id, capability: str) -> None:
    if not await has_capability(db, user_id, capability):
        fail('capability_required' if capability != BILIGN_PLATFORM_ADMIN else 'platform_admin_required')


async def grant_capability(
    db: AsyncSession,
    *,
    target_user_id,
    capability: str,
    actor_user_id,
) -> UserCapability:
    if capability not in KNOWN_CAPABILITIES:
        fail('unknown_capability', 422)
    target_id = _uid(target_user_id)
    actor_id = _uid(actor_user_id)
    if target_id == actor_id:
        fail('cannot_modify_own_capability', 403)
    target = await db.get(User, target_id)
    actor = await db.get(User, actor_id)
    if not target or not target.is_active:
        fail('target_user_not_found', 404)
    if not actor or not actor.is_active:
        fail('inactive_account', 401)
    if not await has_capability(db, actor_id, BILIGN_PLATFORM_ADMIN):
        fail('platform_admin_required')
    existing = await db.scalar(
        select(UserCapability).where(
            UserCapability.user_id == target_id,
            UserCapability.capability == capability,
            UserCapability.revoked_at.is_(None),
        )
    )
    if existing:
        return existing
    row = UserCapability(
        id=uuid.uuid4(),
        user_id=target_id,
        capability=capability,
        granted_by=actor_id,
        granted_at=datetime.now(timezone.utc),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def revoke_capability(
    db: AsyncSession,
    *,
    target_user_id,
    capability: str,
    actor_user_id,
) -> UserCapability:
    if capability not in KNOWN_CAPABILITIES:
        fail('unknown_capability', 422)
    target_id = _uid(target_user_id)
    actor_id = _uid(actor_user_id)
    if target_id == actor_id:
        fail('cannot_modify_own_capability', 403)
    actor = await db.get(User, actor_id)
    if not actor or not actor.is_active:
        fail('inactive_account', 401)
    if not await has_capability(db, actor_id, BILIGN_PLATFORM_ADMIN):
        fail('platform_admin_required')
    row = await db.scalar(
        select(UserCapability).where(
            UserCapability.user_id == target_id,
            UserCapability.capability == capability,
            UserCapability.revoked_at.is_(None),
        )
    )
    if not row:
        fail('capability_not_active', 404)
    row.revoked_at = datetime.now(timezone.utc)
    row.revoked_by = actor_id
    await db.commit()
    await db.refresh(row)
    return row


async def bootstrap_grant_for_ops(
    db: AsyncSession,
    *,
    target_user_id,
    capability: str = BILIGN_PLATFORM_ADMIN,
    granted_by_user_id=None,
) -> UserCapability:
    """Ops-only SQL/bootstrap path. Not exposed as public API. No auto EZA role change."""
    if capability not in KNOWN_CAPABILITIES:
        fail('unknown_capability', 422)
    target_id = _uid(target_user_id)
    target = await db.get(User, target_id)
    if not target or not target.is_active:
        fail('target_user_not_found', 404)
    existing = await db.scalar(
        select(UserCapability).where(
            UserCapability.user_id == target_id,
            UserCapability.capability == capability,
            UserCapability.revoked_at.is_(None),
        )
    )
    if existing:
        return existing
    granter = _uid(granted_by_user_id) if granted_by_user_id else None
    row = UserCapability(
        id=uuid.uuid4(),
        user_id=target_id,
        capability=capability,
        granted_by=granter,
        granted_at=datetime.now(timezone.utc),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row
