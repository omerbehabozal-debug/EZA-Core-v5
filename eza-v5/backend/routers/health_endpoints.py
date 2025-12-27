# -*- coding: utf-8 -*-
"""
Sağlık Bakanlığı - Clinical & Health AI Oversight Endpoints
Health-focused oversight for health regulatory authorities
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth_production import require_proxy_auth_production
from backend.models.production import IntentLog, ImpactEvent, Organization

router = APIRouter()
logger = logging.getLogger(__name__)


def is_health_related(intent_log: IntentLog) -> bool:
    """Check if IntentLog is health-related based on sector or policy set"""
    # Check sector
    if intent_log.sector and intent_log.sector.lower() == "health":
        return True
    
    # Check policy set for health-related policies
    if intent_log.policy_set:
        policies = []
        if isinstance(intent_log.policy_set, dict):
            policies = intent_log.policy_set.get('policies', []) or []
        elif isinstance(intent_log.policy_set, list):
            policies = intent_log.policy_set
        
        policy_str = ' '.join(str(p).upper() for p in policies)
        # Health-related policy keywords
        health_keywords = ['HEALTH', 'CLINICAL', 'PATIENT_SAFETY', 'MEDICAL', 'HOSPITAL']
        if any(keyword in policy_str for keyword in health_keywords):
            return True
    
    return False


def classify_clinical_ai_system(source_system: str) -> str:
    """Classify clinical AI system type"""
    if not source_system:
        return "Unknown"
    
    source_lower = source_system.lower()
    
    if 'triage' in source_lower or 'triage' in source_lower:
        return "Triage"
    elif 'diagnostic' in source_lower or 'diagnosis' in source_lower or 'diagnose' in source_lower:
        return "Diagnostic"
    elif 'assistant' in source_lower or 'assist' in source_lower or 'clinical' in source_lower:
        return "Assistant"
    else:
        return "Assistant"  # Default for clinical systems


def extract_clinical_risk_category(flags: Any) -> str:
    """Extract clinical risk category from flags"""
    if not flags:
        return "Unknown"
    
    flag_list = []
    if isinstance(flags, dict):
        flag_list = flags.get('flags', []) or flags.get('risk_flags_severity', []) or []
    elif isinstance(flags, list):
        flag_list = flags
    
    for flag in flag_list:
        flag_name = ""
        if isinstance(flag, dict):
            flag_name = flag.get('flag', '') or flag.get('type', '') or str(flag)
        elif isinstance(flag, str):
            flag_name = flag
        
        flag_lower = flag_name.lower()
        
        if 'patient' in flag_lower and 'safety' in flag_lower:
            return "PATIENT_SAFETY"
        elif 'misguidance' in flag_lower or 'misleading' in flag_lower or 'incorrect' in flag_lower:
            return "MISGUIDANCE"
    
    return "Unknown"


def check_fail_safe_triggered(flags: Any) -> bool:
    """Check if fail-safe was triggered"""
    if not flags:
        return False
    
    if isinstance(flags, dict):
        fail_safe = flags.get('fail_safe_triggered') or flags.get('fail_safe') or flags.get('fail_safe_activated')
        if fail_safe:
            return True
    
    # Check in flag list
    flag_list = []
    if isinstance(flags, dict):
        flag_list = flags.get('flags', []) or []
    elif isinstance(flags, list):
        flag_list = flags
    
    for flag in flag_list:
        if isinstance(flag, dict):
            flag_name = flag.get('flag', '') or flag.get('type', '')
            if 'fail' in flag_name.lower() and 'safe' in flag_name.lower():
                return True
        elif isinstance(flag, str):
            if 'fail' in flag.lower() and 'safe' in flag.lower():
                return True
    
    return False


@router.get("/health/dashboard")
async def get_health_dashboard(
    days: int = Query(7, ge=1, le=90, description="Number of days for metrics"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Health Dashboard - Clinical AI ecosystem overview
    
    Only accessible by REGULATOR_HEALTH and REGULATOR_CLINICAL_AUDITOR roles.
    """
    is_health = current_user.get("is_health", False)
    if not is_health:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sağlık düzenleyici erişimi gerekli"
        )
    
    try:
        from_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all health-related IntentLogs
        intent_logs_query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        intent_logs_result = await db.execute(intent_logs_query)
        all_logs = intent_logs_result.scalars().all()
        
        # Filter health-related logs
        health_logs = [log for log in all_logs if is_health_related(log)]
        
        # Get distinct health institutions
        health_org_ids = set(log.organization_id for log in health_logs)
        active_health_institutions = len(health_org_ids)
        
        # Get distinct clinical AI systems from ImpactEvent
        log_ids = [log.id for log in health_logs]
        impact_query = select(ImpactEvent).where(
            ImpactEvent.intent_log_id.in_(log_ids),
            ImpactEvent.deleted_by_user == False
        )
        impact_result = await db.execute(impact_query)
        impact_events = impact_result.scalars().all()
        
        clinical_systems = set()
        for impact in impact_events:
            if impact.source_system:
                system_type = classify_clinical_ai_system(impact.source_system)
                clinical_systems.add(system_type)
        
        clinical_ai_systems_observed = len(clinical_systems)
        
        # Fail-safe trigger count
        fail_safe_count = sum(1 for log in health_logs if check_fail_safe_triggered(log.flags))
        
        # High-risk clinical events
        high_risk_count = 0
        risk_distribution = {"low": 0, "medium": 0, "high": 0}
        ethical_scores = []
        
        for log in health_logs:
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            ethical_scores.append(ethical_score)
            
            if ethical_score < 50:
                risk_distribution["high"] += 1
                high_risk_count += 1
            elif ethical_score < 80:
                risk_distribution["medium"] += 1
            else:
                risk_distribution["low"] += 1
        
        avg_ethical_index = sum(ethical_scores) / len(ethical_scores) if ethical_scores else 0
        
        # Fail-safe frequency over time
        fail_safe_daily: Dict[str, int] = {}
        for log in health_logs:
            if check_fail_safe_triggered(log.flags):
                date_key = log.created_at.date().isoformat() if log.created_at else None
                if date_key:
                    fail_safe_daily[date_key] = fail_safe_daily.get(date_key, 0) + 1
        
        fail_safe_frequency = []
        for date_key in sorted(fail_safe_daily.keys()):
            fail_safe_frequency.append({
                "date": date_key,
                "count": fail_safe_daily[date_key]
            })
        
        # Clinical risk categories
        risk_categories: Dict[str, int] = {
            "PATIENT_SAFETY": 0,
            "MISGUIDANCE": 0
        }
        
        for log in health_logs:
            category = extract_clinical_risk_category(log.flags)
            if category in risk_categories:
                risk_categories[category] += 1
        
        return {
            "ok": True,
            "metrics": {
                "active_health_institutions": active_health_institutions,
                "clinical_ai_systems_observed": clinical_ai_systems_observed,
                "fail_safe_trigger_count": fail_safe_count,
                "high_risk_clinical_events": high_risk_count,
                "average_ethical_index_health": round(avg_ethical_index, 1),
                "risk_distribution": risk_distribution,
                "clinical_risk_categories": risk_categories,
                "fail_safe_frequency": fail_safe_frequency
            }
        }
    
    except Exception as e:
        logger.error(f"[Health] Error generating dashboard: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sağlık dashboard oluşturulamadı"
        )


@router.get("/health/institutions")
async def get_health_institutions(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Health Institution Monitor - Health regulator view
    
    Returns health institutions with their AI usage metrics.
    Institution names are VISIBLE (not anonymized).
    """
    is_health = current_user.get("is_health", False)
    if not is_health:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sağlık düzenleyici erişimi gerekli"
        )
    
    try:
        # Get all health-related IntentLogs (last 30 days)
        from_date = datetime.utcnow() - timedelta(days=30)
        intent_logs_query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        intent_logs_result = await db.execute(intent_logs_query)
        all_logs = intent_logs_result.scalars().all()
        
        # Filter health-related logs
        health_logs = [log for log in all_logs if is_health_related(log)]
        
        # Group by organization
        org_data: Dict[str, Dict[str, Any]] = {}
        
        for log in health_logs:
            org_id_str = str(log.organization_id)
            
            if org_id_str not in org_data:
                org_data[org_id_str] = {
                    "organization_id": org_id_str,
                    "organization_name": None,
                    "ai_system_types": set(),
                    "ethical_scores": [],
                    "fail_safe_count": 0,
                    "total_events": 0,
                    "last_activity": None
                }
            
            data = org_data[org_id_str]
            data["total_events"] += 1
            
            # Track ethical scores
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            data["ethical_scores"].append(ethical_score)
            
            # Track fail-safe triggers
            if check_fail_safe_triggered(log.flags):
                data["fail_safe_count"] += 1
            
            # Track AI system types from ImpactEvent
            impact_query = select(ImpactEvent).where(
                ImpactEvent.intent_log_id == log.id,
                ImpactEvent.deleted_by_user == False
            )
            impact_result = await db.execute(impact_query)
            impact_events = impact_result.scalars().all()
            
            for impact in impact_events:
                if impact.source_system:
                    system_type = classify_clinical_ai_system(impact.source_system)
                    data["ai_system_types"].add(system_type)
            
            # Update last activity
            if log.created_at:
                if not data["last_activity"] or log.created_at > data["last_activity"]:
                    data["last_activity"] = log.created_at
        
        # Fetch organization names
        org_ids = [uuid.UUID(org_id) for org_id in org_data.keys()]
        if org_ids:
            orgs_query = select(Organization).where(Organization.id.in_(org_ids))
            orgs_result = await db.execute(orgs_query)
            orgs = {str(org.id): org for org in orgs_result.scalars().all()}
            
            for org_id_str, data in org_data.items():
                org = orgs.get(org_id_str)
                if org:
                    data["organization_name"] = org.name
        
        # Calculate metrics for each institution
        institutions = []
        for org_id_str, data in org_data.items():
            if not data["organization_name"]:
                continue
            
            # Calculate average ethical index
            avg_ethical = sum(data["ethical_scores"]) / len(data["ethical_scores"]) if data["ethical_scores"] else 0
            
            # Determine primary AI system type
            primary_system_type = list(data["ai_system_types"])[0] if data["ai_system_types"] else "Assistant"
            
            # Determine clinical usage intensity
            total_events = data["total_events"]
            if total_events >= 100:
                usage_intensity = "High"
            elif total_events >= 20:
                usage_intensity = "Medium"
            else:
                usage_intensity = "Low"
            
            # Fail-safe rate
            fail_safe_rate = (data["fail_safe_count"] / total_events * 100) if total_events > 0 else 0
            
            # Determine risk trend
            trend = "Stable"
            scores = data["ethical_scores"]
            if len(scores) >= 10:
                recent_avg = sum(scores[-10:]) / 10
                older_avg = sum(scores[:10]) / 10
                if recent_avg < older_avg - 5:
                    trend = "Deteriorating"
                elif recent_avg > older_avg + 5:
                    trend = "Improving"
            
            institutions.append({
                "organization_id": org_id_str,
                "institution_name": data["organization_name"],
                "ai_system_type": primary_system_type,
                "clinical_usage_intensity": usage_intensity,
                "fail_safe_rate": round(fail_safe_rate, 1),
                "average_ethical_index": round(avg_ethical, 1),
                "risk_trend": trend,
                "last_activity": data["last_activity"].isoformat() if data["last_activity"] else None
            })
        
        # Sort by fail-safe rate (descending)
        institutions.sort(key=lambda x: x["fail_safe_rate"], reverse=True)
        
        return {
            "ok": True,
            "institutions": institutions
        }
    
    except Exception as e:
        logger.error(f"[Health] Error fetching institutions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Kurumlar alınamadı"
        )


@router.get("/health/audit-logs")
async def get_health_audit_logs(
    from_date: Optional[str] = Query(None, description="From date (ISO format)"),
    to_date: Optional[str] = Query(None, description="To date (ISO format)"),
    institution_id: Optional[str] = Query(None, description="Health institution ID"),
    risk_category: Optional[str] = Query(None, description="Risk category filter"),
    risk_level: Optional[str] = Query(None, description="Risk level: low, medium, high"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Clinical Audit Logs - Health regulator view
    
    Returns health-related audit events ONLY.
    NO medical content, NO diagnoses, NO treatment recommendations.
    """
    is_health = current_user.get("is_health", False)
    if not is_health:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sağlık düzenleyici erişimi gerekli"
        )
    
    try:
        # Build query
        query = select(IntentLog).where(IntentLog.deleted_by_user == False)
        
        # Date filters
        if from_date:
            try:
                from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
                query = query.where(IntentLog.created_at >= from_dt)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid from_date format"
                )
        
        if to_date:
            try:
                to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
                query = query.where(IntentLog.created_at <= to_dt)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid to_date format"
                )
        
        # Institution filter
        if institution_id:
            try:
                org_uuid = uuid.UUID(institution_id)
                query = query.where(IntentLog.organization_id == org_uuid)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid institution_id format"
                )
        
        # Execute query
        result = await db.execute(query)
        all_logs = result.scalars().all()
        
        # Filter health-related logs
        health_logs = [log for log in all_logs if is_health_related(log)]
        
        # Apply risk level filter
        if risk_level:
            filtered_logs = []
            for log in health_logs:
                ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
                if risk_level == "high" and ethical_score < 50:
                    filtered_logs.append(log)
                elif risk_level == "medium" and 50 <= ethical_score < 80:
                    filtered_logs.append(log)
                elif risk_level == "low" and ethical_score >= 80:
                    filtered_logs.append(log)
            health_logs = filtered_logs
        
        # Apply risk category filter
        if risk_category:
            filtered_logs = []
            for log in health_logs:
                category = extract_clinical_risk_category(log.flags)
                if category.upper() == risk_category.upper():
                    filtered_logs.append(log)
            health_logs = filtered_logs
        
        # Fetch organization names
        org_ids = set(log.organization_id for log in health_logs)
        orgs_query = select(Organization).where(Organization.id.in_(org_ids))
        orgs_result = await db.execute(orgs_query)
        orgs = {str(org.id): org for org in orgs_result.scalars().all()}
        
        # Get ImpactEvents for AI system types
        log_ids = [log.id for log in health_logs]
        impact_query = select(ImpactEvent).where(
            ImpactEvent.intent_log_id.in_(log_ids),
            ImpactEvent.deleted_by_user == False
        )
        impact_result = await db.execute(impact_query)
        impact_events = impact_result.scalars().all()
        
        # Map impact events to logs
        log_impact_map: Dict[str, str] = {}
        for impact in impact_events:
            if impact.intent_log_id and impact.source_system:
                log_impact_map[str(impact.intent_log_id)] = classify_clinical_ai_system(impact.source_system)
        
        # Build response (NO CONTENT)
        audit_entries = []
        for log in health_logs:
            org = orgs.get(str(log.organization_id))
            org_name = org.name if org else "Unknown Institution"
            
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            
            # Determine risk level
            if ethical_score < 50:
                risk_level_str = "High"
            elif ethical_score < 80:
                risk_level_str = "Medium"
            else:
                risk_level_str = "Low"
            
            # Extract risk category
            risk_category_str = extract_clinical_risk_category(log.flags)
            
            # Get AI system type
            ai_system_type = log_impact_map.get(str(log.id), "Assistant")
            
            # Check fail-safe
            fail_safe_triggered = check_fail_safe_triggered(log.flags)
            
            audit_entries.append({
                "id": str(log.id),
                "timestamp": log.created_at.isoformat() if log.created_at else None,
                "institution": org_name,
                "ai_system_type": ai_system_type,
                "risk_category": risk_category_str,
                "risk_level": risk_level_str,
                "risk_score": round(ethical_score, 1),
                "fail_safe_triggered": "Yes" if fail_safe_triggered else "No"
            })
        
        # Sort by timestamp (descending)
        audit_entries.sort(key=lambda x: x["timestamp"] or "", reverse=True)
        
        return {
            "ok": True,
            "count": len(audit_entries),
            "results": audit_entries
        }
    
    except Exception as e:
        logger.error(f"[Health] Error fetching audit logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Denetim kayıtları alınamadı"
        )


@router.get("/health/risk-patterns")
async def get_health_risk_patterns(
    days: int = Query(30, ge=7, le=90, description="Time window in days"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Clinical Risk Patterns - Health regulator view
    
    Detects systemic clinical risks, not individual failures.
    """
    is_health = current_user.get("is_health", False)
    if not is_health:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sağlık düzenleyici erişimi gerekli"
        )
    
    try:
        from_date = datetime.utcnow() - timedelta(days=days)
        
        # Get health-related logs
        query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        result = await db.execute(query)
        all_logs = result.scalars().all()
        
        health_logs = [log for log in all_logs if is_health_related(log)]
        
        # Get ImpactEvents
        log_ids = [log.id for log in health_logs]
        impact_query = select(ImpactEvent).where(
            ImpactEvent.intent_log_id.in_(log_ids),
            ImpactEvent.deleted_by_user == False
        )
        impact_result = await db.execute(impact_query)
        impact_events = impact_result.scalars().all()
        
        # Group by system and institution
        system_patterns: Dict[str, Dict[str, Any]] = {}
        institution_patterns: Dict[str, Dict[str, Any]] = {}
        
        log_map = {str(log.id): log for log in health_logs}
        
        for impact in impact_events:
            if not impact.source_system or not impact.intent_log_id:
                continue
            
            log = log_map.get(str(impact.intent_log_id))
            if not log:
                continue
            
            org_id_str = str(log.organization_id)
            system_name = impact.source_system
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            fail_safe_triggered = check_fail_safe_triggered(log.flags)
            
            # Track institution patterns
            if org_id_str not in institution_patterns:
                institution_patterns[org_id_str] = {
                    "organization_id": org_id_str,
                    "organization_name": None,
                    "high_risk_events": [],
                    "fail_safe_delays": []
                }
            
            if ethical_score < 50:
                institution_patterns[org_id_str]["high_risk_events"].append({
                    "timestamp": log.created_at.isoformat() if log.created_at else None,
                    "score": ethical_score
                })
            
            # Track fail-safe delays (high risk but no fail-safe)
            if ethical_score < 50 and not fail_safe_triggered:
                institution_patterns[org_id_str]["fail_safe_delays"].append({
                    "timestamp": log.created_at.isoformat() if log.created_at else None,
                    "score": ethical_score
                })
            
            # Track system patterns
            if system_name not in system_patterns:
                system_patterns[system_name] = {
                    "system_name": system_name,
                    "system_type": classify_clinical_ai_system(system_name),
                    "unsafe_guidance_count": 0,
                    "total_events": 0
                }
            
            system_patterns[system_name]["total_events"] += 1
            if ethical_score < 50:
                system_patterns[system_name]["unsafe_guidance_count"] += 1
        
        # Fetch organization names
        org_ids = [uuid.UUID(org_id) for org_id in institution_patterns.keys()]
        if org_ids:
            orgs_query = select(Organization).where(Organization.id.in_(org_ids))
            orgs_result = await db.execute(orgs_query)
            orgs = {str(org.id): org for org in orgs_result.scalars().all()}
            
            for org_id_str, pattern in institution_patterns.items():
                org = orgs.get(org_id_str)
                if org:
                    pattern["organization_name"] = org.name
        
        # Build patterns
        repeated_unsafe_guidance = [
            {
                "system_name": name,
                "system_type": data["system_type"],
                "unsafe_guidance_count": data["unsafe_guidance_count"],
                "total_events": data["total_events"],
                "unsafe_ratio": round((data["unsafe_guidance_count"] / data["total_events"] * 100) if data["total_events"] > 0 else 0, 1)
            }
            for name, data in system_patterns.items()
            if data["unsafe_guidance_count"] >= 3  # Repeated unsafe guidance threshold
        ]
        
        repeated_unsafe_guidance.sort(key=lambda x: x["unsafe_guidance_count"], reverse=True)
        
        # Delay in fail-safe activation
        fail_safe_delays = [
            {
                "organization_id": org_id,
                "organization_name": pattern["organization_name"],
                "delay_count": len(pattern["fail_safe_delays"])
            }
            for org_id, pattern in institution_patterns.items()
            if len(pattern["fail_safe_delays"]) > 0
        ]
        
        fail_safe_delays.sort(key=lambda x: x["delay_count"], reverse=True)
        
        # Rising risk institutions
        rising_risk_institutions = []
        for org_id, pattern in institution_patterns.items():
            if len(pattern["high_risk_events"]) >= 5:  # Threshold: 5+ high-risk events
                rising_risk_institutions.append({
                    "organization_id": org_id,
                    "organization_name": pattern["organization_name"],
                    "high_risk_event_count": len(pattern["high_risk_events"])
                })
        
        rising_risk_institutions.sort(key=lambda x: x["high_risk_event_count"], reverse=True)
        
        return {
            "ok": True,
            "repeated_unsafe_guidance": repeated_unsafe_guidance,
            "fail_safe_delays": fail_safe_delays,
            "rising_risk_institutions": rising_risk_institutions,
            "time_window_days": days
        }
    
    except Exception as e:
        logger.error(f"[Health] Error fetching risk patterns: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Risk kalıpları alınamadı"
        )


@router.get("/health/alerts")
async def get_health_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Observational Alerts - Health regulator view
    
    Early warning for clinical risks.
    Alerts are informational, non-punitive, logged only.
    """
    is_health = current_user.get("is_health", False)
    if not is_health:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sağlık düzenleyici erişimi gerekli"
        )
    
    try:
        # Get health logs from last 30 days
        from_date = datetime.utcnow() - timedelta(days=30)
        query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        result = await db.execute(query)
        all_logs = result.scalars().all()
        
        health_logs = [log for log in all_logs if is_health_related(log)]
        
        alerts = []
        
        # Alert 1: Frequent fail-safe triggers
        fail_safe_count = sum(1 for log in health_logs if check_fail_safe_triggered(log.flags))
        fail_safe_rate = (fail_safe_count / len(health_logs) * 100) if health_logs else 0
        
        if fail_safe_rate > 10:  # Threshold: 10%+ fail-safe rate
            alerts.append({
                "type": "Frequent Fail-Safe Triggers",
                "severity": "High",
                "description": f"Son 30 günde %{fail_safe_rate:.1f} fail-safe tetiklenme oranı tespit edildi ({fail_safe_count} olay)",
                "fail_safe_count": fail_safe_count,
                "fail_safe_rate": round(fail_safe_rate, 1),
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Alert 2: Sustained high-risk behavior
        high_risk_count = sum(1 for log in health_logs 
                             if (log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50) < 50)
        high_risk_rate = (high_risk_count / len(health_logs) * 100) if health_logs else 0
        
        if high_risk_rate > 20:  # Threshold: 20%+ high-risk rate
            alerts.append({
                "type": "Sustained High-Risk Behavior",
                "severity": "High",
                "description": f"Son 30 günde %{high_risk_rate:.1f} yüksek riskli klinik olay oranı tespit edildi ({high_risk_count} olay)",
                "high_risk_count": high_risk_count,
                "high_risk_rate": round(high_risk_rate, 1),
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Sort by severity (High first)
        severity_order = {"High": 0, "Medium": 1, "Low": 2}
        alerts.sort(key=lambda a: severity_order.get(a.get("severity", "Low"), 2))
        
        return {
            "ok": True,
            "alerts": alerts,
            "count": len(alerts)
        }
    
    except Exception as e:
        logger.error(f"[Health] Error fetching alerts: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Uyarılar alınamadı"
        )

