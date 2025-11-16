# -*- coding: utf-8 -*-
"""
BehaviorCorrelationModel v1.0 – EZA Level-6 Safety Layer

Correlates current request with conversation history to detect risky behavior patterns over time.
"""

from typing import Dict, Any, List, Optional


class BehaviorCorrelationModel:
    """
    BehaviorCorrelationModel v1.0: Correlates current request with conversation history.
    
    Detects if user is repeatedly asking risky things over time.
    
    Uses:
    - last N messages from narrative memory
    - their intent/risk if available in report
    
    Returns:
    - trend_score (0–1)
    - level ("stable" | "escalating" | "de-escalating")
    - flags: list[str] e.g. ["repeated-illegal-queries"]
    - summary
    """

    def __init__(self):
        """Initialize BehaviorCorrelationModel."""
        pass

    def analyze(
        self,
        memory: Optional[List[Dict[str, Any]]] = None,
        report: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze behavior correlation from memory and current report.
        
        Args:
            memory: Conversation memory (list of message dicts)
            report: Current report dict (optional)
            
        Returns:
            {
                "trend_score": float (0-1),
                "level": str ("stable" | "escalating" | "de-escalating"),
                "flags": List[str],
                "summary": str
            }
        """
        try:
            if not memory or not isinstance(memory, list) or len(memory) < 2:
                return {
                    "trend_score": 0.0,
                    "level": "stable",
                    "flags": [],
                    "summary": "Insufficient conversation history for behavior correlation."
                }
            
            flags: List[str] = []
            risk_scores: List[float] = []
            
            # Extract risk scores from memory
            # Memory entries might have different structures
            for entry in memory[-10:]:  # Last 10 messages
                risk = 0.0
                
                # Try to extract risk from report if available
                if "report" in entry and isinstance(entry["report"], dict):
                    report_data = entry["report"]
                    risk_level = report_data.get("risk_level", "low")
                    risk = self._risk_level_to_score(risk_level)
                # Try to extract from intent_engine
                elif "intent" in entry and isinstance(entry["intent"], dict):
                    risk = entry["intent"].get("risk_score", 0.0)
                # Try to extract from reasoning
                elif "reasoning" in entry and isinstance(entry["reasoning"], dict):
                    reasoning_data = entry["reasoning"]
                    alignment_score = reasoning_data.get("alignment_score", 100)
                    risk = 1.0 - (alignment_score / 100.0)
                # Fallback: check text for risk keywords
                elif "text" in entry:
                    text = entry["text"]
                    if isinstance(text, str):
                        risk = self._estimate_risk_from_text(text)
                
                risk_scores.append(risk)
            
            # Add current report risk if available
            if report:
                current_risk_level = report.get("risk_level", "low")
                current_risk = self._risk_level_to_score(current_risk_level)
                risk_scores.append(current_risk)
            
            if len(risk_scores) < 2:
                return {
                    "trend_score": 0.0,
                    "level": "stable",
                    "flags": [],
                    "summary": "Insufficient risk data for trend analysis."
                }
            
            # Calculate trend
            # Simple linear trend: positive slope = escalating, negative = de-escalating
            n = len(risk_scores)
            x_values = list(range(n))
            y_values = risk_scores
            
            # Calculate slope (simple linear regression)
            x_mean = sum(x_values) / n
            y_mean = sum(y_values) / n
            
            numerator = sum((x_values[i] - x_mean) * (y_values[i] - y_mean) for i in range(n))
            denominator = sum((x_values[i] - x_mean) ** 2 for i in range(n))
            
            if denominator == 0:
                slope = 0.0
            else:
                slope = numerator / denominator
            
            # Normalize slope to 0-1 range for trend_score
            # Assuming max slope is around 0.1 per message
            trend_score = min(1.0, max(0.0, (slope * 10.0 + 0.5)))
            
            # Determine level
            if slope > 0.02:
                level = "escalating"
            elif slope < -0.02:
                level = "de-escalating"
            else:
                level = "stable"
            
            # Check for repeated risky patterns
            high_risk_count = sum(1 for r in risk_scores if r > 0.6)
            if high_risk_count >= 3:
                flags.append("repeated-high-risk-queries")
            
            # Check for repeated illegal queries
            if report:
                risk_flags = report.get("risk_flags", [])
                if any("illegal" in str(flag).lower() for flag in risk_flags):
                    # Check if previous messages also had illegal flags
                    illegal_in_history = 0
                    for entry in memory[-5:]:
                        if "report" in entry:
                            prev_flags = entry["report"].get("risk_flags", [])
                            if any("illegal" in str(f).lower() for f in prev_flags):
                                illegal_in_history += 1
                    
                    if illegal_in_history >= 2:
                        flags.append("repeated-illegal-queries")
            
            # Check for escalation pattern
            if level == "escalating" and trend_score > 0.6:
                flags.append("risk-escalation-detected")
            
            # Generate summary
            if flags:
                summary = f"Behavior trend: {level} (score: {trend_score:.2f}). Flags: {', '.join(flags)}"
            else:
                summary = f"Behavior trend: {level} (score: {trend_score:.2f}). No significant patterns detected."
            
            return {
                "trend_score": round(trend_score, 3),
                "level": level,
                "flags": flags,
                "summary": summary
            }
            
        except Exception as e:
            return self._fallback(f"Error in behavior correlation: {str(e)}")
    
    def _risk_level_to_score(self, level: str) -> float:
        """Convert risk level string to numeric score."""
        mapping = {
            "low": 0.2,
            "medium": 0.5,
            "high": 0.8,
            "critical": 1.0
        }
        return mapping.get(level.lower(), 0.2)
    
    def _estimate_risk_from_text(self, text: str) -> float:
        """Simple heuristic to estimate risk from text."""
        if not text:
            return 0.0
        
        text_lower = text.lower()
        risk_keywords = [
            "illegal", "violence", "harm", "threat", "kill", "hurt",
            "manipulate", "deceive", "steal", "hack", "attack"
        ]
        
        keyword_count = sum(1 for keyword in risk_keywords if keyword in text_lower)
        return min(1.0, keyword_count * 0.2)
    
    def _fallback(self, error_msg: str) -> Dict[str, Any]:
        """Return fallback structure on error."""
        return {
            "ok": False,
            "error": error_msg,
            "trend_score": 0.0,
            "level": "unknown",
            "flags": [],
            "summary": "Behavior correlation analysis failed."
        }

