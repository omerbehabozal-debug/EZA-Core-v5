# -*- coding: utf-8 -*-
"""Pydantic schemas for EZA Mirror scene generation API."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class MirrorGenerateSceneRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    negativePrompt: str = Field(default="")
    seedHint: str = Field(..., min_length=1)
    stylePreset: str = Field(..., min_length=1)
    qualityHints: Optional[List[str]] = None
    cardDate: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    conversationId: Optional[str] = Field(default=None, max_length=128)
    generationRequestId: Optional[str] = Field(default=None, min_length=8, max_length=128)
    cardId: Optional[str] = Field(default=None, max_length=128)
    """V5 minimal render contract — backend must not append legacy Avoid/Quality/Style."""
    promptContract: Optional[str] = None


class MirrorGenerateSceneResponse(BaseModel):
    sceneImageUrl: str
    provider: Literal["mock", "openai", "replicate", "stability"]
    cached: bool = False
    generatedAt: str
    # Optional normalized focal (0–1). Omitted → clients use safe center.
    # Not inferred/saved until a real focal pipeline exists.
    focalX: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    focalY: Optional[float] = Field(default=None, ge=0.0, le=1.0)