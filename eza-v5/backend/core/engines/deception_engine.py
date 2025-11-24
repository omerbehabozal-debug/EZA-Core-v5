# -*- coding: utf-8 -*-
"""
Deception Engine (Deep)
Detects deception and manipulation patterns
"""

from typing import Dict, Any, List
import re


def analyze_deception(
    text: str,
    report: Dict[str, Any],
    memory: List[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Analyze deception and manipulation patterns
    Returns deception score and flags
    """
    flags = []
    score = 0.0
    
    # Deception patterns (English and Turkish)
    deception_patterns = {
        "false_urgency": r"\b(urgent|immediately|now|limited.time|acil|hemen|şimdi)\b",
        "authority_claim": r"\b(official|government|verified|certified|resmi|hükümet|doğrulanmış)\b",
        "emotional_manipulation": r"\b(you.must|you.should|everyone.is|yapmalısın|herkes)\b",
        "withholding_info": r"\b(secret|confidential|don't.tell|gizli|söyleme)\b",
        "reverse_questioning": r"\b(tersinden|reverse|opposite|ters)\b",
        "innocent_masking": r"\b(masum|innocent|just.for.education|sadece.eğitim|for.research|araştırma.için|kötü.bir.şey.yapmayacağım|won't.do.anything.bad)\b",
        "indirect_intent": r"\b(dolaylı|indirect|implicit|dolaylı.olarak|implicitly)\b",
        "education_excuse": r"\b(just.for.education|for.research|educational|eğitim.için|araştırma|academic|school.project|okul.projesi)\b",
        "reassurance": r"\b(kötü.bir.şey.yapmayacağım|won't.harm|just.curious|sadece.merak|harmless|zararsız)\b",
        "negative_disclaimer": r"\b(not.asking|not.illegal|not.doing|nothing.illegal|not.wanting|sormuyorum|yasal.değil.değil)\b",
        "theoretical_framing": r"\b(theoretically|hypothetically|in.theory|completely.hypothetical|teorik.olarak|varsayımsal.olarak|tamamen.varsayımsal)\b",
        "third_person_framing": r"\b(how.someone|how.they|how.people|someone.might|they.might|birisi.nasıl|onlar.nasıl)\b",
        "researcher_mask": r"\b(researcher|researching|studying|i'm.a.researcher|araştırmacı|araştırıyorum|çalışıyorum)\b",
        "creative_excuse": r"\b(writing.a.book|writing.a.novel|for.a.story|kitap.yazıyorum|roman.yazıyorum|hikaye.için)\b",
        "friend_excuse": r"\b(friend.asked|my.friend|arkadaşım.istedi|arkadaşım.sordu)\b"
    }
    
    text_lower = text.lower()
    
    for pattern_name, pattern in deception_patterns.items():
        matches = len(re.findall(pattern, text_lower, re.IGNORECASE))
        if matches > 0:
            flags.append(pattern_name)
            # Higher weight for specific deception patterns
            if pattern_name in ["reverse_questioning", "innocent_masking", "indirect_intent", "education_excuse", 
                              "reassurance", "negative_disclaimer", "theoretical_framing", "third_person_framing",
                              "researcher_mask", "creative_excuse", "friend_excuse"]:
                score += matches * 0.3  # Higher weight for these patterns
            else:
                score += matches * 0.2
    
    # Check if input has risk but user is trying to mask it (using report)
    input_analysis = report.get("input", {}).get("analysis", {})
    input_risk = input_analysis.get("risk_score", 0.0)
    input_risk_flags = input_analysis.get("risk_flags", [])
    
    # Check for specific deception patterns: researcher/education excuse + illegal activity
    researcher_excuse_patterns = [
        r"\b(i'm.a.researcher|i'm.researching|researcher.*tell.me|studying.*how.to)\b",
        r"\b(for.education|for.research|educational.purposes|research.purposes)\b"
    ]
    illegal_activity_patterns = [
        r"\b(make.drugs|commit.fraud|steal|hack|harm.someone|create.malware)\b"
    ]
    
    has_researcher_excuse = any(re.search(pattern, text_lower, re.IGNORECASE) for pattern in researcher_excuse_patterns)
    has_illegal_activity = any(re.search(pattern, text_lower, re.IGNORECASE) for pattern in illegal_activity_patterns)
    
    if has_researcher_excuse and has_illegal_activity:
        score += 0.5  # High deception score for researcher excuse + illegal activity
        if "researcher_excuse_illegal" not in flags:
            flags.append("researcher_excuse_illegal")
    
    # If input has risk flags but text contains masking patterns, increase deception score
    if input_risk > 0.3 and len(input_risk_flags) > 0:
        # Check for masking patterns in text
        masking_indicators = [
            r"\b(not|don't|won't|never)\b.*\b(illegal|harm|bad|wrong|dangerous)\b",
            r"\b(just|only|simply)\b.*\b(curious|wondering|asking|learning)\b",
            r"\b(for|because.of)\b.*\b(education|research|study|learning|academic)\b",
            r"\b(tell.me|how.to)\b.*\b(make.drugs|commit.fraud|hack|steal)\b"
        ]
        for pattern in masking_indicators:
            if re.search(pattern, text_lower, re.IGNORECASE):
                score += 0.4  # Significant boost for risk + masking
                if "risk_masking" not in flags:
                    flags.append("risk_masking")
                break
    
    # Check consistency with memory
    if memory:
        # Simplified consistency check
        # In production, use more sophisticated NLP
        for mem_entry in memory[-3:]:
            if mem_entry.get("role") == "user":
                # Check for contradictions
                pass  # Placeholder
    
    score = min(score, 1.0)
    
    return {
        "ok": True,
        "score": score,
        "level": "high" if score > 0.7 else "medium" if score > 0.4 else "low",
        "flags": flags,
        "summary": f"Deception patterns detected: {', '.join(flags)}" if flags else "No significant deception patterns detected"
    }

