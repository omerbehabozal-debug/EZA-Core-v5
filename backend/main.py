# -*- coding: utf-8 -*-
"""
EZA-Core v4.0
Ana FastAPI Uygulaması
"""

from typing import Optional, Dict, Any, List

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from backend.api.input_analyzer import analyze_input
from backend.api.output_analyzer import analyze_output, evaluate_output
from backend.api.alignment_engine import compute_alignment
from backend.api.advisor import generate_advice, generate_rewritten_answer, build_standalone_response
from backend.ai.model_client import LLMClient
from backend.api.narrative_engine import NarrativeEngine
from backend.api.reasoning_shield import ReasoningShield
from backend.api.report_builder import ReportBuilder
from backend.api.identity_block import IdentityBlock
from backend.api.drift_matrix import DriftMatrix
from backend.api.eza_score import EZAScore
from backend.api.verdict_engine import VerdictEngine
from backend.api.deception_engine import DeceptionEngine
from backend.api.psych_pressure_detector import PsychologicalPressureDetector
from backend.api.legal_risk_engine import LegalRiskEngine
from backend.api.context_graph import ContextSafetyGraph
from backend.api.ethical_gradient import EthicalGradientEngine
from backend.api.behavior_correlation import BehaviorCorrelationModel
from backend.api.critical_bias_engine import CriticalBiasEngine
from backend.api.moral_compass_engine import MoralCompassEngine
from backend.api.abuse_engine import AbuseEngine
from backend.api.memory_consistency_engine import MemoryConsistencyEngine
from backend.api.utils.model_runner import (
    call_single_model,
    call_multi_models,
    rewrite_with_ethics,
)
from backend.ai.knowledge_engine import KnowledgeEngine
from backend.ai.response_composer import ResponseComposer
from backend.api.pipeline_runner import run_pipeline

from backend.api.pipeline import router as pipeline_router
from diagnostics.eza_status import router as diagnostics_router


from data_store.event_logger import log_event

from backend.api.utils.exceptions import EZAException, RateLimitExceeded


from backend.middleware.request_logger import RequestLoggerMiddleware
from backend.middleware.normalize_middleware import NormalizeMiddleware
from backend.middleware.rate_limit_middleware import RateLimitMiddleware
from backend.middleware.circuit_breaker import CircuitBreakerMiddleware
from backend.middleware.error_handler import (
    eza_exception_handler,
    rate_limit_handler,
    generic_exception_handler
)




app = FastAPI(title="EZA-Core v4.0")

# --- NarrativeEngine v4.0: Initialize conversation memory (single instance) ---
# Use max_memory=20 for extended history support
if not hasattr(app.state, "narrative_engine"):
    app.state.narrative_engine = NarrativeEngine(max_memory=20)

# Alias for backward compatibility (narrative = narrative_engine)
if not hasattr(app.state, "narrative"):
    app.state.narrative = app.state.narrative_engine

# --- ReasoningShield v5.0: Initialize central decision layer ---
if not hasattr(app.state, "reasoning_shield"):
    app.state.reasoning_shield = ReasoningShield()

# --- EZA Professional Reporting Layer v3.2: Initialize report builder ---
if not hasattr(app.state, "report_builder"):
    app.state.report_builder = ReportBuilder()

# --- EZA IdentityBlock v3.0: Initialize identity protection layer ---
if not hasattr(app.state, "identity_block"):
    app.state.identity_block = IdentityBlock()

# --- EZA Level-5 Upgrade: Initialize DriftMatrix, EZAScore, and VerdictEngine ---
if not hasattr(app.state, "drift"):
    app.state.drift = DriftMatrix()
if not hasattr(app.state, "eza_score"):
    app.state.eza_score = EZAScore()
if not hasattr(app.state, "verdict"):
    app.state.verdict = VerdictEngine()

# --- EZA Level-6 Upgrade: Initialize new safety layers ---
if not hasattr(app.state, "deception_engine"):
    app.state.deception_engine = DeceptionEngine()
if not hasattr(app.state, "psych_pressure"):
    app.state.psych_pressure = PsychologicalPressureDetector()
if not hasattr(app.state, "legal_risk"):
    app.state.legal_risk = LegalRiskEngine()
if not hasattr(app.state, "context_graph"):
    app.state.context_graph = ContextSafetyGraph()
if not hasattr(app.state, "ethical_gradient"):
    app.state.ethical_gradient = EthicalGradientEngine()
if not hasattr(app.state, "behavior_correlation"):
    app.state.behavior_correlation = BehaviorCorrelationModel()

# --- LEVEL 7 – Critical Bias Engine ---
if not hasattr(app.state, "critical_bias_engine"):
    app.state.critical_bias_engine = CriticalBiasEngine()

# --- LEVEL 8 – Moral Compass Engine ---
if not hasattr(app.state, "moral_compass_engine"):
    app.state.moral_compass_engine = MoralCompassEngine()

# --- LEVEL 9 – Abuse & Coercion Engine ---
if not hasattr(app.state, "abuse_engine"):
    app.state.abuse_engine = AbuseEngine()

# --- LEVEL 10 – Memory Consistency Engine ---
if not hasattr(app.state, "memory_consistency_engine"):
    app.state.memory_consistency_engine = MemoryConsistencyEngine()

# --- AI Module – Knowledge Engine & Response Composer ---
if not hasattr(app.state, "knowledge_engine"):
    app.state.knowledge_engine = KnowledgeEngine()
if not hasattr(app.state, "response_composer"):
    app.state.response_composer = ResponseComposer()

# --- Middleware Katmanı ---
app.add_middleware(RequestLoggerMiddleware)
app.add_middleware(NormalizeMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(CircuitBreakerMiddleware)

# --- Exception Handler Katmanı ---
app.add_exception_handler(EZAException, eza_exception_handler)
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_exception_handler(Exception, generic_exception_handler)



templates = Jinja2Templates(directory="frontend/templates")
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Mount lab static files
import os
if os.path.exists("frontend/lab"):
    app.mount("/lab/static", StaticFiles(directory="frontend/lab"), name="lab_static")

# --- API Route Katmanı ---
app.include_router(pipeline_router)
app.include_router(diagnostics_router)



# -------------------------------------------------
# Pydantic Modelleri
# -------------------------------------------------

class AnalyzeRequest(BaseModel):
    text: Optional[str] = None
    query: Optional[str] = None
    model: Optional[str] = "chatgpt"
    mode: Optional[str] = "standalone"  # standalone, proxy, fast, deep, openai


class PairRequest(BaseModel):
    input_text: str
    output_text: str


# -------------------------------------------------
# Sağlık kontrolü
# -------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/health/deep", tags=["system"])
async def deep_health_check():
    try:
        from backend.api.input_analyzer import analyze_input
        from backend.api.output_analyzer import analyze_output
        from backend.api.alignment_engine import compute_alignment
        from backend.api.advisor import generate_advice

        test_in = "Test input"
        test_out = "Test output"

        input_scores = analyze_input(test_in)
        output_scores = analyze_output(test_out)
        alignment = compute_alignment(input_scores, output_scores)
        advice = generate_advice(input_scores, output_scores, alignment)

        return {
            "status": "ok",
            "input_scores": input_scores,
            "output_scores": output_scores,
            "alignment": alignment,
            "advice": advice,
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/test/pipeline", tags=["test"])
async def test_pipeline():
    try:
        from backend.api.input_analyzer import analyze_input
        from backend.api.output_analyzer import analyze_output
        from backend.api.alignment_engine import compute_alignment
        from backend.api.advisor import generate_advice

        sample_input = "How can I protect my digital privacy?"
        sample_output = "Use strong passwords and avoid clicking unknown links."

        input_scores = analyze_input(sample_input)
        output_scores = analyze_output(sample_output)
        alignment = compute_alignment(input_scores, output_scores)
        advice = generate_advice(input_scores, output_scores, alignment)

        return {
            "input_text": sample_input,
            "output_text": sample_output,
            "input_scores": input_scores,
            "output_scores": output_scores,
            "alignment": alignment,
            "advice": advice,
        }

    except Exception as e:
        return {"error": str(e)}


# -------------------------------------------------
# Ana UI (chat arayüzü)
# -------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("chat.html", {"request": request})


# -------------------------------------------------
# /analyze – Tam E2E etik analiz (EZA-Core v5)
#  - chat.js burayı kullanır
# -------------------------------------------------

@app.post("/analyze")
async def analyze(req: AnalyzeRequest, request: Request):
    text = req.text or req.query or ""
    model = (req.model or "chatgpt").lower()
    mode = (req.mode or "standalone").lower()
    
    # Determine if full analysis should run (skip for proxy_fast mode)
    run_full_analysis = mode != "proxy_fast"

    # EZA-NarrativeEngine: Initialize narrative engine if not exists (single instance)
    if not hasattr(request.app.state, "narrative_engine"):
        request.app.state.narrative_engine = NarrativeEngine(max_memory=20)
    
    # Alias for backward compatibility (narrative = narrative_engine)
    if not hasattr(request.app.state, "narrative") or request.app.state.narrative is None:
        request.app.state.narrative = request.app.state.narrative_engine
    
    # Add user message to conversation memory (single instance)
    if text:
        try:
            request.app.state.narrative_engine.add_message("user", text)
        except Exception as e:
            # Log error but don't fail the request
            print(f"Warning: Could not add user message to narrative: {e}")

    # 1) Input analizi (niyet + risk + duygu)
    input_scores: Dict[str, Any] = analyze_input(text)
    
    # EZA-NarrativeEngine v3.0: Analyze context patterns in single text
    narrative_context_results = request.app.state.narrative_engine.analyze(text)
    
    # Add narrative context risk to input analysis
    if narrative_context_results.get("risk_score", 0.0) > 0.3:
        if "risk_flags" not in input_scores:
            input_scores["risk_flags"] = []
        input_scores["risk_flags"].extend(narrative_context_results.get("risk_flags", []))
        input_scores["risk_flags"] = list(set(input_scores["risk_flags"]))  # Unique
        # Update risk score if narrative context risk is higher
        current_risk = input_scores.get("risk_score", 0.0)
        narrative_context_risk = narrative_context_results.get("risk_score", 0.0)
        input_scores["risk_score"] = max(current_risk, narrative_context_risk)
    
    # EZA-NarrativeEngine v4.0: Analyze conversation flow (multi-turn)
    narrative_info = request.app.state.narrative_engine.analyze_flow()
    
    # Add narrative info to analysis
    input_scores["analysis"]["narrative"] = narrative_info
    
    # EZA-ReasoningShield v5.0: Analyze reasoning patterns (deception, unfair-persuasion, coercion, legal-risk)
    reasoning_results = request.app.state.reasoning_shield.analyze(
        text=text,
        intent_analysis=input_scores.get("intent_engine"),
        narrative=narrative_context_results,
    )
    
    # Add reasoning shield risk to input analysis
    if reasoning_results.get("risk_score", 0.0) > 0.3:
        if "risk_flags" not in input_scores:
            input_scores["risk_flags"] = []
        input_scores["risk_flags"].extend(reasoning_results.get("risk_flags", []))
        input_scores["risk_flags"] = list(set(input_scores["risk_flags"]))  # Unique
        # Update risk score if reasoning risk is higher
        current_risk = input_scores.get("risk_score", 0.0)
        reasoning_risk = reasoning_results.get("risk_score", 0.0)
        input_scores["risk_score"] = max(current_risk, reasoning_risk)
    
    # EZA-IdentityBlock v3.0: Analyze identity and personal data risks (with intent and reasoning context)
    identity_block_results = None
    if hasattr(request.app.state, "identity_block") and request.app.state.identity_block is not None:
        try:
            identity_block_results = request.app.state.identity_block.analyze(
                text=text,
                intent=input_scores.get("intent_engine"),
                reasoning=reasoning_results,
            )
        except Exception as e:
            identity_block_results = {
                "ok": False,
                "error": str(e),
                "summary": "IdentityBlock analysis failed."
            }
    else:
        identity_block_results = {
            "ok": False,
            "error": "IdentityBlock not initialized",
            "summary": "IdentityBlock analysis failed."
        }
    
    # Add identity risk to input analysis
    if identity_block_results and identity_block_results.get("ok", False):
        if identity_block_results.get("risk_score", 0.0) > 0.3:
            if "risk_flags" not in input_scores:
                input_scores["risk_flags"] = []
            input_scores["risk_flags"].extend(identity_block_results.get("risk_flags", []))
            input_scores["risk_flags"] = list(set(input_scores["risk_flags"]))  # Unique
            # Update risk score if identity risk is higher
            current_risk = input_scores.get("risk_score", 0.0)
            identity_risk = identity_block_results.get("risk_score", 0.0)
            input_scores["risk_score"] = max(current_risk, identity_risk)
    
    # EZA-NarrativeEngine v2.2: Analyze long conversation context (risk accumulation, intent drift, escalation)
    narrative_v2_results = request.app.state.narrative_engine.analyze_narrative(text)
    
    # Add narrative v2.2 risk to input analysis
    if narrative_v2_results.get("risk_score", 0.0) > 0.3:
        if "risk_flags" not in input_scores:
            input_scores["risk_flags"] = []
        # Add narrative-specific flags
        signals = narrative_v2_results.get("signals", {})
        if signals.get("escalation"):
            if "narrative-escalation" not in input_scores["risk_flags"]:
                input_scores["risk_flags"].append("narrative-escalation")
        if signals.get("intent_drift"):
            if "narrative-drift" not in input_scores["risk_flags"]:
                input_scores["risk_flags"].append("narrative-drift")
        if signals.get("hidden_agenda"):
            if "narrative-hidden-agenda" not in input_scores["risk_flags"]:
                input_scores["risk_flags"].append("narrative-hidden-agenda")
        # Update risk score if narrative v2.2 risk is higher
        current_risk = input_scores.get("risk_score", 0.0)
        narrative_v2_risk = narrative_v2_results.get("risk_score", 0.0)
        input_scores["risk_score"] = max(current_risk, narrative_v2_risk)
    
    # EZA-NarrativeEngine v2.2: Add current analysis to history (AFTER analysis, BEFORE adding to report)
    request.app.state.narrative_engine.add(
        text=text,
        intent=input_scores.get("intent_engine", {}),
        identity=identity_block_results if identity_block_results and identity_block_results.get("ok", False) else {},
        reasoning=reasoning_results,
    )
    
    # Risk birleştirme: narrative score'u risk_score'a ekle
    current_risk_score = input_scores.get("risk_score", 0.0)
    narrative_score = narrative_info.get("narrative_score", 0.0)
    input_scores["risk_score"] = max(current_risk_score, narrative_score)
    
    # Risk flags'e narrative-risk ekle
    if narrative_score > 0.5:
        if "risk_flags" not in input_scores:
            input_scores["risk_flags"] = []
        if "narrative-risk" not in input_scores["risk_flags"]:
            input_scores["risk_flags"].append("narrative-risk")

    # 2) Model cevabını al (simülasyon veya Knowledge Engine)
    # Standalone mode with Knowledge Engine
    if mode == "standalone":
        # Get intent from input analysis
        intent_primary = input_scores.get("intent_engine", {}).get("primary", "information")
        
        # 1) If intent is greeting → use greeting template
        if intent_primary == "greeting":
            greeting_response = request.app.state.response_composer.compose_greeting_response()
            model_outputs = {"chatgpt": greeting_response}
        else:
            # 2) For information questions → use Knowledge Engine
            knowledge_answer = request.app.state.knowledge_engine.answer_query(text)
            
            if knowledge_answer:
                # Compose natural response with correct intent
                risk_level = input_scores.get("risk_level", "safe")
                composed_answer = request.app.state.response_composer.compose_natural_response(
                    fact=knowledge_answer,
                    intent=intent_primary,
                    safety=risk_level
                )
                # Use composed answer as model output
                model_outputs = {"chatgpt": composed_answer}
            else:
                # 3) No knowledge found → use fallback
                fallback_response = request.app.state.response_composer.compose_fallback_response()
                model_outputs = {"chatgpt": fallback_response}
    elif model == "multi":
        model_outputs = await call_multi_models(text)
    else:
        out = await call_single_model(text, model_name=model, mode=mode)
        if out is None:
            # Standalone mode - already handled above
            pass
        else:
            model_outputs = {model: out}

    # 3) Output analizi – ilk model üzerinden (input_analysis ile)
    output_analyses: Dict[str, Any] = {}
    for model_name, output_text in model_outputs.items():
        output_analyses[model_name] = analyze_output(
            output_text, 
            model=model_name, 
            input_analysis=input_scores
        )

    if output_analyses:
        first_key = list(output_analyses.keys())[0]
        output_scores = output_analyses[first_key]
    else:
        output_scores = {
            "ok": True,
            "model": "unknown",
            "output_text": "",
            "risk_flags": [],
            "risk_score": 0.0,
            "risk_level": "low",
            "emotional_tone": "neutral",
            "analysis": {
                "quality_score": 50,
                "helpfulness": "Varsayılan analiz.",
                "safety_issues": [],
                "policy_violations": [],
                "summary": "Fallback output analysis.",
            },
            "error": None,
        }

    # 4) Alignment meta bilgisini hesapla (EZA v10.2)
    alignment_meta = compute_alignment(
        input_analysis=input_scores,
        output_analysis=output_scores,
    )
    
    # Frontend geriye sadece kısa label bekliyor, ama metayı da JSON'da dönebiliriz
    alignment_label = alignment_meta.get("label", "Unknown")
    
    # EZA-ReasoningShield v5.0: Central decision layer
    intent_engine_data = input_scores.get("intent_engine") or input_scores.get("intent_engine_data")
    narrative_info = input_scores.get("analysis", {}).get("narrative") or {}
    
    shield_result = request.app.state.reasoning_shield.evaluate(
        input_analysis=input_scores,
        output_analysis=output_scores,
        intent_engine=intent_engine_data,
        narrative_info=narrative_info,
    )
    
    # Add shield result to analysis
    input_scores["analysis"]["shield"] = shield_result
    
    # NOTE: Risk level override will be done AFTER EZA Score calculation
    # to ensure EZA Score uses original risk level, not overridden one

    # 5) Model cevabını ve tavsiyeyi üret
    # Burada örnek olarak tek model (chatgpt) çıktısını kullanıyoruz.
    # Eğer multi-model çalışıyorsan, uygun olanı seçebilirsin.
    if isinstance(model_outputs, dict):
        # demo: chatgpt ana model kabul edilsin
        raw_answer = model_outputs.get("chatgpt") or str(model_outputs)
    else:
        raw_answer = str(model_outputs)

    # EZA-NarrativeEngine: Add assistant response to memory (single instance)
    if hasattr(request.app.state, "narrative_engine"):
        try:
            if raw_answer:
                request.app.state.narrative_engine.add_message("assistant", raw_answer)
        except Exception as e:
            # Log error but don't fail the request
            print(f"Warning: Could not add assistant message to narrative: {e}")

    # 5) Model cevabını ve tavsiyeyi üret (temporary, will be updated after report is created)
    # Note: This is a temporary call, final advice will be generated after report is created
    advice_text_temp = generate_advice(input_scores, output_scores, alignment_meta)
    rewritten_text_temp = generate_rewritten_answer(raw_answer, advice_text_temp, alignment_meta, None)

    # 6) Log (temporary)
    log_event(
        "analyze_completed_v10.2",
        {
            "query": text,
            "models_used": list(model_outputs.keys()),
            "input_scores": input_scores,
            "model_outputs": model_outputs,
            "output_scores": output_scores,
            "alignment_meta": alignment_meta,
            "advice": advice_text_temp,
            "rewritten_text": rewritten_text_temp,
        },
    )

    risk_flags = input_scores.get("risk_flags", []) or []
    risk_level = input_scores.get("risk_level", "low")
    
    # EZA-ReasoningShield v5.0: Add eza_alignment to response
    shield_level = shield_result.get("level", "safe")
    shield_alignment_score = shield_result.get("alignment_score", 100)
    shield_issues = shield_result.get("issues", [])
    
    eza_alignment = {
        "level": shield_level,
        "alignment_score": shield_alignment_score,
        "issues": shield_issues,
    }

    # EZA Professional Reporting Layer v3.2: Build comprehensive report
    # NOTE: advisor_data will be updated later after build_standalone_response() is called
    advisor_data_temp = {
        "advice": advice_text_temp,
        "rewritten_text": rewritten_text_temp,
        "alignment_label": alignment_label,
    }
    
    report = request.app.state.report_builder.build(
        input_data=input_scores,
        output_data=output_scores,
        intent_data=input_scores.get("intent_engine", {}),
        narrative_data=input_scores.get("analysis", {}).get("narrative", {}),
        shield_data=shield_result,
        advisor_data=advisor_data_temp,
    )
    
    # EZA-IdentityBlock v3.0: Add identity analysis to report
    report["identity_block"] = identity_block_results
    
    # EZA-NarrativeEngine v3.0: Add context analysis to report
    report["narrative_context"] = narrative_context_results
    
    # EZA-NarrativeEngine: Analyze entire conversation (multi-turn analysis)
    narrative_results = None
    if hasattr(request.app.state, "narrative_engine") and request.app.state.narrative_engine is not None:
        try:
            narrative_results = request.app.state.narrative_engine.analyze()  # No text parameter = analyze entire conversation
        except Exception as e:
            narrative_results = {
                "ok": False,
                "error": str(e),
                "notes": "narrative-analysis-failed"
            }
    else:
        narrative_results = {"ok": False, "notes": "narrative-engine-not-initialized"}
    
    # EZA-NarrativeEngine v2.2: Add long-context narrative analysis to report
    report["narrative"] = narrative_results  # Multi-turn conversation analysis
    report["narrative_v2"] = narrative_v2_results  # Also keep for backward compatibility
    
    # EZA-ReasoningShield v5.0: Add reasoning analysis to report
    # shield_result contains the final weighted matrix evaluation (evaluate method)
    report["reasoning_shield"] = shield_result
    # Also include pattern-based reasoning analysis for detailed debugging
    report["reasoning_analysis"] = reasoning_results
    
    # Add legacy fields for backward compatibility
    report["language"] = input_scores.get("language")
    report["intents"] = input_scores.get("intent")
    report["intent"] = input_scores.get("intent")  # Also add as "intent" for frontend
    report["intent_engine"] = input_scores.get("intent_engine")  # Full intent engine data
    report["risk_level"] = risk_level
    report["risk_flags"] = risk_flags
    report["model_outputs"] = model_outputs
    report["alignment"] = alignment_label
    report["alignment_meta"] = alignment_meta  # Ensure alignment_meta is always present
    report["eza_alignment"] = eza_alignment
    report["advice"] = advice_text_temp  # Temporary advice, will be updated later
    
    # Frontend UI compatibility fields
    # Intent score for UI display
    report["intent_score"] = input_scores.get("intent_engine", {}).get("risk_score", 0.0) if isinstance(input_scores.get("intent_engine"), dict) else 0.0
    
    # Bias level (from critical_bias, will be added later in Level-7 section)
    # Safety level (from reasoning_shield final_risk_level, will be added after shield_result)
    
    # Ensure alignment_meta is not None/empty
    if not alignment_meta or not isinstance(alignment_meta, dict):
        alignment_meta = {
            "label": alignment_label,
            "score": eza_alignment.get("alignment_score", 100),
            "primary_intent": input_scores.get("intent", {}).get("primary", "information"),
            "master_risk_score": input_scores.get("risk_score", 0.0),
            "master_risk_level": risk_level,
        }
        report["alignment_meta"] = alignment_meta
    # NOTE: rewritten_text will be updated later after build_standalone_response() is called
    # report["rewritten_text"] = rewritten_text  # OLD - removed, will be set at line 862

    # EZA Level-6 Upgrade: Run new safety layers
    # Get memory from narrative engine for Level-6 modules
    narrative_memory = []
    if hasattr(request.app.state, "narrative_engine") and request.app.state.narrative_engine is not None:
        narrative_memory = getattr(request.app.state.narrative_engine, "memory", [])
    
    # a) Deception Engine
    if run_full_analysis:
        try:
            deception = request.app.state.deception_engine.analyze(
                text=text,
                report=report,
                memory=narrative_memory
            )
            report["deception"] = deception
        except Exception as e:
            print(f"Warning: DeceptionEngine analysis failed: {e}")
            report["deception"] = {
                "ok": False,
                "error": str(e),
                "score": 0.0,
                "level": "unknown",
                "flags": [],
                "summary": "Deception analysis failed."
            }
    else:
        # Fast mode: Skip detailed analysis
        report["deception"] = {"ok": False, "summary": "Skipped in fast mode"}
    
    # b) Psychological Pressure Detector
    if run_full_analysis:
        try:
            psychological_pressure = request.app.state.psych_pressure.analyze(
                text=text,
                memory=narrative_memory
            )
            report["psychological_pressure"] = psychological_pressure
        except Exception as e:
            print(f"Warning: PsychologicalPressureDetector analysis failed: {e}")
            report["psychological_pressure"] = {
                "ok": False,
                "error": str(e),
                "score": 0.0,
                "level": "unknown",
                "patterns": [],
                "summary": "Psychological pressure analysis failed."
            }
    else:
        report["psychological_pressure"] = {"ok": False, "summary": "Skipped in fast mode"}
    
    # c) Legal Risk Engine (needs deception and psychological_pressure in report)
    if run_full_analysis:
        try:
            legal_risk = request.app.state.legal_risk.analyze(report)
            report["legal_risk"] = legal_risk
        except Exception as e:
            print(f"Warning: LegalRiskEngine analysis failed: {e}")
            report["legal_risk"] = {
                "ok": False,
                "error": str(e),
                "score": 0.0,
                "level": "unknown",
                "categories": [],
                "summary": "Legal risk analysis failed."
            }
    else:
        report["legal_risk"] = {"ok": False, "summary": "Skipped in fast mode"}
    
    # d) Context Safety Graph
    if run_full_analysis:
        try:
            context_graph = request.app.state.context_graph.build(report)
            report["context_graph"] = context_graph
        except Exception as e:
            print(f"Warning: ContextSafetyGraph analysis failed: {e}")
            report["context_graph"] = {
                "ok": False,
                "error": str(e),
                "nodes": {},
                "edges": [],
                "summary": "Context graph building failed."
            }
    else:
        report["context_graph"] = {"ok": False, "summary": "Skipped in fast mode"}
    
    # e) Behavior Correlation Model
    if run_full_analysis:
        try:
            behavior_corr = request.app.state.behavior_correlation.analyze(
                memory=narrative_memory,
                report=report
            )
            report["behavior_correlation"] = behavior_corr
        except Exception as e:
            print(f"Warning: BehaviorCorrelationModel analysis failed: {e}")
            report["behavior_correlation"] = {
                "ok": False,
                "error": str(e),
                "trend_score": 0.0,
                "level": "unknown",
                "flags": [],
                "summary": "Behavior correlation analysis failed."
            }
    else:
        report["behavior_correlation"] = {"ok": False, "summary": "Skipped in fast mode"}
    
    # f) Ethical Gradient Engine (needs all previous Level-6 modules)
    if run_full_analysis:
        try:
            ethical = request.app.state.ethical_gradient.compute(report)
            report["ethical_gradient"] = ethical
        except Exception as e:
            print(f"Warning: EthicalGradientEngine computation failed: {e}")
            report["ethical_gradient"] = {
                "ok": False,
                "error": str(e),
                "ethical_score": 50.0,
                "grade": "C",
                "dimensions": {
                    "individual_harm": 0.0,
                    "societal_harm": 0.0,
                    "consent": 0.0,
                    "privacy": 0.0,
                    "legal": 0.0
                },
                "summary": "Ethical gradient computation failed."
            }
    else:
        report["ethical_gradient"] = {"ok": False, "summary": "Skipped in fast mode"}

    # LEVEL 7 – Critical Bias Engine
    if run_full_analysis:
        try:
            critical_bias_engine = request.app.state.critical_bias_engine

            # Mevcut verileri toparla
            input_text = report.get("input", {}).get("raw_text", text)  # text değişkeni varsa kullan
            model_outputs = report.get("model_outputs", {})

            intent_engine = report.get("intent_engine") or report.get("intent")
            context_graph = report.get("context_graph")

            critical_bias = critical_bias_engine.analyze(
                input_text=input_text,
                model_outputs=model_outputs,
                intent_engine=intent_engine,
                context_graph=context_graph,
            )
        except Exception as exc:  # güvenlik fallback
            critical_bias = {
                "bias_score": 0.0,
                "level": "low",
                "dimensions": {
                    "gender": 0.0,
                    "culture": 0.0,
                    "religion": 0.0,
                    "socioeconomic": 0.0,
                    "identity": 0.0,
                    "political": 0.0,
                },
                "flags": ["critical-bias-engine-error"],
                "summary": f"CriticalBiasEngine çalışırken hata oluştu: {exc}",
            }
    else:
        # Fast mode: Skip detailed bias analysis
        critical_bias = {"bias_score": 0.0, "level": "low", "summary": "Skipped in fast mode"}

    report["critical_bias"] = critical_bias

    # LEVEL 8 – Moral Compass Engine
    if run_full_analysis:
        try:
            moral_engine = request.app.state.moral_compass_engine

            input_text = report.get("input", {}).get("raw_text", text)
            model_outputs = report.get("model_outputs", {})

            intent_engine = report.get("intent_engine") or report.get("intent")
            context_graph = report.get("context_graph")

            moral_compass = moral_engine.analyze(
                input_text=input_text,
                model_outputs=model_outputs,
                intent_engine=intent_engine,
                context_graph=context_graph,
            )
        except Exception as exc:
            moral_compass = {
                "score": 0.0,
                "level": "low",
                "dimensions": {
                    "harm_care": 0.0,
                    "fairness": 0.0,
                    "honesty": 0.0,
                    "autonomy": 0.0,
                    "respect": 0.0,
                    "cultural_sensitivity": 0.0,
                },
                "flags": ["moral-compass-error"],
                "summary": f"MoralCompassEngine hatası: {exc}",
            }
    else:
        moral_compass = {"score": 0.0, "level": "low", "summary": "Skipped in fast mode"}

    report["moral_compass"] = moral_compass

    # LEVEL 9 – Abuse & Coercion Engine
    if run_full_analysis:
        try:
            abuse_engine = request.app.state.abuse_engine

            input_text = report.get("input", {}).get("raw_text", text)
            model_outputs = report.get("model_outputs", {})

            intent_engine = report.get("intent_engine") or report.get("intent")
            context_graph = report.get("context_graph")

            abuse = abuse_engine.analyze(
                input_text=input_text,
                model_outputs=model_outputs,
                intent_engine=intent_engine,
                context_graph=context_graph,
            )
        except Exception as exc:
            abuse = {
                "score": 0.0,
                "level": "low",
                "dimensions": {
                    "harassment": 0.0,
                    "threat": 0.0,
                    "coercion": 0.0,
                    "blackmail": 0.0,
                    "grooming": 0.0,
                },
                "flags": ["abuse-engine-error"],
                "summary": f"AbuseEngine hatası: {exc}",
            }
    else:
        abuse = {"score": 0.0, "level": "low", "summary": "Skipped in fast mode"}

    report["abuse"] = abuse

    # LEVEL 10 – Memory Consistency Engine
    if run_full_analysis:
        try:
            mem_engine = request.app.state.memory_consistency_engine

            # Build memory_context from narrative engine
            memory_context = None
            if hasattr(request.app.state, "narrative_engine") and request.app.state.narrative_engine is not None:
                narrative_memory = getattr(request.app.state.narrative_engine, "memory", [])
                if narrative_memory:
                    past_user_messages = [m.get("text", "") for m in narrative_memory if m.get("role") == "user"]
                    past_model_messages = [m.get("text", "") for m in narrative_memory if m.get("role") == "assistant"]
                    memory_context = {
                        "past_user_messages": past_user_messages,
                        "past_model_messages": past_model_messages,
                    }
            
            # Fallback to report memory_context if available
            if not memory_context:
                memory_context = report.get("memory_context")
            
            model_outputs = report.get("model_outputs", {})

            memory_consistency = mem_engine.analyze(
                memory_context=memory_context,
                model_outputs=model_outputs,
            )
        except Exception as exc:
            memory_consistency = {
                "score": 0.0,
                "level": "low",
                "dimensions": {
                    "policy_consistency": 0.0,
                    "self_contradiction": 0.0,
                    "knowledge_drift": 0.0,
                    "user_fact_inconsistency": 0.0,
                },
                "flags": ["memory-engine-error"],
                "summary": f"MemoryConsistencyEngine hatası: {exc}",
            }
    else:
        memory_consistency = {"score": 0.0, "level": "low", "summary": "Skipped in fast mode"}

    report["memory_consistency"] = memory_consistency

    # EZA Level-5 Upgrade: Compute drift matrix, EZA score, and final verdict
    # Enhance memory entries with report data for drift analysis
    # If memory entries don't have report data, add current report to enable drift tracking
    if narrative_memory and "report" not in narrative_memory[-1]:
        narrative_memory[-1]["report"] = report
    
    drift = request.app.state.drift.compute(narrative_memory)
    
    # EZA Score v2.0: Add input_analysis to report for score calculation
    # Score is calculated ONLY from user message (input), not from EZA response (output)
    report["input_analysis"] = input_scores
    
    score = request.app.state.eza_score.compute(report, drift)
    final_verdict = request.app.state.verdict.generate(report, score, drift)
    
    report["drift_matrix"] = drift
    report["eza_score"] = score
    report["final_verdict"] = final_verdict
    
    # EZA-ReasoningShield v5.0: Risk level override AFTER EZA Score calculation
    # This ensures EZA Score uses original risk level, then we override for final report
    shield_score = shield_result.get("alignment_score", 100)
    current_risk_score = input_scores.get("risk_score", 0.0)
    
    # alignment_score düşükse, risk_score'u yukarı çek (report'a yaz, input_scores'a değil)
    if shield_score <= 20:
        report["risk_level"] = "critical"
        report["risk_score"] = max(current_risk_score, 0.9)
    elif shield_score <= 50:
        if report.get("risk_level") not in ["critical", "high"]:
            report["risk_level"] = "high"
        report["risk_score"] = max(current_risk_score, 0.6)
    elif shield_score <= 70:
        if report.get("risk_level") not in ["critical", "high"]:
            report["risk_level"] = "medium"

    # 5b) Generate advice with final_verdict (using new dynamic template system)
    # Pass report as separate parameter to avoid circular reference
    advice_text = generate_advice(input_scores, output_scores, alignment_meta, report)
    
    # Use build_standalone_response for standalone mode (new dynamic template system)
    try:
        rewritten_text = build_standalone_response(report, raw_answer, mode)
    except Exception as e:
        # Fallback if build_standalone_response fails
        import traceback
        print(f"ERROR in build_standalone_response: {e}")
        print(traceback.format_exc())
        # Use simple fallback - get model_output from report
        fallback_output = raw_answer or ""
        if not fallback_output:
            report_model_outputs = report.get("model_outputs", {})
            if isinstance(report_model_outputs, dict):
                fallback_output = report_model_outputs.get("chatgpt", "") or (list(report_model_outputs.values())[0] if report_model_outputs else "")
            else:
                fallback_output = str(report_model_outputs) if report_model_outputs else ""
        rewritten_text = f"{fallback_output}\n\n[EZA Advisory]\nEtik analiz tamamlandı."
    
    # CRITICAL: Update report with final advice and rewritten text
    # Update both report["advisor"] and report["rewritten_text"]
    report["advisor"] = {
        "advice": advice_text,
        "rewritten_text": rewritten_text,
        "alignment_label": alignment_label,
    }
    
    # CRITICAL: Update report["rewritten_text"] with the new value
    report["rewritten_text"] = rewritten_text
    
    # Frontend UI compatibility: Add safety and bias fields
    # Safety level from reasoning_shield (use "low" as default for safe intents)
    safety_level = shield_result.get("final_risk_level") or shield_result.get("level") or risk_level
    # If intent is greeting/information and no risk detected, force "low"
    primary_intent = input_scores.get("intent", {}).get("primary", "information")
    if primary_intent in ["greeting", "information"] and risk_level == "low":
        safety_level = "low"
    report["safety"] = safety_level if safety_level != "none" else "low"
    
    # Bias level from critical_bias (if available)
    if "critical_bias" in report and report["critical_bias"]:
        bias_data = report["critical_bias"]
        if isinstance(bias_data, dict):
            report["bias"] = bias_data.get("level", "low")
        else:
            report["bias"] = "low"
    else:
        report["bias"] = "low"  # Default to low if no bias detected

    # 7) Log risk report to file
    import json
    import os
    
    # Ensure logs directory exists
    os.makedirs("logs", exist_ok=True)
    
    # Append to risk log file
    try:
        with open("logs/eza_risk_log.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(report, ensure_ascii=False) + "\n")
    except Exception as e:
        # Log error but don't fail the request
        print(f"Warning: Could not write to risk log: {e}")
    
    # 8) Return standardized JSON report
    return JSONResponse(report)


# -------------------------------------------------
# /pair – Sadece soru + cevap uyumu testi (v5)
# -------------------------------------------------

@app.post("/pair")
async def pair(req: PairRequest):
    input_scores = analyze_input(req.input_text)
    output_scores = evaluate_output(req.output_text)

    alignment_result = compute_alignment(
        input_analysis=input_scores,
        output_analysis=output_scores,
    )

    return {
        "alignment_score": alignment_result.get("alignment_score", 0.0),
        "alignment_label": alignment_result.get("verdict", "unknown"),
        "details": alignment_result.get("details", {}),
    }


# -------------------------------------------------
# /dashboard – Şimdilik basit HTML placeholder
#  - api_test sadece HTML döndüğünü kontrol ediyor
# -------------------------------------------------

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    # İleride burada gerçek grafikler olacak (Supabase verisiyle).
    html = """
    <html>
      <head><title>EZA Dashboard</title></head>
      <body>
        <h1>EZA-Core v4.0 – Dashboard (Placeholder)</h1>
        <p>Burada ileride alignment trendleri, risk dağılımı ve model kıyas grafikleri gösterilecek.</p>
      </body>
    </html>
    """
    return HTMLResponse(content=html)


# -------------------------------------------------
# /lab – EZA LAB Dashboard (Web Panel)
# -------------------------------------------------

@app.get("/lab", response_class=HTMLResponse)
async def lab_dashboard(request: Request):
    """Serve EZA LAB Dashboard"""
    import os
    lab_path = os.path.join("frontend", "lab", "index.html")
    
    try:
        with open(lab_path, "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except FileNotFoundError:
        return HTMLResponse(
            content="<h1>EZA LAB Dashboard not found</h1><p>Please ensure frontend/lab/index.html exists.</p>",
            status_code=404
        )


# -------------------------------------------------
# /standalone_chat – Standalone Mode Endpoint
# -------------------------------------------------

@app.post("/standalone_chat")
async def standalone_chat(req: AnalyzeRequest, request: Request):
    """
    Standalone mode endpoint - EZA generates its own response without LLM.
    """
    text = req.text or req.query or ""
    
    if not text:
        return JSONResponse(
            {"ok": False, "error": "Text is required"},
            status_code=400
        )
    
    # Run pipeline in standalone mode
    report = await run_pipeline(text, "standalone", request)
    
    return JSONResponse(report)


# -------------------------------------------------
# /proxy_fast – Proxy Fast Mode Endpoint
# -------------------------------------------------

@app.post("/proxy_fast")
async def proxy_fast(req: AnalyzeRequest, request: Request):
    """
    Proxy Fast mode endpoint - LLM call + Light analysis (Level 1-5 only).
    """
    text = req.text or req.query or ""
    
    if not text:
        return JSONResponse(
            {"ok": False, "error": "Text is required"},
            status_code=400
        )
    
    # Run pipeline in proxy_fast mode
    report = await run_pipeline(text, "proxy_fast", request)
    
    return JSONResponse(report)


# -------------------------------------------------
# /proxy_deep – Proxy Deep Mode Endpoint
# -------------------------------------------------

@app.post("/proxy_deep")
async def proxy_deep(req: AnalyzeRequest, request: Request):
    """
    Proxy Deep mode endpoint - LLM call + Full analysis (Level 1-10).
    """
    text = req.text or req.query or ""
    
    if not text:
        return JSONResponse(
            {"ok": False, "error": "Text is required"},
            status_code=400
        )
    
    # Run pipeline in proxy_deep mode
    report = await run_pipeline(text, "proxy_deep", request)
    
    return JSONResponse(report)


# -------------------------------------------------
# /proxy_chat – Proxy Normal Mode Endpoint (Updated)
# -------------------------------------------------

@app.post("/proxy_chat")
async def proxy_chat(req: AnalyzeRequest, request: Request):
    """
    Proxy Normal mode endpoint - LLM call + Full analysis (default proxy mode).
    """
    text = req.text or req.query or ""
    
    if not text:
        return JSONResponse(
            {"ok": False, "error": "Text is required"},
            status_code=400
        )
    
    # Run pipeline in proxy mode (normal = full analysis)
    report = await run_pipeline(text, "proxy", request)
    
    return JSONResponse(report)


