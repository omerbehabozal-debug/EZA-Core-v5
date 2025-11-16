# -*- coding: utf-8 -*-
"""
alignment/advisor.py – EZA-Core v10

Advisor: Generate ethical advice based on analysis.
"""

from typing import Dict, Any


def generate_advice(input_analysis: Dict[str, Any]) -> str:
    """
    Generate ethical advice based on input analysis.
    
    Args:
        input_analysis: Input analysis result
        
    Returns:
        Advice text
    """
    risk_level = input_analysis.get("risk_level", "low")
    primary_intent = input_analysis.get("intent_engine", {}).get("primary", "information")
    
    # Self-harm
    if primary_intent == "self-harm":
        return (
            "Bu mesaj, kendine zarar verme veya intihar riski içeriyor olabilir. "
            "Böyle hissetmek çok zor olabilir, fakat yalnız değilsiniz. "
            "Lütfen güvendiğiniz biriyle ve mümkünse bir ruh sağlığı uzmanıyla "
            "en kısa sürede iletişime geçin."
        )
    
    # Violence
    if primary_intent == "violence":
        return (
            "İçerikte şiddet veya saldırgan davranışlara dair ifadeler tespit edildi. "
            "Şiddet, kalıcı fiziksel ve psikolojik zararlara yol açabilir. "
            "Sorunları, güvenli ve yapıcı yollarla çözmeye odaklanmak her zaman daha sağlıklıdır."
        )
    
    # Illegal
    if primary_intent == "illegal":
        return (
            "İçerikte yasa dışı faaliyetlere yönelik ifadeler tespit edildi. "
            "EZA, suç teşkil eden eylemlerle ilgili talimat vermez. "
            "Yasal ve güvenli çözümler bulmaya odaklanmak en doğrusudur."
        )
    
    # Sensitive-data
    if primary_intent == "sensitive-data":
        return (
            "Bu içerik, başkalarına ait özel veya hassas kişisel verilerle ilgili olabilir. "
            "Kişisel verileri izinsiz paylaşmak veya elde etmeye çalışmak hem etik değildir "
            "hem de hukuki sonuçlar doğurabilir."
        )
    
    # Manipulation
    if primary_intent == "manipulation":
        return (
            "İçerikte başkalarını manipüle etmeye yönelik niyetler görülebilir. "
            "Sağlıklı ilişkiler karşılıklı güven, saygı ve şeffaflık üzerine kuruludur. "
            "Manipülatif yaklaşımlar uzun vadede güveni zedeler."
        )
    
    # Default
    return (
        "Bu içerik için ciddi bir risk tespit edilmedi. "
        "Yine de çevrimiçi ortamlarda paylaştığınız bilgileri dikkatle seçmeniz, "
        "kişisel verilerinizi korumanız ve başkalarına karşı saygılı bir dil "
        "kullanmanız önemlidir."
    )

