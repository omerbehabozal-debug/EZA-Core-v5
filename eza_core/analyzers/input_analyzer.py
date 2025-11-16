# -*- coding: utf-8 -*-
"""
analyzers/input_analyzer.py – EZA-Core v10

Input analyzer: Comprehensive input analysis using all engines.
"""

from typing import Dict, Any
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.intent_engine import IntentEngine
from models.reasoning_shield import ReasoningShield
from models.identity_block import IdentityBlock
from models.narrative_engine import NarrativeEngine
from models.scoring_matrix import ScoringMatrix
from .text_preprocess import preprocess_text

# Global instances (singleton pattern)
_intent_engine = None
_reasoning_shield = None
_identity_block = None
_narrative_engine = None


def _get_engines():
    """Get or create engine instances."""
    global _intent_engine, _reasoning_shield, _identity_block, _narrative_engine
    
    if _intent_engine is None:
        _intent_engine = IntentEngine()
    if _reasoning_shield is None:
        _reasoning_shield = ReasoningShield()
    if _identity_block is None:
        _identity_block = IdentityBlock()
    if _narrative_engine is None:
        _narrative_engine = NarrativeEngine(window_size=10)
    
    return _intent_engine, _reasoning_shield, _identity_block, _narrative_engine


def analyze_input(text: str) -> Dict[str, Any]:
    """
    Comprehensive input analysis.
    
    Args:
        text: Input text to analyze
        
    Returns:
        Complete analysis result
    """
    # Preprocess text
    processed_text = preprocess_text(text)
    
    if not processed_text:
        return {
            "ok": False,
            "model": "eza-input-v10",
            "raw_text": text,
            "error": "Empty input text",
        }
    
    # Get engines
    intent_engine, reasoning_shield, identity_block, narrative_engine = _get_engines()
    
    # Run all engines
    intent_result = intent_engine.analyze(processed_text)
    reasoning_result = reasoning_shield.analyze(processed_text)
    identity_result = identity_block.analyze(processed_text)
    
    # Calculate current risk for narrative engine
    current_risk = max(
        intent_result.get("risk_score", 0.0),
        reasoning_result.get("reasoning_risk", 0.0),
        identity_result.get("identity_risk", 0.0),
    )
    
    # Add to narrative engine and analyze
    narrative_engine.add_message(processed_text, current_risk)
    narrative_result = narrative_engine.analyze(current_risk)
    
    # Combine scores using scoring matrix
    final_risk = ScoringMatrix.calculate_final_risk(
        intent_risk=intent_result.get("risk_score", 0.0),
        reasoning_risk=reasoning_result.get("reasoning_risk", 0.0),
        identity_risk=identity_result.get("identity_risk", 0.0),
        narrative_risk=narrative_result.get("narrative_risk", 0.0),
    )
    
    # Classify risk level
    risk_level = ScoringMatrix.classify_risk_level(final_risk)
    
    # Build result
    result = {
        "ok": True,
        "model": "eza-input-v10",
        "raw_text": text,
        "intent_engine": intent_result,
        "reasoning_shield": reasoning_result,
        "identity_block": identity_result,
        "narrative_engine": narrative_result,
        "risk_score": round(final_risk, 4),
        "risk_level": risk_level,
    }
    
    return result

