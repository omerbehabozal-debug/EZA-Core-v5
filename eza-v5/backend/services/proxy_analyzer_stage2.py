# -*- coding: utf-8 -*-
"""
EZA Proxy - Stage-2: Span-Based Rewrite
User-triggered rewrite of only risky spans identified in Stage-1

CORE PRINCIPLE:
- Rewrite is NOT automatic
- Rewrite is NOT full-text
- Rewrite only applies to explicitly flagged spans
- Minimal change, original meaning preserved
- Patch rewritten span back into original text
"""

import logging
import re
import time
from typing import List, Dict, Any, Optional, Tuple
from backend.gateway.router_adapter import call_llm_provider
from backend.config import get_settings
from backend.services.proxy_rewrite_engine import (
    CONTEXT_PRESERVATION_FAILED_MESSAGE,
    check_context_preservation
)

logger = logging.getLogger(__name__)


def extract_risky_spans(
    content: str,
    paragraph_analyses: List[Dict[str, Any]],
    risk_locations: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Extract risky spans from Stage-1 analysis results
    
    Returns:
        [
            {
                "paragraph": 2,
                "start_offset": 45,  # Character offset in paragraph
                "end_offset": 120,
                "risk_type": "manipulation",
                "severity": "high",
                "evidence": "..."
            },
            ...
        ]
    """
    risky_spans = []
    
    # Split content into paragraphs for offset calculation
    paragraphs = content.split('\n\n')
    if len(paragraphs) == 1:
        paragraphs = content.split('\n')
    
    # Calculate cumulative offsets for each paragraph
    paragraph_offsets = []
    cumulative_offset = 0
    for para in paragraphs:
        paragraph_offsets.append(cumulative_offset)
        cumulative_offset += len(para) + 2  # +2 for \n\n
    
    # Extract spans from risk_locations
    logger.info(f"[Stage-2] Extracting risky spans from {len(risk_locations)} risk locations")
    
    for risk_idx, risk in enumerate(risk_locations):
        # Try to get paragraph index from risk location
        # If not available, try to match by evidence
        paragraph_idx = risk.get("paragraph_id") or risk.get("paragraph_index")
        
        if paragraph_idx is None:
            # Try to find paragraph by evidence matching
            evidence = risk.get("evidence", "")
            if evidence:
                for i, para in enumerate(paragraphs):
                    if evidence.lower() in para.lower()[:200]:  # Check first 200 chars
                        paragraph_idx = i
                        logger.debug(f"[Stage-2] Risk {risk_idx}: Found paragraph {i} by evidence matching")
                        break
            else:
                logger.warning(f"[Stage-2] Risk {risk_idx}: No paragraph_idx and no evidence, skipping")
        
        if paragraph_idx is None or paragraph_idx >= len(paragraphs):
            logger.warning(f"[Stage-2] Risk {risk_idx}: Invalid paragraph_idx ({paragraph_idx}), skipping (total paragraphs: {len(paragraphs)})")
            continue
        
        # Get paragraph text
        para_text = paragraphs[paragraph_idx]
        
        # Try to find evidence span in paragraph
        evidence = risk.get("evidence", "")
        if evidence:
            # Find evidence text in paragraph (case-insensitive, fuzzy match)
            evidence_lower = evidence.lower().strip()
            para_lower = para_text.lower()
            
            # Try exact match first
            start_idx = para_lower.find(evidence_lower)
            if start_idx == -1:
                # Try partial match (first 50 chars of evidence)
                evidence_partial = evidence_lower[:50]
                start_idx = para_lower.find(evidence_partial)
            
            if start_idx != -1:
                end_idx = start_idx + len(evidence)
                # Extend span slightly for context (min 20 chars, max 200 chars)
                span_text = para_text[max(0, start_idx):min(len(para_text), end_idx)]
                if len(span_text) < 20:
                    # Extend to at least 20 chars
                    start_idx = max(0, start_idx - 10)
                    end_idx = min(len(para_text), end_idx + 10)
                elif len(span_text) > 200:
                    # Limit to 200 chars
                    end_idx = start_idx + 200
                
                # Calculate absolute offset in full content
                para_offset = paragraph_offsets[paragraph_idx]
                absolute_start = para_offset + start_idx
                absolute_end = para_offset + end_idx
                
                logger.debug(f"[Stage-2] Risk {risk_idx}: Extracted span from paragraph {paragraph_idx}, offset {absolute_start}-{absolute_end}, text: {span_text[:50]}...")
                
                risky_spans.append({
                    "paragraph": paragraph_idx,
                    "start_offset": absolute_start,
                    "end_offset": absolute_end,
                    "risk_type": risk.get("type") or risk.get("primary_risk_pattern", "unknown"),
                    "severity": risk.get("severity", "medium"),
                    "evidence": evidence,
                    "span_text": para_text[start_idx:end_idx]
                })
            else:
                # If evidence not found, use entire paragraph as span (fallback)
                para_offset = paragraph_offsets[paragraph_idx]
                risky_spans.append({
                    "paragraph": paragraph_idx,
                    "start_offset": para_offset,
                    "end_offset": para_offset + len(para_text),
                    "risk_type": risk.get("type") or risk.get("primary_risk_pattern", "unknown"),
                    "severity": risk.get("severity", "medium"),
                    "evidence": evidence,
                    "span_text": para_text[:200]  # First 200 chars
                })
        else:
            # No evidence, use entire paragraph (fallback)
            para_offset = paragraph_offsets[paragraph_idx]
            risky_spans.append({
                "paragraph": paragraph_idx,
                "start_offset": para_offset,
                "end_offset": para_offset + len(para_text),
                "risk_type": risk.get("type") or risk.get("primary_risk_pattern", "unknown"),
                "severity": risk.get("severity", "medium"),
                "evidence": "",
                "span_text": para_text[:200]
            })
    
    # Remove duplicates (same paragraph + similar offsets)
    unique_spans = []
    seen = set()
    for span in risky_spans:
        key = (span["paragraph"], span["start_offset"] // 50)  # Group by paragraph and ~50 char buckets
        if key not in seen:
            seen.add(key)
            unique_spans.append(span)
    
    logger.info(f"[Stage-2] Extracted {len(unique_spans)} unique risky spans from {len(risk_locations)} risk locations")
    return unique_spans


def build_pro_rewrite_prompt_base() -> str:
    """
    Base editor role for ALL PRO rewrites
    """
    return """SYSTEM ROLE:
You are a senior human editor specializing in ethical risk mitigation.
You do not censor content.
You preserve meaning, intent, and tone.
You only modify expressions that create ethical, legal, or societal risk.

GENERAL RULES:
- Do not over-soften
- Do not generalize unless required
- Do not add new arguments
- Do not add disclaimers unless necessary
- Output ONLY rewritten content

"""


def build_discrimination_rewrite_prompt(
    span_text: str,
    severity: str,
    surrounding_context: Optional[str] = None,
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None
) -> str:
    """PRO mode: Discrimination-specific rewrite prompt"""
    base = build_pro_rewrite_prompt_base()
    policy_info = f"\n\nUygulanacak Politikalar: {', '.join(policies)}" if policies else ""
    domain_info = f"\n\nSektör: {domain}" if domain else ""
    context_info = f"\n\nÇevreleyen Bağlam:\n{surrounding_context[:300]}" if surrounding_context else ""
    return f"""{base}EDITORIAL FOCUS (DISCRIMINATION):
- Remove group generalizations
- Narrow scope to context
- Preserve critique without targeting identity groups

INSTRUCTIONS:
- Replace categorical statements with contextual ones
- Avoid attributing traits to entire groups
- Keep original intent intact

RİSK BİLGİSİ:
- Risk Tipi: discrimination
- Şiddet: {severity}{policy_info}{domain_info}{context_info}

EĞER BAĞLAM KORUNMAZSA:
- Rewrite yapma
- Sadece şu mesajı döndür: "CONTEXT_PRESERVATION_FAILED"

ORİJİNAL SPAN:
{span_text}

"""


def build_manipulation_rewrite_prompt(
    span_text: str,
    severity: str,
    surrounding_context: Optional[str] = None,
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None
) -> str:
    """PRO mode: Manipulation-specific rewrite prompt"""
    base = build_pro_rewrite_prompt_base()
    policy_info = f"\n\nUygulanacak Politikalar: {', '.join(policies)}" if policies else ""
    domain_info = f"\n\nSektör: {domain}" if domain else ""
    context_info = f"\n\nÇevreleyen Bağlam:\n{surrounding_context[:300]}" if surrounding_context else ""
    return f"""{base}EDITORIAL FOCUS (MANIPULATION):
- Remove coercive or fear-based language
- Preserve argument, remove pressure

INSTRUCTIONS:
- Eliminate forced outcomes ("or else")
- Maintain persuasive logic without emotional manipulation
- Respect reader autonomy

RİSK BİLGİSİ:
- Risk Tipi: manipulation
- Şiddet: {severity}{policy_info}{domain_info}{context_info}

EĞER BAĞLAM KORUNMAZSA:
- Rewrite yapma
- Sadece şu mesajı döndür: "CONTEXT_PRESERVATION_FAILED"

ORİJİNAL SPAN:
{span_text}

"""


def build_political_rewrite_prompt(
    span_text: str,
    severity: str,
    surrounding_context: Optional[str] = None,
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None
) -> str:
    """PRO mode: Political-specific rewrite prompt"""
    base = build_pro_rewrite_prompt_base()
    policy_info = f"\n\nUygulanacak Politikalar: {', '.join(policies)}" if policies else ""
    domain_info = f"\n\nSektör: {domain}" if domain else ""
    context_info = f"\n\nÇevreleyen Bağlam:\n{surrounding_context[:300]}" if surrounding_context else ""
    return f"""{base}EDITORIAL FOCUS (POLITICAL):
- Reduce certainty without erasing opinion
- Allow interpretive space

INSTRUCTIONS:
- Reframe absolute claims
- Avoid presenting opinion as fact
- Preserve political stance, soften delivery

RİSK BİLGİSİ:
- Risk Tipi: political
- Şiddet: {severity}{policy_info}{domain_info}{context_info}

EĞER BAĞLAM KORUNMAZSA:
- Rewrite yapma
- Sadece şu mesajı döndür: "CONTEXT_PRESERVATION_FAILED"

ORİJİNAL SPAN:
{span_text}

"""


def build_misinformation_rewrite_prompt(
    span_text: str,
    severity: str,
    surrounding_context: Optional[str] = None,
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None
) -> str:
    """PRO mode: Misinformation-specific rewrite prompt"""
    base = build_pro_rewrite_prompt_base()
    policy_info = f"\n\nUygulanacak Politikalar: {', '.join(policies)}" if policies else ""
    domain_info = f"\n\nSektör: {domain}" if domain else ""
    context_info = f"\n\nÇevreleyen Bağlam:\n{surrounding_context[:300]}" if surrounding_context else ""
    return f"""{base}EDITORIAL FOCUS (MISINFORMATION):
- Reduce false certainty
- Clarify ambiguity

INSTRUCTIONS:
- Replace definitive claims with probabilistic language
- Avoid introducing new facts
- Maintain original message scope

RİSK BİLGİSİ:
- Risk Tipi: misinformation
- Şiddet: {severity}{policy_info}{domain_info}{context_info}

EĞER BAĞLAM KORUNMAZSA:
- Rewrite yapma
- Sadece şu mesajı döndür: "CONTEXT_PRESERVATION_FAILED"

ORİJİNAL SPAN:
{span_text}

"""


def build_hate_rewrite_prompt(
    span_text: str,
    severity: str,
    surrounding_context: Optional[str] = None,
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None
) -> str:
    """PRO mode: Hate-specific rewrite prompt"""
    base = build_pro_rewrite_prompt_base()
    policy_info = f"\n\nUygulanacak Politikalar: {', '.join(policies)}" if policies else ""
    domain_info = f"\n\nSektör: {domain}" if domain else ""
    context_info = f"\n\nÇevreleyen Bağlam:\n{surrounding_context[:300]}" if surrounding_context else ""
    return f"""{base}EDITORIAL FOCUS (HATE):
- Remove dehumanizing language
- Preserve criticism without targeting identity
- Maintain argumentative structure

INSTRUCTIONS:
- Replace identity-based attacks with behavior-based critique
- Remove inflammatory language
- Keep logical structure intact

RİSK BİLGİSİ:
- Risk Tipi: hate
- Şiddet: {severity}{policy_info}{domain_info}{context_info}

EĞER BAĞLAM KORUNMAZSA:
- Rewrite yapma
- Sadece şu mesajı döndür: "CONTEXT_PRESERVATION_FAILED"

ORİJİNAL SPAN:
{span_text}

"""


def build_other_rewrite_prompt(
    span_text: str,
    risk_type: str,
    severity: str,
    surrounding_context: Optional[str] = None,
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None
) -> str:
    """PRO mode: Other risk types (fallback)"""
    base = build_pro_rewrite_prompt_base()
    policy_info = f"\n\nUygulanacak Politikalar: {', '.join(policies)}" if policies else ""
    domain_info = f"\n\nSektör: {domain}" if domain else ""
    context_info = f"\n\nÇevreleyen Bağlam:\n{surrounding_context[:300]}" if surrounding_context else ""
    return f"""{base}EDITORIAL FOCUS (OTHER):
- Reduce risk while preserving meaning
- Maintain original intent and tone

INSTRUCTIONS:
- Apply minimal necessary changes
- Preserve narrative voice
- Keep argumentative structure

RİSK BİLGİSİ:
- Risk Tipi: {risk_type}
- Şiddet: {severity}{policy_info}{domain_info}{context_info}

EĞER BAĞLAM KORUNMAZSA:
- Rewrite yapma
- Sadece şu mesajı döndür: "CONTEXT_PRESERVATION_FAILED"

ORİJİNAL SPAN:
{span_text}

"""


def build_span_rewrite_prompt(
    span_text: str,
    risk_type: str,
    severity: str,
    surrounding_context: Optional[str] = None,
    mode: str = "neutral_rewrite",
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None,
    analysis_mode: str = "fast"  # NEW: "fast" | "pro"
) -> str:
    """
    Build prompt for rewriting a single risky span
    
    PRO mode: Routes to risk-type-specific prompts
    FAST mode: Uses generic prompt (existing behavior)
    """
    # PRO mode: Risk-aware routing
    if analysis_mode == "pro":
        risk_type_lower = risk_type.lower()
        
        if "discrimination" in risk_type_lower or "bias" in risk_type_lower:
            return build_discrimination_rewrite_prompt(
                span_text=span_text,
                severity=severity,
                surrounding_context=surrounding_context,
                policies=policies,
                domain=domain
            )
        elif "manipulation" in risk_type_lower or "coercive" in risk_type_lower:
            return build_manipulation_rewrite_prompt(
                span_text=span_text,
                severity=severity,
                surrounding_context=surrounding_context,
                policies=policies,
                domain=domain
            )
        elif "political" in risk_type_lower:
            return build_political_rewrite_prompt(
                span_text=span_text,
                severity=severity,
                surrounding_context=surrounding_context,
                policies=policies,
                domain=domain
            )
        elif "misinformation" in risk_type_lower or "false" in risk_type_lower:
            return build_misinformation_rewrite_prompt(
                span_text=span_text,
                severity=severity,
                surrounding_context=surrounding_context,
                policies=policies,
                domain=domain
            )
        elif "hate" in risk_type_lower:
            return build_hate_rewrite_prompt(
                span_text=span_text,
                severity=severity,
                surrounding_context=surrounding_context,
                policies=policies,
                domain=domain
            )
        else:
            # Fallback to generic PRO prompt
            return build_other_rewrite_prompt(
                span_text=span_text,
                risk_type=risk_type,
                severity=severity,
                surrounding_context=surrounding_context,
                policies=policies,
                domain=domain
            )
    
    # FAST mode: Generic prompt (existing behavior)
    policy_info = f"\n\nUygulanacak Politikalar: {', '.join(policies)}" if policies else ""
    domain_info = f"\n\nSektör: {domain}" if domain else ""
    context_info = f"\n\nÇevreleyen Bağlam:\n{surrounding_context[:300]}" if surrounding_context else ""
    
    prompt = f"""EZA ÖNERİ YAZI OLUŞTURMA MODU - SPAN REWRITE (Camera-Mode, Non-Intrusive)

EZA bir editör değildir. EZA bir müdahale sistemi değildir. EZA bir kamera gibi çalışır.

GÖREV:
Sadece aşağıdaki riskli span'i yeniden yaz. Tüm metni değil, sadece bu span'i.

TEMEL KURALLAR (MUTLAK):
1. ORİJİNAL ANLAM MUTLAK KORUNMALI
2. NARRATIVE VOICE (anlatım tarzı) KORUNMALI
3. AUTHOR INTENT (yazar niyeti) KORUNMALI
4. EMOTIONAL TONE (duygusal ton) KORUNMALI
5. SPAN UZUNLUĞU BENZER KALMALI (±%20)

YAPILABİLECEK MİNİMAL DEĞİŞİKLİKLER (SADECE BUNLAR):
- Mutlak dil yumuşatılabilir: "kesin", "asla", "tek gerçek" → "bazı durumlarda", "genellikle", "çoğunlukla"
- Geniş genellemeler daraltılabilir: "doktorlar", "sistem" → "bazı doktorlar", "kimi çevrelerde"
- Yüksek riskli cümlelere minimal mesafe dili eklenebilir: "bazı kaynaklara göre", "kimi uzmanlar"

YAPILAMAYACAKLAR (KESİNLİKLE YASAK):
❌ İçeriği nötr raporlamaya çevirmek
❌ Deneyimsel veya birinci şahıs dilini kaldırmak
❌ Güvensizlik / eleştiri tonunu kaldırmak
❌ İddiaları kurumsal uyarılarla değiştirmek
❌ İkna yapısını kaldırmak
❌ Akademikleştirmek
❌ Özetlemek
❌ Mesajı tersine çevirmek

RİSK BİLGİSİ:
- Risk Tipi: {risk_type}
- Şiddet: {severity}{policy_info}{domain_info}{context_info}

EĞER BAĞLAM KORUNMAZSA:
- Rewrite yapma
- Sadece şu mesajı döndür: "CONTEXT_PRESERVATION_FAILED"

ORİJİNAL SPAN:
{span_text}

ÖNERİLEN SPAN (bağlam korunarak, minimal değişikliklerle, aynı uzunlukta):"""
    
    return prompt


async def rewrite_span(
    span_text: str,
    risk_type: str,
    severity: str,
    surrounding_context: Optional[str],
    mode: str,
    policies: Optional[List[str]],
    domain: Optional[str],
    provider: str,
    analysis_mode: str = "fast"  # NEW: "fast" | "pro"
) -> str:
    """
    Rewrite a single risky span
    
    Returns:
        - Rewritten span text if context preserved
        - CONTEXT_PRESERVATION_FAILED_MESSAGE if context cannot be preserved
    """
    settings = get_settings()
    
    prompt = build_span_rewrite_prompt(
        span_text=span_text,
        risk_type=risk_type,
        severity=severity,
        surrounding_context=surrounding_context,
        mode=mode,
        policies=policies,
        domain=domain,
        analysis_mode=analysis_mode  # NEW: Pass analysis_mode for risk-aware routing
    )
    
    try:
        rewritten = await call_llm_provider(
            provider_name=provider,
            prompt=prompt,
            settings=settings,
            model="gpt-4o-mini" if provider == "openai" else None,
            temperature=0.3,
            max_tokens=500  # Span is small, limit tokens
        )
        
        # Clean up response
        rewritten = rewritten.strip()
        rewritten = re.sub(r'^```json\s*', '', rewritten)
        rewritten = re.sub(r'^```\s*', '', rewritten)
        rewritten = re.sub(r'```\s*$', '', rewritten)
        rewritten = rewritten.strip()
        
        # Context preservation check
        is_preserved, preservation_score = await check_context_preservation(span_text, rewritten)
        
        if not is_preserved:
            logger.warning(f"[Stage-2] Span rewrite context preservation failed (score: {preservation_score:.2f})")
            return CONTEXT_PRESERVATION_FAILED_MESSAGE
        
        logger.info(f"[Stage-2] Span rewrite context preserved (score: {preservation_score:.2f})")
        return rewritten
        
    except Exception as e:
        logger.error(f"[Stage-2] Span rewrite error: {str(e)}")
        raise


def merge_overlapping_spans(spans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Merge overlapping spans to avoid conflicts during patching
    
    Returns:
        List of non-overlapping spans, sorted by start_offset
    """
    if not spans:
        return []
    
    # Sort by start_offset
    sorted_spans = sorted(spans, key=lambda s: s["start_offset"])
    
    merged = []
    current = sorted_spans[0].copy()
    
    for next_span in sorted_spans[1:]:
        # Check if spans overlap
        if current["end_offset"] >= next_span["start_offset"]:
            # Merge: extend current span to cover both
            current["end_offset"] = max(current["end_offset"], next_span["end_offset"])
            # Combine risk types
            if "risk_type" in next_span:
                if "risk_type" not in current:
                    current["risk_type"] = []
                if isinstance(current["risk_type"], str):
                    current["risk_type"] = [current["risk_type"]]
                if isinstance(next_span["risk_type"], str):
                    current["risk_type"].append(next_span["risk_type"])
                elif isinstance(next_span["risk_type"], list):
                    current["risk_type"].extend(next_span["risk_type"])
        else:
            # No overlap, save current and start new
            merged.append(current)
            current = next_span.copy()
    
    merged.append(current)
    return merged


def patch_span_into_content(
    original_content: str,
    span: Dict[str, Any],
    rewritten_span: str
) -> str:
    """
    Patch rewritten span back into original content
    
    SAFETY: Preserves offsets for unaffected spans
    
    Args:
        original_content: Full original content
        span: Span dict with start_offset, end_offset
        rewritten_span: Rewritten span text
    
    Returns:
        Content with span patched
    """
    if rewritten_span == CONTEXT_PRESERVATION_FAILED_MESSAGE:
        # Don't patch if rewrite failed
        return original_content
    
    start = span["start_offset"]
    end = span["end_offset"]
    
    # Ensure offsets are valid
    if start < 0:
        start = 0
    if end > len(original_content):
        end = len(original_content)
    if start >= end:
        logger.warning(f"[Stage-2] Invalid span offsets: {start}-{end}")
        return original_content
    
    # Patch: replace span with rewritten version
    before = original_content[:start]
    after = original_content[end:]
    patched = before + rewritten_span + after
    
    logger.info(f"[Stage-2] Patched span at {start}-{end} (original: {end-start} chars, rewritten: {len(rewritten_span)} chars)")
    
    return patched


async def stage2_span_based_rewrite(
    content: str,
    analysis_result: Dict[str, Any],
    mode: str = "neutral_rewrite",
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None,
    provider: str = "openai",
    max_spans: int = 5,  # Maximum spans to rewrite
    analysis_mode: str = "fast"  # NEW: "fast" | "pro"
) -> Dict[str, Any]:
    """
    Stage-2: Span-Based Rewrite
    
    Purpose: User-triggered rewrite of only risky spans
    Process:
    1. Extract risky spans from Stage-1 analysis
    2. Rewrite each span individually
    3. Patch rewritten spans back into original text
    
    Args:
        content: Original content
        analysis_result: Result from Stage-0 + Stage-1 analysis
        mode: Rewrite mode
        policies: Policy set
        domain: Content domain
        provider: LLM provider
        max_spans: Maximum number of spans to rewrite
    
    Returns:
        {
            "rewritten_content": str,
            "rewritten_spans": [...],
            "failed_spans": [...],
            "_stage2_latency_ms": float
        }
    """
    start_time = time.time()
    
    # Extract risky spans from analysis result
    paragraph_analyses = analysis_result.get("paragraphs", [])
    risk_locations = analysis_result.get("risk_locations", [])
    
    risky_spans = extract_risky_spans(content, paragraph_analyses, risk_locations)
    
    if not risky_spans:
        logger.info(f"[Stage-2] No risky spans found (risk_locations count: {len(risk_locations)}, paragraph_analyses count: {len(paragraph_analyses)}), returning original content")
        logger.info(f"[Stage-2] Risk locations sample: {risk_locations[:2] if risk_locations else 'None'}")
        return {
            "rewritten_content": content,
            "rewritten_spans": [],
            "failed_spans": [],
            "_stage2_latency_ms": 0
        }
    
    # Limit to max_spans (prioritize high severity)
    risky_spans.sort(key=lambda s: {"high": 3, "medium": 2, "low": 1}.get(s.get("severity", "medium"), 1), reverse=True)
    risky_spans = risky_spans[:max_spans]
    
    logger.info(f"[Stage-2] Starting span-based rewrite for {len(risky_spans)} spans")
    
    # SAFETY: Merge overlapping spans before processing
    risky_spans = merge_overlapping_spans(risky_spans)
    logger.info(f"[Stage-2] After merging overlaps: {len(risky_spans)} spans")
    
    # Rewrite spans sequentially (to preserve order and offsets)
    # CRITICAL: Apply patches from end → start to preserve offsets
    rewritten_content = content
    rewritten_spans = []
    failed_spans = []
    
    # Sort spans by start_offset DESCENDING (end → start)
    risky_spans_sorted = sorted(risky_spans, key=lambda s: s["start_offset"], reverse=True)
    
    # Calculate surrounding context for each span
    paragraphs = content.split('\n\n')
    if len(paragraphs) == 1:
        paragraphs = content.split('\n')
    
    for span in risky_spans_sorted:  # Process from end → start
        para_idx = span["paragraph"]
        if para_idx < len(paragraphs):
            para_text = paragraphs[para_idx]
            # Get surrounding context (100 chars before and after span in paragraph)
            span_start_in_para = span["start_offset"] - (sum(len(p) + 2 for p in paragraphs[:para_idx]) if para_idx > 0 else 0)
            context_start = max(0, span_start_in_para - 100)
            context_end = min(len(para_text), span_start_in_para + (span["end_offset"] - span["start_offset"]) + 100)
            surrounding_context = para_text[context_start:context_end]
        else:
            surrounding_context = None
        
        # Rewrite span
        try:
            rewritten_span = await rewrite_span(
                span_text=span["span_text"],
                risk_type=span["risk_type"],
                severity=span["severity"],
                surrounding_context=surrounding_context,
                mode=mode,
                policies=policies,
                domain=domain,
                provider=provider,
                analysis_mode=analysis_mode  # NEW: Pass analysis_mode for risk-aware routing
            )
            
            if rewritten_span == CONTEXT_PRESERVATION_FAILED_MESSAGE:
                failed_spans.append(span)
                logger.warning(f"[Stage-2] Span rewrite failed for paragraph {span['paragraph']}")
            else:
                # Patch into content
                rewritten_content = patch_span_into_content(rewritten_content, span, rewritten_span)
                rewritten_spans.append({
                    **span,
                    "rewritten_span": rewritten_span
                })
                logger.info(f"[Stage-2] Successfully rewrote span in paragraph {span['paragraph']}")
        
        except Exception as e:
            logger.error(f"[Stage-2] Error rewriting span: {str(e)}")
            failed_spans.append(span)
    
    latency_ms = (time.time() - start_time) * 1000
    
    logger.info(f"[Stage-2] Span-based rewrite completed in {latency_ms:.0f}ms: {len(rewritten_spans)} succeeded, {len(failed_spans)} failed")
    
    # Performance Metrics: Record rewrite latency
    from backend.services.proxy_performance_metrics import log_rewrite_metrics
    log_rewrite_metrics(
        rewrite_latency_ms=latency_ms,
        spans_rewritten=len(rewritten_spans),
        spans_failed=len(failed_spans),
        role="proxy"  # Rewrite is only for full Proxy
    )
    
    result = {
        "rewritten_content": rewritten_content,
        "rewritten_spans": rewritten_spans,
        "failed_spans": failed_spans,
        "_stage2_latency_ms": latency_ms
    }
    
    # PRO mode: Generate rewrite explanation (org admin only, internal)
    if analysis_mode == "pro" and rewritten_spans:
        result["rewrite_explanation"] = generate_rewrite_explanation(
            rewritten_spans=rewritten_spans,
            failed_spans=failed_spans,
            risk_locations=risk_locations
        )
    
    return result


def generate_rewrite_explanation(
    rewritten_spans: List[Dict[str, Any]],
    failed_spans: List[Dict[str, Any]],
    risk_locations: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Generate rewrite explanation for PRO mode (org admin only, internal)
    
    Returns:
        {
            "detected_risks": [...],
            "rewrite_actions": [...],
            "preservation_notes": [...],
            "outcome_summary": "..."
        }
    """
    detected_risks = []
    rewrite_actions = []
    preservation_notes = []
    
    # Group risks by paragraph
    risks_by_paragraph = {}
    for span in rewritten_spans:
        para_idx = span.get("paragraph", 0)
        if para_idx not in risks_by_paragraph:
            risks_by_paragraph[para_idx] = []
        risks_by_paragraph[para_idx].append({
            "risk_type": span.get("risk_type", "unknown"),
            "severity": span.get("severity", "medium"),
            "evidence": span.get("evidence", "")[:100]  # Truncate
        })
    
    # Build detected_risks list
    for para_idx, risks in risks_by_paragraph.items():
        dominant_risk = max(risks, key=lambda r: {"high": 3, "medium": 2, "low": 1}.get(r.get("severity", "medium"), 1))
        detected_risks.append({
            "paragraph": para_idx + 1,  # 1-indexed for display
            "risk_type": dominant_risk["risk_type"],
            "severity": dominant_risk["severity"],
            "count": len(risks)
        })
    
    # Build rewrite_actions list
    for span in rewritten_spans:
        rewrite_actions.append({
            "paragraph": span.get("paragraph", 0) + 1,  # 1-indexed
            "risk_type": span.get("risk_type", "unknown"),
            "action": f"Rewrote {span.get('risk_type', 'risk')} risk span",
            "preserved": "Context and meaning preserved"
        })
    
    # Build preservation_notes
    if rewritten_spans:
        preservation_notes.append("Original meaning and intent preserved")
        preservation_notes.append("Narrative voice maintained")
        preservation_notes.append("Author tone respected")
    
    # Build outcome_summary
    total_risks = len(rewritten_spans) + len(failed_spans)
    success_rate = len(rewritten_spans) / total_risks if total_risks > 0 else 0
    
    outcome_summary = (
        f"Detected {len(detected_risks)} risk pattern(s) across {len(risks_by_paragraph)} paragraph(s). "
        f"Successfully rewrote {len(rewritten_spans)} span(s) ({success_rate*100:.0f}% success rate). "
        f"Meaning and context preserved in all successful rewrites."
    )
    
    return {
        "detected_risks": detected_risks,
        "rewrite_actions": rewrite_actions,
        "preservation_notes": preservation_notes,
        "outcome_summary": outcome_summary
    }

