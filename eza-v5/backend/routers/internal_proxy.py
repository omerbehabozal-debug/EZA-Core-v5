# -*- coding: utf-8 -*-
"""
Internal Proxy Router - Full Debug Pipeline for EZA Internal Team
"""

import uuid
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.api_key import require_api_key
from backend.gateway.router_adapter import call_llm_provider
from backend.config import get_settings
from backend.regulation.policy_packs.rtuk_pack import RTUKPolicyPack
from backend.regulation.policy_packs.btk_pack import BTKPolicyPack
from backend.regulation.policy_packs.eu_ai_pack import EUAIPolicyPack
from backend.regulation.policy_packs.oecd_pack import OECDPolicyPack
from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment
from backend.core.engines.score_engine import compute_score
from backend.core.engines.deception_engine import analyze_deception
from backend.core.engines.psych_pressure import analyze_psychological_pressure
from backend.core.engines.legal_risk import analyze_legal_risk
from backend.core.engines.safety_graph import build_safety_graph

router = APIRouter(prefix="/api/internal", tags=["proxy-internal"])

# In-memory session storage (TODO: Replace with database in production)
session_store: Dict[str, Dict[str, Any]] = {}


class ProxyInternalRequest(BaseModel):
    text: str
    mode: str = "proxy_internal"
    provider: str = "openai"
    model: Optional[str] = None
    policy_pack: str = "eu_ai"


class ProxyInternalResponse(BaseModel):
    request_id: str
    timestamp: str
    input: Dict[str, Any]
    models: Dict[str, Any]
    analysis: Dict[str, Any]
    timings: Dict[str, Any]
    flags: Dict[str, Any]
    raw: Dict[str, Any]


class HistoryItem(BaseModel):
    id: str
    created_at: str
    input_text: str
    risk_level: str
    eza_score: float
    summary: str


async def run_debug_pipeline(
    text: str,
    provider: str = "openai",
    model: Optional[str] = None,
    policy_pack: str = "eu_ai"
) -> Dict[str, Any]:
    """
    Run full debug pipeline with all analysis engines
    Returns complete debug payload
    """
    request_id = str(uuid.uuid4())
    start_time = time.time()
    timings = {
        "model_calls": {},
        "analysis_ms": {}
    }
    logs = []
    
    # Input processing
    input_start = time.time()
    normalized_text = text.strip()
    input_analysis = analyze_input(normalized_text)
    input_time = (time.time() - input_start) * 1000
    timings["analysis_ms"]["input_analysis"] = input_time
    logs.append({"step": "input_analysis", "ms": input_time})
    
    # Model routing decision (simplified)
    router_decision = {
        "selected_provider": provider,
        "selected_model": model or "gpt-3.5-turbo",
        "reason": "manual_selection"
    }
    used_models = [provider]
    model_outputs = {}
    
    # LLM call
    model_start = time.time()
    try:
        settings = get_settings()
        output = await call_llm_provider(
            provider_name=provider,
            prompt=normalized_text,
            settings=settings,
            model=model
        )
        model_outputs[provider] = output
        model_time = (time.time() - model_start) * 1000
        timings["model_calls"][provider] = model_time
        logs.append({"step": f"model_call_{provider}", "ms": model_time})
    except Exception as e:
        output = f"[Error: {str(e)}]"
        model_outputs[provider] = output
        logs.append({"step": f"model_call_{provider}", "error": str(e)})
    
    # Output analysis
    output_start = time.time()
    output_analysis = analyze_output(output, input_analysis)
    output_time = (time.time() - output_start) * 1000
    timings["analysis_ms"]["output_analysis"] = output_time
    logs.append({"step": "output_analysis", "ms": output_time})
    
    # Alignment
    alignment_start = time.time()
    alignment_result = compute_alignment(input_analysis, output_analysis)
    alignment_time = (time.time() - alignment_start) * 1000
    timings["analysis_ms"]["alignment"] = alignment_time
    logs.append({"step": "alignment", "ms": alignment_time})
    
    # EZA Score
    score_start = time.time()
    eza_score = compute_score(input_analysis, output_analysis, alignment_result)
    score_time = (time.time() - score_start) * 1000
    timings["analysis_ms"]["eza_score"] = score_time
    logs.append({"step": "eza_score", "ms": score_time})
    
    # Policy pack evaluation
    policy_start = time.time()
    policy_pack_map = {
        "rtuk": RTUKPolicyPack(),
        "btk": BTKPolicyPack(),
        "eu_ai": EUAIPolicyPack(),
        "oecd": OECDPolicyPack()
    }
    selected_policy = policy_pack_map.get(policy_pack, EUAIPolicyPack())
    meta = {
        "eza_score": eza_score,
        "input_analysis": input_analysis,
        "output_analysis": output_analysis,
        "alignment": alignment_result
    }
    policy_result = selected_policy.evaluate(
        input_text=normalized_text,
        output_text=output,
        meta=meta
    )
    policy_time = (time.time() - policy_start) * 1000
    timings["analysis_ms"]["policy_evaluation"] = policy_time
    logs.append({"step": "policy_evaluation", "ms": policy_time})
    
    # Deep analysis engines (optional, can be slow)
    deception_result = None
    psych_pressure_result = None
    legal_risk_result = None
    context_graph_result = None
    
    try:
        deception_start = time.time()
        deception_result = analyze_deception(output, {
            "input": {"raw_text": normalized_text, "analysis": input_analysis},
            "output": {"raw_text": output, "analysis": output_analysis},
            "alignment": alignment_result
        }, memory=None)
        deception_time = (time.time() - deception_start) * 1000
        timings["analysis_ms"]["deception"] = deception_time
        logs.append({"step": "deception", "ms": deception_time})
    except Exception as e:
        logs.append({"step": "deception", "error": str(e)})
    
    try:
        psych_start = time.time()
        psych_pressure_result = analyze_psychological_pressure(output, memory=None)
        psych_time = (time.time() - psych_start) * 1000
        timings["analysis_ms"]["psychological_pressure"] = psych_time
        logs.append({"step": "psychological_pressure", "ms": psych_time})
    except Exception as e:
        logs.append({"step": "psychological_pressure", "error": str(e)})
    
    try:
        legal_start = time.time()
        legal_risk_result = analyze_legal_risk(normalized_text, output)
        legal_time = (time.time() - legal_start) * 1000
        timings["analysis_ms"]["legal_risk"] = legal_time
        logs.append({"step": "legal_risk", "ms": legal_time})
    except Exception as e:
        logs.append({"step": "legal_risk", "error": str(e)})
    
    try:
        graph_start = time.time()
        context_graph_result = build_safety_graph(input_analysis, output_analysis, alignment_result)
        graph_time = (time.time() - graph_start) * 1000
        timings["analysis_ms"]["context_graph"] = graph_time
        logs.append({"step": "context_graph", "ms": graph_time})
    except Exception as e:
        logs.append({"step": "context_graph", "error": str(e)})
    
    # Calculate total time
    total_time = (time.time() - start_time) * 1000
    timings["total_ms"] = total_time
    
    # Determine risk level and safety level
    final_score = eza_score.get("final_score", 50.0)
    if final_score >= 80:
        risk_level = "low"
        safety_level = "safe"
    elif final_score >= 60:
        risk_level = "medium"
        safety_level = "caution"
    else:
        risk_level = "high"
        safety_level = "block"
    
    # Build full response
    response = {
        "request_id": request_id,
        "timestamp": datetime.utcnow().isoformat(),
        "input": {
            "raw_text": normalized_text,
            "normalized_text": normalized_text,
            "language": input_analysis.get("language", "en"),
            "tokens": len(normalized_text.split()) if normalized_text else 0,
        },
        "models": {
            "router_decision": router_decision,
            "used_models": used_models,
            "model_outputs": model_outputs,
        },
        "analysis": {
            "input_analysis": input_analysis,
            "output_analysis": output_analysis,
            "alignment_result": alignment_result,
            "eza_score": eza_score,
            "deception": deception_result,
            "psychological_pressure": psych_pressure_result,
            "legal_risk": legal_risk_result,
            "context_graph": context_graph_result,
        },
        "timings": timings,
        "flags": {
            "risk_level": risk_level,
            "safety_level": safety_level,
            "route": "proxy_internal",
        },
        "raw": {
            "input_analysis_raw": input_analysis,
            "output_analysis_raw": output_analysis,
            "alignment_raw": alignment_result,
            "eza_score_raw": eza_score,
            "all_logs": logs,
        }
    }
    
    # Store session
    session_store[request_id] = {
        "id": request_id,
        "created_at": response["timestamp"],
        "input_text": normalized_text[:100],  # First 100 chars for summary
        "risk_level": risk_level,
        "eza_score": final_score,
        "summary": alignment_result.get("label", "Unknown"),
        "full_data": response
    }
    
    return response


@router.post("/run", response_model=ProxyInternalResponse)
async def run_proxy_internal(
    req: ProxyInternalRequest,
    _: str = require_api_key()  # API key required
):
    """
    Full Internal Proxy API
    - Only accessible by EZA internal team (admin/internal roles)
    - Returns full debug payload for the given input
    """
    try:
        result = await run_debug_pipeline(
            text=req.text,
            provider=req.provider,
            model=req.model,
            policy_pack=req.policy_pack
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")


@router.get("/history")
async def list_proxy_internal_history(
    limit: int = 20,
    _: str = require_api_key()  # API key required
):
    """
    Return last N internal proxy sessions (for sidebar history list).
    """
    sessions = list(session_store.values())
    # Sort by created_at descending
    sessions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    sessions = sessions[:limit]
    
    return [
        {
            "id": s["id"],
            "created_at": s["created_at"],
            "input_text": s["input_text"],
            "risk_level": s["risk_level"],
            "eza_score": s["eza_score"],
            "summary": s["summary"]
        }
        for s in sessions
    ]


@router.get("/session/{session_id}")
async def get_proxy_internal_session(
    session_id: str,
    _: str = require_api_key()  # API key required
):
    """
    Return full debug data for a specific session.
    """
    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session_store[session_id]["full_data"]

