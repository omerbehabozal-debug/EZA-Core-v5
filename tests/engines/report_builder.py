import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

REPORTS_ROOT = Path("tests/reports")
LATEST_DIR = REPORTS_ROOT / "latest"
LATEST_JSON = LATEST_DIR / "summary.json"
LATEST_HTML = LATEST_DIR / "index.html"


def ensure_latest_dir() -> None:
    LATEST_DIR.mkdir(parents=True, exist_ok=True)


def write_json_summary(
    total_tests: int,
    failed_tests: int,
    duration_seconds: float,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    ensure_latest_dir()
    payload: Dict[str, Any] = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_tests": total_tests,
        "failed_tests": failed_tests,
        "passed_tests": total_tests - failed_tests,
        "duration_seconds": duration_seconds,
    }
    if extra:
        payload["extra"] = extra
    LATEST_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_simple_html(summary: Dict[str, Any]) -> None:
    ensure_latest_dir()
    html = f"""<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>EZA Pro Test Suite Raporu</title>
  <style>
    body {{
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 24px;
      background: #0b1020;
      color: #f5f5f5;
    }}
    .card {{
      max-width: 640px;
      margin: 0 auto;
      background: #151a2c;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.45);
    }}
    .title {{
      font-size: 24px;
      margin-bottom: 8px;
    }}
    .subtitle {{
      font-size: 13px;
      opacity: 0.8;
      margin-bottom: 16px;
    }}
    .row {{
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }}
    .label {{
      opacity: 0.8;
      font-size: 14px;
    }}
    .value {{
      font-weight: 600;
      font-size: 14px;
    }}
    .status-ok {{
      color: #7dd87d;
    }}
    .status-fail {{
      color: #ff6b6b;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="title">EZA Pro Test Suite</div>
    <div class="subtitle">Otomatik test özeti</div>

    <div class="row">
      <div class="label">Oluşturulma zamanı</div>
      <div class="value">{summary.get("generated_at", "")}</div>
    </div>

    <div class="row">
      <div class="label">Toplam test</div>
      <div class="value">{summary.get("total_tests", 0)}</div>
    </div>

    <div class="row">
      <div class="label">Başarılı</div>
      <div class="value status-ok">{summary.get("passed_tests", 0)}</div>
    </div>

    <div class="row">
      <div class="label">Hatalı</div>
      <div class="value status-fail">{summary.get("failed_tests", 0)}</div>
    </div>

    <div class="row">
      <div class="label">Süre (sn)</div>
      <div class="value">{summary.get("duration_seconds", 0.0):.2f}</div>
    </div>
  </div>
</body>
</html>
"""
    LATEST_HTML.write_text(html, encoding="utf-8")

