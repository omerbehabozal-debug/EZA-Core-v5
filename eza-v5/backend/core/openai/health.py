# -*- coding: utf-8 -*-
"""OpenAI connectivity health checks for debug endpoint."""

from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from backend.config import get_settings
from backend.core.openai.config import build_openai_request_headers, get_openai_config_snapshot
from backend.core.openai.diagnostic import create_openai_diagnostic, parse_openai_http_error

logger = logging.getLogger(__name__)

OPENAI_MODELS_URL = "https://api.openai.com/v1/models"
OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
HEALTH_TIMEOUT = 15.0


async def _request_json(
    method: str,
    url: str,
    *,
    json_body: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    headers = build_openai_request_headers()
    api_key = headers.get("Authorization", "").replace("Bearer ", "").strip()
    if not api_key:
        return {
            "status": "skipped",
            "reason": "OPENAI_API_KEY not configured",
        }

    try:
        async with httpx.AsyncClient(timeout=HEALTH_TIMEOUT) as client:
            if method == "GET":
                response = await client.get(url, headers=headers)
            else:
                response = await client.post(url, headers=headers, json=json_body or {})
    except httpx.HTTPError as exc:
        diag = create_openai_diagnostic(exc)
        return {
            "status": "error",
            "httpStatus": None,
            "errorType": "network_error",
            "errorCode": "network_error",
            "errorMessage": str(exc)[:300],
            **diag,
        }

    if response.status_code < 400:
        body: Any = None
        try:
            body = response.json()
        except Exception:
            body = None
        return {
            "status": "ok",
            "httpStatus": response.status_code,
            "requestId": response.headers.get("x-request-id"),
            "bodyPreview": _safe_preview(body),
        }

    diagnostic = parse_openai_http_error(
        response.status_code,
        response.text,
        dict(response.headers),
    )
    return {
        "status": "error",
        **diagnostic,
    }


def _safe_preview(body: Any) -> Any:
    if not isinstance(body, dict):
        return None
    if "data" in body and isinstance(body["data"], list):
        return {"modelCount": len(body["data"])}
    choices = body.get("choices")
    if choices and isinstance(choices, list) and choices:
        msg = choices[0].get("message", {})
        content = msg.get("content", "")
        return {"sampleOutput": str(content)[:80]}
    return None


async def run_openai_health_checks() -> Dict[str, Any]:
    settings = get_settings()
    env = get_openai_config_snapshot()

    models_result = await _request_json("GET", OPENAI_MODELS_URL)

    chat_model = settings.LLM_MODEL or "gpt-4o-mini"
    chat_result = await _request_json(
        "POST",
        OPENAI_CHAT_URL,
        json_body={
            "model": chat_model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
            "temperature": 0,
        },
    )

    image_config = {
        "status": "config_only",
        "note": "Image generation test skipped (cost). Config validated from env.",
        "imageProvider": env.get("imageProvider"),
        "imageModel": env.get("imageModel"),
        "imageSize": env.get("imageSize"),
        "imagesEndpoint": "https://api.openai.com/v1/images/generations",
        "mirrorRoute": "/api/standalone/mirror/generate-scene",
    }

    ok = (
        env.get("apiKeyPresent")
        and models_result.get("status") == "ok"
        and chat_result.get("status") == "ok"
    )

    summary_diag: Dict[str, Any] = {}
    if not ok:
        for probe in (chat_result, models_result):
            if probe.get("status") == "error":
                summary_diag = create_openai_diagnostic(probe)
                summary_diag.update(
                    {
                        "errorCode": probe.get("errorCode"),
                        "errorType": probe.get("errorType"),
                        "errorMessage": probe.get("errorMessage"),
                        "httpStatus": probe.get("httpStatus"),
                        "requestId": probe.get("requestId"),
                    }
                )
                break

    return {
        "ok": ok,
        "env": env,
        "modelsList": models_result,
        "chatPing": chat_result,
        "imageConfig": image_config,
        "summary": {
            "modelsListOk": models_result.get("status") == "ok",
            "chatPingOk": chat_result.get("status") == "ok",
            "likelyCause": summary_diag.get("likelyCause"),
            "suggestedFix": summary_diag.get("suggestedFix"),
            "dashboardScreens": summary_diag.get("dashboardScreens") or [],
        },
    }
