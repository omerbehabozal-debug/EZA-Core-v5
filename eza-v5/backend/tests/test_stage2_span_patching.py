# -*- coding: utf-8 -*-
"""
EZA Proxy - Stage-2 Span Patching Tests
Test overlapping spans, length-changing rewrites, offset preservation
"""

import pytest
from backend.services.proxy_analyzer_stage2 import (
    merge_overlapping_spans,
    patch_span_into_content
)


def test_merge_overlapping_spans():
    """Test merging overlapping spans"""
    spans = [
        {"start_offset": 10, "end_offset": 50, "risk_type": "manipulation"},
        {"start_offset": 40, "end_offset": 80, "risk_type": "bias"},
        {"start_offset": 100, "end_offset": 150, "risk_type": "legal"},
    ]
    
    merged = merge_overlapping_spans(spans)
    
    # First two should be merged (overlap at 40-50)
    assert len(merged) == 2
    assert merged[0]["start_offset"] == 10
    assert merged[0]["end_offset"] == 80  # Extended to cover both
    assert merged[1]["start_offset"] == 100
    assert merged[1]["end_offset"] == 150


def test_merge_non_overlapping_spans():
    """Test non-overlapping spans remain separate"""
    spans = [
        {"start_offset": 10, "end_offset": 50, "risk_type": "manipulation"},
        {"start_offset": 100, "end_offset": 150, "risk_type": "bias"},
    ]
    
    merged = merge_overlapping_spans(spans)
    
    assert len(merged) == 2
    assert merged[0]["start_offset"] == 10
    assert merged[1]["start_offset"] == 100


def test_patch_span_preserves_offsets():
    """Test that patching preserves offsets for unaffected spans"""
    original = "This is a test sentence with some content."
    span = {"start_offset": 10, "end_offset": 18}  # "is a test"
    rewritten = "was an example"
    
    patched = patch_span_into_content(original, span, rewritten)
    
    assert patched == "This was an example sentence with some content."
    # Verify unaffected parts remain
    assert patched[:10] == original[:10]  # "This "
    assert patched[23:] == original[18:]  # " sentence with some content."


def test_patch_multiple_spans_end_to_start():
    """Test patching multiple spans from end → start preserves offsets"""
    original = "First sentence. Second sentence. Third sentence."
    
    spans = [
        {"start_offset": 0, "end_offset": 16, "rewritten_span": "First paragraph"},
        {"start_offset": 17, "end_offset": 33, "rewritten_span": "Second paragraph"},
        {"start_offset": 34, "end_offset": 48, "rewritten_span": "Third paragraph"},
    ]
    
    # Process from end → start
    spans_sorted = sorted(spans, key=lambda s: s["start_offset"], reverse=True)
    
    result = original
    for span in spans_sorted:
        result = patch_span_into_content(result, span, span["rewritten_span"])
    
    assert "First paragraph" in result
    assert "Second paragraph" in result
    assert "Third paragraph" in result


def test_patch_length_changing_rewrite():
    """Test patching with length-changing rewrite"""
    original = "Short text."
    span = {"start_offset": 0, "end_offset": 5}  # "Short"
    rewritten = "Very long replacement text"
    
    patched = patch_span_into_content(original, span, rewritten)
    
    assert patched == "Very long replacement text text."
    assert len(patched) > len(original)  # Length changed


def test_patch_invalid_offsets():
    """Test patching with invalid offsets"""
    original = "Test content"
    span = {"start_offset": 20, "end_offset": 10}  # Invalid: start > end
    rewritten = "replacement"
    
    patched = patch_span_into_content(original, span, rewritten)
    
    # Should return original unchanged
    assert patched == original


def test_patch_out_of_bounds_offsets():
    """Test patching with out-of-bounds offsets"""
    original = "Test"
    span = {"start_offset": -5, "end_offset": 100}  # Out of bounds
    rewritten = "replacement"
    
    patched = patch_span_into_content(original, span, rewritten)
    
    # Should clamp to valid range
    assert "replacement" in patched or patched == original

