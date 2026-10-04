# -*- coding: utf-8 -*-
"""Katkı HTTP buckets are separate from standalone traffic and from each other."""

from __future__ import annotations

import inspect
import sys

import pytest
from starlette.requests import Request

from backend.security.rate_limit import (
    KATKI_READ_LIMIT,
    KATKI_WRITE_LIMIT,
    RateLimitError,
    rate_limit_katki_read,
    rate_limit_katki_write,
    rate_limit_standalone,
)
from backend.services.mirror_network.katki_create import (
    KATKI_CREATE_DAILY_LIMIT,
    KATKI_CREATE_HOURLY_LIMIT,
    _acquire_create_lock,
    create_katki,
)


def _limits():
    return sys.modules["backend.security.rate_limit"]


def _request(host: str) -> Request:
    return Request(
        {
            "type": "http",
            "headers": [],
            "client": (host, 9),
            "method": "GET",
            "path": "/",
            "scheme": "http",
            "server": ("test", 80),
            "query_string": b"",
        }
    )


@pytest.fixture(autouse=True)
def _isolated_memory(monkeypatch):
    _limits()._in_memory_limits.clear()

    async def _no_redis():
        return None

    monkeypatch.setattr(_limits(), "get_redis", _no_redis)
    yield
    _limits()._in_memory_limits.clear()


def _keys(prefix: str) -> list[str]:
    return [key for key in _limits()._in_memory_limits if key.startswith(prefix)]


@pytest.mark.asyncio
async def test_standalone_traffic_does_not_consume_katki_buckets():
    host = "203.0.113.20"
    request = _request(host)
    for _ in range(10):
        await rate_limit_standalone(request)
    with pytest.raises(RateLimitError):
        await rate_limit_standalone(request)

    await rate_limit_katki_read(request)
    await rate_limit_katki_write(request)
    assert _keys("standalone:")
    assert _keys("katki_read:")
    assert _keys("katki_write:")
    assert not any(key.startswith("standalone:") and "katki" in key for key in _limits()._in_memory_limits)


@pytest.mark.asyncio
async def test_katki_read_and_write_use_separate_namespaces():
    request = _request("203.0.113.21")
    for _ in range(KATKI_READ_LIMIT):
        await rate_limit_katki_read(request)
    with pytest.raises(RateLimitError) as blocked:
        await rate_limit_katki_read(request)
    body = str(blocked.value.detail)
    assert "sql" not in body.lower()
    assert "uq_yansi" not in body.lower()
    assert "constraint" not in body.lower()
    assert blocked.value.status_code == 429

    await rate_limit_katki_write(request)
    for _ in range(KATKI_WRITE_LIMIT - 1):
        await rate_limit_katki_write(request)
    with pytest.raises(RateLimitError):
        await rate_limit_katki_write(request)
    await rate_limit_standalone(request)
    assert _keys("katki_read:")
    assert _keys("katki_write:")
    read_key = _keys("katki_read:")[0]
    write_key = _keys("katki_write:")[0]
    assert read_key != write_key
    assert read_key.startswith("katki_read:")
    assert write_key.startswith("katki_write:")


def test_katki_routes_do_not_use_the_standalone_bucket():
    from backend.routers import mirror_network as routes

    def dependency_of(fn):
        return inspect.signature(fn).parameters["_"].default.dependency

    assert dependency_of(routes.get_public_katki_contributions) is rate_limit_katki_read
    writers = [
        routes.create_public_katki,
        routes.withdraw_public_katki,
        routes.report_public_katki,
        routes.owner_hide_public_katki,
        routes.owner_restore_public_katki,
    ]
    for writer in writers:
        assert dependency_of(writer) is rate_limit_katki_write
        assert dependency_of(writer) is not rate_limit_standalone

    trust_hide = inspect.signature(routes.trust_hide_public_katki)
    trust_restore = inspect.signature(routes.trust_restore_public_katki)
    assert trust_hide.parameters["__"].default.dependency is rate_limit_katki_write
    assert trust_restore.parameters["__"].default.dependency is rate_limit_katki_write


def test_database_create_quota_remains_user_scoped():
    assert KATKI_CREATE_HOURLY_LIMIT == 10
    assert KATKI_CREATE_DAILY_LIMIT == 30
    source = inspect.getsource(create_katki)
    assert "_created_since" in source
    assert "_acquire_create_lock" in source
    assert "pg_advisory_xact_lock" in inspect.getsource(_acquire_create_lock)
