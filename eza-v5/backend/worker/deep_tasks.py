# -*- coding: utf-8 -*-
"""
Deep Learning Tasks (Async Background Jobs)
"""

from typing import Dict, Any
from backend.core.engines.deception_engine import analyze_deception
from backend.core.engines.psych_pressure import analyze_psychological_pressure
from backend.core.engines.safety_graph import build_safety_graph
from backend.core.engines.drift_detector import detect_drift
from backend.core.engines.legal_risk import analyze_legal_risk
from backend.learning.extractor import extract_patterns
from backend.learning.trainer import update_risk_model


async def run_deep_analysis(
    raw_output: str,
    safe_output: str,
    analysis_signatures: Dict[str, Any]
):
    """
    Run full deep analysis pipeline
    This runs in background after Fast Pipeline returns response
    """
    input_analysis = analysis_signatures.get("input_analysis", {})
    output_analysis = analysis_signatures.get("output_analysis", {})
    alignment = analysis_signatures.get("alignment", {})
    
    # Build report for deep analysis
    report = {
        "input": {"raw_text": "", "analysis": input_analysis},
        "output": {"raw_text": raw_output, "analysis": output_analysis},
        "alignment": alignment
    }
    
    # 1. Deception engine (deep)
    deception_result = analyze_deception(
        raw_output,
        report,
        memory=None  # TODO: Load from conversation history
    )
    
    # 2. Psychological pressure (deep)
    psych_pressure_result = analyze_psychological_pressure(
        raw_output,
        memory=None  # TODO: Load from conversation history
    )
    
    # 3. Safety graph (full nodes)
    safety_graph_result = build_safety_graph(
        input_analysis,
        output_analysis,
        alignment
    )
    
    # 4. Drift detector (history-aware)
    drift_result = detect_drift(
        input_analysis,
        history=None  # TODO: Load from conversation history
    )
    
    # 5. Legal risk (deep)
    legal_risk_result = analyze_legal_risk(
        input_analysis,
        output_analysis,
        report
    )
    
    # 6. Pattern extraction (vector ops)
    patterns = await extract_patterns(
        input_analysis,
        output_analysis,
        report
    )
    
    # 7. Learning engine trainer
    await update_risk_model(
        patterns,
        report
    )
    
    # Store results (without user data)
    deep_analysis_result = {
        "deception": deception_result,
        "psych_pressure": psych_pressure_result,
        "safety_graph": safety_graph_result,
        "drift": drift_result,
        "legal_risk": legal_risk_result,
        "patterns": patterns
    }
    
    # TODO: Store in vector DB for learning
    # vector_store.store_pattern(patterns)
    
    return deep_analysis_result

