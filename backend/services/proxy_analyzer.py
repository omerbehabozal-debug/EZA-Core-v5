# -*- coding: utf-8 -*-
"""
EZA Proxy - Deep Content Analyzer Service
Paragraph + Sentence level analysis with 5 score types
"""

import logging
import re
import json
from typing import List, Dict, Any, Optional
from backend.gateway.router_adapter import call_llm_provider
from backend.config import get_settings

logger = logging.getLogger(__name__)


def split_into_paragraphs(text: str, max_length: int = 1000) -> List[str]:
    """Split text into paragraphs"""
    text = text.strip()
    if not text:
        return []
    
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    
    if len(paragraphs) == 1 and '\n\n' not in text:
        return [text]
    
    result = []
    for para in paragraphs:
        if len(para) <= max_length:
            result.append(para)
        else:
            sentences = re.split(r'([.!?]+\s+)', para)
            current = ""
            for i in range(0, len(sentences), 2):
                sentence = sentences[i] + (sentences[i+1] if i+1 < len(sentences) else "")
                if len(current) + len(sentence) <= max_length:
                    current += sentence
                else:
                    if current:
                        result.append(current.strip())
                    current = sentence
            if current:
                result.append(current.strip())
    
    return result if result else [text]


def split_into_sentences(text: str) -> List[str]:
    """Split paragraph into sentences"""
    sentences = re.split(r'([.!?]+\s+)', text)
    result = []
    for i in range(0, len(sentences), 2):
        if i < len(sentences):
            sentence = sentences[i] + (sentences[i+1] if i+1 < len(sentences) else "")
            if sentence.strip():
                result.append(sentence.strip())
    return result if result else [text]


def build_deep_analysis_prompt(
    content: str,
    domain: Optional[str] = None,
    policies: Optional[List[str]] = None
) -> str:
    """Build prompt for deep analysis with 5 score types"""
    
    policy_info = ""
    if policies:
        policy_info = f"\n\nUygulanacak Politikalar: {', '.join(policies)}"
        if "TRT" in policies:
            policy_info += "\n- TRT kuralları: Tarafsızlık, doğruluk, çeşitlilik"
        if "FINTECH" in policies:
            policy_info += "\n- Fintech kuralları: Yatırım tavsiyesi yasağı, risk uyarıları"
        if "HEALTH" in policies:
            policy_info += "\n- Sağlık kuralları: Tıbbi iddia yasağı, bilimsel kanıt gerekliliği"
    
    domain_info = ""
    if domain:
        domain_map = {
            "finance": "Finansal içerik - Yatırım tavsiyesi, finansal garanti yasağı",
            "health": "Sağlık içeriği - Tıbbi iddia, tedavi önerisi yasağı",
            "retail": "Perakende içeriği - Yanıltıcı reklam, abartılı iddia kontrolü",
            "media": "Medya içeriği - Manipülasyon, taraflılık, yanlış bilgi kontrolü",
            "autonomous": "Otonom sistem içeriği - Güvenlik, etik komut kontrolü"
        }
        if domain in domain_map:
            domain_info = f"\n\nSektör: {domain_map[domain]}"
    
    return f"""Sen EZA Proxy derin analiz motorusun. Görevin, verilen içeriği 5 farklı skor türünde değerlendirmektir.

SKOR TÜRLERİ:
1. Ethical Index (0-100): Zarar/uygunsuzluk riski. 0 = çok riskli, 100 = güvenli
2. Compliance Score (0-100): Yerel & sektörel uyum. 0 = uyumsuz, 100 = tam uyumlu
3. Manipulation Score (0-100): Yönlendirme riski. 0 = çok manipülatif, 100 = tarafsız
4. Bias Score (0-100): Önyargı seviyesi. 0 = çok taraflı, 100 = objektif
5. Legal Risk Score (0-100): Hukuki tehlike. 0 = yüksek risk, 100 = düşük risk

{policy_info}{domain_info}

ÖNEMLİ KURALLAR:
- Her skor bağımsız değerlendirilmeli
- Riskli içerikler vurgulanmalı (risk_locations: [start, end] karakter pozisyonları)
- Flags tekrarsız olmalı
- Cümle ve paragraf bazlı analiz yapılmalı

İÇERİK:
{content}

Cevabın mutlaka şu JSON formatında olsun:
{{
  "ethical_index": number,
  "compliance_score": number,
  "manipulation_score": number,
  "bias_score": number,
  "legal_risk_score": number,
  "flags": ["flag1", "flag2", ...],
  "risk_locations": [
    {{"start": number, "end": number, "type": "ethical|compliance|manipulation|bias|legal", "severity": "low|medium|high"}}
  ]
}}"""


async def analyze_content_deep(
    content: str,
    domain: Optional[str] = None,
    policies: Optional[List[str]] = None,
    provider: str = "openai"
) -> Dict[str, Any]:
    """
    Deep analysis with 5 score types
    Returns paragraph and sentence level analysis
    """
    settings = get_settings()
    
    # Split into paragraphs
    paragraphs = split_into_paragraphs(content)
    
    paragraph_analyses = []
    all_flags = []
    all_risk_locations = []
    
    for para_idx, para in enumerate(paragraphs):
        # Analyze paragraph
        prompt = build_deep_analysis_prompt(para, domain, policies)
        
        try:
            response_text = await call_llm_provider(
                provider_name=provider,
                prompt=prompt,
                settings=settings,
                model="gpt-4o-mini" if provider == "openai" else None,
                temperature=0.3,
                max_tokens=2000
            )
            
            # Parse JSON response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                data = json.loads(response_text)
            
            para_analysis = {
                "paragraph_index": para_idx,
                "text": para,
                "ethical_index": int(data.get("ethical_index", 50)),
                "compliance_score": int(data.get("compliance_score", 50)),
                "manipulation_score": int(data.get("manipulation_score", 50)),
                "bias_score": int(data.get("bias_score", 50)),
                "legal_risk_score": int(data.get("legal_risk_score", 50)),
                "flags": data.get("flags", []),
                "risk_locations": data.get("risk_locations", [])
            }
            
            paragraph_analyses.append(para_analysis)
            all_flags.extend(data.get("flags", []))
            all_risk_locations.extend(data.get("risk_locations", []))
            
        except Exception as e:
            logger.error(f"[Proxy] Error analyzing paragraph {para_idx}: {str(e)}")
            # Fallback
            paragraph_analyses.append({
                "paragraph_index": para_idx,
                "text": para,
                "ethical_index": 50,
                "compliance_score": 50,
                "manipulation_score": 50,
                "bias_score": 50,
                "legal_risk_score": 50,
                "flags": ["analiz_hatası"],
                "risk_locations": []
            })
    
    # Calculate overall scores (weighted average)
    if paragraph_analyses:
        overall_ethical = sum(p["ethical_index"] for p in paragraph_analyses) / len(paragraph_analyses)
        overall_compliance = sum(p["compliance_score"] for p in paragraph_analyses) / len(paragraph_analyses)
        overall_manipulation = sum(p["manipulation_score"] for p in paragraph_analyses) / len(paragraph_analyses)
        overall_bias = sum(p["bias_score"] for p in paragraph_analyses) / len(paragraph_analyses)
        overall_legal = sum(p["legal_risk_score"] for p in paragraph_analyses) / len(paragraph_analyses)
    else:
        overall_ethical = overall_compliance = overall_manipulation = overall_bias = overall_legal = 50
    
    # Remove duplicate flags
    unique_flags = list(dict.fromkeys(all_flags))
    
    return {
        "overall_scores": {
            "ethical_index": int(round(overall_ethical)),
            "compliance_score": int(round(overall_compliance)),
            "manipulation_score": int(round(overall_manipulation)),
            "bias_score": int(round(overall_bias)),
            "legal_risk_score": int(round(overall_legal))
        },
        "paragraphs": paragraph_analyses,
        "flags": unique_flags,
        "risk_locations": all_risk_locations
    }

