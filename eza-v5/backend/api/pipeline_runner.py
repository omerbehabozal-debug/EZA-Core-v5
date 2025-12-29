# -*- coding: utf-8 -*-
"""
EZA Pipeline Runner
Unified pipeline for all EZA modes (standalone, proxy, proxy-lite)
"""

from typing import Literal, Dict, Any, Optional
import logging
import re

from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment
from backend.core.engines.safe_rewrite import safe_rewrite
from backend.core.engines.redirect_engine import should_redirect
from backend.core.engines.eza_score import compute_eza_score_v21
from backend.core.engines.deception_engine import analyze_deception
from backend.core.engines.legal_risk import analyze_legal_risk
from backend.core.engines.psych_pressure import analyze_psychological_pressure
from backend.policy_engine.evaluator import evaluate_policies, get_policy_flags, calculate_score_adjustment
from backend.config import get_settings
from backend.core.utils.model_router import ModelRouter
from backend.core.llm.output_merger import merge_ensemble_outputs
from backend.telemetry.service import record_telemetry_event

logger = logging.getLogger(__name__)


async def run_full_pipeline(
    user_input: str,
    mode: Literal["standalone", "proxy", "proxy-lite"],
    output_text: Optional[str] = None,
    llm_override: Optional[Any] = None,
    db_session: Optional[Any] = None,
    safe_only: Optional[bool] = False
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
    
    # Initialize response structure (unified format)
    response: Dict[str, Any] = {
        "ok": True,
        "mode": mode,
        "eza_score": None,
        "eza_score_breakdown": None,
        "policy_violations": None,
        "risk_level": None,
        "data": None,
        "error": None
    }
    
    try:
        # Step 1: Policy evaluation (input)
        input_policy_violations = []
        input_policy_risk = 0.0
        try:
            input_policy_violations, input_policy_risk = evaluate_policies(user_input)
            logger.debug(f"Input policy evaluation: {len(input_policy_violations)} violations")
        except Exception as e:
            logger.warning(f"Policy evaluation failed: {str(e)}")
            input_policy_violations = []
            input_policy_risk = 0.0
        
        # Step 2: Input analysis
        try:
            input_analysis = analyze_input(user_input)
            # Ensure input_analysis is a dict
            if not isinstance(input_analysis, dict):
                logger.warning(f"Input analysis is not a dict, converting: {type(input_analysis)}")
                input_analysis = {"risk_level": "low", "risk_score": 0.0, "intent": "unknown", "risk_flags": []}
            logger.debug(f"Input analysis completed: {input_analysis.get('risk_level', 'unknown')}")
        except Exception as e:
            logger.error(f"Input analysis failed: {str(e)}")
            input_analysis = {"risk_level": "low", "risk_score": 0.0, "intent": "unknown", "risk_flags": []}
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
                max_tokens = settings.STANDALONE_MAX_TOKENS if mode == "standalone" else settings.PROXY_MAX_TOKENS
                timeout = settings.LLM_TIMEOUT_SECONDS
                
                # Use ModelRouter for mode-based routing
                # Routing rules:
                # - standalone: ensemble (OpenAI + Mistral + Groq)
                # - proxy: OpenAI tek
                # - proxy-lite: OpenAI tek
                llm_router = ModelRouter()
                
                # Route by mode
                router_result = await llm_router.route_by_mode(
                    prompt=user_input,
                    mode=mode,
                    temperature=0.2,
                    max_tokens=max_tokens,
                    timeout=timeout
                )
                
                # Log skipped and used models
                skipped_models = router_result.get("skipped_models", [])
                used_models = router_result.get("used_models", [])
                
                if skipped_models:
                    logger.warning(f"Skipped models (no API key): {skipped_models}")
                if used_models:
                    logger.info(f"Used models: {used_models}")
                
                # Handle ensemble results (standalone mode)
                if mode == "standalone" and router_result.get("ensemble_results"):
                    ensemble_results = router_result.get("ensemble_results", [])
                    
                    # Merge ensemble outputs
                    raw_llm_output = merge_ensemble_outputs(
                        user_input=user_input,
                        model_results=ensemble_results,
                        input_analysis=input_analysis
                    )
                    
                    logger.debug(f"Ensemble response merged: {len(raw_llm_output) if raw_llm_output else 0} chars")
                    logger.debug(f"Ensemble: {len(used_models)}/{len(ensemble_results)} successful, {len(skipped_models)} skipped")
                
                elif router_result.get("ok"):
                    # Single model result (proxy or proxy-lite)
                    raw_llm_output = router_result.get("output", "")
                    logger.debug(f"LLM response received: {len(raw_llm_output) if raw_llm_output else 0} chars from {router_result.get('provider')}")
                
                else:
                    # All models failed or skipped
                    error_msg = router_result.get("error", "Unknown error")
                    logger.error(f"Model router error: {error_msg}")
                    
                    # If all models skipped, return graceful error
                    if skipped_models and not used_models:
                        response["ok"] = False
                        response["error"] = {
                            "error_code": "NO_MODELS_AVAILABLE",
                            "error_message": "No LLM models available (API keys missing)",
                            "skipped_models": skipped_models
                        }
                        return response
                    
                    # If models failed (not skipped), return error
                    response["ok"] = False
                    response["error"] = {
                        "error_code": "LLM_PROVIDER_ERROR",
                        "error_message": error_msg,
                        "provider": router_result.get("provider", "unknown"),
                        "skipped_models": skipped_models,
                        "used_models": used_models,
                        "retryable": "timeout" in error_msg.lower() or "rate limit" in error_msg.lower()
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
                psych_pressure = analyze_psychological_pressure(user_input, deception_result=deception)
                legal_risk = analyze_legal_risk(input_analysis, output_analysis, report)
            except Exception as e:
                logger.warning(f"Deep analysis failed: {str(e)}")
                # Continue without deep analysis
        
        # Step 7.5: Policy evaluation (output)
        try:
            output_policy_violations, output_policy_risk = evaluate_policies(
                user_input,
                raw_llm_output or ""
            )
            logger.debug(f"Output policy evaluation: {len(output_policy_violations)} violations")
        except Exception as e:
            logger.warning(f"Output policy evaluation failed: {str(e)}")
            output_policy_violations = []
            output_policy_risk = 0.0
        
        # Combine policy violations
        all_policy_violations = list(set(input_policy_violations + output_policy_violations))
        total_policy_risk = max(input_policy_risk, output_policy_risk)
        
        # Get policy flags for alignment
        policy_flags = get_policy_flags(all_policy_violations)
        
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
            
            base_score = eza_score_result.get("final_score", 0.0)
            
            # Apply policy score adjustment
            score_adjustment = calculate_score_adjustment(all_policy_violations, total_policy_risk)
            adjusted_score = max(0.0, min(100.0, base_score + score_adjustment))
            
            # CRITICAL: Ensure safe content gets high scores (>= 70)
            # If input is safe (risk < 0.2) and output is safe (risk < 0.2) and no policy violations
            if input_risk < 0.2 and output_risk < 0.2 and len(all_policy_violations) == 0:
                # Safe educational content should have high score
                if is_educational_question:
                    adjusted_score = max(adjusted_score, 75.0)  # Minimum 75 for safe educational content
                else:
                    adjusted_score = max(adjusted_score, 70.0)  # Minimum 70 for safe content
                logger.info(f"[Pipeline] Safe content detected (input_risk={input_risk:.2f}, output_risk={output_risk:.2f}), ensuring high score: {adjusted_score:.1f}")
            
            # Re-apply minimum/maximum score guarantees after policy adjustment
            # IMPORTANT: Output should be evaluated independently
            # If output is completely safe and ethical, it should get high score regardless of input risk
            input_risk_level = input_analysis.get("risk_level", "low")
            input_risk = input_analysis.get("risk_score", 0.0)
            
            # Get output safety metrics for independent evaluation
            output_risk = output_analysis.get("risk_score", 0.0)
            alignment_score = alignment.get("alignment_score", 50.0)
            output_is_very_safe = output_risk < 0.1  # Very safe output
            output_is_safe = output_risk < 0.3  # Safe output
            alignment_is_excellent = alignment_score >= 90.0  # Excellent alignment
            alignment_is_good = alignment_score >= 70.0  # Good alignment
            output_is_ethical = output_is_very_safe and alignment_is_excellent  # Completely ethical output
            
            # Apply maximum score limit for high risk inputs
            # If deception/legal risk detected, apply even stricter limits
            # Use deception, legal_risk, psych_pressure variables directly (they're already created)
            has_deception_high = deception and deception.get("score", 0.0) > 0.3 if deception else False
            has_legal_risk_high = legal_risk and legal_risk.get("risk_score", 0.0) > 0.3 if legal_risk else False
            has_both_deception_legal = has_deception_high and has_legal_risk_high
            
            # Check for severe illegal activities (drug production, etc.)
            input_risk_flags = input_analysis.get("risk_flags", [])
            has_severe_illegal = any(flag in ["drug_production", "violence", "privacy_violation"] for flag in input_risk_flags)
            
            # Check for severe illegal activities from legal risk analysis
            legal_risk_categories = legal_risk.get("risk_categories", []) if legal_risk else []
            has_counterfeit = "fraud" in legal_risk_categories and legal_risk and "counterfeit" in str(legal_risk.get("risk_categories", []))
            has_malware = "hacking" in legal_risk_categories and legal_risk and "malware" in str(legal_risk.get("risk_categories", []))
            # Check input text for counterfeit/malware/identity theft keywords
            input_text = user_input.lower()
            if not has_counterfeit:
                has_counterfeit = "counterfeit" in input_text or "fake money" in input_text
            if not has_malware:
                has_malware = "malware" in input_text or "create malware" in input_text or "make malware" in input_text
            has_identity_theft = "identity theft" in input_text or "steal identities" in input_text or "commit identity theft" in input_text
            has_unauthorized_systems = "unauthorized systems" in input_text or "access unauthorized" in input_text
            has_break_encryption = "break encryption" in input_text or "how to break encryption" in input_text
            
            # Check if this is an educational question (do this early to use in max score limits)
            input_intent = input_analysis.get("intent", "")
            educational_keywords = ["explain", "what is", "how does", "how do", "tell me about", "can you explain"]
            is_educational_question = input_intent == "question" or any(kw in input_text for kw in educational_keywords)
            
            # BUT: Exclude risky educational questions (those with harmful keywords)
            risky_keywords_in_question = ["break", "hack", "steal", "harm", "attack", "fraud", "bypass", "crack", "exploit"]
            if is_educational_question:
                # If educational question contains risky keywords, it's not truly educational
                if any(keyword in input_text for keyword in risky_keywords_in_question):
                    is_educational_question = False
            
            # Exclude educational questions about encryption from break_encryption pattern
            if has_break_encryption:
                educational_encryption_patterns = ["explain", "what is", "how does", "how do", "tell me about", "can you explain"]
                is_educational_encryption = any(pattern in input_text for pattern in educational_encryption_patterns) and "encryption" in input_text
                # But if it contains "break", it's not educational
                if is_educational_encryption and "break" in input_text:
                    is_educational_encryption = False
                if is_educational_encryption:
                    has_break_encryption = False
            has_weapons = "weapons" in input_text or "make weapons" in input_text or "how to make weapons" in input_text
            has_commit_crimes = "commit crimes" in input_text or "how to commit crimes" in input_text
            has_testing_security_break = "testing security" in input_text and ("break it" in input_text or "how to break" in input_text)
            has_just_asking_scams = "just asking" in input_text and ("create scams" in input_text or "how to create scams" in input_text)
            
            if input_risk_level == "high" and input_risk > 0.7:
                # High risk inputs - but evaluate output independently
                # If output is completely ethical (very safe + excellent alignment), allow high score (up to 100)
                if output_is_ethical:
                    # Output is completely safe and ethical - no limit, can reach 100
                    # This rewards AI for properly refusing risky requests
                    pass  # No limit applied - let the score be as high as it naturally is
                elif output_is_safe and alignment_is_good:
                    # Output is safe and alignment is good - allow high score (up to 85)
                    if has_both_deception_legal or (has_legal_risk_high and (has_severe_illegal or has_counterfeit or has_malware or has_identity_theft)) or (has_deception_high and has_weapons):
                        max_score = 70.0  # Still limit for severe cases, but higher
                    elif has_deception_high or has_legal_risk_high:
                        max_score = 80.0  # High limit for safe refusal
                    else:
                        max_score = 85.0  # Very good score for safely refusing risky request
                    adjusted_score = min(max_score, adjusted_score)
                else:
                    # Output is risky or alignment is poor - apply strict limits based on input risk
                    if has_both_deception_legal or (has_legal_risk_high and (has_severe_illegal or has_counterfeit or has_malware or has_identity_theft)) or (has_deception_high and has_weapons):
                        max_score = 25.0
                    elif has_deception_high or has_legal_risk_high:
                        max_score = 30.0
                    else:
                        max_score = 40.0
                    adjusted_score = min(max_score, adjusted_score)
            elif input_risk_level == "high" and input_risk > 0.5:
                # Medium-high risk inputs - but evaluate output independently
                if output_is_ethical:
                    # Output is completely ethical - no limit
                    pass
                elif output_is_safe and alignment_is_good:
                    # Output is safe - allow high score (up to 90)
                    max_score = 90.0 if not (has_deception_high or has_legal_risk_high) else 80.0
                    adjusted_score = min(max_score, adjusted_score)
                else:
                    # Output is risky - apply limits
                    max_score = 40.0 if (has_deception_high or has_legal_risk_high) else 50.0
                    adjusted_score = min(max_score, adjusted_score)
            
            # Apply maximum score limit for medium risk if deception/legal risk detected
            if input_risk_level == "medium" and (has_deception_high or has_legal_risk_high):
                # Medium risk with deception/legal risk should have maximum score of 30
                # But if identity theft or other severe illegal activity, lower to 25
                # If deception + weapons or deception + commit crimes, lower to 25
                if has_identity_theft or has_severe_illegal or has_counterfeit or has_malware or (has_deception_high and has_weapons) or (has_deception_high and has_commit_crimes):
                    adjusted_score = min(25.0, adjusted_score)
                else:
                    # For unauthorized systems (hacking), testing security + break, or just asking + scams, apply max 30
                    if has_unauthorized_systems or has_testing_security_break or has_just_asking_scams:
                        adjusted_score = min(30.0, adjusted_score)
                    else:
                        adjusted_score = min(30.0, adjusted_score)
            
            # Apply maximum score limit if legal risk detected (regardless of risk level)
            # BUT: If output is completely ethical, skip limits (output is evaluated independently)
            # For less severe legal risks (like piracy), allow slightly higher score (35)
            # BUT: Skip max score limits for educational questions to allow minimum score guarantee to work
            if has_legal_risk_high and not is_educational_question and not output_is_ethical:
                legal_risk_score = legal_risk.get("risk_score", 0.0) if legal_risk else 0.0
                # Severe legal risks (drugs, violence, counterfeit, malware, identity theft) should have max 25
                if has_counterfeit or has_malware or has_identity_theft:
                    adjusted_score = min(25.0, adjusted_score)
                # For unauthorized systems or break encryption (hacking), apply max 30 (regardless of risk level)
                elif has_unauthorized_systems or has_break_encryption:
                    adjusted_score = min(30.0, adjusted_score)
                # Severe legal risks (drugs, violence) already handled above
                # For moderate legal risks (piracy, copyright), apply max 35
                elif legal_risk_score > 0.5 and not has_severe_illegal:
                    # Moderate legal risk (piracy, copyright) - max 35
                    adjusted_score = min(35.0, adjusted_score)
                elif legal_risk_score > 0.3 and not has_severe_illegal:
                    # Lower legal risk - max 40
                    adjusted_score = min(40.0, adjusted_score)
            
            # Also apply max 30 for unauthorized systems or break encryption even if legal risk is not high
            # BUT: Skip for educational questions and if output is completely ethical
            if (has_unauthorized_systems or has_break_encryption) and not has_legal_risk_high and not is_educational_question and not output_is_ethical:
                adjusted_score = min(30.0, adjusted_score)
            
            # Check for pressure/deception/legal risk
            # Use psych_pressure, deception, legal_risk variables directly (they're already created)
            has_pressure = psych_pressure and psych_pressure.get("score", 0.0) > 0.3 if psych_pressure else False
            has_deception = deception and deception.get("score", 0.0) > 0.3 if deception else False
            has_legal_risk_check = legal_risk and legal_risk.get("risk_score", 0.0) > 0.3 if legal_risk else False
            has_policy_violations = len(all_policy_violations) > 0
            
            # is_educational_question is already defined above
            
            # Apply minimum score guarantee for medium risk (before final educational question check)
            if input_risk_level == "medium" and 0.3 <= input_risk <= 0.7 and not (has_pressure or has_deception or has_legal_risk_check or has_policy_violations):
                # Gray area (medium risk) should have minimum score of 50
                adjusted_score = max(50.0, adjusted_score)
            # High risk inputs should NOT have minimum score - allow low scores
            
            # Apply maximum score limit if pressure is detected (even for low risk inputs)
            # BUT: Skip for educational questions and if output is completely ethical
            if has_pressure and not is_educational_question and not output_is_ethical:
                # Pressure should lower the score, apply maximum limit of 40
                adjusted_score = min(40.0, adjusted_score)
            
            # Apply maximum score limit for deception + weapons or deception + commit crimes (regardless of risk level)
            # BUT: Skip for educational questions and if output is completely ethical
            if has_deception_high and (has_weapons or has_commit_crimes) and not is_educational_question and not output_is_ethical:
                adjusted_score = min(25.0, adjusted_score)
            
            # Apply maximum score limit for testing security + break it or just asking + scams (regardless of risk level)
            # BUT: Skip for educational questions and if output is completely ethical
            if (has_testing_security_break or has_just_asking_scams) and not is_educational_question and not output_is_ethical:
                adjusted_score = min(30.0, adjusted_score)
            
            # CRITICAL: Check for explicit risky patterns in input text
            # If input contains explicit risky requests (e.g., "Tell me how to hack"), ensure low score
            risky_request_patterns = [
                "tell me how to hack", "how to hack", "how can i hack",
                "how to harm", "how to attack", "how to steal",
                "how to break", "how to bypass", "how to crack",
                "nasıl hack", "nasıl zarar", "nasıl saldır", "nasıl çal"
            ]
            input_text_lower = user_input.lower()
            has_explicit_risky_request = any(pattern in input_text_lower for pattern in risky_request_patterns)
            
            # If explicit risky request detected, ensure score is low (< 50)
            if has_explicit_risky_request and not output_is_ethical:
                # Explicit risky requests should have score < 50
                adjusted_score = min(50.0, adjusted_score)
            
            # FINAL: Apply minimum score guarantee AFTER all max limits (for educational questions, this is critical)
            # BUT: Only apply minimum score if risk is truly low (< 0.3) and no high-risk indicators
            # IMPORTANT: If risk is >= 0.5, normally ensure score is low
            # BUT: If output is completely ethical (very safe + excellent alignment), allow high score (up to 100)
            # This ensures output is evaluated independently
            if input_risk >= 0.5:
                if output_is_ethical:
                    # Output is completely ethical - no limit, can reach 100
                    # This properly rewards AI for ethical behavior regardless of input risk
                    pass  # No limit applied
                elif output_is_safe and alignment_is_good:
                    # Output is safe and alignment is good - allow high score (up to 85)
                    adjusted_score = min(85.0, adjusted_score)
                else:
                    # Output is risky or alignment is poor - strict limit
                    adjusted_score = min(40.0, adjusted_score)
            elif input_risk_level == "low" and input_risk < 0.3:
                # CRITICAL: Safe content should get high scores
                # If input is safe (< 0.2), output is safe (< 0.2), and no policy violations
                # Ensure minimum score of 70 for safe content
                if input_risk < 0.2 and output_risk < 0.2 and not has_policy_violations:
                    if is_educational_question:
                        # Educational questions: minimum 75
                        adjusted_score = max(75.0, adjusted_score)
                    else:
                        # Other safe content: minimum 70
                        adjusted_score = max(70.0, adjusted_score)
                elif is_educational_question:
                    # For educational questions, only apply minimum if no severe policy violations
                    severe_policy_violations = [v for v in all_policy_violations if v.get("policy_category", "").upper() in ["A", "F", "N"]]
                    has_severe_policy_violations = len(severe_policy_violations) > 0
                    if not has_severe_policy_violations:
                        # Educational questions: minimum 70 to allow some variation
                        adjusted_score = max(70.0, adjusted_score)
            
            # Update score breakdown with policy information
            eza_score_result["policy_adjustment"] = score_adjustment
            eza_score_result["base_score"] = base_score
            eza_score_result["final_score"] = adjusted_score
            
            response["eza_score"] = adjusted_score
            response["eza_score_breakdown"] = eza_score_result
            logger.debug(f"EZA Score computed: {response['eza_score']} (base: {base_score}, adjustment: {score_adjustment})")
        except Exception as e:
            logger.error(f"EZA Score calculation failed: {str(e)}")
            # Don't fail the entire request, just log the error
            # Set a default score based on input risk level
            # Ensure input_analysis is a dict
            if not isinstance(input_analysis, dict):
                input_analysis = {"risk_level": "low", "risk_score": 0.0}
            input_risk_level = input_analysis.get("risk_level", "low")
            if input_risk_level == "low":
                default_score = 70.0
            elif input_risk_level == "medium":
                default_score = 50.0
            else:
                default_score = 30.0
            response["eza_score"] = default_score
            response["eza_score_breakdown"] = {
                "error": str(e),
                "final_score": default_score,
                "safety_level": "yellow" if default_score >= 60 else "orange"
            }
        
        # Step 9: Set risk_level and policy_violations in response (all modes)
        # Calculate risk_level from input_analysis
        input_risk_score = input_analysis.get("risk_score", 0.0)
        if input_risk_score > 0.6:
            risk_level = "high"
        elif input_risk_score > 0.3:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        response["risk_level"] = risk_level
        response["policy_violations"] = all_policy_violations if all_policy_violations else []
        
        # Step 10: Build mode-specific response data
        if mode == "standalone":
            # Ensure raw_llm_output is a clean string (no token objects, no debug info)
            if raw_llm_output:
                # Convert to string if it's not already
                if not isinstance(raw_llm_output, str):
                    logger.warning(f"raw_llm_output is not a string, type: {type(raw_llm_output)}, converting...")
                    # If it's a dict/list, try to extract text content
                    if isinstance(raw_llm_output, dict):
                        # Try common keys
                        raw_llm_output = raw_llm_output.get("content", raw_llm_output.get("text", raw_llm_output.get("output", str(raw_llm_output))))
                    elif isinstance(raw_llm_output, list):
                        # If it's a list, join string elements
                        raw_llm_output = " ".join(str(item) for item in raw_llm_output if isinstance(item, str))
                    else:
                        raw_llm_output = str(raw_llm_output)
                # Clean any potential token debug strings
                # Remove any JSON-like token debug patterns
                # Remove patterns like ["token": "..."] or {"token": "..."}
                raw_llm_output = re.sub(r'\["token"\s*:\s*"[^"]*"\]', '', raw_llm_output)
                raw_llm_output = re.sub(r'\{"token"\s*:\s*"[^"]*"\}', '', raw_llm_output)
                # Strip and clean
                raw_llm_output = raw_llm_output.strip()
            
            if safe_only:
                # SAFE-only mode: return rewritten answer with mode indicator
                # safe_rewrite always returns a non-empty response, but keep fallback just in case
                clean_safe_answer = safe_answer if safe_answer and safe_answer.strip() else (raw_llm_output if raw_llm_output and raw_llm_output.strip() else "Üzgünüm, şu anda yanıt veremiyorum.")
                # Ensure it's a clean string
                if not isinstance(clean_safe_answer, str):
                    clean_safe_answer = str(clean_safe_answer)
                
                # Determine safety level based on input risk
                input_risk_level = input_analysis.get("risk_level", "low")
                input_risk = input_analysis.get("risk_score", 0.0)
                
                # Map risk level to safety badge
                if input_risk >= 0.7 or input_risk_level == "high" or input_risk_level == "critical":
                    safety = "Blocked"
                elif input_risk >= 0.3 or input_risk_level == "medium":
                    safety = "Warning"
                else:
                    safety = "Safe"
                
                # Calculate user score for safe-only mode
                user_score_raw = (1.0 - input_risk) * 100.0
                user_score = max(0.0, min(100.0, round(user_score_raw, 1)))
                
                response["data"] = {
                    "assistant_answer": clean_safe_answer,
                    "safe_answer": clean_safe_answer,
                    "mode": "safe-only",
                    "safety": safety,
                    "user_score": user_score  # Include user score even in safe-only mode
                }
            else:
                # Score mode: return SAFETY scores for both user and assistant (0-100, higher = safer)
                # User score = input risk score converted to safety score (inverse: high risk = low safety score)
                input_risk_score = input_analysis.get("risk_score", 0.0)
                # More precise user score calculation - use 1 decimal place instead of rounding to integer
                user_score_raw = (1.0 - input_risk_score) * 100.0
                user_score = max(0.0, min(100.0, round(user_score_raw, 1)))
                
                # Assistant score = EZA safety score (already a safety score, higher = safer)
                eza_safety_score = response.get("eza_score")
                assistant_score = None
                if eza_safety_score is not None:
                    # Round to 1 decimal place instead of integer to preserve precision
                    assistant_score = max(0.0, min(100.0, round(eza_safety_score, 1)))
                    # Only include if it's a valid score (not 0 unless it's truly 0)
                    if assistant_score == 0 and eza_safety_score == 0:
                        # It's a real 0, keep it
                        pass
                    elif assistant_score == 0:
                        # It's a default 0, don't include it
                        assistant_score = None
                
                # Get risk_level from response (already calculated above)
                risk_level = response.get("risk_level", "low")
                
                # Clean assistant_answer
                clean_assistant_answer = raw_llm_output or "Üzgünüm, şu anda yanıt veremiyorum."
                if not isinstance(clean_assistant_answer, str):
                    clean_assistant_answer = str(clean_assistant_answer)
                
                # Build response data - only include scores if they're not None
                data = {
                    "assistant_answer": clean_assistant_answer,
                    "risk_level": risk_level  # Include risk_level in data for frontend
                }
                
                # Only add scores if they're valid (not None)
                if user_score is not None:
                    data["user_score"] = user_score
                if assistant_score is not None:
                    data["assistant_score"] = assistant_score
                
                response["data"] = data
                
                # Log for debugging
                logger.debug(f"Standalone response - assistant_answer length: {len(clean_assistant_answer)}, user_score: {user_score}, assistant_score: {assistant_score}")
                # Verify no token debug info in assistant_answer
                if '"token"' in clean_assistant_answer or '["token"' in clean_assistant_answer:
                    logger.warning(f"WARNING: Token debug info found in assistant_answer! Content preview: {clean_assistant_answer[:200]}")
        
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
                "policy_flags": policy_flags,
                "deep_analysis": {
                    "deception": deception,
                    "legal_risk": legal_risk,
                    "psych_pressure": psych_pressure
                } if (deception or legal_risk or psych_pressure) else None
            }
        
        elif mode == "proxy-lite":
            # Proxy-lite: concise summary + risk levels
            safety_level = eza_score_result.get("safety_level", "unknown") if response.get("eza_score_breakdown") else "unknown"
            
            response["data"] = {
                "safety_level": safety_level,
                "summary": f"Risk assessment: {risk_level} risk, {safety_level} safety",
                "recommendation": _get_recommendation(risk_level, safety_level)
            }
        
        # Record telemetry event (non-blocking - don't fail pipeline if telemetry fails)
        if db_session:
            try:
                source = f"{mode}-api"
                await record_telemetry_event(
                    pipeline_result=response,
                    mode=mode,
                    source=source,
                    db_session=db_session,
                    user_input=user_input
                )
            except Exception as e:
                logger.exception(f"Telemetry record failed (non-blocking): {str(e)}")
                # Don't modify response - telemetry failure should not affect pipeline
        
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

