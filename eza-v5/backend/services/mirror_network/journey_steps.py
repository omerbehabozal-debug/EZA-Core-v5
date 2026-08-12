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
    compute_frozen_eza_snapshots_hash,
    prove_and_normalize_frozen_step_eza_snapshot,
    snapshots_equal_for_immutability,
)


def _text_hash(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def _lineage_hash_from_flags(flags: Any) -> str | None:
    if isinstance(flags, Mapping):
        stored = str(flags.get("lineageSelectedStepsHash") or "").strip()
        if stored:
            return stored
    return None


def _eza_hash_from_flags(flags: Any) -> str | None:
    if isinstance(flags, Mapping):
        stored = str(flags.get("lineageFrozenEzaSnapshotsHash") or "").strip()
        if stored:
            return stored
    return None


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
    return _lineage_hash_from_flags(getattr(row, "sanitization_flags", None))


async def list_existing_steps_for_version(
    db: AsyncSession,
    *,
    journey_slug: str,
    journey_version: int,
) -> list[MirrorJourneyStep]:
    slug = (journey_slug or "").strip().lower()
    version = int(journey_version or 1)
    if not slug:
        return []
    result = await db.execute(
        select(MirrorJourneyStep)
        .where(
            MirrorJourneyStep.journey_slug == slug,
            MirrorJourneyStep.journey_version == version,
        )
        .order_by(MirrorJourneyStep.step_index.asc())
    )
    return list(result.scalars().all())


def _existing_steps_as_hash_rows(rows: Sequence[MirrorJourneyStep]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "stepIndex": int(row.step_index),
                "sourceAssistantMessageId": row.source_assistant_message_id,
                "sourceUserMessageId": row.source_user_message_id,
                "ezaSnapshot": getattr(row, "eza_snapshot", None),
            }
        )
    return out


def _raise_eza_immutable() -> None:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "code": "journey_frozen_immutable",
            "reason": "eza_snapshot_mismatch",
            "message": (
                "Frozen journeyVersion cannot change per-step ezaSnapshot content"
            ),
        },
    )


async def replace_journey_steps_for_version(
    db: AsyncSession,
    *,
    journey_slug: str,
    journey_version: int,
    steps: Sequence[Mapping[str, Any]],
    original_hashes: Sequence[Mapping[str, str]] | None = None,
    selected_steps_hash: str | None = None,
    frozen_eza_snapshots_hash: str | None = None,
    require_selected_steps_hash: bool = True,
    commit: bool = True,
) -> str:
    """Replace all steps for (slug, version). Caller must already validate length/shape.

    Journey V1: selected_steps_hash is mandatory. Same-version replace is allowed
    only when the incoming authoritative selectedStepsHash matches the previously
    stored lineage hash (idempotent retry).

    Phase 4.3.1: existing frozen version EZA snapshots are immutable — writer
    self-enforces even if called outside publish.

    Returns the computed frozenEzaSnapshotsHash for the written steps.
    """
    slug = (journey_slug or "").strip().lower()
    version = int(journey_version or 1)
    if not slug:
        return ""

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
    existing_rows = await list_existing_steps_for_version(
        db, journey_slug=slug, journey_version=version
    )
    existing_hash = None
    existing_eza_hash = None
    if existing_rows:
        existing_hash = _lineage_hash_from_flags(
            getattr(existing_rows[0], "sanitization_flags", None)
        )
        existing_eza_hash = _eza_hash_from_flags(
            getattr(existing_rows[0], "sanitization_flags", None)
        )
        if not existing_eza_hash:
            existing_eza_hash = compute_frozen_eza_snapshots_hash(
                _existing_steps_as_hash_rows(existing_rows)
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

    # Normalize + prove EZA bindings before mutating rows.
    prepared: list[dict[str, Any]] = []
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
        eza_raw = row.get("ezaSnapshot") or row.get("eza_snapshot")
        eza_norm = prove_and_normalize_frozen_step_eza_snapshot(
            eza_raw if isinstance(eza_raw, Mapping) else None,
            source_assistant_message_id=assistant_id,
            source_user_message_id=user_id,
        )
        assert_eza_bound_to_assistant(
            snapshot=eza_norm,
            source_assistant_message_id=assistant_id or "",
        )
        prepared.append(
            {
                "stepIndex": step_index,
                "question": question,
                "answer": answer,
                "user_id": user_id,
                "assistant_id": assistant_id,
                "source_order": source_order,
                "q_hash": q_hash,
                "a_hash": a_hash,
                "flags": flags,
                "orig": orig,
                "eza_norm": eza_norm,
            }
        )

    hash_rows = [
        {
            "stepIndex": p["stepIndex"],
            "sourceAssistantMessageId": p["assistant_id"],
            "sourceUserMessageId": p["user_id"],
            "ezaSnapshot": p["eza_norm"],
        }
        for p in prepared
    ]
    computed_eza_hash = compute_frozen_eza_snapshots_hash(hash_rows)
    incoming_eza_hash = str(frozen_eza_snapshots_hash or "").strip() or computed_eza_hash
    if incoming_eza_hash != computed_eza_hash:
        _raise_eza_immutable()

    if existing_rows:
        # Self-enforce: same-version EZA content must match persisted freeze.
        if existing_eza_hash and existing_eza_hash != computed_eza_hash:
            _raise_eza_immutable()
        # Per-step compare (covers absent → present mutation).
        existing_by_index = {int(r.step_index): r for r in existing_rows}
        for p in prepared:
            prior = existing_by_index.get(int(p["stepIndex"]))
            if prior is None:
                continue
            if not snapshots_equal_for_immutability(
                getattr(prior, "eza_snapshot", None),
                p["eza_norm"],
            ):
                _raise_eza_immutable()

    await db.execute(
        delete(MirrorJourneyStep).where(
            MirrorJourneyStep.journey_slug == slug,
            MirrorJourneyStep.journey_version == version,
        )
    )
    for p in prepared:
        sanitization_payload = None
        if p["flags"] or p["orig"] or incoming_hash or computed_eza_hash:
            sanitization_payload = {
                "flags": p["flags"] or [],
                "originalQuestionHash": (p["orig"] or {}).get("questionHash"),
                "originalAnswerHash": (p["orig"] or {}).get("answerHash"),
                "publicQuestionHash": p["q_hash"],
                "publicAnswerHash": p["a_hash"],
            }
            if incoming_hash:
                sanitization_payload["lineageSelectedStepsHash"] = incoming_hash
            if computed_eza_hash:
                sanitization_payload["lineageFrozenEzaSnapshotsHash"] = computed_eza_hash
        db.add(
            MirrorJourneyStep(
                id=uuid4(),
                journey_slug=slug,
                journey_version=version,
                step_index=p["stepIndex"],
                source_order=int(p["source_order"]) if p["source_order"] is not None else None,
                source_user_message_id=p["user_id"],
                source_assistant_message_id=p["assistant_id"],
                public_question=p["question"],
                public_answer=p["answer"],
                question_hash=p["q_hash"] or _text_hash(p["question"]),
                answer_hash=p["a_hash"] or _text_hash(p["answer"]),
                sanitization_flags=sanitization_payload,
                eza_snapshot=p["eza_norm"],
            )
        )
    if commit:
        await db.commit()
    else:
        await db.flush()
    return computed_eza_hash
