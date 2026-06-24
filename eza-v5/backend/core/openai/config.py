# -*- coding: utf-8 -*-
"""OpenAI environment snapshot — never logs full API keys."""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, Optional

from backend.config import get_settings

logger = logging.getLogger(__name__)

_KEY_PATTERN = re.compile(r"sk-[a-zA-Z0-9_-]{8,}")


def mask_api_key(api_key: Optional[str]) -> Dict[str, Any]:
    """Return safe fingerprint fields for an API key."""
    key = (api_key or "").strip()
    if not key:
        return {
            "apiKeyPresent": False,
            "apiKeyPrefix": None,
            "apiKeyFingerprint": None,
            "apiKeyLength": 0,
            "apiKeyFormatValid": False,
        }

    prefix = key.split("-", 2)
    if len(prefix) >= 2:
        api_prefix = f"{prefix[0]}-{prefix[1]}"
    else:
        api_prefix = key[:7] if len(key) >= 7 else key[:3]

    tail = key[-6:] if len(key) >= 6 else key
    fingerprint = f"{api_prefix}...{tail}"
    format_valid = key.startswith("sk-") and len(key) >= 20

    return {
        "apiKeyPresent": True,
        "apiKeyPrefix": api_prefix,
        "apiKeyFingerprint": fingerprint,
        "apiKeyLength": len(key),
        "apiKeyFormatValid": format_valid,
    }


def mask_optional_id(value: Optional[str], *, label: str) -> Dict[str, Any]:
    raw = (value or "").strip()
    if not raw:
        return {f"{label}Present": False, f"{label}Fingerprint": None}
    tail = raw[-4:] if len(raw) >= 4 else raw
    return {
        f"{label}Present": True,
        f"{label}Fingerprint": f"...{tail}",
    }


def get_openai_config_snapshot() -> Dict[str, Any]:
    """Read effective OpenAI config from Settings + process env."""
    settings = get_settings()
    api_key = (settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY") or "").strip()
    org_id = (settings.OPENAI_ORG_ID or os.getenv("OPENAI_ORG_ID") or "").strip() or None
    project_id = (settings.OPENAI_PROJECT_ID or os.getenv("OPENAI_PROJECT_ID") or "").strip() or None

    env_name = (settings.EZA_ENV or settings.ENV or os.getenv("ENV") or "unknown").lower()
    node_env = (os.getenv("NODE_ENV") or "").strip() or None

    snapshot: Dict[str, Any] = {
        **mask_api_key(api_key),
        **mask_optional_id(org_id, label="orgId"),
        **mask_optional_id(project_id, label="projectId"),
        "nodeEnv": node_env,
        "appEnv": env_name,
        "chatModel": settings.LLM_MODEL,
        "imageProvider": settings.EZA_MIRROR_IMAGE_PROVIDER,
        "imageModel": settings.EZA_MIRROR_OPENAI_IMAGE_MODEL,
        "imageSize": settings.EZA_MIRROR_IMAGE_SIZE,
        "deployHints": {
            "readsFrom": "Settings (pydantic) + os.getenv for OPENAI_ORG_ID/OPENAI_PROJECT_ID",
            "backendHost": "Railway (api.ezacore.ai) — not Vercel",
            "frontendProxy": "Vercel rewrites /api → api.ezacore.ai",
        },
    }
    return snapshot


def build_openai_request_headers(
    api_key: Optional[str] = None,
    *,
    org_id: Optional[str] = None,
    project_id: Optional[str] = None,
    content_type: str = "application/json",
) -> Dict[str, str]:
    settings = get_settings()
    key = (api_key or settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY") or "").strip()
    headers: Dict[str, str] = {
        "Authorization": f"Bearer {key}",
        "Content-Type": content_type,
    }
    org = (org_id or settings.OPENAI_ORG_ID or os.getenv("OPENAI_ORG_ID") or "").strip()
    project = (project_id or settings.OPENAI_PROJECT_ID or os.getenv("OPENAI_PROJECT_ID") or "").strip()
    if org:
        headers["OpenAI-Organization"] = org
    if project:
        headers["OpenAI-Project"] = project
    return headers


def sanitize_text(text: str) -> str:
    """Remove accidental API key leaks from error strings."""
    if not text:
        return text
    return _KEY_PATTERN.sub("sk-***REDACTED***", text)


def log_openai_config_startup() -> None:
    snap = get_openai_config_snapshot()
    lines = [
        "[OpenAI Config]",
        f"apiKeyPresent={snap.get('apiKeyPresent')}",
        f"apiKeyFingerprint={snap.get('apiKeyFingerprint') or 'n/a'}",
        f"apiKeyFormatValid={snap.get('apiKeyFormatValid')}",
        f"orgIdPresent={snap.get('orgIdPresent')}",
        f"projectIdPresent={snap.get('projectIdPresent')}",
        f"appEnv={snap.get('appEnv')}",
        f"chatModel={snap.get('chatModel')}",
        f"imageProvider={snap.get('imageProvider')}",
        f"imageModel={snap.get('imageModel')}",
    ]
    logger.info("\n".join(lines))
