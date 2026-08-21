# -*- coding: utf-8 -*-
"""Opaque request / correlation IDs — no user or content encoding."""

from __future__ import annotations

import re
import secrets
from contextvars import ContextVar
from typing import Optional

REQUEST_ID_HEADER = "X-Request-ID"
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")

_request_id_ctx: ContextVar[Optional[str]] = ContextVar("eza_request_id", default=None)


def generate_request_id() -> str:
    """Cryptographically random opaque id (not derived from user/content)."""
    return secrets.token_urlsafe(18)


def sanitize_incoming_request_id(raw: str | None) -> str | None:
    """Accept only opaque trusted-format ids; never trust encoded payloads."""
    if not raw or not isinstance(raw, str):
        return None
    candidate = raw.strip()
    if not _REQUEST_ID_RE.fullmatch(candidate):
        return None
    # Reject anything that looks like an email / JWT / bearer fragment.
    if "@" in candidate or "." in candidate and candidate.count(".") > 2:
        return None
    if candidate.count(".") == 2 and len(candidate) > 40:
        return None
    return candidate


def get_request_id() -> str | None:
    return _request_id_ctx.get()


def set_request_id(value: str) -> None:
    _request_id_ctx.set(value)


def clear_request_id() -> None:
    _request_id_ctx.set(None)
