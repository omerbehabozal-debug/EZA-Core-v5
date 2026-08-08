# -*- coding: utf-8 -*-
"""Resolve conversation locale for D2 / public landing (no per-surface re-inference)."""

from __future__ import annotations

import re
from typing import Iterable, Protocol


class _HasRoleText(Protocol):
    role: str
    text: str


_ARABIC_RE = re.compile(r"[\u0600-\u06FF]")
_TR_CHARS_RE = re.compile(r"[ğüşıöçĞÜŞİÖÇ]")
_TR_WORDS_RE = re.compile(
    r"(?i)\b(ve|bir|bu|için|ama|çok|var|yok|nedir|nasıl|istedim|istiyorum|"
    r"merhaba|günaydın|teşekkür|lütfen|şey|kadar|daha|şimdi|sonra|ile)\b"
)
_EN_WORDS_RE = re.compile(
    r"(?i)\b(the|and|for|with|what|how|want|please|hello|thanks|about|"
    r"this|that|have|would|could|should|looking|between)\b"
)


def resolve_conversation_locale(
    messages: Iterable[_HasRoleText],
    *,
    explicit: str | None = None,
) -> str:
    """Pick canonical locale for Mirror public copy.

    Priority: explicit override → Arabic script → Turkish orthography/words →
    English cue words → default ``tr`` (product primary).
    """
    if explicit and explicit.strip():
        key = explicit.strip().lower().replace("_", "-").split("-")[0]
        if key in {"tr", "en", "ar"}:
            return key

    user_bits: list[str] = []
    for msg in messages:
        role = getattr(msg, "role", "") or ""
        text = (getattr(msg, "text", "") or "").strip()
        if role == "user" and text:
            user_bits.append(text)
    blob = " ".join(user_bits)
    if not blob:
        return "tr"

    if _ARABIC_RE.search(blob):
        return "ar"
    if _TR_CHARS_RE.search(blob) or _TR_WORDS_RE.search(blob):
        return "tr"
    if _EN_WORDS_RE.search(blob):
        return "en"
    return "tr"
