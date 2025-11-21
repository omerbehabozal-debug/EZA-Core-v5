# -*- coding: utf-8 -*-
"""
Safety Graph (Full nodes)
Builds context safety graph with nodes and edges
"""

from typing import Dict, Any, List


def build_safety_graph(
    input_analysis: Dict[str, Any],
    output_analysis: Dict[str, Any],
    alignment: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Build safety graph with risk nodes and relationships
    Returns graph structure
    """
    nodes = {}
    edges = []
    
    # Input node
    input_risk = input_analysis.get("risk_score", 0.0)
    nodes["input"] = {
        "id": "input",
        "type": "input",
        "risk_score": input_risk,
        "risk_level": input_analysis.get("risk_level", "low")
    }
    
    # Output node
    output_risk = output_analysis.get("risk_score", 0.0)
    nodes["output"] = {
        "id": "output",
        "type": "output",
        "risk_score": output_risk,
        "risk_level": output_analysis.get("risk_level", "low")
    }
    
    # Alignment node
    alignment_score = alignment.get("alignment_score", 100.0)
    nodes["alignment"] = {
        "id": "alignment",
        "type": "alignment",
        "score": alignment_score,
        "verdict": alignment.get("verdict", "aligned")
    }
    
    # Edges
    edges.append({
        "from": "input",
        "to": "output",
        "weight": 1.0 - abs(input_risk - output_risk),
        "type": "risk_flow"
    })
    
    edges.append({
        "from": "input",
        "to": "alignment",
        "weight": alignment_score / 100.0,
        "type": "alignment_check"
    })
    
    return {
        "nodes": nodes,
        "edges": edges,
        "graph_risk_score": max(input_risk, output_risk),
        "graph_safety_level": "low" if max(input_risk, output_risk) < 0.3 else "medium" if max(input_risk, output_risk) < 0.7 else "high"
    }

