# -*- coding: utf-8 -*-
"""SAINA account tiers and entitlement configuration (single source of truth)."""

from __future__ import annotations

from enum import Enum
from typing import Literal, TypedDict

from backend.auth.mirror_entitlement import MirrorPlanId, normalize_mirror_plan

RelationshipMapAccess = Literal["locked", "last_90_days", "all"]
ImageQuality = Literal["medium", "high", "highest"]


class AccountTier(str, Enum):
    GUEST = "guest"
    FREE = "free"
    MINI = "mini"
    STANDARD = "standard"
    PREMIUM = "premium"


class TierEntitlements(TypedDict):
    tier: str
    dailyMessageLimit: int
    maxMessageChars: int
    mirrorCooldownHours: int | None
    dailyMirrorLimit: int | None
    dailyDiscoverStartLimit: int
    relationshipMapAccess: RelationshipMapAccess
    imageQuality: ImageQuality
    priorityGeneration: bool


class AccountUsageSnapshot(TypedDict):
    dailyMessagesUsed: int
    dailyMessagesLimit: int
    dailyDiscoverStartsUsed: int
    dailyDiscoverStartsLimit: int
    visualCreationsUsed: int
    visualCreationsLimit: int | None
    nextVisualAvailableAt: str | None


TIER_LABELS: dict[AccountTier, str] = {
    AccountTier.GUEST: "SAINA Guest",
    AccountTier.FREE: "SAINA Free",
    AccountTier.MINI: "SAINA Mini",
    AccountTier.STANDARD: "SAINA Standard",
    AccountTier.PREMIUM: "SAINA Premium",
}

# Internal caps for premium — never surfaced as "unlimited" in product copy.
_PREMIUM_DAILY_MESSAGE_CAP = 5000
_PREMIUM_DAILY_MIRROR_CAP = 50
_PREMIUM_DAILY_DISCOVER_CAP = 200

TIER_ENTITLEMENTS: dict[AccountTier, TierEntitlements] = {
    AccountTier.GUEST: {
        "tier": AccountTier.GUEST.value,
        "dailyMessageLimit": 10,
        "maxMessageChars": 500,
        "mirrorCooldownHours": None,
        "dailyMirrorLimit": 1,
        "dailyDiscoverStartLimit": 1,
        "relationshipMapAccess": "locked",
        "imageQuality": "medium",
        "priorityGeneration": False,
    },
    AccountTier.FREE: {
        "tier": AccountTier.FREE.value,
        "dailyMessageLimit": 20,
        "maxMessageChars": 500,
        "mirrorCooldownHours": None,
        "dailyMirrorLimit": 0,
        "dailyDiscoverStartLimit": 1,
        "relationshipMapAccess": "locked",
        "imageQuality": "medium",
        "priorityGeneration": False,
    },
    AccountTier.MINI: {
        "tier": AccountTier.MINI.value,
        "dailyMessageLimit": 50,
        "maxMessageChars": 800,
        "mirrorCooldownHours": 48,
        "dailyMirrorLimit": None,
        "dailyDiscoverStartLimit": 10,
        "relationshipMapAccess": "last_90_days",
        "imageQuality": "medium",
        "priorityGeneration": False,
    },
    AccountTier.STANDARD: {
        "tier": AccountTier.STANDARD.value,
        "dailyMessageLimit": 100,
        "maxMessageChars": 2000,
        "mirrorCooldownHours": None,
        "dailyMirrorLimit": 1,
        "dailyDiscoverStartLimit": 20,
        "relationshipMapAccess": "all",
        "imageQuality": "high",
        "priorityGeneration": True,
    },
    AccountTier.PREMIUM: {
        "tier": AccountTier.PREMIUM.value,
        "dailyMessageLimit": _PREMIUM_DAILY_MESSAGE_CAP,
        "maxMessageChars": 16000,
        "mirrorCooldownHours": None,
        "dailyMirrorLimit": _PREMIUM_DAILY_MIRROR_CAP,
        "dailyDiscoverStartLimit": _PREMIUM_DAILY_DISCOVER_CAP,
        "relationshipMapAccess": "all",
        "imageQuality": "highest",
        "priorityGeneration": True,
    },
}


def get_tier_label(tier: AccountTier) -> str:
    return TIER_LABELS[tier]


def get_entitlements_for_tier(tier: AccountTier) -> TierEntitlements:
    return dict(TIER_ENTITLEMENTS[tier])


def map_mirror_plan_to_tier(
    mirror_plan: str | None,
    *,
    is_authenticated: bool,
) -> AccountTier:
    """Map legacy mirror_plan storage to SAINA account tier."""
    if not is_authenticated:
        return AccountTier.GUEST

    plan: MirrorPlanId = normalize_mirror_plan(mirror_plan)
    if plan == "plus":
        return AccountTier.PREMIUM
    return AccountTier.FREE


def resolve_account_tier(
    mirror_plan: str | None,
    *,
    is_authenticated: bool,
    explicit_tier: str | None = None,
) -> AccountTier:
    """Resolve tier — explicit DB tier wins when mini/standard SKUs land."""
    if explicit_tier:
        try:
            return AccountTier(explicit_tier)
        except ValueError:
            pass
    return map_mirror_plan_to_tier(mirror_plan, is_authenticated=is_authenticated)


def build_stub_usage(entitlements: TierEntitlements) -> AccountUsageSnapshot:
    """Zeroed usage when no subject (user/guest fingerprint) is available."""
    return {
        "dailyMessagesUsed": 0,
        "dailyMessagesLimit": entitlements["dailyMessageLimit"],
        "dailyDiscoverStartsUsed": 0,
        "dailyDiscoverStartsLimit": entitlements["dailyDiscoverStartLimit"],
        "visualCreationsUsed": 0,
        "visualCreationsLimit": entitlements["dailyMirrorLimit"],
        "nextVisualAvailableAt": None,
    }
