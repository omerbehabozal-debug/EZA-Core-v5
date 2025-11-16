# -*- coding: utf-8 -*-
"""
models/utils.py – EZA-Core v10

Utility functions for model processing.
"""

import re
from typing import List, Dict, Any


def tokenize(text: str) -> List[str]:
    """
    Simple tokenization: split by whitespace and punctuation.
    """
    # Normalize text
    text = text.lower().strip()
    # Split by whitespace and punctuation
    tokens = re.findall(r'\b\w+\b', text)
    return tokens


def normalize_text(text: str) -> str:
    """
    Normalize text for processing.
    """
    if not text:
        return ""
    # Lowercase and strip
    normalized = text.lower().strip()
    # Remove extra whitespace
    normalized = re.sub(r'\s+', ' ', normalized)
    return normalized


def contains_phrase(text: str, phrases: List[str]) -> List[str]:
    """
    Check if text contains any of the given phrases.
    Returns list of matched phrases.
    """
    text_lower = text.lower()
    matches = []
    for phrase in phrases:
        if phrase.lower() in text_lower:
            matches.append(phrase)
    return matches


def regex_match(text: str, patterns: List[str]) -> List[str]:
    """
    Match text against regex patterns.
    Returns list of matched patterns.
    """
    matches = []
    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            matches.append(pattern)
    return matches


def calculate_weighted_score(hits: Dict[str, List[str]], weights: Dict[str, float]) -> float:
    """
    Calculate weighted score based on hits and weights.
    """
    score = 0.0
    for category, items in hits.items():
        if items:
            weight = weights.get(category, 0.0)
            score += len(items) * weight
    return min(score, 1.0)  # Cap at 1.0

