#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Comprehensive Test Report Generator"""

import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# Get all test reports
test_reports_dir = Path("test_reports")
detailed_files = list(test_reports_dir.glob("*/detailed.json"))

if not detailed_files:
    print("❌ No test reports found")
    exit(1)

# Get latest comprehensive report (largest one)
latest_file = max(detailed_files, key=lambda p: (p.stat().st_size, p.stat().st_mtime))
print("=" * 80)
print("📊 COMPREHENSIVE TEST SUITE REPORT")
print("=" * 80)
print(f"📁 Report: {latest_file.parent.name}")
print(f"📅 Generated: {datetime.fromtimestamp(latest_file.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')}")
print()

with open(latest_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Calculate statistics
total_tests = len(data)
passed_tests = [t for t in data if t.get('status') == 'passed']
failed_tests = [t for t in data if t.get('status') == 'failed']
skipped_tests = [t for t in data if t.get('status') == 'skipped']
error_tests = [t for t in data if t.get('status') == 'error']

total_passed = len(passed_tests)
total_failed = len(failed_tests)
total_skipped = len(skipped_tests)
total_errors = len(error_tests)

success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0

# Group by test suite
suites = defaultdict(lambda: {'total': 0, 'passed': 0, 'failed': 0, 'skipped': 0, 'error': 0})
for test in data:
    test_name = test.get('name', '')
    status = test.get('status', 'unknown')
    
    # Extract suite name
    if 'tests_adversarial' in test_name:
        suite = 'Adversarial Detection'
    elif 'tests_behavioral_extended' in test_name:
        suite = 'Behavioral Extended'
    elif 'tests_behavioral' in test_name:
        suite = 'Behavioral'
    elif 'tests_core' in test_name:
        suite = 'Core'
    else:
        suite = 'Other'
    
    suites[suite]['total'] += 1
    if status == 'passed':
        suites[suite]['passed'] += 1
    elif status == 'failed':
        suites[suite]['failed'] += 1
    elif status == 'skipped':
        suites[suite]['skipped'] += 1
    elif status == 'error':
        suites[suite]['error'] += 1

# Print comprehensive summary
print("=" * 80)
print("📈 OVERALL STATISTICS")
print("=" * 80)
print(f"   Total Tests: {total_tests:,}")
print(f"   ✅ Passed: {total_passed:,} ({total_passed/total_tests*100:.1f}%)")
print(f"   ❌ Failed: {total_failed:,} ({total_failed/total_tests*100:.1f}%)")
print(f"   ⏭️  Skipped: {total_skipped:,} ({total_skipped/total_tests*100:.1f}%)")
print(f"   ⚠️  Errors: {total_errors:,} ({total_errors/total_tests*100:.1f}%)")
print(f"   📊 Success Rate: {success_rate:.1f}%")
print()

print("=" * 80)
print("📦 BY TEST SUITE")
print("=" * 80)
print()

for suite_name in sorted(suites.keys()):
    suite_data = suites[suite_name]
    suite_total = suite_data['total']
    suite_passed = suite_data['passed']
    suite_failed = suite_data['failed']
    suite_skipped = suite_data['skipped']
    suite_error = suite_data['error']
    suite_rate = (suite_passed / suite_total * 100) if suite_total > 0 else 0
    
    print(f"   {suite_name}:")
    print(f"      Total: {suite_total:,} tests")
    print(f"      ✅ Passed: {suite_passed:,} ({suite_passed/suite_total*100:.1f}%)")
    print(f"      ❌ Failed: {suite_failed:,} ({suite_failed/suite_total*100:.1f}%)")
    if suite_skipped > 0:
        print(f"      ⏭️  Skipped: {suite_skipped:,}")
    if suite_error > 0:
        print(f"      ⚠️  Errors: {suite_error:,}")
    print(f"      📊 Success Rate: {suite_rate:.1f}%")
    print()

print("=" * 80)
print("🔍 FAILED TESTS BREAKDOWN")
print("=" * 80)
print()

if failed_tests:
    # Group by error type
    error_types = defaultdict(list)
    for test in failed_tests:
        error = test.get('error', test.get('message', 'No error'))
        # Extract error type
        if 'AssertionError' in error:
            if 'Score should be' in error or 'should have high score' in error or 'should have low score' in error:
                error_type = 'Score Assertion'
            elif 'should be' in error or 'expected' in error:
                error_type = 'Value Assertion'
            else:
                error_type = 'Other Assertion'
        elif 'Timeout' in error or 'timeout' in error:
            error_type = 'Timeout'
        elif 'LLM' in error or 'API' in error:
            error_type = 'LLM/API Error'
        else:
            error_type = 'Other Error'
        
        error_types[error_type].append(test)
    
    for error_type, tests in sorted(error_types.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"   {error_type}: {len(tests)} failures")
        for i, test in enumerate(tests[:10], 1):
            test_name = test.get('name', 'Unknown')
            print(f"      {i}. {test_name[:70]}")
        if len(tests) > 10:
            print(f"      ... and {len(tests) - 10} more")
        print()
else:
    print("   ✅ No failed tests!")

print("=" * 80)
print("📊 SUMMARY")
print("=" * 80)
print(f"Total Tests Executed: {total_tests:,}")
print(f"Success Rate: {success_rate:.1f}%")
print(f"Tests Passed: {total_passed:,}")
print(f"Tests Failed: {total_failed:,}")
if total_skipped > 0:
    print(f"Tests Skipped: {total_skipped:,}")
if total_errors > 0:
    print(f"Tests with Errors: {total_errors:,}")
print()

