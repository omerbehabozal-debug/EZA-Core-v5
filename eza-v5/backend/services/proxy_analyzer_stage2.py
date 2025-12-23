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
    for risk in risk_locations:
        # Try to get paragraph index from risk location
        # If not available, try to match by evidence
        paragraph_idx = risk.get("paragraph_id") or risk.get("paragraph_index")
        
        if paragraph_idx is None:
            # Try to find paragraph by evidence matching
            evidence = risk.get("evidence", "")
            for i, para in enumerate(paragraphs):
                if evidence.lower() in para.lower()[:200]:  # Check first 200 chars
                    paragraph_idx = i
                    break
        
        if paragraph_idx is None or paragraph_idx >= len(paragraphs):
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


def build_span_rewrite_prompt(
    span_text: str,
    risk_type: str,
    severity: str,
    surrounding_context: Optional[str] = None,
    mode: str = "neutral_rewrite",
    policies: Optional[List[str]] = None,
    domain: Optional[str] = None
) -> str:
    """
    Build prompt for rewriting a single risky span
    Minimal context, focus on span only
    """
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
    provider: str
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
        domain=domain
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


def patch_span_into_content(
    original_content: str,
    span: Dict[str, Any],
    rewritten_span: str
) -> str:
    """
    Patch rewritten span back into original content
    
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
    max_spans: int = 5  # Maximum spans to rewrite
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
        logger.info("[Stage-2] No risky spans found, returning original content")
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
    
    # Rewrite spans sequentially (to preserve order and offsets)
    rewritten_content = content
    rewritten_spans = []
    failed_spans = []
    
    # Calculate surrounding context for each span
    paragraphs = content.split('\n\n')
    if len(paragraphs) == 1:
        paragraphs = content.split('\n')
    
    for span in risky_spans:
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
                provider=provider
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
    
    return {
        "rewritten_content": rewritten_content,
        "rewritten_spans": rewritten_spans,
        "failed_spans": failed_spans,
        "_stage2_latency_ms": latency_ms
    }

