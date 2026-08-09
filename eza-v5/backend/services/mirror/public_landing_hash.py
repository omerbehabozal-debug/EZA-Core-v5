# -*- coding: utf-8 -*-
"""Canonical PublicMirrorLanding hash — matches frontend hashPublicMirrorLanding."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping


def compute_public_landing_hash(landing: Mapping[str, Any] | None) -> str:
    """
    SHA-256 of JSON.stringify-equivalent payload (frontend order, no sort_keys):
      publicTitle, publicSummary, continuationContext, contractVersion
    """
    row = landing if isinstance(landing, Mapping) else {}
    payload = {
        "publicTitle": str(row.get("publicTitle") or row.get("public_title") or ""),
        "publicSummary": str(row.get("publicSummary") or row.get("public_summary") or ""),
        "continuationContext": str(
            row.get("continuationContext") or row.get("continuation_context") or ""
        ),
        "contractVersion": str(
            row.get("contractVersion") or row.get("contract_version") or ""
        ),
    }
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def extract_public_landing_from_curiosity(
    curiosity_bundle: Mapping[str, Any] | None,
) -> dict[str, Any]:
    bundle = curiosity_bundle if isinstance(curiosity_bundle, Mapping) else {}
    landing = bundle.get("publicLanding") or bundle.get("public_landing")
    if not isinstance(landing, Mapping):
        landing = {}
    return {
        "publicTitle": str(landing.get("publicTitle") or landing.get("public_title") or ""),
        "publicSummary": str(
            landing.get("publicSummary") or landing.get("public_summary") or ""
        ),
        "continuationContext": str(
            landing.get("continuationContext")
            or landing.get("continuation_context")
            or ""
        ),
        "contractVersion": str(
            landing.get("contractVersion") or landing.get("contract_version") or ""
        ),
        "semanticSource": str(
            landing.get("semanticSource")
            or landing.get("semantic_source")
            or bundle.get("semanticSource")
            or ""
        ),
    }
