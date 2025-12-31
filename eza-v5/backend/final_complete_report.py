#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Final Complete Test Report with Session Fixes"""

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

# Find all major test runs
major_runs = []
for report_file in all_reports:
    with open(report_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    total = len(data)
    if total >= 200:  # Include runs with 200+ tests
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
print("📊 FINAL COMPLETE TEST HISTORY REPORT")
print("=" * 80)
print()

print("=" * 80)
print("📈 ALL-TIME STATISTICS (Tüm Test Geçmişi)")
print("=" * 80)
print(f"   🎯 Toplam Test Run Sayısı: {len(all_reports):,}")
print(f"   🎯 Toplam Test Çalıştırıldı: {total_tests_all:,}")
print(f"   ✅ Toplam Başarılı: {total_passed_all:,}")
print(f"   ❌ Toplam Başarısız: {total_failed_all:,}")
if total_tests_all > 0:
    overall_rate = (total_passed_all / total_tests_all * 100)
    print(f"   📊 Genel Başarı Oranı: {overall_rate:.1f}%")
print()

# Show major runs
if major_runs:
    print("=" * 80)
    print("📊 MAJOR TEST RUNS (200+ Tests)")
    print("=" * 80)
    print()
    
    for i, run in enumerate(major_runs, 1):
        print(f"   {i}. {run['date'].strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"      Total: {run['total']:,} tests")
        print(f"      ✅ Passed: {run['passed']:,} ({run['rate']:.1f}%)")
        print(f"      ❌ Failed: {run['failed']:,} ({100-run['rate']:.1f}%)")
        print()

# Get first and last major runs
first_major = major_runs[0] if major_runs else None
last_major = major_runs[-1] if major_runs else None

if first_major and last_major:
    print("=" * 80)
    print("🔧 DÜZELTMELER & İYİLEŞTİRMELER ANALİZİ")
    print("=" * 80)
    print()
    
    initial_failed = first_major['failed']
    current_failed = last_major['failed']
    tests_fixed = initial_failed - current_failed
    
    initial_rate = first_major['rate']
    current_rate = last_major['rate']
    improvement = current_rate - initial_rate
    
    print(f"   📊 İlk Major Test Run:")
    print(f"      Tarih: {first_major['date'].strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"      Test Sayısı: {first_major['total']:,}")
    print(f"      Başarılı: {first_major['passed']:,} ({first_major['rate']:.1f}%)")
    print(f"      Başarısız: {first_major['failed']:,} ({100-first_major['rate']:.1f}%)")
    print()
    
    print(f"   📊 Son Major Test Run:")
    print(f"      Tarih: {last_major['date'].strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"      Test Sayısı: {last_major['total']:,}")
    print(f"      Başarılı: {last_major['passed']:,} ({last_major['rate']:.1f}%)")
    print(f"      Başarısız: {last_major['failed']:,} ({100-last_major['rate']:.1f}%)")
    print()
    
    print(f"   🔧 Düzeltmeler:")
    print(f"      İlk Başarısız Test: {initial_failed}")
    print(f"      Şu An Başarısız Test: {current_failed}")
    print(f"      ✅ Düzeltilen Test: {tests_fixed}")
    if initial_failed > 0:
        fix_rate = (tests_fixed / initial_failed * 100)
        print(f"      📊 Düzeltme Başarı Oranı: {fix_rate:.1f}%")
    print()
    
    print(f"   📈 İyileştirme:")
    print(f"      İlk Başarı Oranı: {initial_rate:.1f}%")
    print(f"      Şu An Başarı Oranı: {current_rate:.1f}%")
    print(f"      📈 İyileştirme: +{improvement:.1f}%")
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
        print("📦 ŞU ANKİ DURUM (Test Suite Bazında)")
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
            print(f"      Toplam: {suite_total:,} test")
            print(f"      ✅ Başarılı: {suite_passed:,} ({suite_passed/suite_total*100:.1f}%)")
            print(f"      ❌ Başarısız: {suite_failed:,} ({suite_failed/suite_total*100:.1f}%)")
            print(f"      📊 Başarı Oranı: {suite_rate:.1f}%")
            print()

print("=" * 80)
print("📊 ÖZET")
print("=" * 80)
print(f"   🎯 Toplam Test Çalıştırıldı (Tüm Zamanlar): {total_tests_all:,}")
print(f"   ✅ Toplam Başarılı: {total_passed_all:,}")
print(f"   ❌ Toplam Başarısız: {total_failed_all:,}")
if total_tests_all > 0:
    print(f"   📊 Genel Başarı Oranı: {(total_passed_all / total_tests_all * 100):.1f}%")
print()

if first_major and last_major:
    print(f"   📈 İlerleme:")
    print(f"      İlk Major Run: {first_major['total']:,} test, {first_major['rate']:.1f}% başarı, {first_major['failed']} hata")
    print(f"      Son Major Run: {last_major['total']:,} test, {last_major['rate']:.1f}% başarı, {last_major['failed']} hata")
    if tests_fixed > 0:
        print(f"      ✅ Düzeltilen: {tests_fixed} test")
        print(f"      📈 İyileştirme: +{improvement:.1f}%")
    else:
        print(f"      ⚠️  Düzeltme: Henüz yapılmadı (aynı rapor)")
print()

