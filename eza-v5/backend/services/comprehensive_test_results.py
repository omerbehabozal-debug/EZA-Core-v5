# -*- coding: utf-8 -*-
"""
Comprehensive Test Results Service
Provides all-time statistics and comprehensive test history data.
Production-grade response contract with deduplication and normalization.
"""

import json
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator


class TestSuiteDetail(BaseModel):
    """Canonical test suite information - single source of truth"""
    name: str
    name_tr: Optional[str] = None
    test_count: int
    passed: int
    failed: int
    success_rate: float = Field(ge=0.0, le=100.0)
    status: str = Field(pattern="^(completed|partial)$")
    status_tr: Optional[str] = None
    description: Optional[str] = None
    label: Optional[str] = None
    improvement: Optional[Dict[str, Any]] = None
    details: Optional[Union[Dict[str, Any], List[str]]] = None

    @field_validator('success_rate')
    @classmethod
    def round_success_rate(cls, v: float) -> float:
        """Round success rate to one decimal"""
        return round(float(v), 1)


class LatestRun(BaseModel):
    """Latest test run information - canonical format"""
    timestamp: str
    total: int
    passed: int
    failed: int
    success_rate: float = Field(ge=0.0, le=100.0)

    @field_validator('success_rate')
    @classmethod
    def round_success_rate(cls, v: float) -> float:
        """Round success rate to one decimal"""
        return round(float(v), 1)

    @field_validator('timestamp')
    @classmethod
    def normalize_timestamp(cls, v: str) -> str:
        """Ensure ISO-8601 format with Z suffix"""
        if isinstance(v, str):
            # Remove +00:00 and add Z if needed
            v = v.replace('+00:00', 'Z')
            if not v.endswith('Z') and '+' not in v:
                v = v + 'Z'
        return v


class OverallStats(BaseModel):
    """Overall statistics - canonical format"""
    total_runs: int
    total_tests: int
    total_passed: int
    total_failed: int
    success_rate: float = Field(ge=0.0, le=100.0)

    @field_validator('success_rate')
    @classmethod
    def round_success_rate(cls, v: float) -> float:
        """Round success rate to one decimal"""
        return round(float(v), 1)


class ComprehensiveTestResults(BaseModel):
    """Comprehensive test results response - production-grade contract"""
    overall: OverallStats
    test_suites: List[TestSuiteDetail]
    latest_runs: List[LatestRun]
    improvements: Dict[str, int]
    last_updated: str

    @field_validator('last_updated')
    @classmethod
    def normalize_timestamp(cls, v: str) -> str:
        """Ensure ISO-8601 format with Z suffix"""
        if isinstance(v, str):
            v = v.replace('+00:00', 'Z')
            if not v.endswith('Z') and '+' not in v:
                v = v + 'Z'
        return v


def normalize_field_name(field_name: str) -> str:
    """
    Normalize field names from TR/EN variants to canonical English names.
    
    Maps:
    - ad / name → name
    - ad_tr / name_tr → name_tr
    - test_sayısı / test_count → test_count
    - geçti / passed → passed
    - başarısız / failed → failed
    - başarı_oranı / success_rate → success_rate
    - durum / status → status
    - durum_tr / status_tr → status_tr
    - açıklama / description → description
    - etiket / label → label
    - iyileştirme / improvement → improvement
    - detaylar / details → details
    - zaman_damgası / date / timestamp → timestamp
    """
    mapping = {
        # TR variants
        "ad": "name",
        "ad_tr": "name_tr",
        "test_sayısı": "test_count",
        "geçti": "passed",
        "başarısız": "failed",
        "başarı_oranı": "success_rate",
        "durum": "status",
        "durum_tr": "status_tr",
        "açıklama": "description",
        "etiket": "label",
        "iyileştirme": "improvement",
        "detaylar": "details",
        "zaman_damgası": "timestamp",
        # EN variants (already canonical, but ensure consistency)
        "name": "name",
        "name_tr": "name_tr",
        "test_count": "test_count",
        "passed": "passed",
        "failed": "failed",
        "success_rate": "success_rate",
        "status": "status",
        "status_tr": "status_tr",
        "description": "description",
        "label": "label",
        "improvement": "improvement",
        "details": "details",
        "date": "timestamp",
        "timestamp": "timestamp",
    }
    return mapping.get(field_name.lower(), field_name)


def normalize_suite_data(suite_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize test suite data to canonical format.
    Handles TR/EN field name variants and type conversion.
    """
    normalized = {}
    
    # Field name mapping
    field_mapping = {
        "name": normalize_field_name,
        "name_tr": normalize_field_name,
        "test_count": normalize_field_name,
        "passed": normalize_field_name,
        "failed": normalize_field_name,
        "success_rate": normalize_field_name,
        "status": normalize_field_name,
        "status_tr": normalize_field_name,
        "description": normalize_field_name,
        "label": normalize_field_name,
        "improvement": normalize_field_name,
        "details": normalize_field_name,
    }
    
    # Normalize all fields
    for key, value in suite_data.items():
        canonical_key = normalize_field_name(key)
        if canonical_key in ["name", "name_tr", "status", "status_tr", "description", "label"]:
            # String fields - strip and convert empty to None
            normalized[canonical_key] = str(value).strip() if value else None
            if normalized[canonical_key] == "":
                normalized[canonical_key] = None
        elif canonical_key in ["test_count", "passed", "failed"]:
            # Integer fields
            try:
                normalized[canonical_key] = int(value) if value is not None else 0
            except (ValueError, TypeError):
                normalized[canonical_key] = 0
        elif canonical_key == "success_rate":
            # Float field - round to 1 decimal
            try:
                normalized[canonical_key] = round(float(value), 1) if value is not None else 0.0
            except (ValueError, TypeError):
                normalized[canonical_key] = 0.0
        elif canonical_key in ["improvement", "details"]:
            # Object/array fields - keep as is or None
            normalized[canonical_key] = value if value else None
        else:
            # Unknown field - skip (don't add to response)
            continue
    
    # Ensure required fields have defaults
    if "name" not in normalized or not normalized["name"]:
        return None  # Invalid suite, skip
    
    # Set defaults for optional fields
    normalized.setdefault("name_tr", None)
    normalized.setdefault("status", "partial")
    normalized.setdefault("status_tr", None)
    normalized.setdefault("description", None)
    normalized.setdefault("label", None)
    normalized.setdefault("improvement", None)
    normalized.setdefault("details", None)
    normalized.setdefault("test_count", 0)
    normalized.setdefault("passed", 0)
    normalized.setdefault("failed", 0)
    normalized.setdefault("success_rate", 0.0)
    
    return normalized


def normalize_run_data(run_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize latest run data to canonical format.
    Handles TR/EN field name variants and type conversion.
    """
    normalized = {}
    
    # Normalize timestamp
    timestamp_key = None
    for key in ["timestamp", "date", "zaman_damgası"]:
        if key in run_data:
            timestamp_key = key
            break
    
    if timestamp_key:
        timestamp_value = run_data[timestamp_key]
        if isinstance(timestamp_value, datetime):
            normalized["timestamp"] = timestamp_value.isoformat().replace('+00:00', 'Z')
        elif isinstance(timestamp_value, str):
            normalized["timestamp"] = timestamp_value.replace('+00:00', 'Z')
            if not normalized["timestamp"].endswith('Z') and '+' not in normalized["timestamp"]:
                normalized["timestamp"] = normalized["timestamp"] + 'Z'
        else:
            return None  # Invalid timestamp
    else:
        return None  # No timestamp found
    
    # Normalize numeric fields
    for key in ["total", "passed", "failed"]:
        canonical_key = normalize_field_name(key)
        try:
            normalized[canonical_key] = int(run_data.get(key, 0))
        except (ValueError, TypeError):
            normalized[canonical_key] = 0
    
    # Normalize success_rate
    success_rate_key = normalize_field_name("success_rate")
    if success_rate_key in run_data:
        try:
            normalized["success_rate"] = round(float(run_data[success_rate_key]), 1)
        except (ValueError, TypeError):
            # Calculate from passed/total
            total = normalized.get("total", 0)
            passed = normalized.get("passed", 0)
            normalized["success_rate"] = round((passed / total * 100) if total > 0 else 0.0, 1)
    else:
        # Calculate from passed/total
        total = normalized.get("total", 0)
        passed = normalized.get("passed", 0)
        normalized["success_rate"] = round((passed / total * 100) if total > 0 else 0.0, 1)
    
    return normalized


def get_comprehensive_test_results() -> ComprehensiveTestResults:
    """
    Get comprehensive test results including all-time statistics.
    
    Returns production-grade response with:
    - Deduplicated test suites (by name)
    - Deduplicated latest runs (by timestamp, total, passed, failed)
    - Normalized field names (TR/EN variants → canonical)
    - Valid JSON-safe data structure
    
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
    
    overall_success_rate = round((total_passed_all / total_tests_all * 100) if total_tests_all > 0 else 0.0, 1)
    
    # Find latest runs (>= 200 tests) - DEDUPLICATED
    latest_runs_list = []
    seen_runs = set()  # Track by (timestamp, total, passed, failed) to avoid duplicates
    
    for report_file in all_reports:
        try:
            with open(report_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            total = len(data)
            if total >= 200:
                passed = len([t for t in data if t.get('status') == 'passed'])
                failed = len([t for t in data if t.get('status') == 'failed'])
                report_date = datetime.fromtimestamp(report_file.stat().st_mtime)
                
                # Create normalized run data
                run_data = {
                    "timestamp": report_date.isoformat(),
                    "total": total,
                    "passed": passed,
                    "failed": failed,
                    "success_rate": (passed / total * 100) if total > 0 else 0.0
                }
                
                normalized_run = normalize_run_data(run_data)
                if not normalized_run:
                    continue
                
                # Deduplicate: same (timestamp, total, passed, failed) = same run
                run_key = (
                    normalized_run["timestamp"],
                    normalized_run["total"],
                    normalized_run["passed"],
                    normalized_run["failed"]
                )
                
                if run_key not in seen_runs:
                    seen_runs.add(run_key)
                    latest_runs_list.append(normalized_run)
        except Exception:
            continue
    
    # Sort by timestamp (newest first), then take last 3
    latest_runs_list.sort(key=lambda x: x['timestamp'], reverse=True)
    latest_runs_list = latest_runs_list[:3]
    # Reverse to show oldest first (chronological order)
    latest_runs_list.reverse()
    
    # Define test suites - SINGLE SOURCE OF TRUTH, NO DUPLICATES
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
    
    # Normalize and deduplicate test suites by name
    seen_suite_names = set()
    test_suites_deduped = []
    
    for suite in test_suites_raw:
        normalized_suite = normalize_suite_data(suite)
        if not normalized_suite:
            continue
        
        suite_name = normalized_suite.get("name", "").strip()
        if suite_name and suite_name not in seen_suite_names:
            seen_suite_names.add(suite_name)
            test_suites_deduped.append(normalized_suite)
    
    # Build response with production-grade contract
    # Use Pydantic models for validation and JSON safety
    return ComprehensiveTestResults(
        overall=OverallStats(
            total_runs=total_runs,
            total_tests=total_tests_all,
            total_passed=total_passed_all,
            total_failed=total_failed_all,
            success_rate=overall_success_rate
        ),
        test_suites=[TestSuiteDetail(**suite) for suite in test_suites_deduped],
        latest_runs=[LatestRun(**run) for run in latest_runs_list],
        improvements={
            "total_fixes": 8,
            "fixed_tests": 2,
            "remaining_issues": 24
        },
        last_updated=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    )
