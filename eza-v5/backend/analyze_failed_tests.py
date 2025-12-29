#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Failed Tests Analyzer
Analyzes failed tests from test reports
"""

import json
from pathlib import Path
from collections import defaultdict

def analyze_failed_tests():
    """Analyze failed tests from all test reports"""
    test_reports_dir = Path(__file__).parent / "test_reports"
    
    # Get all detailed.json files
    detailed_files = list(test_reports_dir.glob("*/detailed.json"))
    
    if not detailed_files:
        print("No test reports found")
        return
    
    failed_tests = []
    all_tests = []
    
    for detailed_file in detailed_files:
        try:
            with open(detailed_file, 'r', encoding='utf-8') as f:
                tests = json.load(f)
                all_tests.extend(tests)
                failed_tests.extend([t for t in tests if t.get('status') == 'failed'])
        except Exception as e:
            print(f"Error reading {detailed_file}: {e}")
    
    print("=" * 80)
    print("EZA FAILED TESTS ANALYSIS")
    print("=" * 80)
    print()
    
    print(f"📊 OVERALL:")
    print(f"   Total Tests Analyzed: {len(all_tests):,}")
    print(f"   Failed Tests: {len(failed_tests):,}")
    print(f"   Failure Rate: {(len(failed_tests)/len(all_tests)*100) if all_tests else 0:.2f}%")
    print()
    
    # Group by test suite
    suite_failures = defaultdict(list)
    for test in failed_tests:
        test_name = test.get('name', 'unknown')
        # Extract suite name (e.g., "tests_core" from "tests_core/test_file.py::test_name")
        suite = test_name.split('::')[0].split('/')[0] if '::' in test_name else 'unknown'
        suite_failures[suite].append(test)
    
    print(f"📈 FAILURES BY TEST SUITE:")
    for suite in sorted(suite_failures.keys()):
        failures = suite_failures[suite]
        print(f"\n   {suite.upper()}: {len(failures)} failed tests")
        
        # Show first 10 failures with error messages
        for i, test in enumerate(failures[:10], 1):
            test_name = test.get('name', 'unknown')
            error = test.get('error', test.get('message', 'No error message'))
            # Truncate error if too long
            if isinstance(error, str) and len(error) > 200:
                error = error[:200] + "..."
            print(f"      {i}. {test_name}")
            if error:
                print(f"         Error: {error}")
        
        if len(failures) > 10:
            print(f"      ... and {len(failures) - 10} more failures")
    
    # Most common failure patterns
    print(f"\n🔍 FAILURE PATTERNS:")
    error_patterns = defaultdict(int)
    for test in failed_tests:
        error = test.get('error', test.get('message', ''))
        if error:
            # Extract first line of error
            first_line = error.split('\n')[0] if isinstance(error, str) else str(error)
            # Normalize common patterns
            if 'AssertionError' in first_line:
                error_patterns['AssertionError'] += 1
            elif 'Timeout' in first_line or 'timeout' in first_line:
                error_patterns['Timeout'] += 1
            elif 'Connection' in first_line or 'connection' in first_line:
                error_patterns['Connection Error'] += 1
            elif 'AttributeError' in first_line:
                error_patterns['AttributeError'] += 1
            elif 'KeyError' in first_line:
                error_patterns['KeyError'] += 1
            else:
                error_patterns[first_line[:50]] += 1
    
    for pattern, count in sorted(error_patterns.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"   {pattern}: {count} occurrences")
    
    print()
    print("=" * 80)

if __name__ == "__main__":
    analyze_failed_tests()

