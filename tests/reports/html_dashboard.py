import json
from pathlib import Path
from typing import Any, Dict

from tests.engines.report_builder import LATEST_JSON, LATEST_HTML, write_simple_html


def generate_dashboard() -> Dict[str, Any]:
    """
    JSON özet dosyasını okuyup basit bir HTML dashboard üretir.
    """
    if not LATEST_JSON.exists():
        raise FileNotFoundError("Önce testler çalıştırılmalı (summary.json yok).")

    summary = json.loads(LATEST_JSON.read_text(encoding="utf-8"))
    write_simple_html(summary)
    return {
        "json_path": str(LATEST_JSON),
        "html_path": str(LATEST_HTML),
        "summary": summary,
    }

