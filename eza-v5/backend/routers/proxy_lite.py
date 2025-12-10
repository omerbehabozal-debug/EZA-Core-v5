# -*- coding: utf-8 -*-
"""
Proxy-Lite Mode Router
Ethical analysis endpoint for individual users and SMEs
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Literal
import json
import re
from backend.core.utils.dependencies import require_internal, require_institution_auditor
from backend.gateway.router_adapter import call_llm_provider
from backend.config import get_settings
from backend.core.engines.input_analyzer import analyze_input
from backend.core.engines.output_analyzer import analyze_output
from backend.core.engines.alignment_engine import compute_alignment
from backend.core.engines.legal_risk import analyze_legal_risk
from backend.core.engines.deception_engine import analyze_deception
from backend.core.engines.psych_pressure import analyze_psychological_pressure

router = APIRouter()


# ========== NEW ANALYZE ENDPOINT ==========

class AnalyzeRequest(BaseModel):
    text: str
    locale: Literal["tr", "en"] = "tr"
    provider: Optional[Literal["openai", "groq", "mistral"]] = "openai"


class ParagraphAnalysisResponse(BaseModel):
    original: str
    score: int  # 0-100, ethical score
    issues: List[str]  # Turkish issue labels
    rewrite: Optional[str] = None  # Rewritten version if available


class AnalyzeResponse(BaseModel):
    ethics_score: int  # 0-100, overall
    ethics_level: Literal["low", "medium", "high"]
    paragraphs: List[ParagraphAnalysisResponse]
    unique_issues: List[str]  # Unique issue labels (no duplicates)
    provider: str = "EZA-Core"


# ========== REWRITE ENDPOINT ==========

class RewriteRequest(BaseModel):
    text: str
    risk_labels: Optional[List[str]] = None
    language: Literal["tr", "en"] = "tr"
    provider: Optional[Literal["openai", "groq", "mistral"]] = "openai"


class RewriteResponse(BaseModel):
    original_text: str
    rewritten_text: str
    original_ethical_score: int
    new_ethical_score: int
    risk_level_before: Literal["low", "medium", "high"]
    risk_level_after: Literal["low", "medium", "high"]
    improved: bool  # True if new_score > original_score


# ========== LEGACY REPORT ENDPOINT ==========

class ProxyLiteReportRequest(BaseModel):
    message: str
    output_text: str


class ProxyLiteReportResponse(BaseModel):
    risk_level: str
    risk_category: str
    violated_rule_count: int
    summary: str
    recommendation: str


# ========== HELPER FUNCTIONS ==========

def split_into_paragraphs(text: str, max_length: int = 1000) -> List[str]:
    """
    Split text into paragraphs:
    - First by double newlines (\n\n)
    - If user hasn't used any empty lines, keep entire text as single paragraph
    - If paragraph is too long (>max_length), split by sentences
    - Skip empty paragraphs
    """
    text = text.strip()
    if not text:
        return []
    
    # Split by double newlines
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    
    # If no double newlines found, keep entire text as single paragraph
    if len(paragraphs) == 1 and '\n\n' not in text:
        return [text]
    
    # If still one paragraph and too long, split by sentences
    result = []
    for para in paragraphs:
        if len(para) <= max_length:
            result.append(para)
        else:
            # Split by sentences (., !, ?)
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


def get_risk_level(score: int) -> Literal["low", "medium", "high"]:
    """Convert ethical_score to ethics_level"""
    if score >= 70:
        return "low"
    elif score >= 40:
        return "medium"
    else:
        return "high"


def build_judge_prompt(paragraph: str, locale: str = "tr") -> str:
    """Build the judge prompt for paragraph analysis"""
    if locale == "tr":
        return f"""Sen EZA adlı bir etik ve güvenlik analiz motorusun. Görevin, verilen Türkçe metni etik, güvenlik ve yanıltıcılık açısından değerlendirmek ve 0-100 arasında bir 'ethic_score' üretmektir. 0 etik açıdan çok sorunlu, 100 ise etik açıdan çok güvenli demektir.

ÖNEMLİ KURALLAR:
1. SORU FORMATI: Eğer metin bir soru ise (?, nasıl, ne, neden, hangi, kim vb. ile bitiyorsa), bu bir soru sorma eylemidir, risk içermez. Sorular genelde 80-100 arası skor almalı ve risk_tags boş olmalıdır.

2. BAĞLAM EKSİKLİĞİ: Eğer metin çok kısa (tek cümle) ve bağlam eksikse, sadece metinde AÇIKÇA görünen risklere göre değerlendir. Varsayım yapma, sadece metinde yazılı olanı analiz et.

3. ETİKET ATAMA: risk_tags sadece metinde AÇIKÇA görünen riskler için atanmalı. Örnek:
   - "Bu çay zayıflatıyor" → "Sağlık iddiası" ✓
   - "Bu çay zayıflatıyor mu?" → risk_tags: [] (soru formatı, risk yok)
   - "Gerçek dışı dil kullanıyor mu?" → risk_tags: [] (soru formatı, risk yok)

4. SKORLAMA:
   - Sorular: 80-100 (soru sormak etik açıdan sorunlu değil)
   - Nötr ifadeler: 70-90
   - Risk içeren iddialar: 0-69 (iddianın şiddetine göre)

Özellikle şu tür risklere dikkat et (SADECE METİNDE AÇIKÇA VARSA):
- Sağlıkla ilgili abartılı veya garanti veren iddialar (sorular değil, iddialar)
- Finansal kazanç konusunda hızlı, garanti, risksiz vaatler
- Nefret söylemi, ayrımcılık, hakaret
- Şiddet, kendine zarar verme, başkasına zarar verme
- Manipülatif, baskıcı, psikolojik baskı içeren ifadeler
- Yanlış yönlendirme, eksik bilgiyle yönlendirme

METNİ ANALİZ ET:
{paragraph}

Cevabın mutlaka şu JSON formatında olsun (başka açıklama yapma, sadece JSON):

{{
  "ethic_score": number,
  "risk_tags": ["Sağlık iddiası", "Yanıltıcı garanti", "Bilimsel kanıt yok", "Aşırı yönlendirme", "Reklam / Gizli satış", "Hedef kitle hassasiyeti", ...]
}}

risk_tags örnekleri (SADECE METİNDE AÇIKÇA VARSA):
- "Sağlık iddiası" (sadece iddia varsa, soru değilse)
- "Yanıltıcı garanti" (sadece garanti varsa)
- "Bilimsel kanıt yok" (sadece bilimsel iddia varsa)
- "Aşırı yönlendirme" (sadece yönlendirme varsa)
- "Reklam / Gizli satış" (sadece satış çağrısı varsa)
- "Hedef kitle hassasiyeti" (sadece hassas kitleye yönelik içerik varsa)

Etiketler kısa, Türkçe ve açıklayıcı olmalı. Soru formatında ise risk_tags boş array olmalı."""
    else:
        return f"""You are EZA, an ethical and security analysis engine. Your task is to evaluate the given text for ethical, security, and misleading content, and produce an 'ethic_score' between 0-100. 0 means very problematic ethically, 100 means very safe ethically.

IMPORTANT RULES:
1. QUESTION FORMAT: If the text is a question (ends with ?, starts with how, what, why, which, who, where, when), this is an act of asking, not a risk. Questions should generally score 80-100 and have empty risk_tags.

2. CONTEXT LACK: If the text is very short (single sentence) and lacks context, evaluate only based on risks EXPLICITLY visible in the text. Don't assume, only analyze what's written.

3. TAG ASSIGNMENT: risk_tags should only be assigned for risks EXPLICITLY visible in the text. Examples:
   - "This tea helps you lose weight" → "health claim" ✓
   - "Does this tea help you lose weight?" → risk_tags: [] (question format, no risk)
   - "Does it use unrealistic language?" → risk_tags: [] (question format, no risk)

4. SCORING:
   - Questions: 80-100 (asking questions is not ethically problematic)
   - Neutral statements: 70-90
   - Risk-containing claims: 0-69 (based on severity of claim)

Pay special attention to (ONLY IF EXPLICITLY PRESENT IN TEXT):
- Exaggerated or guarantee-making health claims (not questions, but claims)
- Fast, guaranteed, risk-free financial gain promises
- Hate speech, discrimination, insults
- Violence, self-harm, harm to others
- Manipulative, coercive, psychologically pressuring expressions
- Misleading or incomplete information

ANALYZE THIS TEXT:
{paragraph}

Your response must be in this JSON format (no explanations, only JSON):

{{
  "ethic_score": number,
  "risk_tags": ["health claim", "misleading guarantee", "no scientific evidence", "excessive guidance", "advertising / hidden sales", "target audience sensitivity", ...]
}}

risk_tags examples (ONLY IF EXPLICITLY PRESENT):
- "health claim" (only if there's a claim, not a question)
- "misleading guarantee" (only if there's a guarantee)
- "no scientific evidence" (only if there's a scientific claim)
- "excessive guidance" (only if there's guidance)
- "advertising / hidden sales" (only if there's a sales call)
- "target audience sensitivity" (only if there's content targeting sensitive audience)

risk_tags should be short, descriptive labels in the appropriate language. If in question format, risk_tags should be an empty array."""


def build_rewrite_prompt(paragraph: str, locale: str = "tr") -> str:
    """Build the rewrite prompt"""
    if locale == "tr":
        return f"""Sen EZA'nın 'Daha Etik Hâle Getir' motorusun. Sana verilen paragrafı anlamını mümkün olduğunca koruyarak, ama etik ve güvenlik açısından daha güvenli hale getirmen gerekiyor.

KURALLAR:
- Sağlık, finans, hukuk ve benzeri alanlarda kesin, garanti veren iddialardan kaçın.
- Gerekirse 'kişiden kişiye değişebilir', 'uzmana danışmak önemlidir', 'herkes için uygun olmayabilir' gibi yumuşatıcı ifadeler kullan.
- Nefret söylemi, hakaret, ayrımcı veya aşağılayıcı ifadeleri tamamen kaldır veya nötrle.
- Manipülatif, baskıcı veya tehditkar tonda yazma.
- Cevabın SADECE yeniden yazılmış paragraf olsun. Başına veya sonuna açıklama, başlık, köşeli parantez veya meta bilgi ekleme.

HEDEF:
- EZA etik skorunun 0-100 aralığında en az 80'e çıkmasını hedefle.
- Orijinal metnin anlamını koru, sadece daha etik ve güvenli hale getir.

ŞU PARAGRAFI YENİDEN YAZ:
{paragraph}

YANIT: (Sadece yeniden yazılmış paragraf, başka hiçbir şey ekleme)"""
    else:
        return f"""You are EZA's 'Make More Ethical' engine. You need to rewrite the given paragraph, preserving its meaning as much as possible, but making it safer from an ethical and security perspective.

Rules:
- Avoid definitive, guarantee-making claims in health, finance, law, and similar fields.
- Use softening expressions like 'may vary from person to person', 'consulting an expert is important', 'may not be suitable for everyone' when necessary.
- Completely remove or neutralize hate speech, insults, discriminatory or degrading expressions.
- Do not write in a manipulative, coercive, or threatening tone.
- Your response should only be the rewritten paragraph. Do not add explanations, titles, brackets, or meta information at the beginning or end.

Goal:
- Aim for EZA ethical score to reach at least 80 in the 0-100 range.

REWRITE THIS PARAGRAPH:
{paragraph}"""


async def analyze_paragraph(
    paragraph: str,
    locale: str,
    provider: str,
    settings
) -> ParagraphAnalysisResponse:
    """Analyze a single paragraph using the judge prompt"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        prompt = build_judge_prompt(paragraph, locale)
        logger.debug(f"[Proxy-Lite] Analyzing paragraph (length={len(paragraph)})")
        
        # Call LLM provider
        response_text = await call_llm_provider(
            provider_name=provider,
            prompt=prompt,
            settings=settings,
            model="gpt-4o-mini" if provider == "openai" else None,
            temperature=0.3,
            max_tokens=1000
        )
        
        logger.debug(f"[Proxy-Lite] LLM response received (length={len(response_text)})")
        
        # Parse JSON response
        try:
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                data = json.loads(response_text)
            
            # Validate and ensure risk_level matches score
            ethical_score = int(data.get("ethic_score", 50))
            risk_tags = data.get("risk_tags", [])
            
            logger.debug(f"[Proxy-Lite] Parsed response: score={ethical_score}, tags={risk_tags}")
            
            return ParagraphAnalysisResponse(
                original=paragraph,
                score=ethical_score,
                issues=risk_tags,
                rewrite=None  # Will be filled by rewrite endpoint if requested
            )
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error(f"[Proxy-Lite] JSON parse error: {str(e)}, response_text={response_text[:200]}")
            # Fallback: use basic analysis
            return ParagraphAnalysisResponse(
                original=paragraph,
                score=50,
                issues=["analiz_hatası"],
                rewrite=None
            )
    except Exception as e:
        logger.error(f"[Proxy-Lite] Error in analyze_paragraph: {str(e)}", exc_info=True)
        # Fallback: use basic analysis
        return ParagraphAnalysisResponse(
            original=paragraph,
            score=50,
            issues=["llm_hatası"],
            rewrite=None
        )


# ========== ENDPOINTS ==========

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_ethical_content(
    request: AnalyzeRequest,
    current_user = Depends(require_internal())
):
    """
    Proxy-Lite Ethical Analysis Endpoint
    Analyzes text paragraph-by-paragraph and returns ethical scores
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"[Proxy-Lite] Analyze request received: text_length={len(request.text)}, locale={request.locale}, provider={request.provider}")
        settings = get_settings()
        
        # Split text into paragraphs
        paragraphs = split_into_paragraphs(request.text)
        if not paragraphs:
            paragraphs = [request.text]
        
        logger.info(f"[Proxy-Lite] Split into {len(paragraphs)} paragraphs")
        
        # Analyze each paragraph with context awareness
        paragraph_analyses = []
        for i, para in enumerate(paragraphs):
            logger.info(f"[Proxy-Lite] Analyzing paragraph {i+1}/{len(paragraphs)} (length={len(para)})")
            
            # Check if paragraph is a question (simple heuristic)
            para_stripped = para.strip()
            is_question = (
                para_stripped.endswith('?') or 
                any(para_stripped.startswith(q) for q in ['Nasıl', 'Ne', 'Neden', 'Hangi', 'Kim', 'Nerede', 'Ne zaman', 'Nereye', 'nasıl', 'ne', 'neden', 'hangi', 'kim', 'nerede', 'ne zaman', 'nereye'])
            )
            
            if is_question:
                logger.info(f"[Proxy-Lite] Paragraph {i+1} detected as question format")
            
            try:
                analysis = await analyze_paragraph(
                    para, request.locale, request.provider or "openai", settings
                )
                
                # Post-process: If it's clearly a question but got low score, adjust
                if is_question and analysis.score < 70:
                    logger.info(f"[Proxy-Lite] Paragraph {i+1} is a question but got low score ({analysis.score}), adjusting to 85 and clearing irrelevant tags")
                    analysis.score = 85
                    # Remove irrelevant tags for questions (questions don't contain risks, they just ask)
                    analysis.issues = []
                
                paragraph_analyses.append(analysis)
                logger.info(f"[Proxy-Lite] Paragraph {i+1} analyzed: score={analysis.score}, tags={len(analysis.issues)}")
            except Exception as para_error:
                logger.error(f"[Proxy-Lite] Error analyzing paragraph {i+1}: {str(para_error)}")
                # Add fallback paragraph
                paragraph_analyses.append(ParagraphAnalysisResponse(
                    original=para,
                    score=50,
                    issues=["analiz_hatası"],
                    rewrite=None
                ))
        
        # Calculate simple average for overall score
        if paragraph_analyses:
            overall_score = sum(p.score for p in paragraph_analyses) / len(paragraph_analyses)
            overall_score = int(round(overall_score))
        else:
            overall_score = 50
        
        overall_ethics_level = get_risk_level(overall_score)
        
        # Collect all unique issues (no duplicates)
        all_issues = []
        for p in paragraph_analyses:
            all_issues.extend(p.issues)
        unique_issues = list(dict.fromkeys(all_issues))  # Preserve order, remove duplicates
        
        logger.info(f"[Proxy-Lite] Analysis complete: overall_score={overall_score}, ethics_level={overall_ethics_level}, unique_issues={len(unique_issues)}")
        
        return AnalyzeResponse(
            ethics_score=overall_score,
            ethics_level=overall_ethics_level,
            paragraphs=paragraph_analyses,
            unique_issues=unique_issues,
            provider="EZA-Core"
        )
        
    except Exception as e:
        logger.error(f"[Proxy-Lite] Analysis error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing content: {str(e)}"
        )


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_paragraph(
    request: RewriteRequest,
    current_user = Depends(require_internal())
):
    """
    Rewrite paragraph to be more ethical
    """
    try:
        settings = get_settings()
        provider = request.provider or "openai"
        locale = request.language
        
        # First, analyze original paragraph
        original_analysis = await analyze_paragraph(
            request.text,
            locale,
            provider,
            settings
        )
        original_score = original_analysis.score
        risk_level_before = get_risk_level(original_score)
        
        # Build rewrite prompt with risk labels if provided
        rewrite_prompt = build_rewrite_prompt(request.text, locale)
        if request.risk_labels:
            rewrite_prompt += f"\n\nÖzellikle şu risk etiketlerine dikkat et: {', '.join(request.risk_labels)}"
        
        # Call LLM for rewrite
        new_text = await call_llm_provider(
            provider_name=provider,
            prompt=rewrite_prompt,
            settings=settings,
            model="gpt-4o-mini" if provider == "openai" else None,
            temperature=0.5,
            max_tokens=1000
        )
        
        # Clean up new_text (remove any markdown or extra formatting)
        new_text = new_text.strip()
        new_text = re.sub(r'^```json\s*', '', new_text)
        new_text = re.sub(r'^```\s*', '', new_text)
        new_text = re.sub(r'```\s*$', '', new_text)
        new_text = new_text.strip()
        
        # Analyze the rewritten text
        new_analysis = await analyze_paragraph(
            new_text,
            locale,
            provider,
            settings
        )
        new_score = new_analysis.score
        risk_level_after = get_risk_level(new_score)
        
        # Check if rewrite improved the score
        improved = new_score > original_score
        
        # Log the result
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[Proxy-Lite] Rewrite result: original={original_score}, new={new_score}, improved={improved}")
        
        # Always return the rewrite, but mark if it improved
        return RewriteResponse(
            original_text=request.text,
            rewritten_text=new_text,
            original_ethical_score=original_score,
            new_ethical_score=new_score,
            risk_level_before=risk_level_before,
            risk_level_after=risk_level_after,
            improved=improved
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error rewriting paragraph: {str(e)}"
        )


@router.post("/report", response_model=ProxyLiteReportResponse)
async def proxy_lite_report(
    request: ProxyLiteReportRequest,
    current_user = Depends(require_institution_auditor())
):
    """Proxy-Lite audit report endpoint - Institution auditors only"""
    try:
        # Analyze input and output
        input_analysis = analyze_input(request.message)
        output_analysis = analyze_output(request.output_text, input_analysis)
        alignment = compute_alignment(input_analysis, output_analysis)
        
        # Build report for deep analysis
        report = {
            "input": {"raw_text": request.message, "analysis": input_analysis},
            "output": {"raw_text": request.output_text, "analysis": output_analysis},
            "alignment": alignment
        }
        
        # Run deep analysis engines
        legal_risk = analyze_legal_risk(input_analysis, output_analysis, report)
        deception = analyze_deception(request.message, report)
        psych_pressure = analyze_psychological_pressure(request.message)
        
        # Aggregate risk
        risk_scores = [
            input_analysis.get("risk_score", 0.0),
            output_analysis.get("risk_score", 0.0),
            legal_risk.get("risk_score", 0.0),
            deception.get("score", 0.0),
            psych_pressure.get("score", 0.0)
        ]
        
        max_risk = max(risk_scores)
        
        # Determine risk level
        if max_risk > 0.8:
            risk_level = "critical"
        elif max_risk > 0.6:
            risk_level = "high"
        elif max_risk > 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        # Count violated rules
        violated_rules = []
        if input_analysis.get("risk_score", 0.0) > 0.5:
            violated_rules.append("input_risk")
        if output_analysis.get("risk_score", 0.0) > 0.5:
            violated_rules.append("output_risk")
        if legal_risk.get("risk_score", 0.0) > 0.5:
            violated_rules.append("legal_risk")
        if deception.get("score", 0.0) > 0.5:
            violated_rules.append("deception")
        if psych_pressure.get("score", 0.0) > 0.5:
            violated_rules.append("psychological_pressure")
        
        # Determine risk category
        if legal_risk.get("risk_score", 0.0) > 0.6:
            risk_category = "legal_compliance"
        elif deception.get("score", 0.0) > 0.6:
            risk_category = "deception"
        elif psych_pressure.get("score", 0.0) > 0.6:
            risk_category = "psychological_manipulation"
        elif input_analysis.get("risk_score", 0.0) > 0.6:
            risk_category = "input_risk"
        else:
            risk_category = "general"
        
        # Generate summary and recommendation
        summary = f"Risk assessment completed. {len(violated_rules)} rule violations detected. Risk level: {risk_level}."
        
        if risk_level == "critical":
            recommendation = "Immediate action required. Content should be blocked and reviewed by compliance team."
        elif risk_level == "high":
            recommendation = "Content requires review. Consider blocking or modification before deployment."
        elif risk_level == "medium":
            recommendation = "Content should be monitored. Consider additional safeguards."
        else:
            recommendation = "Content appears safe. Standard monitoring recommended."
        
        return ProxyLiteReportResponse(
            risk_level=risk_level,
            risk_category=risk_category,
            violated_rule_count=len(violated_rules),
            summary=summary,
            recommendation=recommendation
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating audit report: {str(e)}"
        )
