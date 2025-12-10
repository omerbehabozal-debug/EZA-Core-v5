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
    context: Optional[Literal["social_media", "corporate_professional", "legal_official", "educational_informative", "personal_blog"]] = None
    target_audience: Optional[Literal["general_public", "clients_consultants", "students", "children_youth", "colleagues", "regulators_public"]] = None
    tone: Optional[Literal["neutral", "professional", "friendly", "funny", "persuasive", "strict_warning"]] = None


class ParagraphAnalysisResponse(BaseModel):
    original: str
    score: int  # 0-100, ethical score
    issues: List[str]  # Turkish issue labels
    rewrite: Optional[str] = None  # Rewritten version if available
    neutrality_score: Optional[int] = None  # 0-100, neutrality score
    writing_quality_score: Optional[int] = None  # 0-100, writing quality score
    platform_fit_score: Optional[int] = None  # 0-100, platform fit score


class AnalyzeResponse(BaseModel):
    ethics_score: int  # 0-100, overall
    ethics_level: Literal["low", "medium", "high"]
    neutrality_score: int  # 0-100, overall neutrality
    writing_quality_score: int  # 0-100, overall writing quality
    platform_fit_score: int  # 0-100, overall platform fit
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


def apply_context_audience_adjustments(
    base_score: int,
    context: Optional[str],
    target_audience: Optional[str],
    tone: Optional[str] = None
) -> int:
    """
    Apply risk coefficient adjustments based on context, target audience, and tone.
    Returns adjusted score (0-100).
    
    Risk coefficients:
    - Higher risk contexts/audiences/tones → lower score (stricter)
    - Lower risk contexts/audiences/tones → higher score (more lenient)
    """
    import logging
    logger = logging.getLogger(__name__)
    
    adjusted_score = float(base_score)
    original_score = base_score
    
    # Context-based adjustments (risk multipliers)
    context_multipliers = {
        "legal_official": 0.85,  # Stricter: -15% (legal content needs higher standards)
        "educational_informative": 0.90,  # Stricter: -10% (educational content must be accurate)
        "corporate_professional": 0.95,  # Slightly stricter: -5%
        "social_media": 1.0,  # No adjustment (baseline)
        "personal_blog": 1.05,  # Slightly more lenient: +5%
    }
    
    # Target audience-based adjustments (risk multipliers)
    audience_multipliers = {
        "children_youth": 0.75,  # Much stricter: -25% (highest risk, needs strictest control)
        "regulators_public": 0.80,  # Stricter: -20% (legal compliance critical)
        "students": 0.90,  # Stricter: -10% (educational context)
        "clients_consultants": 0.95,  # Slightly stricter: -5% (professional standards)
        "colleagues": 1.0,  # No adjustment (baseline)
        "general_public": 1.0,  # No adjustment (baseline)
    }
    
    # Tone-based adjustments (risk multipliers)
    tone_multipliers = {
        "strict_warning": 0.88,  # Stricter: -12% (strict/warning tone can be risky, needs careful review)
        "persuasive": 0.92,  # Slightly stricter: -8% (persuasive content can be manipulative)
        "professional": 1.0,  # No adjustment (baseline, professional tone is standard)
        "neutral": 1.0,  # No adjustment (baseline, neutral tone is standard)
        "friendly": 1.02,  # Slightly more lenient: +2% (friendly tone is generally safe)
        "funny": 1.03,  # Slightly more lenient: +3% (humor is generally acceptable, but still monitored)
    }
    
    # Apply context multiplier
    if context and context in context_multipliers:
        multiplier = context_multipliers[context]
        adjusted_score *= multiplier
        logger.info(f"[Proxy-Lite] Applied context multiplier {multiplier} for context '{context}': {adjusted_score/multiplier:.1f} → {adjusted_score:.1f}")
    
    # Apply target audience multiplier
    if target_audience and target_audience in audience_multipliers:
        multiplier = audience_multipliers[target_audience]
        adjusted_score *= multiplier
        logger.info(f"[Proxy-Lite] Applied audience multiplier {multiplier} for audience '{target_audience}': {adjusted_score/multiplier:.1f} → {adjusted_score:.1f}")
    
    # Apply tone multiplier
    if tone and tone in tone_multipliers:
        multiplier = tone_multipliers[tone]
        adjusted_score *= multiplier
        logger.info(f"[Proxy-Lite] Applied tone multiplier {multiplier} for tone '{tone}': {adjusted_score/multiplier:.1f} → {adjusted_score:.1f}")
    
    # Ensure score stays within 0-100 range
    adjusted_score = max(0, min(100, adjusted_score))
    
    logger.info(f"[Proxy-Lite] Final score adjustment: {original_score} → {int(round(adjusted_score))} (context={context}, audience={target_audience}, tone={tone})")
    
    return int(round(adjusted_score))


def build_judge_prompt(paragraph: str, locale: str = "tr", context: Optional[str] = None, target_audience: Optional[str] = None) -> str:
    """Build the judge prompt for paragraph analysis"""
    
    # Context mapping
    context_map = {
        "social_media": "Sosyal Medya",
        "corporate_professional": "Kurumsal / Profesyonel",
        "legal_official": "Hukuki / Resmî",
        "educational_informative": "Eğitici / Bilgilendirici",
        "personal_blog": "Kişisel Blog / Günlük"
    }
    
    # Target audience mapping
    audience_map = {
        "general_public": "Genel Halk",
        "clients_consultants": "Müşteriler / Danışanlar",
        "students": "Öğrenciler",
        "children_youth": "Çocuklar / Gençler",
        "colleagues": "Meslektaşlar",
        "regulators_public": "Regülatörler / Kamu"
    }
    
    context_info = ""
    if context and context in context_map:
        context_info = f"\n\nYAYIN AMACI: {context_map[context]}"
        if context == "legal_official":
            context_info += "\n- Hukuki içeriklerde daha sıkı standartlar uygula"
        elif context == "educational_informative":
            context_info += "\n- Eğitici içeriklerde doğruluk ve tarafsızlık kritik"
        elif context == "social_media":
            context_info += "\n- Sosyal medya içeriklerinde etkileşim ve erişim dikkate alınmalı"
    
    audience_info = ""
    if target_audience and target_audience in audience_map:
        audience_info = f"\n\nHEDEF KİTLE: {audience_map[target_audience]}"
        if target_audience == "children_youth":
            audience_info += "\n- Çocuklar/Gençlere yönelik içeriklerde risk katsayısı YÜKSEK (daha sıkı kontrol)"
        elif target_audience == "regulators_public":
            audience_info += "\n- Regülatörler/Kamu için içeriklerde yasal uyumluluk kritik"
        elif target_audience == "clients_consultants":
            audience_info += "\n- Müşteriler/Danışanlar için profesyonel standartlar önemli"
    
    if locale == "tr":
        return f"""Sen EZA adlı bir etik ve güvenlik analiz motorusun. Görevin, verilen Türkçe metni etik, güvenlik ve yanıltıcılık açısından değerlendirmek ve 0-100 arasında bir 'ethic_score' üretmektir. 0 etik açıdan çok sorunlu, 100 ise etik açıdan çok güvenli demektir.{context_info}{audience_info}

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

5. EK SKORLAR:
   - neutrality_score (0-100): Metnin tarafsızlık seviyesi. Yüksek skor = tarafsız, düşük skor = taraflı/yönlendirici
   - writing_quality_score (0-100): Yazım kalitesi, dilbilgisi, akıcılık. Yüksek skor = kaliteli yazım
   - platform_fit_score (0-100): Platform uygunluğu (TikTok/Instagram/YouTube/Blog/LinkedIn). Yüksek skor = platforma uygun

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
  "neutrality_score": number,
  "writing_quality_score": number,
  "platform_fit_score": number,
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
        # English context/audience mappings
        context_map_en = {
            "social_media": "Social Media",
            "corporate_professional": "Corporate / Professional",
            "legal_official": "Legal / Official",
            "educational_informative": "Educational / Informative",
            "personal_blog": "Personal Blog / Diary"
        }
        
        audience_map_en = {
            "general_public": "General Public",
            "clients_consultants": "Clients / Consultants",
            "students": "Students",
            "children_youth": "Children / Youth",
            "colleagues": "Colleagues",
            "regulators_public": "Regulators / Public"
        }
        
        context_info_en = ""
        if context and context in context_map_en:
            context_info_en = f"\n\nPUBLICATION CONTEXT: {context_map_en[context]}"
            if context == "legal_official":
                context_info_en += "\n- Apply stricter standards for legal content"
            elif context == "educational_informative":
                context_info_en += "\n- Accuracy and neutrality are critical in educational content"
            elif context == "social_media":
                context_info_en += "\n- Consider engagement and reach in social media content"
        
        audience_info_en = ""
        if target_audience and target_audience in audience_map_en:
            audience_info_en = f"\n\nTARGET AUDIENCE: {audience_map_en[target_audience]}"
            if target_audience == "children_youth":
                audience_info_en += "\n- Content for Children/Youth requires HIGHER risk coefficient (stricter control)"
            elif target_audience == "regulators_public":
                audience_info_en += "\n- Legal compliance is critical for Regulators/Public content"
            elif target_audience == "clients_consultants":
                audience_info_en += "\n- Professional standards are important for Clients/Consultants"
        
        return f"""You are EZA, an ethical and security analysis engine. Your task is to evaluate the given text for ethical, security, and misleading content, and produce an 'ethic_score' between 0-100. 0 means very problematic ethically, 100 means very safe ethically.{context_info_en}{audience_info_en}

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

5. ADDITIONAL SCORES:
   - neutrality_score (0-100): Level of neutrality in the text. High score = neutral, low score = biased/directive
   - writing_quality_score (0-100): Writing quality, grammar, fluency. High score = quality writing
   - platform_fit_score (0-100): Platform suitability (TikTok/Instagram/YouTube/Blog/LinkedIn). High score = platform-appropriate

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
  "neutrality_score": number,
  "writing_quality_score": number,
  "platform_fit_score": number,
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
    settings,
    platform: Optional[str] = None
) -> ParagraphAnalysisResponse:
    """Analyze a single paragraph using the judge prompt"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        prompt = build_judge_prompt(paragraph, locale, context, target_audience)
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
            neutrality_score = int(data.get("neutrality_score", 50))
            writing_quality_score = int(data.get("writing_quality_score", 50))
            platform_fit_score = int(data.get("platform_fit_score", 50))
            risk_tags = data.get("risk_tags", [])
            
            logger.debug(f"[Proxy-Lite] Parsed response: score={ethical_score}, neutrality={neutrality_score}, writing={writing_quality_score}, platform={platform_fit_score}, tags={risk_tags}")
            
            return ParagraphAnalysisResponse(
                original=paragraph,
                score=ethical_score,
                issues=risk_tags,
                rewrite=None,  # Will be filled by rewrite endpoint if requested
                neutrality_score=neutrality_score,
                writing_quality_score=writing_quality_score,
                platform_fit_score=platform_fit_score
            )
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error(f"[Proxy-Lite] JSON parse error: {str(e)}, response_text={response_text[:200]}")
            # Fallback: use basic analysis
            return ParagraphAnalysisResponse(
                original=paragraph,
                score=50,
                issues=["analiz_hatası"],
                rewrite=None,
                neutrality_score=50,
                writing_quality_score=50,
                platform_fit_score=50
            )
    except Exception as e:
        logger.error(f"[Proxy-Lite] Error in analyze_paragraph: {str(e)}", exc_info=True)
        # Fallback: use basic analysis
        return ParagraphAnalysisResponse(
            original=paragraph,
            score=50,
            issues=["llm_hatası"],
            rewrite=None,
            neutrality_score=50,
            writing_quality_score=50,
            platform_fit_score=50
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
                    para, request.locale, request.provider or "openai", settings, request.context, request.target_audience
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
                    rewrite=None,
                    neutrality_score=50,
                    writing_quality_score=50,
                    platform_fit_score=50
                ))
        
        # Calculate simple average for overall scores
        if paragraph_analyses:
            overall_score = sum(p.score for p in paragraph_analyses) / len(paragraph_analyses)
            overall_score = int(round(overall_score))
            overall_neutrality = sum(p.neutrality_score or 50 for p in paragraph_analyses) / len(paragraph_analyses)
            overall_neutrality = int(round(overall_neutrality))
            overall_writing = sum(p.writing_quality_score or 50 for p in paragraph_analyses) / len(paragraph_analyses)
            overall_writing = int(round(overall_writing))
            overall_platform = sum(p.platform_fit_score or 50 for p in paragraph_analyses) / len(paragraph_analyses)
            overall_platform = int(round(overall_platform))
        else:
            overall_score = 50
            overall_neutrality = 50
            overall_writing = 50
            overall_platform = 50
        
        # Apply context, target audience, and tone adjustments to ethical score
        # These adjustments make the scoring stricter based on context, audience, and tone
        adjusted_score = apply_context_audience_adjustments(
            overall_score,
            request.context,
            request.target_audience,
            request.tone
        )
        
        overall_ethics_level = get_risk_level(adjusted_score)
        
        # Collect all unique issues (no duplicates)
        all_issues = []
        for p in paragraph_analyses:
            all_issues.extend(p.issues)
        unique_issues = list(dict.fromkeys(all_issues))  # Preserve order, remove duplicates
        
        logger.info(f"[Proxy-Lite] Analysis complete: base_score={overall_score}, adjusted_score={adjusted_score}, ethics_level={overall_ethics_level}, unique_issues={len(unique_issues)}")
        
        return AnalyzeResponse(
            ethics_score=adjusted_score,
            ethics_level=overall_ethics_level,
            neutrality_score=overall_neutrality,
            writing_quality_score=overall_writing,
            platform_fit_score=overall_platform,
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
