# -*- coding: utf-8 -*-
"""Mirror consumer entitlement helpers (Sprint 2)."""

from typing import Literal

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import security
from backend.auth.jwt import get_user_from_token
from backend.core.utils.dependencies import get_db
from backend.models.production import User

MirrorPlanId = Literal["free", "plus"]


def normalize_mirror_plan(raw: str | None) -> MirrorPlanId:
    return "plus" if raw == "plus" else "free"


async def get_production_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    try:
        import uuid

        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return None
    result = await db.execute(select(User).where(User.id == uid))
    return result.scalar_one_or_none()


async def require_mirror_plus_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Authenticated Plus user required for Mirror scene generation.
    - No token → 401 auth_required
    - Invalid token → 401 auth_required
    - mirror_plan != plus → 403 upgrade_required
    """
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

    plan = normalize_mirror_plan(getattr(user, "mirror_plan", "free"))
    if plan != "plus":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "upgrade_required",
                "message": "Plus plan required for scene generation",
                "plan": plan,
                "required": "plus",
            },
        )

    return user
