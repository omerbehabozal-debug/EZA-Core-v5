# -*- coding: utf-8 -*-
"""
EZA Proxy - Rewrite Engine Service (Camera-Mode, Non-Intrusive)
EZA is not an editor. EZA is not an intervention system. EZA functions as a camera.

Rewrite = suggestion only, context-preserving, non-aggressive, minimal improvement if possible.
"""

import logging
import re
from typing import Optional, List, Tuple
from backend.gateway.router_adapter import call_llm_provider
from backend.config import get_settings

logger = logging.getLogger(__name__)

# Context viability rejection message
CONTEXT_PRESERVATION_FAILED_MESSAGE = (
    "Bu metin, riskleri azaltılırken bağlamını büyük ölçüde kaybediyor.\n"
    "EZA müdahale etmez.\n"
    "Riskli noktalar işaretlendi, düzenleme kullanıcıya bırakıldı."
)


def build_rewrite_prompt(
    content: str,
    mode: str,
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None
) -> str:
    """
    Build minimal, context-preserving rewrite prompt
    
    CORE PRINCIPLE: EZA is a camera, not an editor.
    Rewrite = suggestion only, minimal modification, context preservation mandatory.
    """
    
    policy_info = ""
    if policies:
        policy_info = f"\n\nUygulanacak Politikalar: {', '.join(policies)}"
    
    domain_info = ""
    if domain:
        domain_info = f"\n\nSektör: {domain}"
    
    # Minimal rewrite instructions (all modes follow same principle)
    base_instruction = """EZA ÖNERİ YAZI OLUŞTURMA MODU (Camera-Mode, Non-Intrusive)

EZA bir editör değildir. EZA bir müdahale sistemi değildir. EZA bir kamera gibi çalışır.

TEMEL KURALLAR (MUTLAK):
1. ORİJİNAL ANLAM MUTLAK KORUNMALI
2. NARRATIVE VOICE (anlatım tarzı) KORUNMALI
3. AUTHOR INTENT (yazar niyeti) KORUNMALI
4. EMOTIONAL TONE (duygusal ton) KORUNMALI
5. CALL-TO-ACTION (varsa) KORUNMALI

YAPILABİLECEK MİNİMAL DEĞİŞİKLİKLER (SADECE BUNLAR):
- Mutlak dil yumuşatılabilir: "kesin", "asla", "tek gerçek" → "bazı durumlarda", "genellikle", "çoğunlukla"
- Geniş genellemeler daraltılabilir: "doktorlar", "sistem" → "bazı doktorlar", "kimi çevrelerde"
- Yüksek riskli cümlelere minimal mesafe dili eklenebilir: "bazı kaynaklara göre", "kimi uzmanlar"

YAPILAMAYACAKLAR (KESİNLİKLE YASAK):
❌ İçeriği nötr raporlamaya çevirmek
❌ Deneyimsel veya birinci şahıs dilini kaldırmak
❌ Güvensizlik / eleştiri tonunu kaldırmak
❌ CTA'yı tamamen kaldırmak
❌ İddiaları kurumsal uyarılarla değiştirmek
❌ İkna yapısını kaldırmak
❌ Akademikleştirmek
❌ Özetlemek
❌ Mesajı tersine çevirmek

EĞER BAĞLAM KORUNMAZSA:
- Rewrite yapma
- Sadece şu mesajı döndür: "CONTEXT_PRESERVATION_FAILED"

ÇIKTI FORMATI:
- Sadece önerilen metni döndür (açıklama, JSON, markdown YOK)
- Orijinal metinle aynı uzunlukta veya benzer uzunlukta olmalı
- Orijinal yapıyı koru (paragraflar, satırlar, format)"""
    
    return f"""{base_instruction}{policy_info}{domain_info}

ORİJİNAL İÇERİK:
{content}

ÖNERİLEN METİN (bağlam korunarak, minimal değişikliklerle):"""


async def check_context_preservation(
    original: str,
    rewritten: str
) -> Tuple[bool, float]:
    """
    Check if context is preserved in rewrite
    
    Returns:
        (is_preserved, preservation_score)
        - is_preserved: True if context is meaningfully preserved
        - preservation_score: 0.0-1.0 (higher = better preservation)
    """
    # If rewrite explicitly rejected (returned failure message)
    if "CONTEXT_PRESERVATION_FAILED" in rewritten.upper():
        return False, 0.0
    
    # Basic heuristics for context preservation
    # 1. Length similarity (should not be drastically different)
    length_ratio = min(len(rewritten), len(original)) / max(len(rewritten), len(original)) if max(len(rewritten), len(original)) > 0 else 0.0
    
    # 2. Check if rewritten text is too short (likely summarized)
    if len(rewritten) < len(original) * 0.5:
        logger.warning(f"[Rewrite] Rewrite too short: {len(rewritten)} vs {len(original)}")
        return False, 0.0
    
    # 3. Check if rewritten text is too long (likely expanded/explained)
    if len(rewritten) > len(original) * 2.0:
        logger.warning(f"[Rewrite] Rewrite too long: {len(rewritten)} vs {len(original)}")
        return False, 0.0
    
    # 4. Check for aggressive safety language (disclaimers, warnings)
    aggressive_patterns = [
        r"uyarı",
        r"disclaimer",
        r"yasal sorumluluk",
        r"garanti edilmez",
        r"bu bir öneridir",
        r"dikkat",
        r"risk",
    ]
    aggressive_count = sum(1 for pattern in aggressive_patterns if re.search(pattern, rewritten, re.IGNORECASE))
    if aggressive_count > 2:
        logger.warning(f"[Rewrite] Too many aggressive safety patterns: {aggressive_count}")
        return False, 0.0
    
    # Calculate preservation score
    preservation_score = length_ratio * 0.6  # Length similarity weight
    if aggressive_count == 0:
        preservation_score += 0.4  # No aggressive patterns
    
    # Threshold: must be at least 0.5 to be considered preserved
    is_preserved = preservation_score >= 0.5
    
    return is_preserved, preservation_score


async def rewrite_content(
    content: str,
    mode: str,
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None,
    provider: str = "openai"
) -> str:
    """
    Rewrite content with minimal, context-preserving approach
    
    CORE PRINCIPLE: EZA is a camera, not an editor.
    If context cannot be preserved, return rejection message instead of rewriting.
    
    Returns:
        - Rewritten text if context can be preserved
        - CONTEXT_PRESERVATION_FAILED_MESSAGE if context cannot be preserved
    """
    settings = get_settings()
    
    prompt = build_rewrite_prompt(content, mode, policies, domain)
    
    try:
        rewritten = await call_llm_provider(
            provider_name=provider,
            prompt=prompt,
            settings=settings,
            model="gpt-4o-mini" if provider == "openai" else None,
            temperature=0.3,  # Lower temperature for more consistent, minimal changes
            max_tokens=2000
        )
        
        # Clean up response
        rewritten = rewritten.strip()
        rewritten = re.sub(r'^```json\s*', '', rewritten)
        rewritten = re.sub(r'^```\s*', '', rewritten)
        rewritten = re.sub(r'```\s*$', '', rewritten)
        rewritten = rewritten.strip()
        
        # Context viability check (MANDATORY GATE)
        is_preserved, preservation_score = await check_context_preservation(content, rewritten)
        
        if not is_preserved:
            logger.warning(f"[Rewrite] Context preservation failed (score: {preservation_score:.2f}). Rejecting rewrite.")
            return CONTEXT_PRESERVATION_FAILED_MESSAGE
        
        logger.info(f"[Rewrite] Context preserved (score: {preservation_score:.2f}). Returning rewrite.")
        return rewritten
        
    except Exception as e:
        logger.error(f"[Proxy] Rewrite error: {str(e)}")
        raise

