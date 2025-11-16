# -*- coding: utf-8 -*-
"""
alignment/ethical_alignment.py – EZA-Core v10

Ethical Alignment Engine: Determine alignment level and generate ethical responses.
"""

from typing import Dict, Any
from .advisor import generate_advice


# Alignment levels
ALIGNMENT_LEVELS = {
    "safe": "Safe",
    "caution": "Caution",
    "unsafe": "Unsafe",
    "critical": "Critical",
}


def determine_alignment_level(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any]
) -> str:
    """
    Determine alignment level based on input and output analysis.
    
    Args:
        input_analysis: Input analysis result
        output_analysis: Output analysis result
        
    Returns:
        Alignment level: "safe" | "caution" | "unsafe" | "critical"
    """
    input_risk = input_analysis.get("risk_score", 0.0)
    output_risk = output_analysis.get("output_risk", 0.0)
    
    # Use maximum risk
    max_risk = max(input_risk, output_risk)
    
    if max_risk >= 0.9:
        return "critical"
    elif max_risk >= 0.7:
        return "unsafe"
    elif max_risk >= 0.4:
        return "caution"
    else:
        return "safe"


def generate_ethical_explanation(
    alignment_level: str,
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any]
) -> str:
    """
    Generate ethical explanation based on alignment level.
    
    Args:
        alignment_level: Alignment level
        input_analysis: Input analysis result
        output_analysis: Output analysis result
        
    Returns:
        Ethical explanation text
    """
    if alignment_level == "critical":
        return (
            "Bu içerik kritik risk seviyesinde zararlı veya yasa dışı faaliyetler içerebilir. "
            "EZA bu tür taleplere destek vermez. Güvenli ve yasal yollarla ilerlemek en doğrusudur."
        )
    elif alignment_level == "unsafe":
        return (
            "Bu içerik yüksek risk seviyesinde zararlı davranışlar içerebilir. "
            "EZA, güvenli ve etik şekilde yönlendirme yapmayı tercih eder."
        )
    elif alignment_level == "caution":
        return (
            "Bu içerikte orta seviyede riskli ifadeler olabilir. "
            "Daha saygılı ve yapıcı bir iletişim dili benimsemek önerilir."
        )
    else:
        return (
            "Bu içerik genel olarak güvenli görünüyor. "
            "Yine de çevrimiçi ortamlarda dikkatli olmanız önemlidir."
        )


def generate_reinforced_answer(
    original_output: str,
    alignment_level: str,
    input_analysis: Dict[str, Any]
) -> str:
    """
    Generate ethically reinforced answer.
    
    Args:
        original_output: Original model output
        alignment_level: Alignment level
        input_analysis: Input analysis result
        
    Returns:
        Reinforced ethical answer
    """
    if alignment_level == "critical":
        return (
            "Bu isteğe doğrudan yardım edemem çünkü yüksek riskli veya zararlı bir içerik barındırıyor olabilir. "
            "Sorunları yasal, güvenli ve başkalarına zarar vermeyecek yollarla çözmek en doğrusudur."
        )
    elif alignment_level == "unsafe":
        return (
            "Bu isteğe doğrudan teknik destek veremem çünkü etik ve güvenlik açısından riskler içeriyor olabilir. "
            "Buna rağmen, daha sağlıklı ve güvenli alternatif yollar düşünmek her zaman mümkündür."
        )
    elif alignment_level == "caution":
        return (
            f"{original_output}\n\n"
            "— Bu cevap, daha saygılı ve yapıcı bir iletişim dili benimsemek amacıyla "
            "etik ilkeler gözetilerek değerlendirilmiştir."
        )
    else:
        return (
            f"{original_output}\n"
            "— Bu cevap, kullanıcı güvenliği ve saygılı iletişim ilkeleri gözetilerek değerlendirilmiştir."
        )


def align_response(
    input_text: str,
    output_text: str,
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Main alignment function.
    
    Args:
        input_text: Original input text
        output_text: Model output text
        input_analysis: Input analysis result
        output_analysis: Output analysis result
        
    Returns:
        Alignment result
    """
    # Determine alignment level
    alignment_level = determine_alignment_level(input_analysis, output_analysis)
    
    # Generate ethical explanation
    ethical_explanation = generate_ethical_explanation(
        alignment_level, input_analysis, output_analysis
    )
    
    # Generate reinforced answer
    reinforced_answer = generate_reinforced_answer(
        output_text, alignment_level, input_analysis
    )
    
    # Generate advice
    advice = generate_advice(input_analysis)
    
    return {
        "alignment_level": alignment_level,
        "alignment_label": ALIGNMENT_LEVELS.get(alignment_level, "Unknown"),
        "ethical_explanation": ethical_explanation,
        "reinforced_answer": reinforced_answer,
        "advice": advice,
        "input_risk_score": input_analysis.get("risk_score", 0.0),
        "output_risk_score": output_analysis.get("output_risk", 0.0),
    }

