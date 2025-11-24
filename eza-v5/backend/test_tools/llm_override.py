# -*- coding: utf-8 -*-
"""
LLM Override for Testing
Common LLM override utilities
"""

from typing import Dict, Any, Optional, List
import random


class FakeLLM:
    """Fake LLM for testing"""
    
    def __init__(self, responses: Optional[List[str]] = None):
        self.responses = responses or [
            "This is a fake LLM response.",
            "I understand your question.",
            "Here is a helpful response."
        ]
        self.call_count = 0
    
    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate fake response"""
        self.call_count += 1
        return random.choice(self.responses)
    
    def get_metadata(self) -> Dict[str, Any]:
        """Get fake metadata"""
        return {
            "model": "fake-llm",
            "tokens_used": 20,
            "finish_reason": "stop"
        }


class DeterministicLLM:
    """Deterministic LLM for consistent testing"""
    
    def __init__(self, response_map: Optional[Dict[str, str]] = None):
        self.response_map = response_map or {}
        self.default_response = "Default response"
    
    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate deterministic response"""
        # Check if we have a mapped response
        for key, response in self.response_map.items():
            if key.lower() in prompt.lower():
                return response
        return self.default_response


class BrokenLLM:
    """Broken LLM that raises errors"""
    
    def __init__(self, error_message: str = "Model failure"):
        self.error_message = error_message
    
    async def generate(self, prompt: str, **kwargs) -> str:
        """Always raise error"""
        raise Exception(self.error_message)

