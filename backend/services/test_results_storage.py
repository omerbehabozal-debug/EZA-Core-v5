# -*- coding: utf-8 -*-
"""
Test Results Storage
Handles reading and writing test results to JSON file.
Used by GitHub Actions workflows to persist test results.
"""

import json
import os
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timezone

from backend.services.test_results_service import (
    TestResultsResponse,
    TestSuiteResult
)


# Default path for test results JSON file
DEFAULT_RESULTS_PATH = Path(__file__).parent.parent / "data" / "test_results.json"


def ensure_data_directory() -> Path:
    """Ensure data directory exists"""
    data_dir = DEFAULT_RESULTS_PATH.parent
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def write_results(results: TestResultsResponse) -> None:
    """
    Write test results to JSON file.
    
    Args:
        results: TestResultsResponse object to write
    """
    ensure_data_directory()
    
    # Convert to dict for JSON serialization
    data = {
        "timestamp": results.timestamp,
        "total_tests": results.total_tests,
        "passed": results.passed,
        "failed": results.failed,
        "success_rate": results.success_rate,
        "suites": [
            {
                "name": suite.name,
                "tests": suite.tests,
                "passed": suite.passed,
                "failed": suite.failed,
                "rate": suite.rate,
                "type": suite.type,
                "description": suite.description
            }
            for suite in results.suites
        ]
    }
    
    # Write to file
    with open(DEFAULT_RESULTS_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Test results written to {DEFAULT_RESULTS_PATH}")


def read_results() -> Optional[TestResultsResponse]:
    """
    Read test results from JSON file.
    
    Returns:
        TestResultsResponse if file exists, None otherwise
    """
    if not DEFAULT_RESULTS_PATH.exists():
        return None
    
    try:
        with open(DEFAULT_RESULTS_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Convert to TestResultsResponse
        suites = [
            TestSuiteResult(**suite_data)
            for suite_data in data.get("suites", [])
        ]
        
        return TestResultsResponse(
            timestamp=data.get("timestamp", datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')),
            total_tests=data.get("total_tests", 0),
            passed=data.get("passed", 0),
            failed=data.get("failed", 0),
            success_rate=data.get("success_rate", 0.0),
            suites=suites
        )
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"Error reading test results: {e}")
        return None


def get_results_path() -> Path:
    """Get the path to test results JSON file"""
    return DEFAULT_RESULTS_PATH

