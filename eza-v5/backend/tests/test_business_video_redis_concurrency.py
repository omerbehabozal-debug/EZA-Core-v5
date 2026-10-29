"""Real Redis proof for Business video quotas and leases.

Requires BUSINESS_VIDEO_REDIS_TEST_URL. The URL must be redis:// on
127.0.0.1, localhost, or ::1, and must not use port 6379. Production-looking
hosts are refused. These tests never FLUSHDB or FLUSHALL. They delete only
the keys they create.

An in-process EVAL double is not this file. If the URL is unset the module
skips and that skip is not a Redis PASS.
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import textwrap
import uuid
from pathlib import Path
from urllib.parse import urlsplit

import pytest
from fastapi import HTTPException
from redis.asyncio import Redis

from backend.services.business_yansi import video_ingest as ingest

_FORBIDDEN = ("amazonaws", "upstash", "redislabs", "railway", "render.com", "azure", "cloud.google")
_REAL_REDIS = ingest._redis


def _test_url() -> str | None:
    raw = os.getenv("BUSINESS_VIDEO_REDIS_TEST_URL", "").strip()
    if not raw:
        return None
    parts = urlsplit(raw)
    host = (parts.hostname or "").lower()
    if parts.scheme != "redis" or host not in {"127.0.0.1", "localhost", "::1"}:
        pytest.fail("refusing a non-local Redis URL")
    if parts.port in {None, 6379}:
        pytest.fail("refusing the default Redis port")
    if any(marker in raw.lower() for marker in _FORBIDDEN):
        pytest.fail("refusing a production-looking Redis URL")
    return raw


pytestmark = pytest.mark.skipif(_test_url() is None, reason="BLOCKED: BUSINESS_VIDEO_REDIS_TEST_URL is not set")


def _quota_key(bucket: str) -> str:
    return f"business_video_quota:{bucket}"


def _lease_key(business_id) -> str:
    return f"business_video_lease:{business_id}"


@pytest.fixture
async def redis_client():
    url = _test_url()
    client = Redis.from_url(url, decode_responses=True, socket_connect_timeout=1, socket_timeout=1)
    await asyncio.wait_for(client.ping(), 2)
    owned: list[str] = []

    async def getter():
        return client

    ingest._redis = getter
    try:
        yield client, owned
    finally:
        ingest._redis = _REAL_REDIS
        if owned:
            await client.delete(*owned)
        await client.aclose()


def test_configured_limits_match_the_ingestion_code():
    assert ingest.VIDEO_USER_LIMIT == 8
    assert ingest.VIDEO_USER_WINDOW == 3600
    assert ingest.VIDEO_BRAND_LIMIT == 30
    assert ingest.VIDEO_BRAND_WINDOW == 3600
    assert ingest.VIDEO_BRAND_INFLIGHT == 2
    assert ingest.VIDEO_LEASE_SECONDS == 90


async def test_brand_concurrency_is_two_and_brands_are_independent(redis_client):
    client, owned = redis_client
    first = uuid.uuid4()
    second = uuid.uuid4()
    owned.extend([_lease_key(first), _lease_key(second)])
    held = [await ingest._acquire_lease(first), await ingest._acquire_lease(first)]
    assert len(set(held)) == 2
    with pytest.raises(HTTPException) as busy:
        await ingest._acquire_lease(first)
    assert busy.value.status_code == 429
    assert busy.value.detail["code"] == "video_busy"
    other = [await ingest._acquire_lease(second), await ingest._acquire_lease(second)]
    assert len(set(other)) == 2
    with pytest.raises(HTTPException) as other_busy:
        await ingest._acquire_lease(second)
    assert other_busy.value.detail["code"] == "video_busy"
    assert await client.zcard(_lease_key(first)) == 2
    await ingest._release_lease(first, held[0])
    assert await client.zcard(_lease_key(first)) == 1
    replacement = await ingest._acquire_lease(first)
    assert replacement not in held
    with pytest.raises(HTTPException):
        await ingest._acquire_lease(first)
    await ingest._release_lease(first, "not-a-held-token")
    assert await client.zcard(_lease_key(first)) == 2


async def test_same_timestamp_does_not_collapse_quota_or_leases(redis_client, monkeypatch):
    client, owned = redis_client
    monkeypatch.setattr(ingest, "_now_ms", lambda: 1_700_000_000_000)
    user_bucket = f"user:{uuid.uuid4()}"
    brand = uuid.uuid4()
    owned.extend([_quota_key(user_bucket), _lease_key(brand)])
    for _ in range(ingest.VIDEO_USER_LIMIT):
        await ingest._consume_window(user_bucket, ingest.VIDEO_USER_LIMIT, ingest.VIDEO_USER_WINDOW)
    members = await client.zrange(_quota_key(user_bucket), 0, -1)
    assert len(members) == ingest.VIDEO_USER_LIMIT
    assert len(set(members)) == ingest.VIDEO_USER_LIMIT
    with pytest.raises(HTTPException) as limited:
        await ingest._consume_window(user_bucket, ingest.VIDEO_USER_LIMIT, ingest.VIDEO_USER_WINDOW)
    assert limited.value.detail["code"] == "video_rate_limited"
    assert await client.zcard(_quota_key(user_bucket)) == ingest.VIDEO_USER_LIMIT
    await ingest._acquire_lease(brand)
    await ingest._acquire_lease(brand)
    assert await client.zcard(_lease_key(brand)) == 2
    with pytest.raises(HTTPException):
        await ingest._acquire_lease(brand)
    assert await client.zcard(_lease_key(brand)) == 2


async def test_user_and_brand_hourly_quotas(redis_client):
    client, owned = redis_client
    user_a = f"user:{uuid.uuid4()}"
    user_b = f"user:{uuid.uuid4()}"
    brand = f"brand:{uuid.uuid4()}"
    owned.extend([_quota_key(user_a), _quota_key(user_b), _quota_key(brand)])
    for _ in range(ingest.VIDEO_USER_LIMIT):
        await ingest._consume_window(user_a, ingest.VIDEO_USER_LIMIT, ingest.VIDEO_USER_WINDOW)
    with pytest.raises(HTTPException) as user_limited:
        await ingest._consume_window(user_a, ingest.VIDEO_USER_LIMIT, ingest.VIDEO_USER_WINDOW)
    assert user_limited.value.detail["code"] == "video_rate_limited"
    await ingest._consume_window(user_b, ingest.VIDEO_USER_LIMIT, ingest.VIDEO_USER_WINDOW)
    for _ in range(ingest.VIDEO_BRAND_LIMIT):
        await ingest._consume_window(brand, ingest.VIDEO_BRAND_LIMIT, ingest.VIDEO_BRAND_WINDOW)
    with pytest.raises(HTTPException) as brand_limited:
        await ingest._consume_window(brand, ingest.VIDEO_BRAND_LIMIT, ingest.VIDEO_BRAND_WINDOW)
    assert brand_limited.value.detail["code"] == "video_rate_limited"
    assert await client.zcard(_quota_key(brand)) == ingest.VIDEO_BRAND_LIMIT
    assert await client.zcard(_quota_key(user_b)) == 1


async def test_rejected_attempts_do_not_refresh_ttl_or_grow_the_set(redis_client):
    client, owned = redis_client
    brand = uuid.uuid4()
    user_bucket = f"user:{uuid.uuid4()}"
    owned.extend([_lease_key(brand), _quota_key(user_bucket)])
    await ingest._acquire_lease(brand)
    await ingest._acquire_lease(brand)
    before = await client.pttl(_lease_key(brand))
    await asyncio.sleep(0.05)
    for _ in range(10):
        with pytest.raises(HTTPException):
            await ingest._acquire_lease(brand)
    after = await client.pttl(_lease_key(brand))
    assert 0 < after <= before
    assert await client.zcard(_lease_key(brand)) == 2
    for _ in range(ingest.VIDEO_USER_LIMIT):
        await ingest._consume_window(user_bucket, ingest.VIDEO_USER_LIMIT, ingest.VIDEO_USER_WINDOW)
    quota_before = await client.pttl(_quota_key(user_bucket))
    await asyncio.sleep(0.05)
    for _ in range(5):
        with pytest.raises(HTTPException):
            await ingest._consume_window(user_bucket, ingest.VIDEO_USER_LIMIT, ingest.VIDEO_USER_WINDOW)
    quota_after = await client.pttl(_quota_key(user_bucket))
    assert 0 < quota_after <= quota_before
    assert await client.zcard(_quota_key(user_bucket)) == ingest.VIDEO_USER_LIMIT


async def test_expired_lease_frees_capacity_and_old_token_cannot_drop_the_new_one(redis_client, monkeypatch):
    client, owned = redis_client
    brand = uuid.uuid4()
    owned.append(_lease_key(brand))
    start = 5_000_000
    monkeypatch.setattr(ingest, "_now_ms", lambda: start)
    old = await ingest._acquire_lease(brand)
    monkeypatch.setattr(ingest, "_now_ms", lambda: start + ingest.VIDEO_LEASE_SECONDS * 1000 + 1)
    fresh = await ingest._acquire_lease(brand)
    assert fresh != old
    await ingest._release_lease(brand, old)
    assert await client.zrange(_lease_key(brand), 0, -1) == [fresh]
    extra = await ingest._acquire_lease(brand)
    with pytest.raises(HTTPException) as full:
        await ingest._acquire_lease(brand)
    assert full.value.detail["code"] == "video_busy"
    members = await client.zrange(_lease_key(brand), 0, -1)
    assert old not in members
    assert set(members) == {fresh, extra}


async def test_quota_window_drops_expired_members(redis_client, monkeypatch):
    client, owned = redis_client
    bucket = f"user:{uuid.uuid4()}"
    owned.append(_quota_key(bucket))
    start = 8_000_000
    monkeypatch.setattr(ingest, "_now_ms", lambda: start)
    await ingest._consume_window(bucket, ingest.VIDEO_USER_LIMIT, ingest.VIDEO_USER_WINDOW)
    await ingest._consume_window(bucket, ingest.VIDEO_USER_LIMIT, ingest.VIDEO_USER_WINDOW)
    monkeypatch.setattr(
        ingest,
        "_now_ms",
        lambda: start + ingest.VIDEO_USER_WINDOW * 1000 + 1,
    )
    await ingest._consume_window(bucket, ingest.VIDEO_USER_LIMIT, ingest.VIDEO_USER_WINDOW)
    assert await client.zcard(_quota_key(bucket)) == 1
    ttl = await client.pttl(_quota_key(bucket))
    assert 0 < ttl <= ingest.VIDEO_USER_WINDOW * 1000


async def test_redis_down_before_acquire_fails_closed(monkeypatch):
    from redis.asyncio import Redis as AsyncRedis

    async def down():
        client = AsyncRedis.from_url(
            "redis://127.0.0.1:59999",
            socket_connect_timeout=0.05,
            socket_timeout=0.05,
        )
        try:
            await client.ping()
            return client
        except Exception:
            await client.aclose()
            raise

    monkeypatch.setattr(ingest, "_redis", _REAL_REDIS)
    monkeypatch.setattr("backend.core.utils.dependencies.get_redis", down)
    with pytest.raises(HTTPException) as closed:
        await ingest._acquire_lease(uuid.uuid4())
    assert closed.value.status_code == 503
    assert closed.value.detail["code"] == "video_quota_unavailable"


async def test_paused_redis_fails_closed_and_recovers(redis_client):
    client, owned = redis_client
    container = os.getenv("BUSINESS_VIDEO_REDIS_TEST_CONTAINER", "")
    if not container:
        pytest.skip("BUSINESS_VIDEO_REDIS_TEST_CONTAINER is not set")
    brand = uuid.uuid4()
    user_bucket = f"user:{uuid.uuid4()}"
    owned.extend([_lease_key(brand), _quota_key(user_bucket)])
    await ingest._consume_window(user_bucket, ingest.VIDEO_USER_LIMIT, ingest.VIDEO_USER_WINDOW)
    held = await ingest._acquire_lease(brand)
    subprocess.check_call(["docker", "pause", container])
    try:
        with pytest.raises(HTTPException) as during_acquire:
            await ingest._acquire_lease(brand)
        assert during_acquire.value.status_code == 503
        assert during_acquire.value.detail["code"] == "video_quota_unavailable"
        await ingest._release_lease(brand, held)
    finally:
        subprocess.check_call(["docker", "unpause", container])
    await asyncio.wait_for(client.ping(), 2)
    # A timed-out EVAL may already have been applied. Fail closed either way:
    # the client saw 503, and the brand never holds more than two leases.
    assert await client.zcard(_lease_key(brand)) <= 2
    members = await client.zrange(_lease_key(brand), 0, -1)
    for token in members:
        await ingest._release_lease(brand, token)
    assert await client.zcard(_lease_key(brand)) == 0
    recovered = await ingest._acquire_lease(brand)
    assert recovered
    assert await client.zcard(_quota_key(user_bucket)) == 1


async def test_cancel_before_acquire_writes_no_lease(redis_client):
    client, owned = redis_client
    brand = uuid.uuid4()
    owned.append(_lease_key(brand))
    entered = asyncio.Event()

    async def blocked():
        entered.set()
        await asyncio.Event().wait()

    ingest._redis = blocked
    task = asyncio.create_task(ingest._acquire_lease(brand))
    await asyncio.wait_for(entered.wait(), 2)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert await client.zcard(_lease_key(brand)) == 0


async def test_cancel_during_ingest_releases_the_lease(redis_client, monkeypatch):
    client, owned = redis_client
    brand = uuid.uuid4()
    owned.append(_lease_key(brand))
    started = asyncio.Event()

    async def hang(*_args, **_kwargs):
        started.set()
        await asyncio.Event().wait()

    monkeypatch.setattr(ingest, "_ingest", hang)
    task = asyncio.create_task(ingest._guarded(None, brand, uuid.uuid4()))
    await asyncio.wait_for(started.wait(), 2)
    assert await client.zcard(_lease_key(brand)) == 1
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert await client.zcard(_lease_key(brand)) == 0


async def test_cancel_during_release_while_redis_is_paused_expires_later(redis_client, monkeypatch):
    client, owned = redis_client
    container = os.getenv("BUSINESS_VIDEO_REDIS_TEST_CONTAINER", "")
    if not container:
        pytest.skip("BUSINESS_VIDEO_REDIS_TEST_CONTAINER is not set")
    brand = uuid.uuid4()
    owned.append(_lease_key(brand))
    start = 9_000_000
    monkeypatch.setattr(ingest, "_now_ms", lambda: start)
    token = await ingest._acquire_lease(brand)
    subprocess.check_call(["docker", "pause", container])
    try:
        task = asyncio.create_task(ingest._release_lease(brand, token))
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(task, 2)
    finally:
        subprocess.check_call(["docker", "unpause", container])
    await asyncio.wait_for(client.ping(), 2)
    # Release may have landed before the freeze or not at all. Capacity stays bounded.
    assert await client.zcard(_lease_key(brand)) <= 1
    monkeypatch.setattr(ingest, "_now_ms", lambda: start + ingest.VIDEO_LEASE_SECONDS * 1000 + 1)
    recovered = await ingest._acquire_lease(brand)
    members = await client.zrange(_lease_key(brand), 0, -1)
    assert recovered in members
    assert len(members) <= 2


def _worker_script() -> str:
    return textwrap.dedent(
        """
        import asyncio, os
        from fastapi import HTTPException
        from redis.asyncio import Redis
        from backend.services.business_yansi import video_ingest as ingest

        async def main():
            client = Redis.from_url(
                os.environ["BUSINESS_VIDEO_REDIS_TEST_URL"],
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=2,
            )
            async def getter():
                return client
            ingest._redis = getter
            gate = os.environ["GATE_KEY"]
            try:
                for _ in range(500):
                    if await client.get(gate) == "go":
                        break
                    await asyncio.sleep(0.01)
                else:
                    print("no gate_timeout")
                    return
                if os.environ["WORKER_MODE"] == "lease":
                    token = await ingest._acquire_lease(os.environ["BRAND_ID"])
                    print("ok " + token)
                else:
                    await ingest._consume_window(
                        os.environ["BUCKET"],
                        ingest.VIDEO_USER_LIMIT,
                        ingest.VIDEO_USER_WINDOW,
                    )
                    print("ok consumed")
            except HTTPException as exc:
                print("no " + str(exc.detail["code"]))
            finally:
                await client.aclose()

        asyncio.run(main())
        """
    )


def _spawn(mode: str, env: dict) -> subprocess.Popen:
    root = str(Path(__file__).resolve().parents[2])
    child_env = os.environ.copy()
    child_env.update(env)
    child_env["PYTHONPATH"] = root
    child_env["WORKER_MODE"] = mode
    return subprocess.Popen(
        [sys.executable, "-c", _worker_script()],
        env=child_env,
        cwd=root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


async def _race(client, *, mode: str, workers: int, expected_ok: int, env: dict, owned: list[str]):
    gate = f"business_video_test_gate:{uuid.uuid4()}"
    owned.append(gate)
    await client.set(gate, "wait", px=30_000)
    child_env = {"GATE_KEY": gate, "BUSINESS_VIDEO_REDIS_TEST_URL": _test_url(), **env}
    processes = [_spawn(mode, child_env) for _ in range(workers)]
    await asyncio.sleep(0.4)
    await client.set(gate, "go", px=30_000)
    results = []
    for process in processes:
        stdout, stderr = process.communicate(timeout=20)
        assert process.returncode == 0, stderr
        line = stdout.strip().splitlines()[-1]
        results.append(line)
    oks = [line for line in results if line.startswith("ok ")]
    nos = [line for line in results if line.startswith("no ")]
    assert len(oks) == expected_ok, results
    assert len(nos) == workers - expected_ok
    return oks


async def test_separate_processes_share_one_brand_lease_limit(redis_client):
    client, owned = redis_client
    brand = uuid.uuid4()
    owned.append(_lease_key(brand))
    for _ in range(8):
        oks = await _race(
            client,
            mode="lease",
            workers=6,
            expected_ok=2,
            env={"BRAND_ID": str(brand)},
            owned=owned,
        )
        tokens = [line.split(" ", 1)[1] for line in oks]
        assert len(set(tokens)) == 2
        assert await client.zcard(_lease_key(brand)) == 2
        for token in tokens:
            await ingest._release_lease(brand, token)
        assert await client.zcard(_lease_key(brand)) == 0


async def test_separate_processes_share_one_user_quota(redis_client):
    client, owned = redis_client
    bucket = f"user:{uuid.uuid4()}"
    owned.append(_quota_key(bucket))
    for _ in range(3):
        await _race(
            client,
            mode="quota",
            workers=12,
            expected_ok=ingest.VIDEO_USER_LIMIT,
            env={"BUCKET": bucket},
            owned=owned,
        )
        assert await client.zcard(_quota_key(bucket)) == ingest.VIDEO_USER_LIMIT
        await client.delete(_quota_key(bucket))
