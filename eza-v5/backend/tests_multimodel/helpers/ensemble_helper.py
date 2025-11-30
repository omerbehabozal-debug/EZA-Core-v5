# -*- coding: utf-8 -*-
"""
Helper for testing multi-model ensemble consistency
"""
from typing import List, Dict, Any
from backend.core.utils.model_router import ModelRouter
from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment
from backend.api.pipeline_runner import run_full_pipeline


async def run_ensemble_test(
    user_input: str,
    ensemble_models: List[str] = None
) -> Dict[str, Any]:
    """
    Run ensemble test with multiple models and return detailed results
    
    Args:
        user_input: Input text to test
        ensemble_models: List of model names (default: proxy ensemble models)
    
    Returns:
        {
            "input_analysis": dict,
            "ensemble_results": list of model results,
            "analyzed_outputs": list of analyzed outputs with scores,
            "scores": list of eza scores,
            "alignment_scores": list of alignment scores,
            "safe_answers": list of safe answers
        }
    """
    if ensemble_models is None:
        # Use new model ID format: provider/model-name
        ensemble_models = [
            "openai/gpt-4o-mini",
            "groq/llama3-8b-tool-use",
            "mistral/mistral-7b-instruct"
        ]
    
    # Analyze input once
    input_analysis = analyze_input(user_input)
    
    # Get ensemble results
    router = ModelRouter()
    ensemble_results = await router.generate_ensemble(
        prompt=user_input,
        model_ids=ensemble_models,  # Changed from model_names to model_ids
        temperature=0.2,
        max_tokens=512,
        timeout=12.0
    )
    
    # Log which models failed and why
    failed_models = []
    for result in ensemble_results:
        if not result.get("ok"):
            failed_models.append({
                "model": result.get("model_name", "unknown"),
                "provider": result.get("provider", "unknown"),
                "error": result.get("error", "unknown error")
            })
    
    # Log API key issues
    if failed_models:
        import warnings
        for fm in failed_models:
            if "not configured" in fm.get("error", "").lower() or "api key" in fm.get("error", "").lower():
                warnings.warn(f"API key missing for {fm['provider']} ({fm['model']}): {fm['error']}")
    
    # Analyze each output
    analyzed_outputs = []
    scores = []
    alignment_scores = []
    safe_answers = []
    
    for result in ensemble_results:
        if not result.get("ok") or not result.get("output"):
            continue
        
        output_text = result["output"]
        output_analysis = analyze_output(output_text, input_analysis)
        alignment = compute_alignment(input_analysis, output_analysis)
        
        # Run full pipeline to get EZA score
        pipeline_result = await run_full_pipeline(
            user_input=user_input,
            mode="proxy",
            output_text=output_text  # Use this specific output
        )
        
        analyzed_outputs.append({
            "output": output_text,
            "output_analysis": output_analysis,
            "alignment": alignment,
            "provider": result.get("provider", "unknown"),
            "model_id": result.get("model_id", "unknown"),
            "eza_score": pipeline_result.get("eza_score"),
            "safe_answer": pipeline_result.get("data", {}).get("safe_answer")
        })
        
        scores.append(pipeline_result.get("eza_score"))
        alignment_scores.append(alignment.get("alignment_score", 0.0))
        safe_answers.append(pipeline_result.get("data", {}).get("safe_answer"))
    
    return {
        "input_analysis": input_analysis,
        "ensemble_results": ensemble_results,
        "analyzed_outputs": analyzed_outputs,
        "scores": scores,
        "alignment_scores": alignment_scores,
        "safe_answers": safe_answers
    }

