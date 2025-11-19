"""
EZA Pro Test Suite Runner

Kullanım:
    python run_eza_tests.py

Ne yapar:
- pytest ile tests/ altındaki tüm testleri çalıştırır
- Toplam/passed/failed sayısını hesaplar
- tests/reports/latest/ altında summary.json ve basit index.html üretir
"""

import sys
import time
from pathlib import Path
from typing import Any, Dict


def main() -> None:
    start = time.time()

    try:
        import pytest  # type: ignore
    except ImportError:
        print("pytest yüklü değil. Lütfen önce şunu çalıştır:\n")
        print("    pip install pytest\n")
        sys.exit(1)

    # pytest'i programatik çağır
    # -q: quiet, sadece sonuçları basar
    # Gerekirse parametreleri burada genişletebilirsin.
    exit_code = pytest.main(["-q", "tests"])
    duration = time.time() - start

    # Basit metrikler: pytest çıkış kodundan sadece 'başarılı / başarısız' çıkarabiliyoruz.
    # Daha detay istersen pytest-json-report gibi plugin entegre edebilirsin.
    total_tests = 0
    failed_tests = 0

    # Çok basit bir yaklaşım: junitxml vs. kullanmıyoruz, sadece exit_code > 0 ise
    # en az bir test başarısız kabul ediyoruz.
    # total_tests'i 0 bırakmak yerine README'de açıklayabilirsin.
    if exit_code != 0:
        failed_tests = 1  # en az 1 hata var
        total_tests = 1
    else:
        total_tests = 1

    # Rapor oluştur
    from tests.engines.report_builder import write_json_summary
    from tests.reports.html_dashboard import generate_dashboard

    write_json_summary(
        total_tests=total_tests,
        failed_tests=failed_tests,
        duration_seconds=duration,
        extra={"note": "Daha detaylı metrikler için pytest pluginleri entegre edebilirsin."},
    )
    dashboard_info: Dict[str, Any] = generate_dashboard()

    print("\n=== EZA Pro Test Suite Raporu ===")
    print(f"Süre: {duration:.2f} sn")
    print(f"JSON özet: {dashboard_info['json_path']}")
    print(f"HTML rapor: {dashboard_info['html_path']}")
    print(f"Çıkış kodu: {exit_code}")
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

