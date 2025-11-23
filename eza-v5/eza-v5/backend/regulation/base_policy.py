# -*- coding: utf-8 -*-
"""
Base Policy Pack - Abstract base for regulation policy packs
"""

from abc import ABC, abstractmethod
from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class PolicyResult(BaseModel):
    """Result of policy evaluation"""
    passed: bool
    score: float  # 0.0 to 1.0
    reasons: List[str]
    tags: List[str]
    metadata: Optional[Dict[str, Any]] = None


class BasePolicyPack(ABC):
    """Abstract base class for policy packs"""
    
    name: str
    version: str
    
    @abstractmethod
    def evaluate(
        self,
        input_text: str,
        output_text: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> PolicyResult:
        """
        Evaluate input/output against policy
        
        Args:
            input_text: User input text
            output_text: LLM output text (if available)
            meta: Additional metadata (eza_score, risk_flags, etc.)
        
        Returns:
            PolicyResult with pass/fail and details
        """
        pass

