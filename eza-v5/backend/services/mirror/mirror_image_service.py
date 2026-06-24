# -*- coding: utf-8 -*-
"""Mirror scene image orchestration — validation and provider dispatch."""

import re
from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status

from backend.core.openai.diagnostic import build_api_error_detail, http_status_for_openai_diagnostic
from backend.services.mirror.mirror_image_provider import get_mirror_image_provider
from backend.services.mirror.types import (
    MirrorImageProviderError,
    MirrorImageRequest,
    MirrorImageResult,
)

ALLOWED_STYLE_PRESETS = frozenset(
    {
        "eza_mirror_professional_v1",
        "eza_mirror_soft_v1",
    }
)

STANDARD_NEGATIVE_FALLBACK = (
    "text, letters, numbers, logo, watermark, signage, readable writing, captions, "
    "UI labels, distorted anatomy, extra limbs, broken hands, creepy face, messy "
    "background, cluttered dashboard, harsh contrast, dark gaming card style, low "
    "quality, blurry, noisy, flat cartoon, cheap sticker style, over saturated colors"
)

MAX_PROMPT_LEN = 12_000
MAX_NEGATIVE_LEN = 4_000
MAX_SEED_HINT_LEN = 256
MAX_QUALITY_HINTS = 24
MAX_QUALITY_HINT_ITEM_LEN = 200

_CARD_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_PII_PATTERNS = [
    re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", re.I),
    re.compile(r"\b\d{11}\b"),
    re.compile(r"\b(?:\+90|0)?\s*5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b"),
    re.compile(
        r"\b(?:password|şifre|tc\s*kimlik|iban|credit\s*card|kart\s*numarası)\b",
        re.I,
    ),
]


def _reject(code: str, message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
    raise HTTPException(
        status_code=status_code,
        detail={"ok": False, "error": code, "code": code, "message": message},
    )


def _reject_openai(exc: MirrorImageProviderError) -> None:
    diagnostic = exc.diagnostic or {}
    status_code = http_status_for_openai_diagnostic(diagnostic)
    detail = build_api_error_detail(
        diagnostic,
        user_message=str(exc) or "Mirror sahnesi şu an hazırlanamadı.",
    )
    raise HTTPException(status_code=status_code, detail=detail)


def _contains_likely_pii(text: str) -> bool:
    for pattern in _PII_PATTERNS:
        if pattern.search(text):
            return True
    return False


def _normalize_quality_hints(raw: Optional[List[str]]) -> List[str]:
    if not raw:
        return []
    hints: List[str] = []
    for item in raw[:MAX_QUALITY_HINTS]:
        if not isinstance(item, str):
            continue
        s = item.strip()
        if not s:
            continue
        hints.append(s[:MAX_QUALITY_HINT_ITEM_LEN])
    return hints


def validate_and_build_request(
    *,
    prompt: str,
    negative_prompt: Optional[str],
    seed_hint: str,
    style_preset: str,
    card_date: str,
    quality_hints: Optional[List[str]] = None,
    prompt_contract: Optional[str] = None,
) -> MirrorImageRequest:
    p = (prompt or "").strip()
    if not p:
        _reject("prompt_required", "Prompt boş olamaz.")
    if len(p) > MAX_PROMPT_LEN:
        _reject("prompt_too_long", "Prompt izin verilen uzunluğu aşıyor.")
    if _contains_likely_pii(p):
        _reject("prompt_pii", "Prompt kişisel veri içeremez.")

    neg = (negative_prompt or "").strip() or STANDARD_NEGATIVE_FALLBACK
    if len(neg) > MAX_NEGATIVE_LEN:
        _reject("negative_prompt_too_long", "Negative prompt çok uzun.")

    seed = (seed_hint or "").strip()
    if not seed:
        _reject("seed_required", "seedHint gerekli.")
    if len(seed) > MAX_SEED_HINT_LEN:
        _reject("seed_too_long", "seedHint çok uzun.")

    preset = (style_preset or "").strip()
    if preset not in ALLOWED_STYLE_PRESETS:
        _reject(
            "invalid_style_preset",
            f"stylePreset geçersiz. İzin verilen: {', '.join(sorted(ALLOWED_STYLE_PRESETS))}",
        )

    date_str = (card_date or "").strip()
    if not _CARD_DATE_RE.match(date_str):
        _reject("invalid_card_date", "cardDate YYYY-MM-DD formatında olmalı.")
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        _reject("invalid_card_date", "cardDate geçerli bir tarih değil.")

    hints = _normalize_quality_hints(quality_hints)
    if quality_hints is not None and len(quality_hints) > MAX_QUALITY_HINTS:
        _reject("too_many_quality_hints", "qualityHints listesi çok uzun.")

    contract = (prompt_contract or "").strip() or None

    return MirrorImageRequest(
        prompt=p,
        negative_prompt=neg,
        seed_hint=seed,
        style_preset=preset,
        card_date=date_str,
        quality_hints=hints,
        prompt_contract=contract,
    )


async def generate_mirror_scene(
    *,
    prompt: str,
    negative_prompt: Optional[str],
    seed_hint: str,
    style_preset: str,
    card_date: str,
    quality_hints: Optional[List[str]] = None,
    prompt_contract: Optional[str] = None,
) -> MirrorImageResult:
    request = validate_and_build_request(
        prompt=prompt,
        negative_prompt=negative_prompt,
        seed_hint=seed_hint,
        style_preset=style_preset,
        card_date=card_date,
        quality_hints=quality_hints,
        prompt_contract=prompt_contract,
    )
    provider = get_mirror_image_provider()
    try:
        return await provider.generate_scene(request)
    except MirrorImageProviderError as exc:
        if exc.source == "openai" and exc.diagnostic:
            _reject_openai(exc)
        _reject(
            "generation_failed",
            str(exc) or "Mirror sahnesi şu an hazırlanamadı. Daha sonra tekrar deneyebilirsin.",
            status.HTTP_502_BAD_GATEWAY,
        )
