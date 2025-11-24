# -*- coding: utf-8 -*-
"""
Test Response Schema
Tests for unified response schema compliance
"""

import pytest
from backend.api.pipeline_runner import run_full_pipeline
from backend.tests.helpers.schema_validator import validate_pipeline_response


@pytest.mark.asyncio
async def test_response_schema_format(fake_llm, sample_text):
    """Test response schema has all required fields"""
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="proxy",
        llm_override=fake_llm
    )
    
    # Check all required top-level fields exist
    assert "ok" in result
    assert "mode" in result
    assert "eza_score" in result
    assert "eza_score_breakdown" in result
    assert "data" in result
    assert "error" in result


@pytest.mark.asyncio
async def test_response_schema_validation(fake_llm, sample_text):
    """Test response schema passes validation"""
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="proxy",
        llm_override=fake_llm
    )
    
    # Validate schema
    is_valid, errors = validate_pipeline_response(result)
    
    assert is_valid, f"Schema validation failed: {errors}"


@pytest.mark.asyncio
async def test_response_schema_all_modes(fake_llm, sample_text):
    """Test response schema is consistent across all modes"""
    modes = ["standalone", "proxy", "proxy-lite"]
    
    for mode in modes:
        result = await run_full_pipeline(
            user_input=sample_text,
            mode=mode,
            llm_override=fake_llm
        )
        
        # Validate schema for each mode
        is_valid, errors = validate_pipeline_response(result)
        assert is_valid, f"Schema validation failed for mode {mode}: {errors}"


@pytest.mark.asyncio
async def test_response_schema_field_types(fake_llm, sample_text):
    """Test response schema field types are correct"""
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="standalone",
        llm_override=fake_llm
    )
    
    # Check field types
    assert isinstance(result["ok"], bool)
    assert isinstance(result["mode"], str)
    assert result["eza_score"] is None or isinstance(result["eza_score"], (int, float))
    assert result["eza_score_breakdown"] is None or isinstance(result["eza_score_breakdown"], dict)
    assert result["data"] is None or isinstance(result["data"], dict)
    assert result["error"] is None or isinstance(result["error"], dict)


@pytest.mark.asyncio
async def test_response_schema_eza_score_range(fake_llm, sample_text):
    """Test EZA score is within valid range"""
    result = await run_full_pipeline(
        user_input=sample_text,
        mode="proxy",
        llm_override=fake_llm
    )
    
    if result["eza_score"] is not None:
        score = float(result["eza_score"])
        assert 0 <= score <= 100, f"EZA score out of range: {score}"


@pytest.mark.asyncio
async def test_response_schema_mode_values(fake_llm, sample_text):
    """Test mode field has valid values"""
    valid_modes = ["standalone", "proxy", "proxy-lite"]
    
    for mode in valid_modes:
        result = await run_full_pipeline(
            user_input=sample_text,
            mode=mode,
            llm_override=fake_llm
        )
        
        assert result["mode"] in valid_modes, f"Invalid mode value: {result['mode']}"

