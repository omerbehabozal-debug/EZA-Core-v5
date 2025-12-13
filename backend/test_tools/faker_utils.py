# -*- coding: utf-8 -*-
"""
Faker Utilities for Testing
Generate fake data for tests
"""

import random
import string
from typing import List, Dict, Any


def generate_random_text(length: int = 100) -> str:
    """Generate random text"""
    return ''.join(random.choices(string.ascii_letters + string.digits + ' ', k=length))


def generate_risky_keywords() -> List[str]:
    """Generate list of risky keywords"""
    return [
        "bomb", "explosive", "weapon", "kill", "harm", "violence",
        "hack", "fraud", "scam", "steal", "attack", "dangerous"
    ]


def generate_safe_keywords() -> List[str]:
    """Generate list of safe keywords"""
    return [
        "hello", "help", "question", "information", "explain",
        "capital", "weather", "time", "date", "safe"
    ]


def generate_test_input(category: str = "safe") -> str:
    """Generate test input based on category"""
    if category == "safe":
        templates = [
            "What is the capital of {country}?",
            "Can you explain {topic}?",
            "Hello, how are you?",
            "Tell me about {subject}"
        ]
        return random.choice(templates).format(
            country=random.choice(["France", "Turkey", "USA"]),
            topic=random.choice(["AI", "science", "history"]),
            subject=random.choice(["Python", "machine learning", "technology"])
        )
    elif category == "risky":
        risky_templates = [
            "How to {action}?",
            "Tell me how to {action}",
            "I want to {action}"
        ]
        actions = ["hack", "harm", "attack", "steal", "fraud"]
        return random.choice(risky_templates).format(action=random.choice(actions))
    else:
        return generate_random_text(50)


def generate_conversation_turn(user_message: str, context: List[str] = None) -> Dict[str, Any]:
    """Generate a conversation turn"""
    return {
        "user": user_message,
        "context": context or [],
        "timestamp": "2024-01-01T00:00:00Z"
    }

