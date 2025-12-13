# -*- coding: utf-8 -*-
"""
Pipeline Response Schemas
Unified response format for all EZA pipeline modes
"""

from pydantic import BaseModel, Field, model_validator
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
    policy_violations: Optional[list] = Field(None, description="List of policy violations detected")
    risk_level: Optional[str] = Field(None, description="Risk level: low, medium, high")
    data: Optional[Dict[str, Any]] = Field(None, description="Mode-specific response data")
    error: Optional[PipelineError] = Field(None, description="Error information if ok=False")


class StandaloneRequest(BaseModel):
    """Request schema for standalone mode"""
    query: Optional[str] = Field(None, description="User input query", min_length=1)
    text: Optional[str] = Field(None, description="User input text (deprecated, use query)", min_length=1)
    safe_only: Optional[bool] = Field(False, description="Enable SAFE-only mode (rewrite enabled, scores hidden)")
    
    @model_validator(mode='before')
    @classmethod
    def validate_query_or_text(cls, data: Any) -> Any:
        """Validate that either query or text is provided"""
        if isinstance(data, dict):
            if not data.get('query') and not data.get('text'):
                raise ValueError("Either 'query' or 'text' parameter is required")
        return data
    
    @property
    def query_value(self) -> str:
        """Get query value from either 'query' or 'text' field"""
        return self.query or self.text or ""


class ProxyRequest(BaseModel):
    """Request schema for proxy mode"""
    message: str = Field(..., description="User input message", min_length=1)
    model: Optional[str] = Field("gpt-4o-mini", description="LLM model to use")
    depth: Literal["fast", "deep"] = Field("fast", description="Analysis depth")


class ProxyLiteRequest(BaseModel):
    """Request schema for proxy-lite mode"""
    message: str = Field(..., description="User input message", min_length=1)
    output_text: Optional[str] = Field(None, description="Pre-analyzed output text (optional)")

