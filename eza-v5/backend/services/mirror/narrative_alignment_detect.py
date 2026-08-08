# -*- coding: utf-8 -*-
"""Lightweight image claim detection for Narrative Alignment Phase 1.

Returns structured detectedClaims only — no beauty/composition/mood scores.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, List, Optional

import httpx
from pydantic import BaseModel, Field

from backend.config import get_settings
from backend.core.openai.config import build_openai_request_headers

logger = logging.getLogger(__name__)

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
REQUEST_TIMEOUT_SECONDS = 45.0

DETECT_SYSTEM = """You detect concrete visual claims in an image for publish alignment.
Return ONLY valid JSON:
{"detectedClaims":[{"type":"place|brand|product|object|landmark|setting|vehicle_brand","value":"..."}}]}

Rules:
- List only things visibly present.
- Prefer brand/product names when logos or distinctive models are clear.
- Do not invent brands from a generic vehicle.
- No beauty, composition, style, or mood scores.
- No prose caption field.
- Max 16 claims.
"""


class DetectedClaimModel(BaseModel):
    type: str = Field(..., min_length=1, max_length=40)
    value: str = Field(..., min_length=1, max_length=80)


class DetectImageClaimsResult(BaseModel):
    detectedClaims: List[DetectedClaimModel] = Field(default_factory=list)
    source: str = "vision_api"


def _parse_json_object(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)


async def detect_image_claims(
    *,
    scene_image_url: str,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    http_client: Optional[httpx.AsyncClient] = None,
) -> DetectImageClaimsResult:
    settings = get_settings()
    key = (api_key if api_key is not None else settings.OPENAI_API_KEY or "").strip()
    if not key or not (scene_image_url or "").strip():
        return DetectImageClaimsResult(detectedClaims=[], source="unavailable")

    vision_model = (model or "gpt-4o-mini").strip()
    headers = build_openai_request_headers(key)
    payload = {
        "model": vision_model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": DETECT_SYSTEM},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "List concrete visual claims present in this Mirror scene image.",
                    },
                    {"type": "image_url", "image_url": {"url": scene_image_url.strip()}},
                ],
            },
        ],
    }

    client = http_client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
    owns_client = http_client is None
    try:
        response = await client.post(OPENAI_CHAT_URL, headers=headers, json=payload)
        if response.status_code >= 400:
            logger.warning(
                "narrative_alignment_detect_failed status=%s", response.status_code
            )
            return DetectImageClaimsResult(detectedClaims=[], source="unavailable")
        data = response.json()
        content = (
            ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
        )
        parsed = _parse_json_object(content)
        claims_raw = parsed.get("detectedClaims") or []
        claims: List[DetectedClaimModel] = []
        for row in claims_raw[:16]:
            if not isinstance(row, dict):
                continue
            value = str(row.get("value") or "").strip()
            ctype = str(row.get("type") or "object").strip() or "object"
            if not value:
                continue
            claims.append(DetectedClaimModel(type=ctype[:40], value=value[:80]))
        return DetectImageClaimsResult(detectedClaims=claims, source="vision_api")
    except Exception:
        logger.exception("narrative_alignment_detect_exception")
        return DetectImageClaimsResult(detectedClaims=[], source="unavailable")
    finally:
        if owns_client:
            await client.aclose()
