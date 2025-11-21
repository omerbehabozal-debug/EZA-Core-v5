# -*- coding: utf-8 -*-
"""
Proxy Mode Router (Internal Lab)
Fast + Deep selectable
Production-ready with detailed error reporting for EZA team
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Literal, Dict, Any
from backend.core.utils.dependencies import require_internal
from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.model_router import route_model, LLMProviderError
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment
from backend.core.engines.redirect_engine import should_redirect
from backend.core.engines.score_engine import compute_score
from backend.core.engines.deception_engine import analyze_deception
from backend.core.engines.psych_pressure import analyze_psychological_pressure
from backend.core.engines.legal_risk import analyze_legal_risk
from backend.core.engines.safe_rewrite import safe_rewrite

router = APIRouter()


class ProxyEvalRequest(BaseModel):
    message: str
    model: Optional[str] = "gpt-4"
    depth: Literal["fast", "deep"] = "fast"


class ProxyEvalResponse(BaseModel):
    ok: bool = True
    mode: str
    raw_output: Optional[str] = None
    safe_output: Optional[str] = None
    analysis: Optional[Dict[str, Any]] = None
    safety: Optional[str] = None
    confidence: Optional[float] = None
    error: Optional[Dict[str, Any]] = None


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
            llm_output = await route_model(
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
        output_analysis = analyze_output(llm_output, input_analysis)
        
        # 4. Alignment
        alignment = compute_alignment(input_analysis, output_analysis)
        
        # 5. Redirect
        redirect = should_redirect(input_analysis, output_analysis, alignment)
        
        # 6. Score
        score_result = compute_score(input_analysis, output_analysis, alignment, redirect)
        
        # 7. Safe Rewrite - ALWAYS run safe_rewrite
        safe_output = safe_rewrite(
            user_message=request.message,
            llm_output=llm_output,
            input_analysis=input_analysis,
            output_analysis=output_analysis,
            alignment=alignment
        )
        
        # 8. Build final decision
        final_decision = {
            "redirect": redirect.get("redirect", False),
            "reason": redirect.get("reason", ""),
            "safety_level": score_result.get("safety_level", "green")
        }
        
        # 9. Build EZA score breakdown
        eza_score_breakdown = {
            "final_score": score_result.get("final_score", 0.0),
            "safety_level": score_result.get("safety_level", "green"),
            "confidence": score_result.get("confidence", 0.95),
            "breakdown": score_result.get("breakdown", {})
        }
        
        # 10. Build base analysis structure
        analysis_data: Dict[str, Any] = {
            "input": input_analysis,
            "output": output_analysis,
            "alignment": alignment,
            "final": final_decision,
            "eza_score": eza_score_breakdown
        }
        
        # 11. Deep analysis if requested
        if request.depth == "deep":
            report = {
                "input": {"raw_text": request.message, "analysis": input_analysis},
                "output": {"raw_text": llm_output, "analysis": output_analysis},
                "alignment": alignment
            }
            
            # Deep engines
            deception = analyze_deception(request.message, report)
            psych_pressure = analyze_psychological_pressure(request.message)
            legal_risk = analyze_legal_risk(input_analysis, output_analysis, report)
            
            # Placeholder functions for missing deep engines
            reasoning_shield: Dict[str, Any] = {}  # Placeholder
            critical_bias: Dict[str, Any] = {}  # Placeholder
            moral_compass: Dict[str, Any] = {}  # Placeholder
            memory_consistency: Dict[str, Any] = {}  # Placeholder
            
            # Add deep analysis to analysis_data
            analysis_data.update({
                "reasoning_shield": reasoning_shield,
                "deception": deception,
                "psychological_pressure": psych_pressure,
                "critical_bias": critical_bias,
                "moral_compass": moral_compass,
                "memory_consistency": memory_consistency
            })
        
        # 12. Get safety label from alignment
        safety_label = alignment.get("label", "Safe")
        
        # 13. Build response
        response_data = {
            "ok": True,
            "mode": mode,
            "raw_output": llm_output,
            "safe_output": safe_output,
            "analysis": analysis_data,
            "safety": safety_label,
            "confidence": 0.95
        }
        
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
