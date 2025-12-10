# -*- coding: utf-8 -*-
"""
Proxy-Lite Mode Router
Ethical analysis endpoint for individual users and SMEs
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
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


class ProxyLiteReportRequest(BaseModel):
    message: str
    output_text: str  # Pre-analyzed output


class ProxyLiteReportResponse(BaseModel):
    risk_level: str  # low, medium, high, critical
    risk_category: str
    violated_rule_count: int
    summary: str
    recommendation: str


# New analyze endpoint models
class AnalyzeRequest(BaseModel):
    text: str


class ParagraphAnalysis(BaseModel):
    index: int
    text: str
    ethical_score: int  # 0-100
    risk_label_tr: str  # "Düşük Risk" | "Orta Risk" | "Yüksek Risk"
    risk_tags_tr: List[str]
    needs_rewrite: bool
    improved_text_tr: str


class OverallAnalysis(BaseModel):
    ethical_score: int  # 0-100
    risk_label_tr: str  # "Düşük Risk" | "Orta Risk" | "Yüksek Risk"
    summary_tr: str


class AnalyzeResponse(BaseModel):
    overall: OverallAnalysis
    paragraphs: List[ParagraphAnalysis]


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_ethical_content(
    request: AnalyzeRequest,
    current_user = Depends(require_internal())
):
    """
    Proxy-Lite Ethical Analysis Endpoint
    Analyzes text for ethical issues and provides paragraph-by-paragraph suggestions
    """
    try:
        settings = get_settings()
        
        # Split text into paragraphs
        paragraphs = [p.strip() for p in request.text.split('\n\n') if p.strip()]
        if not paragraphs:
            paragraphs = [request.text]
        
        # Build comprehensive prompt for OpenAI
        prompt = f"""Sen EZA Proxy-Lite için çalışan bir etik analiz ve rehberlik motorusun.

HEDEFİN:
- Kullanıcının yazdığı metni etik, güvenlik ve regülasyon açısından analiz etmek,
- 0–100 arası bir "ETİK SKOR" üretmek (100 = çok güvenli, 0 = çok sorunlu),
- Metni PARAGRAF bazında inceleyip her paragraf için ayrı etik skor vermek,
- Riskli paragraflar için, aynı mesajı koruyan ama daha etik ve dengeli bir "Daha Etik Hâle Getirilmiş Öneri" üretmek,
- Tüm sonuçları, FRONTEND'in doğrudan kullanabileceği TÜRKÇE açıklamalarla birlikte, geçerli JSON formatında döndürmek.

METNİ ANALİZ ET:
{request.text}

PARAGRAFLAR (boş satırlara göre ayrılmış):
{chr(10).join([f"{i+1}. {p}" for i, p in enumerate(paragraphs)])}

KURALLAR – SKORLAMA:
- Etik skor 0 ile 100 arasında olmalıdır.
- Yüksek skor = güvenli, düşük skor = riskli.
- Skor aralıklarını şöyle kullan:
  - 80–100  → "Düşük Risk" (yeşil)
  - 50–79   → "Orta Risk"  (sarı)
  - 0–49    → "Yüksek Risk" (kırmızı)
- "overall.ethical_score" her zaman PARAGRAF skorlarıyla TUTARLI olmalıdır:
  - Önce tüm paragrafların etik skorlarını hesapla.
  - Genel etik skoru hesaplarken KORUMACI ol:
    - ÖNERİ: overall.ethical_score = paragraf skorlarının minimumu ile ortalamasının arasında, ama hiçbir zaman en riskli paragraftan daha yüksek olmasın.
    - Örnek: paragraf skorları [25, 33, 90] ise genel skor 25–40 bandında olmalı, asla 90 gibi yüksek bir değer verme.
  - Genel risk etiketi ("risk_label_tr") da bu genel skora göre belirlenir (aynı aralıklarla).

KURALLAR – ANALİZ:
Aşağıdaki risk türlerine özellikle dikkat et:
- Sağlık / zayıflama / tedavi iddiaları
- Aşırı kesin ifadeler ("kesin", "garanti", "herkeste işe yarar", "yanlış kullandın" gibi)
- Manipülatif dil, korku veya suçluluk duygusunu tetikleyen cümleler
- Hassas gruplara yönelik hedefleme (çocuklar, gençler, hasta kişiler vb.)
- Nefret söylemi, ayrımcılık
- Tehlikeli veya yasa dışı davranış teşviki
- Yanıltıcı ekonomik / finansal vaatler

"risk_tags_tr" alanında bunları KISA ve TÜRKÇE etiketler halinde yaz:
Örnekler:
- "sağlık iddiası"
- "aşırı kesin ifade"
- "yanıltıcı pazarlama"
- "hassas grup hedefleme"
- "riskli davranış teşviki"
Gerekirse yeni etiketler türetebilirsin ama daima TÜRKÇE ve kısa olmalı.

KURALLAR – PARAGRAF BAZLI DEĞERLENDİRME:
- Her paragrafı ayrı değerlendir:
  - Paragraf içinde riskli kısımlar olsa bile skor paragraf geneli için tek bir sayı.
  - Etik skor 80 ve üzerindeyse: "needs_rewrite": false ve "improved_text_tr": "" (boş string) bırak.
  - Etik skor 80'in ALTINDA ise: "needs_rewrite": true ve mutlaka "improved_text_tr" alanını doldur.

KURALLAR – YENİDEN YAZIM (improved_text_tr):
- "improved_text_tr" asla eksik, yarım veya "..." ile biten bir metin olmasın.
- Paragrafın TAMAMINI yeniden yaz:
  - Aynı ana mesajı koru (ürün, konu, teklif aynı kalsın),
  - Ama dili daha dengeli, etik, gerçekçi ve uyarıcı hale getir.
- Kesin, garantici ifadeleri yumuşat ve koşullara bağla:
  - "Kesin kilo verirsiniz" yerine
    "Birçok kişide işe yarasa da, herkes için aynı sonucu garanti etmek mümkün değildir" gibi.
- Asla "[Daha Etik Hâle Getirilmiş Öneri]" gibi başlıklar veya köşeli parantez kullanma.
  Sadece düz paragraf yaz.
- Kullanıcıya saldırma, onu suçlama; sakin, bilgilendirici ve sorumluluk sahibi bir ton kullan.
- Sağlık / hukuki / finansal konularda gerektiğinde doktora, uzmana, profesyonele danışma önerisi ekleyebilirsin.

KURALLAR – TUTARLILIK:
- "overall.ethical_score" ile paragraf skorları birbirini mantıksal olarak desteklemeli.
  Örneğin tüm paragraflar düşük skorluysa, genel skor yüksek çıkamaz.
- "overall.risk_label_tr" her zaman "overall.ethical_score" ile aynı aralık mantığına uymalı.
  Örneğin etik skor 48 ise "Yüksek Risk" diyebilirsin, "Düşük Risk" diyemezsin.

DİL:
- Tüm açıklamalar, özetler, risk etiketleri ve yeniden yazılmış paragraflar TÜRKÇE olmalıdır.

SADECE GEÇERLİ JSON DÖN, başka açıklama yapma, yorum yazma, Markdown kullanma. Format:

{{
  "overall": {{
    "ethical_score": number,
    "risk_label_tr": "Düşük Risk" | "Orta Risk" | "Yüksek Risk",
    "summary_tr": "kısa Türkçe özet, 1-2 cümle"
  }},
  "paragraphs": [
    {{
      "index": number,
      "text": string,
      "ethical_score": number,
      "risk_label_tr": "Düşük Risk" | "Orta Risk" | "Yüksek Risk",
      "risk_tags_tr": ["etiket1", "etiket2"],
      "needs_rewrite": boolean,
      "improved_text_tr": string
    }}
  ]
}}"""

        # Call OpenAI
        response_text = await call_llm_provider(
            provider_name="openai",
            prompt=prompt,
            settings=settings,
            model="gpt-4o-mini",
            temperature=0.3,
            max_tokens=4000
        )
        
        # Parse JSON response
        try:
            # Extract JSON from response (in case there's extra text)
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                response_json = json.loads(json_match.group())
            else:
                response_json = json.loads(response_text)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to parse AI response as JSON: {str(e)}"
            )
        
        # Validate and return response
        return AnalyzeResponse(**response_json)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing content: {str(e)}"
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

