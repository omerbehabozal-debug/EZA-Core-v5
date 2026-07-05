# -*- coding: utf-8 -*-
"""SAINA account entitlements — tier config + usage rollup."""

from typing import Any

from fastapi import APIRouter, Depends, Header
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import security
from backend.auth.jwt import get_user_from_token
from backend.auth.mirror_entitlement import get_production_user_by_id, normalize_mirror_plan
from backend.core.account.guest_identity import GUEST_TOKEN_HEADER, resolve_guest_fingerprint
from backend.core.account.guards import assert_relationship_map_data_access
from backend.core.account.subject import resolve_account_subject
from backend.core.account.tiers import (
    AccountTier,
    TierEntitlements,
    build_stub_usage,
    get_entitlements_for_tier,
    get_tier_label,
    resolve_user_account_tier,
    to_public_entitlements,
    to_public_usage_snapshot,
)
from backend.core.account.usage_service import build_account_usage_snapshot
from backend.core.utils.dependencies import get_db

router = APIRouter()


class AccountUsageResponse(BaseModel):
    dailyMessagesUsed: int
    dailyMessagesLimit: int | None = None
    dailyDiscoverStartsUsed: int
    dailyDiscoverStartsLimit: int | None = None
    visualCreationsUsed: int = 0
    visualCreationsLimit: int | None = None
    nextVisualAvailableAt: str | None = None


class AccountEntitlementsResponse(BaseModel):
    tier: str
    label: str
    entitlements: dict[str, Any] = Field(description="Public tier entitlement payload")
    usage: AccountUsageResponse


class RelationshipMapAccessResponse(BaseModel):
    access: str
    relationshipMapCutoffIso: str | None = None


@router.get("/entitlements", response_model=AccountEntitlementsResponse)
async def get_account_entitlements(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
    x_guest_token: str | None = Header(None, alias=GUEST_TOKEN_HEADER),
) -> AccountEntitlementsResponse:
    """
    Current account tier, entitlement config, and usage snapshot.
    Guests may pass X-Guest-Token for fingerprint-based usage rollup.
    """
    is_authenticated = False
    mirror_plan: str | None = None
    account_tier: str | None = None
    user_id: str | None = None

    if credentials is not None:
        user_info = get_user_from_token(credentials.credentials)
        if user_info is not None:
            user = await get_production_user_by_id(db, user_info["user_id"])
            if user is not None and user.is_active:
                is_authenticated = True
                user_id = str(user.id)
                mirror_plan = normalize_mirror_plan(getattr(user, "mirror_plan", "free"))
                account_tier = getattr(user, "account_tier", None)

    tier = resolve_user_account_tier(
        mirror_plan=mirror_plan,
        account_tier=account_tier,
        is_authenticated=is_authenticated,
    )
    entitlements: TierEntitlements = get_entitlements_for_tier(tier)

    guest_fingerprint = None if is_authenticated else resolve_guest_fingerprint(x_guest_token)

    if user_id or guest_fingerprint:
        usage = await build_account_usage_snapshot(
            db,
            tier=tier,
            entitlements=entitlements,
            user_id=user_id,
            guest_fingerprint=guest_fingerprint,
        )
    else:
        usage = build_stub_usage(entitlements)

    public_usage = to_public_usage_snapshot(tier, usage)

    return AccountEntitlementsResponse(
        tier=tier.value,
        label=get_tier_label(tier),
        entitlements=to_public_entitlements(tier, entitlements),
        usage=AccountUsageResponse(**public_usage),
    )


@router.get("/relationship-map-access", response_model=RelationshipMapAccessResponse)
async def get_relationship_map_access(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
    x_guest_token: str | None = Header(None, alias=GUEST_TOKEN_HEADER),
) -> RelationshipMapAccessResponse:
    """Backend authority for relationship map data window (403 when locked)."""
    subject = await resolve_account_subject(
        db,
        credentials=credentials,
        guest_token=x_guest_token,
    )
    access = assert_relationship_map_data_access(subject)
    entitlements = get_entitlements_for_tier(subject.tier)
    public = to_public_entitlements(subject.tier, entitlements)
    return RelationshipMapAccessResponse(
        access=access,
        relationshipMapCutoffIso=public.get("relationshipMapCutoffIso"),
    )
