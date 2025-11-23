# -*- coding: utf-8 -*-
"""
Standalone Mode Schemas
Minimal production-ready response format
"""

from pydantic import BaseModel
from typing import Literal


class StandaloneChatRequest(BaseModel):
    text: str


class StandaloneChatResponse(BaseModel):
    answer: str
    safety: Literal["Safe", "Warning", "Blocked"]
    confidence: float = 0.95
