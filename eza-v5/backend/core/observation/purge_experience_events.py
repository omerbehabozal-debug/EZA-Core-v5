# -*- coding: utf-8 -*-
"""EZA Observation — purge expired experience_events rows."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.experience_event import ExperienceEvent

logger = logging.getLogger(__name__)


async def purge_expired_experience_events(db: AsyncSession) -> int:
    """Delete rows past expires_at. Returns deleted count."""
    now = datetime.now(timezone.utc)
    try:
        result = await db.execute(
            delete(ExperienceEvent).where(ExperienceEvent.expires_at < now)
        )
        await db.commit()
        deleted = int(result.rowcount or 0)
        if deleted:
            logger.info("Purged %s expired experience_events rows", deleted)
        return deleted
    except Exception as exc:
        logger.warning("purge_expired_experience_events failed: %s", exc)
        try:
            await db.rollback()
        except Exception:
            pass
        return 0
