# -*- coding: utf-8 -*-
"""
BDDK / SPK Financial AI Oversight Endpoints
Finance-focused oversight for financial regulatory authorities
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


def is_finance_related(intent_log: IntentLog) -> bool:
    """Check if IntentLog is finance-related based on sector or policy set"""
    # Check sector
    if intent_log.sector and intent_log.sector.lower() == "finance":
        return True
    
    # Check policy set for finance-related policies
    if intent_log.policy_set:
        policies = []
        if isinstance(intent_log.policy_set, dict):
            policies = intent_log.policy_set.get('policies', []) or []
        elif isinstance(intent_log.policy_set, list):
            policies = intent_log.policy_set
        
        policy_str = ' '.join(str(p).upper() for p in policies)
        # Finance-related policy keywords
        finance_keywords = ['FINTECH', 'FINANCIAL_SAFETY', 'CONSUMER_PROTECTION', 'FINANCE', 'BDDK', 'SPK']
        if any(keyword in policy_str for keyword in finance_keywords):
            return True
    
    return False


def classify_financial_ai_system(source_system: str) -> str:
    """Classify financial AI system type"""
    if not source_system:
        return "Unknown"
    
    source_lower = source_system.lower()
    
    if 'scoring' in source_lower or 'credit' in source_lower or 'risk' in source_lower:
        return "Scoring"
    elif 'advisory' in source_lower or 'advice' in source_lower or 'recommendation' in source_lower:
        return "Advisory"
    elif 'automation' in source_lower or 'automated' in source_lower or 'auto' in source_lower:
        return "Automation"
    else:
        return "Advisory"  # Default for financial systems


def classify_institution_type(org_name: str) -> str:
    """Classify financial institution type from organization name"""
    if not org_name:
        return "Unknown"
    
    name_lower = org_name.lower()
    
    if 'bank' in name_lower or 'banka' in name_lower:
        return "Bank"
    elif 'fintech' in name_lower or 'fin tech' in name_lower:
        return "Fintech"
    elif 'investment' in name_lower or 'yatırım' in name_lower or 'portfolio' in name_lower:
        return "Investment"
    else:
        return "Fintech"  # Default


def extract_financial_risk_category(flags: Any) -> str:
    """Extract financial risk category from flags"""
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
        
        if 'misleading' in flag_lower or 'deceptive' in flag_lower or 'false' in flag_lower:
            return "Misleading advice"
        elif 'bias' in flag_lower or 'discrimination' in flag_lower or 'unfair' in flag_lower:
            return "Bias in scoring"
        elif 'manipulative' in flag_lower or 'manipulation' in flag_lower:
            return "Manipulative framing"
        elif 'overconfidence' in flag_lower or 'overconfident' in flag_lower or 'certainty' in flag_lower:
            return "Overconfidence risk"
    
    return "Unknown"


@router.get("/finance/dashboard")
async def get_finance_dashboard(
    days: int = Query(7, ge=1, le=90, description="Number of days for metrics"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Finance Dashboard - Financial AI ecosystem overview
    
    Only accessible by REGULATOR_FINANCE, REGULATOR_BDDK, REGULATOR_SPK roles.
    """
    is_finance = current_user.get("is_finance", False)
    if not is_finance:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Finansal düzenleyici erişimi gerekli"
        )
    
    try:
        from_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all finance-related IntentLogs
        intent_logs_query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        intent_logs_result = await db.execute(intent_logs_query)
        all_logs = intent_logs_result.scalars().all()
        
        # Filter finance-related logs
        finance_logs = [log for log in all_logs if is_finance_related(log)]
        
        # Get distinct financial institutions
        finance_org_ids = set(log.organization_id for log in finance_logs)
        active_financial_institutions = len(finance_org_ids)
        
        # Calculate AI-assisted decision volume
        daily_volume = {}
        for log in finance_logs:
            date_key = log.created_at.date().isoformat() if log.created_at else None
            if date_key:
                daily_volume[date_key] = daily_volume.get(date_key, 0) + 1
        
        total_decision_volume = len(finance_logs)
        
        # High-risk financial AI ratio
        high_risk_count = 0
        risk_distribution = {"low": 0, "medium": 0, "high": 0}
        ethical_scores = []
        
        for log in finance_logs:
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
        high_risk_ratio = (high_risk_count / total_decision_volume * 100) if total_decision_volume > 0 else 0
        
        # Repeated Risk Institutions (3+ high-risk events)
        org_high_risk_count: Dict[str, int] = {}
        for log in finance_logs:
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            if ethical_score < 50:
                org_id_str = str(log.organization_id)
                org_high_risk_count[org_id_str] = org_high_risk_count.get(org_id_str, 0) + 1
        
        repeated_risk_institutions = sum(1 for count in org_high_risk_count.values() if count >= 3)
        
        # Risk Categories
        risk_categories: Dict[str, int] = {
            "Misleading advice": 0,
            "Bias in scoring": 0,
            "Manipulative framing": 0,
            "Overconfidence risk": 0
        }
        
        for log in finance_logs:
            category = extract_financial_risk_category(log.flags)
            if category in risk_categories:
                risk_categories[category] += 1
        
        # Daily activity trend
        daily_activity = []
        for date_key in sorted(daily_volume.keys()):
            daily_activity.append({
                "date": date_key,
                "count": daily_volume[date_key]
            })
        
        return {
            "ok": True,
            "metrics": {
                "active_financial_institutions": active_financial_institutions,
                "ai_assisted_decision_volume": {
                    "total": total_decision_volume,
                    "daily": daily_volume,
                    "weekly": sum(daily_volume.values())
                },
                "high_risk_financial_ai_ratio": round(high_risk_ratio, 1),
                "average_ethical_index_finance": round(avg_ethical_index, 1),
                "repeated_risk_institutions": repeated_risk_institutions,
                "risk_distribution": risk_distribution,
                "risk_categories": risk_categories,
                "daily_activity_trend": daily_activity
            }
        }
    
    except Exception as e:
        logger.error(f"[Finance] Error generating dashboard: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Finans dashboard oluşturulamadı"
        )


@router.get("/finance/institutions")
async def get_finance_institutions(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Financial Institution Monitor - Finance regulator view
    
    Returns financial institutions with their AI usage metrics.
    Institution names are VISIBLE (not anonymized).
    """
    is_finance = current_user.get("is_finance", False)
    if not is_finance:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Finansal düzenleyici erişimi gerekli"
        )
    
    try:
        # Get all finance-related IntentLogs (last 30 days)
        from_date = datetime.utcnow() - timedelta(days=30)
        intent_logs_query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        intent_logs_result = await db.execute(intent_logs_query)
        all_logs = intent_logs_result.scalars().all()
        
        # Filter finance-related logs
        finance_logs = [log for log in all_logs if is_finance_related(log)]
        
        # Group by organization
        org_data: Dict[str, Dict[str, Any]] = {}
        
        for log in finance_logs:
            org_id_str = str(log.organization_id)
            
            if org_id_str not in org_data:
                org_data[org_id_str] = {
                    "organization_id": org_id_str,
                    "organization_name": None,
                    "institution_type": "Unknown",
                    "ai_system_types": set(),
                    "ethical_scores": [],
                    "high_risk_count": 0,
                    "last_activity": None,
                    "total_decisions": 0
                }
            
            data = org_data[org_id_str]
            data["total_decisions"] += 1
            
            # Track ethical scores
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            data["ethical_scores"].append(ethical_score)
            
            # Count high-risk events
            if ethical_score < 50:
                data["high_risk_count"] += 1
            
            # Track AI system types from ImpactEvent
            # Get ImpactEvents for this log
            impact_query = select(ImpactEvent).where(
                ImpactEvent.intent_log_id == log.id,
                ImpactEvent.deleted_by_user == False
            )
            impact_result = await db.execute(impact_query)
            impact_events = impact_result.scalars().all()
            
            for impact in impact_events:
                if impact.source_system:
                    system_type = classify_financial_ai_system(impact.source_system)
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
                    data["institution_type"] = classify_institution_type(org.name)
        
        # Calculate metrics for each institution
        institutions = []
        for org_id_str, data in org_data.items():
            if not data["organization_name"]:
                continue
            
            # Calculate average ethical index
            avg_ethical = sum(data["ethical_scores"]) / len(data["ethical_scores"]) if data["ethical_scores"] else 0
            
            # Determine primary AI system type
            primary_system_type = list(data["ai_system_types"])[0] if data["ai_system_types"] else "Advisory"
            
            # Determine AI usage intensity
            total_decisions = data["total_decisions"]
            if total_decisions >= 100:
                ai_intensity = "High"
            elif total_decisions >= 20:
                ai_intensity = "Medium"
            else:
                ai_intensity = "Low"
            
            # High-risk frequency
            high_risk_frequency = (data["high_risk_count"] / total_decisions * 100) if total_decisions > 0 else 0
            
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
                "institution_type": data["institution_type"],
                "ai_system_type": primary_system_type,
                "ai_usage_intensity": ai_intensity,
                "average_ethical_index": round(avg_ethical, 1),
                "high_risk_frequency": round(high_risk_frequency, 1),
                "risk_trend": trend,
                "last_activity": data["last_activity"].isoformat() if data["last_activity"] else None
            })
        
        # Sort by high-risk frequency (descending)
        institutions.sort(key=lambda x: x["high_risk_frequency"], reverse=True)
        
        return {
            "ok": True,
            "institutions": institutions
        }
    
    except Exception as e:
        logger.error(f"[Finance] Error fetching institutions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Kurumlar alınamadı"
        )


@router.get("/finance/audit-logs")
async def get_finance_audit_logs(
    from_date: Optional[str] = Query(None, description="From date (ISO format)"),
    to_date: Optional[str] = Query(None, description="To date (ISO format)"),
    institution_id: Optional[str] = Query(None, description="Financial institution ID"),
    risk_category: Optional[str] = Query(None, description="Risk category filter"),
    risk_level: Optional[str] = Query(None, description="Risk level: low, medium, high"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Financial Audit Logs - Finance regulator view
    
    Returns finance-related audit events ONLY.
    NO content, NO recommendations, NO customer data.
    """
    is_finance = current_user.get("is_finance", False)
    if not is_finance:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Finansal düzenleyici erişimi gerekli"
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
        
        # Filter finance-related logs
        finance_logs = [log for log in all_logs if is_finance_related(log)]
        
        # Apply risk level filter
        if risk_level:
            filtered_logs = []
            for log in finance_logs:
                ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
                if risk_level == "high" and ethical_score < 50:
                    filtered_logs.append(log)
                elif risk_level == "medium" and 50 <= ethical_score < 80:
                    filtered_logs.append(log)
                elif risk_level == "low" and ethical_score >= 80:
                    filtered_logs.append(log)
            finance_logs = filtered_logs
        
        # Apply risk category filter
        if risk_category:
            filtered_logs = []
            for log in finance_logs:
                category = extract_financial_risk_category(log.flags)
                if category.lower() == risk_category.lower():
                    filtered_logs.append(log)
            finance_logs = filtered_logs
        
        # Fetch organization names
        org_ids = set(log.organization_id for log in finance_logs)
        orgs_query = select(Organization).where(Organization.id.in_(org_ids))
        orgs_result = await db.execute(orgs_query)
        orgs = {str(org.id): org for org in orgs_result.scalars().all()}
        
        # Get ImpactEvents for AI system types
        log_ids = [log.id for log in finance_logs]
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
                log_impact_map[str(impact.intent_log_id)] = classify_financial_ai_system(impact.source_system)
        
        # Build response (NO CONTENT)
        audit_entries = []
        for log in finance_logs:
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
            
            # Extract policy category
            policy_category = "Financial Safety"  # Default
            if log.policy_set:
                policies = []
                if isinstance(log.policy_set, dict):
                    policies = log.policy_set.get('policies', []) or []
                elif isinstance(log.policy_set, list):
                    policies = log.policy_set
                
                policy_str = ' '.join(str(p).upper() for p in policies)
                if 'CONSUMER_PROTECTION' in policy_str or 'CONSUMER' in policy_str:
                    policy_category = "Consumer Protection"
            
            # Get AI system type
            ai_system_type = log_impact_map.get(str(log.id), "Advisory")
            
            # Extract system flags (NO CONTENT)
            system_flags = []
            if log.flags:
                flag_list = []
                if isinstance(log.flags, dict):
                    flag_list = log.flags.get('flags', []) or log.flags.get('risk_flags_severity', []) or []
                elif isinstance(log.flags, list):
                    flag_list = log.flags
                
                for flag in flag_list:
                    if isinstance(flag, dict):
                        flag_name = flag.get('flag', '') or flag.get('type', '')
                    elif isinstance(flag, str):
                        flag_name = flag
                    if flag_name:
                        system_flags.append(flag_name)
            
            audit_entries.append({
                "id": str(log.id),
                "timestamp": log.created_at.isoformat() if log.created_at else None,
                "institution": org_name,
                "ai_system_type": ai_system_type,
                "policy_category": policy_category,
                "risk_level": risk_level_str,
                "risk_score": round(ethical_score, 1),
                "system_flags": system_flags
            })
        
        # Sort by timestamp (descending)
        audit_entries.sort(key=lambda x: x["timestamp"] or "", reverse=True)
        
        return {
            "ok": True,
            "count": len(audit_entries),
            "results": audit_entries
        }
    
    except Exception as e:
        logger.error(f"[Finance] Error fetching audit logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Denetim kayıtları alınamadı"
        )


@router.get("/finance/risk-patterns")
async def get_finance_risk_patterns(
    days: int = Query(30, ge=7, le=90, description="Time window in days"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Systemic Financial Risk Patterns - Finance regulator view
    
    Detects systemic financial risks, not individual failures.
    """
    is_finance = current_user.get("is_finance", False)
    if not is_finance:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Finansal düzenleyici erişimi gerekli"
        )
    
    try:
        from_date = datetime.utcnow() - timedelta(days=days)
        
        # Get finance-related logs
        query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        result = await db.execute(query)
        all_logs = result.scalars().all()
        
        finance_logs = [log for log in all_logs if is_finance_related(log)]
        
        # Get ImpactEvents
        log_ids = [log.id for log in finance_logs]
        impact_query = select(ImpactEvent).where(
            ImpactEvent.intent_log_id.in_(log_ids),
            ImpactEvent.deleted_by_user == False
        )
        impact_result = await db.execute(impact_query)
        impact_events = impact_result.scalars().all()
        
        # Group by system and institution
        system_patterns: Dict[str, Dict[str, Any]] = {}
        institution_patterns: Dict[str, Dict[str, Any]] = {}
        
        log_map = {str(log.id): log for log in finance_logs}
        
        for impact in impact_events:
            if not impact.source_system or not impact.intent_log_id:
                continue
            
            log = log_map.get(str(impact.intent_log_id))
            if not log:
                continue
            
            org_id_str = str(log.organization_id)
            system_name = impact.source_system
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            
            # Track institution patterns
            if org_id_str not in institution_patterns:
                institution_patterns[org_id_str] = {
                    "organization_id": org_id_str,
                    "organization_name": None,
                    "high_risk_events": [],
                    "system_types": set()
                }
            
            if ethical_score < 50:
                institution_patterns[org_id_str]["high_risk_events"].append({
                    "timestamp": log.created_at.isoformat() if log.created_at else None,
                    "score": ethical_score
                })
            
            # Track system patterns
            if system_name not in system_patterns:
                system_patterns[system_name] = {
                    "system_name": system_name,
                    "system_type": classify_financial_ai_system(system_name),
                    "high_risk_count": 0,
                    "total_events": 0,
                    "institutions_using": set()
                }
            
            system_patterns[system_name]["total_events"] += 1
            system_patterns[system_name]["institutions_using"].add(org_id_str)
            if ethical_score < 50:
                system_patterns[system_name]["high_risk_count"] += 1
            
            institution_patterns[org_id_str]["system_types"].add(classify_financial_ai_system(system_name))
        
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
        repeated_high_risk_systems = [
            {
                "system_name": name,
                "system_type": data["system_type"],
                "high_risk_count": data["high_risk_count"],
                "total_events": data["total_events"],
                "institutions_count": len(data["institutions_using"]),
                "high_risk_ratio": round((data["high_risk_count"] / data["total_events"] * 100) if data["total_events"] > 0 else 0, 1)
            }
            for name, data in system_patterns.items()
            if data["high_risk_count"] >= 3  # Repeated high-risk threshold
        ]
        
        repeated_high_risk_systems.sort(key=lambda x: x["high_risk_count"], reverse=True)
        
        # Concentration risk (same model used widely)
        system_usage_count: Dict[str, int] = {}
        for name, data in system_patterns.items():
            system_usage_count[name] = len(data["institutions_using"])
        
        concentration_risks = [
            {
                "system_name": name,
                "system_type": system_patterns[name]["system_type"],
                "institutions_using_count": count
            }
            for name, count in system_usage_count.items()
            if count >= 5  # Threshold: used by 5+ institutions
        ]
        
        concentration_risks.sort(key=lambda x: x["institutions_using_count"], reverse=True)
        
        # Escalating advisory risk
        recent_logs = [log for log in finance_logs 
                      if log.created_at and log.created_at >= datetime.utcnow() - timedelta(days=7)]
        older_logs = [log for log in finance_logs 
                     if log.created_at and log.created_at < datetime.utcnow() - timedelta(days=7)]
        
        recent_advisory_risk = sum(1 for log in recent_logs 
                                  if (log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50) < 50)
        older_advisory_risk = sum(1 for log in older_logs 
                                 if (log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50) < 50)
        
        escalating_advisory = recent_advisory_risk > older_advisory_risk * 1.2
        
        # Sector-wide trend
        sector_trend = "Stable"
        if recent_advisory_risk > older_advisory_risk * 1.2:
            sector_trend = "Increasing"
        elif recent_advisory_risk < older_advisory_risk * 0.8:
            sector_trend = "Decreasing"
        
        return {
            "ok": True,
            "repeated_high_risk_systems": repeated_high_risk_systems,
            "concentration_risks": concentration_risks,
            "escalating_advisory_risk": escalating_advisory,
            "sector_wide_trend": sector_trend,
            "time_window_days": days
        }
    
    except Exception as e:
        logger.error(f"[Finance] Error fetching risk patterns: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Risk kalıpları alınamadı"
        )


@router.get("/finance/alerts")
async def get_finance_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Observational Alerts - Finance regulator view
    
    Early warning for financial risks.
    Alerts are informational, non-punitive, logged only.
    """
    is_finance = current_user.get("is_finance", False)
    if not is_finance:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Finansal düzenleyici erişimi gerekli"
        )
    
    try:
        # Get finance logs from last 30 days
        from_date = datetime.utcnow() - timedelta(days=30)
        query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        result = await db.execute(query)
        all_logs = result.scalars().all()
        
        finance_logs = [log for log in all_logs if is_finance_related(log)]
        
        alerts = []
        
        # Alert 1: Sudden increase in misleading advisory risk
        recent_logs = [log for log in finance_logs 
                      if log.created_at and log.created_at >= datetime.utcnow() - timedelta(days=7)]
        older_logs = [log for log in finance_logs 
                     if log.created_at and log.created_at < datetime.utcnow() - timedelta(days=7)]
        
        recent_misleading = sum(1 for log in recent_logs 
                               if extract_financial_risk_category(log.flags) == "Misleading advice")
        older_misleading = sum(1 for log in older_logs 
                              if extract_financial_risk_category(log.flags) == "Misleading advice")
        
        if older_misleading > 0 and recent_misleading > older_misleading * 2:  # 2x increase
            alerts.append({
                "type": "Sudden Increase in Misleading Advisory Risk",
                "severity": "High",
                "description": f"Son 7 günde yanıltıcı danışmanlık riskinde %{((recent_misleading - older_misleading) / older_misleading * 100):.1f} artış tespit edildi",
                "recent_count": recent_misleading,
                "older_count": older_misleading,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Alert 2: Persistent bias patterns
        bias_count = sum(1 for log in finance_logs 
                        if extract_financial_risk_category(log.flags) == "Bias in scoring")
        
        if bias_count >= 10:  # Threshold: 10+ bias events
            alerts.append({
                "type": "Persistent Bias Patterns",
                "severity": "Medium",
                "description": f"Son 30 günde {bias_count} önyargılı skorlama olayı tespit edildi",
                "bias_event_count": bias_count,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Alert 3: Systemic dependency on single AI model
        # Get ImpactEvents to analyze model usage
        log_ids = [log.id for log in finance_logs]
        impact_query = select(ImpactEvent).where(
            ImpactEvent.intent_log_id.in_(log_ids),
            ImpactEvent.deleted_by_user == False
        )
        impact_result = await db.execute(impact_query)
        impact_events = impact_result.scalars().all()
        
        system_usage: Dict[str, int] = {}
        for impact in impact_events:
            if impact.source_system:
                system_name = impact.source_system
                system_usage[system_name] = system_usage.get(system_name, 0) + 1
        
        if system_usage:
            total_usage = sum(system_usage.values())
            max_system = max(system_usage.items(), key=lambda x: x[1])
            max_system_ratio = (max_system[1] / total_usage * 100) if total_usage > 0 else 0
            
            if max_system_ratio > 60:  # Threshold: 60%+ dependency
                alerts.append({
                    "type": "Systemic Dependency on Single AI Model",
                    "severity": "Medium",
                    "description": f"{max_system[0]} sistemine %{max_system_ratio:.1f} bağımlılık tespit edildi",
                    "system_name": max_system[0],
                    "dependency_rate": round(max_system_ratio, 1),
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
        logger.error(f"[Finance] Error fetching alerts: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Uyarılar alınamadı"
        )

