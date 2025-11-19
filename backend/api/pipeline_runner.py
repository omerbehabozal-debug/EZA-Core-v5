# -*- coding: utf-8 -*-
"""
pipeline_runner.py – EZA-Core v4.0 Unified Pipeline Runner
Centralized pipeline execution for all modes (standalone, proxy, proxy_fast, proxy_deep)
"""

from typing import Dict, Any, Optional
from backend.api.input_analyzer import analyze_input
from backend.api.output_analyzer import analyze_output
from backend.api.alignment_engine import compute_alignment
from backend.api.advisor import generate_advice, generate_rewritten_answer, build_standalone_response
from backend.ai.model_client import LLMClient
from backend.api.utils.model_runner import call_single_model


async def run_pipeline(
    text: str,
    mode: str,
    request: Any,
    llm_output: Optional[str] = None
) -> Dict[str, Any]:
    """
    Unified pipeline runner for all EZA modes.
    
    Args:
        text: User input text
        mode: Mode ("standalone", "proxy", "proxy_fast", "proxy_deep")
        request: FastAPI Request object (for app.state access)
        llm_output: Optional pre-computed LLM output (for proxy modes)
        
    Returns:
        Complete analysis report dictionary
    """
    try:
        mode = mode.lower()
        
        # Initialize narrative engine if needed
        if not hasattr(request.app.state, "narrative_engine"):
            from backend.api.narrative_engine import NarrativeEngine
            request.app.state.narrative_engine = NarrativeEngine(max_memory=20)
        
        # Add user message to conversation memory
        if text:
            try:
                request.app.state.narrative_engine.add_message("user", text)
            except Exception as e:
                print(f"Warning: Could not add user message to narrative: {e}")
        
        # Determine which analysis levels to skip
        skip_levels = []
        if mode == "proxy_fast":
            skip_levels = [7, 8, 9, 10]  # Skip Critical Bias, Moral Compass, Abuse, Memory Consistency
        elif mode == "standalone":
            skip_levels = [6, 7, 8, 9, 10]  # Skip advanced levels for standalone (light mode)
        
        run_full_analysis = len(skip_levels) == 0
        
        # 1) Input Analysis
        input_scores = analyze_input(text)
        
        # 2) Get LLM Output (if not provided)
        if llm_output is None:
            if mode == "standalone":
                # Standalone: Use Knowledge Engine + Response Composer
                # Ensure modules are initialized
                if not hasattr(request.app.state, "knowledge_engine"):
                    from backend.ai.knowledge_engine import KnowledgeEngine
                    request.app.state.knowledge_engine = KnowledgeEngine()
                if not hasattr(request.app.state, "response_composer"):
                    from backend.ai.response_composer import ResponseComposer
                    request.app.state.response_composer = ResponseComposer()
                
                intent_primary = input_scores.get("intent_engine", {}).get("primary", "information")
                
                if intent_primary == "greeting":
                    llm_output = request.app.state.response_composer.compose_greeting_response()
                else:
                    knowledge_answer = request.app.state.knowledge_engine.answer_query(text)
                    if knowledge_answer:
                        risk_level = input_scores.get("risk_level", "safe")
                        llm_output = request.app.state.response_composer.compose_natural_response(
                            fact=knowledge_answer,
                            intent=intent_primary,
                            safety=risk_level
                        )
                    else:
                        llm_output = request.app.state.response_composer.compose_fallback_response()
            else:
                # Proxy modes: Call LLM
                try:
                    llm_client = LLMClient()
                    system_message = "You are an AI assistant behind an ethical proxy (EZA). Answer clearly and concisely."
                    llm_output = await llm_client.call(prompt=text, system=system_message, temperature=0.3)
                except Exception as e:
                    import traceback
                    print(f"ERROR: LLM call failed: {e}")
                    print(traceback.format_exc())
                    llm_output = f"[LLM Error: {str(e)}]"
        
        # 3) Output Analysis
        output_scores = analyze_output(llm_output, model="llm", input_analysis=input_scores)
        
        # 4) Alignment
        alignment_meta = compute_alignment(
            input_analysis=input_scores,
            output_analysis=output_scores,
        )
        
        # 5) Reasoning Shield
        # Ensure modules are initialized
        if not hasattr(request.app.state, "reasoning_shield"):
            from backend.api.reasoning_shield import ReasoningShield
            request.app.state.reasoning_shield = ReasoningShield()
        if not hasattr(request.app.state, "eza_score"):
            from backend.api.eza_score import EZAScore
            request.app.state.eza_score = EZAScore()
        if not hasattr(request.app.state, "verdict"):
            from backend.api.verdict_engine import VerdictEngine
            request.app.state.verdict = VerdictEngine()
        
        intent_engine_data = input_scores.get("intent_engine") or {}
        narrative_info = input_scores.get("analysis", {}).get("narrative") or {}
        
        shield_result = request.app.state.reasoning_shield.evaluate(
            input_analysis=input_scores,
            output_analysis=output_scores,
            intent_engine=intent_engine_data,
            narrative_info=narrative_info,
        )
        
        # 6) Get narrative analysis (if available)
        narrative_flow = {}
        narrative_long = {}
        if hasattr(request.app.state, "narrative_engine") and request.app.state.narrative_engine is not None:
            try:
                narrative_flow = request.app.state.narrative_engine.analyze_flow(text)
            except:
                pass
            try:
                narrative_long = request.app.state.narrative_engine.analyze_narrative(text)
            except:
                pass
        
        # 6.1) Get drift matrix (if available)
        drift_matrix = {}
        if hasattr(request.app.state, "drift_matrix"):
            try:
                drift_matrix = request.app.state.drift_matrix.compute(
                    memory=request.app.state.narrative_engine.memory if hasattr(request.app.state, "narrative_engine") else []
                )
                # Add overall_drift_score for EZA Score v2.1
                if "score" in drift_matrix:
                    drift_matrix["overall_drift_score"] = abs(drift_matrix.get("score", 0.0))
            except:
                pass
        
        # 6.2) Build comprehensive report for EZA Score v2.1
        report_for_score = {
            "mode": mode,
            "input_analysis": input_scores,
            "output_analysis": output_scores,  # Add output analysis
            "alignment_meta": alignment_meta,
            "final_verdict": {"level": shield_result.get("level", "safe")},
            "reasoning_shield": shield_result,
            "narrative_flow": narrative_flow,
            "narrative_long": narrative_long,
            "intent_engine": intent_engine_data,
        }
        
        # 7) Advanced Analysis (Level 6-10) - Skip if fast mode
        advanced_analysis = {}
        
        if run_full_analysis or mode == "proxy_deep":
            # Get narrative memory
            narrative_memory = []
            if hasattr(request.app.state, "narrative_engine") and request.app.state.narrative_engine is not None:
                narrative_memory = getattr(request.app.state.narrative_engine, "memory", [])
            
            # Level 6: Deception, Pressure, Legal, Context, Behavior, Ethical
            if 6 not in skip_levels:
                try:
                    advanced_analysis["deception"] = request.app.state.deception_engine.analyze(
                        text=text,
                        report=report_for_score,
                        memory=narrative_memory
                    )
                except:
                    advanced_analysis["deception"] = {"ok": False, "summary": "Skipped"}
                
                try:
                    advanced_analysis["psychological_pressure"] = request.app.state.psych_pressure.analyze(
                        text=text,
                        memory=narrative_memory
                    )
                except:
                    advanced_analysis["psychological_pressure"] = {"ok": False, "summary": "Skipped"}
                
                # Legal Risk (if available)
                try:
                    if hasattr(request.app.state, "legal_risk_engine"):
                        advanced_analysis["legal_risk"] = request.app.state.legal_risk_engine.analyze(
                            text=text,
                            intent_engine=intent_engine_data,
                            memory=narrative_memory
                        )
                except:
                    pass
            
            # Level 7: Critical Bias
            if 7 not in skip_levels:
                try:
                    advanced_analysis["critical_bias"] = request.app.state.critical_bias_engine.analyze(
                        input_text=text,
                        model_outputs={"llm": llm_output},
                        intent_engine=intent_engine_data,
                        context_graph={}
                    )
                except:
                    advanced_analysis["critical_bias"] = {"bias_score": 0.0, "level": "low", "summary": "Skipped"}
            
            # Level 8: Moral Compass
            if 8 not in skip_levels:
                try:
                    advanced_analysis["moral_compass"] = request.app.state.moral_compass_engine.analyze(
                        input_text=text,
                        model_outputs={"llm": llm_output},
                        intent_engine=intent_engine_data,
                        context_graph={}
                    )
                except:
                    advanced_analysis["moral_compass"] = {"score": 0.0, "level": "low", "summary": "Skipped"}
            
            # Level 9: Abuse
            if 9 not in skip_levels:
                try:
                    advanced_analysis["abuse"] = request.app.state.abuse_engine.analyze(
                        input_text=text,
                        model_outputs={"llm": llm_output},
                        intent_engine=intent_engine_data,
                        context_graph={}
                    )
                except:
                    advanced_analysis["abuse"] = {"score": 0.0, "level": "low", "summary": "Skipped"}
            
            # Level 10: Memory Consistency
            if 10 not in skip_levels:
                try:
                    memory_context = None
                    if narrative_memory:
                        past_user_messages = [m.get("text", "") for m in narrative_memory if m.get("role") == "user"]
                        past_model_messages = [m.get("text", "") for m in narrative_memory if m.get("role") == "assistant"]
                        memory_context = {
                            "past_user_messages": past_user_messages,
                            "past_model_messages": past_model_messages,
                        }
                    
                    advanced_analysis["memory_consistency"] = request.app.state.memory_consistency_engine.analyze(
                        memory_context=memory_context,
                        model_outputs={"llm": llm_output}
                    )
                except:
                    advanced_analysis["memory_consistency"] = {"score": 0.0, "level": "low", "summary": "Skipped"}
        
        # 7.1) Update report_for_score with advanced analysis (for EZA Score v2.1)
        if advanced_analysis:
            report_for_score.update(advanced_analysis)
        
        # 8) EZA Score v2.1 (with all available data)
        eza_score_result = request.app.state.eza_score.compute(report_for_score, drift_matrix)
        
        # 9) Final Verdict
        final_verdict = request.app.state.verdict.generate(report_for_score, eza_score_result, drift_matrix)
        
        # 10) Add assistant response to memory
        if llm_output:
            try:
                request.app.state.narrative_engine.add_message("assistant", llm_output)
            except Exception as e:
                print(f"Warning: Could not add assistant message to narrative: {e}")
        
        # 11) Build final report
        # Extract output analysis for assistant message
        # Output analyzer may not have intent_engine, so use safe defaults
        output_intent = "information"  # Default for LLM responses
        output_risk_level = output_scores.get("risk_level", "low") if isinstance(output_scores, dict) else "low"
        output_eza_score = None
        if isinstance(output_scores, dict) and output_scores.get("eza_score"):
            if isinstance(output_scores["eza_score"], dict):
                output_eza_score = output_scores["eza_score"].get("eza_score")
            else:
                output_eza_score = output_scores["eza_score"]
        
        report = {
            "ok": True,
            "mode": mode,
            "text": llm_output,
            "llm_output": llm_output,  # Explicit field for frontend
            "analysis": {
                "input": input_scores,
                "output": output_scores,
                "alignment": alignment_meta,
                "final": final_verdict,
                "eza_score": eza_score_result,
                "eza_score_breakdown": eza_score_result.get("breakdown"),  # Add breakdown
                "eza_score_meta": eza_score_result.get("meta"),  # Add meta
                "reasoning_shield": shield_result,
                **advanced_analysis
            },
            # Input analysis (for user message)
            "risk_level": input_scores.get("risk_level", "low"),
            "risk_flags": input_scores.get("risk_flags", []),
            "intent": input_scores.get("intent_engine", {}).get("primary", "information"),
            "intent_score": input_scores.get("intent_engine", {}).get("risk_score", 0.0),
            "bias": advanced_analysis.get("critical_bias", {}).get("level", "low"),
            "safety": shield_result.get("final_risk_level") or shield_result.get("level") or "low",
            # Output analysis (for assistant message)
            "output_analysis": {
                "risk_level": output_risk_level,
                "intent": output_intent,
                "eza_score": output_eza_score,
                "risk_flags": output_scores.get("risk_flags", []),
            }
        }
        
        return report
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR in run_pipeline: {e}")
        print(error_trace)
        # Return error response
        return {
            "ok": False,
            "error": str(e),
            "traceback": error_trace,
            "mode": mode if 'mode' in locals() else "unknown",
            "text": "",
            "analysis": {}
        }

