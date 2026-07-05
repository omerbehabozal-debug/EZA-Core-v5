# -*- coding: utf-8 -*-
"""SAINA account tiers and entitlement configuration (single source of truth)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Literal, TypedDict

from backend.core.account.mirror_plan import normalize_mirror_plan

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
    dailyMessagesLimit: int | None
    dailyDiscoverStartsUsed: int
    dailyDiscoverStartsLimit: int | None
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


def resolve_user_account_tier(
    *,
    mirror_plan: str | None,
    account_tier: str | None,
    is_authenticated: bool,
) -> AccountTier:
    """Resolve tier from production user columns."""
    return resolve_account_tier(
        mirror_plan,
        is_authenticated=is_authenticated,
        explicit_tier=(account_tier or "").strip() or None,
    )


def relationship_map_cutoff_iso(tier: AccountTier, now: datetime | None = None) -> str | None:
    """Server-authoritative cutoff for mini-tier map window."""
    if get_entitlements_for_tier(tier)["relationshipMapAccess"] != "last_90_days":
        return None
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return (current - timedelta(days=90)).isoformat()


def to_public_entitlements(tier: AccountTier, entitlements: TierEntitlements) -> dict[str, Any]:
    """Strip internal premium caps from API-facing entitlement payload."""
    public: dict[str, Any] = dict(entitlements)
    if tier == AccountTier.PREMIUM:
        public["dailyMessageLimit"] = None
        public["dailyMirrorLimit"] = None
        public["dailyDiscoverStartLimit"] = None
    public["relationshipMapCutoffIso"] = relationship_map_cutoff_iso(tier)
    return public


def to_public_usage_snapshot(tier: AccountTier, usage: AccountUsageSnapshot) -> AccountUsageSnapshot:
    """Hide internal premium caps in usage limits shown to clients."""
    if tier != AccountTier.PREMIUM:
        return usage
    return {
        **usage,
        "dailyMessagesLimit": None,  # type: ignore[typeddict-item]
        "visualCreationsLimit": None,
        "dailyDiscoverStartsLimit": None,  # type: ignore[typeddict-item]
    }


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
