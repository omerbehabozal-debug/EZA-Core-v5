# -*- coding: utf-8 -*-
"""Sanitize client-supplied Director metadata before private_payload persist."""

from __future__ import annotations

import logging
from typing import Any, Mapping, Optional

from pydantic import ValidationError

from backend.core.schemas.mirror_director_metadata import MirrorDirectorMetadata

logger = logging.getLogger(__name__)


def extract_raw_mirror_director(intelligence_private: Mapping[str, Any] | None) -> Any:
    """Pull mirrorDirector from nested or flat intelligencePrivate shapes."""
    if not intelligence_private:
        return None
    brief = intelligence_private.get("intelligenceBrief")
    if isinstance(brief, Mapping):
        nested = brief.get("mirrorDirector")
        if nested is not None:
            return nested
    flat = intelligence_private.get("mirrorDirector")
    if flat is not None:
        return flat
    return None


def sanitize_mirror_director_metadata(raw: Any) -> Optional[dict[str, Any]]:
    """
    Backend authority: coerce + validate allowlist; drop everything else.

    Returns None when input is missing/invalid (publish continues without director blob).
    Extra fields are rejected from persistence (not written), not from the HTTP publish.
    """
    if raw is None:
        return None
    if not isinstance(raw, Mapping):
        logger.warning("mirror_director_metadata_rejected reason=not_object")
        return None

    candidate: dict[str, Any] = {}
    for field in MirrorDirectorMetadata.model_fields:
        if field in raw and raw[field] is not None:
            candidate[field] = raw[field]

    if "reasonCodes" not in candidate and raw.get("directorReasonCodes") is not None:
        candidate["reasonCodes"] = raw["directorReasonCodes"]

    if "confidence" not in candidate:
        for alias in ("directorConfidence", "analysisConfidence", "draftConfidence"):
            if raw.get(alias) is not None:
                candidate["confidence"] = raw[alias]
                break

    if "latency" not in candidate:
        for alias in ("totalDirectorDurationMs", "draftDurationMs", "reviewDurationMs"):
            if raw.get(alias) is not None:
                candidate["latency"] = raw[alias]
                break

    try:
        model = MirrorDirectorMetadata.model_validate(candidate)
    except ValidationError as exc:
        logger.warning(
            "mirror_director_metadata_rejected reason=validation_error detail=%s",
            exc.error_count(),
        )
        return None

    dumped = model.model_dump(exclude_none=True)
    if "reasonCodes" not in dumped:
        dumped["reasonCodes"] = []
    return dumped


def sanitize_intelligence_private_for_persist(
    intelligence_private: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """
    Rebuild intelligencePrivate for private_payload construction.

    Keeps existing non-director private fields; replaces mirrorDirector with
    backend-validated allowlist only. Extra client keys are dropped.
    """
    src = dict(intelligence_private or {})
    out: dict[str, Any] = {}

    for key in ("mirrorBody", "topicSummary", "evidenceLabels", "behavioralSnapshot"):
        if key in src and src[key] is not None:
            out[key] = src[key]

    sanitized = sanitize_mirror_director_metadata(extract_raw_mirror_director(src))
    if sanitized:
        out["intelligenceBrief"] = {"mirrorDirector": sanitized}
    return out
