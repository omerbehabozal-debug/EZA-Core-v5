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


class MirrorGenerateSceneResponse(BaseModel):
    sceneImageUrl: str
    provider: Literal["mock", "openai", "replicate", "stability"]
    cached: bool = False
    generatedAt: str
