# -*- coding: utf-8 -*-
"""SAINA account quota guards — backend authority."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.account.quota_events import (
    CHAT_MESSAGE,
    DISCOVER_CONVERSATION_STARTED,
    MIRROR_CREATED,
)
from backend.core.account.subject import AccountSubject, resolve_account_subject
from backend.core.account.tiers import AccountTier, get_entitlements_for_tier, resolve_account_tier
from backend.core.account.usage_service import (
    build_account_usage_snapshot,
    record_account_usage_event,
)
from backend.auth.mirror_entitlement import normalize_mirror_plan
from backend.core.account.guest_identity import GUEST_TOKEN_HEADER
from backend.models.production import User
from fastapi.security import HTTPAuthorizationCredentials


def recommended_tier_for_upgrade(tier: AccountTier) -> str | None:
    return {
        AccountTier.GUEST: "free",
        AccountTier.FREE: "mini",
        AccountTier.MINI: "standard",
        AccountTier.STANDARD: "premium",
    }.get(tier)


def _quota_denied(
    *,
    reason: str,
    tier: AccountTier,
    upgrade_required: bool,
) -> HTTPException:
    recommended = recommended_tier_for_upgrade(tier)
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "allowed": False,
            "reason": reason,
            "upgradeRequired": upgrade_required,
            "currentTier": tier.value,
            "recommendedTier": recommended,
        },
    )


async def assert_can_send_message(
    db: AsyncSession,
    *,
    message_text: str,
    credentials: HTTPAuthorizationCredentials | None,
    guest_token: str | None,
    source_id: str | None = None,
    record_on_success: bool = True,
) -> AccountSubject:
    """
    Enforce message quota and optional max length.
    Records chat_message event when allowed and record_on_success=True.
    """
    subject = await resolve_account_subject(
        db,
        credentials=credentials,
        guest_token=guest_token,
    )
    entitlements = get_entitlements_for_tier(subject.tier)
    message = (message_text or "").strip()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"allowed": False, "reason": "empty_message"},
        )

    max_chars = entitlements["maxMessageChars"]
    if len(message) > max_chars:
        raise _quota_denied(
            reason="message_too_long",
            tier=subject.tier,
            upgrade_required=subject.tier != AccountTier.PREMIUM,
        )

    if not subject.is_authenticated and not subject.guest_fingerprint:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "allowed": False,
                "reason": "guest_token_required",
                "upgradeRequired": False,
                "currentTier": subject.tier.value,
                "recommendedTier": None,
                "header": GUEST_TOKEN_HEADER,
            },
        )

    usage = await build_account_usage_snapshot(
        db,
        tier=subject.tier,
        entitlements=entitlements,
        user_id=subject.user_id,
        guest_fingerprint=subject.guest_fingerprint,
    )

    if usage["dailyMessagesUsed"] >= usage["dailyMessagesLimit"]:
        reason = (
            "guest_message_limit_reached"
            if subject.tier == AccountTier.GUEST
            else "daily_message_limit_reached"
        )
        raise _quota_denied(
            reason=reason,
            tier=subject.tier,
            upgrade_required=subject.tier != AccountTier.PREMIUM,
        )

    if record_on_success:
        await record_account_usage_event(
            db,
            event_type=CHAT_MESSAGE,
            user_id=subject.user_id,
            guest_fingerprint=subject.guest_fingerprint,
            source_id=source_id,
            metadata={"chars": len(message)},
        )

    return subject


def _subject_from_user(user: User) -> AccountSubject:
    return AccountSubject(
        tier=resolve_account_tier(
            normalize_mirror_plan(getattr(user, "mirror_plan", "free")),
            is_authenticated=True,
        ),
        user_id=str(user.id),
        guest_fingerprint=None,
        is_authenticated=True,
    )


async def assert_can_create_visual(
    db: AsyncSession,
    *,
    credentials: HTTPAuthorizationCredentials | None = None,
    guest_token: str | None = None,
    user: User | None = None,
    record_on_success: bool = False,
    event_type: str | None = None,
    source_id: str | None = None,
) -> AccountSubject:
    """Enforce shared mirror/yansi visual quota. Records event when requested."""
    if user is not None:
        subject = _subject_from_user(user)
    else:
        subject = await resolve_account_subject(
            db,
            credentials=credentials,
            guest_token=guest_token,
        )

    entitlements = get_entitlements_for_tier(subject.tier)
    daily_limit = entitlements["dailyMirrorLimit"]

    if daily_limit == 0:
        raise _quota_denied(
            reason="visual_not_available_on_tier",
            tier=subject.tier,
            upgrade_required=True,
        )

    usage = await build_account_usage_snapshot(
        db,
        tier=subject.tier,
        entitlements=entitlements,
        user_id=subject.user_id,
        guest_fingerprint=subject.guest_fingerprint,
    )

    if usage["nextVisualAvailableAt"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "allowed": False,
                "reason": "visual_cooldown_active",
                "upgradeRequired": subject.tier != AccountTier.PREMIUM,
                "currentTier": subject.tier.value,
                "recommendedTier": recommended_tier_for_upgrade(subject.tier),
                "nextVisualAvailableAt": usage["nextVisualAvailableAt"],
            },
        )

    visual_limit = usage["visualCreationsLimit"]
    visual_used = usage["visualCreationsUsed"]
    if visual_limit is not None and visual_used >= visual_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "allowed": False,
                "reason": "visual_daily_limit_reached",
                "upgradeRequired": subject.tier != AccountTier.PREMIUM,
                "currentTier": subject.tier.value,
                "recommendedTier": recommended_tier_for_upgrade(subject.tier),
                "nextVisualAvailableAt": usage["nextVisualAvailableAt"],
            },
        )

    if record_on_success and event_type:
        await record_account_usage_event(
            db,
            event_type=event_type,
            user_id=subject.user_id,
            guest_fingerprint=subject.guest_fingerprint,
            source_id=source_id,
            metadata={"lineage": "mirror" if event_type == MIRROR_CREATED else "yansi"},
        )

    return subject


async def assert_can_start_discover_conversation(
    db: AsyncSession,
    *,
    credentials: HTTPAuthorizationCredentials | None = None,
    guest_token: str | None = None,
    user: User | None = None,
    mirror_slug: str | None = None,
    record_on_success: bool = False,
) -> AccountSubject:
    """Enforce discover sohbet start quota. Records event when record_on_success=True."""
    if user is not None:
        subject = _subject_from_user(user)
    else:
        subject = await resolve_account_subject(
            db,
            credentials=credentials,
            guest_token=guest_token,
        )

    if not subject.is_authenticated and not subject.guest_fingerprint:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "allowed": False,
                "reason": "guest_token_required",
                "upgradeRequired": False,
                "currentTier": subject.tier.value,
                "recommendedTier": None,
                "header": GUEST_TOKEN_HEADER,
            },
        )

    entitlements = get_entitlements_for_tier(subject.tier)
    usage = await build_account_usage_snapshot(
        db,
        tier=subject.tier,
        entitlements=entitlements,
        user_id=subject.user_id,
        guest_fingerprint=subject.guest_fingerprint,
    )

    if usage["dailyDiscoverStartsUsed"] >= usage["dailyDiscoverStartsLimit"]:
        reason = (
            "guest_discover_limit_reached"
            if subject.tier == AccountTier.GUEST
            else "daily_discover_limit_reached"
        )
        raise _quota_denied(
            reason=reason,
            tier=subject.tier,
            upgrade_required=subject.tier != AccountTier.PREMIUM,
        )

    if record_on_success:
        await record_account_usage_event(
            db,
            event_type=DISCOVER_CONVERSATION_STARTED,
            user_id=subject.user_id,
            guest_fingerprint=subject.guest_fingerprint,
            source_id=mirror_slug,
            metadata={"mirrorSlug": mirror_slug} if mirror_slug else None,
        )

    return subject


def relationship_map_access_for_tier(tier: AccountTier) -> str:
    return get_entitlements_for_tier(tier)["relationshipMapAccess"]


def assert_relationship_map_data_access(subject: AccountSubject) -> str:
    """
    Return relationship map access level for subject.
    Raises 403 when map data is locked (guest/free preview-only tiers).
    """
    access = relationship_map_access_for_tier(subject.tier)
    if access == "locked":
        raise _quota_denied(
            reason="relationship_map_locked",
            tier=subject.tier,
            upgrade_required=subject.tier != AccountTier.PREMIUM,
        )
    return access


def parse_quota_error_detail(detail: Any) -> dict[str, Any] | None:
    if isinstance(detail, dict) and detail.get("allowed") is False:
        return detail
    return None
