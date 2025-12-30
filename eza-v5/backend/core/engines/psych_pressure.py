# -*- coding: utf-8 -*-
"""
Psychological Pressure Detector (Deep)
Detects psychological manipulation and pressure tactics
"""

from typing import Dict, Any, List
import re
import string


def analyze_psychological_pressure(
    text: str,
    memory: List[Dict[str, Any]] = None,
    deception_result: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Analyze psychological pressure and manipulation
    Returns pressure score and patterns
    
    Args:
        text: Input text to analyze
        memory: Optional memory context
        deception_result: Optional deception analysis result (for cross-check)
    """
    patterns = []
    score = 0.0
    
    # Semantic emotional-pressure bucket
    EMOTIONAL_PRESSURE_PHRASES = [
        "i'm counting on you",
        "don't let me down",
        "don't disappoint me",
        "i need you to",
        "you must tell me",
        "please, it's important",
        "this is really important",
        "this is really important to me",
        "i trusted you",
        "lütfen söyle",
        "please tell",
        "bu çok önemli",
        "this is very important",
        "çok önemli"
    ]
    
    # Harmful intent indicators
    HARMFUL_INTENT_KEYWORDS = [
        "hack", "steal", "drugs", "weapons", "fraud", "scam", "malware",
        "bypass", "exploit", "break", "harm", "violence", "theft",
        "illegal", "unauthorized", "private data"
    ]
    
    # Preprocess text: lowercase and strip punctuation
    text_clean = text.lower().translate(str.maketrans('', '', string.punctuation))
    text_lower = text.lower()
    
    # Check if any emotional pressure phrase is found
    found_pressure_phrase = False
    matched_phrases = []
    
    for phrase in EMOTIONAL_PRESSURE_PHRASES:
        # Check both in clean text (no punctuation) and original text
        phrase_clean = phrase.lower().translate(str.maketrans('', '', string.punctuation))
        phrase_lower = phrase.lower()
        
        # Also handle apostrophe variations
        phrase_variations = [
            phrase_lower,
            phrase_lower.replace("'", ""),
            phrase_lower.replace("'", "'"),
            phrase_clean
        ]
        
        found_variation = False
        for variation in phrase_variations:
            if variation in text_clean or variation in text_lower:
                found_variation = True
                break
        
        # Also check for phrase as word boundary match (more flexible)
        # Handle apostrophe in pattern
        phrase_pattern_str = phrase_lower.replace("'", "['']?")
        phrase_pattern = r'\b' + re.escape(phrase_pattern_str).replace(r'\ ', r'\s+') + r'\b'
        
        if found_variation or re.search(phrase_pattern, text_lower, re.IGNORECASE):
            found_pressure_phrase = True
            matched_phrases.append(phrase)
    
    # Check for harmful intent
    has_harmful_intent = False
    for keyword in HARMFUL_INTENT_KEYWORDS:
        if keyword in text_lower:
            has_harmful_intent = True
            break
    
    # Check if deception was detected
    has_deception = False
    if deception_result and deception_result.get("score", 0.0) > 0.3:
        has_deception = True
    
    # Pressure = True if phrase in bucket AND (harmful intent OR deception=True)
    # But also detect if phrase is found (even without harmful intent) - these phrases are inherently pressuring
    if found_pressure_phrase:
        if has_harmful_intent or has_deception:
            # Increase pressure score (min +1.0) when combined with harmful intent or deception
            score += 1.0
            patterns.append({
                "type": "emotional_pressure",
                "count": len(matched_phrases),
                "phrases": matched_phrases
            })
            
            # Additional score for multiple indicators
            if has_harmful_intent:
                score += 0.3
            if has_deception:
                score += 0.3
        else:
            # Still detect pressure but with lower score (to avoid false positives in harmless contexts)
            # These phrases are inherently pressuring even without explicit harmful intent
            score += 0.5
            patterns.append({
                "type": "emotional_pressure",
                "count": len(matched_phrases),
                "phrases": matched_phrases
            })
    
    # Keep existing pattern-based detection for backward compatibility
    pressure_patterns = {
        "guilt_trip": r"\b(you.owe|you.should.feel|disappointed|counting\s+on\s+you|i'm\s+counting\s+on\s+you|i\s+count\s+on\s+you|i'm\s+counting|counting\s+on|i'm\s+counting\s+on|borçlusun|hayal.kırıklığı)\b",
        "let_me_down": r"\b(let\s+me\s+down|don'?t\s+let\s+me\s+down|don'?t\s+let\s+me|dont\s+let\s+me\s+down)\b",
        "counting_on": r"\b(i'm\s+counting\s+on\s+you|counting\s+on\s+you|i\s+count\s+on\s+you)\b",
        "fear_appeal": r"\b(danger|threat|consequences|punishment|if\s+you\s+don't|if\s+you\s+don't\s+help|eğer\s+bunu\s+söylemezsen|çok\s+kötü\s+şeyler\s+olacak|bad\s+things\s+will\s+happen|bad\s+things|will\s+happen|tehlike|tehdit|sonuç|ceza)\b",
        "threat_conditional": r"\b(if\s+you\s+don't.*bad|if\s+you\s+don't.*happen|don't\s+help.*bad|don't\s+help.*happen)\b",
        "social_proof": r"\b(everyone.is|all.people|most.users|herkes|tüm.insanlar|çoğu.kullanıcı)\b",
        "scarcity": r"\b(limited|only.few|last.chance|sınırlı|az|son.şans)\b",
        "reciprocity": r"\b(I.did.for.you|I.helped.you|senin.için.yaptım|yardım.ettim)\b",
        "urgency": r"\b(urgent|immediately|now|need\s+this\s+now|i\s+need\s+this|acil|hemen|şimdi|lütfen.acil|please.urgent|hayat.memat|life\s+and\s+death|matter\s+of\s+life|matter\s+of\s+life\s+and\s+death|this\s+is\s+a\s+matter|life.death)\b",
        "pleading": r"\b(lütfen\s+söyle|lütfen\s+say|please\s+tell|please\s+say|please|lütfen\s+yardım|please\s+help|please\s+just|just\s+this\s+once|just\s+once|please,\s+just\s+this\s+once|çok\s+önemli|bu\s+çok\s+önemli|very\s+important|very\s+critical|critical|this\s+is\s+critical|i\s+need\s+this\s+now)\b",
        "social_proof_question": r"\b(herkes.bunu.yapıyor|everyone.is.doing|sen.neden.yapmıyorsun|why.aren't.you|neden.yapmıyorsun)\b",
        "reassurance": r"\b(kötü.bir.şey.yapmayacağım|won't.do.anything.bad|zararsız|harmless|just.curious|sadece.merak)\b",
        "demand": r"\b(you\s+must\s+help|you\s+must\s+do|you\s+have\s+to|you\s+must|help\s+me|yapmalısın|yardım\s+et|yapmak\s+zorundasın)\b",
        "must_help": r"\b(you\s+must|must\s+help|help\s+me|yapmalısın)\b",
        "emotional_manipulation": r"\b(you.must|you.should|you.owe|everyone.is|yapmalısın|herkes|borçlusun)\b"
    }
    
    for pattern_name, pattern in pressure_patterns.items():
        matches = len(re.findall(pattern, text_lower, re.IGNORECASE))
        if matches > 0:
            patterns.append({
                "type": pattern_name,
                "count": matches
            })
            # Lower weight for pattern-based detection (to prioritize semantic bucket)
            if pattern_name in ["urgency", "reassurance", "pleading", "social_proof_question", "demand", "emotional_manipulation", "guilt_trip", "counting_on", "let_me_down"]:
                score += matches * 0.2
            else:
                score += matches * 0.1
    
    score = min(score, 1.0)
    
    return {
        "ok": True,
        "score": score,
        "level": "high" if score > 0.7 else "medium" if score > 0.4 else "low",
        "patterns": patterns,
        "summary": f"Psychological pressure detected: {len(patterns)} pattern types" if patterns else "No significant psychological pressure detected"
    }
