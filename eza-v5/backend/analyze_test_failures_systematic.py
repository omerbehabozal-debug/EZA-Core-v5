#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Systematic Test Failure Analyzer
Analyzes test failures to identify patterns and root causes for systematic fixes
"""

import json
import re
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple

def analyze_failure_patterns():
    """Analyze test failures to identify systematic patterns"""
    test_reports_dir = Path(__file__).parent / "test_reports"
    
    # Get all detailed.json files
    detailed_files = list(test_reports_dir.glob("*/detailed.json"))
    
    if not detailed_files:
        print("No test reports found")
        return
    
    failed_tests = []
    for detailed_file in detailed_files:
        try:
            with open(detailed_file, 'r', encoding='utf-8') as f:
                tests = json.load(f)
                failed_tests.extend([t for t in tests if t.get('status') == 'failed'])
        except Exception as e:
            print(f"Error reading {detailed_file}: {e}")
    
    if not failed_tests:
        print("No failed tests found")
        return
    
    print("=" * 80)
    print("SYSTEMATIC TEST FAILURE ANALYSIS")
    print("=" * 80)
    print()
    
    # Categorize failures by root cause
    categories = {
        "adversarial_detection": {
            "patterns": ["emoji", "jailbreak", "obfuscation", "mode switching", "instruction override"],
            "expected": "score < 50 or < 80",
            "actual": "score >= 50 or >= 80",
            "root_cause": "Adversarial pattern detection not working",
            "fix_priority": "HIGH",
            "tests": []
        },
        "safe_content_scoring": {
            "patterns": ["should have high score", ">= 70", "got 0.0", "got 38.0", "got 51.0"],
            "expected": "score >= 70",
            "actual": "score < 70",
            "root_cause": "Safe content not getting high scores",
            "fix_priority": "HIGH",
            "tests": []
        },
        "risky_content_scoring": {
            "patterns": ["should have low score", "< 50", "got 56.0", "got 70.0", "got 90.0"],
            "expected": "score < 50",
            "actual": "score >= 50",
            "root_cause": "Risky content not getting low scores",
            "fix_priority": "HIGH",
            "tests": []
        },
        "alignment_issues": {
            "patterns": ["alignment_score", "alignment", "verdict", "misaligned"],
            "expected": "alignment_score < 60 for risky output",
            "actual": "alignment_score >= 60",
            "root_cause": "Alignment engine not detecting misalignment",
            "fix_priority": "MEDIUM",
            "tests": []
        },
        "risk_level_detection": {
            "patterns": ["risk_level", "should be", "medium", "high", "got low"],
            "expected": "risk_level in ['medium', 'high']",
            "actual": "risk_level == 'low'",
            "root_cause": "Risk level detection not working",
            "fix_priority": "MEDIUM",
            "tests": []
        },
        "multiturn_context": {
            "patterns": ["multiturn", "conversation", "progressive", "escalation", "manipulation"],
            "expected": "Context-aware risk detection",
            "actual": "No context tracking",
            "root_cause": "Multi-turn conversation context not implemented",
            "fix_priority": "LOW",
            "tests": []
        },
        "performance_issues": {
            "patterns": ["duration", "throughput", "latency", "burst", "too long"],
            "expected": "Performance within limits",
            "actual": "Performance below limits",
            "root_cause": "Performance optimization needed",
            "fix_priority": "LOW",
            "tests": []
        }
    }
    
    # Categorize each failure
    for test in failed_tests:
        test_name = test.get('name', '')
        error = test.get('error', test.get('message', ''))
        error_lower = error.lower()
        
        categorized = False
        for category_name, category_info in categories.items():
            for pattern in category_info["patterns"]:
                if pattern.lower() in error_lower or pattern.lower() in test_name.lower():
                    category_info["tests"].append({
                        "name": test_name,
                        "error": error[:200] if len(error) > 200 else error
                    })
                    categorized = True
                    break
            if categorized:
                break
        
        if not categorized:
            # Uncategorized
            if "uncategorized" not in categories:
                categories["uncategorized"] = {
                    "patterns": [],
                    "expected": "Unknown",
                    "actual": "Unknown",
                    "root_cause": "Needs investigation",
                    "fix_priority": "MEDIUM",
                    "tests": []
                }
            categories["uncategorized"]["tests"].append({
                "name": test_name,
                "error": error[:200] if len(error) > 200 else error
            })
    
    # Print categorized results
    print("📊 FAILURE CATEGORIZATION BY ROOT CAUSE:")
    print()
    
    for category_name, category_info in sorted(categories.items(), key=lambda x: len(x[1]["tests"]), reverse=True):
        if not category_info["tests"]:
            continue
            
        count = len(category_info["tests"])
        priority = category_info["fix_priority"]
        print(f"🔴 {category_name.upper().replace('_', ' ')} ({count} failures)")
        print(f"   Priority: {priority}")
        print(f"   Root Cause: {category_info['root_cause']}")
        print(f"   Expected: {category_info['expected']}")
        print(f"   Actual: {category_info['actual']}")
        print(f"   Sample failures:")
        for i, test in enumerate(category_info["tests"][:3], 1):
            print(f"      {i}. {test['name']}")
            if test['error']:
                error_preview = test['error'].split('\n')[0][:100]
                print(f"         Error: {error_preview}...")
        if len(category_info["tests"]) > 3:
            print(f"      ... and {len(category_info['tests']) - 3} more")
        print()
    
    # Generate fix recommendations
    print("=" * 80)
    print("🔧 FIX RECOMMENDATIONS (Priority Order)")
    print("=" * 80)
    print()
    
    high_priority = [c for c in categories.items() if c[1]["fix_priority"] == "HIGH"]
    medium_priority = [c for c in categories.items() if c[1]["fix_priority"] == "MEDIUM"]
    low_priority = [c for c in categories.items() if c[1]["fix_priority"] == "LOW"]
    
    print("1. HIGH PRIORITY FIXES:")
    for category_name, category_info in high_priority:
        if category_info["tests"]:
            print(f"   - {category_name}: {len(category_info['tests'])} failures")
            print(f"     Fix: {category_info['root_cause']}")
            print(f"     Impact: {len(category_info['tests'])} tests will pass")
    print()
    
    print("2. MEDIUM PRIORITY FIXES:")
    for category_name, category_info in medium_priority:
        if category_info["tests"]:
            print(f"   - {category_name}: {len(category_info['tests'])} failures")
            print(f"     Fix: {category_info['root_cause']}")
    print()
    
    print("3. LOW PRIORITY FIXES:")
    for category_name, category_info in low_priority:
        if category_info["tests"]:
            print(f"   - {category_name}: {len(category_info['tests'])} failures")
            print(f"     Fix: {category_info['root_cause']}")
    print()
    
    # Summary
    total_categorized = sum(len(c["tests"]) for c in categories.values())
    print("=" * 80)
    print(f"📈 SUMMARY: {total_categorized} failures categorized")
    print(f"   High Priority: {sum(len(c[1]['tests']) for c in high_priority if c[1]['tests'])} failures")
    print(f"   Medium Priority: {sum(len(c[1]['tests']) for c in medium_priority if c[1]['tests'])} failures")
    print(f"   Low Priority: {sum(len(c[1]['tests']) for c in low_priority if c[1]['tests'])} failures")
    print("=" * 80)

if __name__ == "__main__":
    analyze_failure_patterns()

