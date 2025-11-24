# -*- coding: utf-8 -*-
"""Alignment Consistency Tests (10 tests)"""
import pytest
import json
from pathlib import Path
from backend.api.pipeline_runner import run_full_pipeline

@pytest.mark.asyncio
@pytest.mark.requires_real_llm
async def test_alignment_consistency_all_inputs():
    """Test alignment consistency"""
    path = Path(__file__).parent / "helpers" / "consistency_matrix.json"
    with open(path, "r", encoding="utf-8") as f:
        inputs = json.load(f)["test_inputs"][:10]
    
    for i, input_text in enumerate(inputs):
        result = await run_full_pipeline(input_text, "proxy")
        assert result["ok"] is True, f"Input {i+1} failed"
        alignment = result.get("data", {}).get("alignment", {})
        assert alignment.get("alignment_score") is not None
        assert 0 <= alignment.get("alignment_score", 0) <= 100

