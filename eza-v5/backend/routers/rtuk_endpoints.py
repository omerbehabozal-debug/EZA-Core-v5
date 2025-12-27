# -*- coding: utf-8 -*-
"""
RTÜK Media Regulatory Endpoints
Media-focused oversight for RTÜK and similar media regulators
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
from backend.models.production import IntentLog, Organization

router = APIRouter()
logger = logging.getLogger(__name__)


def is_media_related(intent_log: IntentLog) -> bool:
    """Check if IntentLog is media-related based on sector or policy set"""
    # Check sector
    if intent_log.sector and intent_log.sector.lower() == "media":
        return True
    
    # Check policy set for media-related policies
    if intent_log.policy_set:
        policies = []
        if isinstance(intent_log.policy_set, dict):
            policies = intent_log.policy_set.get('policies', []) or []
        elif isinstance(intent_log.policy_set, list):
            policies = intent_log.policy_set
        
        policy_str = ' '.join(str(p).upper() for p in policies)
        # Media-related policy keywords
        media_keywords = ['TRT', 'MEDIA', 'PUBLIC_IMPACT', 'MISINFORMATION', 'BROADCAST']
        if any(keyword in policy_str for keyword in media_keywords):
            return True
    
    return False


@router.get("/rtuk/dashboard")
async def get_rtuk_dashboard(
    days: int = Query(7, ge=1, le=90, description="Number of days for metrics"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    RTÜK Dashboard - Media-focused metrics
    
    Only accessible by REGULATOR_RTUK and REGULATOR_MEDIA_AUDITOR roles.
    """
    is_rtuk = current_user.get("is_rtuk", False)
    if not is_rtuk:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RTÜK access required"
        )
    
    try:
        from_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all media-related IntentLogs
        intent_logs_query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False  # Ignore soft-deleted
        )
        intent_logs_result = await db.execute(intent_logs_query)
        all_intent_logs = intent_logs_result.scalars().all()
        
        # Filter media-related logs
        media_logs = [log for log in all_intent_logs if is_media_related(log)]
        
        # Get distinct media organizations
        media_org_ids = set(log.organization_id for log in media_logs)
        active_media_orgs = len(media_org_ids)
        
        # Calculate AI-assisted content volume (daily/weekly)
        daily_volume = {}
        for log in media_logs:
            date_key = log.created_at.date().isoformat() if log.created_at else None
            if date_key:
                daily_volume[date_key] = daily_volume.get(date_key, 0) + 1
        
        total_content_volume = len(media_logs)
        weekly_volume = sum(daily_volume.values())  # Last week days
        
        # High-risk media outputs
        high_risk_count = 0
        risk_distribution = {"low": 0, "medium": 0, "high": 0}
        total_ethical_score = 0
        score_count = 0
        
        for log in media_logs:
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            total_ethical_score += ethical_score
            score_count += 1
            
            if ethical_score < 50:
                risk_distribution["high"] += 1
                high_risk_count += 1
            elif ethical_score < 80:
                risk_distribution["medium"] += 1
            else:
                risk_distribution["low"] += 1
        
        public_impact_risk_index = (total_ethical_score / score_count) if score_count > 0 else 0
        
        # Repeated Risk Organizations (orgs with 3+ high-risk events)
        org_high_risk_count: Dict[str, int] = {}
        for log in media_logs:
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            if ethical_score < 50:
                org_id_str = str(log.organization_id)
                org_high_risk_count[org_id_str] = org_high_risk_count.get(org_id_str, 0) + 1
        
        repeated_risk_orgs = sum(1 for count in org_high_risk_count.values() if count >= 3)
        
        # Top Risk Categories
        risk_categories: Dict[str, int] = {
            "Manipulation": 0,
            "Public Misinformation": 0,
            "Harmful Framing": 0,
            "Contextual Distortion": 0
        }
        
        for log in media_logs:
            flags = log.flags
            if not flags:
                continue
            
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
                if 'manipulation' in flag_lower or 'deception' in flag_lower:
                    risk_categories["Manipulation"] += 1
                elif 'misinformation' in flag_lower or 'false' in flag_lower or 'fake' in flag_lower:
                    risk_categories["Public Misinformation"] += 1
                elif 'harmful' in flag_lower or 'harm' in flag_lower or 'violence' in flag_lower:
                    risk_categories["Harmful Framing"] += 1
                elif 'distortion' in flag_lower or 'context' in flag_lower or 'misleading' in flag_lower:
                    risk_categories["Contextual Distortion"] += 1
        
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
                "active_media_organizations": active_media_orgs,
                "ai_content_volume": {
                    "total": total_content_volume,
                    "daily": daily_volume,
                    "weekly": weekly_volume
                },
                "high_risk_outputs": {
                    "count": high_risk_count,
                    "percentage": round((high_risk_count / total_content_volume * 100) if total_content_volume > 0 else 0, 1)
                },
                "public_impact_risk_index": round(public_impact_risk_index, 1),
                "repeated_risk_organizations": repeated_risk_orgs,
                "risk_distribution": risk_distribution,
                "top_risk_categories": risk_categories,
                "daily_activity_trend": daily_activity
            }
        }
    
    except Exception as e:
        logger.error(f"[RTÜK] Error generating dashboard: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="RTÜK dashboard could not be generated"
        )


@router.get("/rtuk/organizations")
async def get_rtuk_organizations(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Media Organization Monitor - RTÜK view
    
    Returns media organizations with their AI usage metrics.
    Organization names are VISIBLE (not anonymized).
    """
    is_rtuk = current_user.get("is_rtuk", False)
    if not is_rtuk:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RTÜK access required"
        )
    
    try:
        # Get all media-related IntentLogs (last 30 days)
        from_date = datetime.utcnow() - timedelta(days=30)
        intent_logs_query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        intent_logs_result = await db.execute(intent_logs_query)
        all_logs = intent_logs_result.scalars().all()
        
        # Filter media-related logs
        media_logs = [log for log in all_logs if is_media_related(log)]
        
        # Group by organization
        org_data: Dict[str, Dict[str, Any]] = {}
        
        for log in media_logs:
            org_id_str = str(log.organization_id)
            
            if org_id_str not in org_data:
                org_data[org_id_str] = {
                    "organization_id": org_id_str,
                    "organization_name": None,  # Will fetch from Organization table
                    "platform_type": "Unknown",
                    "ai_usage_intensity": "Low",
                    "ethical_scores": [],
                    "high_risk_count": 0,
                    "last_activity": None,
                    "total_analyses": 0
                }
            
            data = org_data[org_id_str]
            data["total_analyses"] += 1
            
            # Track ethical scores
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            data["ethical_scores"].append(ethical_score)
            
            # Count high-risk events
            if ethical_score < 50:
                data["high_risk_count"] += 1
            
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
                    # Infer platform type from organization name or default policy
                    org_name_lower = org.name.lower()
                    if 'tv' in org_name_lower or 'television' in org_name_lower:
                        data["platform_type"] = "TV"
                    elif 'digital' in org_name_lower or 'online' in org_name_lower:
                        data["platform_type"] = "Digital Media"
                    elif 'social' in org_name_lower:
                        data["platform_type"] = "Social Media Publisher"
                    else:
                        data["platform_type"] = "Digital Media"  # Default
        
        # Calculate metrics for each organization
        organizations = []
        for org_id_str, data in org_data.items():
            if not data["organization_name"]:
                continue  # Skip if organization not found
            
            # Calculate average ethical index
            avg_ethical = sum(data["ethical_scores"]) / len(data["ethical_scores"]) if data["ethical_scores"] else 0
            
            # Determine AI usage intensity
            total_analyses = data["total_analyses"]
            if total_analyses >= 100:
                ai_intensity = "High"
            elif total_analyses >= 20:
                ai_intensity = "Medium"
            else:
                ai_intensity = "Low"
            
            # Determine risk trend (comparing recent vs older scores)
            trend = "Stable"
            scores = data["ethical_scores"]
            if len(scores) >= 10:
                recent_avg = sum(scores[-10:]) / 10
                older_avg = sum(scores[:10]) / 10
                if recent_avg < older_avg - 5:
                    trend = "Decreasing"
                elif recent_avg > older_avg + 5:
                    trend = "Increasing"
            
            organizations.append({
                "organization_id": org_id_str,
                "organization_name": data["organization_name"],
                "platform_type": data["platform_type"],
                "ai_usage_intensity": ai_intensity,
                "average_ethical_index": round(avg_ethical, 1),
                "high_risk_event_count": data["high_risk_count"],
                "risk_trend": trend,
                "last_activity": data["last_activity"].isoformat() if data["last_activity"] else None
            })
        
        # Sort by high-risk count (descending)
        organizations.sort(key=lambda x: x["high_risk_event_count"], reverse=True)
        
        return {
            "ok": True,
            "organizations": organizations
        }
    
    except Exception as e:
        logger.error(f"[RTÜK] Error fetching organizations: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Organizations could not be fetched"
        )


@router.get("/rtuk/audit-logs")
async def get_rtuk_audit_logs(
    from_date: Optional[str] = Query(None, description="From date (ISO format)"),
    to_date: Optional[str] = Query(None, description="To date (ISO format)"),
    organization_id: Optional[str] = Query(None, description="Media organization ID"),
    risk_level: Optional[str] = Query(None, description="Risk level: low, medium, high"),
    risk_category: Optional[str] = Query(None, description="Risk category filter"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Media Audit Logs - RTÜK-scoped
    
    Returns media-related audit events ONLY.
    NO content preview, NO text snippets, NO images, NO audio.
    """
    is_rtuk = current_user.get("is_rtuk", False)
    if not is_rtuk:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RTÜK access required"
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
        
        # Organization filter
        if organization_id:
            try:
                org_uuid = uuid.UUID(organization_id)
                query = query.where(IntentLog.organization_id == org_uuid)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid organization_id format"
                )
        
        # Execute query
        result = await db.execute(query)
        all_logs = result.scalars().all()
        
        # Filter media-related logs
        media_logs = [log for log in all_logs if is_media_related(log)]
        
        # Apply risk level filter
        if risk_level:
            filtered_logs = []
            for log in media_logs:
                ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
                if risk_level == "high" and ethical_score < 50:
                    filtered_logs.append(log)
                elif risk_level == "medium" and 50 <= ethical_score < 80:
                    filtered_logs.append(log)
                elif risk_level == "low" and ethical_score >= 80:
                    filtered_logs.append(log)
            media_logs = filtered_logs
        
        # Apply risk category filter
        if risk_category:
            filtered_logs = []
            for log in media_logs:
                flags = log.flags
                if not flags:
                    continue
                
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
                    category_lower = risk_category.lower()
                    
                    if category_lower == "manipulation" and ('manipulation' in flag_lower or 'deception' in flag_lower):
                        filtered_logs.append(log)
                        break
                    elif category_lower == "misinformation" and ('misinformation' in flag_lower or 'false' in flag_lower):
                        filtered_logs.append(log)
                        break
                    elif category_lower == "harmful" and ('harmful' in flag_lower or 'harm' in flag_lower):
                        filtered_logs.append(log)
                        break
                    elif category_lower == "distortion" and ('distortion' in flag_lower or 'misleading' in flag_lower):
                        filtered_logs.append(log)
                        break
            
            media_logs = filtered_logs
        
        # Fetch organization names
        org_ids = set(log.organization_id for log in media_logs)
        orgs_query = select(Organization).where(Organization.id.in_(org_ids))
        orgs_result = await db.execute(orgs_query)
        orgs = {str(org.id): org for org in orgs_result.scalars().all()}
        
        # Build response (NO CONTENT)
        audit_entries = []
        for log in media_logs:
            org = orgs.get(str(log.organization_id))
            org_name = org.name if org else "Unknown Organization"
            
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            
            # Determine risk level
            if ethical_score < 50:
                risk_level_str = "High"
            elif ethical_score < 80:
                risk_level_str = "Medium"
            else:
                risk_level_str = "Low"
            
            # Extract policy category
            policy_category = "Media Safety"  # Default
            if log.policy_set:
                policies = []
                if isinstance(log.policy_set, dict):
                    policies = log.policy_set.get('policies', []) or []
                elif isinstance(log.policy_set, list):
                    policies = log.policy_set
                
                policy_str = ' '.join(str(p).upper() for p in policies)
                if 'MISINFORMATION' in policy_str or 'FALSE' in policy_str:
                    policy_category = "Misinformation"
                elif 'PUBLIC_IMPACT' in policy_str or 'IMPACT' in policy_str:
                    policy_category = "Public Impact"
            
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
            
            # Infer platform type
            platform_type = "Digital Media"  # Default
            if org:
                org_name_lower = org.name.lower()
                if 'tv' in org_name_lower or 'television' in org_name_lower:
                    platform_type = "TV"
                elif 'social' in org_name_lower:
                    platform_type = "Social Media Publisher"
            
            audit_entries.append({
                "id": str(log.id),
                "timestamp": log.created_at.isoformat() if log.created_at else None,
                "media_organization": org_name,
                "platform_type": platform_type,
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
        logger.error(f"[RTÜK] Error fetching audit logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Audit logs could not be fetched"
        )


@router.get("/rtuk/risk-patterns")
async def get_rtuk_risk_patterns(
    days: int = Query(7, ge=1, le=90, description="Time window in days"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Systematic Risk Patterns - RTÜK view
    
    Detects behavioral escalation patterns, not individual incidents.
    """
    is_rtuk = current_user.get("is_rtuk", False)
    if not is_rtuk:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RTÜK access required"
        )
    
    try:
        from_date = datetime.utcnow() - timedelta(days=days)
        
        # Get media-related logs
        query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        result = await db.execute(query)
        all_logs = result.scalars().all()
        
        media_logs = [log for log in all_logs if is_media_related(log)]
        
        # Group by organization
        org_patterns: Dict[str, Dict[str, Any]] = {}
        
        for log in media_logs:
            org_id_str = str(log.organization_id)
            
            if org_id_str not in org_patterns:
                org_patterns[org_id_str] = {
                    "organization_id": org_id_str,
                    "organization_name": None,
                    "high_risk_events": [],
                    "risk_trend_scores": [],
                    "platform_type": "Unknown"
                }
            
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            
            if ethical_score < 50:
                org_patterns[org_id_str]["high_risk_events"].append({
                    "timestamp": log.created_at.isoformat() if log.created_at else None,
                    "risk_score": ethical_score
                })
            
            org_patterns[org_id_str]["risk_trend_scores"].append({
                "timestamp": log.created_at.isoformat() if log.created_at else None,
                "score": ethical_score
            })
        
        # Fetch organization names
        org_ids = [uuid.UUID(org_id) for org_id in org_patterns.keys()]
        if org_ids:
            orgs_query = select(Organization).where(Organization.id.in_(org_ids))
            orgs_result = await db.execute(orgs_query)
            orgs = {str(org.id): org for org in orgs_result.scalars().all()}
            
            for org_id_str, pattern in org_patterns.items():
                org = orgs.get(org_id_str)
                if org:
                    pattern["organization_name"] = org.name
                    org_name_lower = org.name.lower()
                    if 'tv' in org_name_lower:
                        pattern["platform_type"] = "TV"
                    elif 'digital' in org_name_lower:
                        pattern["platform_type"] = "Digital Media"
                    elif 'social' in org_name_lower:
                        pattern["platform_type"] = "Social Media Publisher"
        
        # Build patterns
        patterns = []
        for org_id_str, pattern in org_patterns.items():
            if not pattern["organization_name"]:
                continue
            
            high_risk_count = len(pattern["high_risk_events"])
            
            # Calculate trend
            scores = [s["score"] for s in pattern["risk_trend_scores"]]
            trend = "Stable"
            if len(scores) >= 10:
                recent_avg = sum(scores[-10:]) / 10
                older_avg = sum(scores[:10]) / 10
                if recent_avg < older_avg - 5:
                    trend = "Increasing"
                elif recent_avg > older_avg + 5:
                    trend = "Decreasing"
            
            # Time window analysis
            recent_high_risk = sum(1 for event in pattern["high_risk_events"] 
                                  if event["timestamp"] and 
                                  datetime.fromisoformat(event["timestamp"].replace('Z', '+00:00')) >= from_date)
            
            patterns.append({
                "organization_name": pattern["organization_name"],
                "platform_type": pattern["platform_type"],
                "repeated_high_risk": high_risk_count >= 3,
                "high_risk_count": high_risk_count,
                "recent_high_risk_count": recent_high_risk,
                "risk_trend": trend,
                "time_window_days": days
            })
        
        # Filter: Only show organizations with repeated high-risk or increasing trend
        filtered_patterns = [
            p for p in patterns 
            if p["repeated_high_risk"] or p["risk_trend"] == "Increasing"
        ]
        
        # Platform-level clustering
        platform_clustering: Dict[str, Dict[str, int]] = {}
        for pattern in patterns:
            platform = pattern["platform_type"]
            if platform not in platform_clustering:
                platform_clustering[platform] = {
                    "total_orgs": 0,
                    "high_risk_orgs": 0,
                    "manipulation_risk_count": 0
                }
            
            platform_clustering[platform]["total_orgs"] += 1
            if pattern["repeated_high_risk"]:
                platform_clustering[platform]["high_risk_orgs"] += 1
        
        return {
            "ok": True,
            "organizations": filtered_patterns,
            "platform_clustering": platform_clustering,
            "time_window_days": days
        }
    
    except Exception as e:
        logger.error(f"[RTÜK] Error fetching risk patterns: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Risk patterns could not be fetched"
        )


@router.get("/rtuk/alerts")
async def get_rtuk_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Observational Alerts - RTÜK view
    
    Early warning alerts without intervention capabilities.
    Alerts are informational, observational, logged, and non-actionable.
    """
    is_rtuk = current_user.get("is_rtuk", False)
    if not is_rtuk:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RTÜK access required"
        )
    
    try:
        # Get media logs from last 7 days
        from_date = datetime.utcnow() - timedelta(days=7)
        query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        result = await db.execute(query)
        all_logs = result.scalars().all()
        
        media_logs = [log for log in all_logs if is_media_related(log)]
        
        alerts = []
        
        # Alert 1: Repeated High-Risk Pattern
        org_high_risk: Dict[str, int] = {}
        for log in media_logs:
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            if ethical_score < 50:
                org_id_str = str(log.organization_id)
                org_high_risk[org_id_str] = org_high_risk.get(org_id_str, 0) + 1
        
        for org_id_str, count in org_high_risk.items():
            if count >= 5:  # Threshold: 5+ high-risk events in 7 days
                alerts.append({
                    "type": "Repeated High-Risk Pattern",
                    "severity": "High",
                    "description": f"Organization has {count} high-risk events in the last 7 days",
                    "organization_id": org_id_str,
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        # Alert 2: Sudden Spike in AI Media Output
        daily_counts: Dict[str, int] = {}
        for log in media_logs:
            date_key = log.created_at.date().isoformat() if log.created_at else None
            if date_key:
                daily_counts[date_key] = daily_counts.get(date_key, 0) + 1
        
        if daily_counts:
            avg_daily = sum(daily_counts.values()) / len(daily_counts)
            max_daily = max(daily_counts.values())
            
            if max_daily > avg_daily * 2:  # Spike: 2x average
                alerts.append({
                    "type": "Sudden Spike in AI Media Output",
                    "severity": "Medium",
                    "description": f"Daily AI media output spiked to {max_daily} (average: {avg_daily:.1f})",
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        # Alert 3: Sustained Public Impact Risk
        high_risk_logs = [log for log in media_logs 
                          if (log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50) < 50]
        
        if len(high_risk_logs) >= 10:  # Threshold: 10+ high-risk events
            alerts.append({
                "type": "Sustained Public Impact Risk",
                "severity": "High",
                "description": f"{len(high_risk_logs)} high-risk media outputs detected in the last 7 days",
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
        logger.error(f"[RTÜK] Error fetching alerts: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Alerts could not be fetched"
        )

