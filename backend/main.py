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
from backend.api.advisor import generate_advice, generate_rewritten_answer
from backend.api.narrative_engine import NarrativeEngine
from backend.api.reasoning_shield import ReasoningShield
from backend.api.report_builder import ReportBuilder
from backend.api.identity_block import IdentityBlock
from backend.api.utils.model_runner import (
    call_single_model,
    call_multi_models,
    rewrite_with_ethics,
)

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

# --- NarrativeEngine v4.0: Initialize conversation memory ---
if not hasattr(app.state, "narrative_engine"):
    app.state.narrative_engine = NarrativeEngine(max_memory=10)

# --- EZA-NarrativeEngine v2.2: Initialize long-context narrative engine ---
if not hasattr(app.state, "narrative"):
    app.state.narrative = NarrativeEngine()

# --- ReasoningShield v5.0: Initialize central decision layer ---
if not hasattr(app.state, "reasoning_shield"):
    app.state.reasoning_shield = ReasoningShield()

# --- EZA Professional Reporting Layer v3.2: Initialize report builder ---
if not hasattr(app.state, "report_builder"):
    app.state.report_builder = ReportBuilder()

# --- EZA IdentityBlock v3.0: Initialize identity protection layer ---
if not hasattr(app.state, "identity_block"):
    app.state.identity_block = IdentityBlock()

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

    # EZA-NarrativeEngine v4.0: Add user message to conversation memory
    if not hasattr(request.app.state, "narrative_engine"):
        request.app.state.narrative_engine = NarrativeEngine(max_memory=10)
    
    request.app.state.narrative_engine.add_message("user", text)

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
    identity_results = request.app.state.identity_block.analyze(
        text=text,
        intent=input_scores.get("intent_engine"),
        reasoning=reasoning_results,
    )
    
    # Add identity risk to input analysis
    if identity_results.get("risk_score", 0.0) > 0.3:
        if "risk_flags" not in input_scores:
            input_scores["risk_flags"] = []
        input_scores["risk_flags"].extend(identity_results.get("risk_flags", []))
        input_scores["risk_flags"] = list(set(input_scores["risk_flags"]))  # Unique
        # Update risk score if identity risk is higher
        current_risk = input_scores.get("risk_score", 0.0)
        identity_risk = identity_results.get("risk_score", 0.0)
        input_scores["risk_score"] = max(current_risk, identity_risk)
    
    # EZA-NarrativeEngine v2.2: Analyze long conversation context (risk accumulation, intent drift, escalation)
    narrative_v2_results = request.app.state.narrative.analyze_narrative(text)
    
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
    request.app.state.narrative.add(
        text=text,
        intent=input_scores.get("intent_engine", {}),
        identity=identity_results,
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

    # 2) Model cevabını al (simülasyon)
    if model == "multi":
        model_outputs = call_multi_models(text)
    else:
        out = call_single_model(text, model_name=model)
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
    
    # Genel risk skorunu shield ile senkronize et
    shield_score = shield_result.get("alignment_score", 100)
    current_risk_score = input_scores.get("risk_score", 0.0)
    
    # alignment_score düşükse, risk_score'u yukarı çek
    if shield_score <= 20:
        input_scores["risk_score"] = max(current_risk_score, 0.9)
        input_scores["risk_level"] = "critical"
    elif shield_score <= 50:
        input_scores["risk_score"] = max(current_risk_score, 0.6)
        if input_scores.get("risk_level") not in ["critical", "high"]:
            input_scores["risk_level"] = "high"
    elif shield_score <= 70:
        if input_scores.get("risk_level") not in ["critical", "high"]:
            input_scores["risk_level"] = "medium"

    # 5) Model cevabını ve tavsiyeyi üret
    # Burada örnek olarak tek model (chatgpt) çıktısını kullanıyoruz.
    # Eğer multi-model çalışıyorsan, uygun olanı seçebilirsin.
    if isinstance(model_outputs, dict):
        # demo: chatgpt ana model kabul edilsin
        raw_answer = model_outputs.get("chatgpt") or str(model_outputs)
    else:
        raw_answer = str(model_outputs)

    # EZA-NarrativeEngine v4.0: Add assistant response to memory
    if hasattr(request.app.state, "narrative_engine"):
        request.app.state.narrative_engine.add_message("assistant", raw_answer)

    advice_text = generate_advice(input_scores, output_scores, alignment_meta)
    rewritten_text = generate_rewritten_answer(raw_answer, advice_text, alignment_meta)

    # 6) Log
    log_event(
        "analyze_completed_v10.2",
        {
            "query": text,
            "models_used": list(model_outputs.keys()),
            "input_scores": input_scores,
            "model_outputs": model_outputs,
            "output_scores": output_scores,
            "alignment_meta": alignment_meta,
            "advice": advice_text,
            "rewritten_text": rewritten_text,
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
    advisor_data = {
        "advice": advice_text,
        "rewritten_text": rewritten_text,
        "alignment_label": alignment_label,
    }
    
    report = request.app.state.report_builder.build(
        input_data=input_scores,
        output_data=output_scores,
        intent_data=input_scores.get("intent_engine", {}),
        narrative_data=input_scores.get("analysis", {}).get("narrative", {}),
        shield_data=shield_result,
        advisor_data=advisor_data,
    )
    
    # EZA-IdentityBlock v3.0: Add identity analysis to report
    report["identity"] = identity_results
    
    # EZA-NarrativeEngine v3.0: Add context analysis to report
    report["narrative_context"] = narrative_context_results
    
    # EZA-NarrativeEngine v2.2: Add long-context narrative analysis to report
    report["narrative"] = narrative_v2_results
    report["narrative_v2"] = narrative_v2_results  # Also keep for backward compatibility
    
    # EZA-ReasoningShield v5.0: Add reasoning analysis to report
    report["reasoning_shield"] = reasoning_results
    
    # Add legacy fields for backward compatibility
    report["language"] = input_scores.get("language")
    report["intents"] = input_scores.get("intent")
    report["risk_level"] = risk_level
    report["risk_flags"] = risk_flags
    report["model_outputs"] = model_outputs
    report["alignment"] = alignment_label
    report["alignment_meta"] = alignment_meta
    report["eza_alignment"] = eza_alignment
    report["advice"] = advice_text
    report["rewritten_text"] = rewritten_text

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


