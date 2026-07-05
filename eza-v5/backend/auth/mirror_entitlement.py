# -*- coding: utf-8 -*-
"""Mirror consumer entitlement helpers (Sprint 2)."""

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import security
from backend.auth.jwt import get_user_from_token
from backend.core.account.guest_identity import GUEST_TOKEN_HEADER, resolve_guest_fingerprint
from backend.core.account.mirror_plan import MirrorPlanId, normalize_mirror_plan
from backend.core.utils.dependencies import get_db
from backend.models.production import User


async def get_production_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    try:
        import uuid

        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return None
    result = await db.execute(select(User).where(User.id == uid))
    return result.scalar_one_or_none()


async def _require_mirror_authenticated_user(
    credentials: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
) -> User:
    """Authenticated active user (free or plus)."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "auth_required",
                "message": "Authentication required",
            },
        )

    user_info = get_user_from_token(credentials.credentials)
    if user_info is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "auth_required",
                "message": "Invalid or expired token",
            },
        )

    user = await get_production_user_by_id(db, user_info["user_id"])
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "auth_required",
                "message": "User not found or inactive",
            },
        )

    return user


@dataclass(frozen=True)
class MirrorSceneActor:
    user: User | None
    guest_fingerprint: str | None


async def resolve_mirror_scene_actor(
    credentials: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
    guest_token: str | None,
) -> MirrorSceneActor:
    """Authenticated user or guest with valid X-Guest-Token for scene generation."""
    if credentials is not None:
        user_info = get_user_from_token(credentials.credentials)
        if user_info is not None:
            user = await get_production_user_by_id(db, user_info["user_id"])
            if user is not None and user.is_active:
                return MirrorSceneActor(user=user, guest_fingerprint=None)

    guest_fingerprint = resolve_guest_fingerprint(guest_token)
    if guest_fingerprint:
        return MirrorSceneActor(user=None, guest_fingerprint=guest_fingerprint)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "code": "auth_required",
            "message": "Authentication or guest token required",
            "header": GUEST_TOKEN_HEADER,
        },
    )


async def require_mirror_scene_actor(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
    x_guest_token: str | None = Header(None, alias=GUEST_TOKEN_HEADER),
) -> MirrorSceneActor:
    return await resolve_mirror_scene_actor(credentials, db, x_guest_token)


async def require_mirror_authenticated_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Free veya Plus — günlük kart sahnesi dahil scene generation için.
    Kota client-side (günde 1 kart) ve Plus-only yenileme ayrı yönetilir.
    """
    return await _require_mirror_authenticated_user(credentials, db)


async def require_mirror_plus_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Plus-only Mirror işlemleri (ileride: gün içi güncelleme, ek sahne).
    - No token → 401 auth_required
    - mirror_plan != plus → 403 upgrade_required
    """
    user = await _require_mirror_authenticated_user(credentials, db)

    plan = normalize_mirror_plan(getattr(user, "mirror_plan", "free"))
    if plan != "plus":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "upgrade_required",
                "message": "Plus plan required",
                "plan": plan,
                "required": "plus",
            },
        )

    return user
