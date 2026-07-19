# -*- coding: utf-8 -*-
"""Request-scoped cache for prepare-director-draft (PR C + production hardening).

Entries are keyed by generationRequestId but only returned when directorMode,
contentHash, account/guest scope, and creative-authority contract match.

TTL unchanged (15 minutes).

Cache contract (benchmark fix):
  authority path + interpretation enabled flag + interpretation schema version
  + interpretation→V5 mapper version.

Old envelopes without contractFingerprint are treated as misses (no unsafe migration).
"""

from __future__ import annotations

import threading
import time
from typing import Any

from backend.core.schemas.mirror_interpretation import MIRROR_INTERPRETATION_SCHEMA_VERSION
from backend.services.mirror.mirror_interpretation_to_v5 import (
    MIRROR_INTERPRETATION_TO_V5_MAPPER_VERSION,
)

_LOCK = threading.Lock()
_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_TTL_SECONDS = 15 * 60
_MAX_ENTRIES = 256

# Envelope schema marker — bump if envelope matching fields change.
PREPARE_CACHE_CONTRACT_FORMAT = "prepare-cache-contract-v1"


def _normalize_scope(scope_key: str | None) -> str:
    value = (scope_key or "").strip()
    return value or "anonymous"


def build_prepare_cache_contract_fingerprint(
    *,
    use_interpretation_v1: bool,
    interpretation_version: str | None = None,
    mapper_version: str | None = None,
) -> str:
    """Deterministic, metadata-only cache identity (no conversation content)."""
    if use_interpretation_v1:
        authority_path = "interpretation-v1"
        schema = (interpretation_version or MIRROR_INTERPRETATION_SCHEMA_VERSION).strip()
        mapper = (mapper_version or MIRROR_INTERPRETATION_TO_V5_MAPPER_VERSION).strip()
        enabled = "true"
    else:
        authority_path = "legacy"
        schema = "none"
        mapper = "none"
        enabled = "false"
    return "|".join(
        [
            PREPARE_CACHE_CONTRACT_FORMAT,
            f"authorityPath={authority_path}",
            f"useInterpretationV1={enabled}",
            f"interpretationVersion={schema}",
            f"mapperVersion={mapper}",
        ]
    )


def describe_prepare_cache_contract(fingerprint: str) -> dict[str, str]:
    """Parse fingerprint into telemetry-safe fields (best-effort)."""
    out: dict[str, str] = {"contractFingerprint": fingerprint[:160]}
    for part in fingerprint.split("|"):
        if "=" in part:
            key, value = part.split("=", 1)
            if key in {
                "authorityPath",
                "useInterpretationV1",
                "interpretationVersion",
                "mapperVersion",
            }:
                out[key] = value[:64]
    return out


def cache_get(
    generation_request_id: str,
    *,
    director_mode: str,
    content_hash: str,
    scope_key: str | None,
    contract_fingerprint: str,
) -> dict[str, Any] | None:
    now = time.time()
    scope = _normalize_scope(scope_key)
    with _LOCK:
        item = _CACHE.get(generation_request_id)
        if not item:
            return None
        ts, envelope = item
        if now - ts > _TTL_SECONDS:
            _CACHE.pop(generation_request_id, None)
            return None
        if envelope.get("directorMode") != director_mode:
            return None
        if envelope.get("contentHash") != content_hash:
            return None
        if envelope.get("scopeKey") != scope:
            return None
        # Missing/mismatched authority contract → miss (old entries unreachable).
        if envelope.get("contractFingerprint") != contract_fingerprint:
            return None
        payload = envelope.get("payload")
        if not isinstance(payload, dict):
            return None
        return dict(payload)


def cache_set(
    generation_request_id: str,
    payload: dict[str, Any],
    *,
    director_mode: str,
    content_hash: str,
    scope_key: str | None,
    contract_fingerprint: str,
) -> None:
    scope = _normalize_scope(scope_key)
    envelope = {
        "directorMode": director_mode,
        "contentHash": content_hash,
        "scopeKey": scope,
        "contractFingerprint": contract_fingerprint,
        "payload": dict(payload),
    }
    with _LOCK:
        if len(_CACHE) >= _MAX_ENTRIES:
            oldest = sorted(_CACHE.items(), key=lambda kv: kv[1][0])[:64]
            for key, _ in oldest:
                _CACHE.pop(key, None)
        _CACHE[generation_request_id] = (time.time(), envelope)


def cache_clear_for_tests() -> None:
    with _LOCK:
        _CACHE.clear()
