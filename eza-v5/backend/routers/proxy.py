# -*- coding: utf-8 -*-
"""
Proxy Mode Router (Internal Lab)
Fast + Deep selectable
Production-ready with detailed error reporting for EZA team
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Literal
from backend.utils.dependencies import require_internal
from backend.engines.input_analyzer import analyze_input
from backend.engines.model_router import route_model, LLMProviderError
from backend.engines.output_analyzer import analyze_output
from backend.engines.alignment_engine import compute_alignment
from backend.engines.redirect_engine import should_redirect
from backend.engines.score_engine import compute_score
from backend.engines.deception_engine import analyze_deception
from backend.engines.psych_pressure import analyze_psychological_pressure
from backend.engines.safety_graph import build_safety_graph
from backend.engines.drift_detector import detect_drift
from backend.engines.legal_risk import analyze_legal_risk

router = APIRouter()


class ProxyEvalRequest(BaseModel):
    message: str
    model: Optional[str] = "gpt-4"
    depth: Literal["fast", "deep"] = "fast"


class ProxyEvalResponse(BaseModel):
    ok: bool = True
    mode: str
    raw_model_output: Optional[str] = None
    safe_output: Optional[str] = None
    input_analysis: Optional[dict] = None
    output_analysis: Optional[dict] = None
    alignment: Optional[dict] = None
    redirect_summary: Optional[dict] = None
    score_breakdown: Optional[dict] = None
    drift: Optional[dict] = None
    risk_nodes: Optional[dict] = None
    deception: Optional[dict] = None
    psych_pressure: Optional[dict] = None
    legal_risk: Optional[dict] = None
    error: Optional[dict] = None


@router.post("/eval", response_model=ProxyEvalResponse)
async def proxy_eval(
    request: ProxyEvalRequest,
    current_user = Depends(require_internal())
):
    """
    Proxy evaluation endpoint - Internal lab use only
    Returns detailed analysis or error information for EZA team
    """
    mode = f"proxy_{request.depth}"
    
    try:
        # 1. Input analysis
        input_analysis = analyze_input(request.message)
        
        # 2. Get raw model output with error handling
        depth_mode: Literal["fast", "deep"] = request.depth
        try:
            raw_output = await route_model(
                prompt=request.message,
                depth=depth_mode,
                temperature=0.2,
                max_tokens=512 if depth_mode == "fast" else 1024,
                mode=mode,
            )
        except LLMProviderError as e:
            # Return detailed error for EZA team
            return ProxyEvalResponse(
                ok=False,
                mode=mode,
                error={
                    "type": "llm_provider_error",
                    "provider": e.provider,
                    "retryable": e.is_retryable,
                    "message": str(e),
                }
            )
        
        # 3. Output analysis
        output_analysis = analyze_output(raw_output, input_analysis)
        
        # 4. Alignment
        alignment = compute_alignment(input_analysis, output_analysis)
        
        # 5. Redirect
        redirect = should_redirect(input_analysis, output_analysis, alignment)
        
        # 6. Score
        score_result = compute_score(input_analysis, output_analysis, alignment, redirect)
        
        # Generate safe output
        if redirect.get("redirect", False):
            safe_output = "I cannot assist with that request. Please ask something else."
        else:
            safe_output = raw_output
        
        response_data = {
            "ok": True,
            "mode": mode,
            "raw_model_output": raw_output,
            "safe_output": safe_output,
            "input_analysis": input_analysis,
            "output_analysis": output_analysis,
            "alignment": alignment,
            "redirect_summary": redirect,
            "score_breakdown": score_result
        }
        
        # Deep analysis if requested
        if request.depth == "deep":
            report = {
                "input": {"raw_text": request.message, "analysis": input_analysis},
                "output": {"raw_text": raw_output, "analysis": output_analysis},
                "alignment": alignment
            }
            
            # Deep engines
            deception = analyze_deception(request.message, report)
            psych_pressure = analyze_psychological_pressure(request.message)
            safety_graph = build_safety_graph(input_analysis, output_analysis, alignment)
            drift = detect_drift(input_analysis)
            legal_risk = analyze_legal_risk(input_analysis, output_analysis, report)
            
            response_data.update({
                "drift": drift,
                "risk_nodes": safety_graph,
                "deception": deception,
                "psych_pressure": psych_pressure,
                "legal_risk": legal_risk
            })
        
        return ProxyEvalResponse(**response_data)
        
    except LLMProviderError as e:
        # Catch any LLM errors that weren't caught earlier
        return ProxyEvalResponse(
            ok=False,
            mode=mode,
            error={
                "type": "llm_provider_error",
                "provider": e.provider,
                "retryable": e.is_retryable,
                "message": str(e),
            }
        )
    except Exception as e:
        # Other unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in proxy evaluation: {str(e)}"
        )
