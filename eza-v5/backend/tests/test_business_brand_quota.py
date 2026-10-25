"""Per-user, per-brand Business message allowance. Personal chat stays separate."""
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

from backend.core.account.guards import enforce_standalone_message_quota
from backend.core.account.quota_events import BUSINESS_BRAND_MESSAGE, CHAT_MESSAGE
from backend.core.account.subject import AccountSubject
from backend.core.account.tiers import AccountTier
from backend.core.account.usage_service import (
    BUSINESS_BRAND_DAILY_LIMIT,
    consume_business_brand_message,
    count_usage_events,
)
from backend.models.account_usage_event import AccountUsageEvent
from backend.services.business_yansi.answers import BusinessHistory


@compiles(JSONB, "sqlite")
def _sqlite_json(type_, compiler, **kw):
    return "JSON"


def _day(hour):
    return datetime(2026, 10, 25, hour, tzinfo=timezone.utc)


async def _db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(AccountUsageEvent.__table__.create)
    session = async_sessionmaker(engine, expire_on_commit=False)()
    return engine, session


async def _allow(session, user, brand, source, now=None):
    return await consume_business_brand_message(
        session,
        user_id=user,
        business_id=brand,
        source_id=source,
        now=now or _day(12),
    )


@pytest.mark.asyncio
async def test_same_brand_shares_one_pool_across_yansi_and_stops_at_twenty():
    engine, session = await _db()
    brand = "brand-a"
    first_yansi = BusinessHistory([], brand, [])
    second_yansi = BusinessHistory([], brand, [{"title": "other publication"}])
    assert first_yansi.business_id == second_yansi.business_id
    try:
        for index in range(BUSINESS_BRAND_DAILY_LIMIT):
            history = first_yansi if index % 2 == 0 else second_yansi
            result = await _allow(session, "user-1", history.business_id, f"m-{index}")
            assert result.created is True
        with pytest.raises(Exception) as denied:
            await _allow(session, "user-1", second_yansi.business_id, "m-21")
        assert getattr(denied.value, "reason", None) == "business_brand_daily_limit_reached"
        personal = await count_usage_events(
            session, event_types=(CHAT_MESSAGE,), user_id="user-1", guest_fingerprint=None, since=None,
        )
        assert personal == 0
    finally:
        await session.close()
        await engine.dispose()


@pytest.mark.asyncio
async def test_brands_and_users_are_independent():
    engine, session = await _db()
    try:
        for index in range(BUSINESS_BRAND_DAILY_LIMIT):
            await _allow(session, "user-1", "brand-a", f"a-{index}")
        other_brand = await _allow(session, "user-1", "brand-b", "b-1")
        other_user = await _allow(session, "user-2", "brand-a", "a-other")
        assert other_brand.created is True
        assert other_user.created is True
    finally:
        await session.close()
        await engine.dispose()


@pytest.mark.asyncio
async def test_retry_does_not_consume_twice_and_still_passes_at_the_cap():
    engine, session = await _db()
    try:
        first = await _allow(session, "user-1", "brand-a", "same-request")
        second = await _allow(session, "user-1", "brand-a", "same-request")
        assert first.created is True and second.created is False
        for index in range(1, BUSINESS_BRAND_DAILY_LIMIT):
            await _allow(session, "user-1", "brand-a", f"n-{index}")
        retry = await _allow(session, "user-1", "brand-a", "same-request")
        assert retry.created is False
        with pytest.raises(Exception):
            await _allow(session, "user-1", "brand-a", "new-after-cap")
    finally:
        await session.close()
        await engine.dispose()


@pytest.mark.asyncio
async def test_next_utc_day_starts_a_fresh_pool():
    engine, session = await _db()
    try:
        for index in range(BUSINESS_BRAND_DAILY_LIMIT):
            await _allow(session, "user-1", "brand-a", f"d-{index}", now=_day(23))
        fresh = await _allow(
            session, "user-1", "brand-a", "next-day", now=_day(23) + timedelta(hours=2),
        )
        assert fresh.created is True
    finally:
        await session.close()
        await engine.dispose()


@pytest.mark.asyncio
async def test_rejected_message_does_not_consume_a_right():
    engine, session = await _db()
    try:
        for index in range(BUSINESS_BRAND_DAILY_LIMIT):
            await _allow(session, "user-1", "brand-a", f"ok-{index}")
        with pytest.raises(Exception):
            await _allow(session, "user-1", "brand-a", "too-many")
        used = await count_usage_events(
            session,
            event_types=(BUSINESS_BRAND_MESSAGE,),
            user_id="user-1",
            guest_fingerprint=None,
            since=None,
        )
        assert used == BUSINESS_BRAND_DAILY_LIMIT
    finally:
        await session.close()
        await engine.dispose()


@pytest.mark.asyncio
async def test_concurrent_requests_cannot_pass_twenty():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as connection:
        await connection.run_sync(AccountUsageEvent.__table__.create)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def one(index):
        async with factory() as session:
            try:
                await consume_business_brand_message(
                    session,
                    user_id="user-1",
                    business_id="brand-a",
                    source_id=f"c-{index}",
                    now=_day(12),
                )
                return "allowed"
            except Exception as exc:
                return getattr(exc, "reason", "denied")

    try:
        results = await asyncio.gather(*[one(index) for index in range(30)])
        assert results.count("allowed") == BUSINESS_BRAND_DAILY_LIMIT
        assert results.count("business_brand_daily_limit_reached") == 10
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_guest_business_chat_keeps_the_guest_ceiling(monkeypatch):
    guest = AccountSubject(AccountTier.GUEST, None, "fp-guest", False)
    monkeypatch.setattr(
        "backend.core.account.guards.resolve_account_subject",
        AsyncMock(return_value=guest),
    )
    personal = AsyncMock(return_value=guest)
    brand = AsyncMock(side_effect=AssertionError("brand pool"))
    monkeypatch.setattr("backend.core.account.guards.assert_can_send_message", personal)
    monkeypatch.setattr("backend.core.account.guards.consume_business_brand_message", brand)
    await enforce_standalone_message_quota(
        AsyncMock(),
        message_text="Garanti kaç yıl?",
        credentials=None,
        guest_token="guest-token-abcdefghijklmnop",
        chat_history=BusinessHistory([], "brand-a", []),
        source_id="guest-1",
    )
    personal.assert_awaited_once()
    brand.assert_not_called()


@pytest.mark.asyncio
async def test_personal_chat_does_not_use_the_brand_pool(monkeypatch):
    user = AccountSubject(AccountTier.FREE, "user-1", None, True)
    monkeypatch.setattr(
        "backend.core.account.guards.resolve_account_subject",
        AsyncMock(return_value=user),
    )
    personal = AsyncMock(return_value=user)
    brand = AsyncMock(side_effect=AssertionError("brand pool"))
    monkeypatch.setattr("backend.core.account.guards.assert_can_send_message", personal)
    monkeypatch.setattr("backend.core.account.guards.consume_business_brand_message", brand)
    await enforce_standalone_message_quota(
        AsyncMock(),
        message_text="Merhaba",
        credentials=None,
        guest_token=None,
        chat_history=[{"role": "user", "content": "önceki"}],
        source_id="personal-1",
    )
    personal.assert_awaited_once()
    brand.assert_not_called()


@pytest.mark.asyncio
async def test_overlong_business_message_is_refused_before_it_is_counted(monkeypatch):
    user = AccountSubject(AccountTier.FREE, "user-1", None, True)
    monkeypatch.setattr(
        "backend.core.account.guards.resolve_account_subject",
        AsyncMock(return_value=user),
    )
    brand = AsyncMock(side_effect=AssertionError("counted"))
    monkeypatch.setattr("backend.core.account.guards.consume_business_brand_message", brand)
    with pytest.raises(HTTPException) as denied:
        await enforce_standalone_message_quota(
            AsyncMock(),
            message_text="x" * 501,
            credentials=None,
            guest_token=None,
            chat_history=BusinessHistory([], "brand-a", []),
            source_id="long-1",
        )
    assert denied.value.detail["reason"] == "message_too_long"
    brand.assert_not_called()
