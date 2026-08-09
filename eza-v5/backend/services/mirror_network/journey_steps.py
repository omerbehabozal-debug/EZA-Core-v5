# -*- coding: utf-8 -*-
"""Persist frozen Review 8 steps for a journey version (publish-time only)."""

from __future__ import annotations

import hashlib
from typing import Any, Mapping, Sequence
from uuid import uuid4

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import MirrorJourneyStep
from backend.services.mirror.journey_window_hashes import (
    compute_answer_hash,
    compute_question_hash,
)


def _text_hash(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


async def replace_journey_steps_for_version(
    db: AsyncSession,
    *,
    journey_slug: str,
    journey_version: int,
    steps: Sequence[Mapping[str, Any]],
    original_hashes: Sequence[Mapping[str, str]] | None = None,
) -> None:
    """Replace all steps for (slug, version). Caller must already validate length/shape."""
    slug = (journey_slug or "").strip().lower()
    version = int(journey_version or 1)
    if not slug:
        return

    await db.execute(
        delete(MirrorJourneyStep).where(
            MirrorJourneyStep.journey_slug == slug,
            MirrorJourneyStep.journey_version == version,
        )
    )
    for i, row in enumerate(steps):
        step_index = int(row.get("stepIndex") if row.get("stepIndex") is not None else row["index"])
        question = str(row["publicQuestion"])
        answer = str(row["publicAnswer"])
        user_id = str(
            row.get("sourceUserMessageId") or row.get("userMessageId") or ""
        ) or None
        assistant_id = str(
            row.get("sourceAssistantMessageId") or row.get("assistantMessageId") or ""
        ) or None
        source_order = row.get("sourceOrder")
        q_hash = str(row.get("questionHash") or "") or compute_question_hash(question)
        a_hash = str(row.get("answerHash") or "") or compute_answer_hash(answer)
        flags = row.get("sanitizationFlags")
        if not isinstance(flags, list):
            flags = None
        orig = None
        if original_hashes and i < len(original_hashes):
            orig = original_hashes[i]
        sanitization_payload = None
        if flags or orig:
            sanitization_payload = {
                "flags": flags or [],
                "originalQuestionHash": (orig or {}).get("questionHash"),
                "originalAnswerHash": (orig or {}).get("answerHash"),
                "publicQuestionHash": q_hash,
                "publicAnswerHash": a_hash,
            }
        db.add(
            MirrorJourneyStep(
                id=uuid4(),
                journey_slug=slug,
                journey_version=version,
                step_index=step_index,
                source_order=int(source_order) if source_order is not None else None,
                source_user_message_id=user_id,
                source_assistant_message_id=assistant_id,
                public_question=question,
                public_answer=answer,
                question_hash=q_hash or _text_hash(question),
                answer_hash=a_hash or _text_hash(answer),
                sanitization_flags=sanitization_payload,
            )
        )
    await db.commit()
