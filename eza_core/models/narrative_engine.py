# -*- coding: utf-8 -*-
"""
models/narrative_engine.py – EZA-Core v10

NarrativeEngine v4.0: Tracks long conversation risk.
Handles: intent drift, cumulative risk, hidden escalation, repeated harmful patterns.
"""

from typing import Dict, List, Any, Optional
from collections import deque


class NarrativeEngine:
    """
    NarrativeEngine v4.0: Conversation context and risk tracking.
    """
    
    def __init__(self, window_size: int = 10):
        """
        Initialize NarrativeEngine.
        
        Args:
            window_size: Number of recent messages to track
        """
        self.window_size = window_size
        self.message_history: deque = deque(maxlen=window_size)
        self.risk_history: deque = deque(maxlen=window_size)
    
    def add_message(self, text: str, risk_score: float):
        """
        Add a message to the conversation history.
        
        Args:
            text: Message text
            risk_score: Risk score for this message
        """
        self.message_history.append(text)
        self.risk_history.append(risk_score)
    
    def detect_intent_drift(self) -> bool:
        """
        Detect if intent has drifted significantly.
        Returns True if drift detected.
        """
        if len(self.risk_history) < 3:
            return False
        
        # Check if risk has increased significantly
        recent_risks = list(self.risk_history)[-3:]
        if recent_risks[0] < 0.3 and recent_risks[-1] > 0.7:
            return True
        
        return False
    
    def calculate_cumulative_risk(self) -> float:
        """
        Calculate cumulative risk from conversation history.
        """
        if not self.risk_history:
            return 0.0
        
        # Weight recent messages more heavily
        weights = [0.1 * (i + 1) for i in range(len(self.risk_history))]
        total_weight = sum(weights)
        
        weighted_sum = sum(risk * weight for risk, weight in zip(self.risk_history, weights))
        cumulative = weighted_sum / total_weight if total_weight > 0 else 0.0
        
        return min(cumulative, 1.0)
    
    def detect_escalation(self) -> str:
        """
        Detect escalation trend.
        Returns: "rising" | "falling" | "stable"
        """
        if len(self.risk_history) < 3:
            return "stable"
        
        recent = list(self.risk_history)[-3:]
        
        # Calculate trend
        if recent[-1] > recent[0] + 0.2:
            return "rising"
        elif recent[-1] < recent[0] - 0.2:
            return "falling"
        else:
            return "stable"
    
    def detect_repeated_patterns(self) -> List[str]:
        """
        Detect repeated harmful patterns in conversation.
        """
        if len(self.message_history) < 2:
            return []
        
        # Simple pattern: check for repeated risk keywords
        repeated = []
        messages = list(self.message_history)
        
        # Check for repeated sensitive data requests
        sensitive_keywords = ["tc", "kimlik", "telefon", "iban"]
        for keyword in sensitive_keywords:
            count = sum(1 for msg in messages if keyword.lower() in msg.lower())
            if count >= 2:
                repeated.append(f"repeated_{keyword}_request")
        
        return repeated
    
    def analyze(self, current_risk_score: float) -> Dict[str, Any]:
        """
        Main analysis function.
        
        Args:
            current_risk_score: Current message risk score
            
        Returns:
            Narrative risk analysis
        """
        # Add current message to history (will be added by caller)
        
        # Calculate metrics
        cumulative_risk = self.calculate_cumulative_risk()
        escalation_trend = self.detect_escalation()
        intent_drift = self.detect_intent_drift()
        repeated_patterns = self.detect_repeated_patterns()
        
        # Narrative risk combines current and cumulative
        narrative_risk = max(current_risk_score, cumulative_risk * 0.7)
        
        # Boost if escalation detected
        if escalation_trend == "rising":
            narrative_risk = min(narrative_risk * 1.2, 1.0)
        
        # Boost if intent drift detected
        if intent_drift:
            narrative_risk = min(narrative_risk * 1.15, 1.0)
        
        # Boost if repeated patterns
        if repeated_patterns:
            narrative_risk = min(narrative_risk * 1.1, 1.0)
        
        # Determine risk level
        if narrative_risk >= 0.9:
            risk_level = "critical"
        elif narrative_risk >= 0.7:
            risk_level = "high"
        elif narrative_risk >= 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            "narrative_risk": round(narrative_risk, 4),
            "risk_level": risk_level,
            "cumulative_risk": round(cumulative_risk, 4),
            "escalation_trend": escalation_trend,
            "intent_drift": intent_drift,
            "repeated_patterns": repeated_patterns,
            "message_count": len(self.message_history),
        }
    
    def reset(self):
        """Reset conversation history."""
        self.message_history.clear()
        self.risk_history.clear()

