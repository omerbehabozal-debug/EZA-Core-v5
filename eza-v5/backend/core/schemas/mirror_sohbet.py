# -*- coding: utf-8 -*-
"""Mirror sohbet session API (Stage 2B) — internal seed session; UI says Sohbet only."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class MirrorThoughtCard(BaseModel):
    id: str
    label: str


class PublicReplaySelection(BaseModel):
    """References only; the server supplies the public text, never the client."""
    model_config = ConfigDict(extra="forbid")
    slug: str = Field(min_length=1, max_length=64, pattern=r"^[a-z0-9][a-z0-9-]*$")
    journeyVersion: int = Field(ge=1, strict=True)
    completedStepCount: int = Field(ge=0, le=8, strict=True)


class MirrorSohbetSessionRequest(BaseModel):
    guestToken: Optional[str] = None
    replaySelection: Optional[PublicReplaySelection] = None


class MirrorSohbetSessionResponse(BaseModel):
    sessionId: str
    guestToken: str
    mirrorSlug: str
    cardTitle: str
    openingMessage: str
    thoughtCards: List[MirrorThoughtCard] = Field(default_factory=list)
    expiresAt: str
    # Guest conversation metadata (internal API names — never shown as "seed" in UI)
    parentMirrorId: str
    rootMirrorId: str
    seedTopic: str
    seedCategory: str
    seedMood: str
    lineageProofToken: Optional[str] = None
    sceneImageUrl: Optional[str] = None
    publicReplayContext: Optional[dict] = None
