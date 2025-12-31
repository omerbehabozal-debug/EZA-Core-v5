#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Complete Test History Report - All Test Runs Analysis"""

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

# Sort by date (newest first)
all_reports.sort(key=lambda p: p.stat().st_mtime, reverse=True)

print("=" * 80)
print("📊 COMPLETE TEST HISTORY REPORT")
print("=" * 80)
print(f"📁 Total Reports Found: {len(all_reports)}")
print()

# Analyze all reports
total_tests_all_time = 0
total_passed_all_time = 0
total_failed_all_time = 0

reports_by_date = []
initial_baseline = None
latest_report = None

for i, report_file in enumerate(all_reports):
    with open(report_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    total = len(data)
    passed = len([t for t in data if t.get('status') == 'passed'])
    failed = len([t for t in data if t.get('status') == 'failed'])
    
    total_tests_all_time += total
    total_passed_all_time += passed
    total_failed_all_time += failed
    
    report_date = datetime.fromtimestamp(report_file.stat().st_mtime)
    reports_by_date.append({
        'date': report_date,
        'file': report_file.parent.name,
        'total': total,
        'passed': passed,
        'failed': failed,
        'rate': (passed / total * 100) if total > 0 else 0
    })
    
    # Get initial baseline (oldest report with significant tests)
    if initial_baseline is None and total >= 300:
        initial_baseline = {
            'date': report_date,
            'file': report_file.parent.name,
            'total': total,
            'passed': passed,
            'failed': failed,
            'rate': (passed / total * 100) if total > 0 else 0
        }
    
    # Get latest comprehensive report
    if latest_report is None and total >= 300:
        latest_report = {
            'date': report_date,
            'file': report_file.parent.name,
            'total': total,
            'passed': passed,
            'failed': failed,
            'rate': (passed / total * 100) if total > 0 else 0
        }

# Sort by date
reports_by_date.sort(key=lambda x: x['date'])

print("=" * 80)
print("📈 OVERALL STATISTICS (ALL TIME)")
print("=" * 80)
print(f"   Total Test Runs: {len(all_reports)}")
print(f"   Total Tests Executed: {total_tests_all_time:,}")
print(f"   Total Passed: {total_passed_all_time:,}")
print(f"   Total Failed: {total_failed_all_time:,}")
if total_tests_all_time > 0:
    overall_rate = (total_passed_all_time / total_tests_all_time * 100)
    print(f"   Overall Success Rate: {overall_rate:.1f}%")
print()

if initial_baseline:
    print("=" * 80)
    print("📊 INITIAL BASELINE (First Major Test Run)")
    print("=" * 80)
    print(f"   Date: {initial_baseline['date'].strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Report: {initial_baseline['file']}")
    print(f"   Total Tests: {initial_baseline['total']:,}")
    print(f"   ✅ Passed: {initial_baseline['passed']:,} ({initial_baseline['rate']:.1f}%)")
    print(f"   ❌ Failed: {initial_baseline['failed']:,} ({100-initial_baseline['rate']:.1f}%)")
    print()

if latest_report:
    print("=" * 80)
    print("📊 LATEST COMPREHENSIVE REPORT")
    print("=" * 80)
    print(f"   Date: {latest_report['date'].strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Report: {latest_report['file']}")
    print(f"   Total Tests: {latest_report['total']:,}")
    print(f"   ✅ Passed: {latest_report['passed']:,} ({latest_report['rate']:.1f}%)")
    print(f"   ❌ Failed: {latest_report['failed']:,} ({100-latest_report['rate']:.1f}%)")
    print()

if initial_baseline and latest_report:
    print("=" * 80)
    print("📈 IMPROVEMENT ANALYSIS")
    print("=" * 80)
    
    initial_failed = initial_baseline['failed']
    latest_failed = latest_report['failed']
    tests_fixed = initial_failed - latest_failed
    
    initial_rate = initial_baseline['rate']
    latest_rate = latest_report['rate']
    improvement = latest_rate - initial_rate
    
    print(f"   Initial Failed Tests: {initial_failed}")
    print(f"   Latest Failed Tests: {latest_failed}")
    print(f"   Tests Fixed: {tests_fixed}")
    if initial_failed > 0:
        fix_rate = (tests_fixed / initial_failed * 100)
        print(f"   Fix Success Rate: {fix_rate:.1f}%")
    print()
    print(f"   Initial Success Rate: {initial_rate:.1f}%")
    print(f"   Latest Success Rate: {latest_rate:.1f}%")
    print(f"   Improvement: +{improvement:.1f}%")
    print()

# Analyze by test suite in latest report
if latest_report:
    latest_file = None
    for report_file in all_reports:
        if report_file.parent.name == latest_report['file']:
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
        print("📦 LATEST REPORT BY TEST SUITE")
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
if initial_baseline and latest_report:
    print(f"   Initial Test Run: {initial_baseline['total']:,} tests ({initial_baseline['rate']:.1f}% success)")
    print(f"   Latest Test Run: {latest_report['total']:,} tests ({latest_report['rate']:.1f}% success)")
    print(f"   Tests Fixed: {initial_baseline['failed'] - latest_report['failed']}")
    print(f"   Current Success Rate: {latest_report['rate']:.1f}%")
    print(f"   Improvement: +{latest_report['rate'] - initial_baseline['rate']:.1f}%")
else:
    print(f"   Total Tests Executed (All Time): {total_tests_all_time:,}")
    if total_tests_all_time > 0:
        print(f"   Overall Success Rate: {(total_passed_all_time / total_tests_all_time * 100):.1f}%")
print()

