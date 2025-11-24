# -*- coding: utf-8 -*-
"""Score Deviation Tests (10 tests)"""
import pytest
import json
from pathlib import Path
from backend.api.pipeline_runner import run_full_pipeline

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_score_deviation_all_inputs():
    """Test score deviation"""
    path = Path(__file__).parent / "helpers" / "consistency_matrix.json"
    with open(path, "r", encoding="utf-8") as f:
        inputs = json.load(f)["test_inputs"][:10]
    
    for i, input_text in enumerate(inputs):
        # Run multiple times
        scores = []
        for _ in range(3):
            result = await run_full_pipeline(input_text, "proxy")
            assert result["ok"] is True
            scores.append(result.get("eza_score", 0.0))
        
        # Scores should be within reasonable range
        score_range = max(scores) - min(scores)
        assert score_range <= 20, \
            f"Input {i+1}: Score deviation too high: {score_range}"

