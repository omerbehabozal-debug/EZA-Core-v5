# -*- coding: utf-8 -*-
"""
Output Merger for Multi-Model Ensemble
Merges outputs from multiple models into a single safe answer
"""
from typing import List, Dict, Any
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment


def merge_ensemble_outputs(
    user_input: str,
    model_results: List[Dict[str, Any]],
    input_analysis: Dict[str, Any]
) -> str:
    """
    Merge outputs from multiple models into a single safe answer
    
    Strategy:
    1. Analyze each output
    2. Select the safest output (highest alignment score)
    3. If all outputs are safe, use the most comprehensive one
    4. If any output is unsafe, use the safest safe rewrite
    
    Args:
        user_input: Original user input
        model_results: List of model results from ModelRouter.generate_ensemble()
        input_analysis: Input analysis results
    
    Returns:
        Merged safe answer string
    """
    if not model_results:
        return "Üzgünüm, şu anda yanıt veremiyorum."
    
    # Filter successful results
    successful_results = [r for r in model_results if r.get("ok") and r.get("output")]
    
    if not successful_results:
        # All models failed, return fallback
        return "Üzgünüm, şu anda yanıt veremiyorum."
    
    # Analyze each output
    analyzed_outputs = []
    for result in successful_results:
        output_text = result["output"]
        output_analysis = analyze_output(output_text, input_analysis)
        alignment = compute_alignment(input_analysis, output_analysis)
        
        analyzed_outputs.append({
            "output": output_text,
            "output_analysis": output_analysis,
            "alignment": alignment,
            "provider": result.get("provider", "unknown"),
            "model_name": result.get("model_name", "unknown")
        })
    
    # Sort by alignment score (highest first)
    analyzed_outputs.sort(
        key=lambda x: x["alignment"].get("alignment_score", 0),
        reverse=True
    )
    
    # Select the safest output
    safest = analyzed_outputs[0]
    
    # If alignment is safe and score is high, use it directly
    alignment_label = safest["alignment"].get("label", "").upper()
    alignment_score = safest["alignment"].get("alignment_score", 0)
    
    if alignment_label == "SAFE" and alignment_score >= 80:
        # Check for risk flags
        risk_flags = safest["output_analysis"].get("risk_flags", [])
        if not risk_flags:
            return safest["output"]
    
    # If there are multiple safe outputs, use the most comprehensive one
    safe_outputs = [
        ao for ao in analyzed_outputs
        if ao["alignment"].get("alignment_score", 0) >= 70
        and ao["alignment"].get("label", "").upper() in ["SAFE", "CAUTION"]
    ]
    
    if safe_outputs:
        # Use the longest safe output (most comprehensive)
        best_output = max(safe_outputs, key=lambda x: len(x["output"]))
        return best_output["output"]
    
    # All outputs have some risk, use the safest one
    return safest["output"]

