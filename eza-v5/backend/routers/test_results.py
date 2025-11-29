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

router = APIRouter()


@router.get(
    "/latest",
    response_model=TestResultsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Latest Test Results",
    description="Returns the latest test suite results including all test categories and their success rates.",
    response_description="Test results with timestamp, totals, and individual suite details"
)
async def get_latest_test_results_endpoint():
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
    "/health",
    summary="Test Results Service Health Check",
    description="Health check endpoint for test results service"
)
async def test_results_health():
    """
    Health check for test results service.
    
    Returns:
        dict: Service status
    """
    try:
        # Try to get results to verify service is working
        _ = get_latest_test_results()
        return {
            "status": "ok",
            "service": "test_results",
            "message": "Test results service is operational"
        }
    except Exception as e:
        return {
            "status": "error",
            "service": "test_results",
            "message": f"Service error: {str(e)}"
        }

