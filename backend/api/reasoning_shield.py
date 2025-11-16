# -*- coding: utf-8 -*-
"""
reasoning_shield.py – EZA-Core v4.0

ReasoningShield v5.0: Central ethical decision layer.
Combines input analysis, output analysis, intent engine, and narrative engine
results to produce a final security/alignment score.

Also includes analyze_reasoning_patterns function for pattern-based reasoning detection.
"""

from typing import Dict, Any, List

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
    Merkezi etik karar katmanı.
    
    Input analizi, output analizi, intent engine ve narrative engine
    sonuçlarını birleştirerek nihai güvenlik seviyesini üretir.
    """

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
