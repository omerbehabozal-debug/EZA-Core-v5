# -*- coding: utf-8 -*-
"""Schemas for Narrative Alignment Phase 1 image claim detection."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class MirrorDetectImageClaimsRequest(BaseModel):
    sceneImageUrl: str = Field(..., min_length=8, max_length=4000)
    generationId: Optional[str] = Field(default=None, max_length=128)

    @field_validator("sceneImageUrl")
    @classmethod
    def _url_or_data(cls, value: str) -> str:
        v = (value or "").strip()
        if not v:
            raise ValueError("sceneImageUrl required")
        if v.startswith("data:image/") or v.startswith("https://") or v.startswith("http://"):
            return v
        raise ValueError("sceneImageUrl must be http(s) or data:image")


class MirrorDetectedClaim(BaseModel):
    type: str = Field(..., min_length=1, max_length=40)
    value: str = Field(..., min_length=1, max_length=80)


class MirrorDetectImageClaimsResponse(BaseModel):
    detectedClaims: List[MirrorDetectedClaim] = Field(default_factory=list)
    source: Literal["vision_api", "unavailable", "injected"] = "vision_api"
    generationId: Optional[str] = None
