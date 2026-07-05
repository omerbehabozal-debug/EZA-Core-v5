# -*- coding: utf-8 -*-
"""SAINA account usage event recording and rollup."""

from __future__ import annotations

import zlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.account.quota_events import (
    CHAT_MESSAGE,
    DISCOVER_CONVERSATION_STARTED,
    VISUAL_EVENT_TYPES,
)
from backend.core.account.tiers import AccountTier, AccountUsageSnapshot, TierEntitlements
from backend.models.account_usage_event import AccountUsageEvent


class UsageQuotaExceeded(Exception):
    """Domain quota denial — map to HTTP 403, never 500."""

    def __init__(
        self,
        *,
        reason: str,
        tier: AccountTier,
        upgrade_required: bool = True,
        next_visual_available_at: str | None = None,
    ) -> None:
        self.reason = reason
        self.tier = tier
        self.upgrade_required = upgrade_required
        self.next_visual_available_at = next_visual_available_at
        super().__init__(reason)


@dataclass(frozen=True)
class UsageConsumeResult:
    event: AccountUsageEvent
    created: bool


def utc_day_start(now: datetime | None = None) -> datetime:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.replace(hour=0, minute=0, second=0, microsecond=0)


def _subject_filter(
    *,
    user_id: str | None,
    guest_fingerprint: str | None,
):
    clauses = []
    if user_id:
        clauses.append(AccountUsageEvent.user_id == str(user_id))
    if guest_fingerprint:
        clauses.append(AccountUsageEvent.guest_fingerprint == guest_fingerprint)
    if not clauses:
        return None
    if len(clauses) == 1:
        return clauses[0]
    return or_(*clauses)


def _quota_lock_key(*, user_id: str | None, guest_fingerprint: str | None, event_type: str) -> int:
    raw = f"{user_id or ''}:{guest_fingerprint or ''}:{event_type}"
    return zlib.crc32(raw.encode("utf-8")) & 0x7FFFFFFF


async def _acquire_subject_quota_lock(
    db: AsyncSession,
    *,
    user_id: str | None,
    guest_fingerprint: str | None,
    event_type: str,
) -> None:
    bind = db.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return
    lock_id = _quota_lock_key(
        user_id=user_id, guest_fingerprint=guest_fingerprint, event_type=event_type
    )
    await db.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": lock_id})


async def _find_usage_event_by_source(
    db: AsyncSession,
    *,
    event_type: str,
    user_id: str | None,
    guest_fingerprint: str | None,
    source_id: str,
) -> AccountUsageEvent | None:
    subject = _subject_filter(user_id=user_id, guest_fingerprint=guest_fingerprint)
    if subject is None:
        return None
    result = await db.execute(
        select(AccountUsageEvent).where(
            and_(
                subject,
                AccountUsageEvent.event_type == event_type,
                AccountUsageEvent.source_id == source_id,
            )
        )
    )
    return result.scalar_one_or_none()


async def _assert_visual_quota_available(
    db: AsyncSession,
    *,
    tier: AccountTier,
    entitlements: TierEntitlements,
    user_id: str | None,
    guest_fingerprint: str | None,
    now: datetime | None = None,
) -> None:
    daily_limit = entitlements["dailyMirrorLimit"]
    if daily_limit == 0:
        raise UsageQuotaExceeded(
            reason="visual_not_available_on_tier",
            tier=tier,
            upgrade_required=True,
        )

    usage = await build_account_usage_snapshot(
        db,
        tier=tier,
        entitlements=entitlements,
        user_id=user_id,
        guest_fingerprint=guest_fingerprint,
        now=now,
    )

    if usage["nextVisualAvailableAt"]:
        raise UsageQuotaExceeded(
            reason="visual_cooldown_active",
            tier=tier,
            upgrade_required=tier != AccountTier.PREMIUM,
            next_visual_available_at=usage["nextVisualAvailableAt"],
        )

    visual_limit = usage["visualCreationsLimit"]
    visual_used = usage["visualCreationsUsed"]
    if visual_limit is not None and visual_used >= visual_limit:
        raise UsageQuotaExceeded(
            reason="visual_daily_limit_reached",
            tier=tier,
            upgrade_required=tier != AccountTier.PREMIUM,
            next_visual_available_at=usage["nextVisualAvailableAt"],
        )


async def consume_usage_event_atomic(
    db: AsyncSession,
    *,
    event_type: str,
    user_id: str | None = None,
    guest_fingerprint: str | None = None,
    source_id: str,
    tier: AccountTier,
    entitlements: TierEntitlements,
    metadata: dict[str, Any] | None = None,
    now: datetime | None = None,
) -> UsageConsumeResult:
    """
    Atomically enforce quota and insert (or return existing) usage event.

    Idempotent for the same source_id. Race-safe for parallel different source_ids.
    """
    if not user_id and not guest_fingerprint:
        raise ValueError("user_id or guest_fingerprint is required")

    normalized_source = (source_id or "").strip()
    if not normalized_source:
        raise ValueError("source_id is required for atomic consume")

    await _acquire_subject_quota_lock(
        db,
        user_id=user_id,
        guest_fingerprint=guest_fingerprint,
        event_type=event_type,
    )

    existing = await _find_usage_event_by_source(
        db,
        event_type=event_type,
        user_id=user_id,
        guest_fingerprint=guest_fingerprint,
        source_id=normalized_source,
    )
    if existing is not None:
        return UsageConsumeResult(event=existing, created=False)

    await _assert_visual_quota_available(
        db,
        tier=tier,
        entitlements=entitlements,
        user_id=user_id,
        guest_fingerprint=guest_fingerprint,
        now=now,
    )

    event = AccountUsageEvent(
        user_id=str(user_id) if user_id else None,
        guest_fingerprint=guest_fingerprint,
        event_type=event_type,
        source_id=normalized_source,
        event_metadata=metadata,
    )
    db.add(event)
    try:
        async with db.begin_nested():
            await db.flush()
        return UsageConsumeResult(event=event, created=True)
    except IntegrityError:
        raced = await _find_usage_event_by_source(
            db,
            event_type=event_type,
            user_id=user_id,
            guest_fingerprint=guest_fingerprint,
            source_id=normalized_source,
        )
        if raced is not None:
            return UsageConsumeResult(event=raced, created=False)
        await _assert_visual_quota_available(
            db,
            tier=tier,
            entitlements=entitlements,
            user_id=user_id,
            guest_fingerprint=guest_fingerprint,
            now=now,
        )
        raise UsageQuotaExceeded(
            reason="visual_daily_limit_reached",
            tier=tier,
            upgrade_required=tier != AccountTier.PREMIUM,
        )


async def record_account_usage_event(
    db: AsyncSession,
    *,
    event_type: str,
    user_id: str | None = None,
    guest_fingerprint: str | None = None,
    source_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AccountUsageEvent:
    """Insert a quota usage event. Idempotent when source_id is provided."""
    if not user_id and not guest_fingerprint:
        raise ValueError("user_id or guest_fingerprint is required")

    normalized_source = (source_id or "").strip() or None
    if normalized_source:
        found = await _find_usage_event_by_source(
            db,
            event_type=event_type,
            user_id=user_id,
            guest_fingerprint=guest_fingerprint,
            source_id=normalized_source,
        )
        if found is not None:
            return found

    event = AccountUsageEvent(
        user_id=str(user_id) if user_id else None,
        guest_fingerprint=guest_fingerprint,
        event_type=event_type,
        source_id=normalized_source,
        event_metadata=metadata,
    )
    db.add(event)
    await db.flush()
    return event


async def count_usage_events(
    db: AsyncSession,
    *,
    event_types: tuple[str, ...],
    user_id: str | None,
    guest_fingerprint: str | None,
    since: datetime | None,
) -> int:
    subject = _subject_filter(user_id=user_id, guest_fingerprint=guest_fingerprint)
    if subject is None:
        return 0

    filters = [subject, AccountUsageEvent.event_type.in_(event_types)]
    if since is not None:
        filters.append(AccountUsageEvent.created_at >= since)

    result = await db.execute(
        select(func.count()).select_from(AccountUsageEvent).where(and_(*filters))
    )
    return int(result.scalar_one() or 0)


async def get_last_usage_event_at(
    db: AsyncSession,
    *,
    event_types: tuple[str, ...],
    user_id: str | None,
    guest_fingerprint: str | None,
) -> datetime | None:
    subject = _subject_filter(user_id=user_id, guest_fingerprint=guest_fingerprint)
    if subject is None:
        return None

    result = await db.execute(
        select(func.max(AccountUsageEvent.created_at)).where(
            and_(subject, AccountUsageEvent.event_type.in_(event_types))
        )
    )
    return result.scalar_one_or_none()


async def compute_next_visual_available_at(
    db: AsyncSession,
    *,
    tier: AccountTier,
    entitlements: TierEntitlements,
    user_id: str | None,
    guest_fingerprint: str | None,
    now: datetime | None = None,
) -> str | None:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)

    daily_limit = entitlements["dailyMirrorLimit"]
    if daily_limit == 0:
        return None

    cooldown_hours = entitlements["mirrorCooldownHours"]
    if cooldown_hours:
        last_at = await get_last_usage_event_at(
            db,
            event_types=VISUAL_EVENT_TYPES,
            user_id=user_id,
            guest_fingerprint=guest_fingerprint,
        )
        if last_at is not None:
            if last_at.tzinfo is None:
                last_at = last_at.replace(tzinfo=timezone.utc)
            next_at = last_at + timedelta(hours=cooldown_hours)
            if next_at > current:
                return next_at.isoformat()
        return None

    since = None if tier == AccountTier.GUEST else utc_day_start(current)
    visual_count = await count_usage_events(
        db,
        event_types=VISUAL_EVENT_TYPES,
        user_id=user_id,
        guest_fingerprint=guest_fingerprint,
        since=since,
    )

    if daily_limit is not None and visual_count >= daily_limit:
        if tier == AccountTier.GUEST:
            return None
        tomorrow = utc_day_start(current) + timedelta(days=1)
        return tomorrow.isoformat()

    return None


async def build_account_usage_snapshot(
    db: AsyncSession,
    *,
    tier: AccountTier,
    entitlements: TierEntitlements,
    user_id: str | None,
    guest_fingerprint: str | None,
    now: datetime | None = None,
) -> AccountUsageSnapshot:
    """Roll up usage counters from account_usage_events."""
    current = now or datetime.now(timezone.utc)

    message_since = None if tier == AccountTier.GUEST else utc_day_start(current)
    discover_since = None if tier == AccountTier.GUEST else utc_day_start(current)

    daily_messages_used = await count_usage_events(
        db,
        event_types=(CHAT_MESSAGE,),
        user_id=user_id,
        guest_fingerprint=guest_fingerprint,
        since=message_since,
    )
    daily_discover_starts_used = await count_usage_events(
        db,
        event_types=(DISCOVER_CONVERSATION_STARTED,),
        user_id=user_id,
        guest_fingerprint=guest_fingerprint,
        since=discover_since,
    )
    visual_since = None if tier == AccountTier.GUEST else utc_day_start(current)
    visual_creations_used = await count_usage_events(
        db,
        event_types=VISUAL_EVENT_TYPES,
        user_id=user_id,
        guest_fingerprint=guest_fingerprint,
        since=visual_since,
    )
    next_visual_available_at = await compute_next_visual_available_at(
        db,
        tier=tier,
        entitlements=entitlements,
        user_id=user_id,
        guest_fingerprint=guest_fingerprint,
        now=current,
    )

    return {
        "dailyMessagesUsed": daily_messages_used,
        "dailyMessagesLimit": entitlements["dailyMessageLimit"],
        "dailyDiscoverStartsUsed": daily_discover_starts_used,
        "dailyDiscoverStartsLimit": entitlements["dailyDiscoverStartLimit"],
        "visualCreationsUsed": visual_creations_used,
        "visualCreationsLimit": entitlements["dailyMirrorLimit"],
        "nextVisualAvailableAt": next_visual_available_at,
    }
