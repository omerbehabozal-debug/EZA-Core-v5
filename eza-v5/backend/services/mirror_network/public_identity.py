# -*- coding: utf-8 -*-
"""Phase 8.5 — public identity helpers (privacy-safe display names).

Email / email local-part must NEVER become a public display name.
Only an explicitly chosen ``public_display_name`` is shown publicly.
"""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.models.production import User

logger = logging.getLogger(__name__)

# Neutral product-safe fallback (TR). Not derived from email.
PUBLIC_DISPLAY_NAME_FALLBACK = "biligN kullanıcısı"

PUBLIC_DISPLAY_NAME_MAX_LEN = 48
PUBLIC_DISPLAY_NAME_MIN_LEN = 2

# Reject ASCII control chars and angle brackets (XSS / injection surface).
_CONTROL_OR_ANGLE = re.compile(r"[\x00-\x1f\x7f<>]")

# Names that must not impersonate system chrome.
_RESERVED = frozenset(
    {
        "admin",
        "administrator",
        "bilign",
        "bilign kullanıcısı",
        "saina",
        "eza",
        "moderator",
        "system",
        "root",
        "null",
        "undefined",
    }
)


def normalize_public_display_name(raw: str | None) -> str | None:
    """Trim + collapse internal whitespace. Empty → None."""
    if raw is None:
        return None
    collapsed = " ".join(str(raw).split())
    return collapsed or None


def validate_public_display_name(raw: str | None) -> str:
    """
    Validate an explicit user-chosen public display name.

    Raises ValueError with a stable reason code.
    """
    name = normalize_public_display_name(raw)
    if not name:
        raise ValueError("empty_display_name")
    if len(name) < PUBLIC_DISPLAY_NAME_MIN_LEN:
        raise ValueError("display_name_too_short")
    if len(name) > PUBLIC_DISPLAY_NAME_MAX_LEN:
        raise ValueError("display_name_too_long")
    if _CONTROL_OR_ANGLE.search(name):
        raise ValueError("display_name_invalid_chars")
    if "@" in name:
        raise ValueError("display_name_looks_like_email")
    if name.casefold() in _RESERVED:
        raise ValueError("display_name_reserved")
    return name


def resolve_public_display_name(user: "User" | None) -> str:
    """
    Public-facing display name.

    Explicit ``public_display_name`` only. Never email / local-part / role / tier.
    """
    if user is None:
        return PUBLIC_DISPLAY_NAME_FALLBACK
    chosen = normalize_public_display_name(getattr(user, "public_display_name", None))
    if chosen:
        return chosen
    return PUBLIC_DISPLAY_NAME_FALLBACK


# Public honorific — social/intellectual identity. Not a plan, role, or handle.
# Distinct from Yansı ``publicTitle`` (the curiosity sentence on a published node).
PUBLIC_HONORIFIC_CURIOUS = "curious"
PUBLIC_HONORIFIC_BILGIN = "bilgin"
PUBLIC_HONORIFIC_VALUES = frozenset(
    {PUBLIC_HONORIFIC_CURIOUS, PUBLIC_HONORIFIC_BILGIN}
)
PUBLIC_HONORIFIC_LABELS = {
    PUBLIC_HONORIFIC_CURIOUS: "Meraklı",
    PUBLIC_HONORIFIC_BILGIN: "Bilgin",
}


def normalize_public_honorific(raw: str | None) -> str:
    """Unknown / empty / NULL → curious. Never derived from plan or auth role."""
    value = (raw or "").strip().lower()
    if value == PUBLIC_HONORIFIC_BILGIN:
        return PUBLIC_HONORIFIC_BILGIN
    return PUBLIC_HONORIFIC_CURIOUS


def resolve_public_honorific(user: "User" | None) -> str:
    """Public honorific id for DTOs. Guest/missing user → curious (display layer hides guest)."""
    if user is None:
        return PUBLIC_HONORIFIC_CURIOUS
    return normalize_public_honorific(getattr(user, "public_honorific", None))


def resolve_public_honorific_label(user: "User" | None) -> str:
    return PUBLIC_HONORIFIC_LABELS[resolve_public_honorific(user)]


def assign_public_honorific(user: "User", honorific: str, *, actor: str = "system") -> str:
    """
    System-only write path for Meraklı → Bilgin (and reverse).

    Not exposed on owner PATCH / public-identity. Callers must be an operator
    CLI or trusted admin service — never subscription, ranking, or profile-edit.
    """
    value = (honorific or "").strip().lower()
    if value not in PUBLIC_HONORIFIC_VALUES:
        raise ValueError("invalid_public_honorific")
    previous = resolve_public_honorific(user)
    user.public_honorific = value
    logger.info(
        "public_honorific_changed user_id=%s from=%s to=%s actor=%s",
        getattr(user, "id", None),
        previous,
        value,
        actor,
    )
    return value
