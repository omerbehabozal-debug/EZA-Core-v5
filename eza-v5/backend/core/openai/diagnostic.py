# -*- coding: utf-8 -*-
"""Normalize OpenAI HTTP/SDK errors into actionable diagnostics."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

from backend.core.openai.config import sanitize_text

_INSUFFICIENT_QUOTA_CAUSE = (
    "API key'in bağlı olduğu organization/project için kota, billing veya ödeme kısıtı var. "
    "Dashboard'da başka project/organization seçili olabilir veya geçmiş ödeme başarısızlığı "
    "hesabı kilitlemiş olabilir."
)
_INSUFFICIENT_QUOTA_FIX = (
    "Dashboard'da API key'in ait olduğu project ve organization ile Usage/Billing/Limits "
    "ekranlarının aynı olduğundan emin ol. Billing'de past due/payment failed/account "
    "suspended uyarılarını kontrol et. Gerekirse yeni project'te yeni API key oluşturup "
    "deploy env'i güncelle."
)


def _extract_openai_error_body(body_text: str) -> Dict[str, Any]:
    if not body_text:
        return {}
    try:
        parsed = json.loads(body_text)
    except json.JSONDecodeError:
        return {"rawMessage": sanitize_text(body_text[:500])}

    if isinstance(parsed, dict):
        err = parsed.get("error")
        if isinstance(err, dict):
            return err
        return parsed
    return {"rawMessage": sanitize_text(str(parsed)[:500])}


def parse_openai_http_error(
    http_status: int,
    body_text: str,
    headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Parse an OpenAI HTTP error response into a diagnostic dict."""
    headers = headers or {}
    err_body = _extract_openai_error_body(body_text or "")
    error_type = err_body.get("type")
    error_code = err_body.get("code")
    error_message = sanitize_text(
        str(err_body.get("message") or err_body.get("rawMessage") or body_text or "")[:800]
    )
    request_id = (
        headers.get("x-request-id")
        or headers.get("X-Request-Id")
        or err_body.get("request_id")
    )

    diagnostic: Dict[str, Any] = {
        "httpStatus": http_status,
        "errorType": error_type,
        "errorCode": error_code,
        "errorMessage": error_message,
        "requestId": request_id,
    }
    enriched = create_openai_diagnostic(diagnostic)
    diagnostic.update(enriched)
    return diagnostic


def create_openai_diagnostic(error: Any) -> Dict[str, Any]:
    """
    Enrich a diagnostic dict (or parse from Exception string) with likelyCause/suggestedFix.
    """
    if isinstance(error, Exception) and not isinstance(error, dict):
        text = sanitize_text(str(error))
        match = re.search(r"OpenAI API error:\s*(\d+)", text)
        http_status = int(match.group(1)) if match else None
        nested = _extract_openai_error_body(text)
        base: Dict[str, Any] = {
            "httpStatus": http_status,
            "errorType": nested.get("type"),
            "errorCode": nested.get("code"),
            "errorMessage": sanitize_text(nested.get("message") or text)[:800],
            "requestId": None,
        }
    elif isinstance(error, dict):
        base = dict(error)
    else:
        base = {"errorMessage": sanitize_text(str(error))[:800]}

    http_status = base.get("httpStatus")
    error_code = base.get("errorCode")
    error_type = base.get("errorType")
    error_message = (base.get("errorMessage") or "").lower()

    likely_cause: Optional[str] = None
    suggested_fix: Optional[str] = None
    dashboard_screens: list[str] = []

    if error_code == "insufficient_quota":
        likely_cause = _INSUFFICIENT_QUOTA_CAUSE
        suggested_fix = _INSUFFICIENT_QUOTA_FIX
        dashboard_screens = [
            "platform.openai.com → API keys (key'in project'i)",
            "Usage (aynı project seçili mi?)",
            "Billing → Payment methods / Credits",
            "Settings → Limits (hard limit vs monthly budget)",
        ]
    elif "billing" in error_message or "hard limit" in error_message:
        likely_cause = "Billing hard limit veya ödeme kısıtı."
        suggested_fix = "Limits ekranında hard limit, monthly budget ve unpaid invoice kontrol edilmeli."
        dashboard_screens = ["Billing", "Settings → Limits"]
    elif http_status == 401 or error_code == "invalid_api_key":
        likely_cause = "API key geçersiz, silinmiş veya yanlış."
        suggested_fix = "Yeni API key oluştur ve deploy ortamına (Railway OPENAI_API_KEY) ekle."
        dashboard_screens = ["API keys"]
    elif http_status == 403:
        likely_cause = "Organization/project/model erişim izni yok."
        suggested_fix = "OPENAI_ORG_ID / OPENAI_PROJECT_ID header/env uyuşmazlığını kontrol et."
        dashboard_screens = ["API keys", "Organization settings"]
    elif error_code == "rate_limit_exceeded" or (
        http_status == 429 and error_code != "insufficient_quota"
    ):
        likely_cause = "OpenAI rate limit."
        suggested_fix = "Retry/backoff ekle veya rate limit artır."
        dashboard_screens = ["Usage", "Settings → Limits"]

    diagnostic_hint = suggested_fix
    return {
        "likelyCause": likely_cause,
        "suggestedFix": suggested_fix,
        "diagnosticHint": diagnostic_hint,
        "dashboardScreens": dashboard_screens,
    }


def http_status_for_openai_diagnostic(diagnostic: Dict[str, Any]) -> int:
    """Map OpenAI diagnostic to HTTP status for API consumers."""
    code = diagnostic.get("errorCode")
    status = diagnostic.get("httpStatus")
    if code == "insufficient_quota":
        return 402
    if code == "rate_limit_exceeded":
        return 429
    if status == 401:
        return 503
    if status == 403:
        return 503
    if status == 429:
        return 429
    return 502


def build_api_error_detail(diagnostic: Dict[str, Any], *, user_message: str) -> Dict[str, Any]:
    """FastAPI `detail` payload for OpenAI failures."""
    code = diagnostic.get("errorCode") or "generation_failed"
    api_code = f"openai_{code}" if code and not str(code).startswith("openai_") else code
    return {
        "ok": False,
        "source": "openai",
        "code": api_code,
        "error": api_code,
        "errorCode": diagnostic.get("errorCode"),
        "errorType": diagnostic.get("errorType"),
        "message": user_message,
        "diagnosticHint": diagnostic.get("diagnosticHint") or diagnostic.get("suggestedFix"),
        "likelyCause": diagnostic.get("likelyCause"),
        "requestId": diagnostic.get("requestId"),
    }
