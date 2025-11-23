# -*- coding: utf-8 -*-
"""
Image Safety Engine - OCR-based risk classification
TODO: Replace with real vision models (object detection, scene understanding, etc.)
"""

from typing import List
from .base_models import OCRSegment


def analyze_image_ocr(ocr_segments: List[OCRSegment]) -> List[OCRSegment]:
    """
    Analyze OCR segments for safety risks based on keywords.
    
    STUB: Simple keyword-based risk detection.
    TODO: Replace with real vision-language models.
    """
    risk_keywords = {
        "high": ["weapon", "drug", "violence", "kill", "harm"],
        "medium": ["danger", "warning", "illegal", "prohibited"]
    }
    
    analyzed = []
    for segment in ocr_segments:
        risk_level = segment.risk_level
        text_lower = segment.text.lower()
        
        # Check for high-risk keywords
        for keyword in risk_keywords["high"]:
            if keyword in text_lower:
                risk_level = "high"
                break
        
        # Check for medium-risk keywords if not already high
        if risk_level == "low":
            for keyword in risk_keywords["medium"]:
                if keyword in text_lower:
                    risk_level = "medium"
                    break
        
        analyzed.append(OCRSegment(
            timestamp_sec=segment.timestamp_sec,
            text=segment.text,
            risk_level=risk_level
        ))
    
    return analyzed

