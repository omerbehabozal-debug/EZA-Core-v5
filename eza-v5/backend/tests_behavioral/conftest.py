# -*- coding: utf-8 -*-
"""
Pytest Configuration for Behavioral Tests
"""

import pytest
from backend.tests_behavioral.helpers.scenario_loader import load_scenarios
from backend.tests_behavioral.helpers.llm_settings import USE_REAL_LLM


@pytest.fixture(scope="session")
def scenarios():
    """Load all test scenarios"""
    return load_scenarios()


@pytest.fixture(scope="session")
def use_real_llm():
    """Check if real LLM should be used"""
    return USE_REAL_LLM


@pytest.fixture(autouse=True)
def skip_if_fake_llm(request, use_real_llm):
    """Skip tests that require real LLM if USE_REAL_LLM is False"""
    if request.node.get_closest_marker("requires_real_llm") and not use_real_llm:
        pytest.skip("Real LLM required but USE_REAL_LLM is False")

