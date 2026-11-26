"""Operational safety budget for public Yansı V2 live answers.

Reuses Redis fail-closed EVAL patterns (same family as video_ingest) and the
studio_execution ``cost()`` arithmetic style. Cover AI Proposal/Usage tables are
intentionally not shared — live-answer spend must not mix with cover budgets.

Not a package entitlement system. Env-tunable beta caps only.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_UP
from typing import Any, Literal

from backend.services.business_yansi.studio_execution import cost as studio_token_cost

logger = logging.getLogger(__name__)

# Keep aligned with package_answers.MAX_INPUT_TOKENS / MAX_OUTPUT_TOKENS (no import cycle).
MAX_INPUT_TOKENS = 3000
MAX_OUTPUT_TOKENS = 500

# Official OpenAI list prices for gpt-4o-mini (USD / 1M tokens), verified 2026-11-26
# from https://developers.openai.com/api/docs/models/gpt-4o-mini
_DEFAULT_INPUT_USD_PER_MILLION = Decimal("0.15")
_DEFAULT_OUTPUT_USD_PER_MILLION = Decimal("0.60")

_DEFAULT_AUTH_DAILY = 50
_DEFAULT_ANON_DAILY = 20
_DEFAULT_BUSINESS_DAILY = 500
_DEFAULT_BUSINESS_USD = Decimal("2")
_DEFAULT_PLATFORM_USD = Decimal("10")

REDIS_CLIENT_BUDGET_SECONDS = 2.0
REDIS_EVAL_BUDGET_SECONDS = 2.0

# Micro-USD integer accounting (1 USD = 1_000_000 micro).
_MICRO = Decimal("1000000")

Outcome = Literal["settled", "released", "uncertain"]

# User-facing Turkish copy — no codes, model names, or dollar amounts.
USER_MESSAGES = {
    "quota_user": "Bugün için ek soru hakkın doldu. Yarın yeniden deneyebilirsin.",
    "quota_anon": "Bu cihazdan bugün için soru hakkı doldu. Biraz sonra veya yarın yeniden deneyebilirsin.",
    "quota_business": "Bu Yansı için bugünkü soru kapasitesi doldu. Yarın yeniden deneyebilirsin.",
    "budget_business": "Şu anda bu sohbet yolu yoğun. Biraz sonra yeniden deneyebilirsin.",
    "budget_platform": "Şu anda bu sohbet yolu yoğun. Biraz sonra yeniden deneyebilirsin.",
    "budget_unavailable": "Yanıt şu anda oluşturulamadı. Biraz sonra yeniden deneyebilirsin.",
}

DENY_STATUSES = frozenset(USER_MESSAGES)

_RESERVE_SCRIPT = """-- yansi-live-answer-reserve
-- KEYS[1]=user_cnt KEYS[2]=ip_cnt KEYS[3]=biz_cnt KEYS[4]=biz_usd KEYS[5]=plat_usd KEYS[6]=lease
-- ARGV: user_lim, ip_lim, biz_lim, biz_usd_lim, plat_usd_lim, reserve_micro, ttl_ms, token
local function read_int(key)
  if key == nil or key == '' then return 0 end
  local v = redis.call('GET', key)
  if not v then return 0 end
  return tonumber(v) or 0
end

local user_key = KEYS[1]
local ip_key = KEYS[2]
local biz_cnt_key = KEYS[3]
local biz_usd_key = KEYS[4]
local plat_usd_key = KEYS[5]
local lease_key = KEYS[6]

local user_lim = tonumber(ARGV[1])
local ip_lim = tonumber(ARGV[2])
local biz_lim = tonumber(ARGV[3])
local biz_usd_lim = tonumber(ARGV[4])
local plat_usd_lim = tonumber(ARGV[5])
local reserve_micro = tonumber(ARGV[6])
local ttl_ms = tonumber(ARGV[7])
local token = ARGV[8]

if user_key ~= '' and user_lim >= 0 then
  if read_int(user_key) + 1 > user_lim then return {'deny', 'quota_user'} end
end
if ip_key ~= '' and ip_lim >= 0 then
  if read_int(ip_key) + 1 > ip_lim then return {'deny', 'quota_anon'} end
end
if biz_cnt_key ~= '' and biz_lim >= 0 then
  if read_int(biz_cnt_key) + 1 > biz_lim then return {'deny', 'quota_business'} end
end
if biz_usd_key ~= '' and biz_usd_lim >= 0 then
  if read_int(biz_usd_key) + reserve_micro > biz_usd_lim then return {'deny', 'budget_business'} end
end
if plat_usd_key ~= '' and plat_usd_lim >= 0 then
  if read_int(plat_usd_key) + reserve_micro > plat_usd_lim then return {'deny', 'budget_platform'} end
end

local function bump_cnt(key)
  if key == nil or key == '' then return end
  local n = redis.call('INCR', key)
  if n == 1 then redis.call('PEXPIRE', key, ttl_ms) end
end

local function bump_usd(key, amount)
  if key == nil or key == '' then return end
  local n = redis.call('INCRBY', key, amount)
  if n == amount then redis.call('PEXPIRE', key, ttl_ms) end
end

bump_cnt(user_key)
bump_cnt(ip_key)
bump_cnt(biz_cnt_key)
bump_usd(biz_usd_key, reserve_micro)
bump_usd(plat_usd_key, reserve_micro)

redis.call(
  'HSET', lease_key,
  'token', token,
  'reserve_micro', tostring(reserve_micro),
  'user_key', user_key,
  'ip_key', ip_key,
  'biz_cnt_key', biz_cnt_key,
  'biz_usd_key', biz_usd_key,
  'plat_usd_key', plat_usd_key,
  'state', 'reserved'
)
redis.call('PEXPIRE', lease_key, ttl_ms)
return {'ok', token}
"""

_SETTLE_SCRIPT = """-- yansi-live-answer-settle
-- KEYS[1]=lease
-- ARGV[1]=token ARGV[2]=mode(release|settle|uncertain) ARGV[3]=actual_micro (settle only)
local lease_key = KEYS[1]
local token = ARGV[1]
local mode = ARGV[2]
local actual_micro = tonumber(ARGV[3]) or 0

local stored = redis.call('HGET', lease_key, 'token')
if not stored or stored ~= token then
  return {'miss'}
end
local state = redis.call('HGET', lease_key, 'state')
if state ~= 'reserved' then
  return {'already'}
end

local reserve_micro = tonumber(redis.call('HGET', lease_key, 'reserve_micro') or '0') or 0
local user_key = redis.call('HGET', lease_key, 'user_key') or ''
local ip_key = redis.call('HGET', lease_key, 'ip_key') or ''
local biz_cnt_key = redis.call('HGET', lease_key, 'biz_cnt_key') or ''
local biz_usd_key = redis.call('HGET', lease_key, 'biz_usd_key') or ''
local plat_usd_key = redis.call('HGET', lease_key, 'plat_usd_key') or ''

local function decr_cnt(key)
  if key == nil or key == '' then return end
  local v = tonumber(redis.call('GET', key) or '0') or 0
  if v <= 1 then redis.call('DEL', key) else redis.call('DECR', key) end
end

local function adj_usd(key, delta)
  if key == nil or key == '' or delta == 0 then return end
  if delta < 0 then
    local v = tonumber(redis.call('GET', key) or '0') or 0
    local nextv = v + delta
    if nextv <= 0 then redis.call('DEL', key) else redis.call('SET', key, tostring(nextv), 'KEEPTTL') end
  else
    redis.call('INCRBY', key, delta)
  end
end

if mode == 'release' then
  decr_cnt(user_key)
  decr_cnt(ip_key)
  decr_cnt(biz_cnt_key)
  adj_usd(biz_usd_key, -reserve_micro)
  adj_usd(plat_usd_key, -reserve_micro)
  redis.call('HSET', lease_key, 'state', 'released')
  return {'released', tostring(reserve_micro)}
end

if mode == 'uncertain' then
  -- Keep count + reserved USD (conservative: request may have reached the provider).
  redis.call('HSET', lease_key, 'state', 'uncertain', 'actual_micro', tostring(reserve_micro))
  return {'uncertain', tostring(reserve_micro)}
end

-- settle known usage: keep count, adjust USD from reserve to actual
if actual_micro < 0 then actual_micro = 0 end
if actual_micro > reserve_micro then actual_micro = reserve_micro end
local refund = reserve_micro - actual_micro
adj_usd(biz_usd_key, -refund)
adj_usd(plat_usd_key, -refund)
redis.call('HSET', lease_key, 'state', 'settled', 'actual_micro', tostring(actual_micro))
return {'settled', tostring(actual_micro)}
"""


class LiveAnswerBudgetError(Exception):
    def __init__(self, code: str):
        self.code = code if code in USER_MESSAGES else "budget_unavailable"
        super().__init__(self.code)

    @property
    def user_message(self) -> str:
        return USER_MESSAGES[self.code]


@dataclass(frozen=True)
class LiveAnswerReservation:
    token: str
    lease_key: str
    reserve_micro: int
    business_id: str
    day: str


@dataclass(frozen=True)
class LiveAnswerLimits:
    auth_daily: int
    anon_daily: int
    business_daily: int
    business_usd_micro: int
    platform_usd_micro: int
    input_per_million: Decimal
    output_per_million: Decimal
    reserve_micro: int


# Process-local ledger for unit tests (not production-safe across workers).
_MEMORY_LOCK = asyncio.Lock()
_MEMORY_COUNTERS: dict[str, int] = {}
_MEMORY_LEASES: dict[str, dict[str, Any]] = {}


def reset_live_answer_budget_for_tests() -> None:
    _MEMORY_COUNTERS.clear()
    _MEMORY_LEASES.clear()


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(0, value)


def _env_decimal(name: str, default: Decimal) -> Decimal:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = Decimal(raw)
    except Exception:
        return default
    if not value.is_finite() or value < 0:
        return default
    return value


def _usd_to_micro(usd: Decimal) -> int:
    return int((usd * _MICRO).to_integral_value(rounding=ROUND_UP))


def _micro_to_usd(micro: int) -> Decimal:
    return (Decimal(micro) / _MICRO).quantize(Decimal("0.00000001"))


def utc_day_key(now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(timezone.utc).strftime("%Y%m%d")


def hash_client_ip(ip: str) -> str:
    raw = (ip or "").strip().lower() or "unknown"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def load_limits() -> LiveAnswerLimits:
    input_rate = _env_decimal(
        "BILIGN_LIVE_ANSWER_INPUT_USD_PER_MILLION",
        _DEFAULT_INPUT_USD_PER_MILLION,
    )
    output_rate = _env_decimal(
        "BILIGN_LIVE_ANSWER_OUTPUT_USD_PER_MILLION",
        _DEFAULT_OUTPUT_USD_PER_MILLION,
    )
    rates = [str(input_rate), str(output_rate)]
    ceiling = studio_token_cost(MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS, rates)
    return LiveAnswerLimits(
        auth_daily=_env_int("BILIGN_LIVE_ANSWER_AUTH_DAILY_LIMIT", _DEFAULT_AUTH_DAILY),
        anon_daily=_env_int("BILIGN_LIVE_ANSWER_ANON_DAILY_LIMIT", _DEFAULT_ANON_DAILY),
        business_daily=_env_int(
            "BILIGN_LIVE_ANSWER_BUSINESS_DAILY_LIMIT", _DEFAULT_BUSINESS_DAILY
        ),
        business_usd_micro=_usd_to_micro(
            _env_decimal("BILIGN_LIVE_ANSWER_BUSINESS_DAILY_USD", _DEFAULT_BUSINESS_USD)
        ),
        platform_usd_micro=_usd_to_micro(
            _env_decimal("BILIGN_LIVE_ANSWER_PLATFORM_DAILY_USD", _DEFAULT_PLATFORM_USD)
        ),
        input_per_million=input_rate,
        output_per_million=output_rate,
        reserve_micro=_usd_to_micro(ceiling),
    )


def estimate_usage_micro(
    *,
    prompt_tokens: int | None,
    completion_tokens: int | None,
    limits: LiveAnswerLimits | None = None,
) -> int | None:
    """Return known cost in micro-USD, or None when usage is incomplete."""
    if not isinstance(prompt_tokens, int) or isinstance(prompt_tokens, bool):
        return None
    if not isinstance(completion_tokens, int) or isinstance(completion_tokens, bool):
        return None
    if prompt_tokens < 0 or completion_tokens < 0:
        return None
    caps = limits or load_limits()
    # Never settle above the reserved ceiling for one call.
    prompt_tokens = min(prompt_tokens, MAX_INPUT_TOKENS)
    completion_tokens = min(completion_tokens, MAX_OUTPUT_TOKENS)
    rates = [str(caps.input_per_million), str(caps.output_per_million)]
    usd = studio_token_cost(prompt_tokens, completion_tokens, rates)
    return min(_usd_to_micro(usd), caps.reserve_micro)


def _ttl_ms_until_utc_midnight(now: datetime | None = None) -> int:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    current = current.astimezone(timezone.utc)
    tomorrow = current.replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta

    tomorrow = tomorrow + timedelta(days=1)
    ms = int((tomorrow - current).total_seconds() * 1000)
    # Keep keys at least one hour; cap at 48h.
    return max(3_600_000, min(ms + 60_000, 172_800_000))


def _keys_for(
    *,
    day: str,
    user_id: str | None,
    ip_hash: str | None,
    business_id: str,
) -> tuple[str, str, str, str, str, str]:
    user_key = f"yansi_live_ans:cnt:user:{user_id}:{day}" if user_id else ""
    ip_key = f"yansi_live_ans:cnt:ip:{ip_hash}:{day}" if ip_hash and not user_id else ""
    biz_cnt = f"yansi_live_ans:cnt:biz:{business_id}:{day}"
    biz_usd = f"yansi_live_ans:usd:biz:{business_id}:{day}"
    plat_usd = f"yansi_live_ans:usd:platform:{day}"
    lease = f"yansi_live_ans:lease:{uuid.uuid4().hex}"
    return user_key, ip_key, biz_cnt, biz_usd, plat_usd, lease


def _use_memory_ledger() -> bool:
    return os.getenv("BILIGN_LIVE_ANSWER_LEDGER", "").strip().lower() in {
        "memory",
        "test",
        "inmemory",
    }


async def _redis():
    from backend.core.utils.dependencies import get_redis

    try:
        return await asyncio.wait_for(get_redis(), REDIS_CLIENT_BUDGET_SECONDS)
    except Exception:
        return None


async def _eval(script: str, keys: list[str], args: list):
    redis = await _redis()
    if redis is None:
        raise LiveAnswerBudgetError("budget_unavailable")
    try:
        return await asyncio.wait_for(
            redis.eval(script, len(keys), *keys, *args),
            REDIS_EVAL_BUDGET_SECONDS,
        )
    except LiveAnswerBudgetError:
        raise
    except Exception as exc:
        logger.warning("live_answer_budget_eval_unavailable reason=%s", type(exc).__name__)
        raise LiveAnswerBudgetError("budget_unavailable") from exc


async def _memory_reserve(
    *,
    limits: LiveAnswerLimits,
    user_id: str | None,
    ip_hash: str | None,
    business_id: str,
    day: str,
    ttl_ms: int,
) -> LiveAnswerReservation:
    user_key, ip_key, biz_cnt, biz_usd, plat_usd, lease = _keys_for(
        day=day, user_id=user_id, ip_hash=ip_hash, business_id=business_id
    )
    token = uuid.uuid4().hex
    async with _MEMORY_LOCK:
        def cnt(key: str) -> int:
            return int(_MEMORY_COUNTERS.get(key, 0)) if key else 0

        if user_key and cnt(user_key) + 1 > limits.auth_daily:
            raise LiveAnswerBudgetError("quota_user")
        if ip_key and cnt(ip_key) + 1 > limits.anon_daily:
            raise LiveAnswerBudgetError("quota_anon")
        if cnt(biz_cnt) + 1 > limits.business_daily:
            raise LiveAnswerBudgetError("quota_business")
        if cnt(biz_usd) + limits.reserve_micro > limits.business_usd_micro:
            raise LiveAnswerBudgetError("budget_business")
        if cnt(plat_usd) + limits.reserve_micro > limits.platform_usd_micro:
            raise LiveAnswerBudgetError("budget_platform")

        for key in (user_key, ip_key, biz_cnt):
            if key:
                _MEMORY_COUNTERS[key] = cnt(key) + 1
        _MEMORY_COUNTERS[biz_usd] = cnt(biz_usd) + limits.reserve_micro
        _MEMORY_COUNTERS[plat_usd] = cnt(plat_usd) + limits.reserve_micro
        _MEMORY_LEASES[lease] = {
            "token": token,
            "reserve_micro": limits.reserve_micro,
            "user_key": user_key,
            "ip_key": ip_key,
            "biz_cnt_key": biz_cnt,
            "biz_usd_key": biz_usd,
            "plat_usd_key": plat_usd,
            "state": "reserved",
            "ttl_ms": ttl_ms,
        }
    return LiveAnswerReservation(
        token=token,
        lease_key=lease,
        reserve_micro=limits.reserve_micro,
        business_id=business_id,
        day=day,
    )


async def _memory_settle(
    reservation: LiveAnswerReservation,
    *,
    outcome: Outcome,
    actual_micro: int | None,
) -> None:
    async with _MEMORY_LOCK:
        lease = _MEMORY_LEASES.get(reservation.lease_key)
        if not lease or lease.get("token") != reservation.token:
            return
        if lease.get("state") != "reserved":
            return

        def adj(key: str, delta: int) -> None:
            if not key or delta == 0:
                return
            cur = int(_MEMORY_COUNTERS.get(key, 0))
            nxt = cur + delta
            if nxt <= 0:
                _MEMORY_COUNTERS.pop(key, None)
            else:
                _MEMORY_COUNTERS[key] = nxt

        reserve = int(lease["reserve_micro"])
        if outcome == "release":
            for key in (lease["user_key"], lease["ip_key"], lease["biz_cnt_key"]):
                adj(key, -1)
            adj(lease["biz_usd_key"], -reserve)
            adj(lease["plat_usd_key"], -reserve)
            lease["state"] = "released"
            return
        if outcome == "uncertain":
            lease["state"] = "uncertain"
            lease["actual_micro"] = reserve
            return
        actual = reserve if actual_micro is None else max(0, min(int(actual_micro), reserve))
        refund = reserve - actual
        adj(lease["biz_usd_key"], -refund)
        adj(lease["plat_usd_key"], -refund)
        lease["state"] = "settled"
        lease["actual_micro"] = actual


async def reserve_live_answer(
    *,
    business_id: str,
    user_id: str | None,
    ip_hash: str | None,
    now: datetime | None = None,
) -> LiveAnswerReservation:
    """Atomically reserve one live-answer attempt. Fail closed on ledger errors."""
    biz = str(business_id or "").strip().lower()
    if not biz:
        raise LiveAnswerBudgetError("budget_unavailable")
    limits = load_limits()
    day = utc_day_key(now)
    ttl_ms = _ttl_ms_until_utc_midnight(now)
    uid = (user_id or "").strip() or None
    ip = (ip_hash or "").strip() or None
    if uid is None and ip is None:
        raise LiveAnswerBudgetError("budget_unavailable")

    if _use_memory_ledger():
        return await _memory_reserve(
            limits=limits,
            user_id=uid,
            ip_hash=ip,
            business_id=biz,
            day=day,
            ttl_ms=ttl_ms,
        )

    user_key, ip_key, biz_cnt, biz_usd, plat_usd, lease = _keys_for(
        day=day, user_id=uid, ip_hash=ip, business_id=biz
    )
    token = uuid.uuid4().hex
    # Authenticated callers count against user limit; anon against IP.
    user_lim = limits.auth_daily if user_key else -1
    ip_lim = limits.anon_daily if ip_key else -1
    result = await _eval(
        _RESERVE_SCRIPT,
        [user_key, ip_key, biz_cnt, biz_usd, plat_usd, lease],
        [
            user_lim,
            ip_lim,
            limits.business_daily,
            limits.business_usd_micro,
            limits.platform_usd_micro,
            limits.reserve_micro,
            ttl_ms,
            token,
        ],
    )
    if not isinstance(result, (list, tuple)) or len(result) < 2:
        raise LiveAnswerBudgetError("budget_unavailable")
    status = str(result[0])
    if status != "ok":
        raise LiveAnswerBudgetError(str(result[1]))
    return LiveAnswerReservation(
        token=token,
        lease_key=lease,
        reserve_micro=limits.reserve_micro,
        business_id=biz,
        day=day,
    )


async def settle_live_answer(
    reservation: LiveAnswerReservation | None,
    *,
    outcome: Outcome,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
) -> None:
    if reservation is None:
        return
    actual = None
    if outcome == "settled":
        actual = estimate_usage_micro(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
        if actual is None:
            # Usage missing → keep conservative reserved ceiling.
            outcome = "uncertain"

    if _use_memory_ledger():
        await _memory_settle(reservation, outcome=outcome, actual_micro=actual)
        return

    mode = outcome
    actual_arg = 0 if actual is None else int(actual)
    try:
        await _eval(
            _SETTLE_SCRIPT,
            [reservation.lease_key],
            [reservation.token, mode, actual_arg],
        )
    except LiveAnswerBudgetError:
        # Settlement failure must not crash the answer response; spend may stick
        # until lease TTL (conservative).
        logger.warning("live_answer_budget_settle_failed lease=%s", reservation.lease_key)


def classify_provider_settlement(generated: Any) -> tuple[Outcome, int | None, int | None]:
    """Map provider return / exception markers to settle policy."""
    if generated is None:
        return "uncertain", None, None
    if isinstance(generated, BaseException):
        # Timeout after dispatch is uncertain; pure cancel before send is rare here.
        if isinstance(generated, TimeoutError):
            return "uncertain", None, None
        return "uncertain", None, None
    if not isinstance(generated, dict):
        return "uncertain", None, None
    if not generated.get("ok"):
        # Rejected before/without billable completion → release reserve when possible.
        # Conservative: unknown provider errors stay uncertain.
        err = str(generated.get("error") or "")
        if err in {"provider_rejected", "http_4xx", "invalid_request"}:
            return "release", None, None
        return "uncertain", None, None
    usage = generated.get("usage") if isinstance(generated.get("usage"), dict) else {}
    prompt = usage.get("prompt_tokens") if isinstance(usage, dict) else None
    completion = usage.get("completion_tokens") if isinstance(usage, dict) else None
    if isinstance(prompt, int) and isinstance(completion, int):
        return "settled", prompt, completion
    return "uncertain", None, None


async def wrap_provider_with_budget(
    provider,
    *,
    business_id: str,
    user_id: str | None,
    ip_hash: str | None,
):
    """Return a provider that reserves before call and settles after.

    Raises LiveAnswerBudgetError before invoking ``provider`` when denied.
    """
    if provider is None:
        return None

    async def budgeted(prompt, *, timeout, max_tokens):
        reservation = await reserve_live_answer(
            business_id=business_id,
            user_id=user_id,
            ip_hash=ip_hash,
        )
        generated = None
        error: BaseException | None = None
        try:
            generated = await provider(prompt, timeout=timeout, max_tokens=max_tokens)
            return generated
        except BaseException as exc:
            error = exc
            raise
        finally:
            marker = error if error is not None else generated
            outcome, prompt_tokens, completion_tokens = classify_provider_settlement(marker)
            await settle_live_answer(
                reservation,
                outcome=outcome,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
            )

    return budgeted


def deny_result(code: str) -> dict[str, Any]:
    err = LiveAnswerBudgetError(code)
    return {
        "status": err.code,
        "assistant_answer": err.user_message,
        "answer": err.user_message,
        "sources": [],
        "display_sources": [],
        "source_refs": [],
        "reason": err.code,
        "business_grounded": True,
        "yansi_v2_grounded": True,
        "usage": None,
        "answer_policy": "yansi_v2_grounded",
    }
