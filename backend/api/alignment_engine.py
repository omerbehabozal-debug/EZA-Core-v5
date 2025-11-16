# -*- coding: utf-8 -*-
"""
alignment_engine.py — EZA-Core v10.2

Input + Output analizlerini birleştirip:
- Alignment etik seviyesini hesaplar
- Risk skorunu ve seviyesini normalize eder
- Açıklanabilir bir özet üretir

Bu katman, "niyet" + "risk" + "model çıktısı" bileşimini
kurumsal seviyede raporlamak için tasarlanmıştır.
"""

from typing import Any, Dict, List, Optional

from backend.message_templates import get_advice_for_category, get_ethically_enhanced_answer
from data_store.event_logger import log_event


# Alignment label'ları — UI tarafında gösterilecek insan-dili etiketler
ALIGNMENT_LABELS = {
    "safe": "Safe",
    "caution": "Caution",
    "unsafe": "Unsafe",
    "critical": "Critical",
}


def _extract_primary_intent(input_analysis: Dict[str, Any]) -> str:
    intent = input_analysis.get("intent") or {}
    primary = intent.get("primary") or "information"
    return str(primary)


def _extract_risk_data(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Input + Output analizlerinden ortak risk profilini çıkar.
    """
    in_flags: List[str] = input_analysis.get("risk_flags") or []
    out_flags: List[str] = output_analysis.get("risk_flags") or []
    
    # EZA-ReasoningShield v5.0: Add reasoning shield red flags
    reasoning_shield = input_analysis.get("reasoning_shield", {})
    if reasoning_shield and reasoning_shield.get("red_flags"):
        in_flags.extend(reasoning_shield["red_flags"])

    merged_flags = list(sorted(set(in_flags + out_flags)))

    in_score = float(input_analysis.get("risk_score") or 0.0)
    out_score = float(output_analysis.get("risk_score") or 0.0)

    # En yüksek risk skoru "master risk" olarak kabul edilir
    master_score = max(in_score, out_score)

    # Risk seviyesini tekrar normalize et (daha okunur hale getirmek için)
    if master_score >= 0.90:
        master_level = "critical"
    elif master_score >= 0.70:
        master_level = "high"
    elif master_score >= 0.40:
        master_level = "medium"
    else:
        master_level = "low"

    return {
        "flags": merged_flags,
        "input_score": in_score,
        "output_score": out_score,
        "master_score": master_score,
        "master_level": master_level,
    }


def _dominant_risk_category(
    primary_intent: str,
    risk_flags: List[str],
) -> Optional[str]:
    """
    Birincil risk kategorisini belirler.
    Önce niyete bakar, sonra risk bayraklarını öncelik sırasına göre değerlendirir.
    """
    # Niyet önceliği
    if primary_intent in ["self-harm", "violence", "illegal", "manipulation"]:
        return primary_intent

    # Bayrak öncelik sırası
    priority = [
        "self-harm",
        "violence",
        "illegal",
        "manipulation",
        "sensitive-data",
        "toxicity",
    ]
    for cat in priority:
        if cat in risk_flags:
            return cat

    return None


def _compute_alignment_label(dominant_category: Optional[str], master_score: float) -> str:
    """
    Dominant risk + skor üzerinden alignment label üret.
    Bu label, frontend'de doğrudan gösterilecek kısa etikettir.
    """
    # Self-harm ve ağır şiddet — her durumda Critical
    if dominant_category == "self-harm":
        return ALIGNMENT_LABELS["critical"]
    if dominant_category == "violence" and master_score >= 0.80:
        return ALIGNMENT_LABELS["critical"]
    # Sensitive-data with ID numbers — always Critical (Mega Patch v1.0)
    if dominant_category == "sensitive-data" and master_score >= 1.0:
        return ALIGNMENT_LABELS["critical"]

    # Genel eşikler
    if master_score == 0:
        return ALIGNMENT_LABELS["safe"]

    if master_score < 0.40:
        return ALIGNMENT_LABELS["safe"]
    elif master_score < 0.70:
        return ALIGNMENT_LABELS["caution"]
    elif master_score < 0.90:
        return ALIGNMENT_LABELS["unsafe"]
    else:
        return ALIGNMENT_LABELS["critical"]


def _compute_alignment_score(master_score: float) -> int:
    """
    0–1 arası risk skorunu 0–100 arası "alignment score" a dönüştür.
    Burada 0 = tamamen güvensiz, 100 = tamamen güvenli.
    """
    safe_score = max(0.0, min(1.0, 1.0 - master_score))
    return int(round(safe_score * 100))


def compute_alignment(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Ana alignment fonksiyonu.
    Frontend'e gitmeden önce main.py içinden çağrılır.
    """

    # 1) Temel niyet ve risk verilerini çek
    primary_intent = _extract_primary_intent(input_analysis)
    risk_data = _extract_risk_data(input_analysis, output_analysis)

    risk_flags = risk_data["flags"]
    master_score = risk_data["master_score"]
    master_level = risk_data["master_level"]

    # 2) Baskın risk kategorisini bul
    dominant_category = _dominant_risk_category(primary_intent, risk_flags)

    # 3) Alignment etiketi ve puanını hesapla
    alignment_label = _compute_alignment_label(dominant_category, master_score)
    alignment_score = _compute_alignment_score(master_score)

    # 4) EZA-IntentEngine v4.0: Update alignment for new intents
    if primary_intent in ["illegal", "violence", "self-harm", "manipulation", "sensitive-data"]:
        if master_score >= 0.8:
            alignment_label = ALIGNMENT_LABELS["critical"]
            alignment_score = 0  # Critical = 0 alignment score
        else:
            alignment_label = ALIGNMENT_LABELS["unsafe"]
            alignment_score = _compute_alignment_score(master_score)
    else:
        alignment_label = ALIGNMENT_LABELS["safe"]

    # 5) Sensitive-data Mega Patch v1.0: Force Critical alignment
    if "sensitive-data" in risk_flags:
        alignment_label = ALIGNMENT_LABELS["critical"]
        alignment_score = 0  # Critical = 0 alignment score

    # 6) Kısa açıklama (rationale)
    if dominant_category is None and master_score == 0:
        rationale = "Herhangi bir ciddi risk tespit edilmedi. İçerik genel olarak güvenli görünüyor."
    else:
        cat_txt = dominant_category or "general-risk"
        rationale = (
            f"Birincil niyet: {primary_intent}. "
            f"Öne çıkan risk kategorisi: {cat_txt}. "
            f"Toplam risk seviyesi: {master_level} (skor={master_score:.2f})."
        )

    result = {
        # Frontend için kısa label — chat.js şu anda bunu kullanıyor
        "label": alignment_label,
        # Daha derin analiz için ek alanlar
        "score": alignment_score,          # 0–100 (yüksek = daha güvenli)
        "primary_intent": primary_intent,
        "dominant_category": dominant_category,
        "risk_flags": risk_flags,
        "master_risk_score": master_score,
        "master_risk_level": master_level,
        "rationale": rationale,
    }

    # 7) EZA-Core v11.0: Use message templates for advice and ethical output
    category = dominant_category or primary_intent
    eza_advice = get_advice_for_category(category, master_level)
    result["eza_advice"] = eza_advice
    
    # Get original output if available
    original_output = output_analysis.get("output_text", "")
    if original_output:
        ethical_output = get_ethically_enhanced_answer(original_output, category, master_level)
        result["ethical_output"] = ethical_output

    # 8) Sensitive-data Mega Patch v1.0: Add ethical message
    if "sensitive-data" in risk_flags:
        result["ethical_message"] = (
            "Bu içerikte kişisel veri talebi tespit edildi. "
            "EZA, kimlik bilgileri veya özel kişisel verilerle ilgili "
            "yönlendirme yapmaz. Güvenlik ve gizlilik önceliklidir."
        )

    log_event("alignment_computed_v11", result)
    return result
