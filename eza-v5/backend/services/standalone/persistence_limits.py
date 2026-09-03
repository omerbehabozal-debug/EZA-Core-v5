# -*- coding: utf-8 -*-
"""Bounded persistence limits — Phase 8.8G-1.1."""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

# String field limits (aligned with DB columns / UI scale)
MAX_CLIENT_ID_LENGTH = 64
MAX_TITLE_LENGTH = 200
MAX_PREVIEW_LENGTH = 500
MAX_SCENE_URL_LENGTH = 2048
MAX_SCENE_SOURCE_LENGTH = 32
MAX_SCENE_SLUG_LENGTH = 120
MAX_SOURCE_YANSI_SLUG_LENGTH = 120
MAX_MESSAGE_CONTENT_LENGTH = 32_000

# Phase 8.8G-4 — unpublished Yansı preparation bounds
MAX_YANSI_SOURCE_IDENTITY_LENGTH = 160
MAX_YANSI_JOURNEY_ID_LENGTH = 64
MAX_YANSI_HASH_LENGTH = 128
MAX_YANSI_GENERATION_ID_LENGTH = 128
MAX_YANSI_SUMMARY_LENGTH = 2000
MAX_YANSI_CONTINUATION_LENGTH = 2000
MAX_YANSI_QA_ITEMS = 8
MIN_YANSI_QA_ITEMS = 6
MAX_YANSI_QA_TEXT_LENGTH = 4_000
MAX_YANSI_LINEAGE_JSON_BYTES = 65_536
MAX_YANSI_LANDING_JSON_BYTES = 16_384


# Structured metadata bounds
MAX_METADATA_JSON_BYTES = 8_192
MAX_METADATA_DEPTH = 8


def validate_bounded_json(
    value: dict[str, Any] | None,
    *,
    field_name: str,
    max_bytes: int = MAX_METADATA_JSON_BYTES,
    max_depth: int = MAX_METADATA_DEPTH,
) -> None:
    """Reject oversized or excessively nested JSON metadata."""
    if value is None:
        return

    depth = _json_depth(value)
    if depth > max_depth:
        raise HTTPException(
            status_code=422,
            detail=f"{field_name}_depth_exceeded",
        )

    try:
        encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"invalid_{field_name}") from exc

    if len(encoded.encode("utf-8")) > max_bytes:
        raise HTTPException(
            status_code=422,
            detail=f"{field_name}_size_exceeded",
        )


def _json_depth(value: Any, current: int = 1) -> int:
    if isinstance(value, dict):
        if not value:
            return current
        return max(_json_depth(v, current + 1) for v in value.values())
    if isinstance(value, list):
        if not value:
            return current
        return max(_json_depth(v, current + 1) for v in value)
    return current
