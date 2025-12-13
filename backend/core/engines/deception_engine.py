# -*- coding: utf-8 -*-
"""
Deception Engine (Deep)
Detects deception and manipulation patterns
"""

from typing import Dict, Any, List
import re
import string


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
    
    # Semantic phrase bucket for disguised harmful intent
    DISGUISED_HARMFUL_PHRASES = [
        "just asking",
        "just curious",
        "just wondering",
        "i'm curious",
        "i'm a journalist",
        "i'm a researcher",
        "for educational purposes",
        "for a story",
        "for documentation",
        "hypothetically",
        "hypothetical",
        "this is hypothetical",
        "testing security",
        "studying security",
        "how to exploit",
        "how to break",
        "how to bypass",
        "how to create scams"
    ]
    
    # Harmful keywords and illegal topics
    HARMFUL_KEYWORDS = [
        "hack", "steal", "drugs", "weapons", "fraud", "scam", "malware",
        "bypass", "exploit", "break", "harm", "harm someone", "violence", "theft",
        "identity theft", "private data", "unauthorized", "illegal", "crimes"
    ]
    
    # Illegal activity patterns
    ILLEGAL_ACTIVITY_PATTERNS = [
        r"\b(make\s+drugs|make\s+weapons|how\s+to\s+make\s+weapons|commit\s+fraud|commit\s+crimes|how\s+to\s+commit\s+crimes|steal|steal\s+identities|identity\s+theft|commit\s+identity\s+theft|hack|harm\s+someone|how\s+to\s+harm|create\s+malware|create\s+scams|how\s+to\s+create\s+scams|bypass|bypass\s+it|bypass\s+security|access\s+private\s+data|how\s+to\s+access\s+private\s+data|how\s+to\s+exploit|how\s+to\s+break)\b"
    ]
    
    # Preprocess text: lowercase and strip punctuation
    text_clean = text.lower().translate(str.maketrans('', '', string.punctuation))
    text_lower = text.lower()
    
    # Check if any disguised harmful phrase is found
    found_disguised_phrase = False
    matched_phrases = []
    
    for phrase in DISGUISED_HARMFUL_PHRASES:
        # Check both in clean text (no punctuation) and original text
        phrase_clean = phrase.lower().translate(str.maketrans('', '', string.punctuation))
        phrase_lower = phrase.lower()
        
        # Check if phrase appears in text (substring match)
        if phrase_clean in text_clean or phrase_lower in text_lower:
            found_disguised_phrase = True
            matched_phrases.append(phrase)
            continue
        
        # Also check for phrase as word boundary match (more flexible)
        # Replace spaces with \s+ for flexible matching
        phrase_pattern = r'\b' + re.escape(phrase_lower).replace(r'\ ', r'\s+') + r'\b'
        if re.search(phrase_pattern, text_lower, re.IGNORECASE):
            found_disguised_phrase = True
            matched_phrases.append(phrase)
    
    # Check for risk intent, harmful keywords, or illegal topics
    has_risk_intent = False
    has_harmful_keywords = False
    has_illegal_topic = False
    
    # Get input analysis from report
    input_analysis = report.get("input", {}).get("analysis", {})
    input_risk = input_analysis.get("risk_score", 0.0)
    input_risk_flags = input_analysis.get("risk_flags", [])
    
    # Check for risk intent (from input analysis)
    if input_risk > 0.3 or len(input_risk_flags) > 0:
        has_risk_intent = True
    
    # Check for harmful keywords
    for keyword in HARMFUL_KEYWORDS:
        if keyword in text_lower:
            has_harmful_keywords = True
            break
    
    # Check for illegal activity patterns
    for pattern in ILLEGAL_ACTIVITY_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            has_illegal_topic = True
            break
    
    # Deception = True if ANY phrase in bucket is found AND (risk intent, harmful keywords, or illegal topic detected)
    if found_disguised_phrase and (has_risk_intent or has_harmful_keywords or has_illegal_topic):
        # Increase deception score (min +1.0)
        score += 1.0
        flags.append("disguised_harmful_intent")
        flags.extend([f"phrase_{p.replace(' ', '_')}" for p in matched_phrases])
        
        # Additional score for multiple indicators
        if has_risk_intent:
            score += 0.3
            flags.append("risk_intent_detected")
        if has_harmful_keywords:
            score += 0.3
            flags.append("harmful_keywords_detected")
        if has_illegal_topic:
            score += 0.4
            flags.append("illegal_topic_detected")
    
    # Keep existing pattern-based detection for backward compatibility
    deception_patterns = {
        "false_urgency": r"\b(urgent|immediately|now|limited.time|acil|hemen|şimdi)\b",
        "authority_claim": r"\b(official|government|verified|certified|resmi|hükümet|doğrulanmış)\b",
        "emotional_manipulation": r"\b(you.must|you.should|everyone.is|yapmalısın|herkes)\b",
        "withholding_info": r"\b(secret|confidential|don't.tell|gizli|söyleme)\b",
        "reverse_questioning": r"\b(tersinden|reverse|opposite|ters)\b",
        "innocent_masking": r"\b(masum|innocent|just.for.education|sadece.eğitim|for.research|araştırma.için|kötü.bir.şey.yapmayacağım|won't.do.anything.bad)\b",
        "indirect_intent": r"\b(dolaylı|indirect|implicit|dolaylı.olarak|implicitly)\b",
        "education_excuse": r"\b(just.for.education|for.research|educational|eğitim.için|araştırma|academic|school.project|okul.projesi)\b",
        "reassurance": r"\b(kötü.bir.şey.yapmayacağım|won't.harm|just.curious|i'm.curious|i'm\s+curious|just.wondering|just.asking|sadece.merak|harmless|zararsız)\b",
        "negative_disclaimer": r"\b(not.asking|not.illegal|not.doing|nothing.illegal|not.wanting|sormuyorum|yasal.değil.değil)\b",
        "theoretical_framing": r"\b(theoretically|hypothetically|in.theory|completely.hypothetical|this.is.hypothetical|this.is.theoretical|teorik.olarak|varsayımsal.olarak|tamamen.varsayımsal|bu.varsayımsal)\b",
        "third_person_framing": r"\b(how.someone|how.they|how.people|someone.might|they.might|birisi.nasıl|onlar.nasıl)\b",
        "researcher_mask": r"\b(researcher|researching|studying|i'm.a.researcher|i'm.studying|studying.security|studying\s+security|i'm\s+a\s+journalist|i'm\s+journalist|journalist|araştırmacı|araştırıyorum|çalışıyorum)\b",
        "creative_excuse": r"\b(writing.a.book|writing.a.novel|for.a.story|kitap.yazıyorum|roman.yazıyorum|hikaye.için)\b",
        "friend_excuse": r"\b(friend.asked|my.friend|arkadaşım.istedi|arkadaşım.sordu)\b"
    }
    
    for pattern_name, pattern in deception_patterns.items():
        matches = len(re.findall(pattern, text_lower, re.IGNORECASE))
        if matches > 0:
            if pattern_name not in flags:
                flags.append(pattern_name)
            # Lower weight for pattern-based detection (to prioritize semantic bucket)
            score += matches * 0.2
    
    # If input has risk flags but text contains masking patterns, increase deception score
    if input_risk > 0.3 and len(input_risk_flags) > 0:
        masking_indicators = [
            r"\b(not|don't|won't|never)\b.*\b(illegal|harm|bad|wrong|dangerous)\b",
            r"\b(just|only|simply)\b.*\b(curious|wondering|asking|learning)\b",
            r"\b(for|because.of)\b.*\b(education|research|study|learning|academic)\b",
            r"\b(tell.me|how.to)\b.*\b(make.drugs|commit.fraud|hack|steal)\b"
        ]
        for pattern in masking_indicators:
            if re.search(pattern, text_lower, re.IGNORECASE):
                score += 0.4
                if "risk_masking" not in flags:
                    flags.append("risk_masking")
                break
    
    score = min(score, 1.0)
    
    return {
        "ok": True,
        "score": score,
        "level": "high" if score > 0.7 else "medium" if score > 0.4 else "low",
        "flags": flags,
        "summary": f"Deception patterns detected: {', '.join(flags)}" if flags else "No significant deception patterns detected"
    }
