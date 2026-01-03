#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Analyze Test Count Difference
Explains the difference between 5,406 (all-time) and 636 (current suites)
"""

import json
from pathlib import Path
from collections import Counter

def main():
    # Get all test reports
    test_reports_dir = Path("test_reports")
    all_reports = list(test_reports_dir.glob("*/detailed.json"))
    
    print("=" * 70)
    print("TEST SAYISI FARK ANALİZİ")
    print("=" * 70)
    print()
    
    # 1. Tüm zamanların toplamı
    total_tests_all = 0
    test_counts = []
    
    for report_file in all_reports:
        try:
            with open(report_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            count = len(data)
            total_tests_all += count
            test_counts.append(count)
        except Exception:
            continue
    
    print(f"📊 TÜM ZAMANLARIN TOPLAMI: {total_tests_all} test")
    print(f"   - Toplam rapor dosyası: {len(all_reports)}")
    print(f"   - Ortalama test sayısı per rapor: {sum(test_counts)/len(test_counts):.1f}")
    print(f"   - En az test: {min(test_counts)}")
    print(f"   - En fazla test: {max(test_counts)}")
    print()
    
    # 2. Mevcut test suite'lerin toplamı
    current_suites_total = 132 + 50 + 45 + 100 + 127 + 100 + 30 + 52
    print(f"📋 MEVCUT TEST SUITE'LERİN TOPLAMI: {current_suites_total} test")
    print("   - Adversarial Detection: 132")
    print("   - Core: 50")
    print("   - Behavioral: 45")
    print("   - Behavioral Extended: 100")
    print("   - Policy: 127")
    print("   - Multi-Turn: 100")
    print("   - Multi-Model: 30")
    print("   - Performance: 52")
    print()
    
    # 3. Fark
    difference = total_tests_all - current_suites_total
    print(f"🔍 FARK: {difference} test")
    print(f"   ({total_tests_all} - {current_suites_total} = {difference})")
    print()
    
    # 4. Açıklama
    print("=" * 70)
    print("AÇIKLAMA")
    print("=" * 70)
    print()
    print("5,406 test = TÜM ZAMANLARIN TOPLAMI")
    print("  → Aynı testlerin farklı zamanlarda tekrar tekrar çalıştırılması")
    print("  → Her test çalıştırması bir rapor oluşturuyor")
    print("  → 163 rapor dosyası var")
    print("  → Her raporda ortalama ~33 test var")
    print("  → 163 × 33 ≈ 5,400 test (tüm zamanların toplamı)")
    print()
    print("636 test = MEVCUT TEST SUITE'LERİN TOPLAMI")
    print("  → Her test türünün mevcut test sayısı")
    print("  → Bu, sistemdeki toplam benzersiz test sayısı")
    print("  → Aynı testler tekrar sayılmıyor")
    print()
    print("FARK = 5,406 - 636 = 4,770 test")
    print("  → Bu fark, aynı testlerin tekrar tekrar çalıştırılmasından kaynaklanıyor")
    print("  → Örnek: Core testleri (50 test) 100 kez çalıştırıldıysa")
    print("    → 50 × 100 = 5,000 test (tüm zamanlar)")
    print("    → Ama mevcut suite'de hala 50 test var")
    print()
    
    # 5. Test sayısı dağılımı
    print("=" * 70)
    print("TEST SAYISI DAĞILIMI")
    print("=" * 70)
    count_distribution = Counter(test_counts)
    print("Raporlardaki test sayıları:")
    for count, frequency in sorted(count_distribution.items())[:20]:
        print(f"  {count} test: {frequency} rapor")
    print()

if __name__ == "__main__":
    main()

