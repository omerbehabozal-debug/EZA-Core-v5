# -*- coding: utf-8 -*-
"""Server-authoritative Journey window hashes (Phase 3.5).

Algorithms mirror the client Review 8 / scopedJourneyMeaning fingerprints so
client-supplied values can be compared for debugging — server values are authority.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping, Sequence


def _fnv1a32_hex(payload: str) -> str:
    """Match frontend computeReview8SnapshotHash (FNV-1a 32-bit)."""
    hash_ = 2166136261
    for ch in payload:
        hash_ ^= ord(ch)
        hash_ = (hash_ * 16777619) & 0xFFFFFFFF
    return format(hash_, "x")


def _djb2_hex(payload: str) -> str:
    """Match frontend djb2Hex (unsigned 32-bit, zero-padded 8 hex)."""
    hash_ = 5381
    for ch in payload:
        hash_ = ((hash_ * 33) ^ ord(ch)) & 0xFFFFFFFF
    return format(hash_, "x").zfill(8)


def text_sha256(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def compute_question_hash(question: str) -> str:
    return text_sha256(question)


def compute_answer_hash(answer: str) -> str:
    return text_sha256(answer)


def compute_window_hash(steps: Sequence[Mapping[str, Any]]) -> str:
    """
    windowHash = h{fnv32} over:
      stepIndex|sourceUserMessageId|sourceAssistantMessageId|publicQuestion|publicAnswer
    (aligned with frontend computeReview8SnapshotHash using index/user/assistant ids).
    """
    lines: list[str] = []
    for step in steps:
        idx = step.get("stepIndex", step.get("index"))
        user_id = step.get("sourceUserMessageId") or step.get("userMessageId") or ""
        asst_id = (
            step.get("sourceAssistantMessageId") or step.get("assistantMessageId") or ""
        )
        q = str(step.get("publicQuestion") or "")
        a = str(step.get("publicAnswer") or "")
        lines.append(f"{idx}|{user_id}|{asst_id}|{q}|{a}")
    return f"h{_fnv1a32_hex(chr(10).join(lines))}"


def compute_selected_steps_hash(steps: Sequence[Mapping[str, Any]]) -> str:
    """Canonical SHA-256 of normalized selected step public package."""
    rows = []
    for step in steps:
        rows.append(
            {
                "stepIndex": int(step.get("stepIndex", step.get("index") or 0)),
                "sourceOrder": int(step.get("sourceOrder") or 0),
                "sourceUserMessageId": str(
                    step.get("sourceUserMessageId") or step.get("userMessageId") or ""
                ),
                "sourceAssistantMessageId": str(
                    step.get("sourceAssistantMessageId")
                    or step.get("assistantMessageId")
                    or ""
                ),
                "publicQuestion": str(step.get("publicQuestion") or ""),
                "publicAnswer": str(step.get("publicAnswer") or ""),
                "questionHash": compute_question_hash(str(step.get("publicQuestion") or "")),
                "answerHash": compute_answer_hash(str(step.get("publicAnswer") or "")),
            }
        )
    payload = json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return f"t{text_sha256(payload)[:32]}"


def compute_scoped_input_hash(
    *,
    journey_id: str,
    journey_version: int,
    source_conversation_id: str,
    window_index: int,
    window_start: int,
    window_end: int,
    steps: Sequence[Mapping[str, Any]],
    semantic_scope: str = "journey_window_v1",
) -> str:
    """Match frontend computeScopedJourneyInputHash."""
    step_lines: list[str] = []
    for step in steps:
        idx = step.get("stepIndex", step.get("index"))
        source_order = step.get("sourceOrder")
        user_id = step.get("sourceUserMessageId") or step.get("userMessageId") or ""
        asst_id = (
            step.get("sourceAssistantMessageId") or step.get("assistantMessageId") or ""
        )
        q = str(step.get("publicQuestion") or "")
        a = str(step.get("publicAnswer") or "")
        step_lines.append(f"{idx}|{source_order}|{user_id}|{asst_id}|{q}|{a}")
    payload = "\n".join(
        [
            semantic_scope,
            str(journey_id or "").strip(),
            str(int(journey_version or 1)),
            str(source_conversation_id or "").strip(),
            str(int(window_index)),
            str(int(window_start)),
            str(int(window_end)),
            "\n".join(step_lines),
        ]
    )
    return f"s{_djb2_hex(payload)}"


def attach_step_content_hashes(
    steps: Sequence[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for step in steps:
        row = dict(step)
        q = str(row.get("publicQuestion") or "")
        a = str(row.get("publicAnswer") or "")
        row["questionHash"] = compute_question_hash(q)
        row["answerHash"] = compute_answer_hash(a)
        out.append(row)
    return out
