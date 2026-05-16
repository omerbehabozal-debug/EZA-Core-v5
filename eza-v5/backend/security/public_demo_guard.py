# -*- coding: utf-8 -*-
"""
Public demo guard — LLM maliyetini sınırlar (standalone + paylaşılan demo kotası).
Deploy ortamında EZA_PUBLIC_* env ile ayarlanır.
"""

import os
from fastapi import HTTPException, status

from backend.services.demo_token_quota import (
    check_text_length,
    check_token_quota,
    estimate_tokens,
)


def is_public_demo_disabled() -> bool:
    return os.getenv("EZA_PUBLIC_DEMO_DISABLED", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def enforce_public_demo_limits(
    text: str,
    *,
    estimated_output_tokens: int = 180,
) -> None:
    """
    Metin uzunluğu + günlük global token kotası (LLM çağrısından önce).
    Tüm public demo uçları aynı sayacı paylaşır.
    """
    if is_public_demo_disabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "PUBLIC_DEMO_PAUSED",
                "message": "Genel demo geçici olarak duraklatıldı. Lütfen daha sonra tekrar deneyin.",
            },
        )

    cleaned = (text or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "EMPTY_INPUT", "message": "Metin gerekli."},
        )

    is_valid, length_error = check_text_length(cleaned)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": "DEMO_TEXT_LIMIT_EXCEEDED",
                "message": length_error or "Metin uzunluğu sınırı aşıldı.",
            },
        )

    estimated = estimate_tokens(cleaned, estimated_output_tokens=estimated_output_tokens)
    allowed, quota_error, _remaining = check_token_quota(estimated)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "DEMO_TOKEN_LIMIT_REACHED",
                "message": quota_error or "Günlük demo kotası doldu.",
            },
        )
