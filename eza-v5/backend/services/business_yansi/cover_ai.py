"""Paid cover proposals. A proposal is not a cover and not a publication.

The provider runs only after the reservation commits. A repeated idempotency
key returns that reservation and does not call the provider again. Reserved and
running leases expire on the next authorized read or reserve when the deadline
passes. Paid HTTP dispatch is tracked separately from local frame extraction.
"""
import asyncio
import hashlib
import json
import os
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_UP

from sqlalchemy import func, select, update
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker

from backend.models.business_cover_ai import BusinessCoverAiProposal as Proposal
from backend.models.business_cover_ai import BusinessCoverAiUsage as Usage

FLAG = "BILIGN_BUSINESS_COVER_AI_ENABLED"
PRICES = "BILIGN_BUSINESS_COVER_AI_PRICES_JSON"
REQUEST_USD = "BILIGN_BUSINESS_COVER_AI_REQUEST_USD"
DAILY_USD = "BILIGN_BUSINESS_COVER_AI_DAILY_USD"
MODEL_ENV = "BILIGN_BUSINESS_COVER_AI_VIDEO_MODEL"
IMAGE_MODEL_ENV = "BILIGN_BUSINESS_COVER_AI_IMAGE_MODEL"
LEASE_SECONDS_ENV = "BILIGN_BUSINESS_COVER_AI_LEASE_SECONDS"
KINDS = frozenset({"video_intervals", "image_cover"})
_KEY = re.compile(r"[A-Za-z0-9._:-]{8,128}")
_CODE = re.compile(r"[a-z0-9_]{1,80}")
_MODEL = re.compile(r"[A-Za-z0-9_.:/-]{1,120}")
_SIZE = re.compile(r"^[0-9]{2,5}x[0-9]{2,5}$")
_PAYLOAD_BYTES = 4096
_MONEY = Decimal("0.00000001")
_DEFAULT_LEASE = 60
_MAX_LEASE = 300
_PROVIDER_SLACK = 5
_PROMPT_TOKENS = 500
_MAX_FRAMES = 4
_DEFAULT_OUTPUT_TOKENS = 400
_IMAGE_DETAIL = "low"
_OPEN_STATUSES = frozenset({"reserved", "running"})
_TERMINAL = frozenset({"succeeded", "failed", "expired"})
_CONSUMING = frozenset({"reserved", "succeeded", "failed", "uncertain"})
# Official Images API (gpt-image-1 shut down 2026-10-23). Initial lock: one live model.
# Docs: https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
_VERIFIED_IMAGE_MODELS = frozenset({"gpt-image-2.5-sunburst"})
_VERIFIED_IMAGE_SIZES = frozenset({"1024x1024", "1536x1024", "1024x1536"})
_VERIFIED_IMAGE_QUALITIES = frozenset({"low", "medium", "high"})
_VERIFIED_IMAGE_OUTPUT_FORMATS = frozenset({"png"})

# Official OpenAI tile-based image tokenization for detail=low (fixed base tokens).
# Source: https://developers.openai.com/api/docs/guides/images-vision
_VERIFIED_LOW_DETAIL_IMAGE_TOKENS = {
    "gpt-4o": 85,
    "gpt-4.1": 85,
    "gpt-4o-mini": 2833,
}


class CoverAiProviderError(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


@dataclass
class DispatchGate:
    """Marks whether a paid provider HTTP request may have been sent."""

    dispatched: bool = False

    def mark_dispatched(self) -> None:
        self.dispatched = True


@dataclass(frozen=True)
class CoverAiExecutionSpec:
    """Immutable execution bound to one proposal before any provider I/O."""

    model: str
    pricing_version: str
    image_detail: str
    max_frames: int
    max_input_tokens: int
    max_output_tokens: int
    tokens_per_image: int
    prompt_tokens: int
    calculated_input_tokens: int
    input_usd_per_1k: Decimal
    output_usd_per_1k: Decimal
    estimated_max_usd: Decimal
    generation_kind: str = "vision"
    image_size: str = ""
    image_quality: str = ""
    image_count: int = 0
    image_output_format: str = ""
    # Conservative reservation ceiling per image. Never treat as measured usage.
    reserved_max_usd_per_image: Decimal = Decimal("0")

    def as_payload(self) -> dict:
        if self.generation_kind == "image":
            return {
                "generationKind": "image",
                "modelId": self.model,
                "pricingVersion": self.pricing_version,
                "imageSize": self.image_size,
                "imageQuality": self.image_quality,
                "imageCount": self.image_count,
                "outputFormat": self.image_output_format,
                "reservedMaxUsdPerImage": format(self.reserved_max_usd_per_image, "f"),
                "estimatedMaxUsd": format(self.estimated_max_usd, "f"),
            }
        return {
            "generationKind": "vision",
            "modelId": self.model,
            "pricingVersion": self.pricing_version,
            "imageDetail": self.image_detail,
            "maxFrames": self.max_frames,
            "maxInputTokens": self.max_input_tokens,
            "maxOutputTokens": self.max_output_tokens,
            "tokensPerImage": self.tokens_per_image,
            "promptTokens": self.prompt_tokens,
            "calculatedInputTokens": self.calculated_input_tokens,
            "inputUsdPer1k": format(self.input_usd_per_1k, "f"),
            "outputUsdPer1k": format(self.output_usd_per_1k, "f"),
            "estimatedMaxUsd": format(self.estimated_max_usd, "f"),
        }


@dataclass(frozen=True)
class CoverAiRequest:
    kind: str
    payload: dict
    spec: CoverAiExecutionSpec
    dispatch: DispatchGate = field(default_factory=DispatchGate)
    proposal_id: str | None = None


@dataclass(frozen=True)
class CoverAiResult:
    payload: dict
    model: str
    usage_usd: Decimal | None = None


# Backward-compatible alias used by older tests.
CoverAiQuote = CoverAiExecutionSpec


def enabled() -> bool:
    return os.getenv(FLAG, "false").strip().lower() in {"1", "true", "yes", "on"}


def request_hash(kind: str, payload: dict) -> str:
    raw = json.dumps({"kind": kind, "payload": payload}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()


def persisted_request_matches(kind: str, payload, expected_hash: str) -> bool:
    """True only when the stored payload still hashes to the reserved request_hash."""
    if not isinstance(expected_hash, str) or len(expected_hash) != 64:
        return False
    if kind not in KINDS:
        return False
    body = _json_object(payload)
    if body is None:
        return False
    return request_hash(kind, body) == expected_hash


def credentials_ready() -> bool:
    from backend.config import get_settings

    settings = get_settings()
    key = (getattr(settings, "OPENAI_API_KEY", None) or os.getenv("OPENAI_API_KEY") or "").strip()
    return bool(key)


def configured_model() -> str | None:
    raw = (os.getenv(MODEL_ENV) or "").strip()
    if _MODEL.fullmatch(raw):
        return raw
    return None


def configured_image_model() -> str | None:
    raw = (os.getenv(IMAGE_MODEL_ENV) or "").strip()
    if _MODEL.fullmatch(raw):
        return raw
    return None


def verified_image_tokens(model: str, detail: str = _IMAGE_DETAIL) -> int | None:
    """Return documented fixed image tokens for detail=low, else None."""
    if detail != "low":
        return None
    return _VERIFIED_LOW_DETAIL_IMAGE_TOKENS.get(model)


def lease_seconds() -> int:
    raw = (os.getenv(LEASE_SECONDS_ENV) or "").strip()
    try:
        value = int(raw) if raw else _DEFAULT_LEASE
    except ValueError:
        value = _DEFAULT_LEASE
    if value < 5:
        return 5
    if value > _MAX_LEASE:
        return _MAX_LEASE
    return value


def provider_timeout_seconds() -> float:
    return float(max(1, lease_seconds() - _PROVIDER_SLACK))


def _money(value) -> Decimal:
    amount = Decimal(str(value)).quantize(_MONEY, rounding=ROUND_UP)
    if not amount.is_finite() or amount <= 0 or amount > Decimal("1000"):
        raise ValueError(value)
    return amount


def _limit(name: str, code: str) -> Decimal:
    from backend.services.business_yansi.service import fail

    try:
        return _money(os.environ[name])
    except (KeyError, ValueError, TypeError):
        fail(code, 503)


def _pricing_table() -> dict:
    from backend.services.business_yansi.service import fail

    try:
        table = json.loads(os.environ[PRICES])
    except (KeyError, json.JSONDecodeError, TypeError):
        fail("cover_ai_pricing_not_configured", 503)
    if not isinstance(table, dict):
        fail("cover_ai_pricing_not_configured", 503)
    return table


def _pricing_version(table: dict) -> str:
    from backend.services.business_yansi.service import fail

    version = table.get("version")
    if not isinstance(version, str) or not version.strip() or len(version) > 64:
        fail("cover_ai_pricing_not_configured", 503)
    return version.strip()


def _build_vision_execution_spec() -> CoverAiExecutionSpec:
    """Vision / video-interval token pricing. Fail closed on unverified models."""
    from backend.services.business_yansi.service import fail

    model = configured_model()
    if model is None:
        fail("cover_ai_provider_not_configured", 503)
    if not credentials_ready():
        fail("cover_ai_credentials_missing", 503)
    tokens_per_image = verified_image_tokens(model, _IMAGE_DETAIL)
    if tokens_per_image is None:
        # Price entry alone is not enough; accounting must be implemented and verified.
        fail("cover_ai_model_unsupported", 422)
    table = _pricing_table()
    version = _pricing_version(table)
    models = table.get("models")
    if not isinstance(models, dict) or not models:
        fail("cover_ai_pricing_not_configured", 503)
    if model not in models:
        fail("cover_ai_model_pricing_missing", 503)
    entry = models[model]
    if not isinstance(entry, dict):
        fail("cover_ai_model_pricing_missing", 503)
    try:
        input_rate = _money(entry["inputUsdPer1k"])
        output_rate = _money(entry["outputUsdPer1k"])
        max_input = int(entry["maxInputTokens"])
        max_output = int(entry.get("maxOutputTokens", _DEFAULT_OUTPUT_TOKENS))
    except (KeyError, ValueError, TypeError):
        fail("cover_ai_model_pricing_missing", 503)
    if max_input <= 0 or max_input > 200_000 or max_output <= 0 or max_output > 4096:
        fail("cover_ai_model_pricing_missing", 503)
    max_output = min(max_output, _DEFAULT_OUTPUT_TOKENS)
    frames = _MAX_FRAMES
    calculated_input = _PROMPT_TOKENS + frames * tokens_per_image
    if calculated_input > max_input:
        fail("cover_ai_input_allowance", 422)
    upper = (
        (Decimal(calculated_input) / Decimal(1000)) * input_rate
        + (Decimal(max_output) / Decimal(1000)) * output_rate
    ).quantize(_MONEY, rounding=ROUND_UP)
    if not upper.is_finite() or upper <= 0:
        fail("cover_ai_model_pricing_missing", 503)
    return CoverAiExecutionSpec(
        model=model,
        pricing_version=version,
        image_detail=_IMAGE_DETAIL,
        max_frames=frames,
        max_input_tokens=max_input,
        max_output_tokens=max_output,
        tokens_per_image=tokens_per_image,
        prompt_tokens=_PROMPT_TOKENS,
        calculated_input_tokens=calculated_input,
        input_usd_per_1k=input_rate,
        output_usd_per_1k=output_rate,
        estimated_max_usd=upper,
        generation_kind="vision",
    )


def _build_image_execution_spec() -> CoverAiExecutionSpec:
    """Conservative image reservation. Independent from vision token tariffs.

    Operator-supplied reservedMaxUsdPerImage is a budget ceiling only. Images API
    token usage is not measured here; succeeded proposals keep cost_known=false.
    """
    from backend.services.business_yansi.service import fail

    model = configured_image_model()
    if model is None:
        fail("cover_ai_provider_not_configured", 503)
    if model not in _VERIFIED_IMAGE_MODELS:
        fail("cover_ai_model_unsupported", 422)
    if not credentials_ready():
        fail("cover_ai_credentials_missing", 503)
    table = _pricing_table()
    version = _pricing_version(table)
    models = table.get("imageModels")
    if not isinstance(models, dict) or not models:
        fail("cover_ai_pricing_not_configured", 503)
    if model not in models:
        fail("cover_ai_model_pricing_missing", 503)
    entry = models[model]
    if not isinstance(entry, dict):
        fail("cover_ai_model_pricing_missing", 503)
    try:
        reserved = _money(entry["reservedMaxUsdPerImage"])
        size = entry["size"]
        quality = entry["quality"]
        output_format = entry["outputFormat"]
        count = int(entry.get("n", 1))
    except (KeyError, ValueError, TypeError):
        fail("cover_ai_model_pricing_missing", 503)
    if not isinstance(size, str) or _SIZE.fullmatch(size) is None or size not in _VERIFIED_IMAGE_SIZES:
        fail("cover_ai_model_unsupported", 422)
    if not isinstance(quality, str) or quality not in _VERIFIED_IMAGE_QUALITIES:
        fail("cover_ai_model_unsupported", 422)
    if not isinstance(output_format, str) or output_format not in _VERIFIED_IMAGE_OUTPUT_FORMATS:
        fail("cover_ai_model_unsupported", 422)
    if count != 1:
        fail("cover_ai_model_unsupported", 422)
    upper = (reserved * Decimal(count)).quantize(_MONEY, rounding=ROUND_UP)
    if not upper.is_finite() or upper <= 0:
        fail("cover_ai_model_pricing_missing", 503)
    return CoverAiExecutionSpec(
        model=model,
        pricing_version=version,
        image_detail="gen",
        max_frames=0,
        max_input_tokens=0,
        max_output_tokens=0,
        tokens_per_image=0,
        prompt_tokens=0,
        calculated_input_tokens=0,
        input_usd_per_1k=Decimal("0"),
        output_usd_per_1k=Decimal("0"),
        estimated_max_usd=upper,
        generation_kind="image",
        image_size=size,
        image_quality=quality,
        image_count=count,
        image_output_format=output_format,
        reserved_max_usd_per_image=reserved,
    )


def build_execution_spec(kind: str) -> CoverAiExecutionSpec:
    """Build one immutable execution spec. Missing or unverified data fails closed."""
    from backend.services.business_yansi.service import fail

    if kind not in KINDS:
        fail("cover_ai_kind_rejected", 422)
    if kind == "image_cover":
        return _build_image_execution_spec()
    return _build_vision_execution_spec()


def quote_for(kind: str) -> CoverAiExecutionSpec:
    """Alias kept for existing call sites and tests."""
    return build_execution_spec(kind)


def bind_spec(payload: dict, spec: CoverAiExecutionSpec) -> dict:
    body = dict(payload)
    body.update(spec.as_payload())
    return body


def bind_quote(payload: dict, quote: CoverAiExecutionSpec) -> dict:
    return bind_spec(payload, quote)


def _load_vision_execution_spec(payload: dict) -> CoverAiExecutionSpec | None:
    try:
        model = payload["modelId"]
        version = payload["pricingVersion"]
        detail = payload["imageDetail"]
        max_frames = int(payload["maxFrames"])
        max_input = int(payload["maxInputTokens"])
        max_output = int(payload["maxOutputTokens"])
        tokens_per_image = int(payload["tokensPerImage"])
        prompt_tokens = int(payload["promptTokens"])
        calculated_input = int(payload["calculatedInputTokens"])
        input_rate = _money(payload["inputUsdPer1k"])
        output_rate = _money(payload["outputUsdPer1k"])
        estimated = _money(payload["estimatedMaxUsd"])
    except (KeyError, TypeError, ValueError):
        return None
    if not isinstance(model, str) or _MODEL.fullmatch(model) is None:
        return None
    if not isinstance(version, str) or not version.strip() or len(version) > 64:
        return None
    if detail != _IMAGE_DETAIL:
        return None
    if verified_image_tokens(model, detail) != tokens_per_image:
        return None
    if max_frames <= 0 or max_frames > _MAX_FRAMES:
        return None
    if max_input <= 0 or max_output <= 0:
        return None
    if calculated_input != prompt_tokens + max_frames * tokens_per_image:
        return None
    if calculated_input > max_input:
        return None
    expected = (
        (Decimal(calculated_input) / Decimal(1000)) * input_rate
        + (Decimal(max_output) / Decimal(1000)) * output_rate
    ).quantize(_MONEY, rounding=ROUND_UP)
    if expected != estimated:
        return None
    return CoverAiExecutionSpec(
        model=model,
        pricing_version=version.strip(),
        image_detail=detail,
        max_frames=max_frames,
        max_input_tokens=max_input,
        max_output_tokens=max_output,
        tokens_per_image=tokens_per_image,
        prompt_tokens=prompt_tokens,
        calculated_input_tokens=calculated_input,
        input_usd_per_1k=input_rate,
        output_usd_per_1k=output_rate,
        estimated_max_usd=estimated,
        generation_kind="vision",
    )


def _load_image_execution_spec(payload: dict) -> CoverAiExecutionSpec | None:
    try:
        model = payload["modelId"]
        version = payload["pricingVersion"]
        size = payload["imageSize"]
        quality = payload["imageQuality"]
        count = int(payload["imageCount"])
        output_format = payload["outputFormat"]
        reserved = _money(payload["reservedMaxUsdPerImage"])
        estimated = _money(payload["estimatedMaxUsd"])
    except (KeyError, TypeError, ValueError):
        return None
    if not isinstance(model, str) or _MODEL.fullmatch(model) is None:
        return None
    if model not in _VERIFIED_IMAGE_MODELS:
        return None
    if not isinstance(version, str) or not version.strip() or len(version) > 64:
        return None
    if not isinstance(size, str) or size not in _VERIFIED_IMAGE_SIZES:
        return None
    if not isinstance(quality, str) or quality not in _VERIFIED_IMAGE_QUALITIES:
        return None
    if not isinstance(output_format, str) or output_format not in _VERIFIED_IMAGE_OUTPUT_FORMATS:
        return None
    if count != 1:
        return None
    expected = (reserved * Decimal(count)).quantize(_MONEY, rounding=ROUND_UP)
    if expected != estimated:
        return None
    return CoverAiExecutionSpec(
        model=model,
        pricing_version=version.strip(),
        image_detail="gen",
        max_frames=0,
        max_input_tokens=0,
        max_output_tokens=0,
        tokens_per_image=0,
        prompt_tokens=0,
        calculated_input_tokens=0,
        input_usd_per_1k=Decimal("0"),
        output_usd_per_1k=Decimal("0"),
        estimated_max_usd=estimated,
        generation_kind="image",
        image_size=size,
        image_quality=quality,
        image_count=count,
        image_output_format=output_format,
        reserved_max_usd_per_image=reserved,
    )


def load_execution_spec(payload) -> CoverAiExecutionSpec | None:
    """Rebuild the reserved execution spec. Corrupt or partial payloads fail closed."""
    if not isinstance(payload, dict):
        return None
    generation = payload.get("generationKind")
    if generation == "image":
        return _load_image_execution_spec(payload)
    if generation is not None and generation != "vision":
        return None
    # Legacy reserved payloads omit generationKind and remain vision-only.
    return _load_vision_execution_spec(payload)


def _json_object(value):
    if not isinstance(value, dict):
        return None
    try:
        raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    except TypeError:
        return None
    if len(raw.encode()) > _PAYLOAD_BYTES:
        return None
    return json.loads(raw)


def _canonical_payload(value):
    from backend.services.business_yansi.service import fail

    body = _json_object(value)
    if body is None:
        fail("cover_ai_request_rejected", 422)
    return body


def _safe_code(code: str) -> str:
    if isinstance(code, str) and _CODE.fullmatch(code):
        return code
    return "cover_ai_provider_failed"


def _safe_model(model: str):
    if isinstance(model, str) and _MODEL.fullmatch(model):
        return model
    return None


def _measured_cost(value) -> Decimal | None:
    if value is None:
        return None
    try:
        amount = Decimal(str(value)).quantize(_MONEY, rounding=ROUND_UP)
    except Exception:
        return None
    if not amount.is_finite() or amount < 0 or amount > Decimal("1000"):
        return None
    return amount


async def _sqlite_outer_begin(db) -> None:
    """A lone SQLite SAVEPOINT commits on release. Open a real BEGIN first."""
    bind = db.get_bind()
    if bind is None or bind.dialect.name != "sqlite":
        return
    connection = await db.connection()
    try:
        await connection.exec_driver_sql("BEGIN")
    except DBAPIError as exc:
        if "within a transaction" not in str(exc).lower():
            raise


async def _spent(db, business_id, day) -> Decimal:
    total = await db.scalar(
        select(func.coalesce(func.sum(Usage.cost_usd), 0)).where(
            Usage.business_id == business_id,
            Usage.quota_day == day,
            Usage.outcome.in_(tuple(_CONSUMING)),
        )
    )
    return Decimal(str(total or 0))


async def _reload(db, proposal_id):
    row = await db.get(Proposal, proposal_id)
    if row is not None:
        await db.refresh(row)
    return row


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _deadline_passed(deadline) -> bool:
    if deadline is None:
        return False
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    return deadline <= _now()


def _lease_expired(row) -> bool:
    if row is None or row.status not in _OPEN_STATUSES:
        return False
    return _deadline_passed(getattr(row, "deadline_at", None))


async def _settle(
    db,
    business_id,
    proposal_id,
    *,
    status: str,
    error,
    payload,
    model,
    billing: str,
    actual_cost: Decimal | None,
    from_statuses=None,
):
    """Atomically close an open proposal. Terminal rows are never overwritten."""
    from backend.services.business_yansi.service import uid
    from backend.services.business_yansi.studio_media import business_media_lock

    if status not in _TERMINAL:
        raise ValueError(status)
    if billing not in {"succeeded", "failed", "released", "uncertain"}:
        raise ValueError(billing)
    allowed = tuple(from_statuses) if from_statuses is not None else tuple(_OPEN_STATUSES)
    business_key = uid(business_id)
    async with business_media_lock(db, business_key):
        reserved_value = await db.scalar(
            select(Proposal.reserved_cost_usd).where(
                Proposal.id == proposal_id, Proposal.status.in_(allowed),
            )
        )
        if reserved_value is None:
            await db.commit()
            return False
        reserved = Decimal(str(reserved_value))
        measured = _measured_cost(actual_cost) if billing == "succeeded" else None
        known = measured is not None
        cost = measured if known else Decimal("0")
        usage_charge = reserved
        if known and measured > reserved:
            usage_charge = measured
            # Visible overrun stays on the proposal cost while usage counts the higher amount.
        model_value = model
        if model_value is None:
            model_value = await db.scalar(
                select(Proposal.provider_model).where(Proposal.id == proposal_id)
            )
        settled = await db.execute(
            update(Proposal)
            .where(Proposal.id == proposal_id, Proposal.status.in_(allowed))
            .values(
                status=status,
                error_code=error,
                result_payload=None if error else payload,
                provider_model=model_value,
                cost_usd=cost,
                cost_known=known,
                deadline_at=None,
            )
            .execution_options(synchronize_session=False)
        )
        if settled.rowcount == 1:
            await db.execute(
                update(Usage)
                .where(Usage.proposal_id == proposal_id, Usage.outcome == "reserved")
                .values(outcome=billing, cost_usd=usage_charge)
                .execution_options(synchronize_session=False)
            )
    await db.commit()
    return settled.rowcount == 1


async def _settle_independent(db, business_id, proposal_id, **kwargs) -> None:
    """Persist abandonment when the caller session may already be cancelled."""
    engine = getattr(db, "bind", None)
    if engine is None:
        await _settle(db, business_id, proposal_id, **kwargs)
        return
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as session:
        await _settle(session, business_id, proposal_id, **kwargs)


async def reconcile_proposal(db, proposal):
    """Close an expired reserved/running lease without calling the provider again."""
    if proposal is None or not _lease_expired(proposal):
        return proposal
    # Reserved expiry never reached paid dispatch → release. Running may have.
    if proposal.status == "reserved":
        status, billing, error = "failed", "released", "cover_ai_lease_expired"
    else:
        status, billing, error = "expired", "uncertain", "cover_ai_lease_expired"
    await _settle(
        db,
        proposal.business_id,
        proposal.id,
        status=status,
        error=error,
        payload=None,
        model=None,
        billing=billing,
        actual_cost=None,
        from_statuses=(proposal.status,),
    )
    return await _reload(db, proposal.id)


async def _reserve(db, business_id, actor_id, kind, key, digest, payload, price, ceiling, daily, model):
    """Return (proposal_id, created). created=True only when this request inserted the row."""
    from fastapi import HTTPException

    from backend.services.business_yansi.service import access, fail, uid
    from backend.services.business_yansi.studio_media import business_media_lock
    from backend.services.business_yansi.video_authority import require_locked_actor

    business_key = uid(business_id)
    actor_key = uid(actor_id)
    deadline = _now() + timedelta(seconds=lease_seconds())
    try:
        await access(db, business_key, actor_key, "editor")
        async with business_media_lock(db, business_key):
            await require_locked_actor(db, business_key, actor_key, "editor")
            existing = await db.scalar(
                select(Proposal).where(Proposal.business_id == business_key, Proposal.idempotency_key == key)
            )
            if existing is not None:
                existing = await reconcile_proposal(db, existing)
                if existing.request_hash != digest:
                    await db.rollback()
                    fail("cover_ai_idempotency_conflict", 409)
                proposal_id, created = existing.id, False
            else:
                day = _now().date()
                if await _spent(db, business_key, day) + price > daily:
                    await db.rollback()
                    fail("cover_ai_daily_budget", 429)
                row = Proposal(
                    business_id=business_key,
                    actor_id=actor_key,
                    idempotency_key=key,
                    request_hash=digest,
                    kind=kind,
                    status="reserved",
                    request_payload=payload,
                    provider_model=model,
                    reserved_cost_usd=price,
                    cost_usd=0,
                    cost_known=False,
                    cost_limit_usd=ceiling,
                    quota_day=day,
                    attempts=0,
                    max_attempts=1,
                    deadline_at=deadline,
                )
                await _sqlite_outer_begin(db)
                try:
                    async with db.begin_nested():
                        db.add(row)
                        await db.flush()
                        db.add(Usage(
                            proposal_id=row.id,
                            business_id=business_key,
                            quota_day=day,
                            cost_usd=price,
                            outcome="reserved",
                        ))
                        await db.flush()
                except IntegrityError:
                    winner = await db.scalar(
                        select(Proposal).where(
                            Proposal.business_id == business_key,
                            Proposal.idempotency_key == key,
                        )
                    )
                    if winner is None:
                        raise
                    winner = await reconcile_proposal(db, winner)
                    if winner.request_hash != digest:
                        await db.rollback()
                        fail("cover_ai_idempotency_conflict", 409)
                    proposal_id, created = winner.id, False
                else:
                    proposal_id, created = row.id, True
        await db.commit()
        return proposal_id, created
    except HTTPException:
        await db.rollback()
        raise


async def _claim(db, proposal_id) -> str | None:
    """Claim reserved → running. Returns a unique claim token on success, else None.

    The token proves this request won the claim race. Cleanup for running state
    is allowed only when the caller holds a token (and SQL still requires status=running).
    """
    # Keep the existing reservation deadline; do not extend after claim.
    token = str(uuid.uuid4())
    claimed = await db.execute(
        update(Proposal)
        .where(Proposal.id == proposal_id, Proposal.status == "reserved")
        .values(status="running", attempts=1)
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    return token if claimed.rowcount == 1 else None


async def _abandon(db, business_id, proposal_id, *, dispatched: bool, from_statuses: tuple) -> None:
    """State-scoped cleanup. Callers must pass only the statuses they still own."""
    if not from_statuses:
        return
    if dispatched:
        status, billing, error = "expired", "uncertain", "cover_ai_provider_uncertain"
    else:
        status, billing, error = "failed", "released", "cover_ai_cancelled"
    await _settle_independent(
        db, business_id, proposal_id,
        status=status, error=error, payload=None, model=None,
        billing=billing, actual_cost=None,
        from_statuses=from_statuses,
    )


def _cleanup_statuses(cleanup_scope: str | None, claim_token: str | None) -> tuple:
    """Map ownership to the exact status predicate allowed for cancellation cleanup."""
    if cleanup_scope == "reserved":
        return ("reserved",)
    if cleanup_scope == "running" and claim_token:
        return ("running",)
    return ()


async def run_proposal(db, business_id, actor_id, *, kind, idempotency_key, payload, provider):
    """Reserve one charge, call the provider once, then store the proposal.

    Authorization: editor on this business. The provider does not receive the
    session and does not run inside the reservation transaction.

    Cancellation ownership is state-scoped:
    - creator may abandon only while status is still reserved
    - claimer (with claim token) may abandon only while status is running
    - duplicate observers never abandon
    """
    from fastapi import HTTPException

    from backend.services.business_yansi.service import access, fail, uid

    if not enabled():
        fail("cover_ai_disabled", 403)
    if kind not in KINDS:
        fail("cover_ai_kind_rejected", 422)
    if not isinstance(idempotency_key, str) or _KEY.fullmatch(idempotency_key) is None:
        fail("cover_ai_request_rejected", 422)
    if provider is None or not callable(getattr(provider, "complete", None)):
        fail("cover_ai_provider_not_configured", 503)
    try:
        await access(db, uid(business_id), uid(actor_id), "editor")
        quote = build_execution_spec(kind)
        ceiling = _limit(REQUEST_USD, "cover_ai_budget_not_configured")
        daily = _limit(DAILY_USD, "cover_ai_budget_not_configured")
        if quote.estimated_max_usd > ceiling:
            fail("cover_ai_request_ceiling", 429)
        body = _canonical_payload(bind_spec(payload, quote))
    except HTTPException:
        await db.rollback()
        raise
    digest = request_hash(kind, body)
    proposal_id, created = await _reserve(
        db, business_id, actor_id, kind, idempotency_key, digest, body,
        quote.estimated_max_usd, ceiling, daily, quote.model,
    )
    dispatch = DispatchGate()
    # Creator owns reserved cleanup until someone claims; claimer owns running cleanup.
    cleanup_scope = "reserved" if created else None
    claim_token = None
    execution_spec = quote

    async def _cancel_cleanup() -> None:
        allowed = _cleanup_statuses(cleanup_scope, claim_token)
        if not allowed:
            return
        # Reserved cleanup never reached paid dispatch.
        dispatched = bool(dispatch.dispatched) if cleanup_scope == "running" else False
        await _abandon(
            db, business_id, proposal_id,
            dispatched=dispatched,
            from_statuses=allowed,
        )

    try:
        current = await reconcile_proposal(db, await _reload(db, proposal_id))
        if current is None or current.status != "reserved":
            # Duplicate observer of running/terminal — never abandon another's work.
            cleanup_scope = None
            claim_token = None
            return current
        claim_token = await _claim(db, proposal_id)
        if claim_token is None:
            # Lost the claim race — creator must not retain running authority.
            cleanup_scope = None
            return await reconcile_proposal(db, await _reload(db, proposal_id))
        cleanup_scope = "running"
        claimed = await _reload(db, proposal_id)
        if claimed is None or not persisted_request_matches(
            claimed.kind, claimed.request_payload, claimed.request_hash,
        ):
            await _settle(
                db, business_id, proposal_id,
                status="failed", error="cover_ai_spec_corrupt", payload=None, model=None,
                billing="released", actual_cost=None,
                from_statuses=("running",),
            )
            return await _reload(db, proposal_id)
        stored = load_execution_spec(claimed.request_payload)
        if stored is None:
            await _settle(
                db, business_id, proposal_id,
                status="failed", error="cover_ai_spec_corrupt", payload=None, model=None,
                billing="released", actual_cost=None,
                from_statuses=("running",),
            )
            return await _reload(db, proposal_id)
        execution_spec = stored
        bound_payload = (
            claimed.request_payload if isinstance(claimed.request_payload, dict) else body
        )
        # Autobegin from the post-claim reload must not wrap the provider call.
        if db.in_transaction():
            await db.commit()

        error, result_payload, model, actual = None, None, None, None
        billing, status = "failed", "failed"
        task = None
        try:
            request = CoverAiRequest(
                kind=claimed.kind if claimed.kind in KINDS else kind,
                payload=bound_payload,
                spec=execution_spec,
                dispatch=dispatch,
                proposal_id=str(proposal_id),
            )
            task = asyncio.create_task(provider.complete(request))
            result = await asyncio.wait_for(task, timeout=provider_timeout_seconds())
        except asyncio.TimeoutError:
            # Timeout after the provider task started; treat as possibly dispatched.
            status, billing, error = "expired", "uncertain", "cover_ai_provider_timeout"
        except asyncio.CancelledError:
            if task is not None and not task.done():
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass
            try:
                await _cancel_cleanup()
            except Exception:
                pass
            raise
        except CoverAiProviderError as exc:
            error = _safe_code(exc.code)
            billing = "failed"
        except Exception:
            error = "cover_ai_provider_failed"
            if dispatch.dispatched:
                billing, status = "uncertain", "expired"
            else:
                billing, status = "failed", "failed"
        else:
            stored_result = result.payload if isinstance(result, CoverAiResult) else None
            result_payload = _json_object(stored_result)
            model = _safe_model(result.model) if isinstance(result, CoverAiResult) else None
            # Bound model: never accept a different model than the reserved spec.
            if model is not None and model != execution_spec.model:
                model = None
            actual = _measured_cost(getattr(result, "usage_usd", None)) if isinstance(result, CoverAiResult) else None
            if result_payload is None or model is None:
                error = "cover_ai_provider_failed"
                result_payload = None
                model = None
                billing = "failed"
                status = "failed"
            else:
                billing = "succeeded"
                status = "succeeded"
                error = None
        if status == "failed" and billing == "uncertain":
            status = "expired"
        await _settle(
            db, business_id, proposal_id,
            status=status, error=error, payload=result_payload, model=model or execution_spec.model,
            billing=billing, actual_cost=actual,
            from_statuses=("running",),
        )
        return await _reload(db, proposal_id)
    except asyncio.CancelledError:
        try:
            await _cancel_cleanup()
        except Exception:
            pass
        raise
