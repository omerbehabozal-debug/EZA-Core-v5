# -*- coding: utf-8 -*-
"""
Telemetry Service
Service layer for recording telemetry events from pipeline
"""

from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from backend.telemetry.repository import create_event
from backend.telemetry.schemas import TelemetryEventCreate

logger = logging.getLogger(__name__)


async def record_telemetry_event(
    pipeline_result: Dict[str, Any],
    mode: str,
    source: str,
    db_session: AsyncSession,
    user_input: Optional[str] = None
) -> None:
    """
    Record a telemetry event from pipeline result
    
    Args:
        pipeline_result: Result dictionary from run_full_pipeline()
        mode: Pipeline mode (standalone, proxy, proxy-lite)
        source: Event source (e.g., "standalone-api", "proxy-api")
        db_session: Database session
        user_input: User input text (optional, will try to extract from pipeline_result if not provided)
    
    Returns:
        None (raises exception on failure, but should be caught by caller)
    """
    try:
        # Extract user_input - prefer provided parameter, then try to get from pipeline_result
        if not user_input:
            if "data" in pipeline_result and pipeline_result["data"]:
                if "input_analysis" in pipeline_result["data"]:
                    input_analysis = pipeline_result["data"]["input_analysis"]
                    if isinstance(input_analysis, dict) and "raw_text" in input_analysis:
                        user_input = input_analysis["raw_text"]
            
            # Fallback: try to get from pipeline_result directly
            if not user_input:
                user_input = pipeline_result.get("user_input", "[User input not tracked]")
        
        # Extract safe_answer
        safe_answer = None
        if "data" in pipeline_result and pipeline_result["data"]:
            safe_answer = pipeline_result["data"].get("safe_answer")
        
        # Extract eza_score
        eza_score = pipeline_result.get("eza_score")
        
        # Extract risk_level
        risk_level = pipeline_result.get("risk_level")
        
        # Extract policy_violations
        policy_violations = pipeline_result.get("policy_violations")
        if policy_violations:
            # Convert to list of strings if needed
            if isinstance(policy_violations, list):
                policy_violations = [
                    str(v) if not isinstance(v, str) else v
                    for v in policy_violations
                ]
        
        # Extract model_votes (which models were used)
        model_votes = None
        if "data" in pipeline_result and pipeline_result["data"]:
            data = pipeline_result["data"]
            # Check for skipped_models or used_models
            if "skipped_models" in data or "used_models" in data:
                model_votes = {
                    "skipped_models": data.get("skipped_models", []),
                    "used_models": data.get("used_models", [])
                }
        
        # Extract meta (alignment, deep_analysis summaries)
        meta = {}
        if "data" in pipeline_result and pipeline_result["data"]:
            data = pipeline_result["data"]
            
            # Add alignment summary
            if "alignment" in data:
                alignment = data["alignment"]
                if isinstance(alignment, dict):
                    meta["alignment"] = {
                        "verdict": alignment.get("verdict"),
                        "alignment_score": alignment.get("alignment_score"),
                        "label": alignment.get("label")
                    }
            
            # Add deep_analysis summary (for proxy mode)
            if "deep_analysis" in data and data["deep_analysis"]:
                deep_analysis = data["deep_analysis"]
                meta["deep_analysis"] = {}
                if "deception" in deep_analysis and deep_analysis["deception"]:
                    meta["deep_analysis"]["deception_score"] = deep_analysis["deception"].get("score")
                if "legal_risk" in deep_analysis and deep_analysis["legal_risk"]:
                    meta["deep_analysis"]["legal_risk_score"] = deep_analysis["legal_risk"].get("risk_score")
                if "psych_pressure" in deep_analysis and deep_analysis["psych_pressure"]:
                    meta["deep_analysis"]["psych_pressure_score"] = deep_analysis["psych_pressure"].get("score")
            
            # Add safety_label
            if "safety_label" in data:
                meta["safety_label"] = data["safety_label"]
        
        # Add eza_score_breakdown summary
        if "eza_score_breakdown" in pipeline_result and pipeline_result["eza_score_breakdown"]:
            breakdown = pipeline_result["eza_score_breakdown"]
            if isinstance(breakdown, dict):
                meta["score_breakdown"] = {
                    "base_score": breakdown.get("base_score"),
                    "final_score": breakdown.get("final_score"),
                    "safety_level": breakdown.get("safety_level")
                }
        
        # Create telemetry event
        event_data = TelemetryEventCreate(
            mode=mode,
            source=source,
            user_input=user_input,
            safe_answer=safe_answer,
            eza_score=eza_score,
            risk_level=risk_level,
            policy_violations=policy_violations,
            model_votes=model_votes,
            meta=meta if meta else None
        )
        
        await create_event(db_session, event_data)
        logger.debug(f"Telemetry event recorded: {mode} from {source}")
        
    except Exception as e:
        logger.error(f"Failed to record telemetry event: {str(e)}")
        raise  # Re-raise to allow caller to handle

