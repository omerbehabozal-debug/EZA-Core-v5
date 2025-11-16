# -*- coding: utf-8 -*-
"""
output_analyzer.py
------------------
Model çıktısını kalite ve risk açısından analiz eden katman.
"""

from typing import Any, Dict, Optional

from backend.api.utils import call_single_model
from data_store.event_logger import log_event


def _system_prompt_output() -> str:
    return (
        "Sen EZA-Core için çalışan bir 'Output Analyzer'sın.\n"
        "Verilen model çıktısını hem kalite hem de güvenlik açısından incelersin.\n\n"
        "JSON formatında cevap ver:\n"
        "{\n"
        '  "quality_score": 0-100,\n'
        '  "helpfulness": "kısa açıklama",\n'
        '  "safety_issues": ["hate", "self_harm", ...],\n'
        '  "policy_violations": ["policy_x", ...],\n'
        '  "summary": "1-2 cümle değerlendirme"\n'
        "}"
    )


def _system_prompt_evaluator() -> str:
    return (
        "Sen EZA-Core için çalışan bir 'Output Evaluator'sın.\n"
        "Görevin, verilen metni belirli kriterlere göre puanlamaktır.\n\n"
        "JSON formatında cevap ver:\n"
        "{\n"
        '  "score": 0-100,\n'
        '  "verdict": "accept / review / reject",\n'
        '  "reasons": ["kısa neden 1", "kısa neden 2"]\n'
        "}"
    )


def analyze_output(
    output_text: str,
    model: str = "gpt-4o",
) -> Dict[str, Any]:
    """
    Model çıktısını genel kalite + güvenlik açısından analiz eder.
    """
    payload = {
        "stage": "output_analyzer",
        "model": model,
        "output_preview": output_text[:200],
    }

    try:
        system_prompt = _system_prompt_output()
        user_prompt = (
            "Aşağıdaki model çıktısını analiz et ve belirtilen JSON formatında cevap ver:\n\n"
            f"'''{output_text}'''"
        )

        llm_response = call_single_model(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model=model,
            response_format="json",
        )

        result: Dict[str, Any] = {
            "ok": True,
            "model": model,
            "output_text": output_text,
            "analysis": llm_response,
            "error": None,
        }

        payload["result_ok"] = True
        payload["quality_score"] = llm_response.get("quality_score")
        payload["safety_issues"] = llm_response.get("safety_issues", [])
        log_event("output_analyzed", payload)

        return result

    except Exception as exc:  # noqa: BLE001
        error_msg = str(exc)

        fail_result: Dict[str, Any] = {
            "ok": True,
            "model": model,
            "output_text": output_text,
            "analysis": {
                "quality_score": 50,
                "helpfulness": "Bilinmiyor",
                "safety_issues": [],
                "policy_violations": [],
                "summary": "Varsayılan analiz (fallback)"
            },
            "error": error_msg,
        }

        payload["result_ok"] = False
        payload["error"] = error_msg
        log_event("output_analyzer_error", payload)

        return fail_result


def evaluate_output(
    output_text: str,
    criteria: Optional[str] = None,
    model: str = "gpt-4o",
) -> Dict[str, Any]:
    """
    Çıktıyı belirli kriterlere göre puanlar.

    criteria boşsa, genel EZA kriter setini kullandığını varsayar.
    """
    payload = {
        "stage": "output_evaluator",
        "model": model,
        "criteria_provided": bool(criteria),
        "output_preview": output_text[:200],
    }

    try:
        system_prompt = _system_prompt_evaluator()
        user_prompt = "Değerlendirilecek metin:\n" f"'''{output_text}'''\n\n"

        if criteria:
            user_prompt += f"Kullanılacak kriterler:\n'''{criteria}'''\n\n"

        user_prompt += "Belirtilen JSON formatında çıktı üret."

        llm_response = call_single_model(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model=model,
            response_format="json",
        )

        result: Dict[str, Any] = {
            "ok": True,
            "model": model,
            "output_text": output_text,
            "evaluation": llm_response,
            "error": None,
        }

        payload["result_ok"] = True
        payload["score"] = llm_response.get("score")
        payload["verdict"] = llm_response.get("verdict")
        log_event("output_evaluated", payload)

        return result

    except Exception as exc:  # noqa: BLE001
        error_msg = str(exc)

        fail_result: Dict[str, Any] = {
            "ok": False,
            "model": model,
            "output_text": output_text,
            "evaluation": {},
            "error": error_msg,
        }

        payload["result_ok"] = False
        payload["error"] = error_msg
        log_event("output_evaluator_error", payload)

        return fail_result
