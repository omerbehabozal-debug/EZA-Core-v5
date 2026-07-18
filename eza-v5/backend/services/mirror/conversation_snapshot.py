# -*- coding: utf-8 -*-
"""Safe conversation snapshot for Mirror Meaning Analysis.

PRODUCTION AUTHORITY for Director LLM analysis input.
Frontend may send permitted message DTOs only; this module performs
clean / dedupe / head-tail selection / char caps / privacy stripping.

Do not duplicate this algorithm as a second production path on the client.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional, Sequence

# Soft character budget ≈ token-safe for chat analysis (~2–3k tokens worst case).
DEFAULT_MAX_SNAPSHOT_CHARS = 4500
MAX_ASSISTANT_SNIPPET_CHARS = 280
MAX_USER_MESSAGE_CHARS = 600
HEAD_USER_KEEP = 4
TAIL_USER_KEEP = 8

_PRIVATE_KEY_RE = re.compile(
    r"(user[_-]?id|guest[_-]?token|auth|password|api[_-]?key|lineage|archive|session|"
    r"cookie|authorization|bearer|refresh|access[_-]?token)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class SnapshotMessage:
    role: str  # "user" | "assistant"
    text: str


@dataclass(frozen=True)
class MirrorConversationSnapshot:
    title: Optional[str]
    messages: tuple[SnapshotMessage, ...]
    conversation_summary: Optional[str]
    char_count: int
    truncated: bool


def _clean_text(text: str, *, max_chars: int) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "").strip())
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[: max_chars - 1].rstrip() + "…"


def _dedupe_keep_order(texts: Sequence[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in texts:
        key = re.sub(r"\s+", " ", raw.strip().lower())
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(raw.strip())
    return out


def _is_private_field_name(name: str) -> bool:
    return bool(_PRIVATE_KEY_RE.search(name or ""))


def build_mirror_conversation_snapshot(
    *,
    title: Optional[str] = None,
    user_messages: Sequence[str] | None = None,
    assistant_messages: Sequence[str] | None = None,
    conversation_summary: Optional[str] = None,
    max_chars: int = DEFAULT_MAX_SNAPSHOT_CHARS,
    include_assistant: bool = False,
) -> MirrorConversationSnapshot:
    """
    Build a bounded snapshot for meaning analysis.

    - Prefer user messages (head + recent tail + longer/meaningful mid picks).
    - Assistant snippets only when include_assistant=True and budget remains.
    - Never accepts nested archive objects — callers pass plain strings only.
    """
    users = _dedupe_keep_order(
        [_clean_text(m, max_chars=MAX_USER_MESSAGE_CHARS) for m in (user_messages or []) if m and str(m).strip()]
    )
    assistants = _dedupe_keep_order(
        [
            _clean_text(m, max_chars=MAX_ASSISTANT_SNIPPET_CHARS)
            for m in (assistant_messages or [])
            if m and str(m).strip()
        ]
    ) if include_assistant else []

    safe_title = _clean_text(title, max_chars=120) if title else None
    if safe_title and _is_private_field_name(safe_title):
        safe_title = None

    safe_summary = (
        _clean_text(conversation_summary, max_chars=400) if conversation_summary else None
    )

    selected_users = _select_user_messages(users)
    messages: list[SnapshotMessage] = [SnapshotMessage(role="user", text=t) for t in selected_users]

    # Budget accounting
    def _count() -> int:
        n = len(safe_title or "") + len(safe_summary or "")
        for m in messages:
            n += len(m.text) + 8
        return n

    truncated = len(users) > len(selected_users)

    if include_assistant and assistants and _count() < max_chars:
        # Keep at most 2 short assistant snippets near the end for context.
        for snippet in assistants[-2:]:
            if _count() + len(snippet) + 12 > max_chars:
                truncated = True
                break
            messages.append(SnapshotMessage(role="assistant", text=snippet))

    # Hard trim from the middle of user block if still over budget
    while _count() > max_chars and len(messages) > 2:
        # Drop earliest non-head user message after the first two
        drop_idx = None
        for i, m in enumerate(messages):
            if m.role == "user" and i >= 2:
                drop_idx = i
                break
        if drop_idx is None:
            break
        messages.pop(drop_idx)
        truncated = True

    if _count() > max_chars and safe_summary:
        safe_summary = None
        truncated = True

    return MirrorConversationSnapshot(
        title=safe_title,
        messages=tuple(messages),
        conversation_summary=safe_summary,
        char_count=_count(),
        truncated=truncated,
    )


def _select_user_messages(users: list[str]) -> list[str]:
    if len(users) <= HEAD_USER_KEEP + TAIL_USER_KEEP:
        return users

    head = users[:HEAD_USER_KEEP]
    tail = users[-TAIL_USER_KEEP:]
    middle = users[HEAD_USER_KEEP : -TAIL_USER_KEEP]

    # Prefer longer / question-like middle messages as "meaningful"
    scored = sorted(
        middle,
        key=lambda t: (
            1 if "?" in t or "？" in t else 0,
            1 if len(t) >= 40 else 0,
            len(t),
        ),
        reverse=True,
    )
    mid_pick = scored[:3]

    # Preserve chronological order
    chosen = set(head + mid_pick + tail)
    return [u for u in users if u in chosen]


def snapshot_to_model_input(snapshot: MirrorConversationSnapshot) -> dict:
    """JSON-serializable payload for the analysis model — no private metadata."""
    return {
        "title": snapshot.title,
        "conversationSummary": snapshot.conversation_summary,
        "messages": [{"role": m.role, "text": m.text} for m in snapshot.messages],
    }


def assert_snapshot_has_no_private_keys(payload: dict) -> None:
    """Test helper — ensure forbidden keys are absent from model input."""
    forbidden_substrings = (
        "userId",
        "user_id",
        "guestToken",
        "guest_token",
        "apiKey",
        "api_key",
        "authorization",
        "lineageProof",
        "archiveMeta",
        "password",
        "refreshToken",
        "accessToken",
    )

    def _walk(obj: object, path: str = "") -> None:
        if isinstance(obj, dict):
            for k, v in obj.items():
                key = str(k)
                lower_path = f"{path}.{key}".lower()
                for bad in forbidden_substrings:
                    if bad.lower() in key.lower() or bad.lower() in lower_path:
                        raise AssertionError(f"private key leaked into snapshot: {path}.{key}")
                if _is_private_field_name(key):
                    raise AssertionError(f"private field name in snapshot: {path}.{key}")
                _walk(v, f"{path}.{key}")
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                _walk(item, f"{path}[{i}]")

    _walk(payload)
