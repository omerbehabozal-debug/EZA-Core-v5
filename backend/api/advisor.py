# -*- coding: utf-8 -*-
"""
advisor.py — EZA-Core v10.2

Niyet + risk + alignment çıktılarına göre:
- Etik tavsiye metni
- Etik olarak güçlendirilmiş cevap

üretilmesinden sorumlu katman.
"""

from typing import Any, Dict, Optional

from backend.api.utils.model_runner import rewrite_with_ethics


def _advice_for_self_harm() -> str:
    return (
        "Bu mesaj, kendine zarar verme veya intihar riski içeriyor olabilir. "
        "Bu tür düşüncelerle başa çıkmak çok zor olabilir, fakat yalnız değilsiniz. "
        "Lütfen güvendiğiniz bir aile üyesi, arkadaş ya da bir sağlık profesyoneliyle "
        "en kısa sürede iletişime geçin. Bulunduğunuz ülkedeki acil yardım ve kriz "
        "hatlarıyla görüşmekten çekinmeyin."
    )


def _advice_for_violence() -> str:
    return (
        "İçerikte şiddet veya saldırgan davranışlara dair ifadeler tespit edildi. "
        "Şiddet, kalıcı fiziksel ve psikolojik zararlar doğurabilir. "
        "Sorunları, güvenli ve yapıcı yollarla çözmeye odaklanmak her zaman daha sağlıklıdır."
    )


def _advice_for_illegal() -> str:
    return (
        "İçerikte yasa dışı faaliyetlere yönelik ifadeler tespit edildi. "
        "EZA, suç teşkil eden eylemlerle ilgili talimat vermez. "
        "Bunun yerine, yasal ve güvenli çözümler bulmanıza yardımcı olacak bilgilere "
        "odaklanmak daha doğrudur."
    )


def _advice_for_manipulation() -> str:
    return (
        "İçerikte başkalarını manipüle etmeye yönelik niyetler görülebilir. "
        "Sağlıklı ilişkiler karşılıklı güven, saygı ve şeffaflık üzerine kuruludur. "
        "Manipülatif yaklaşımlar uzun vadede güveni zedeler."
    )


def _advice_for_sensitive_data() -> str:
    return (
        "Bu içerikte kişisel veri talebi tespit edildi. "
        "EZA, kimlik bilgileri veya özel kişisel verilerle ilgili "
        "yönlendirme yapmaz. Güvenlik ve gizlilik önceliklidir. "
        "Çevrimiçi ortamlarda paylaştığınız kimlik, finansal bilgi ve şifreler gibi "
        "verileri dikkatle korumanız, üçüncü kişilerle paylaşmamanız çok önemlidir."
    )


def _advice_for_toxicity() -> str:
    return (
        "İçerikte sert, kırıcı veya toksik ifadeler bulunuyor olabilir. "
        "Farklı görüşlere sahip olsak bile, saygılı ve yapıcı bir dil kullanmak "
        "uzun vadede daha iyi sonuçlar doğurur."
    )


def _advice_for_safe() -> str:
    return (
        "Bu içerik için ciddi bir risk tespit edilmedi. "
        "Yine de çevrimiçi ortamlarda paylaştığınız bilgileri dikkatle seçmeniz, "
        "kişisel verilerinizi korumanız ve başkalarına karşı saygılı bir dil kullanmanız önemlidir."
    )


def _pick_dominant_category(
    alignment_meta: Dict[str, Any],
) -> str:
    """
    alignment_engine tarafından dönen dominant_category varsa onu al,
    yoksa risk_flags içinden öncelik sırasına göre seç.
    """
    dominant = alignment_meta.get("dominant_category")
    if dominant:
        return dominant

    risk_flags = alignment_meta.get("risk_flags") or []

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

    return "safe"


def generate_advice(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    alignment_meta: Dict[str, Any],
) -> str:
    """
    Alignment sonucuna ve risklere göre etik tavsiye metnini üretir.
    """
    # EZA-IdentityBlock v3.0: Check identity risk first (highest priority)
    identity_info = input_analysis.get("identity_block") or input_analysis.get("analysis", {}).get("identity", {})
    if identity_info and isinstance(identity_info, dict):
        identity_risk = identity_info.get("identity_risk_score", 0.0)
        if identity_risk > 0.5:
            return (
                "Bu içerik yüz tanıma, kimlik çıkarımı veya kişisel bilgi tespiti riski içerdiğinden yardımcı olamam. "
                "Kişisel verilerin korunması ve gizlilik hakları önceliklidir."
            )
    
    # EZA-NarrativeEngine v4.0: Check narrative risk
    narrative_info = input_analysis.get("analysis", {}).get("narrative", {})
    if narrative_info and isinstance(narrative_info, dict):
        narrative_score = narrative_info.get("narrative_score", 0.0)
        if narrative_score > 0.5:
            return (
                "Konuşma akışında risk artışı veya manipülatif bir gelişim tespit edildi. "
                "Bu nedenle yardımcı olamam."
            )
    
    category = _pick_dominant_category(alignment_meta)

    if category == "self-harm":
        return _advice_for_self_harm()
    if category == "violence":
        return _advice_for_violence()
    if category == "illegal":
        return _advice_for_illegal()
    if category == "manipulation":
        return _advice_for_manipulation()
    if category == "sensitive-data":
        return _advice_for_sensitive_data()
    if category == "toxicity":
        return _advice_for_toxicity()

    return _advice_for_safe()


def generate_safe_rewrite(result: Dict[str, Any]) -> str:
    """
    EZA-IntentEngine v4.0: Generate safe rewrite based on intent and risk level.
    
    Args:
        result: Dictionary containing intent and risk_level
        
    Returns:
        Safe rewritten text
    """
    intent = result.get("intent", {})
    primary_intent = intent.get("primary", "information") if isinstance(intent, dict) else str(intent)
    risk = result.get("risk_level", "low")
    
    if risk == "critical":
        return (
            "Bu içerik yüksek riskli davranış, şiddet, kişisel veri ihlali veya "
            "başkasına zarar verme isteği içerebilir. EZA bu tür taleplere destek vermez. "
            "Daha güvenli ve yasal yollarla ilerlemek en doğrusudur."
        )
    elif risk == "high":
        return (
            "İçerikte riskli veya hassas ifadeler olabilir. "
            "EZA, güvenli ve etik şekilde yönlendirme yapmayı tercih eder."
        )
    else:
        return result.get("output_text", "")


def generate_rewritten_answer(
    original_answer: str,
    advice_text: str,
    alignment_meta: Dict[str, Any],
) -> str:
    """
    Etik olarak güçlendirilmiş cevabı üretir.
    Şu an basit bir kompozisyon kullanıyoruz; ileride
    büyük bir model ile rewrite yapılabilir.
    """
    # alignment seviyesini de metne yedirelim (debug amaçlı, ama kullanıcıya da anlamlı)
    label = alignment_meta.get("label") or alignment_meta.get("alignment") or ""
    score = alignment_meta.get("score")

    header = "Bu isteğe doğrudan yardım edemem çünkü şiddet, yasa dışı faaliyetler " \
             "veya başkalarına zarar verebilecek davranışlar etik değildir. " \
             "Bunun yerine, sorunları yasal, güvenli ve saygılı yollarla çözmeye " \
             "odaklanmak en doğrusudur.\n\n"

    # Self-harm için metin daha hassas olmalı, ekstra sertlikten kaçınalım
    dominant = _pick_dominant_category(alignment_meta)
    if dominant == "self-harm":
        header = (
            "Bu mesaj, kendinize zarar verme veya intihar düşüncelerini içerebilir. "
            "Bu tür duygularla baş etmek çok zor olabilir, fakat yalnız değilsiniz. "
            "Buradan yalnızca genel bilgiler verebilirim; profesyonel destek almak "
            "çok daha önemlidir.\n\n"
        )

    base = rewrite_with_ethics(original_answer, advice_text)

    extra = ""
    if score is not None:
        extra = f"\n\n[EZA Alignment]: {label} (güvenlik skoru: {score}/100)"

    return header + base + extra
