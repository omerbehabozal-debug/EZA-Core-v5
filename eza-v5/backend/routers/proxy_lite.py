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
    index: int
    original_text: str
    ethical_score: int  # 0-100, higher = safer
    risk_level: Literal["dusuk", "orta", "yuksek"]
    risk_labels: List[str]  # Turkish labels
    highlighted_spans: List[dict]  # [{"start": int, "end": int, "reason": str}, ...]
    suggested_rewrite: Optional[str] = None  # "Daha Etik Hâle Getirilmiş Öneri"


class AnalyzeResponse(BaseModel):
    ok: bool = True
    provider: Literal["openai", "groq", "mistral"]
    overall_ethical_score: int  # 0-100, overall (weighted average)
    overall_risk_level: Literal["dusuk", "orta", "yuksek"]
    overall_message: str  # Short Turkish summary message
    paragraph_analyses: List[ParagraphAnalysisResponse]
    raw: Optional[dict] = None


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
    risk_level_before: Literal["dusuk", "orta", "yuksek"]
    risk_level_after: Literal["dusuk", "orta", "yuksek"]


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


def get_risk_level(score: int) -> Literal["dusuk", "orta", "yuksek"]:
    """Convert ethic_score to risk_level"""
    if score >= 70:
        return "dusuk"
    elif score >= 40:
        return "orta"
    else:
        return "yuksek"


def build_judge_prompt(paragraph: str, locale: str = "tr") -> str:
    """Build the judge prompt for paragraph analysis"""
    if locale == "tr":
        return f"""Sen EZA adlı bir etik ve güvenlik analiz motorusun. Görevin, verilen Türkçe metni etik, güvenlik ve yanıltıcılık açısından değerlendirmek ve 0-100 arasında bir 'ethic_score' üretmektir. 0 etik açıdan çok sorunlu, 100 ise etik açıdan çok güvenli demektir.

Özellikle şu tür risklere dikkat et:
- Sağlıkla ilgili abartılı veya garanti veren iddialar
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
  "risk_level": "dusuk" | "orta" | "yuksek",
  "risk_tags": ["sağlık iddiası", "yanıltıcı garanti", ...],
  "highlights": [[start, end], ...]
}}

risk_level belirleme:
- 0-39 → "yuksek"
- 40-69 → "orta"
- 70-100 → "dusuk"

highlights: metindeki riskli kısımların karakter indexleri (başlangıç, bitiş). Örnek: "Bu ürün kesin kilo verdirir" metninde "kesin kilo verdirir" kısmı riskliyse, o kısmın başlangıç ve bitiş indexlerini ver."""
    else:
        return f"""You are EZA, an ethical and security analysis engine. Your task is to evaluate the given text for ethical, security, and misleading content, and produce an 'ethic_score' between 0-100. 0 means very problematic ethically, 100 means very safe ethically.

Pay special attention to:
- Exaggerated or guarantee-making health claims
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
  "risk_level": "dusuk" | "orta" | "yuksek",
  "risk_tags": ["health claim", "misleading guarantee", ...],
  "highlights": [[start, end], ...]
}}

risk_level determination:
- 0-39 → "yuksek"
- 40-69 → "orta"
- 70-100 → "dusuk"

highlights: character indices (start, end) of risky parts in the text."""


def build_rewrite_prompt(paragraph: str, locale: str = "tr") -> str:
    """Build the rewrite prompt"""
    if locale == "tr":
        return f"""Sen EZA'nın 'Daha Etik Hâle Getir' motorusun. Sana verilen paragrafı anlamını mümkün olduğunca koruyarak, ama etik ve güvenlik açısından daha güvenli hale getirmen gerekiyor.

Kurallar:
- Sağlık, finans, hukuk ve benzeri alanlarda kesin, garanti veren iddialardan kaçın.
- Gerekirse 'kişiden kişiye değişebilir', 'uzmana danışmak önemlidir', 'herkes için uygun olmayabilir' gibi yumuşatıcı ifadeler kullan.
- Nefret söylemi, hakaret, ayrımcı veya aşağılayıcı ifadeleri tamamen kaldır veya nötrle.
- Manipülatif, baskıcı veya tehditkar tonda yazma.
- Cevabın sadece yeniden yazılmış paragraf olsun. Başına veya sonuna açıklama, başlık, köşeli parantez veya meta bilgi ekleme.

Hedef:
- EZA etik skorunun 0-100 aralığında en az 80'e çıkmasını hedefle.

PARAGRAFI YENİDEN YAZ:
{paragraph}"""
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
    index: int,
    locale: str,
    provider: str,
    settings
) -> ParagraphAnalysisResponse:
    """Analyze a single paragraph using the judge prompt"""
    prompt = build_judge_prompt(paragraph, locale)
    
    # Call LLM provider
    response_text = await call_llm_provider(
        provider_name=provider,
        prompt=prompt,
        settings=settings,
        model="gpt-4o-mini" if provider == "openai" else None,
        temperature=0.3,
        max_tokens=1000
    )
    
    # Parse JSON response
    try:
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
        else:
            data = json.loads(response_text)
        
        # Validate and ensure risk_level matches score
        ethical_score = int(data.get("ethic_score", 50))
        risk_level = get_risk_level(ethical_score)  # Override with calculated value
        risk_tags = data.get("risk_tags", [])
        highlights = data.get("highlights", [])
        
        # Convert highlights to highlighted_spans format
        highlighted_spans = []
        for h in highlights:
            if isinstance(h, list) and len(h) >= 2:
                highlighted_spans.append({
                    "start": int(h[0]),
                    "end": int(h[1]),
                    "reason": h[2] if len(h) > 2 else "riskli_ifade"
                })
        
        return ParagraphAnalysisResponse(
            index=index,
            original_text=paragraph,
            ethical_score=ethical_score,
            risk_level=risk_level,
            risk_labels=risk_tags,
            highlighted_spans=highlighted_spans,
            suggested_rewrite=None
        )
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        # Fallback: use basic analysis
        return ParagraphAnalysisResponse(
            index=index,
            original_text=paragraph,
            ethical_score=50,
            risk_level="orta",
            risk_labels=["analiz_hatası"],
            highlighted_spans=[],
            suggested_rewrite=None
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
    try:
        settings = get_settings()
        
        # Split text into paragraphs
        paragraphs = split_into_paragraphs(request.text)
        if not paragraphs:
            paragraphs = [request.text]
        
        # Analyze each paragraph
        paragraph_analyses = []
        for i, para in enumerate(paragraphs):
            analysis = await analyze_paragraph(
                para, i + 1, request.locale, request.provider or "openai", settings
            )
            paragraph_analyses.append(analysis)
        
        # Calculate simple average for overall score (not weighted, as per requirements)
        if paragraph_analyses:
            overall_score = sum(p.ethical_score for p in paragraph_analyses) / len(paragraph_analyses)
            overall_score = int(round(overall_score))
        else:
            overall_score = 50
        
        overall_risk_level = get_risk_level(overall_score)
        
        # Generate overall message based on score
        if overall_score >= 80:
            overall_message = "Metniniz genel olarak düşük riskli. Etik açıdan güvenli ifadeler kullanıyorsunuz."
        elif overall_score >= 50:
            overall_message = "Metninizde bazı orta seviyeli riskler tespit edildi. Sağlık ve sonuç garantisi içeren ifadeleri dikkatle kullanın."
        else:
            overall_message = "Metninizde yüksek seviyeli riskler tespit edildi. Manipülatif ifadeler, kesin iddialar ve sağlık/finansal garanti içeren cümleleri gözden geçirmeniz önerilir."
        
        # Collect all flags
        all_flags = []
        for p in paragraph_analyses:
            all_flags.extend(p.risk_labels)
        unique_flags = list(set(all_flags))
        
        provider = request.provider or "openai"
        
        return AnalyzeResponse(
            ok=True,
            provider=provider,
            overall_ethical_score=overall_score,
            overall_risk_level=overall_risk_level,
            overall_message=overall_message,
            paragraph_analyses=paragraph_analyses,
            raw=None
        )
        
    except Exception as e:
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
            0,
            locale,
            provider,
            settings
        )
        original_score = original_analysis.ethical_score
        risk_level_before = original_analysis.risk_level
        
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
            0,
            locale,
            provider,
            settings
        )
        new_score = new_analysis.ethical_score
        risk_level_after = new_analysis.risk_level
        
        # Validate: new_score must be > original_score, otherwise reject
        if new_score <= original_score:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bu öneri daha güvenli değil, lütfen metni gözden geçirin."
            )
        
        return RewriteResponse(
            original_text=request.text,
            rewritten_text=new_text,
            original_ethical_score=original_score,
            new_ethical_score=new_score,
            risk_level_before=risk_level_before,
            risk_level_after=risk_level_after
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
