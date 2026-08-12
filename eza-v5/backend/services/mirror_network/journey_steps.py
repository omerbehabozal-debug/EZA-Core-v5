# -*- coding: utf-8 -*-
"""Persist frozen Review 8 steps for a journey version (publish-time only)."""

from __future__ import annotations

import hashlib
from typing import Any, Mapping, Sequence
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import MirrorJourneyStep
from backend.services.mirror.journey_window_hashes import (
    compute_answer_hash,
    compute_question_hash,
)
from backend.services.mirror_network.frozen_step_eza import (
    assert_eza_bound_to_assistant,
    normalize_frozen_step_eza_snapshot,
)


def _text_hash(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


async def get_lineage_selected_steps_hash_for_version(
    db: AsyncSession,
    *,
    journey_slug: str,
    journey_version: int,
) -> str | None:
    """Return previously stored authoritative selectedStepsHash for (slug, version)."""
    slug = (journey_slug or "").strip().lower()
    version = int(journey_version or 1)
    if not slug:
        return None
    result = await db.execute(
        select(MirrorJourneyStep)
        .where(
            MirrorJourneyStep.journey_slug == slug,
            MirrorJourneyStep.journey_version == version,
        )
        .order_by(MirrorJourneyStep.step_index.asc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    flags = getattr(row, "sanitization_flags", None)
    if isinstance(flags, Mapping):
        stored = str(flags.get("lineageSelectedStepsHash") or "").strip()
        if stored:
            return stored
    return None


async def replace_journey_steps_for_version(
    db: AsyncSession,
    *,
    journey_slug: str,
    journey_version: int,
    steps: Sequence[Mapping[str, Any]],
    original_hashes: Sequence[Mapping[str, str]] | None = None,
    selected_steps_hash: str | None = None,
    require_selected_steps_hash: bool = True,
    commit: bool = True,
) -> None:
    """Replace all steps for (slug, version). Caller must already validate length/shape.

    Journey V1: selected_steps_hash is mandatory. Same-version replace is allowed
    only when the incoming authoritative selectedStepsHash matches the previously
    stored lineage hash (idempotent retry).
    """
    slug = (journey_slug or "").strip().lower()
    version = int(journey_version or 1)
    if not slug:
        return

    incoming_hash = str(selected_steps_hash or "").strip() or None
    if require_selected_steps_hash and not incoming_hash:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "journey_publish_lineage_mismatch",
                "reason": "steps_hash_mismatch",
                "message": "selectedStepsHash is required for Journey V1 step writes",
            },
        )
    existing_hash = await get_lineage_selected_steps_hash_for_version(
        db, journey_slug=slug, journey_version=version
    )
    if existing_hash and incoming_hash and existing_hash != incoming_hash:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "journey_publish_lineage_mismatch",
                "reason": "steps_hash_mismatch",
                "message": (
                    "Same journeyVersion cannot replace steps with a different "
                    "selectedStepsHash"
                ),
            },
        )
    if existing_hash and not incoming_hash:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "journey_publish_lineage_mismatch",
                "reason": "steps_hash_mismatch",
                "message": "Cannot replace existing Journey steps without selectedStepsHash",
            },
        )

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
        if flags or orig or incoming_hash:
            sanitization_payload = {
                "flags": flags or [],
                "originalQuestionHash": (orig or {}).get("questionHash"),
                "originalAnswerHash": (orig or {}).get("answerHash"),
                "publicQuestionHash": q_hash,
                "publicAnswerHash": a_hash,
            }
            if incoming_hash:
                sanitization_payload["lineageSelectedStepsHash"] = incoming_hash
        eza_raw = row.get("ezaSnapshot") or row.get("eza_snapshot")
        eza_norm = normalize_frozen_step_eza_snapshot(
            eza_raw if isinstance(eza_raw, Mapping) else None,
            source_assistant_message_id=assistant_id,
            source_user_message_id=user_id,
        )
        assert_eza_bound_to_assistant(
            snapshot=eza_norm,
            source_assistant_message_id=assistant_id or "",
        )
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
                eza_snapshot=eza_norm,
            )
        )
    if commit:
        await db.commit()
    else:
        await db.flush()
