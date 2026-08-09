# -*- coding: utf-8 -*-
"""Public sanitization for Journey selectedSteps[8] (Phase 3.5).

Reuses existing PII detectors. Surgical redaction for email/phone/tokens;
material meaning loss → block for user review (no silent rewrite).
"""

from __future__ import annotations

import re
from typing import Any, Mapping, Sequence

from backend.core.privacy.sensitive_content import (
    EMAIL_RE,
    JWT_LIKE_RE,
    OPENAI_KEY_RE,
    BEARER_TOKEN_RE,
    contains_address_like,
    contains_opaque_secret,
    contains_pii_value,
    contains_tc_kimlik,
)
from backend.core.schemas.mirror_draft import sanitize_display_text
from backend.services.mirror.journey_window_hashes import (
    compute_answer_hash,
    compute_question_hash,
)

# Explicit private markers (product tests / off-topic private entities).
PRIVATE_MARKER_RE = re.compile(r"\bSECRET_[A-Z0-9_]+\b")
PHONE_REDACT_RE = re.compile(
    r"(?:\+?\d{1,3}[\s\-]?)?(?:\(?\d{2,4}\)?[\s\-]?)?\d{3}[\s\-]?\d{2}[\s\-]?\d{2,4}"
)

SANITIZATION_CLEAN = "clean"
SANITIZATION_SANITIZED = "sanitized"
SANITIZATION_BLOCKED = "blocked"


def _flags_for_text(text: str) -> list[str]:
    flags: list[str] = []
    if not text:
        return flags
    if EMAIL_RE.search(text):
        flags.append("email")
    digits = re.sub(r"\D", "", text)
    if len(digits) >= 10 and PHONE_REDACT_RE.search(text):
        flags.append("phone")
    if JWT_LIKE_RE.search(text) or OPENAI_KEY_RE.search(text) or BEARER_TOKEN_RE.search(text):
        flags.append("secret_token")
    if contains_opaque_secret(text):
        flags.append("opaque_secret")
    if PRIVATE_MARKER_RE.search(text):
        flags.append("private_marker")
    if contains_tc_kimlik(text):
        flags.append("tc_kimlik")
    if contains_address_like(text):
        flags.append("address")
    if contains_pii_value(text) and not flags:
        flags.append("pii")
    return flags


def _redact_text(text: str) -> tuple[str, list[str]]:
    flags = _flags_for_text(text)
    out = text
    if "email" in flags:
        out = EMAIL_RE.sub("[email]", out)
    if "phone" in flags:
        out = PHONE_REDACT_RE.sub("[phone]", out)
    if "secret_token" in flags or "opaque_secret" in flags:
        out = JWT_LIKE_RE.sub("[secret]", out)
        out = OPENAI_KEY_RE.sub("[secret]", out)
        out = BEARER_TOKEN_RE.sub("[secret]", out)
    if "private_marker" in flags:
        # Private markers in the selected 8 are material — do not silently invent public copy.
        return out, flags
    if "tc_kimlik" in flags or "address" in flags:
        # Detectors exist; surgical rewrite is not supported — block for review.
        return out, flags
    cleaned = sanitize_display_text(out, max_len=4000) or ""
    return cleaned, flags


def _materially_changed(original: str, sanitized: str, flags: Sequence[str]) -> bool:
    if "private_marker" in flags:
        return True
    if "tc_kimlik" in flags or "address" in flags:
        return True
    if "opaque_secret" in flags and "[secret]" not in sanitized and original == sanitized:
        return True
    o = (original or "").strip()
    s = (sanitized or "").strip()
    if not s and o:
        return True
    # Half-content rule only for meaningfully long strings (short Q/A like "Soru 1?"
    # must not false-positive on max(8, …)).
    if len(o) >= 16 and len(s) < max(8, int(len(o) * 0.5)):
        return True
    return False


def sanitize_selected_journey_steps(
    steps: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """
    Returns:
      status: clean | sanitized | blocked
      flags: unique flag list
      steps: public steps (same shape) — only when not blocked
      originalHashes / publicHashes: per-step question/answer hashes
      blockedReason: optional
    """
    all_flags: list[str] = []
    public_steps: list[dict[str, Any]] = []
    original_hashes: list[dict[str, str]] = []
    public_hashes: list[dict[str, str]] = []
    blocked = False
    blocked_reason = None

    for step in steps:
        row = dict(step)
        q = str(row.get("publicQuestion") or "")
        a = str(row.get("publicAnswer") or "")
        oq_hash = compute_question_hash(q)
        oa_hash = compute_answer_hash(a)
        original_hashes.append({"questionHash": oq_hash, "answerHash": oa_hash})

        q_pub, q_flags = _redact_text(q)
        a_pub, a_flags = _redact_text(a)
        flags = sorted(set(q_flags + a_flags))
        all_flags.extend(flags)

        if _materially_changed(q, q_pub, q_flags) or _materially_changed(a, a_pub, a_flags):
            blocked = True
            blocked_reason = (
                "Selected Q/A contains private content that cannot be safely "
                "sanitized without changing meaning; user review required."
            )
            public_hashes.append({"questionHash": oq_hash, "answerHash": oa_hash})
            public_steps.append(row)
            continue

        row["publicQuestion"] = q_pub
        row["publicAnswer"] = a_pub
        if flags:
            row["sanitizationFlags"] = flags
        pq_hash = compute_question_hash(q_pub)
        pa_hash = compute_answer_hash(a_pub)
        public_hashes.append({"questionHash": pq_hash, "answerHash": pa_hash})
        public_steps.append(row)

    unique_flags = sorted(set(all_flags))
    if blocked:
        status = SANITIZATION_BLOCKED
    elif unique_flags:
        status = SANITIZATION_SANITIZED
    else:
        status = SANITIZATION_CLEAN

    return {
        "status": status,
        "flags": unique_flags,
        "steps": public_steps if not blocked else [dict(s) for s in steps],
        "originalHashes": original_hashes,
        "publicHashes": public_hashes,
        "blockedReason": blocked_reason,
    }
