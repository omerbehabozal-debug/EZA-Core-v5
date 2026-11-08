import asyncio

import pytest
from fastapi import HTTPException

from backend.services.business_yansi import place_geocode as geocode
from backend.tests.test_business_yansi import sample  # noqa: F401


class MemoryRedis:
    """Minimal async Redis stand-in for slot + cache + inflight tests."""

    def __init__(self):
        self.store: dict[str, str] = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None, nx=False, px=None):
        if nx and key in self.store:
            return False
        self.store[key] = value if isinstance(value, str) else str(value)
        return True

    async def delete(self, key):
        self.store.pop(key, None)
        return 1

    async def eval(self, script, numkeys, *args):
        keys = list(args[:numkeys])
        argv = list(args[numkeys:])
        key = keys[0]
        now = int(argv[0])
        interval = int(argv[1])
        budget = int(argv[2])
        next_at = int(self.store.get(key) or 0)
        start_at = max(now, next_at)
        wait = start_at - now
        if wait > budget:
            return -1
        self.store[key] = str(start_at + interval)
        return wait


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    geocode.clear_place_geocode_state()
    monkeypatch.setenv("BILIGN_GEOCODE_ENABLED", "1")
    monkeypatch.setenv(
        "BILIGN_GEOCODE_USER_AGENT",
        "biligN-Business-Test/1.0 (https://ezacore.ai; test@ezacore.ai)",
    )


@pytest.fixture
def redis_client():
    return MemoryRedis()


@pytest.mark.asyncio
async def test_search_returns_normalized_hits(redis_client):
    async def fake_fetch(query, *, user_agent):
        assert "Karakoy" in query
        assert "biligN-Business-Test" in user_agent
        return [
            {
                "lat": "41.0251234",
                "lon": "28.9744567",
                "display_name": "Karaköy, Beyoğlu, İstanbul, Türkiye",
                "namedetails": {"name": "Karaköy"},
            }
        ]

    hits = await geocode.search_places(
        "  Karakoy  ",
        user_id="user-1",
        business_id="biz-1",
        fetch=fake_fetch,
        redis=redis_client,
    )
    assert len(hits) == 1
    assert hits[0].place_name == "Karaköy"
    assert hits[0].address.startswith("Karaköy")
    assert hits[0].latitude == "41.025123"
    assert hits[0].longitude == "28.974457"


@pytest.mark.asyncio
async def test_empty_results_are_cached(redis_client):
    calls = {"n": 0}

    async def fake_fetch(query, *, user_agent):
        calls["n"] += 1
        return []

    first = await geocode.search_places(
        "bilinmeyen yer", user_id="user-1", business_id="biz-1", fetch=fake_fetch, redis=redis_client
    )
    second = await geocode.search_places(
        "bilinmeyen yer", user_id="user-2", business_id="biz-2", fetch=fake_fetch, redis=redis_client
    )
    assert first == []
    assert second == []
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_shared_cache_hit_avoids_upstream(redis_client):
    calls = {"n": 0}

    async def fake_fetch(query, *, user_agent):
        calls["n"] += 1
        return [
            {
                "lat": "41.0",
                "lon": "29.0",
                "display_name": "Atolye, Istanbul",
                "namedetails": {"name": "Atolye"},
            }
        ]

    first = await geocode.search_places("Atolye", user_id="user-1", business_id="biz-1", fetch=fake_fetch, redis=redis_client)
    second = await geocode.search_places("atolye", user_id="user-2", business_id="biz-2", fetch=fake_fetch, redis=redis_client)
    assert calls["n"] == 1
    assert first[0].place_name == second[0].place_name


@pytest.mark.asyncio
async def test_workers_share_one_global_upstream_slot(redis_client):
    waits = []
    now = 1_000_000
    first = await geocode.acquire_upstream_slot(redis_client, interval_ms=1100, budget_ms=1500, now_ms=now)
    second = await geocode.acquire_upstream_slot(redis_client, interval_ms=1100, budget_ms=1500, now_ms=now)
    waits.extend([first, second])
    assert first == 0
    assert second == 1100
    with pytest.raises(HTTPException) as limited:
        await geocode.acquire_upstream_slot(redis_client, interval_ms=1100, budget_ms=500, now_ms=now)
    assert limited.value.detail["code"] == "place_search_rate_limited"


@pytest.mark.asyncio
async def test_concurrent_identical_searches_single_upstream(redis_client):
    calls = {"n": 0}
    started = asyncio.Event()
    release = asyncio.Event()

    async def fake_fetch(query, *, user_agent):
        calls["n"] += 1
        started.set()
        await release.wait()
        return [
            {
                "lat": "41.01",
                "lon": "29.01",
                "display_name": "Karaköy, İstanbul",
                "namedetails": {"name": "Karaköy"},
            }
        ]

    async def run():
        return await geocode.search_places(
            "Karakoy",
            user_id="user-a",
            business_id="biz-a",
            fetch=fake_fetch,
            redis=redis_client,
        )

    task1 = asyncio.create_task(run())
    await started.wait()
    task2 = asyncio.create_task(run())
    # Peer should observe inflight and poll briefly; release upstream after a short delay.
    await asyncio.sleep(0.05)
    release.set()
    first, second = await asyncio.gather(task1, task2)
    assert calls["n"] == 1
    assert first[0].place_name == "Karaköy"
    assert second[0].place_name == "Karaköy"


@pytest.mark.asyncio
async def test_redis_unavailable_fail_closed(monkeypatch):
    async def no_redis():
        return None

    monkeypatch.setattr(geocode, "_redis", no_redis)

    async def boom(*args, **kwargs):
        raise AssertionError("upstream must not be called")

    with pytest.raises(HTTPException) as blocked:
        await geocode.search_places("Karakoy", user_id="user-1", business_id="biz-1", fetch=boom)
    assert blocked.value.detail["code"] == "place_search_unavailable"


@pytest.mark.asyncio
async def test_missing_user_agent_fail_closed(monkeypatch, redis_client):
    monkeypatch.delenv("BILIGN_GEOCODE_USER_AGENT", raising=False)

    async def boom(*args, **kwargs):
        raise AssertionError("upstream must not be called")

    with pytest.raises(HTTPException) as blocked:
        await geocode.search_places(
            "Karakoy", user_id="user-1", business_id="biz-1", fetch=boom, redis=redis_client
        )
    assert blocked.value.detail["code"] == "place_search_misconfigured"


@pytest.mark.asyncio
async def test_query_validation(redis_client):
    with pytest.raises(HTTPException) as short:
        await geocode.search_places("a", user_id="user-1", business_id="biz-1", redis=redis_client)
    assert short.value.detail["code"] == "place_search_query_rejected"


@pytest.mark.asyncio
async def test_disabled_provider(monkeypatch, redis_client):
    monkeypatch.setenv("BILIGN_GEOCODE_ENABLED", "0")
    with pytest.raises(HTTPException) as blocked:
        await geocode.search_places("Karakoy", user_id="user-1", business_id="biz-1", redis=redis_client)
    assert blocked.value.detail["code"] == "place_search_unavailable"


@pytest.mark.asyncio
async def test_provider_timeout_and_429_not_cached(redis_client):
    async def timeout_fetch(query, *, user_agent):
        from backend.services.business_yansi.service import fail

        fail("place_search_timeout", 504)

    with pytest.raises(HTTPException) as timed_out:
        await geocode.search_places(
            "Karakoy", user_id="user-1", business_id="biz-1", fetch=timeout_fetch, redis=redis_client
        )
    assert timed_out.value.detail["code"] == "place_search_timeout"
    assert geocode.query_cache_key("Karakoy") not in redis_client.store

    async def limited_fetch(query, *, user_agent):
        from backend.services.business_yansi.service import fail

        fail("place_search_rate_limited", 429)

    with pytest.raises(HTTPException) as limited:
        await geocode.search_places(
            "Galata", user_id="user-1", business_id="biz-1", fetch=limited_fetch, redis=redis_client
        )
    assert limited.value.detail["code"] == "place_search_rate_limited"
    assert geocode.query_cache_key("Galata") not in redis_client.store


@pytest.mark.asyncio
async def test_per_user_rate_limit(redis_client):
    async def fake_fetch(query, *, user_agent):
        return []

    monkeypatch_limit = 2
    geocode._USER_LIMIT = monkeypatch_limit
    try:
        await geocode.search_places("bir", user_id="user-1", business_id="biz-1", fetch=fake_fetch, redis=redis_client)
        await geocode.search_places("iki", user_id="user-1", business_id="biz-1", fetch=fake_fetch, redis=redis_client)
        with pytest.raises(HTTPException) as limited:
            await geocode.search_places("uc", user_id="user-1", business_id="biz-1", fetch=fake_fetch, redis=redis_client)
        assert limited.value.detail["code"] == "place_search_rate_limited"
    finally:
        geocode._USER_LIMIT = 20


@pytest.mark.asyncio
async def test_router_requires_business_editor(sample, monkeypatch):
    from backend.routers import business_yansi as router

    async def fake_search(query, *, user_id, business_id, fetch=None, redis=None):
        return [
            geocode.PlaceHit(
                place_name="Karaköy",
                address="Karaköy, İstanbul",
                latitude="41.025000",
                longitude="28.974000",
            )
        ]

    monkeypatch.setattr(geocode, "search_places", fake_search)
    claims = {"user_id": str(sample.editor.id)}
    payload = await router.place_search(sample.business.id, q="Karakoy", db=sample.db, claims=claims)
    assert payload["items"][0]["placeName"] == "Karaköy"
    assert "OpenStreetMap" in payload["attribution"]

    outsider = {"user_id": str(sample.outsider.id)}
    with pytest.raises(HTTPException) as denied:
        await router.place_search(sample.business.id, q="Karakoy", db=sample.db, claims=outsider)
    assert denied.value.status_code in {403, 404}
