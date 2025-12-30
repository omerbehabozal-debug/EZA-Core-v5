#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Verify alignment test fixes and count real failures"""

import json
from pathlib import Path
from collections import defaultdict

# Get all test reports
test_reports_dir = Path("test_reports")
detailed_files = list(test_reports_dir.glob("*/detailed.json"))

if not detailed_files:
    print("No test reports found")
    exit(1)

# Get latest report
latest_file = max(detailed_files, key=lambda p: p.stat().st_mtime)
print(f"📊 Analyzing latest report: {latest_file.parent.name}\n")

with open(latest_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Count alignment-related tests
alignment_patterns = ['alignment', 'misaligned', 'alignment_score', 'verdict']
alignment_tests = []
alignment_failures = []

for test in data:
    test_name = test.get('name', '').lower()
    error = test.get('error', test.get('message', '')).lower()
    status = test.get('status', '')
    
    # Check if alignment-related
    is_alignment = any(pattern in test_name or pattern in error for pattern in alignment_patterns)
    
    if is_alignment:
        alignment_tests.append(test)
        if status == 'failed':
            alignment_failures.append(test)

print("=" * 80)
print("ALIGNMENT TEST ANALYSIS")
print("=" * 80)
print(f"\n📈 Total alignment-related tests: {len(alignment_tests)}")
print(f"✅ Passed: {len(alignment_tests) - len(alignment_failures)}")
print(f"❌ Failed: {len(alignment_failures)}")
print(f"📊 Success rate: {(len(alignment_tests) - len(alignment_failures)) / len(alignment_tests) * 100 if alignment_tests else 0:.1f}%")

if alignment_failures:
    print(f"\n🔴 FAILED TESTS ({len(alignment_failures)}):")
    for i, test in enumerate(alignment_failures[:10], 1):
        print(f"  {i}. {test['name']}")
        if test.get('error'):
            error_preview = test['error'].split('\n')[0][:80]
            print(f"     {error_preview}...")
    if len(alignment_failures) > 10:
        print(f"  ... and {len(alignment_failures) - 10} more")
else:
    print("\n✅ All alignment tests are passing!")

# Group by test file
by_file = defaultdict(list)
for test in alignment_tests:
    test_name = test.get('name', '')
    if '::' in test_name:
        file_name = test_name.split('::')[0]
    else:
        file_name = test_name.split('/')[0] if '/' in test_name else 'unknown'
    by_file[file_name].append(test)

print(f"\n📁 Tests by file:")
for file_name, tests in sorted(by_file.items()):
    failed = sum(1 for t in tests if t.get('status') == 'failed')
    print(f"  {file_name}: {len(tests) - failed}/{len(tests)} passed ({failed} failed)")

print("\n" + "=" * 80)

