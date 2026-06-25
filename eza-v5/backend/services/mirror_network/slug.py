# -*- coding: utf-8 -*-
"""Slug + share URL generation for Mirror Network nodes."""

from __future__ import annotations

import re
import secrets
import unicodedata

from backend.config import get_settings

_SLUG_MAX = 64
_PREFIX_MAX = 28
_SUFFIX_LEN = 6

_TURKISH_MAP = str.maketrans(
    {
        "ı": "i",
        "İ": "i",
        "ğ": "g",
        "Ğ": "g",
        "ü": "u",
        "Ü": "u",
        "ş": "s",
        "Ş": "s",
        "ö": "o",
        "Ö": "o",
        "ç": "c",
        "Ç": "c",
    }
)


def slugify_title_part(title: str, *, max_len: int = _PREFIX_MAX) -> str:
    normalized = unicodedata.normalize("NFKD", (title or "").translate(_TURKISH_MAP))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    if not slug:
        return "mirror"
    return slug[:max_len].strip("-")


def generate_mirror_slug(card_title: str, *, suffix: str | None = None) -> str:
    """Human-readable prefix + unguessable suffix."""
    prefix = slugify_title_part(card_title)
    token = (suffix or secrets.token_hex(_SUFFIX_LEN // 2))[:_SUFFIX_LEN]
    combined = f"{prefix}-{token}"
    return combined[:_SLUG_MAX].strip("-").lower()


def build_mirror_share_url(slug: str) -> str:
    settings = get_settings()
    base = (
        (getattr(settings, "EZA_MIRROR_PUBLIC_BASE_URL", None) or "").strip()
        or "https://saina.app"
    ).rstrip("/")
    safe_slug = re.sub(r"[^a-zA-Z0-9_-]", "", slug)[:_SLUG_MAX] or "mirror"
    return f"{base}/m/{safe_slug}"
