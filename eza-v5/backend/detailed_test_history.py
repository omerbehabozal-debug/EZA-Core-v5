#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Detailed Test History with Fixes Analysis"""

import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# Get all test reports
test_reports_dir = Path("test_reports")
all_reports = list(test_reports_dir.glob("*/detailed.json"))

if not all_reports:
    print("❌ No test reports found")
    exit(1)

# Sort by date
all_reports.sort(key=lambda p: p.stat().st_mtime)

# Find major test runs (>= 300 tests)
major_runs = []
for report_file in all_reports:
    with open(report_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    total = len(data)
    if total >= 300:
        passed = len([t for t in data if t.get('status') == 'passed'])
        failed = len([t for t in data if t.get('status') == 'failed'])
        report_date = datetime.fromtimestamp(report_file.stat().st_mtime)
        
        major_runs.append({
            'date': report_date,
            'file': report_file.parent.name,
            'total': total,
            'passed': passed,
            'failed': failed,
            'rate': (passed / total * 100) if total > 0 else 0
        })

# Get first and last major runs
first_major = major_runs[0] if major_runs else None
last_major = major_runs[-1] if major_runs else None

# Calculate all-time stats
total_tests_all = 0
total_passed_all = 0
total_failed_all = 0

for report_file in all_reports:
    with open(report_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    total_tests_all += len(data)
    total_passed_all += len([t for t in data if t.get('status') == 'passed'])
    total_failed_all += len([t for t in data if t.get('status') == 'failed'])

print("=" * 80)
print("📊 COMPLETE TEST HISTORY & FIXES REPORT")
print("=" * 80)
print()

print("=" * 80)
print("📈 ALL-TIME STATISTICS")
print("=" * 80)
print(f"   Total Test Runs: {len(all_reports):,}")
print(f"   Total Tests Executed: {total_tests_all:,}")
print(f"   ✅ Total Passed: {total_passed_all:,}")
print(f"   ❌ Total Failed: {total_failed_all:,}")
if total_tests_all > 0:
    overall_rate = (total_passed_all / total_tests_all * 100)
    print(f"   📊 Overall Success Rate: {overall_rate:.1f}%")
print()

if first_major:
    print("=" * 80)
    print("📊 FIRST MAJOR TEST RUN (Baseline)")
    print("=" * 80)
    print(f"   Date: {first_major['date'].strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Report: {first_major['file']}")
    print(f"   Total Tests: {first_major['total']:,}")
    print(f"   ✅ Passed: {first_major['passed']:,} ({first_major['rate']:.1f}%)")
    print(f"   ❌ Failed: {first_major['failed']:,} ({100-first_major['rate']:.1f}%)")
    print()

if last_major:
    print("=" * 80)
    print("📊 LATEST MAJOR TEST RUN (Current)")
    print("=" * 80)
    print(f"   Date: {last_major['date'].strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Report: {last_major['file']}")
    print(f"   Total Tests: {last_major['total']:,}")
    print(f"   ✅ Passed: {last_major['passed']:,} ({last_major['rate']:.1f}%)")
    print(f"   ❌ Failed: {last_major['failed']:,} ({100-last_major['rate']:.1f}%)")
    print()

if first_major and last_major:
    print("=" * 80)
    print("🔧 FIXES & IMPROVEMENTS ANALYSIS")
    print("=" * 80)
    
    initial_failed = first_major['failed']
    current_failed = last_major['failed']
    tests_fixed = initial_failed - current_failed
    
    initial_rate = first_major['rate']
    current_rate = last_major['rate']
    improvement = current_rate - initial_rate
    
    print(f"   Initial Failed Tests: {initial_failed}")
    print(f"   Current Failed Tests: {current_failed}")
    print(f"   ✅ Tests Fixed: {tests_fixed}")
    if initial_failed > 0:
        fix_rate = (tests_fixed / initial_failed * 100)
        print(f"   📊 Fix Success Rate: {fix_rate:.1f}%")
    print()
    print(f"   Initial Success Rate: {initial_rate:.1f}%")
    print(f"   Current Success Rate: {current_rate:.1f}%")
    print(f"   📈 Improvement: +{improvement:.1f}%")
    print()

# Analyze latest report by suite
if last_major:
    latest_file = None
    for report_file in all_reports:
        if report_file.parent.name == last_major['file']:
            latest_file = report_file
            break
    
    if latest_file:
        with open(latest_file, 'r', encoding='utf-8') as f:
            latest_data = json.load(f)
        
        suites = defaultdict(lambda: {'total': 0, 'passed': 0, 'failed': 0})
        for test in latest_data:
            test_name = test.get('name', '')
            status = test.get('status', 'unknown')
            
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
        
        print("=" * 80)
        print("📦 CURRENT STATUS BY TEST SUITE")
        print("=" * 80)
        print()
        
        for suite_name in sorted(suites.keys()):
            suite_data = suites[suite_name]
            suite_total = suite_data['total']
            suite_passed = suite_data['passed']
            suite_failed = suite_data['failed']
            suite_rate = (suite_passed / suite_total * 100) if suite_total > 0 else 0
            
            status_icon = "✅" if suite_rate >= 95 else "⚠️" if suite_rate >= 80 else "❌"
            
            print(f"   {status_icon} {suite_name}:")
            print(f"      Total: {suite_total:,} tests")
            print(f"      ✅ Passed: {suite_passed:,} ({suite_passed/suite_total*100:.1f}%)")
            print(f"      ❌ Failed: {suite_failed:,} ({suite_failed/suite_total*100:.1f}%)")
            print(f"      📊 Success Rate: {suite_rate:.1f}%")
            print()

print("=" * 80)
print("📊 FINAL SUMMARY")
print("=" * 80)
print(f"   🎯 Total Tests Executed (All Time): {total_tests_all:,}")
print(f"   ✅ Total Passed: {total_passed_all:,}")
print(f"   ❌ Total Failed: {total_failed_all:,}")
if total_tests_all > 0:
    print(f"   📊 Overall Success Rate: {(total_passed_all / total_tests_all * 100):.1f}%")
print()

if first_major and last_major:
    print(f"   📈 Progress:")
    print(f"      Initial: {first_major['total']:,} tests, {first_major['rate']:.1f}% success, {first_major['failed']} failures")
    print(f"      Current: {last_major['total']:,} tests, {last_major['rate']:.1f}% success, {last_major['failed']} failures")
    print(f"      ✅ Fixed: {first_major['failed'] - last_major['failed']} tests")
    print(f"      📈 Improvement: +{last_major['rate'] - first_major['rate']:.1f}%")
print()

