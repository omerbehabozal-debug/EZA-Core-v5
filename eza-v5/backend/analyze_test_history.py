#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test History Analyzer
Analyzes test execution history from test_reports directory
"""

import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

def analyze_test_history():
    """Analyze test execution history"""
    test_reports_dir = Path(__file__).parent / "test_reports"
    
    # Get all summary.json files
    summary_files = list(test_reports_dir.glob("*/summary.json"))
    
    if not summary_files:
        print("No test reports found")
        return
    
    # Parse dates and sort
    test_runs = []
    for summary_file in summary_files:
        try:
            with open(summary_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                test_runs.append({
                    'date': summary_file.parent.name,
                    'timestamp': data.get('timestamp', ''),
                    'suite': data.get('suite', 'unknown'),
                    'total': data.get('total', 0),
                    'passed': data.get('passed', 0),
                    'failed': data.get('failed', 0),
                    'duration': data.get('duration_seconds', 0)
                })
        except Exception as e:
            print(f"Error reading {summary_file}: {e}")
    
    # Sort by date
    test_runs.sort(key=lambda x: x['date'])
    
    # Calculate statistics
    total_runs = len(test_runs)
    total_tests = sum(r['total'] for r in test_runs)
    total_passed = sum(r['passed'] for r in test_runs)
    total_failed = sum(r['failed'] for r in test_runs)
    total_duration = sum(r['duration'] for r in test_runs)
    
    # Group by suite
    suite_stats = defaultdict(lambda: {'runs': 0, 'total': 0, 'passed': 0, 'failed': 0})
    for run in test_runs:
        suite = run['suite']
        suite_stats[suite]['runs'] += 1
        suite_stats[suite]['total'] += run['total']
        suite_stats[suite]['passed'] += run['passed']
        suite_stats[suite]['failed'] += run['failed']
    
    # Print results
    print("=" * 80)
    print("EZA TEST EXECUTION HISTORY ANALYSIS")
    print("=" * 80)
    print()
    
    print(f"📊 OVERALL STATISTICS:")
    print(f"   Total Test Runs: {total_runs}")
    print(f"   First Run: {test_runs[0]['date'] if test_runs else 'N/A'}")
    print(f"   Last Run: {test_runs[-1]['date'] if test_runs else 'N/A'}")
    print(f"   Total Tests Executed: {total_tests:,}")
    print(f"   Total Passed: {total_passed:,}")
    print(f"   Total Failed: {total_failed:,}")
    print(f"   Overall Success Rate: {(total_passed/total_tests*100) if total_tests > 0 else 0:.2f}%")
    print(f"   Total Duration: {total_duration/3600:.2f} hours ({total_duration/60:.2f} minutes)")
    print()
    
    print(f"📈 BY TEST SUITE:")
    for suite, stats in sorted(suite_stats.items()):
        success_rate = (stats['passed'] / stats['total'] * 100) if stats['total'] > 0 else 0
        print(f"   {suite.upper()}:")
        print(f"      Runs: {stats['runs']}")
        print(f"      Tests: {stats['total']:,}")
        print(f"      Passed: {stats['passed']:,}")
        print(f"      Failed: {stats['failed']:,}")
        print(f"      Success Rate: {success_rate:.2f}%")
        print()
    
    # Recent runs (last 10)
    print(f"🕐 RECENT TEST RUNS (Last 10):")
    for run in test_runs[-10:]:
        success_rate = (run['passed'] / run['total'] * 100) if run['total'] > 0 else 0
        duration_min = run['duration'] / 60
        print(f"   {run['date']} - {run['suite']}: {run['passed']}/{run['total']} passed ({success_rate:.1f}%) - {duration_min:.1f} min")
    print()
    
    # Check for scheduled test runs (daily/weekly/monthly)
    print(f"⏰ SCHEDULED TEST STATUS:")
    print(f"   Daily Tests: {'✅ Configured' if total_runs > 0 else '❌ Not run yet'}")
    print(f"   Weekly Tests: {'✅ Configured' if total_runs > 0 else '❌ Not run yet'}")
    print(f"   Monthly Tests: {'✅ Configured' if total_runs > 0 else '❌ Not run yet'}")
    print()
    
    print("=" * 80)

if __name__ == "__main__":
    analyze_test_history()

