# -*- coding: utf-8 -*-
"""
input_analyzer.py
-----------------
Kullanıcı girdisini analiz eden katman.

Sorumluluklar:
- Ham metni normalize etmek
- LLM'e açıklayıcı bir prompt ile analiz yaptırmak
- Çıktıyı tutarlı bir sözlük formatında döndürmek
"""

from typing import Any, Dict, Optional

from backend.api.utils import call_single_model
from data_store.event_logger import log_event


def _build_system_prompt() -> str:
    """
    LLM için sistem rolü: EZA-Core'un giriş analizi.
    """
    return (
        "Sen EZA-Core için çalışan bir 'Input Analyzer'sın. "
        "Görevin, gelen metni etik açıdan değerlendirmek değil; "
        "önce metni anlamak, sınıflandırmak ve özetlemektir.\n\n"
        "Her zaman JSON formatında cevap ver:\n"
        "{\n"
        '  "topics": [..],\n'
        '  "intent": "kısa niyet cümlesi",\n'
        '  "tone": "ör: nötr / agresif / mizahi",\n'
        '  "risk_flags": ["hate", "self_harm", ...],\n'
        '  "summary": "1–2 cümle özet"\n'
        "}"
    )


def _build_user_prompt(text: str, query: Optional[str]) -> str:
    """
    LLM'e gidecek kullanıcı prompt'unu oluşturur.
    """
    base = f"Kullanıcı metni:\n'''{text}'''\n\n"
    if query:
        base += f"Kullanıcının bağlam sorusu / amacı:\n'''{query}'''\n\n"
    base += "Yukarıdaki formata tam uyan geçerli JSON üret."
    return base


def analyze_input(
    text: str,
    query: Optional[str] = None,
    model: str = "gpt-4o",
) -> Dict[str, Any]:
    """
    Giriş metnini analiz eder ve yapılandırılmış bilgi döndürür.

    Parametreler
    -----------
    text : str
        Kullanıcıdan gelen ham metin.
    query : Optional[str]
        Ek bağlam / soru / amaç bilgisi.
    model : str
        Kullanılacak LLM model kimliği.

    Returns
    -------
    dict:
        {
          "ok": bool,
          "model": str,
          "raw_text": str,
          "analysis": {...},   # LLM'den gelen JSON
          "error": Optional[str]
        }
    """
    event_payload: Dict[str, Any] = {
        "stage": "input_analyzer",
        "model": model,
        "query_present": bool(query),
        "text_preview": text[:200],
    }

    try:
        system_prompt = _build_system_prompt()
        user_prompt = _build_user_prompt(text, query)

        llm_response = call_single_model(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model=model,
            response_format="json",
        )

        result: Dict[str, Any] = {
            "ok": True,
            "model": model,
            "raw_text": text,
            "analysis": llm_response,
            "error": None,
        }

        # Supabase'e log gönder
        event_payload["result_ok"] = True
        event_payload["analysis_summary"] = llm_response.get("summary")
        log_event("input_analyzed", event_payload)

        return result

    except Exception as exc:  # noqa: BLE001
        error_msg = str(exc)

        fail_result: Dict[str, Any] = {
            "ok": True,
            "model": model,
            "raw_text": text,
            "analysis": {
                "topics": [],
                "intent": "Bilinmiyor",
                "tone": "nötr",
                "risk_flags": [],
                "summary": "Varsayılan analiz (fallback)"
            },
            "error": error_msg,
        }

        event_payload["result_ok"] = False
        event_payload["error"] = error_msg
        log_event("input_analyzer_error", event_payload)

        return fail_result
