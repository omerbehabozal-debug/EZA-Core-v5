# -*- coding: utf-8 -*-
"""Backend-owned Mirror Director persist contract (production hardening).

Only this allowlist may be written under private_payload.intelligenceBrief.mirrorDirector.
Raw conversation, snapshot, prompt, provider response, evidence, tokens, and internal IDs
are forbidden.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class MirrorDirectorMetadata(BaseModel):
    """PII-safe Director metadata persisted on Mirror Network private_payload."""

    model_config = ConfigDict(extra="forbid")

    directorMode: Optional[str] = None
    directorExecuted: Optional[bool] = None
    directorAffectedOutput: Optional[bool] = None
    draftSource: Optional[str] = None
    titleSource: Optional[str] = None
    promptSource: Optional[str] = None
    directorDecision: Optional[str] = None
    revisionCount: Optional[int] = Field(default=None, ge=0, le=1)
    fallbackReason: Optional[str] = None
    contentHash: Optional[str] = None
    reasonCodes: List[str] = Field(default_factory=list)
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    latency: Optional[int] = Field(default=None, ge=0)
    analysisSchemaVersion: Optional[str] = None
    draftSchemaVersion: Optional[str] = None
    reviewSchemaVersion: Optional[str] = None
    draftModel: Optional[str] = None
    reviewModel: Optional[str] = None
