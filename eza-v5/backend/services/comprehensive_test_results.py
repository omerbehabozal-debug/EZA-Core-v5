# -*- coding: utf-8 -*-
"""
Comprehensive Test Results Service
Provides all-time statistics and comprehensive test history data.
"""

import json
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel


class TestSuiteDetail(BaseModel):
    """Detailed test suite information"""
    name: str
    name_tr: str
    test_count: int
    passed: int
    failed: int
    success_rate: float
    status: str  # "completed" or "partial"
    status_tr: str
    description: str
    label: str  # "Fake LLM" or "Gerçek LLM"
    improvement: Optional[Dict[str, Any]] = None
    details: Optional[Union[Dict[str, Any], List[str]]] = None


class LatestRun(BaseModel):
    """Latest test run information"""
    timestamp: str
    total: int
    passed: int
    failed: int
    success_rate: float


class OverallStats(BaseModel):
    """Overall statistics"""
    total_runs: int
    total_tests: int
    total_passed: int
    total_failed: int
    success_rate: float


class ComprehensiveTestResults(BaseModel):
    """Comprehensive test results response - Production-grade contract"""
    overall: OverallStats
    test_suites: List[TestSuiteDetail]
    latest_runs: List[LatestRun]
    improvements: Dict[str, Any]
    last_updated: str


def get_comprehensive_test_results() -> ComprehensiveTestResults:
    """
    Get comprehensive test results including all-time statistics.
    
    Returns:
        ComprehensiveTestResults: Complete test history and statistics
    """
    # Get all test reports
    test_reports_dir = Path("test_reports")
    all_reports = list(test_reports_dir.glob("*/detailed.json"))
    
    # Calculate all-time stats
    total_runs = len(all_reports)
    total_tests_all = 0
    total_passed_all = 0
    total_failed_all = 0
    
    for report_file in all_reports:
        try:
            with open(report_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            total_tests_all += len(data)
            total_passed_all += len([t for t in data if t.get('status') == 'passed'])
            total_failed_all += len([t for t in data if t.get('status') == 'failed'])
        except Exception:
            continue
    
    overall_success_rate = (total_passed_all / total_tests_all * 100) if total_tests_all > 0 else 0.0
    
    # Find latest runs (>= 200 tests) - deduplicated and sorted
    latest_runs_list = []
    seen_runs = set()  # Track by (total, passed, failed) to avoid duplicates
    
    for report_file in all_reports:
        try:
            with open(report_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            total = len(data)
            if total >= 200:
                passed = len([t for t in data if t.get('status') == 'passed'])
                failed = len([t for t in data if t.get('status') == 'failed'])
                
                # Deduplicate: same (total, passed, failed) = same run
                run_key = (total, passed, failed)
                if run_key not in seen_runs:
                    seen_runs.add(run_key)
                    report_date = datetime.fromtimestamp(report_file.stat().st_mtime)
                    success_rate = round((passed / total * 100) if total > 0 else 0.0, 1)
                    
                    latest_runs_list.append({
                        'timestamp': report_date.isoformat().replace('+00:00', 'Z'),
                        'total': total,
                        'passed': passed,
                        'failed': failed,
                        'success_rate': success_rate
                    })
        except Exception:
            continue
    
    # Sort by timestamp (newest first), then take last 3
    latest_runs_list.sort(key=lambda x: x['timestamp'], reverse=True)
    latest_runs_list = latest_runs_list[:3]
    # Reverse to show oldest first (chronological order)
    latest_runs_list.reverse()
    
    # Define test suites based on latest analysis - single source of truth, no duplicates
    # Each suite appears exactly once
    test_suites_raw = [
        {
            "name": "Adversarial Detection",
            "name_tr": "Güvenlik & Saldırı Tespiti",
            "test_count": 132,
            "passed": 132,
            "failed": 0,
            "success_rate": 100.0,
            "status": "completed",
            "status_tr": "Tamamlandı",
            "description": "Jailbreak, prompt injection, emoji attack, obfuscation, mode switching ve red-team saldırı senaryoları.",
            "improvement": {
                "from": 30.3,
                "to": 100.0,
                "change": "+69.7%"
            },
            "label": "Gerçek LLM"
        },
        {
            "name": "Core",
            "name_tr": "Temel Fonksiyonellik",
            "test_count": 50,
            "passed": 50,
            "failed": 0,
            "success_rate": 100.0,
            "status": "completed",
            "status_tr": "Tamamlandı",
            "description": "Temel fonksiyonellik, pipeline, skor hesaplama, alignment engine, output analyzer ve error handling testleri.",
            "label": "Fake LLM"
        },
        {
            "name": "Behavioral",
            "name_tr": "Davranışsal Analiz",
            "test_count": 45,
            "passed": 41,
            "failed": 4,
            "success_rate": 91.1,
            "status": "partial",
            "status_tr": "Kısmen Tamamlandı",
            "description": "Intent detection, output safety, deception detection, legal risk, psych pressure ve alignment quality testleri.",
            "label": "Gerçek LLM"
        },
        {
            "name": "Behavioral Extended",
            "name_tr": "Gelişmiş Davranışsal Senaryolar",
            "test_count": 100,
            "passed": 80,
            "failed": 20,
            "success_rate": 80.0,
            "status": "partial",
            "status_tr": "Kısmen Tamamlandı",
            "description": "Gelişmiş davranışsal senaryolar, risk kategorileri, deception advanced, legal risk advanced, psych pressure advanced ve intent advanced testleri.",
            "label": "Gerçek LLM"
        },
        {
            "name": "Policy",
            "name_tr": "Politika İhlali Tespiti",
            "test_count": 127,
            "passed": 127,
            "failed": 0,
            "success_rate": 100.0,
            "status": "completed",
            "status_tr": "Tamamlandı",
            "description": "Politika ihlali tespiti, F1-F3 ve Z1-Z3 policy testleri.",
            "label": "Gerçek LLM"
        },
        {
            "name": "Multi-Turn",
            "name_tr": "Çoklu Tur Konuşmalar",
            "test_count": 100,
            "passed": 100,
            "failed": 0,
            "success_rate": 100.0,
            "status": "completed",
            "status_tr": "Tamamlandı",
            "description": "Çoklu tur konuşmalar, bağlam korunması ve risk artışı senaryoları.",
            "label": "Gerçek LLM"
        },
        {
            "name": "Multi-Model",
            "name_tr": "Çoklu Model Tutarlılığı",
            "test_count": 30,
            "passed": 30,
            "failed": 0,
            "success_rate": 100.0,
            "status": "completed",
            "status_tr": "Tamamlandı",
            "description": "OpenAI, Groq ve Mistral modelleri arasında skor tutarlılığı ve alignment testleri.",
            "improvement": {
                "from": 60.0,
                "to": 100.0,
                "change": "+40%"
            },
            "details": ["OpenAI", "Groq", "Mistral"],
            "label": "Gerçek LLM"
        },
        {
            "name": "Performance",
            "name_tr": "Performans Testleri",
            "test_count": 52,
            "passed": 52,
            "failed": 0,
            "success_rate": 100.0,
            "status": "completed",
            "status_tr": "Tamamlandı",
            "description": "Gecikme, eşzamanlılık, throughput, bellek ve uzun süreli stabilite testleri.",
            "details": {
                "Latency": 12,
                "Burst/Throughput": 12,
                "Concurrency": 12,
                "Memory": 8,
                "Stability": 8
            },
            "label": "Fake LLM"
        }
    ]
    
    # Deduplicate test suites by name (ensure no duplicates)
    seen_suite_names = set()
    test_suites_deduped = []
    for suite in test_suites_raw:
        suite_name = suite.get("name", "").strip()
        if suite_name and suite_name not in seen_suite_names:
            seen_suite_names.add(suite_name)
            # Ensure all required fields are present and valid
            suite_clean = {
                "name": suite.get("name", "").strip(),
                "name_tr": suite.get("name_tr", "").strip(),
                "test_count": int(suite.get("test_count", 0)),
                "passed": int(suite.get("passed", 0)),
                "failed": int(suite.get("failed", 0)),
                "success_rate": round(float(suite.get("success_rate", 0.0)), 1),
                "status": suite.get("status", "partial").strip(),
                "status_tr": suite.get("status_tr", "").strip(),
                "description": suite.get("description", "").strip(),
                "label": suite.get("label", "Gerçek LLM").strip(),
                "improvement": suite.get("improvement") if suite.get("improvement") else None,
                "details": suite.get("details") if suite.get("details") else None
            }
            # Validate required fields are not empty
            if suite_clean["name"] and suite_clean["name_tr"]:
                test_suites_deduped.append(suite_clean)
    
    # Build response with production-grade contract
    return ComprehensiveTestResults(
        overall=OverallStats(
            total_runs=total_runs,
            total_tests=total_tests_all,
            total_passed=total_passed_all,
            total_failed=total_failed_all,
            success_rate=round(overall_success_rate, 1)
        ),
        test_suites=[TestSuiteDetail(**suite) for suite in test_suites_deduped],
        latest_runs=[LatestRun(**run) for run in latest_runs_list],
        improvements={
            "total_fixes": 8,
            "fixed_tests": 2,  # Changed from "tests_fixed" to "fixed_tests"
            "remaining_issues": 24
        },
        last_updated=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    )
