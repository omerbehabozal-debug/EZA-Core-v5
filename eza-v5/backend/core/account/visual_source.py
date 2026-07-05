# -*- coding: utf-8 -*-
"""Visual quota idempotency keys — never use cardDate alone."""

from __future__ import annotations

import hashlib
import re

_CONV_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,128}$")
_REQUEST_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{8,128}$")


class VisualSourceIdError(ValueError):
    """Raised when a stable visual idempotency key cannot be built."""


def _normalize_token(raw: str | None, *, pattern: re.Pattern[str], label: str) -> str | None:
    value = (raw or "").strip()
    if not value:
        return None
    if not pattern.match(value):
        raise VisualSourceIdError(f"invalid_{label}")
    return value


def build_visual_source_id(
    *,
    conversation_id: str | None,
    generation_request_id: str | None,
    card_id: str | None = None,
    card_date: str | None = None,
    content_hash: str | None = None,
    guest_scope: str | None = None,
) -> str:
    """
    Build a unique, stable visual quota source_id.

    Priority:
    1. visual:{conversationId}:{requestId}
    2. visual:{conversationId}:{cardId}
    3. visual:{conversationId}:{cardDate}:{contentHash}
    Guest without conversation uses visual:guest:{guest_scope}:{requestId}.
    """
    request_id = _normalize_token(
        generation_request_id, pattern=_REQUEST_ID_RE, label="generation_request_id"
    )
    conversation = _normalize_token(conversation_id, pattern=_CONV_ID_RE, label="conversation_id")
    card = _normalize_token(card_id, pattern=_CONV_ID_RE, label="card_id")

    if request_id:
        if conversation:
            return f"visual:{conversation}:{request_id}"
        scope = (guest_scope or "").strip()
        if scope:
            return f"visual:guest:{scope}:{request_id}"

    if conversation and card:
        return f"visual:{conversation}:{card}"

    date = (card_date or "").strip()
    digest = (content_hash or "").strip()
    if conversation and date and digest:
        return f"visual:{conversation}:{date}:{digest}"

    raise VisualSourceIdError("visual_source_id_required")


def content_hash_for_visual(*, prompt: str, seed_hint: str, style_preset: str) -> str:
    """Deterministic fallback hash when requestId is absent."""
    payload = f"{prompt}|{seed_hint}|{style_preset}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
