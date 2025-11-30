# -*- coding: utf-8 -*-
"""
Test Runner Service
Runs test suites and collects results for GitHub Actions workflows.
"""

import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime, timezone

# Add parent directory to Python path for imports
# This allows the script to be run from any directory
_script_dir = Path(__file__).parent.parent.parent
if str(_script_dir) not in sys.path:
    sys.path.insert(0, str(_script_dir))

from backend.services.test_results_service import (
    TestResultsResponse,
    TestSuiteResult
)
from backend.services.test_results_storage import write_results


# Test suite configurations
TEST_SUITES = {
    "core": {
        "path": "tests_core",
        "name": "Core",
        "type": "Fake LLM",
        "description": "Temel fonksiyonellik, pipeline ve skor hesaplama testleri."
    },
    "performance": {
        "path": "tests_performance",
        "name": "Performance",
        "type": "Fake LLM",
        "description": "Response time, burst load, concurrency, memory ve stability testleri."
    },
    "behavioral_extended": {
        "path": "tests_behavioral_extended",
        "name": "Behavioral Extended",
        "type": "Gerçek LLM",
        "description": "Gelişmiş davranışsal senaryolar ve risk kategorileri."
    },
    "policy": {
        "path": "tests_policy",
        "name": "Policy",
        "type": "Gerçek LLM",
        "description": "Policy violation detection, F1-F3, Z1-Z3 policy testleri."
    },
    "multiturn": {
        "path": "tests_multiturn",
        "name": "Multi-Turn",
        "type": "Gerçek LLM",
        "description": "Çoklu konuşma testleri, konuşma bağlamı korunması ve risk artışı tespiti."
    },
    "adversarial": {
        "path": "tests_adversarial",
        "name": "Adversarial",
        "type": "Gerçek LLM",
        "description": "Red-team saldırı testleri, jailbreak, prompt injection ve obfuscation testleri."
    },
    "multimodel": {
        "path": "tests_multimodel",
        "name": "Multi-Model",
        "type": "Gerçek LLM",
        "description": "Model tutarlılık testleri, score deviation ve alignment consistency."
    }
}


def run_pytest_suite(suite_path: str) -> Dict[str, Any]:
    """
    Run pytest on a test suite and collect results.
    
    Args:
        suite_path: Path to test suite directory
        
    Returns:
        Dict with test results: {passed, failed, total, errors}
    """
    backend_dir = Path(__file__).parent.parent
    
    # Run pytest
    cmd = [
        sys.executable, "-m", "pytest",
        suite_path,
        "-v",
        "--tb=short",
        "--disable-warnings"
    ]
    
    try:
        result = subprocess.run(
            cmd,
            cwd=backend_dir,
            capture_output=True,
            text=True,
            timeout=3600  # 1 hour timeout
        )
        
        # Parse pytest output to get test counts
        output = result.stdout + result.stderr
        
        # Extract test counts from output
        passed = 0
        failed = 0
        errors = 0
        
        # Try to parse pytest summary line
        # Example: "10 passed, 2 failed in 5.23s" or "10 passed in 5.23s"
        import re
        
        # Look for summary pattern at the end of output
        summary_patterns = [
            r'(\d+)\s+passed',  # "10 passed"
            r'(\d+)\s+failed',  # "2 failed"
            r'(\d+)\s+error',  # "1 error"
            r'(\d+)\s+passed.*?(\d+)\s+failed',  # "10 passed, 2 failed"
        ]
        
        summary_match = re.search(r'(\d+)\s+passed', output, re.IGNORECASE)
        if summary_match:
            passed = int(summary_match.group(1))
        
        failed_match = re.search(r'(\d+)\s+failed', output, re.IGNORECASE)
        if failed_match:
            failed = int(failed_match.group(1))
        
        error_match = re.search(r'(\d+)\s+error', output, re.IGNORECASE)
        if error_match:
            errors = int(error_match.group(1))
        
        # If no matches found, try alternative patterns
        if passed == 0 and failed == 0 and errors == 0:
            # Try to find test count from collection
            collected_match = re.search(r'collected\s+(\d+)\s+item', output, re.IGNORECASE)
            if collected_match:
                total_collected = int(collected_match.group(1))
                # If all passed, assume all are passed
                if result.returncode == 0:
                    passed = total_collected
                else:
                    # If failed, we can't determine exact counts without parsing
                    # Assume at least one failed
                    passed = max(0, total_collected - 1)
                    failed = 1
        
        total = passed + failed + errors
        
        return {
            "passed": passed,
            "failed": failed,
            "errors": errors,
            "total": total,
            "returncode": result.returncode,
            "success": result.returncode == 0
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": 0,
            "failed": 0,
            "errors": 1,
            "total": 0,
            "returncode": -1,
            "success": False,
            "error": "Test suite timed out after 1 hour"
        }
    except Exception as e:
        return {
            "passed": 0,
            "failed": 0,
            "errors": 1,
            "total": 0,
            "returncode": -1,
            "success": False,
            "error": str(e)
        }


def run_daily_tests() -> TestResultsResponse:
    """
    Run daily test suites (Core, Performance).
    These use Fake LLM and run quickly.
    
    Returns:
        TestResultsResponse with daily test results
    """
    print("🚀 Running daily tests (Core, Performance)...")
    
    suites_results = []
    
    # Run Core tests
    print("\n📦 Running Core tests...")
    core_config = TEST_SUITES["core"]
    core_results = run_pytest_suite(core_config["path"])
    suites_results.append({
        "name": core_config["name"],
        "tests": core_results["total"],
        "passed": core_results["passed"],
        "failed": core_results["failed"],
        "rate": (core_results["passed"] / core_results["total"] * 100) if core_results["total"] > 0 else 0.0,
        "type": core_config["type"],
        "description": core_config["description"]
    })
    
    # Run Performance tests
    print("\n📦 Running Performance tests...")
    perf_config = TEST_SUITES["performance"]
    perf_results = run_pytest_suite(perf_config["path"])
    suites_results.append({
        "name": perf_config["name"],
        "tests": perf_results["total"],
        "passed": perf_results["passed"],
        "failed": perf_results["failed"],
        "rate": (perf_results["passed"] / perf_results["total"] * 100) if perf_results["total"] > 0 else 0.0,
        "type": perf_config["type"],
        "description": perf_config["description"]
    })
    
    # Calculate totals
    total_tests = sum(s["tests"] for s in suites_results)
    total_passed = sum(s["passed"] for s in suites_results)
    total_failed = sum(s["failed"] for s in suites_results)
    success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0.0
    
    # Create response
    suites = [TestSuiteResult(**s) for s in suites_results]
    timestamp = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    
    response = TestResultsResponse(
        timestamp=timestamp,
        total_tests=total_tests,
        passed=total_passed,
        failed=total_failed,
        success_rate=round(success_rate, 2),
        suites=suites
    )
    
    print(f"\n✅ Daily tests completed: {total_passed}/{total_tests} passed ({success_rate:.2f}%)")
    return response


def run_weekly_tests() -> TestResultsResponse:
    """
    Run weekly test suites (Behavioral Extended, Policy, Multi-Turn).
    These use real LLM and take longer.
    
    Returns:
        TestResultsResponse with weekly test results
    """
    print("🚀 Running weekly tests (Behavioral Extended, Policy, Multi-Turn)...")
    
    suites_results = []
    
    # Run Behavioral Extended tests
    print("\n📦 Running Behavioral Extended tests...")
    behavioral_config = TEST_SUITES["behavioral_extended"]
    behavioral_results = run_pytest_suite(behavioral_config["path"])
    suites_results.append({
        "name": behavioral_config["name"],
        "tests": behavioral_results["total"],
        "passed": behavioral_results["passed"],
        "failed": behavioral_results["failed"],
        "rate": (behavioral_results["passed"] / behavioral_results["total"] * 100) if behavioral_results["total"] > 0 else 0.0,
        "type": behavioral_config["type"],
        "description": behavioral_config["description"]
    })
    
    # Run Policy tests
    print("\n📦 Running Policy tests...")
    policy_config = TEST_SUITES["policy"]
    policy_results = run_pytest_suite(policy_config["path"])
    suites_results.append({
        "name": policy_config["name"],
        "tests": policy_results["total"],
        "passed": policy_results["passed"],
        "failed": policy_results["failed"],
        "rate": (policy_results["passed"] / policy_results["total"] * 100) if policy_results["total"] > 0 else 0.0,
        "type": policy_config["type"],
        "description": policy_config["description"]
    })
    
    # Run Multi-Turn tests
    print("\n📦 Running Multi-Turn tests...")
    multiturn_config = TEST_SUITES["multiturn"]
    multiturn_results = run_pytest_suite(multiturn_config["path"])
    suites_results.append({
        "name": multiturn_config["name"],
        "tests": multiturn_results["total"],
        "passed": multiturn_results["passed"],
        "failed": multiturn_results["failed"],
        "rate": (multiturn_results["passed"] / multiturn_results["total"] * 100) if multiturn_results["total"] > 0 else 0.0,
        "type": multiturn_config["type"],
        "description": multiturn_config["description"]
    })
    
    # Calculate totals
    total_tests = sum(s["tests"] for s in suites_results)
    total_passed = sum(s["passed"] for s in suites_results)
    total_failed = sum(s["failed"] for s in suites_results)
    success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0.0
    
    # Create response
    suites = [TestSuiteResult(**s) for s in suites_results]
    timestamp = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    
    response = TestResultsResponse(
        timestamp=timestamp,
        total_tests=total_tests,
        passed=total_passed,
        failed=total_failed,
        success_rate=round(success_rate, 2),
        suites=suites
    )
    
    print(f"\n✅ Weekly tests completed: {total_passed}/{total_tests} passed ({success_rate:.2f}%)")
    return response


def run_monthly_tests() -> TestResultsResponse:
    """
    Run monthly test suites (Adversarial, Multi-Model).
    These use real LLM with multiple providers and take the longest.
    
    Returns:
        TestResultsResponse with monthly test results
    """
    print("🚀 Running monthly tests (Adversarial, Multi-Model)...")
    
    suites_results = []
    
    # Run Adversarial tests
    print("\n📦 Running Adversarial tests...")
    adversarial_config = TEST_SUITES["adversarial"]
    adversarial_results = run_pytest_suite(adversarial_config["path"])
    suites_results.append({
        "name": adversarial_config["name"],
        "tests": adversarial_results["total"],
        "passed": adversarial_results["passed"],
        "failed": adversarial_results["failed"],
        "rate": (adversarial_results["passed"] / adversarial_results["total"] * 100) if adversarial_results["total"] > 0 else 0.0,
        "type": adversarial_config["type"],
        "description": adversarial_config["description"]
    })
    
    # Run Multi-Model tests
    print("\n📦 Running Multi-Model tests...")
    multimodel_config = TEST_SUITES["multimodel"]
    multimodel_results = run_pytest_suite(multimodel_config["path"])
    suites_results.append({
        "name": multimodel_config["name"],
        "tests": multimodel_results["total"],
        "passed": multimodel_results["passed"],
        "failed": multimodel_results["failed"],
        "rate": (multimodel_results["passed"] / multimodel_results["total"] * 100) if multimodel_results["total"] > 0 else 0.0,
        "type": multimodel_config["type"],
        "description": multimodel_config["description"]
    })
    
    # Calculate totals
    total_tests = sum(s["tests"] for s in suites_results)
    total_passed = sum(s["passed"] for s in suites_results)
    total_failed = sum(s["failed"] for s in suites_results)
    success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0.0
    
    # Create response
    suites = [TestSuiteResult(**s) for s in suites_results]
    timestamp = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    
    response = TestResultsResponse(
        timestamp=timestamp,
        total_tests=total_tests,
        passed=total_passed,
        failed=total_failed,
        success_rate=round(success_rate, 2),
        suites=suites
    )
    
    print(f"\n✅ Monthly tests completed: {total_passed}/{total_tests} passed ({success_rate:.2f}%)")
    return response


def main():
    """CLI entry point for running tests"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Run EZA test suites")
    parser.add_argument(
        "mode",
        choices=["daily", "weekly", "monthly"],
        help="Test mode to run"
    )
    
    args = parser.parse_args()
    
    # Run appropriate test suite
    if args.mode == "daily":
        results = run_daily_tests()
    elif args.mode == "weekly":
        results = run_weekly_tests()
    elif args.mode == "monthly":
        results = run_monthly_tests()
    else:
        print(f"❌ Unknown mode: {args.mode}")
        sys.exit(1)
    
    # Write results to JSON
    write_results(results)
    print(f"\n💾 Results saved to test_results.json")
    
    # Exit with appropriate code
    sys.exit(0 if results.failed == 0 else 1)


if __name__ == "__main__":
    main()

