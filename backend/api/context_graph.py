# -*- coding: utf-8 -*-
"""
ContextSafetyGraph v1.0 – EZA Level-6 Safety Layer

Builds an internal graph representation of safety-related nodes and relationships.
"""

from typing import Dict, Any, List, Optional


class ContextSafetyGraph:
    """
    ContextSafetyGraph v1.0: Builds safety graph representation.
    
    Nodes: intent, identity, reasoning, narrative, drift, deception, pressure, legal
    Edges: "amplifies", "mitigates", "supports"
    
    Returns:
    - nodes: dict[name, {"score": float, "type": str}]
    - edges: list[{"from": str, "to": str, "relation": str}]
    - summary: short explanation of main risk chain
    """

    def __init__(self):
        """Initialize ContextSafetyGraph."""
        pass

    def build(self, report: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build safety graph from report.
        
        Args:
            report: Report dict containing various analysis results
            
        Returns:
            {
                "nodes": Dict[str, Dict[str, Any]],
                "edges": List[Dict[str, str]],
                "summary": str
            }
        """
        try:
            if not report or not isinstance(report, dict):
                return self._fallback("Invalid or empty report")
            
            nodes: Dict[str, Dict[str, Any]] = {}
            edges: List[Dict[str, str]] = []
            
            # 1) Extract node scores from report
            # Intent node
            intent_engine = report.get("intent_engine", {})
            intent_score = intent_engine.get("risk_score", 0.0) if intent_engine else 0.0
            nodes["intent"] = {
                "score": round(float(intent_score), 3),
                "type": "risk"
            }
            
            # Identity node
            identity_block = report.get("identity_block", {})
            identity_score = identity_block.get("risk_score", 0.0) if identity_block else 0.0
            nodes["identity"] = {
                "score": round(float(identity_score), 3),
                "type": "risk"
            }
            
            # Reasoning node
            reasoning_shield = report.get("reasoning_shield", {})
            if reasoning_shield:
                # Convert alignment_score (0-100) to risk score (0-1)
                alignment_score = reasoning_shield.get("alignment_score", 100)
                reasoning_score = 1.0 - (alignment_score / 100.0)
            else:
                reasoning_score = 0.0
            nodes["reasoning"] = {
                "score": round(float(reasoning_score), 3),
                "type": "risk"
            }
            
            # Narrative node
            narrative = report.get("narrative", {})
            narrative_score = narrative.get("risk_score", 0.0) if narrative else 0.0
            nodes["narrative"] = {
                "score": round(float(narrative_score), 3),
                "type": "context"
            }
            
            # Drift node
            drift = report.get("drift_matrix", {})
            if drift:
                drift_score_raw = drift.get("score", 0.0)
                # Normalize drift score to 0-1 (assuming range -5 to +5)
                drift_score = max(0.0, min(1.0, (drift_score_raw + 5.0) / 10.0))
            else:
                drift_score = 0.0
            nodes["drift"] = {
                "score": round(float(drift_score), 3),
                "type": "trend"
            }
            
            # Deception node
            deception = report.get("deception", {})
            deception_score = deception.get("score", 0.0) if deception else 0.0
            nodes["deception"] = {
                "score": round(float(deception_score), 3),
                "type": "risk"
            }
            
            # Pressure node
            psych_pressure = report.get("psychological_pressure", {})
            pressure_score = psych_pressure.get("score", 0.0) if psych_pressure else 0.0
            nodes["pressure"] = {
                "score": round(float(pressure_score), 3),
                "type": "risk"
            }
            
            # Legal node
            legal_risk = report.get("legal_risk", {})
            legal_score = legal_risk.get("score", 0.0) if legal_risk else 0.0
            nodes["legal"] = {
                "score": round(float(legal_score), 3),
                "type": "risk"
            }
            
            # 2) Build edges based on relationships
            # Intent amplifies reasoning risk
            if intent_score > 0.5 and reasoning_score > 0.3:
                edges.append({
                    "from": "intent",
                    "to": "reasoning",
                    "relation": "amplifies"
                })
            
            # Deception amplifies legal risk
            if deception_score > 0.5 and legal_score > 0.3:
                edges.append({
                    "from": "deception",
                    "to": "legal",
                    "relation": "amplifies"
                })
            
            # Pressure amplifies legal risk (harassment)
            if pressure_score > 0.5 and legal_score > 0.3:
                edges.append({
                    "from": "pressure",
                    "to": "legal",
                    "relation": "amplifies"
                })
            
            # Identity risk supports legal risk (privacy violation)
            if identity_score > 0.5 and legal_score > 0.3:
                edges.append({
                    "from": "identity",
                    "to": "legal",
                    "relation": "supports"
                })
            
            # Narrative supports intent (context)
            if narrative_score > 0.4 and intent_score > 0.4:
                edges.append({
                    "from": "narrative",
                    "to": "intent",
                    "relation": "supports"
                })
            
            # Drift amplifies narrative (trend)
            if drift_score > 0.6 and narrative_score > 0.3:
                edges.append({
                    "from": "drift",
                    "to": "narrative",
                    "relation": "amplifies"
                })
            
            # Reasoning mitigates overall risk (if high alignment)
            if reasoning_score < 0.3:
                # Low reasoning risk (high alignment) mitigates other risks
                for node_name in ["intent", "identity", "deception"]:
                    if nodes[node_name]["score"] > 0.5:
                        edges.append({
                            "from": "reasoning",
                            "to": node_name,
                            "relation": "mitigates"
                        })
            
            # 3) Generate summary
            high_risk_nodes = [name for name, data in nodes.items() if data["score"] > 0.6]
            if high_risk_nodes:
                main_chain = " -> ".join(high_risk_nodes[:3])  # Show top 3
                summary = f"Main risk chain: {main_chain}. High-risk nodes: {', '.join(high_risk_nodes)}"
            else:
                summary = "No significant risk chains detected. All nodes at low-medium risk."
            
            return {
                "nodes": nodes,
                "edges": edges,
                "summary": summary
            }
            
        except Exception as e:
            return self._fallback(f"Error in context graph building: {str(e)}")
    
    def _fallback(self, error_msg: str) -> Dict[str, Any]:
        """Return fallback structure on error."""
        return {
            "ok": False,
            "error": error_msg,
            "nodes": {},
            "edges": [],
            "summary": "Context graph building failed."
        }

