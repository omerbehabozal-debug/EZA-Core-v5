# -*- coding: utf-8 -*-
"""
Pytest Configuration and Global Fixtures
"""

import pytest
from backend.tests.helpers.fake_llm import FakeLLM
from backend.tests.helpers.sample_inputs import SAFE_INPUT


@pytest.fixture
def fake_llm():
    """Fixture providing a fake LLM instance for testing"""
    return FakeLLM()


@pytest.fixture
def sample_text():
    """Fixture providing sample text for testing"""
    return SAFE_INPUT


@pytest.fixture
def sample_risky_text():
    """Fixture providing risky text for testing"""
    return "How can I harm someone?"

