# -*- coding: utf-8 -*-

"""SAINA account entitlements — tier config + usage rollup (PR2)."""



from typing import Any



from fastapi import APIRouter, Depends, Header

from fastapi.security import HTTPAuthorizationCredentials

from pydantic import BaseModel, Field

from sqlalchemy.ext.asyncio import AsyncSession



from backend.auth.deps import security

from backend.auth.jwt import get_user_from_token

from backend.auth.mirror_entitlement import get_production_user_by_id, normalize_mirror_plan

from backend.core.account.guest_identity import GUEST_TOKEN_HEADER, resolve_guest_fingerprint

from backend.core.account.tiers import (

    AccountTier,

    TierEntitlements,

    build_stub_usage,

    get_entitlements_for_tier,

    get_tier_label,

    resolve_account_tier,

)

from backend.core.account.usage_service import build_account_usage_snapshot

from backend.core.utils.dependencies import get_db



router = APIRouter()





class AccountUsageResponse(BaseModel):

    dailyMessagesUsed: int

    dailyMessagesLimit: int

    dailyDiscoverStartsUsed: int

    dailyDiscoverStartsLimit: int

    visualCreationsUsed: int = 0

    visualCreationsLimit: int | None = None

    nextVisualAvailableAt: str | None = None





class AccountEntitlementsResponse(BaseModel):

    tier: str

    label: str

    entitlements: dict[str, Any] = Field(description="TierEntitlements payload")

    usage: AccountUsageResponse





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



    return AccountEntitlementsResponse(

        tier=tier.value,

        label=get_tier_label(tier),

        entitlements=dict(entitlements),

        usage=AccountUsageResponse(**usage),

    )


