# -*- coding: utf-8 -*-
"""OpenAI environment snapshot — never logs full API keys."""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, Optional

from backend.config import get_settings

logger = logging.getLogger(__name__)

# Match old sk- keys, sk-proj- keys, and short accidental copies. Hyphen stays inside the token.
_KEY_PATTERN = re.compile(r"sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_\-]{3,}")
_EMPTY_KEY = {
    "apiKeyPresent": False,
    "apiKeyPrefix": None,
    "apiKeyFingerprint": None,
    "apiKeyLength": 0,
    "apiKeyFormatValid": False,
}


def _secret_body(key: str) -> str:
    for label in ("sk-proj-", "sk-svcacct-", "sk-admin-", "sk-"):
        if key.startswith(label):
            return key[len(label):]
    return key


def _exposes_secret(key: str, shown: Optional[str]) -> bool:
    if not shown or not key:
        return False
    if key in shown:
        return True
    secret = _secret_body(key)
    hidden = secret[:-4] if len(secret) > 4 else secret
    return bool(hidden) and hidden in shown


def mask_api_key(api_key: Optional[str]) -> Dict[str, Any]:
    """Return a fingerprint that never contains the full key or its hidden body."""
    key = (api_key or "").strip()
    if not key:
        return dict(_EMPTY_KEY)

    if key.startswith("sk-proj-") and len(key) >= 24:
        label = "sk-proj"
        format_valid = True
    elif key.startswith("sk-") and key.count("-") == 1 and len(key) >= 20:
        label = "sk"
        format_valid = True
    else:
        label = None
        format_valid = False

    tail = None
    if label:
        secret = _secret_body(key)
        if len(secret) >= 16:
            tail = secret[-4:]
    if label and tail:
        fingerprint = f"{label}-…{tail}"
        prefix = label
    elif label:
        fingerprint = f"{label}-…"
        prefix = label
    else:
        fingerprint = "redacted"
        prefix = None

    if _exposes_secret(key, fingerprint) or _exposes_secret(key, prefix):
        fingerprint = "redacted"
        prefix = None
        format_valid = False

    return {
        "apiKeyPresent": True,
        "apiKeyPrefix": prefix,
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
