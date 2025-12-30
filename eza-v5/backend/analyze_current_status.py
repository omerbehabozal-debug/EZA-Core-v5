#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Analyze current test status by category"""

import json
from pathlib import Path
from collections import defaultdict

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

# Define categories with patterns
categories = {
    "adversarial_detection": {
        "patterns": ["emoji", "jailbreak", "obfuscation", "mode switching", "instruction override", "mixed attack", "multilingual attack"],
        "tests": [],
        "failed": []
    },
    "safe_content_scoring": {
        "patterns": ["should have high score", ">= 70", "got 0.0", "got 38.0", "got 51.0", "low risk input should have high score"],
        "tests": [],
        "failed": []
    },
    "risky_content_scoring": {
        "patterns": ["should have low score", "< 50", "got 56.0", "got 70.0", "got 90.0", "high risk input should have low score"],
        "tests": [],
        "failed": []
    },
    "risk_level_detection": {
        "patterns": ["risk_level", "should be", "medium", "high", "got low", "expected high", "expected medium"],
        "tests": [],
        "failed": []
    },
    "alignment_issues": {
        "patterns": ["alignment_score", "alignment", "verdict", "misaligned"],
        "tests": [],
        "failed": []
    },
    "multiturn_context": {
        "patterns": ["multiturn", "conversation", "progressive", "escalation", "manipulation", "risk should not decrease"],
        "tests": [],
        "failed": []
    },
    "performance_issues": {
        "patterns": ["duration", "throughput", "latency", "burst", "too long", "error rate too high"],
        "tests": [],
        "failed": []
    }
}

# Categorize tests
for test in data:
    test_name = test.get('name', '').lower()
    error = test.get('error', test.get('message', '')).lower()
    status = test.get('status', '')
    
    categorized = False
    for category_name, category_info in categories.items():
        for pattern in category_info["patterns"]:
            if pattern.lower() in test_name or pattern.lower() in error:
                category_info["tests"].append(test)
                if status == 'failed':
                    category_info["failed"].append(test)
                categorized = True
                break
        if categorized:
            break

# Print results
print("=" * 80)
print("TEST STATUS BY CATEGORY")
print("=" * 80)
print()

total_tests = len(data)
total_failed = sum(1 for t in data if t.get('status') == 'failed')
total_passed = total_tests - total_failed

print(f"📊 OVERALL: {total_passed}/{total_tests} passed ({total_failed} failed)")
print(f"   Success rate: {total_passed/total_tests*100:.1f}%")
print()

# HIGH PRIORITY
print("🔴 HIGH PRIORITY:")
print()

adversarial = categories["adversarial_detection"]
adversarial_total = len(adversarial["tests"])
adversarial_failed = len(adversarial["failed"])
adversarial_passed = adversarial_total - adversarial_failed
print(f"   Adversarial Detection:")
print(f"      Total: {adversarial_total} tests")
print(f"      ✅ Passed: {adversarial_passed}")
print(f"      ❌ Failed: {adversarial_failed}")
if adversarial_total > 0:
    print(f"      📊 Success: {adversarial_passed/adversarial_total*100:.1f}%")
print()

safe_scoring = categories["safe_content_scoring"]
safe_total = len(safe_scoring["tests"])
safe_failed = len(safe_scoring["failed"])
safe_passed = safe_total - safe_failed
print(f"   Safe Content Scoring:")
print(f"      Total: {safe_total} tests")
print(f"      ✅ Passed: {safe_passed}")
print(f"      ❌ Failed: {safe_failed}")
if safe_total > 0:
    print(f"      📊 Success: {safe_passed/safe_total*100:.1f}%")
print()

risky_scoring = categories["risky_content_scoring"]
risky_total = len(risky_scoring["tests"])
risky_failed = len(risky_scoring["failed"])
risky_passed = risky_total - risky_failed
print(f"   Risky Content Scoring:")
print(f"      Total: {risky_total} tests")
print(f"      ✅ Passed: {risky_passed}")
print(f"      ❌ Failed: {risky_failed}")
if risky_total > 0:
    print(f"      📊 Success: {risky_passed/risky_total*100:.1f}%")
print()

high_priority_total = adversarial_total + safe_total + risky_total
high_priority_failed = adversarial_failed + safe_failed + risky_failed
high_priority_passed = high_priority_total - high_priority_failed
print(f"   HIGH PRIORITY TOTAL: {high_priority_passed}/{high_priority_total} passed ({high_priority_failed} failed)")
if high_priority_total > 0:
    print(f"      📊 Success: {high_priority_passed/high_priority_total*100:.1f}%")
print()

# MEDIUM PRIORITY
print("🟡 MEDIUM PRIORITY:")
print()

risk_level = categories["risk_level_detection"]
risk_level_total = len(risk_level["tests"])
risk_level_failed = len(risk_level["failed"])
risk_level_passed = risk_level_total - risk_level_failed
print(f"   Risk Level Detection:")
print(f"      Total: {risk_level_total} tests")
print(f"      ✅ Passed: {risk_level_passed}")
print(f"      ❌ Failed: {risk_level_failed}")
if risk_level_total > 0:
    print(f"      📊 Success: {risk_level_passed/risk_level_total*100:.1f}%")
print()

alignment = categories["alignment_issues"]
alignment_total = len(alignment["tests"])
alignment_failed = len(alignment["failed"])
alignment_passed = alignment_total - alignment_failed
print(f"   Alignment Issues:")
print(f"      Total: {alignment_total} tests")
print(f"      ✅ Passed: {alignment_passed}")
print(f"      ❌ Failed: {alignment_failed}")
if alignment_total > 0:
    print(f"      📊 Success: {alignment_passed/alignment_total*100:.1f}%")
print()

# LOW PRIORITY
print("🟢 LOW PRIORITY:")
print()

multiturn = categories["multiturn_context"]
multiturn_total = len(multiturn["tests"])
multiturn_failed = len(multiturn["failed"])
multiturn_passed = multiturn_total - multiturn_failed
print(f"   Multi-Turn Context:")
print(f"      Total: {multiturn_total} tests")
print(f"      ✅ Passed: {multiturn_passed}")
print(f"      ❌ Failed: {multiturn_failed}")
if multiturn_total > 0:
    print(f"      📊 Success: {multiturn_passed/multiturn_total*100:.1f}%")
print()

performance = categories["performance_issues"]
perf_total = len(performance["tests"])
perf_failed = len(performance["failed"])
perf_passed = perf_total - perf_failed
print(f"   Performance Issues:")
print(f"      Total: {perf_total} tests")
print(f"      ✅ Passed: {perf_passed}")
print(f"      ❌ Failed: {perf_failed}")
if perf_total > 0:
    print(f"      📊 Success: {perf_passed/perf_total*100:.1f}%")
print()

print("=" * 80)
print("📈 SUMMARY")
print("=" * 80)
print(f"Total categorized tests: {sum(len(c['tests']) for c in categories.values())}")
print(f"Total categorized failures: {sum(len(c['failed']) for c in categories.values())}")
print()

# Show sample failures for each category
print("🔍 SAMPLE FAILURES (Top 3 per category):")
print()
for category_name, category_info in categories.items():
    if category_info["failed"]:
        print(f"   {category_name.upper().replace('_', ' ')} ({len(category_info['failed'])} failures):")
        for i, test in enumerate(category_info["failed"][:3], 1):
            print(f"      {i}. {test['name']}")
        if len(category_info["failed"]) > 3:
            print(f"      ... and {len(category_info['failed']) - 3} more")
        print()

