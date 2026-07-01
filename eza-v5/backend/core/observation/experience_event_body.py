# -*- coding: utf-8 -*-
"""EZA Observation — enforced request body size limits."""

from __future__ import annotations

from fastapi import Request

from backend.config import get_settings


class ExperienceBodyTooLarge(Exception):
    """Raised when request body exceeds configured byte limit."""


async def read_limited_experience_body(request: Request) -> bytes:
    """
    Read the full request body with a hard byte cap.

    Does not trust Content-Length; works for chunked transfers.
    """
    max_bytes = int(get_settings().EXPERIENCE_EVENT_MAX_BODY_BYTES or 4096)
    received = 0
    chunks: list[bytes] = []

    async for chunk in request.stream():
        received += len(chunk)
        if received > max_bytes:
            raise ExperienceBodyTooLarge()
        chunks.append(chunk)

    return b"".join(chunks)
