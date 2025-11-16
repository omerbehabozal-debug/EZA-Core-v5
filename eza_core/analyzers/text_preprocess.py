# -*- coding: utf-8 -*-
"""
analyzers/text_preprocess.py – EZA-Core v10

Text preprocessing utilities.
"""

import re


def preprocess_text(text: str) -> str:
    """
    Preprocess text for analysis.
    
    Args:
        text: Raw input text
        
    Returns:
        Preprocessed text
    """
    if not text:
        return ""
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Strip leading/trailing whitespace
    text = text.strip()
    
    return text


def clean_text(text: str) -> str:
    """
    Clean text by removing special characters (optional).
    
    Args:
        text: Input text
        
    Returns:
        Cleaned text
    """
    if not text:
        return ""
    
    # Remove excessive punctuation (keep basic punctuation)
    text = re.sub(r'[^\w\s.,!?;:-]', '', text)
    
    return text

