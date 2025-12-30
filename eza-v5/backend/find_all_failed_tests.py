#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Find all failed tests from latest comprehensive report"""

import json
from pathlib import Path

# Get latest test report
test_reports_dir = Path("test_reports")
detailed_files = list(test_reports_dir.glob("*/detailed.json"))
if not detailed_files:
    print("No test reports found")
    exit(1)

latest_file = max(detailed_files, key=lambda p: p.stat().st_mtime)
print(f"📊 Analyzing: {latest_file.parent.name}\n")

with open(latest_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

failed_tests = [t for t in data if t.get('status') == 'failed']
passed_tests = [t for t in data if t.get('status') == 'passed']

print("=" * 80)
print(f"📊 TEST SUMMARY")
print("=" * 80)
print(f"Total Tests: {len(data)}")
print(f"✅ Passed: {len(passed_tests)} ({len(passed_tests)/len(data)*100:.1f}%)")
print(f"❌ Failed: {len(failed_tests)} ({len(failed_tests)/len(data)*100:.1f}%)")
print()

if failed_tests:
    print("=" * 80)
    print(f"❌ FAILED TESTS: {len(failed_tests)}")
    print("=" * 80)
    print()
    
    # Group by test suite
    by_suite = {}
    for test in failed_tests:
        test_name = test.get('name', 'Unknown')
        if 'tests_adversarial' in test_name:
            suite = 'Adversarial'
        elif 'tests_behavioral_extended' in test_name:
            suite = 'Behavioral Extended'
        elif 'tests_behavioral' in test_name:
            suite = 'Behavioral'
        elif 'tests_core' in test_name:
            suite = 'Core'
        else:
            suite = 'Other'
        
        if suite not in by_suite:
            by_suite[suite] = []
        by_suite[suite].append(test)
    
    for suite in sorted(by_suite.keys()):
        print(f"\n{suite} ({len(by_suite[suite])} failures):")
        for i, test in enumerate(by_suite[suite], 1):
            test_name = test.get('name', 'Unknown')
            error = test.get('error', test.get('message', 'No error'))
            error_preview = error.split('\n')[0][:100]
            print(f"   {i}. {test_name}")
            print(f"      Error: {error_preview}...")
else:
    print("✅ No failed tests!")

