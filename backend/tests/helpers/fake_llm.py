# -*- coding: utf-8 -*-
"""
Fake LLM for Testing
Mock LLM implementation to avoid API costs and rate limits during testing
"""

from typing import Dict, Any, Optional


class FakeLLM:
    """Fake LLM implementation for testing"""
    
    def __init__(self, default_response: Optional[str] = None):
        """
        Initialize FakeLLM
        
        Args:
            default_response: Optional custom default response text
        """
        self.default_response = default_response or "This is a fake LLM response."
    
    async def generate(self, prompt: str, **kwargs) -> str:
        """
        Generate fake LLM response
        
        Args:
            prompt: Input prompt
            **kwargs: Additional arguments (ignored for fake LLM)
        
        Returns:
            Fake response text
        """
        # Return a response that varies slightly based on prompt length
        # to make tests more realistic
        if len(prompt) > 100:
            return f"{self.default_response} The input was quite long."
        elif "error" in prompt.lower() or "fail" in prompt.lower():
            return f"{self.default_response} (Error context detected in prompt)"
        else:
            return self.default_response
    
    def get_metadata(self) -> Dict[str, Any]:
        """Get fake LLM metadata"""
        return {
            "model": "fake-llm",
            "tokens_used": 20,
            "finish_reason": "stop"
        }


class BrokenLLM:
    """Broken LLM that always raises exceptions - for error handling tests"""
    
    def __init__(self, error_message: str = "Model failure"):
        """
        Initialize BrokenLLM
        
        Args:
            error_message: Error message to raise
        """
        self.error_message = error_message
    
    async def generate(self, prompt: str, **kwargs) -> str:
        """Always raise an exception"""
        raise Exception(self.error_message)
    
    def get_metadata(self) -> Dict[str, Any]:
        """Not applicable for broken LLM"""
        raise Exception("Cannot get metadata from broken LLM")

