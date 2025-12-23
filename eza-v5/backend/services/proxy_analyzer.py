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
import time
from typing import List, Dict, Any, Optional, Tuple
from backend.gateway.router_adapter import call_llm_provider
from backend.config import get_settings
from backend.services.proxy_analyzer_stage0 import stage0_fast_risk_scan
from backend.services.proxy_analyzer_stage1 import stage1_targeted_deep_analysis

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


def normalize_paragraph_risks(
    paragraph_id: int,
    raw_risk_locations: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    PARAGRAPH-LEVEL RISK NORMALIZATION (Mandatory)
    
    CORE PRINCIPLE: Narrative risk is primary. Policy mapping is secondary.
    Backend MUST normalize risks BEFORE returning analysis results.
    
    Normalization Rules:
    1. One paragraph → one primary risk pattern per narrative
    2. Multiple policy hits → ONE normalized risk with policies array
    3. Severity: MAX (not cumulative, not averaged)
    4. Evidence: Strongest / most explanatory
    5. Decision rationale: ONE consolidated explanation
    
    PRIMARY KEY (UNIQUE CONSTRAINT):
    PRIMARY_KEY = (paragraph_id, primary_risk_pattern OR risk.type)
    
    Same PRIMARY_KEY MUST NOT appear twice.
    """
    if not raw_risk_locations:
        return []
    
    # Group by PRIMARY RISK PATTERN (narrative intent)
    grouped = {}
    
    for risk in raw_risk_locations:
        # Get primary risk pattern (prefer primary_risk_pattern, fallback to type)
        primary_risk_pattern = risk.get("primary_risk_pattern") or risk.get("type", "unknown")
        risk_type = risk.get("type", "unknown")
        evidence = risk.get("evidence", "").strip()
        severity = risk.get("severity", "medium")
        policy = risk.get("policy")
        
        # PRIMARY KEY: (paragraph_id, primary_risk_pattern)
        # This ensures uniqueness per paragraph
        primary_key = f"{paragraph_id}:{primary_risk_pattern}"
        
        # Evidence similarity key (for merging similar narratives)
        evidence_key = evidence[:100] if evidence else ""
        group_key = f"{primary_key}:{evidence_key}"
        
        if group_key not in grouped:
            # NEW PRIMARY RISK PATTERN for this paragraph
            grouped[group_key] = {
                "paragraph_id": paragraph_id,
                "primary_risk_pattern": primary_risk_pattern,
                "type": risk_type,  # Keep original type for backward compatibility
                "severity": severity,  # Will be updated to MAX
                "policies": [policy] if policy else [],  # Array of policies
                "evidence": evidence,  # Will be updated to strongest
                "evidence_snippets": [evidence] if evidence else [],
                "count": 1
            }
        else:
            # COLLAPSE: Same narrative intent, different policy
            # Add policy to array (if not already present)
            if policy and policy not in grouped[group_key]["policies"]:
                grouped[group_key]["policies"].append(policy)
            
            # Update severity to MAX (most severe)
            severity_map = {"low": 0, "medium": 1, "high": 2}
            current_severity_level = severity_map.get(grouped[group_key]["severity"], 1)
            new_severity_level = severity_map.get(severity, 1)
            if new_severity_level > current_severity_level:
                grouped[group_key]["severity"] = severity
            
            # Merge evidence (keep strongest / most explanatory)
            if evidence and evidence not in grouped[group_key]["evidence_snippets"]:
                existing_evidence = grouped[group_key]["evidence"]
                # Prefer longer, more detailed evidence (stronger explanation)
                if len(evidence) > len(existing_evidence) or (severity == "high" and grouped[group_key]["severity"] != "high"):
                    grouped[group_key]["evidence"] = evidence
                elif evidence not in existing_evidence:
                    # Merge if different perspectives
                    grouped[group_key]["evidence"] = f"{existing_evidence}. {evidence}"
                grouped[group_key]["evidence_snippets"].append(evidence)
            
            grouped[group_key]["count"] += 1
    
    # Convert grouped dict to normalized risks
    normalized_risks = []
    for group_key, group_data in grouped.items():
        # VALIDATION: Ensure no duplicate policies
        unique_policies = list(dict.fromkeys(group_data["policies"]))  # Preserve order, remove duplicates
        
        # If no policies, use primary_risk_pattern as fallback
        if not unique_policies:
            unique_policies = [f"GENERAL-{group_data['primary_risk_pattern'].upper()}"]
        
        # Create normalized risk object
        # NOTE: paragraph_id is internal only, not exposed in response
        normalized_risk = {
            "type": group_data["type"],  # Original type (for backward compatibility)
            "primary_risk_pattern": group_data["primary_risk_pattern"],  # Primary pattern
            "severity": group_data["severity"],  # MAX severity
            "policy": unique_policies[0] if unique_policies else "UNKNOWN",  # Primary policy (backward compatibility)
            "policies": unique_policies,  # Array of all policies
            "evidence": group_data["evidence"],  # Strongest evidence
            "occurrence_count": group_data["count"],  # How many times this pattern appeared
            "_paragraph_id": paragraph_id  # Internal use only (for matching)
        }
        
        normalized_risks.append(normalized_risk)
    
    # FINAL VALIDATION: Ensure no duplicate narrative risks in same paragraph
    validated_risks = []
    for risk in normalized_risks:
        is_duplicate = False
        for existing in validated_risks:
            # Check if same primary_risk_pattern already exists
            if existing["primary_risk_pattern"] == risk["primary_risk_pattern"]:
                # Merge into existing risk
                existing["policies"] = list(dict.fromkeys(existing["policies"] + risk["policies"]))
                existing["occurrence_count"] += risk["occurrence_count"]
                # Keep MAX severity
                severity_map = {"low": 0, "medium": 1, "high": 2}
                if severity_map.get(risk["severity"], 1) > severity_map.get(existing["severity"], 1):
                    existing["severity"] = risk["severity"]
                # Keep strongest evidence
                if len(risk["evidence"]) > len(existing["evidence"]):
                    existing["evidence"] = risk["evidence"]
                is_duplicate = True
                break
        
        if not is_duplicate:
            validated_risks.append(risk)
    
    logger.info(f"[Proxy] Normalized {len(raw_risk_locations)} raw risks into {len(validated_risks)} primary patterns for paragraph {paragraph_id}")
    
    return validated_risks


def group_violations(risk_locations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    PRIMARY RISK PATTERN & VIOLATION COLLAPSING (Camera Mode)
    
    CORE PRINCIPLE: Risk patterns are primary. Policy references are secondary.
    The system must NEVER treat each policy mapping as a separate violation
    if they originate from the same narrative intent.
    
    Collapsing Rules:
    1. Group by PRIMARY RISK PATTERN (not evidence similarity)
    2. Multiple policies → ONE violation with policies array
    3. Merge evidence (remove duplicates)
    4. Single severity per primary risk pattern (highest)
    5. ONE decision rationale per pattern
    
    GLOBAL COLLAPSE: Same primary_risk_pattern across different paragraphs = ONE violation
    """
    if not risk_locations:
        return []
    
    # Group by PRIMARY RISK PATTERN ONLY (not evidence similarity)
    # This ensures same narrative intent across paragraphs = same violation
    grouped = {}
    
    for risk in risk_locations:
        # Get primary risk pattern (prefer primary_risk_pattern, fallback to type)
        primary_risk_pattern = risk.get("primary_risk_pattern") or risk.get("type", "unknown")
        risk_type = risk.get("type", "unknown")
        evidence = risk.get("evidence", "").strip()
        severity = risk.get("severity", "medium")
        policy = risk.get("policy")
        
        # PRIMARY KEY: primary_risk_pattern ONLY
        # This ensures same narrative intent = same violation (regardless of paragraph or evidence wording)
        group_key = primary_risk_pattern
        
        if group_key not in grouped:
            # NEW PRIMARY RISK PATTERN
            grouped[group_key] = {
                "primary_risk_type": primary_risk_pattern,  # Primary risk pattern
                "type": risk_type,  # Original type (for backward compatibility)
                "severity": severity,  # Will be updated to highest
                "policies": [policy] if policy else [],  # Array of policies
                "evidence": evidence,  # Contextual evidence (will be updated to strongest)
                "evidence_snippets": [evidence] if evidence else [],  # For deduplication
                "count": 1,
                "paragraph_ids": set()  # Track which paragraphs this pattern appears in
            }
        else:
            # COLLAPSE: Same primary risk pattern (same narrative intent)
            # Add policy to array (if not already present)
            if policy and policy not in grouped[group_key]["policies"]:
                grouped[group_key]["policies"].append(policy)
            
            # Update severity to highest (most severe)
            severity_map = {"low": 0, "medium": 1, "high": 2}
            current_severity_level = severity_map.get(grouped[group_key]["severity"], 1)
            new_severity_level = severity_map.get(severity, 1)
            if new_severity_level > current_severity_level:
                grouped[group_key]["severity"] = severity
            
            # Merge evidence (keep strongest / most explanatory)
            if evidence and evidence not in grouped[group_key]["evidence_snippets"]:
                existing_evidence = grouped[group_key]["evidence"]
                # Prefer longer, more detailed evidence (stronger explanation)
                # Or prefer high severity evidence
                if len(evidence) > len(existing_evidence) or (severity == "high" and grouped[group_key]["severity"] != "high"):
                    grouped[group_key]["evidence"] = evidence
                elif evidence not in existing_evidence:
                    # Merge: combine if different perspectives (but keep concise)
                    # Only merge if evidence adds new information
                    if len(evidence) > 20:  # Only merge substantial evidence
                        grouped[group_key]["evidence"] = f"{existing_evidence}. {evidence}"
                grouped[group_key]["evidence_snippets"].append(evidence)
            
            # Track paragraph IDs (for debugging)
            para_id = risk.get("_paragraph_id")
            if para_id is not None:
                grouped[group_key]["paragraph_ids"].add(para_id)
            
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
            "type": group_data.get("type", group_data["primary_risk_type"]),  # Original type (for backward compatibility)
            "severity": group_data["severity"],  # Single severity (highest)
            "policy": unique_policies[0] if unique_policies else "UNKNOWN",  # Primary policy (for backward compatibility)
            "policies": unique_policies,  # Array of all policies (NEW)
            "evidence": group_data["evidence"],  # Strongest evidence
            "occurrence_count": group_data["count"],  # How many times this pattern appeared
            "primary_risk_pattern": group_data["primary_risk_type"]  # Explicit primary pattern
        }
        
        result.append(collapsed_violation)
    
    # FINAL VALIDATION: Ensure no duplicate primary_risk_patterns
    # Since we're grouping by primary_risk_pattern, duplicates should not exist
    # But double-check to be safe
    validated_result = []
    seen_patterns = set()
    for violation in result:
        pattern = violation.get("primary_risk_pattern") or violation.get("type")
        if pattern not in seen_patterns:
            seen_patterns.add(pattern)
            validated_result.append(violation)
        else:
            # This should not happen if grouping logic is correct
            # But if it does, merge into existing
            logger.warning(f"[Proxy] Duplicate primary_risk_pattern detected: {pattern}. Merging...")
            for existing in validated_result:
                if (existing.get("primary_risk_pattern") or existing.get("type")) == pattern:
                    existing["policies"] = list(dict.fromkeys(existing["policies"] + violation["policies"]))
                    existing["occurrence_count"] += violation["occurrence_count"]
                    # Keep highest severity
                    severity_map = {"low": 0, "medium": 1, "high": 2}
                    if severity_map.get(violation["severity"], 1) > severity_map.get(existing["severity"], 1):
                        existing["severity"] = violation["severity"]
                    # Keep strongest evidence
                    if len(violation["evidence"]) > len(existing["evidence"]):
                        existing["evidence"] = violation["evidence"]
                    break
    
    logger.info(f"[Proxy] Collapsed {len(risk_locations)} risk locations into {len(validated_result)} unique primary risk patterns")
    
    return validated_result


async def analyze_content_deep(
    content: str,
    domain: Optional[str] = None,
    policies: Optional[List[str]] = None,
    provider: str = "openai",
    role: str = "proxy"  # "proxy_lite" or "proxy"
) -> Dict[str, Any]:
    """
    3-Stage Gated Pipeline Analysis
    
    CORE PRINCIPLE: EZA is a camera, not a microscope.
    
    Stage-0: Fast Risk Scan (< 500ms)
    Stage-1: Targeted Deep Analysis (conditional, bounded parallelism)
    Stage-2: Rewrite (user-triggered only, not here)
    
    This function implements Stage-0 + Stage-1
    """
    total_start_time = time.time()
    settings = get_settings()
    
    content_length = len(content)
    
    # STAGE-0: Fast Risk Scan (always runs)
    logger.info(f"[Proxy] Starting 3-stage pipeline analysis (role={role}, length={content_length} chars)")
    stage0_result = await stage0_fast_risk_scan(
        content=content,
        domain=domain,
        provider=provider
    )
    
    stage0_latency = stage0_result.get("_stage0_latency_ms", 0)
    risk_band = stage0_result.get("risk_band", "low")
    priority_paragraphs = stage0_result.get("priority_paragraphs", [])
    
    logger.info(f"[Proxy] Stage-0 completed in {stage0_latency:.0f}ms: risk_band={risk_band}, priority_paragraphs={len(priority_paragraphs)}")
    
    # STAGE-1: Targeted Deep Analysis (conditional)
    stage1_result = await stage1_targeted_deep_analysis(
        content=content,
        stage0_result=stage0_result,
        domain=domain,
        policies=policies,
        provider=provider,
        role=role
    )
    
    stage1_latency = stage1_result.get("_stage1_latency_ms", 0)
    paragraph_analyses = stage1_result.get("paragraph_analyses", [])
    all_flags = stage1_result.get("all_flags", [])
    all_risk_locations = stage1_result.get("all_risk_locations", [])
    
    logger.info(f"[Proxy] Stage-1 completed in {stage1_latency:.0f}ms: analyzed {len(paragraph_analyses)} paragraphs")
    
    # For short texts or low risk, we may not have paragraph analyses
    # In that case, use Stage-0 estimates
    if not paragraph_analyses:
        if risk_band == "low" or content_length <= SHORT_TEXT_THRESHOLD:
            # Low risk or short text - create minimal analysis from Stage-0
            estimated_range = stage0_result.get("estimated_score_range", [50, 70])
            avg_score = sum(estimated_range) // 2
            
            paragraph_analyses = [{
                "paragraph_index": 0,
                "text": content[:500] if content_length > 500 else content,
                "ethical_index": avg_score,
                "compliance_score": min(avg_score + 10, 100),
                "manipulation_score": max(avg_score - 5, 0),
                "bias_score": avg_score,
                "legal_risk_score": min(avg_score + 5, 100),
                "flags": [],
                "risk_locations": []
            }]
    
    # VALIDATION: Ensure each paragraph has no duplicate narrative risks
    for para in paragraph_analyses:
        para_risks = para.get("risk_locations", [])
        primary_patterns = [r.get("primary_risk_pattern") or r.get("type") for r in para_risks]
        if len(primary_patterns) != len(set(primary_patterns)):
            logger.warning(f"[Proxy] Paragraph {para.get('paragraph_index')} has duplicate primary risk patterns. Re-normalizing...")
            # Re-normalize this paragraph
            raw_risks = para.get("_raw_risk_locations", para_risks)
            para["risk_locations"] = normalize_paragraph_risks(
                paragraph_id=para.get("paragraph_index", 0),
                raw_risk_locations=raw_risks
            )
    
    # GLOBAL VIOLATION GROUPING (MANDATORY)
    # Group normalized paragraph risks under single entry (cross-paragraph collapse)
    # This ensures same narrative risk across paragraphs is collapsed
    grouped_risk_locations = group_violations(all_risk_locations)
    logger.info(f"[Proxy] Grouped {len(all_risk_locations)} normalized paragraph risks into {len(grouped_risk_locations)} unique global violations")
    
    # FINAL VALIDATION: Ensure no duplicate narrative risks globally
    primary_patterns_global = [r.get("primary_risk_pattern") or r.get("type") for r in grouped_risk_locations]
    if len(primary_patterns_global) != len(set(primary_patterns_global)):
        logger.warning("[Proxy] Global risk_locations has duplicate primary patterns. Re-collapsing...")
        grouped_risk_locations = group_violations(grouped_risk_locations)
    
    # Calculate overall scores (weighted average from analyzed paragraphs)
    if paragraph_analyses:
        overall_ethical = sum(p["ethical_index"] for p in paragraph_analyses) / len(paragraph_analyses)
        overall_compliance = sum(p["compliance_score"] for p in paragraph_analyses) / len(paragraph_analyses)
        overall_manipulation = sum(p["manipulation_score"] for p in paragraph_analyses) / len(paragraph_analyses)
        overall_bias = sum(p["bias_score"] for p in paragraph_analyses) / len(paragraph_analyses)
        overall_legal = sum(p["legal_risk_score"] for p in paragraph_analyses) / len(paragraph_analyses)
    else:
        # Fallback to Stage-0 estimates
        estimated_range = stage0_result.get("estimated_score_range", [50, 70])
        avg_score = sum(estimated_range) // 2
        overall_ethical = overall_compliance = overall_manipulation = overall_bias = overall_legal = avg_score
    
    # Remove duplicate flags
    unique_flags = list(dict.fromkeys(all_flags))
    
    # Remove _raw_risk_locations from final output (internal use only)
    for para in paragraph_analyses:
        if "_raw_risk_locations" in para:
            del para["_raw_risk_locations"]
    
    total_latency_ms = (time.time() - total_start_time) * 1000
    
    logger.info(f"[Proxy] 3-stage pipeline completed in {total_latency_ms:.0f}ms (Stage-0: {stage0_latency:.0f}ms, Stage-1: {stage1_latency:.0f}ms)")
    
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
        "risk_locations": grouped_risk_locations,
        "_stage0_result": stage0_result,  # Include Stage-0 for UI response contract
        "_performance_metrics": {
            "stage0_latency_ms": stage0_latency,
            "stage1_latency_ms": stage1_latency,
            "total_latency_ms": total_latency_ms
        }
    }

