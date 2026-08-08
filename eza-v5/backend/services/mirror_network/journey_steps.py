# -*- coding: utf-8 -*-
"""Persist frozen Review 8 steps for a journey version (publish-time only)."""

from __future__ import annotations

from typing import Any, Mapping, Sequence
from uuid import uuid4

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import MirrorJourneyStep


async def replace_journey_steps_for_version(
    db: AsyncSession,
    *,
    journey_slug: str,
    journey_version: int,
    steps: Sequence[Mapping[str, Any]],
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
    for row in steps:
        db.add(
            MirrorJourneyStep(
                id=uuid4(),
                journey_slug=slug,
                journey_version=version,
                step_index=int(row["index"]),
                source_user_message_id=str(row.get("userMessageId") or "") or None,
                source_assistant_message_id=str(row.get("assistantMessageId") or "")
                or None,
                public_question=str(row["publicQuestion"]),
                public_answer=str(row["publicAnswer"]),
            )
        )
    await db.commit()
