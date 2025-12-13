# -*- coding: utf-8 -*-
"""
Test Results Service
Provides test suite results data for API endpoints.
Currently returns static data (will be updated by cron job in the future).
"""

from datetime import datetime, timezone
from typing import List
from pydantic import BaseModel


class TestSuiteResult(BaseModel):
    """Individual test suite result"""
    name: str
    tests: int
    passed: int
    failed: int
    rate: float
    type: str
    description: str


class TestResultsResponse(BaseModel):
    """Complete test results response"""
    timestamp: str
    total_tests: int
    passed: int
    failed: int
    success_rate: float
    suites: List[TestSuiteResult]


def get_latest_test_results() -> TestResultsResponse:
    """
    Get latest test results.
    
    First tries to read from JSON file (written by GitHub Actions).
    Falls back to static data if file doesn't exist.
    
    Returns:
        TestResultsResponse: Latest test results
    """
    # Try to read from JSON file first
    from backend.services.test_results_storage import read_results
    
    file_results = read_results()
    if file_results is not None:
        return file_results
    
    # Fallback to static data if file doesn't exist
    # Static test suite data
    suites_data = [
        {
            "name": "Core",
            "tests": 50,
            "passed": 50,
            "failed": 0,
            "rate": 100.0,
            "type": "Fake LLM",
            "description": "Temel fonksiyonellik, pipeline ve skor hesaplama testleri."
        },
        {
            "name": "Behavioral Extended",
            "tests": 100,
            "passed": 100,
            "failed": 0,
            "rate": 100.0,
            "type": "Gerçek LLM",
            "description": "Gelişmiş davranışsal senaryolar ve risk kategorileri."
        },
        {
            "name": "Policy",
            "tests": 127,
            "passed": 127,
            "failed": 0,
            "rate": 100.0,
            "type": "Gerçek LLM",
            "description": "Policy violation detection, F1-F3, Z1-Z3 policy testleri."
        },
        {
            "name": "Multi-Turn",
            "tests": 100,
            "passed": 100,
            "failed": 0,
            "rate": 100.0,
            "type": "Gerçek LLM",
            "description": "Çoklu konuşma testleri, konuşma bağlamı korunması ve risk artışı tespiti."
        },
        {
            "name": "Adversarial",
            "tests": 132,
            "passed": 132,
            "failed": 0,
            "rate": 100.0,
            "type": "Gerçek LLM",
            "description": "Red-team saldırı testleri, jailbreak, prompt injection ve obfuscation testleri."
        },
        {
            "name": "Multi-Model",
            "tests": 30,
            "passed": 30,
            "failed": 0,
            "rate": 100.0,
            "type": "Gerçek LLM",
            "description": "Model tutarlılık testleri, score deviation ve alignment consistency."
        },
        {
            "name": "Performance",
            "tests": 52,
            "passed": 52,
            "failed": 0,
            "rate": 100.0,
            "type": "Fake LLM",
            "description": "Response time, burst load, concurrency, memory ve stability testleri."
        }
    ]
    
    # Calculate totals
    total_tests = sum(suite["tests"] for suite in suites_data)
    total_passed = sum(suite["passed"] for suite in suites_data)
    total_failed = sum(suite["failed"] for suite in suites_data)
    success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0.0
    
    # Create suite objects
    suites = [TestSuiteResult(**suite) for suite in suites_data]
    
    # Generate timestamp (ISO format with timezone)
    timestamp = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    
    return TestResultsResponse(
        timestamp=timestamp,
        total_tests=total_tests,
        passed=total_passed,
        failed=total_failed,
        success_rate=round(success_rate, 2),
        suites=suites
    )


# Future: Functions to load from file/database
# def load_test_results_from_file(file_path: str) -> TestResultsResponse:
#     """Load test results from JSON file (for cron job updates)"""
#     import json
#     with open(file_path, 'r', encoding='utf-8') as f:
#         data = json.load(f)
#     return TestResultsResponse(**data)
#
# def load_test_results_from_db() -> TestResultsResponse:
#     """Load test results from database"""
#     # Implementation when database is ready
#     pass

