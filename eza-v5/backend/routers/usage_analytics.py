# -*- coding: utf-8 -*-
"""
EZA Proxy - Usage Analytics
Daily/monthly usage, top flags, pipeline metrics per organization
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi import Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from collections import Counter

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth import require_proxy_auth
from backend.auth.organization_guard import require_organization_access
from backend.auth.rbac import require_permission
from backend.routers.proxy_audit import audit_store

router = APIRouter()
logger = logging.getLogger(__name__)


class DailyUsageResponse(BaseModel):
    ok: bool
    org_id: str
    date: str
    request_count: int
    risk_avg: float
    fail_rate: float
    token_usage: int
    latency_avg: float


class MonthlyUsageResponse(BaseModel):
    ok: bool
    org_id: str
    month: str
    request_count: int
    risk_avg: float
    fail_rate: float
    total_token_usage: int
    avg_latency: float
    days: List[Dict[str, Any]]


class TopFlagsResponse(BaseModel):
    ok: bool
    org_id: str
    period: str
    flags: List[Dict[str, Any]]  # {flag: str, count: int, avg_severity: float}


class PipelineMetricsResponse(BaseModel):
    ok: bool
    org_id: str
    period: str
    llm_provider_usage: Dict[str, int]  # provider -> count
    avg_latency: float
    pipeline_steps_avg: float
    success_rate: float


def get_audit_entries_for_org(org_id: str, from_date: Optional[str] = None, to_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get audit entries for organization with optional date range"""
    entries = []
    
    for analysis_id, entry in audit_store.items():
        raw_data = entry.get("raw_data", {})
        entry_org_id = raw_data.get("org_id")
        
        if entry_org_id != org_id:
            continue
        
        entry_date = entry.get("timestamp", "")
        
        if from_date and entry_date < from_date:
            continue
        if to_date and entry_date > to_date:
            continue
        
        entries.append(entry)
    
    return entries


@router.get("/{org_id}/usage/daily", response_model=DailyUsageResponse)
async def get_daily_usage(
    org_id: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_organization_access)
):
    """
    Get daily usage statistics for organization
    Organization guard ensures x-org-id header matches org_id
    """
    # Organization guard already verified access
    # Ensure org_id in path matches x-org-id header
    if current_user.get("org_id") != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="org_id mismatch: path org_id does not match x-org-id header"
        )
    
    # Get entries for the date
    from_date = f"{date}T00:00:00"
    to_date = f"{date}T23:59:59"
    entries = get_audit_entries_for_org(org_id, from_date, to_date)
    
    if not entries:
        return DailyUsageResponse(
            ok=True,
            org_id=org_id,
            date=date,
            request_count=0,
            risk_avg=0.0,
            fail_rate=0.0,
            token_usage=0,
            latency_avg=0.0
        )
    
    # Calculate metrics
    request_count = len(entries)
    
    # Risk average (from ethical_index scores)
    risk_scores = []
    total_tokens = 0
    total_latency = 0.0
    failed_count = 0
    
    for entry in entries:
        raw_data = entry.get("raw_data", {})
        scores = raw_data.get("scores", {})
        ethical_score = scores.get("ethical_index", 50)
        risk_scores.append(ethical_score)
        
        # Metadata
        metadata = raw_data.get("metadata", {})
        total_tokens += metadata.get("token_usage", 0)
        total_latency += metadata.get("latency_ms", 0)
        
        # Fail rate (if ethical_score < 50, consider failed)
        if ethical_score < 50:
            failed_count += 1
    
    risk_avg = sum(risk_scores) / len(risk_scores) if risk_scores else 0.0
    fail_rate = (failed_count / request_count) * 100 if request_count > 0 else 0.0
    latency_avg = total_latency / request_count if request_count > 0 else 0.0
    
    return DailyUsageResponse(
        ok=True,
        org_id=org_id,
        date=date,
        request_count=request_count,
        risk_avg=risk_avg,
        fail_rate=fail_rate,
        token_usage=total_tokens,
        latency_avg=latency_avg
    )


@router.get("/{org_id}/usage/monthly", response_model=MonthlyUsageResponse)
async def get_monthly_usage(
    org_id: str,
    month: str = Query(..., description="Month in YYYY-MM format"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_organization_access)
):
    """
    Get monthly usage statistics for organization
    Organization guard ensures x-org-id header matches org_id
    """
    # Organization guard already verified access
    if current_user.get("org_id") != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="org_id mismatch: path org_id does not match x-org-id header"
        )
    
    # Get entries for the month
    from_date = f"{month}-01T00:00:00"
    # Calculate last day of month
    year, month_num = map(int, month.split("-"))
    if month_num == 12:
        to_date = f"{year + 1}-01-01T00:00:00"
    else:
        to_date = f"{year}-{month_num + 1:02d}-01T00:00:00"
    
    entries = get_audit_entries_for_org(org_id, from_date, to_date)
    
    # Group by day
    days_data = {}
    for entry in entries:
        entry_date = entry.get("timestamp", "")[:10]  # YYYY-MM-DD
        if entry_date not in days_data:
            days_data[entry_date] = []
        days_data[entry_date].append(entry)
    
    # Calculate daily metrics
    days = []
    all_risk_scores = []
    total_tokens = 0
    total_latency = 0.0
    failed_count = 0
    
    for day, day_entries in days_data.items():
        day_risk_scores = []
        day_tokens = 0
        day_latency = 0.0
        day_failed = 0
        
        for entry in day_entries:
            raw_data = entry.get("raw_data", {})
            scores = raw_data.get("scores", {})
            ethical_score = scores.get("ethical_index", 50)
            day_risk_scores.append(ethical_score)
            all_risk_scores.append(ethical_score)
            
            metadata = raw_data.get("metadata", {})
            day_tokens += metadata.get("token_usage", 0)
            day_latency += metadata.get("latency_ms", 0)
            total_tokens += metadata.get("token_usage", 0)
            total_latency += metadata.get("latency_ms", 0)
            
            if ethical_score < 50:
                day_failed += 1
                failed_count += 1
        
        days.append({
            "date": day,
            "request_count": len(day_entries),
            "risk_avg": sum(day_risk_scores) / len(day_risk_scores) if day_risk_scores else 0.0,
            "fail_rate": (day_failed / len(day_entries)) * 100 if day_entries else 0.0,
            "token_usage": day_tokens,
            "latency_avg": day_latency / len(day_entries) if day_entries else 0.0,
        })
    
    request_count = len(entries)
    risk_avg = sum(all_risk_scores) / len(all_risk_scores) if all_risk_scores else 0.0
    fail_rate = (failed_count / request_count) * 100 if request_count > 0 else 0.0
    avg_latency = total_latency / request_count if request_count > 0 else 0.0
    
    return MonthlyUsageResponse(
        ok=True,
        org_id=org_id,
        month=month,
        request_count=request_count,
        risk_avg=risk_avg,
        fail_rate=fail_rate,
        total_token_usage=total_tokens,
        avg_latency=avg_latency,
        days=days
    )


@router.get("/{org_id}/usage/top-flags", response_model=TopFlagsResponse)
async def get_top_flags(
    org_id: str,
    period: str = Query("30d", description="Period: 7d, 30d, 90d"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_organization_access)
):
    """
    Get top risk flags for organization
    Organization guard ensures x-org-id header matches org_id
    """
    # Organization guard already verified access
    if current_user.get("org_id") != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="org_id mismatch: path org_id does not match x-org-id header"
        )
    
    # Calculate date range
    days = int(period.replace("d", ""))
    from_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    entries = get_audit_entries_for_org(org_id, from_date)
    
    # Aggregate flags
    flag_counts = Counter()
    flag_severities = {}
    
    for entry in entries:
        risk_flags = entry.get("risk_flags", [])
        for flag_data in risk_flags:
            flag_name = flag_data.get("flag", "unknown")
            severity = flag_data.get("severity", 0.5)
            
            flag_counts[flag_name] += 1
            if flag_name not in flag_severities:
                flag_severities[flag_name] = []
            flag_severities[flag_name].append(severity)
    
    # Build response
    flags = []
    for flag_name, count in flag_counts.most_common(10):
        avg_severity = sum(flag_severities[flag_name]) / len(flag_severities[flag_name])
        flags.append({
            "flag": flag_name,
            "count": count,
            "avg_severity": avg_severity
        })
    
    return TopFlagsResponse(
        ok=True,
        org_id=org_id,
        period=period,
        flags=flags
    )


@router.get("/{org_id}/usage/pipeline-metrics", response_model=PipelineMetricsResponse)
async def get_pipeline_metrics(
    org_id: str,
    period: str = Query("30d", description="Period: 7d, 30d, 90d"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_organization_access)
):
    """
    Get pipeline metrics for organization
    Organization guard ensures x-org-id header matches org_id
    """
    # Organization guard already verified access
    if current_user.get("org_id") != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="org_id mismatch: path org_id does not match x-org-id header"
        )
    
    # Calculate date range
    days = int(period.replace("d", ""))
    from_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
    
    entries = get_audit_entries_for_org(org_id, from_date)
    
    # Aggregate metrics
    provider_counts = Counter()
    total_latency = 0.0
    total_steps = 0
    success_count = 0
    
    for entry in entries:
        raw_data = entry.get("raw_data", {})
        metadata = raw_data.get("metadata", {})
        
        provider = metadata.get("llm_provider", "unknown")
        provider_counts[provider] += 1
        
        latency = metadata.get("latency_ms", 0)
        total_latency += latency
        
        steps = metadata.get("pipeline_steps", 0)
        total_steps += steps
        
        # Success if ethical_index >= 50
        scores = raw_data.get("scores", {})
        if scores.get("ethical_index", 0) >= 50:
            success_count += 1
    
    request_count = len(entries)
    avg_latency = total_latency / request_count if request_count > 0 else 0.0
    pipeline_steps_avg = total_steps / request_count if request_count > 0 else 0.0
    success_rate = (success_count / request_count) * 100 if request_count > 0 else 100.0
    
    return PipelineMetricsResponse(
        ok=True,
        org_id=org_id,
        period=period,
        llm_provider_usage=dict(provider_counts),
        avg_latency=avg_latency,
        pipeline_steps_avg=pipeline_steps_avg,
        success_rate=success_rate
    )

