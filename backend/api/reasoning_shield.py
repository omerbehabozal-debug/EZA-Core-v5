# -*- coding: utf-8 -*-
"""
reasoning_shield.py – EZA-Core v4.0

ReasoningShield v5.0: Central ethical decision layer.
Combines input analysis, output analysis, intent engine, and narrative engine
results to produce a final security/alignment score.

Also includes analyze_reasoning_patterns function for pattern-based reasoning detection.
"""

from typing import Dict, Any, List, Optional
import re

# Pattern dictionaries for reasoning analysis
HIDDEN_INTENT = [
    "fark ettirmeden", "çaktırmadan", "belli etmeden",
    "anlamadan", "hissettirmeden", "ikna etmek", "etkilemek",
    "istediğim gibi yönlendirmek", "kandırmak", "inandırmak",
    "gizlice", "haberi olmadan", "izinsiz", "habersizce", "fark ettirmeden", "gizli", "sessizce",
]

COERCION = [
    "zorlamak", "mecbur bıraktım", "tehdit",
    "ısrarla", "pes ettirmek", "baskı yapmak",
    "zorunda bırakmak", "mecbur etmek", "zorla", "baskı kurmak", "tehdit etmek", "korkutmak",
]

FICTIONAL = [
    "diyelim ki", "farz edelim", "varsayalım",
    "hayali olarak", "kurgu", "rol yaparak",
    "sanki", "gibi düşünelim", "bir senaryo", "bir hikaye", "bir oyun",
]


def analyze_reasoning_patterns(text: str) -> Dict[str, Any]:
    """
    EZA-ReasoningShield v5.0: Analyze reasoning patterns in text.
    
    Detects:
    - Hidden intent / manipulation
    - Psychological coercion
    - Fictional scenarios
    
    Args:
        text: Text to analyze
        
    Returns:
        {
            "red_flags": List[str],
            "psychology_hits": List[str],
            "fiction_risk": float,
            "manipulation_level": float,
            "coercion_level": float,
            "reasoning_score": float,
            "summary": str
        }
    """
    t = text.lower()
    red_flags: List[str] = []
    psychology_hits: List[str] = []

    # Hidden Intent / Manipulation
    manip_hits = [w for w in HIDDEN_INTENT if w in t]
    manip_score = len(manip_hits) * 0.25
    if manip_hits:
        red_flags.append("reasoning-manipulation")
        psychology_hits.extend(manip_hits)

    # Coercion
    coercion_hits = [w for w in COERCION if w in t]
    coercion_score = len(coercion_hits) * 0.30
    if coercion_hits:
        red_flags.append("psychological-coercion")
        psychology_hits.extend(coercion_hits)

    # Fictional Risk
    fiction_hits = [w for w in FICTIONAL if w in t]
    fiction_risk = len(fiction_hits) * 0.20
    if fiction_hits:
        red_flags.append("fiction-risk")

    reasoning_score = max(manip_score, coercion_score, fiction_risk)
    reasoning_score = min(reasoning_score, 1.0)  # Cap at 1.0

    summary = f"ReasoningShield v5.0: Manipulation detected ({len(manip_hits)} hits), Coercion detected ({len(coercion_hits)} hits), Fictional risk detected ({len(fiction_hits)} hits)."
    if not red_flags:
        summary = "ReasoningShield v5.0: No significant reasoning risks detected."

    return {
        "red_flags": list(set(red_flags)),  # Unique flags
        "psychology_hits": list(set(psychology_hits)),
        "fiction_risk": round(fiction_risk, 4),
        "manipulation_level": round(manip_score, 4),
        "coercion_level": round(coercion_score, 4),
        "reasoning_score": round(reasoning_score, 4),
        "summary": summary,
    }


class ReasoningShield:
    """
    EZA-ReasoningShield v5.0
    
    Merkezi etik karar katmanı.
    
    Input analizi, output analizi, intent engine ve narrative engine
    sonuçlarını birleştirerek nihai güvenlik seviyesini üretir.
    
    Also provides reasoning analysis for:
    - Sahte senaryolar (deception)
    - Gizli / hileli ikna (unfair-persuasion)
    - Psikolojik baskı (coercion)
    - Hukuki riskler (legal-risk)
    """

    def __init__(self) -> None:
        """Initialize ReasoningShield with detection patterns."""
        # 1) Yalan / sahte senaryo tetikleyicileri
        self.deception_keywords = [
            "yalan söyle", "yalan soyle", "yalan at",
            "uydur", "iftira", "iftira at",
            "gerçek değilmiş gibi", "gercek degilmis gibi",
            "sanki öyleymiş gibi göster", "sanki oyleymis gibi goster",
            "yanlış bilgi ver", "yanlis bilgi ver",
            "sahte belge", "sahte kanıt", "sahte kanit"
        ]

        # 2) Hileli ikna / adil olmayan yönlendirme
        self.unfair_persuasion_keywords = [
            "ne olursa olsun ikna et", "her ne pahasına olursa olsun",
            "her ne pahasina olursa olsun",
            "mantıklı gelmese bile ikna et", "mantikli gelmese bile ikna et",
            "beynini yıka", "beynini yika",
            "fark etmeden fikrini değiştir", "fark etmeden fikrini degistir",
            "anlamadan fikrini değiştir", "anlamadan fikrini degistir",
            "onu kendi çıkarıma göre yönlendir", "cikarima gore yonlendir",
        ]

        # 3) Psikolojik baskı / zorlama
        self.coercion_keywords = [
            "psikolojik baskı", "psikolojik baski",
            "baskı yap", "baski yap",
            "zorla kabul ettir", "zorla imzalat",
            "tehdit et", "gözdağı ver", "gozdagi ver",
            "korkut", "tırstır", "tirstir",
            "utanmasını sağla", "utanmasini sagla",
            "rezil et", "insan içinde küçük düşür",
            "insan icinde kucuk dusur",
        ]

        # 4) Hukuki risk işaretleri
        self.legal_risk_keywords = [
            "suç olur mu", "suc olur mu",
            "ceza alır mıyım", "ceza alir miyim",
            "yasadışı ama", "yasadisi ama",
            "mahkemelik olur muyum", "dava açılır mı", "dava acilir mi",
            "hukuken sorun olur mu", "kanunen sorun olur mu",
        ]

    def _find_hits(self, text_lower: str, patterns: list) -> list:
        """Find pattern hits in text."""
        hits = []
        for p in patterns:
            if p in text_lower:
                hits.append(p)
        return hits

    def analyze(
        self,
        text: str,
        intent_analysis: Optional[Dict[str, Any]] = None,
        narrative: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        EZA-ReasoningShield v5.0: Analyze reasoning patterns.
        
        ReasoningShield, mümkünse intent_analysis ve narrative sonuçlarını da
        kullanarak nihai risk skorunu ayarlar, ancak bağımsız da çalışabilir.
        
        Args:
            text: Text to analyze
            intent_analysis: Intent engine results (optional)
            narrative: Narrative engine results (optional)
            
        Returns:
            {
                "ok": True,
                "risk_flags": List[str],
                "risk_score": float,
                "risk_level": str,
                "hits": Dict[str, List[str]],
                "context_inputs": Dict[str, float],
                "summary": str
            }
        """
        text_lower = text.lower()

        hits_deception = self._find_hits(text_lower, self.deception_keywords)
        hits_unfair = self._find_hits(text_lower, self.unfair_persuasion_keywords)
        hits_coercion = self._find_hits(text_lower, self.coercion_keywords)
        hits_legal = self._find_hits(text_lower, self.legal_risk_keywords)

        flags = []
        if hits_deception:
            flags.append("deception")
        if hits_unfair:
            flags.append("unfair-persuasion")
        if hits_coercion:
            flags.append("coercion")
        if hits_legal:
            flags.append("legal-risk")

        # Temel skor: kaç kategori tetiklendiğine göre
        base_score = len(flags) * 0.2  # max 0.8

        # Kombinasyon bonusları (manipülatif + gizli, baskı + hukuki risk, vb.)
        combo_bonus = 0.0
        if "deception" in flags and "unfair-persuasion" in flags:
            combo_bonus += 0.15
        if "coercion" in flags and "legal-risk" in flags:
            combo_bonus += 0.15

        # IntentEngine & NarrativeEngine ile ek ayarlama
        intent_risk = 0.0
        if intent_analysis and isinstance(intent_analysis, dict):
            intent_risk = float(intent_analysis.get("risk_score", 0.0))

        narrative_risk = 0.0
        if narrative and isinstance(narrative, dict):
            narrative_risk = float(narrative.get("risk_score", 0.0))

        # Nihai skor:
        # - ReasoningShield baz skoru
        # - Intent/Narrative'ten gelen ortalama etkisi (zayıf ağırlıkla)
        fused_context = (intent_risk + narrative_risk) / 2 if (intent_risk or narrative_risk) else 0.0
        fused_context *= 0.3  # ReasoningShield'e göre ikincil ağırlık

        raw_score = base_score + combo_bonus + fused_context
        risk_score = max(0.0, min(1.0, raw_score))

        if risk_score >= 0.85:
            risk_level = "critical"
        elif risk_score >= 0.6:
            risk_level = "high"
        elif risk_score >= 0.3:
            risk_level = "medium"
        else:
            risk_level = "low"

        return {
            "ok": True,
            "risk_flags": flags,
            "risk_score": round(risk_score, 4),
            "risk_level": risk_level,
            "hits": {
                "deception": hits_deception,
                "unfair_persuasion": hits_unfair,
                "coercion": hits_coercion,
                "legal_risk": hits_legal,
            },
            "context_inputs": {
                "intent_risk": round(intent_risk, 4),
                "narrative_risk": round(narrative_risk, 4),
            },
            "summary": "ReasoningShield v5.0 reasoning and legal-psychological risk analysis complete.",
        }

    def evaluate(
        self,
        input_analysis: Dict[str, Any],
        output_analysis: Dict[str, Any],
        intent_engine: Dict[str, Any] = None,
        narrative_info: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate overall ethical alignment and security score.
        
        Args:
            input_analysis: Input analysis results
            output_analysis: Output analysis results
            intent_engine: Intent engine results (optional)
            narrative_info: Narrative engine results (optional)
            
        Returns:
            {
                "ok": True,
                "level": "safe" | "caution" | "critical",
                "alignment_score": 0-100,
                "issues": List[str],
                "meta": {...}
            }
        """
        issues: List[str] = []
        score = 100  # 0–100 arası güvenlik puanı (yüksek = daha güvenli)

        # 1) Temel risk bayraklarını topla
        input_flags = input_analysis.get("risk_flags", []) or []
        output_flags = output_analysis.get("risk_flags", []) or []
        safety_issues_in = input_analysis.get("safety_issues", []) or []
        safety_issues_out = output_analysis.get("analysis", {}).get("safety_issues", []) or []

        all_flags = set(input_flags + output_flags + safety_issues_in + safety_issues_out)

        # 2) IntentEngine bilgisi
        intent_primary = None
        intent_risk = 0.0
        if intent_engine:
            intent_primary = intent_engine.get("primary")
            intent_risk = float(intent_engine.get("risk_score", 0))

        # 3) NarrativeEngine bilgisi
        narrative_risk = 0.0
        narrative_patterns = []
        if narrative_info:
            narrative_risk = float(narrative_info.get("narrative_score", 0))
            narrative_patterns = narrative_info.get("patterns", []) or []

        # 4) Kritik kategoriler
        critical_types = {"illegal", "violence", "self-harm", "manipulation"}
        toxic_types = {"toxicity"}

        # 5) Kritik risk var mı?
        has_critical = any(flag in critical_types for flag in all_flags) or intent_risk >= 0.85
        has_toxic = any(flag in toxic_types for flag in all_flags)
        has_narrative_risk = narrative_risk >= 0.75 or "escalation" in narrative_patterns

        # 6) Hallucination / kalite sinyalleri (ileride genişletilebilir)
        quality_score = output_analysis.get("analysis", {}).get("quality_score", 70)
        hallucination_flags = output_analysis.get("analysis", {}).get("hallucination_flags", []) or []
        if hallucination_flags:
            issues.append("hallucination")
            score -= 15

        # 7) Skor ve seviye kural seti
        if has_critical or "self-harm" in all_flags:
            # En sert durum
            issues.extend(list(all_flags))
            score = 0
            level = "critical"
        elif has_toxic or has_narrative_risk:
            issues.extend(list(all_flags))
            if narrative_patterns:
                issues.extend([f"narrative:{p}" for p in narrative_patterns])
            score = max(10, 50 - int(narrative_risk * 30))
            level = "caution"
        else:
            # Güvenli
            if quality_score < 60:
                issues.append("low-quality")
                score = 70
                level = "safe"
            else:
                score = 100
                level = "safe"

        # 8) Tekrarlayanları temizle
        issues = sorted(list(set(issues)))

        return {
            "ok": True,
            "level": level,  # "safe" | "caution" | "critical"
            "alignment_score": score,  # 0–100
            "issues": issues,
            "meta": {
                "intent_primary": intent_primary,
                "intent_risk": intent_risk,
                "narrative_risk": narrative_risk,
                "narrative_patterns": narrative_patterns,
                "all_flags": list(all_flags),
            },
        }
