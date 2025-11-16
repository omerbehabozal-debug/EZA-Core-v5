# -*- coding: utf-8 -*-
"""
analyzers/output_analyzer.py – EZA-Core v10

Output analyzer: Analyze model output for harmful content.
"""

from typing import Dict, Any, Optional
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.intent_engine import IntentEngine
from models.reasoning_shield import ReasoningShield
from models.identity_block import IdentityBlock
from models.scoring_matrix import ScoringMatrix
from .text_preprocess import preprocess_text

# Global instances
_output_intent_engine = None
_output_reasoning_shield = None
_output_identity_block = None


def _get_output_engines():
    """Get or create engine instances for output analysis."""
    global _output_intent_engine, _output_reasoning_shield, _output_identity_block
    
    if _output_intent_engine is None:
        _output_intent_engine = IntentEngine()
    if _output_reasoning_shield is None:
        _output_reasoning_shield = ReasoningShield()
    if _output_identity_block is None:
        _output_identity_block = IdentityBlock()
    
    return _output_intent_engine, _output_reasoning_shield, _output_identity_block


def analyze_output(
    output_text: str,
    input_analysis: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Analyze model output for harmful content.
    
    Args:
        output_text: Model output text
        input_analysis: Optional input analysis for context
        
    Returns:
        Output analysis result
    """
    # Preprocess text
    processed_text = preprocess_text(output_text)
    
    if not processed_text:
        return {
            "ok": False,
            "model": "eza-output-v10",
            "output_text": output_text,
            "error": "Empty output text",
        }
    
    # Get engines
    intent_engine, reasoning_shield, identity_block = _get_output_engines()
    
    # Run all engines
    intent_result = intent_engine.analyze(processed_text)
    reasoning_result = reasoning_shield.analyze(processed_text)
    identity_result = identity_block.analyze(processed_text)
    
    # Calculate output risk
    output_risk = ScoringMatrix.calculate_final_risk(
        intent_risk=intent_result.get("risk_score", 0.0),
        reasoning_risk=reasoning_result.get("reasoning_risk", 0.0),
        identity_risk=identity_result.get("identity_risk", 0.0),
        narrative_risk=0.0,  # Output doesn't use narrative engine
    )
    
    # Classify risk level
    risk_level = ScoringMatrix.classify_risk_level(output_risk)
    
    # Detect harmful instructions
    harmful_instructions = []
    if intent_result.get("primary") in ["illegal", "violence", "self-harm"]:
        harmful_instructions.append(intent_result.get("primary"))
    
    # Detect banned content
    banned_content = []
    if identity_result.get("identity_risk", 0.0) >= 0.7:
        banned_content.append("sensitive-data")
    if reasoning_result.get("reasoning_risk", 0.0) >= 0.7:
        banned_content.append("manipulative-reasoning")
    
    # Build result
    result = {
        "ok": True,
        "model": "eza-output-v10",
        "output_text": output_text,
        "intent_engine": intent_result,
        "reasoning_shield": reasoning_result,
        "identity_block": identity_result,
        "output_risk": round(output_risk, 4),
        "risk_level": risk_level,
        "harmful_instructions": harmful_instructions,
        "banned_content": banned_content,
    }
    
    return result

