# -*- coding: utf-8 -*-
"""
Pipeline Response Schemas
Unified response format for all EZA pipeline modes
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal


class PipelineError(BaseModel):
    """Error information in pipeline response"""
    error_code: str
    error_message: str
    provider: Optional[str] = None
    retryable: Optional[bool] = None


class PipelineResponse(BaseModel):
    """Unified pipeline response format"""
    ok: bool = Field(..., description="Whether the pipeline executed successfully")
    mode: Literal["standalone", "proxy", "proxy-lite"] = Field(..., description="Pipeline mode")
    eza_score: Optional[float] = Field(None, description="EZA Score v2.1 (0-100)")
    eza_score_breakdown: Optional[Dict[str, Any]] = Field(None, description="Detailed EZA score breakdown")
    data: Optional[Dict[str, Any]] = Field(None, description="Mode-specific response data")
    error: Optional[PipelineError] = Field(None, description="Error information if ok=False")


class StandaloneRequest(BaseModel):
    """Request schema for standalone mode"""
    text: str = Field(..., description="User input text", min_length=1)


class ProxyRequest(BaseModel):
    """Request schema for proxy mode"""
    message: str = Field(..., description="User input message", min_length=1)
    model: Optional[str] = Field("gpt-4o-mini", description="LLM model to use")
    depth: Literal["fast", "deep"] = Field("fast", description="Analysis depth")


class ProxyLiteRequest(BaseModel):
    """Request schema for proxy-lite mode"""
    message: str = Field(..., description="User input message", min_length=1)
    output_text: Optional[str] = Field(None, description="Pre-analyzed output text (optional)")

