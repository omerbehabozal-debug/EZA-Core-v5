# -*- coding: utf-8 -*-
"""
EZA Proxy - Rewrite Engine Service
5 rewrite modes: Strict Compliance, Neutral Rewrite, Policy-Bound, Autonomous Safety, Corporate-Voice
"""

import logging
import re
from typing import Optional, List
from backend.gateway.router_adapter import call_llm_provider
from backend.config import get_settings

logger = logging.getLogger(__name__)


def build_rewrite_prompt(
    content: str,
    mode: str,
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None
) -> str:
    """Build rewrite prompt based on mode"""
    
    policy_info = ""
    if policies:
        policy_info = f"\n\nUygulanacak Politikalar: {', '.join(policies)}"
    
    domain_info = ""
    if domain:
        domain_info = f"\n\nSektör: {domain}"
    
    mode_instructions = {
        "strict_compliance": """STRICT COMPLIANCE MODE:
- GDPR, Sağlık, Bankacılık kurallarına sıkı uyum
- Tüm garanti ve kesin iddiaları kaldır
- Yasal uyarılar ekle
- Risk içeren ifadeleri tamamen nötrleştir""",
        
        "neutral_rewrite": """NEUTRAL REWRITE MODE:
- Tarafsızlaştır, objektif hale getir
- Yönlendirici dil kullanma
- Duygusal manipülasyonu kaldır
- Bilgilendirici ton koru""",
        
        "policy_bound": """POLICY-BOUND MODE:
- Regülatör kurallarına uy
- Sektörel standartları uygula
- Uyumluluk garantisi sağla
- Politika ihlallerini düzelt""",
        
        "autonomous_safety": """AUTONOMOUS SAFETY MODE:
- Robotik/otonom sistem güvenliği için optimize et
- Zararlı komutları engelle
- Etik sınırları koru
- Güvenlik protokollerine uy""",
        
        "corporate_voice": """CORPORATE-VOICE MODE:
- Marka dilini koru
- Kurumsal kimliği muhafaza et
- Profesyonel tonu sürdür
- Etik standartları marka değerleriyle dengele"""
    }
    
    mode_instruction = mode_instructions.get(mode, mode_instructions["neutral_rewrite"])
    
    return f"""Sen EZA Proxy rewrite motorusun. Görevin, verilen içeriği {mode} modunda yeniden yazmaktır.

{mode_instruction}{policy_info}{domain_info}

KURALLAR:
- Orijinal anlamı mümkün olduğunca koru
- Sadece yeniden yazılmış metni döndür (açıklama ekleme)
- JSON veya markdown formatı kullanma
- Doğrudan metin döndür

İÇERİK:
{content}

YENİDEN YAZILMIŞ METİN:"""


async def rewrite_content(
    content: str,
    mode: str,
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None,
    provider: str = "openai"
) -> str:
    """
    Rewrite content based on mode
    Returns rewritten text
    """
    settings = get_settings()
    
    prompt = build_rewrite_prompt(content, mode, policies, domain)
    
    try:
        rewritten = await call_llm_provider(
            provider_name=provider,
            prompt=prompt,
            settings=settings,
            model="gpt-4o-mini" if provider == "openai" else None,
            temperature=0.5,
            max_tokens=2000
        )
        
        # Clean up response
        rewritten = rewritten.strip()
        rewritten = re.sub(r'^```json\s*', '', rewritten)
        rewritten = re.sub(r'^```\s*', '', rewritten)
        rewritten = re.sub(r'```\s*$', '', rewritten)
        rewritten = rewritten.strip()
        
        return rewritten
        
    except Exception as e:
        logger.error(f"[Proxy] Rewrite error: {str(e)}")
        raise

