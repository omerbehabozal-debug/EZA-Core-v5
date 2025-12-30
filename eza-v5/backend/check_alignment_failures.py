#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Check alignment-related test failures"""

import json
from pathlib import Path

# Get latest test report
test_reports_dir = Path("test_reports")
detailed_files = list(test_reports_dir.glob("*/detailed.json"))
if not detailed_files:
    print("No test reports found")
    exit(1)

latest_file = max(detailed_files, key=lambda p: p.stat().st_mtime)
print(f"Checking: {latest_file}")

with open(latest_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Find alignment-related failures
alignment_patterns = ['alignment', 'misaligned', 'alignment_score', 'verdict']
alignment_failures = []

for test in data:
    if test.get('status') != 'failed':
        continue
    
    test_name = test.get('name', '').lower()
    error = test.get('error', test.get('message', '')).lower()
    
    # Check if alignment-related
    is_alignment = any(pattern in test_name or pattern in error for pattern in alignment_patterns)
    
    if is_alignment:
        alignment_failures.append({
            'name': test.get('name', ''),
            'error': error[:200]
        })

print(f"\n🔍 Alignment-related failures: {len(alignment_failures)}")
print("\nFirst 15 failures:")
for i, test in enumerate(alignment_failures[:15], 1):
    print(f"  {i}. {test['name']}")
    if test['error']:
        error_preview = test['error'].split('\n')[0][:80]
        print(f"     {error_preview}...")

