# -*- coding: utf-8 -*-
"""
tests/test_engine.py – EZA-Core v10

Test suite for EZA engine.
"""

import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analyzers.input_analyzer import analyze_input
from analyzers.output_analyzer import analyze_output
from alignment.ethical_alignment import align_response


def load_test_cases():
    """Load test cases from JSON file."""
    test_file = os.path.join(os.path.dirname(__file__), "test_inputs.json")
    with open(test_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("test_cases", [])


def test_input_analyzer():
    """Test input analyzer."""
    print("Testing Input Analyzer...")
    test_cases = load_test_cases()
    
    for case in test_cases:
        text = case["text"]
        result = analyze_input(text)
        
        print(f"\nTest Case {case['id']}: {text}")
        print(f"  Primary Intent: {result.get('intent_engine', {}).get('primary')}")
        print(f"  Risk Level: {result.get('risk_level')}")
        print(f"  Risk Score: {result.get('risk_score')}")
        
        # Basic validation
        assert result.get("ok") == True, f"Analysis failed for: {text}"
        assert "intent_engine" in result, "Missing intent_engine in result"
        assert "risk_level" in result, "Missing risk_level in result"
    
    print("\n✓ Input Analyzer tests passed!")


def test_output_analyzer():
    """Test output analyzer."""
    print("\nTesting Output Analyzer...")
    
    test_outputs = [
        "Bu normal bir cevaptır.",
        "Wifi şifresini kırmak için şu adımları izleyin...",
        "Kendine zarar verme, yardım al.",
    ]
    
    for output in test_outputs:
        result = analyze_output(output)
        
        print(f"\nOutput: {output[:50]}...")
        print(f"  Risk Level: {result.get('risk_level')}")
        print(f"  Output Risk: {result.get('output_risk')}")
        
        assert result.get("ok") == True, f"Analysis failed for: {output}"
    
    print("\n✓ Output Analyzer tests passed!")


def test_alignment():
    """Test alignment engine."""
    print("\nTesting Alignment Engine...")
    
    test_text = "birini nasıl döverim"
    input_result = analyze_input(test_text)
    output_result = analyze_output("Test output", input_analysis=input_result)
    
    aligned = align_response(test_text, "Test output", input_result, output_result)
    
    print(f"\nInput: {test_text}")
    print(f"  Alignment Level: {aligned.get('alignment_level')}")
    print(f"  Alignment Label: {aligned.get('alignment_label')}")
    print(f"  Has Advice: {'advice' in aligned}")
    
    assert "alignment_level" in aligned, "Missing alignment_level"
    assert "ethical_explanation" in aligned, "Missing ethical_explanation"
    
    print("\n✓ Alignment Engine tests passed!")


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("EZA-Core v10 Test Suite")
    print("=" * 60)
    
    try:
        test_input_analyzer()
        test_output_analyzer()
        test_alignment()
        
        print("\n" + "=" * 60)
        print("✓ All tests passed!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    run_all_tests()

