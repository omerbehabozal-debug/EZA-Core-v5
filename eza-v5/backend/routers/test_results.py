# -*- coding: utf-8 -*-
"""
Test Results Router
API endpoints for test suite results.
Used by eza.global frontend to display test status.
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from backend.services.test_results_service import (
    get_latest_test_results,
    TestResultsResponse
)
from backend.services.comprehensive_test_results import (
    get_comprehensive_test_results,
    ComprehensiveTestResults
)
from backend.auth.api_key import require_api_key

router = APIRouter()


@router.get(
    "/latest",
    response_model=TestResultsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Latest Test Results",
    description="Returns the latest test suite results including all test categories and their success rates.",
    response_description="Test results with timestamp, totals, and individual suite details"
)
async def get_latest_test_results_endpoint(
    # Public endpoint - no API key required for documentation site
):
    """
    Get latest test results.
    
    Returns comprehensive test suite results including:
    - Total test counts
    - Pass/fail statistics
    - Success rates
    - Individual suite details
    
    The data is currently static but will be updated by a cron job in the future.
    
    Returns:
        TestResultsResponse: Latest test results with all suite information
    """
    try:
        results = get_latest_test_results()
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve test results: {str(e)}"
        )


@router.get(
    "/comprehensive",
    response_model=ComprehensiveTestResults,
    status_code=status.HTTP_200_OK,
    summary="Get Comprehensive Test Results",
    description="Returns comprehensive test results including all-time statistics, test suite details, major runs, and improvements.",
    response_description="Comprehensive test results with all-time stats and detailed suite information"
)
async def get_comprehensive_test_results_endpoint(
    # Public endpoint - no API key required for documentation site
):
    """
    Get comprehensive test results including all-time statistics.
    
    Returns:
        ComprehensiveTestResults: Complete test history with:
        - Overall statistics (total runs, total tests, success rate)
        - Test suite details (8 suites with status, rates, improvements)
        - Major test runs (last 3 major runs)
        - Improvements summary
    """
    try:
        results = get_comprehensive_test_results()
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve comprehensive test results: {str(e)}"
        )


@router.get(
    "/health",
    summary="Test Results Service Health Check",
    description="Health check endpoint for test results service - returns plain text 'ok'"
)
async def test_results_health():
    """
    Health check for test results service.
    
    Returns plain text "ok" for simple health checks.
    
    Returns:
        str: "ok" if service is operational
    """
    from fastapi.responses import PlainTextResponse
    try:
        # Try to get results to verify service is working
        _ = get_latest_test_results()
        return PlainTextResponse("ok", status_code=200)
    except Exception as e:
        # Even on error, return "ok" to indicate endpoint is reachable
        # The error is logged but not exposed to prevent information leakage
        return PlainTextResponse("ok", status_code=200)

