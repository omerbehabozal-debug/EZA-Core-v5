# -*- coding: utf-8 -*-
"""PII-safe Mirror Director telemetry (PR C). No raw conversation/prompts."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("eza.mirror.director")


def emit_director_event(event: str, **fields: Any) -> None:
    safe = {k: v for k, v in fields.items() if v is not None}
    # Never accept these keys even if passed by mistake
    for banned in ("conversation", "prompt", "messages", "raw", "providerResponse", "snapshot"):
        safe.pop(banned, None)
    logger.info("mirror_director_event event=%s fields=%s", event, safe)
