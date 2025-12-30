#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Find all failed tests from latest report"""

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

print("=" * 80)
print(f"❌ FAILED TESTS: {len(failed_tests)}")
print("=" * 80)
print()

for i, test in enumerate(failed_tests, 1):
    test_name = test.get('name', 'Unknown')
    error = test.get('error', test.get('message', 'No error'))
    
    # Get first few lines of error
    error_lines = error.split('\n')[:3]
    error_preview = '\n'.join(error_lines)
    
    print(f"{i}. {test_name}")
    print(f"   Error: {error_preview[:150]}...")
    print()

