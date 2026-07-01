#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Purge expired experience_events rows (TTL / expires_at).

Usage (from repository eza-v5 root):
  cd eza-v5
  python -m backend.scripts.purge_experience_events

Cron example (daily 03:15 UTC):
  15 3 * * * cd /app/eza-v5 && python -m backend.scripts.purge_experience_events
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

# eza-v5 on sys.path so `backend.*` imports resolve (same as main.py).
_EZA_V5_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_EZA_V5_ROOT) not in sys.path:
    sys.path.insert(0, str(_EZA_V5_ROOT))

from backend.core.observation.purge_experience_events import purge_expired_experience_events
from backend.core.utils.dependencies import AsyncSessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_purge() -> int:
    async with AsyncSessionLocal() as db:
        deleted = await purge_expired_experience_events(db)
    logger.info("Purged %s expired experience_events row(s)", deleted)
    return 0


def main() -> int:
    try:
        return asyncio.run(run_purge())
    except Exception as exc:
        logger.error("purge_experience_events failed: %s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
