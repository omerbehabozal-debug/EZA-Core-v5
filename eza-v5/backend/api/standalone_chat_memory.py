# -*- coding: utf-8 -*-
"""
Request-level sliding window memory for Standalone Chat.
History is used for LLM context only — not scoring or safe_rewrite.
"""

from typing import Any, Dict, List, Optional

MAX_HISTORY_MESSAGES = 10
MAX_HISTORY_TOTAL_CHARS = 3200
MAX_MESSAGE_CHARS = 1200


def _truncate_content(content: str, max_chars: int) -> str:
    text = (content or "").strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + "…"


def normalize_history(
    history: Optional[List[Dict[str, Any]]] = None,
    *,
    max_messages: int = MAX_HISTORY_MESSAGES,
    max_total_chars: int = MAX_HISTORY_TOTAL_CHARS,
    max_message_chars: int = MAX_MESSAGE_CHARS,
    current_query: Optional[str] = None,
) -> List[Dict[str, str]]:
    """Validate, dedupe current query, and truncate history oldest-first."""
    if not history:
        return []

    query_stripped = (current_query or "").strip()
    normalized: List[Dict[str, str]] = []

    for item in history:
        role = item.get("role")
        content = _truncate_content(str(item.get("content") or ""), max_message_chars)
        if role not in ("user", "assistant") or not content:
            continue
        normalized.append({"role": role, "content": content})

    if query_stripped and normalized:
        last = normalized[-1]
        if last["role"] == "user" and last["content"].strip() == query_stripped:
            normalized = normalized[:-1]

    if len(normalized) > max_messages:
        normalized = normalized[-max_messages:]

    total = sum(len(m["content"]) for m in normalized)
    while normalized and total > max_total_chars:
        removed = normalized.pop(0)
        total -= len(removed["content"])

    return normalized


def build_standalone_llm_messages(
    query: str,
    history: Optional[List[Dict[str, Any]]] = None,
    **kwargs: Any,
) -> List[Dict[str, str]]:
    """OpenAI-compatible messages: prior turns + current user query."""
    query_stripped = (query or "").strip()
    hist = normalize_history(history, current_query=query_stripped, **kwargs)
    messages = list(hist)
    messages.append({"role": "user", "content": query_stripped})
    return messages


def flatten_history_to_prompt(
    query: str,
    history: Optional[List[Dict[str, Any]]] = None,
    **kwargs: Any,
) -> str:
    """Serialize history for providers that accept a single user prompt."""
    query_stripped = (query or "").strip()
    hist = normalize_history(history, current_query=query_stripped, **kwargs)
    if not hist:
        return query_stripped

    lines = ["Önceki konuşma:"]
    for msg in hist:
        label = "Kullanıcı" if msg["role"] == "user" else "Asistan"
        lines.append(f"{label}: {msg['content']}")
    lines.append("")
    lines.append(f"Şimdiki soru: {query_stripped}")
    return "\n".join(lines)


def serialized_history_text(
    query: str,
    history: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """Concatenate history + query for demo token quota estimation."""
    query_stripped = (query or "").strip()
    hist = normalize_history(history, current_query=query_stripped)
    if not hist:
        return query_stripped
    parts = [m["content"] for m in hist]
    parts.append(query_stripped)
    return "\n".join(parts)
