# -*- coding: utf-8 -*-
"""
EZA Pipeline Runner
Unified pipeline for all EZA modes (standalone, proxy, proxy-lite)
"""

from typing import Literal, Dict, Any, Optional
import logging

from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.model_router import route_model, LLMProviderError
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment
from backend.core.engines.safe_rewrite import safe_rewrite
from backend.core.engines.redirect_engine import should_redirect
from backend.core.engines.eza_score import compute_eza_score_v21
from backend.core.engines.deception_engine import analyze_deception
from backend.core.engines.legal_risk import analyze_legal_risk
from backend.core.engines.psych_pressure import analyze_psychological_pressure
from backend.config import get_settings

logger = logging.getLogger(__name__)


async def run_full_pipeline(
    user_input: str,
    mode: Literal["standalone", "proxy", "proxy-lite"],
    output_text: Optional[str] = None,
    llm_override: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Run full EZA pipeline for a given user input and mode.
    
    This function:
    1. Analyzes input
    2. Gets LLM response via model router (unless output_text provided)
    3. Analyzes output
    4. Computes alignment
    5. Calculates EZA Score v2.1
    6. Generates mode-specific response schema
    
    Args:
        user_input: User input text to process
        mode: Pipeline mode - "standalone", "proxy", or "proxy-lite"
        output_text: Optional pre-analyzed output text (for proxy-lite mode)
        llm_override: Optional LLM override for testing (must have async generate() method)
    
    Returns:
        Dictionary with unified response format:
        {
            "ok": bool,
            "mode": str,
            "eza_score": float | None,
            "eza_score_breakdown": dict | None,
            "data": dict | None,
            "error": dict | None
        }
    """
    settings = get_settings()
    
    # Initialize response structure
    response: Dict[str, Any] = {
        "ok": True,
        "mode": mode,
        "eza_score": None,
        "eza_score_breakdown": None,
        "data": None,
        "error": None
    }
    
    try:
        # Step 1: Input analysis
        try:
            input_analysis = analyze_input(user_input)
            logger.debug(f"Input analysis completed: {input_analysis.get('risk_level', 'unknown')}")
        except Exception as e:
            logger.error(f"Input analysis failed: {str(e)}")
            response["ok"] = False
            response["error"] = {
                "error_code": "INPUT_ANALYSIS_ERROR",
                "error_message": f"Input analysis failed: {str(e)}"
            }
            return response
        
        # Step 2: Get LLM response (skip if output_text is provided for proxy-lite)
        raw_llm_output: Optional[str] = None
        
        # Use provided output_text if available (for proxy-lite mode)
        if output_text:
            raw_llm_output = output_text
            logger.debug(f"Using provided output_text: {len(raw_llm_output)} chars")
        elif llm_override:  # Use override LLM for testing
            try:
                raw_llm_output = await llm_override.generate(user_input)
                logger.debug(f"LLM override response received: {len(raw_llm_output) if raw_llm_output else 0} chars")
            except Exception as e:
                logger.error(f"LLM override failed: {str(e)}")
                response["ok"] = False
                response["error"] = {
                    "error_code": "LLM_OVERRIDE_ERROR",
                    "error_message": f"LLM override failed: {str(e)}"
                }
                return response
        elif mode != "proxy-lite":  # proxy-lite might receive pre-analyzed output
            try:
                # Determine depth based on mode
                depth = "fast" if mode == "standalone" else "fast"  # Can be "deep" for proxy
                max_tokens = 180 if mode == "standalone" else 512
                
                raw_llm_output = await route_model(
                    prompt=user_input,
                    depth=depth,
                    temperature=0.2,
                    max_tokens=max_tokens,
                    mode=mode,
                )
                logger.debug(f"LLM response received: {len(raw_llm_output) if raw_llm_output else 0} chars")
            except LLMProviderError as e:
                logger.error(f"LLM provider error: {str(e)}")
                response["ok"] = False
                response["error"] = {
                    "error_code": "LLM_PROVIDER_ERROR",
                    "error_message": str(e),
                    "provider": e.provider,
                    "retryable": e.is_retryable
                }
                return response
            except Exception as e:
                logger.error(f"LLM call failed: {str(e)}")
                response["ok"] = False
                response["error"] = {
                    "error_code": "LLM_CALL_ERROR",
                    "error_message": f"LLM call failed: {str(e)}"
                }
                return response
        
        # If no LLM output and not proxy-lite, this is an error
        if not raw_llm_output and mode != "proxy-lite":
            response["ok"] = False
            response["error"] = {
                "error_code": "NO_LLM_OUTPUT",
                "error_message": "No LLM output received"
            }
            return response
        
        # For proxy-lite without output_text, we still need some output for analysis
        # Use empty string as fallback
        if mode == "proxy-lite" and not raw_llm_output:
            raw_llm_output = ""
            logger.warning("proxy-lite mode: No output_text provided, using empty string")
        
        # Step 3: Output analysis
        try:
            output_analysis = analyze_output(raw_llm_output or "", input_analysis)
            logger.debug(f"Output analysis completed: {output_analysis.get('risk_level', 'unknown')}")
        except Exception as e:
            logger.error(f"Output analysis failed: {str(e)}")
            response["ok"] = False
            response["error"] = {
                "error_code": "OUTPUT_ANALYSIS_ERROR",
                "error_message": f"Output analysis failed: {str(e)}"
            }
            return response
        
        # Step 4: Alignment computation
        try:
            alignment = compute_alignment(input_analysis, output_analysis)
            logger.debug(f"Alignment computed: {alignment.get('verdict', 'unknown')}")
        except Exception as e:
            logger.error(f"Alignment computation failed: {str(e)}")
            response["ok"] = False
            response["error"] = {
                "error_code": "ALIGNMENT_ERROR",
                "error_message": f"Alignment computation failed: {str(e)}"
            }
            return response
        
        # Step 5: Redirect analysis
        redirect = should_redirect(input_analysis, output_analysis, alignment)
        
        # Step 6: Safe rewrite
        safe_answer: Optional[str] = None
        if raw_llm_output:
            try:
                safe_answer = safe_rewrite(
                    user_message=user_input,
                    llm_output=raw_llm_output,
                    input_analysis=input_analysis,
                    output_analysis=output_analysis,
                    alignment=alignment
                )
            except Exception as e:
                logger.warning(f"Safe rewrite failed, using raw output: {str(e)}")
                safe_answer = raw_llm_output
        
        # Step 7: Deep analysis (for proxy mode or when needed)
        deception: Optional[Dict[str, Any]] = None
        legal_risk: Optional[Dict[str, Any]] = None
        psych_pressure: Optional[Dict[str, Any]] = None
        
        if mode == "proxy":
            try:
                report = {
                    "input": {"raw_text": user_input, "analysis": input_analysis},
                    "output": {"raw_text": raw_llm_output or "", "analysis": output_analysis},
                    "alignment": alignment
                }
                
                deception = analyze_deception(user_input, report)
                psych_pressure = analyze_psychological_pressure(user_input)
                legal_risk = analyze_legal_risk(input_analysis, output_analysis, report)
            except Exception as e:
                logger.warning(f"Deep analysis failed: {str(e)}")
                # Continue without deep analysis
        
        # Step 8: EZA Score v2.1 calculation
        try:
            eza_score_result = compute_eza_score_v21(
                input_analysis=input_analysis,
                output_analysis=output_analysis,
                alignment=alignment,
                redirect=redirect,
                deception=deception,
                legal_risk=legal_risk,
                psych_pressure=psych_pressure
            )
            
            response["eza_score"] = eza_score_result.get("final_score")
            response["eza_score_breakdown"] = eza_score_result
            logger.debug(f"EZA Score computed: {response['eza_score']}")
        except Exception as e:
            logger.error(f"EZA Score calculation failed: {str(e)}")
            # Don't fail the entire request, just log the error
            response["eza_score"] = None
            response["eza_score_breakdown"] = None
        
        # Step 9: Build mode-specific response data
        if mode == "standalone":
            # Standalone: only safe_answer
            response["data"] = {
                "safe_answer": safe_answer or "Üzgünüm, şu anda yanıt veremiyorum."
            }
        
        elif mode == "proxy":
            # Proxy: raw outputs + scores + detailed report
            response["data"] = {
                "raw_output": raw_llm_output,
                "safe_answer": safe_answer,
                "input_analysis": input_analysis,
                "output_analysis": output_analysis,
                "alignment": alignment,
                "redirect": redirect,
                "safety_label": alignment.get("label", "Safe"),
                "deep_analysis": {
                    "deception": deception,
                    "legal_risk": legal_risk,
                    "psych_pressure": psych_pressure
                } if (deception or legal_risk or psych_pressure) else None
            }
        
        elif mode == "proxy-lite":
            # Proxy-lite: concise summary + risk levels
            safety_level = eza_score_result.get("safety_level", "unknown") if response.get("eza_score_breakdown") else "unknown"
            risk_level = "high" if input_analysis.get("risk_score", 0.0) > 0.6 else "medium" if input_analysis.get("risk_score", 0.0) > 0.3 else "low"
            
            response["data"] = {
                "risk_level": risk_level,
                "safety_level": safety_level,
                "summary": f"Risk assessment: {risk_level} risk, {safety_level} safety",
                "recommendation": _get_recommendation(risk_level, safety_level)
            }
        
        return response
    
    except Exception as e:
        # Catch-all for unexpected errors
        logger.exception(f"Unexpected error in pipeline: {str(e)}")
        response["ok"] = False
        response["error"] = {
            "error_code": "PIPELINE_ERROR",
            "error_message": f"Unexpected pipeline error: {str(e)}"
        }
        return response


def _get_recommendation(risk_level: str, safety_level: str) -> str:
    """Generate recommendation based on risk and safety levels"""
    if risk_level == "high" or safety_level in ["red", "orange"]:
        return "Immediate action required. Content should be blocked and reviewed."
    elif risk_level == "medium" or safety_level == "yellow":
        return "Content requires review. Consider blocking or modification."
    else:
        return "Content appears safe. Standard monitoring recommended."

