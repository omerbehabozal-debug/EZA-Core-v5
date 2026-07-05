# -*- coding: utf-8 -*-
"""Resolved SAINA account subject for quota guards."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt import get_user_from_token
from backend.auth.mirror_entitlement import get_production_user_by_id, normalize_mirror_plan
from backend.core.account.guest_identity import resolve_guest_fingerprint
from backend.core.account.tiers import AccountTier, resolve_account_tier


@dataclass(frozen=True)
class AccountSubject:
    tier: AccountTier
    user_id: str | None
    guest_fingerprint: str | None
    is_authenticated: bool


async def resolve_account_subject(
    db: AsyncSession,
    *,
    credentials: HTTPAuthorizationCredentials | None,
    guest_token: str | None,
) -> AccountSubject:
    is_authenticated = False
    mirror_plan: str | None = None
    user_id: str | None = None

    if credentials is not None:
        user_info = get_user_from_token(credentials.credentials)
        if user_info is not None:
            user = await get_production_user_by_id(db, user_info["user_id"])
            if user is not None and user.is_active:
                is_authenticated = True
                user_id = str(user.id)
                mirror_plan = normalize_mirror_plan(getattr(user, "mirror_plan", "free"))

    tier = resolve_account_tier(mirror_plan, is_authenticated=is_authenticated)
    guest_fingerprint = None if is_authenticated else resolve_guest_fingerprint(guest_token)

    return AccountSubject(
        tier=tier,
        user_id=user_id,
        guest_fingerprint=guest_fingerprint,
        is_authenticated=is_authenticated,
    )
