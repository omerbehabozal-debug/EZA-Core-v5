# -*- coding: utf-8 -*-
"""Mirror sohbet session API (Stage 2B) — internal seed session; UI says Sohbet only."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class MirrorThoughtCard(BaseModel):
    id: str
    label: str


class MirrorSohbetSessionRequest(BaseModel):
    guestToken: Optional[str] = None


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
