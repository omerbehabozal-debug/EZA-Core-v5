# -*- coding: utf-8 -*-
"""
EZA Proxy - Contextual Camera Mode Analyzer Service
EZA is a camera, not a microscope.

Analysis observes what the text is doing, not dissects every word it contains.
Risk is contextual, not lexical.
"""

import logging
import re
import json
from typing import List, Dict, Any, Optional, Tuple
from backend.gateway.router_adapter import call_llm_provider
from backend.config import get_settings

logger = logging.getLogger(__name__)

# Threshold for choosing analysis unit
SHORT_TEXT_THRESHOLD = 500  # Characters - use full-text analysis
LONG_TEXT_THRESHOLD = 2000  # Characters - use paragraph-level analysis


def split_into_paragraphs(text: str, max_length: int = 2000) -> List[str]:
    """
    Split text into semantic paragraphs (semantic blocks)
    
    CORE PRINCIPLE: Paragraphs are meaning units, not arbitrary splits.
    Do NOT fragment paragraphs internally unless strictly necessary.
    """
    text = text.strip()
    if not text:
        return []
    
    # Split by double newlines (natural paragraph breaks)
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    
    # If no double newlines, treat entire text as single paragraph
    if len(paragraphs) == 1 and '\n\n' not in text:
        return [text]
    
    # Only split very long paragraphs (>max_length) as last resort
    result = []
    for para in paragraphs:
        if len(para) <= max_length:
            result.append(para)
        else:
            # Last resort: split by sentences only if paragraph is extremely long
            # This should be rare - prefer keeping paragraph intact
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


def build_contextual_analysis_prompt(
    content: str,
    is_full_text: bool,
    domain: Optional[str] = None,
    policies: Optional[List[str]] = None
) -> str:
    """
    Build contextual camera-mode analysis prompt
    
    CORE PRINCIPLE: EZA is a camera, not a microscope.
    Analyze what the text is doing (narrative, influence, intent), not every word.
    """
    
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
    
    analysis_unit = "tam metin" if is_full_text else "paragraf"
    
    return f"""Sen EZA Proxy Contextual Camera Mode analiz motorusun.

EZA bir kamera, mikroskop değil.
Görevin: Metnin NE YAPTIĞINI gözlemlemek (narrative, etki, niyet), her kelimeyi parçalamak değil.

ANALİZ DERİNLİĞİ KURALLARI (MUTLAK):
❌ YAPMA:
- Kelime kelime analiz
- Aynı pattern için tekrarlayan ihlaller
- Farklı granularity seviyelerinde aynı riski birden fazla kez flagleme
- Aynı underlying issue için fazla "ihlal" entry'si

✅ YAP:
- Bağlamsal / narrative seviyede risk tespiti
- Risk pattern'leri tespit et (izole token'lar değil)
- Benzer riskleri tek bir reasoning block altında grupla

RİSK TESPİT STRATEJİSİ:
Metni değerlendirirken şunları sor:
1. Core claim nedir? (Ana iddia)
2. Reader üzerinde intended influence nedir? (Hedeflenen etki)
3. Metin şunları yapıyor mu:
   - Korku / umut / güvensizlik sömürüyor mu?
   - Profesyonel veya kurumsal rehberliği caydırıyor mu?
   - Doğrulanamaz sağlık iddiaları teşvik ediyor mu?
   - Bastırılmış veya gizli "gerçekler" ima ediyor mu?
4. Risk systemic mi yoksa incidental mi? (Sadece systemic riskler yükseltilmeli)

VIOLATION GROUPING (ÇOK ÖNEMLİ):
Eğer birden fazla cümle aynı risky narrative'i destekliyorsa:
- TEK violation entry oluştur
- TEK policy reference
- TEK severity score
- TEK bağlamsal evidence açıklaması
❌ Aynı tema için çoğaltılmış HEALTH-ETHICAL / HEALTH-COMPLIANCE entry'leri yok

EVIDENCE ("KANIT") KURALI:
Evidence şöyle olmalı:
- Bağlamsal (contextual)
- Açıklayıcı (descriptive)
- Anlam referanslı (meaning-based), kelime pozisyonu değil
❌ "Bu kelime bu policy'yi tetikledi"
✅ "Bu paragraf X narrative'ini teşvik ediyor, bu da Y riskine yol açıyor"

SEVERITY SCORING:
Severity şunları yansıtmalı:
- Metnin overall influence'ı
- Narrative strength
- Potential harm at scale
DEĞİL:
- Flagged word count
- Text length
- Repetition count

SKOR TÜRLERİ:
1. Ethical Index (0-100): Zarar/uygunsuzluk riski. 0 = çok riskli, 100 = güvenli
2. Compliance Score (0-100): Yerel & sektörel uyum. 0 = uyumsuz, 100 = tam uyumlu
3. Manipulation Score (0-100): Yönlendirme riski. 0 = çok manipülatif, 100 = tarafsız
4. Bias Score (0-100): Önyargı seviyesi. 0 = çok taraflı, 100 = objektif
5. Legal Risk Score (0-100): Hukuki tehlike. 0 = yüksek risk, 100 = düşük risk

{policy_info}{domain_info}

ANALİZ BİRİMİ: {analysis_unit}
- Bu {analysis_unit} bir meaning unit olarak değerlendirilmeli
- İçerideki cümleleri veya kelimeleri ayrı ayrı analiz etme
- Narrative bütünlüğünü koru

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
    {{
      "type": "ethical|compliance|manipulation|bias|legal",
      "severity": "low|medium|high",
      "evidence": "Bağlamsal açıklama: Bu {analysis_unit} X narrative'ini teşvik ediyor, bu da Y riskine yol açıyor",
      "policy": "POLICY_CODE (e.g., HEALTH-ETHICAL)"
    }}
  ]
}}

ÖNEMLİ: risk_locations'da "start" ve "end" karakter pozisyonları YOK. Sadece type, severity, evidence, policy.
Evidence her zaman bağlamsal ve anlam referanslı olmalı."""


def group_violations(risk_locations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    PRIMARY RISK PATTERN & VIOLATION COLLAPSING (Camera Mode)
    
    CORE PRINCIPLE: Risk patterns are primary. Policy references are secondary.
    The system must NEVER treat each policy mapping as a separate violation
    if they originate from the same narrative intent.
    
    Collapsing Rules:
    1. Group by narrative intent (not policy)
    2. Multiple policies → ONE violation with policies array
    3. Merge evidence (remove duplicates)
    4. Single severity per primary risk pattern (highest)
    5. ONE decision rationale per pattern
    """
    if not risk_locations:
        return []
    
    # Group by PRIMARY RISK PATTERN (narrative intent)
    # Key: risk_type (primary pattern) + evidence similarity
    grouped = {}
    
    for risk in risk_locations:
        risk_type = risk.get("type", "unknown")
        evidence = risk.get("evidence", "").strip()
        severity = risk.get("severity", "medium")
        policy = risk.get("policy")
        
        # PRIMARY RISK PATTERN IDENTIFICATION
        # Group by risk_type (primary pattern) and evidence similarity
        # Evidence similarity: same narrative intent = same primary pattern
        evidence_key = evidence[:100] if evidence else ""  # Use first 100 chars for similarity
        
        # Create grouping key: risk_type + evidence similarity
        # This ensures same narrative intent = same violation
        group_key = f"{risk_type}:{evidence_key}"
        
        if group_key not in grouped:
            # NEW PRIMARY RISK PATTERN
            grouped[group_key] = {
                "primary_risk_type": risk_type,  # Primary risk pattern
                "severity": severity,  # Will be updated to highest
                "policies": [policy] if policy else [],  # Array of policies
                "evidence": evidence,  # Contextual evidence
                "evidence_snippets": [evidence] if evidence else [],  # For deduplication
                "count": 1
            }
        else:
            # COLLAPSE: Same narrative intent, different policy
            # Add policy to array (if not already present)
            if policy and policy not in grouped[group_key]["policies"]:
                grouped[group_key]["policies"].append(policy)
            
            # Update severity to highest (most severe)
            severity_map = {"low": 0, "medium": 1, "high": 2}
            current_severity_level = severity_map.get(grouped[group_key]["severity"], 1)
            new_severity_level = severity_map.get(severity, 1)
            if new_severity_level > current_severity_level:
                grouped[group_key]["severity"] = severity
            
            # Merge evidence (avoid duplicates)
            if evidence and evidence not in grouped[group_key]["evidence_snippets"]:
                # If evidence is similar but not identical, merge intelligently
                existing_evidence = grouped[group_key]["evidence"]
                if evidence not in existing_evidence:
                    # Merge: combine if different perspectives
                    grouped[group_key]["evidence"] = f"{existing_evidence}. {evidence}"
                grouped[group_key]["evidence_snippets"].append(evidence)
            
            grouped[group_key]["count"] += 1
    
    # Convert grouped dict to collapsed violations
    result = []
    for group_key, group_data in grouped.items():
        # VALIDATION: Ensure no duplicate policies
        unique_policies = list(dict.fromkeys(group_data["policies"]))  # Preserve order, remove duplicates
        
        # If no policies, use primary_risk_type as fallback
        if not unique_policies:
            unique_policies = [f"GENERAL-{group_data['primary_risk_type'].upper()}"]
        
        # Create collapsed violation object
        collapsed_violation = {
            "type": group_data["primary_risk_type"],  # Primary risk pattern
            "severity": group_data["severity"],  # Single severity (highest)
            "policy": unique_policies[0] if unique_policies else "UNKNOWN",  # Primary policy (for backward compatibility)
            "policies": unique_policies,  # Array of all policies (NEW)
            "evidence": group_data["evidence"],  # Consolidated evidence
            "occurrence_count": group_data["count"],  # How many times this pattern appeared
            "primary_risk_pattern": group_data["primary_risk_type"]  # Explicit primary pattern
        }
        
        result.append(collapsed_violation)
    
    # FINAL VALIDATION: Ensure no two violations describe the same narrative intent
    # If evidence is too similar (>80% overlap), merge them
    validated_result = []
    for violation in result:
        is_duplicate = False
        for existing in validated_result:
            # Check evidence similarity (simple word overlap)
            existing_words = set(existing["evidence"].lower().split())
            violation_words = set(violation["evidence"].lower().split())
            if existing_words and violation_words:
                overlap = len(existing_words & violation_words) / len(existing_words | violation_words)
                if overlap > 0.8:  # 80% similarity threshold
                    # Merge into existing violation
                    existing["policies"] = list(dict.fromkeys(existing["policies"] + violation["policies"]))
                    existing["occurrence_count"] += violation["occurrence_count"]
                    # Keep highest severity
                    severity_map = {"low": 0, "medium": 1, "high": 2}
                    if severity_map.get(violation["severity"], 1) > severity_map.get(existing["severity"], 1):
                        existing["severity"] = violation["severity"]
                    is_duplicate = True
                    break
        
        if not is_duplicate:
            validated_result.append(violation)
    
    logger.info(f"[Proxy] Collapsed {len(risk_locations)} risk locations into {len(validated_result)} primary risk patterns")
    
    return validated_result


async def analyze_content_deep(
    content: str,
    domain: Optional[str] = None,
    policies: Optional[List[str]] = None,
    provider: str = "openai"
) -> Dict[str, Any]:
    """
    Contextual Camera Mode Analysis
    
    CORE PRINCIPLE: EZA is a camera, not a microscope.
    - Short texts: Full-text contextual analysis
    - Long texts: Paragraph-level analysis (semantic blocks)
    - Risk detection: Contextual/narrative level, not word-by-word
    - Violation grouping: Similar risks grouped under single entry
    - Evidence: Contextual, meaning-based (not word positions)
    - Severity: Overall influence, narrative strength (not word count)
    """
    settings = get_settings()
    
    content_length = len(content)
    
    # DYNAMIC UNIT SELECTION
    # Short texts: Full-text contextual analysis
    # Long texts: Paragraph-level analysis
    if content_length <= SHORT_TEXT_THRESHOLD:
        # Full-text analysis for short content
        logger.info(f"[Proxy] Short text ({content_length} chars) - Using full-text contextual analysis")
        analysis_units = [(0, content, True)]  # (index, text, is_full_text)
    else:
        # Paragraph-level analysis for long content
        paragraphs = split_into_paragraphs(content)
        logger.info(f"[Proxy] Long text ({content_length} chars) - Using paragraph-level analysis ({len(paragraphs)} paragraphs)")
        analysis_units = [(i, para, False) for i, para in enumerate(paragraphs)]
    
    paragraph_analyses = []
    all_flags = []
    all_risk_locations = []
    
    for unit_idx, unit_text, is_full_text in analysis_units:
        # Analyze with contextual camera mode
        prompt = build_contextual_analysis_prompt(unit_text, is_full_text, domain, policies)
        
        try:
            response_text = await call_llm_provider(
                provider_name=provider,
                prompt=prompt,
                settings=settings,
                model="gpt-4o-mini" if provider == "openai" else None,
                temperature=0.3,  # Lower temperature for more consistent, high-level analysis
                max_tokens=1500  # Reduced for faster processing
            )
            
            # Parse JSON response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                data = json.loads(response_text)
            
            # Extract risk locations (now contextual, not word positions)
            unit_risk_locations = data.get("risk_locations", [])
            
            # Normalize risk_locations: ensure start/end are optional, evidence/policy are present
            normalized_risk_locations = []
            for loc in unit_risk_locations:
                normalized_loc = {
                    "type": loc.get("type", "unknown"),
                    "severity": loc.get("severity", "medium"),
                    "evidence": loc.get("evidence", ""),
                    "policy": loc.get("policy")
                }
                # Only include start/end if they exist (backward compatibility)
                if "start" in loc:
                    normalized_loc["start"] = loc["start"]
                if "end" in loc:
                    normalized_loc["end"] = loc["end"]
                normalized_risk_locations.append(normalized_loc)
            
            para_analysis = {
                "paragraph_index": unit_idx,
                "text": unit_text,
                "ethical_index": int(data.get("ethical_index", 50)),
                "compliance_score": int(data.get("compliance_score", 50)),
                "manipulation_score": int(data.get("manipulation_score", 50)),
                "bias_score": int(data.get("bias_score", 50)),
                "legal_risk_score": int(data.get("legal_risk_score", 50)),
                "flags": data.get("flags", []),
                "risk_locations": normalized_risk_locations
            }
            
            paragraph_analyses.append(para_analysis)
            all_flags.extend(data.get("flags", []))
            all_risk_locations.extend(unit_risk_locations)
            
        except Exception as e:
            logger.error(f"[Proxy] Error analyzing unit {unit_idx}: {str(e)}")
            # Fallback
            paragraph_analyses.append({
                "paragraph_index": unit_idx,
                "text": unit_text,
                "ethical_index": 50,
                "compliance_score": 50,
                "manipulation_score": 50,
                "bias_score": 50,
                "legal_risk_score": 50,
                "flags": ["analiz_hatası"],
                "risk_locations": []
            })
    
    # VIOLATION GROUPING (MANDATORY)
    # Group similar risks under single entry
    grouped_risk_locations = group_violations(all_risk_locations)
    logger.info(f"[Proxy] Grouped {len(all_risk_locations)} risk locations into {len(grouped_risk_locations)} unique violations")
    
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
        "risk_locations": grouped_risk_locations  # Grouped violations
    }

