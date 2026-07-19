# -*- coding: utf-8 -*-
"""Deterministic content hash for Mirror Director idempotency (PR B prep / PR C cache)."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping

from backend.services.mirror.conversation_snapshot import (
    MirrorConversationSnapshot,
    snapshot_to_model_input,
)

HASH_FEATURE_LABEL = "mirror-director-pipeline-v1"


def build_mirror_director_content_hash(
    snapshot: MirrorConversationSnapshot,
    *,
    analysis_schema_version: str = "mirror-director-v1",
    draft_schema_version: str = "mirror-draft-v1",
    review_schema_version: str = "mirror-director-review-v1",
    feature_config: Mapping[str, Any] | None = None,
) -> str:
    """
    Deterministic hash over normalized bounded snapshot + schema versions + feature config.
    Does not embed raw unbounded conversation; uses snapshot_to_model_input only.
    """
    payload = {
        "snapshot": snapshot_to_model_input(snapshot),
        "analysisSchemaVersion": analysis_schema_version,
        "draftSchemaVersion": draft_schema_version,
        "reviewSchemaVersion": review_schema_version,
        "feature": feature_config or {"pipeline": HASH_FEATURE_LABEL},
        "truncated": snapshot.truncated,
        "charCount": snapshot.char_count,
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
