# -*- coding: utf-8 -*-
"""
advisor.py
----------
Alignment sonucuna göre aksiyon / tavsiye üreten katman.
"""

from typing import Any, Dict

from backend.api.utils import call_single_model
from data_store.event_logger import log_event


def _system_prompt_advisor() -> str:
    return (
        "Sen EZA-Core'un 'Ethical Advisor' katmanısın.\n"
        "Input analizi, output analizi ve alignment sonucunu alırsın;\n"
        "amacın yasaklamak değil, rehberlik etmektir.\n\n"
        "JSON formatında cevap ver:\n"
        "{\n"
        '  "user_message": "kullanıcıya sade tavsiye",\n'
        '  "developer_notes": "geliştiriciye teknik/etik notlar",\n'
        '  "risk_level": "low / medium / high",\n'
        '  "suggested_actions": ["log", "manual_review", ...]\n'
        "}"
    )


def generate_advice(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    alignment_result: Dict[str, Any],
    model: str = "gpt-4o",
) -> str:
    """
    DEMO etik tavsiye.
    UI string beklediği için düz metin döndür.
    """
    payload: Dict[str, Any] = {
        "stage": "advisor",
        "alignment_ok": alignment_result.get("ok"),
        "alignment_score": alignment_result.get("alignment_score"),
        "alignment_label": alignment_result.get("alignment_label"),
    }

    try:
        # Demo tavsiye metni
        advice_text = "Güçlü şifreler kullanın ve şüpheli bağlantılara tıklamaktan kaçının."

        # Gerçek LLM çağrısı yapılabilir (opsiyonel)
        # system_prompt = _system_prompt_advisor()
        # user_prompt = (
        #     "Aşağıda EZA-Core katmanlarından gelen üç farklı özet var.\n\n"
        #     "1) Input Analysis:\n"
        #     f"{input_analysis}\n\n"
        #     "2) Output Analysis:\n"
        #     f"{output_analysis}\n\n"
        #     "3) Alignment Result:\n"
        #     f"{alignment_result}\n\n"
        #     "Görevin; kullanıcıya sade bir mesaj önermektir."
        # )
        # llm_response = call_single_model(
        #     system_prompt=system_prompt,
        #     user_prompt=user_prompt,
        #     model=model,
        #     response_format="json",
        # )
        # if isinstance(llm_response, dict):
        #     advice_text = llm_response.get("user_message", advice_text)

        payload.update(
            {
                "result_ok": True,
            }
        )
        log_event("advice_generated", payload)

        return advice_text

    except Exception as exc:  # noqa: BLE001
        error_msg = str(exc)

        payload["result_ok"] = False
        payload["error"] = error_msg
        log_event("advisor_error", payload)

        return "Tavsiye oluşturulurken bir hata oluştu."
