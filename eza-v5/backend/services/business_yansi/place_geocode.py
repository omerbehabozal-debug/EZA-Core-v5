"""Server-side place search proxy for Business Content Library.

Provider: OpenStreetMap Nominatim (https://nominatim.openstreetmap.org)

Cluster safety:
- Upstream 1.1s spacing is enforced with an atomic Redis reservation shared by all workers.
- Successful responses (including empty lists) are cached in Redis.
- If Redis is unavailable, upstream Nominatim is not called (fail-closed).

Browser clients must never call Nominatim directly. Upstream host is fixed (SSRF-safe).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlencode

import httpx

from backend.services.business_yansi.service import fail

logger = logging.getLogger(__name__)

_NOMINATIM_ORIGIN = "https://nominatim.openstreetmap.org"
_NOMINATIM_PATH = "/search"
_MAX_RESULTS = 5
_MIN_QUERY = 2
_MAX_QUERY = 200
_HTTP_TIMEOUT = httpx.Timeout(5.0, connect=3.0)
_CACHE_TTL_SECONDS = 3600
_UPSTREAM_INTERVAL_MS = 1100
_UPSTREAM_WAIT_BUDGET_MS = 1500
_REDIS_CLIENT_BUDGET_SECONDS = 1.0
_REDIS_OP_BUDGET_SECONDS = 1.5
_INFLIGHT_TTL_MS = 5000
_INFLIGHT_POLL_MS = 50
_INFLIGHT_POLL_ATTEMPTS = 20
_USER_LIMIT = 20
_USER_WINDOW = 60.0
_BUSINESS_LIMIT = 60
_BUSINESS_WINDOW = 60.0
_SLOT_KEY = "place_geocode:upstream_next"
_CACHE_PREFIX = "place_geocode:q:"
_INFLIGHT_PREFIX = "place_geocode:inflight:"

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
_USER_HITS: dict[str, list[float]] = {}
_BUSINESS_HITS: dict[str, list[float]] = {}

# Atomic schedule: reserve next start time, return wait_ms (>=0) or -1 if over budget.
_SLOT_SCRIPT = """
local next_at = tonumber(redis.call('GET', KEYS[1]) or '0')
local now = tonumber(ARGV[1])
local interval = tonumber(ARGV[2])
local budget = tonumber(ARGV[3])
local start_at = math.max(now, next_at)
local wait = start_at - now
if wait > budget then
  return -1
end
redis.call('SET', KEYS[1], tostring(start_at + interval))
redis.call('PEXPIRE', KEYS[1], interval * 4)
return wait
"""


@dataclass(frozen=True)
class PlaceHit:
    place_name: str
    address: str
    latitude: str
    longitude: str

    def as_dict(self) -> dict[str, str]:
        return {
            "placeName": self.place_name,
            "address": self.address,
            "latitude": self.latitude,
            "longitude": self.longitude,
        }


def geocode_enabled() -> bool:
    raw = (os.getenv("BILIGN_GEOCODE_ENABLED") or "1").strip().lower()
    if raw in {"0", "false", "off", "no"}:
        return False
    return True


def geocode_user_agent() -> str | None:
    """Require an explicit identifying User-Agent with contact. No invented default."""
    configured = (os.getenv("BILIGN_GEOCODE_USER_AGENT") or "").strip()
    if not configured or len(configured) < 12 or len(configured) > 200:
        return None
    if _CONTROL_CHARS.search(configured):
        return None
    has_contact = bool(_EMAIL.search(configured)) or "https://" in configured.casefold() or "http://" in configured.casefold()
    # App identity: product/version style or known product token.
    has_app = ("/" in configured) or ("bilign" in configured.casefold()) or ("eza" in configured.casefold())
    if not has_contact or not has_app:
        return None
    return configured


def require_geocode_user_agent() -> str:
    agent = geocode_user_agent()
    if not agent:
        fail("place_search_misconfigured", 503)
    return agent


def normalize_query(value: str) -> str:
    text = _CONTROL_CHARS.sub(" ", str(value or "")).strip()
    text = re.sub(r"\s+", " ", text)
    return text[:_MAX_QUERY]


def query_cache_key(normalized_query: str) -> str:
    digest = hashlib.sha256(normalized_query.casefold().encode("utf-8")).hexdigest()[:40]
    return f"{_CACHE_PREFIX}{digest}"


def clear_place_geocode_state() -> None:
    """Test helper for process-local secondary limits."""
    _USER_HITS.clear()
    _BUSINESS_HITS.clear()


def _prune_hits(bucket: dict[str, list[float]], key: str, window: float, now: float) -> list[float]:
    hits = [stamp for stamp in bucket.get(key, []) if now - stamp < window]
    bucket[key] = hits
    return hits


def _enforce_local_limits(*, user_id: str, business_id: str) -> None:
    """Soft per-process abuse brakes; authoritative upstream spacing is Redis."""
    now = time.monotonic()
    user_hits = _prune_hits(_USER_HITS, user_id, _USER_WINDOW, now)
    if len(user_hits) >= _USER_LIMIT:
        fail("place_search_rate_limited", 429)
    business_hits = _prune_hits(_BUSINESS_HITS, business_id, _BUSINESS_WINDOW, now)
    if len(business_hits) >= _BUSINESS_LIMIT:
        fail("place_search_rate_limited", 429)
    user_hits.append(now)
    business_hits.append(now)
    _USER_HITS[user_id] = user_hits
    _BUSINESS_HITS[business_id] = business_hits


async def _redis():
    from backend.core.utils.dependencies import get_redis

    try:
        return await asyncio.wait_for(get_redis(), _REDIS_CLIENT_BUDGET_SECONDS)
    except Exception:
        return None


async def _require_redis():
    client = await _redis()
    if client is None:
        fail("place_search_unavailable", 503)
    return client


async def _eval(redis, script: str, keys: list[str], args: list):
    try:
        return await asyncio.wait_for(
            redis.eval(script, len(keys), *keys, *args),
            _REDIS_OP_BUDGET_SECONDS,
        )
    except Exception as exc:
        from fastapi import HTTPException

        if isinstance(exc, HTTPException):
            raise
        logger.warning("place_geocode_redis_eval_unavailable reason=%s", type(exc).__name__)
        fail("place_search_unavailable", 503)


async def acquire_upstream_slot(
    redis,
    *,
    interval_ms: int = _UPSTREAM_INTERVAL_MS,
    budget_ms: int = _UPSTREAM_WAIT_BUDGET_MS,
    now_ms: int | None = None,
) -> int:
    """Reserve the next Nominatim start time. Returns wait_ms (>=0)."""
    stamp = int(now_ms if now_ms is not None else time.time() * 1000)
    wait = await _eval(
        redis,
        _SLOT_SCRIPT,
        [_SLOT_KEY],
        [stamp, int(interval_ms), int(budget_ms)],
    )
    wait_ms = int(wait)
    if wait_ms < 0:
        fail("place_search_rate_limited", 429)
    return wait_ms


async def _cache_get(redis, cache_key: str) -> list[dict[str, str]] | None:
    try:
        raw = await asyncio.wait_for(redis.get(cache_key), _REDIS_OP_BUDGET_SECONDS)
    except Exception:
        fail("place_search_unavailable", 503)
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    try:
        payload = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if not isinstance(payload, dict) or "items" not in payload:
        return None
    items = payload.get("items")
    if not isinstance(items, list):
        return None
    out: list[dict[str, str]] = []
    for row in items:
        if not isinstance(row, dict):
            continue
        place_name = str(row.get("placeName") or "")
        address = str(row.get("address") or "")
        latitude = str(row.get("latitude") or "")
        longitude = str(row.get("longitude") or "")
        if not latitude or not longitude:
            # Empty successful search is stored as items=[] — skip bad rows only.
            continue
        out.append(
            {
                "placeName": place_name[:160],
                "address": address[:500],
                "latitude": latitude[:32],
                "longitude": longitude[:32],
            }
        )
    # Distinguish valid empty cache from corrupt payload that dropped all rows.
    if items and not out:
        return None
    return out


async def _cache_set(redis, cache_key: str, items: list[dict[str, str]]) -> None:
    body = json.dumps({"items": items}, ensure_ascii=False, separators=(",", ":"))
    try:
        await asyncio.wait_for(redis.set(cache_key, body, ex=_CACHE_TTL_SECONDS), _REDIS_OP_BUDGET_SECONDS)
    except Exception:
        # Cache write failure must not force a second upstream; response still returns.
        logger.warning("place_geocode_cache_set_failed")


async def _acquire_inflight(redis, cache_key: str) -> bool:
    lock_key = f"{_INFLIGHT_PREFIX}{cache_key.rsplit(':', 1)[-1]}"
    try:
        ok = await asyncio.wait_for(
            redis.set(lock_key, "1", nx=True, px=_INFLIGHT_TTL_MS),
            _REDIS_OP_BUDGET_SECONDS,
        )
    except Exception:
        fail("place_search_unavailable", 503)
    return bool(ok)


async def _release_inflight(redis, cache_key: str) -> None:
    lock_key = f"{_INFLIGHT_PREFIX}{cache_key.rsplit(':', 1)[-1]}"
    try:
        await asyncio.wait_for(redis.delete(lock_key), _REDIS_OP_BUDGET_SECONDS)
    except Exception:
        return


async def _wait_for_peer_cache(redis, cache_key: str) -> list[dict[str, str]] | None:
    for _ in range(_INFLIGHT_POLL_ATTEMPTS):
        await asyncio.sleep(_INFLIGHT_POLL_MS / 1000)
        cached = await _cache_get(redis, cache_key)
        if cached is not None:
            return cached
    return None


def _format_coord(value: Any) -> str | None:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None
    if not number.is_finite():
        return None
    return format(number, "f")


def _present_row(row: dict[str, Any]) -> PlaceHit | None:
    lat = _format_coord(row.get("lat"))
    lon = _format_coord(row.get("lon"))
    if lat is None or lon is None:
        return None
    try:
        lat_n = Decimal(lat)
        lon_n = Decimal(lon)
    except InvalidOperation:
        return None
    if lat_n < -90 or lat_n > 90 or lon_n < -180 or lon_n > 180:
        return None
    display = str(row.get("display_name") or "").strip()
    named = str((row.get("namedetails") or {}).get("name") or row.get("name") or "").strip()
    place_name = named or (display.split(",")[0].strip() if display else "")
    address = display or place_name
    if not place_name and not address:
        return None
    return PlaceHit(
        place_name=place_name[:160] or address[:160],
        address=address[:500],
        latitude=format(lat_n.quantize(Decimal("0.000001")), "f"),
        longitude=format(lon_n.quantize(Decimal("0.000001")), "f"),
    )


def _hits_from_cache(items: list[dict[str, str]]) -> list[PlaceHit]:
    return [
        PlaceHit(
            place_name=item["placeName"],
            address=item["address"],
            latitude=item["latitude"],
            longitude=item["longitude"],
        )
        for item in items
    ]


async def _fetch_nominatim(query: str, *, user_agent: str) -> list[dict[str, Any]]:
    params = urlencode(
        {
            "q": query,
            "format": "json",
            "addressdetails": 0,
            "namedetails": 1,
            "limit": str(_MAX_RESULTS),
        }
    )
    url = f"{_NOMINATIM_ORIGIN}{_NOMINATIM_PATH}?{params}"
    headers = {
        "User-Agent": user_agent,
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT, follow_redirects=False) as client:
            response = await client.get(url, headers=headers)
    except httpx.TimeoutException:
        fail("place_search_timeout", 504)
    except httpx.HTTPError:
        fail("place_search_unavailable", 503)
    if response.status_code == 429:
        fail("place_search_rate_limited", 429)
    if response.status_code >= 500:
        fail("place_search_unavailable", 503)
    if response.status_code != 200:
        fail("place_search_unavailable", 502)
    try:
        payload = response.json()
    except ValueError:
        fail("place_search_unavailable", 502)
    if not isinstance(payload, list):
        fail("place_search_unavailable", 502)
    return [row for row in payload if isinstance(row, dict)]


async def search_places(
    query: str,
    *,
    user_id: str,
    business_id: str,
    fetch=_fetch_nominatim,
    redis=None,
) -> list[PlaceHit]:
    if not geocode_enabled():
        fail("place_search_unavailable", 503)
    user_agent = require_geocode_user_agent()
    cleaned = normalize_query(query)
    if len(cleaned) < _MIN_QUERY:
        fail("place_search_query_rejected", 422)
    _enforce_local_limits(user_id=str(user_id), business_id=str(business_id))

    client = redis if redis is not None else await _require_redis()
    cache_key = query_cache_key(cleaned)
    cached = await _cache_get(client, cache_key)
    if cached is not None:
        return _hits_from_cache(cached)

    got_inflight = await _acquire_inflight(client, cache_key)
    if not got_inflight:
        peer = await _wait_for_peer_cache(client, cache_key)
        if peer is not None:
            return _hits_from_cache(peer)
        fail("place_search_rate_limited", 429)

    try:
        cached = await _cache_get(client, cache_key)
        if cached is not None:
            return _hits_from_cache(cached)

        wait_ms = await acquire_upstream_slot(client)
        if wait_ms > 0:
            await asyncio.sleep(wait_ms / 1000)

        rows = await fetch(cleaned, user_agent=user_agent)
        hits: list[PlaceHit] = []
        for row in rows:
            presented = _present_row(row)
            if presented is None:
                continue
            hits.append(presented)
            if len(hits) >= _MAX_RESULTS:
                break
        await _cache_set(client, cache_key, [hit.as_dict() for hit in hits])
        return hits
    finally:
        await _release_inflight(client, cache_key)


def search_attribution() -> str:
    return "© OpenStreetMap contributors (Nominatim)"
