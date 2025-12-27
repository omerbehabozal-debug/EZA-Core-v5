# -*- coding: utf-8 -*-
"""
Sanayi ve Teknoloji Bakanlığı - AI Ekosistem Gözetim Endpoints
Ecosystem-focused oversight for technology policy authorities
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth_production import require_proxy_auth_production
from backend.models.production import IntentLog, ImpactEvent, TelemetryEvent, Organization
from sqlalchemy.orm import selectinload

router = APIRouter()
logger = logging.getLogger(__name__)


def extract_model_provider(source_system: str, telemetry_meta: Any = None) -> str:
    """Extract AI model provider from source system or telemetry metadata"""
    if not source_system:
        return "Unknown"
    
    source_lower = source_system.lower()
    
    # Check source_system for provider hints
    if 'openai' in source_lower or 'gpt' in source_lower or 'chatgpt' in source_lower:
        return "OpenAI"
    elif 'groq' in source_lower or 'llama' in source_lower:
        return "Groq"
    elif 'mistral' in source_lower:
        return "Mistral"
    
    # Check telemetry meta for model_votes
    if telemetry_meta and isinstance(telemetry_meta, dict):
        model_votes = telemetry_meta.get('model_votes') or telemetry_meta.get('models')
        if model_votes:
            if isinstance(model_votes, dict):
                # Check which provider was used
                for key in model_votes.keys():
                    key_lower = str(key).lower()
                    if 'openai' in key_lower or 'gpt' in key_lower:
                        return "OpenAI"
                    elif 'groq' in key_lower or 'llama' in key_lower:
                        return "Groq"
                    elif 'mistral' in key_lower:
                        return "Mistral"
            elif isinstance(model_votes, list):
                for vote in model_votes:
                    vote_str = str(vote).lower()
                    if 'openai' in vote_str or 'gpt' in vote_str:
                        return "OpenAI"
                    elif 'groq' in vote_str or 'llama' in vote_str:
                        return "Groq"
                    elif 'mistral' in vote_str:
                        return "Mistral"
    
    return "Other / Hybrid"


def classify_ai_system_type(source_system: str) -> str:
    """Classify AI system type from source_system"""
    if not source_system:
        return "Unknown"
    
    source_lower = source_system.lower()
    
    if 'text' in source_lower or 'generation' in source_lower or 'llm' in source_lower or 'chat' in source_lower:
        return "Text Generation"
    elif 'image' in source_lower or 'vision' in source_lower or 'visual' in source_lower:
        return "Multimodal"
    elif 'decision' in source_lower or 'support' in source_lower:
        return "Decision Support"
    elif 'recommendation' in source_lower or 'recommend' in source_lower:
        return "Recommendation"
    else:
        return "Text Generation"  # Default


@router.get("/sanayi/dashboard")
async def get_sanayi_dashboard(
    days: int = Query(7, ge=1, le=90, description="Number of days for metrics"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Sanayi Bakanlığı Dashboard - AI Ecosystem Overview
    
    Only accessible by REGULATOR_SANAYI and REGULATOR_TECH_AUDITOR roles.
    """
    is_sanayi = current_user.get("is_sanayi", False)
    if not is_sanayi:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sanayi Bakanlığı erişimi gerekli"
        )
    
    try:
        from_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all IntentLogs (all sectors - ecosystem view)
        intent_logs_query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        intent_logs_result = await db.execute(intent_logs_query)
        all_logs = intent_logs_result.scalars().all()
        
        # Get distinct organizations (AI companies)
        org_ids = set(log.organization_id for log in all_logs)
        active_ai_companies = len(org_ids)
        
        # Get distinct source systems (AI systems) from ImpactEvent
        impact_query = select(ImpactEvent).where(
            ImpactEvent.occurred_at >= from_date,
            ImpactEvent.deleted_by_user == False
        )
        impact_result = await db.execute(impact_query)
        impact_events = impact_result.scalars().all()
        
        source_systems = set()
        for impact in impact_events:
            if impact.source_system:
                source_systems.add(impact.source_system)
        
        # Also check TelemetryEvent
        telemetry_query = select(TelemetryEvent).where(
            TelemetryEvent.created_at >= from_date
        )
        telemetry_result = await db.execute(telemetry_query)
        telemetry_events = telemetry_result.scalars().all()
        
        for event in telemetry_events:
            if event.source:
                source_systems.add(event.source)
        
        observed_ai_systems = len(source_systems)
        
        # Daily AI activity volume
        daily_volume = {}
        for log in all_logs:
            date_key = log.created_at.date().isoformat() if log.created_at else None
            if date_key:
                daily_volume[date_key] = daily_volume.get(date_key, 0) + 1
        
        total_activity = len(all_logs)
        
        # Calculate average ethical maturity index
        ethical_scores = []
        for log in all_logs:
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            ethical_scores.append(ethical_score)
        
        avg_ethical_maturity = sum(ethical_scores) / len(ethical_scores) if ethical_scores else 0
        
        # High-risk AI system ratio
        high_risk_count = sum(1 for score in ethical_scores if score < 50)
        high_risk_ratio = (high_risk_count / len(ethical_scores) * 100) if ethical_scores else 0
        
        # Model dependency breakdown from ImpactEvents
        model_providers: Dict[str, int] = {}
        for impact in impact_events:
            if impact.source_system:
                provider = extract_model_provider(impact.source_system, None)
                model_providers[provider] = model_providers.get(provider, 0) + 1
        
        # Also check TelemetryEvent
        for event in telemetry_events:
            provider = extract_model_provider(event.source, event.meta)
            model_providers[provider] = model_providers.get(provider, 0) + 1
        
        # Calculate external dependency rate (non-hybrid providers)
        total_model_usage = sum(model_providers.values())
        external_usage = sum(count for provider, count in model_providers.items() 
                           if provider != "Other / Hybrid")
        external_dependency_rate = (external_usage / total_model_usage * 100) if total_model_usage > 0 else 0
        
        # Risk distribution
        risk_distribution = {"low": 0, "medium": 0, "high": 0}
        for score in ethical_scores:
            if score < 50:
                risk_distribution["high"] += 1
            elif score < 80:
                risk_distribution["medium"] += 1
            else:
                risk_distribution["low"] += 1
        
        # Daily activity trend
        daily_activity = []
        for date_key in sorted(daily_volume.keys()):
            daily_activity.append({
                "date": date_key,
                "count": daily_volume[date_key]
            })
        
        # Ethical index trend (daily averages)
        ethical_trend: Dict[str, List[float]] = {}
        for log in all_logs:
            date_key = log.created_at.date().isoformat() if log.created_at else None
            if not date_key:
                continue
            
            if date_key not in ethical_trend:
                ethical_trend[date_key] = []
            
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            ethical_trend[date_key].append(ethical_score)
        
        ethical_trend_data = []
        for date_key in sorted(ethical_trend.keys()):
            avg_score = sum(ethical_trend[date_key]) / len(ethical_trend[date_key])
            ethical_trend_data.append({
                "date": date_key,
                "average_ethical_index": round(avg_score, 1)
            })
        
        return {
            "ok": True,
            "metrics": {
                "active_ai_companies": active_ai_companies,
                "observed_ai_systems": observed_ai_systems,
                "daily_ai_activity_volume": {
                    "total": total_activity,
                    "daily": daily_volume,
                    "weekly": sum(daily_volume.values())
                },
                "average_ethical_maturity_index": round(avg_ethical_maturity, 1),
                "high_risk_ai_system_ratio": round(high_risk_ratio, 1),
                "external_model_dependency_rate": round(external_dependency_rate, 1),
                "risk_distribution": risk_distribution,
                "model_dependency_breakdown": model_providers,
                "daily_activity_trend": daily_activity,
                "ethical_index_trend": ethical_trend_data
            }
        }
    
    except Exception as e:
        logger.error(f"[Sanayi] Error generating dashboard: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sanayi dashboard oluşturulamadı"
        )


@router.get("/sanayi/companies")
async def get_sanayi_companies(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    AI Company Monitor - Sanayi Bakanlığı view
    
    Returns AI companies with their AI usage metrics.
    Company names are VISIBLE (not anonymized).
    """
    is_sanayi = current_user.get("is_sanayi", False)
    if not is_sanayi:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sanayi Bakanlığı erişimi gerekli"
        )
    
    try:
        # Get all IntentLogs (last 30 days, all sectors)
        from_date = datetime.utcnow() - timedelta(days=30)
        intent_logs_query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        intent_logs_result = await db.execute(intent_logs_query)
        all_logs = intent_logs_result.scalars().all()
        
        # Group by organization
        org_data: Dict[str, Dict[str, Any]] = {}
        
        for log in all_logs:
            org_id_str = str(log.organization_id)
            
            if org_id_str not in org_data:
                org_data[org_id_str] = {
                    "organization_id": org_id_str,
                    "organization_name": None,
                    "ai_system_types": set(),
                    "ai_models_used": set(),
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
            
            # Track AI system types - will be populated from separate ImpactEvent query
            
            # Update last activity
            if log.created_at:
                if not data["last_activity"] or log.created_at > data["last_activity"]:
                    data["last_activity"] = log.created_at
        
        # Get ImpactEvents for this time period to populate AI system types
        impact_query = select(ImpactEvent).where(
            ImpactEvent.occurred_at >= from_date,
            ImpactEvent.deleted_by_user == False
        )
        impact_result = await db.execute(impact_query)
        impact_events = impact_result.scalars().all()
        
        # Map impact events to organizations
        for impact in impact_events:
            if impact.intent_log_id:
                # Find corresponding IntentLog
                for log in all_logs:
                    if str(log.id) == str(impact.intent_log_id):
                        org_id_str = str(log.organization_id)
                        if org_id_str in org_data and impact.source_system:
                            system_type = classify_ai_system_type(impact.source_system)
                            org_data[org_id_str]["ai_system_types"].add(system_type)
                            provider = extract_model_provider(impact.source_system, None)
                            org_data[org_id_str]["ai_models_used"].add(provider)
                        break
        
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
        
        # Calculate metrics for each company
        companies = []
        for org_id_str, data in org_data.items():
            if not data["organization_name"]:
                continue
            
            # Calculate average ethical index
            avg_ethical = sum(data["ethical_scores"]) / len(data["ethical_scores"]) if data["ethical_scores"] else 0
            
            # Determine primary AI system type
            primary_system_type = list(data["ai_system_types"])[0] if data["ai_system_types"] else "Text Generation"
            
            # AI models used
            ai_models = list(data["ai_models_used"]) if data["ai_models_used"] else ["Unknown"]
            
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
            
            # High-risk event ratio
            high_risk_ratio = (data["high_risk_count"] / data["total_analyses"] * 100) if data["total_analyses"] > 0 else 0
            
            companies.append({
                "organization_id": org_id_str,
                "organization_name": data["organization_name"],
                "primary_ai_system_type": primary_system_type,
                "ai_models_used": ai_models,
                "daily_ai_traffic": data["total_analyses"],
                "average_ethical_index": round(avg_ethical, 1),
                "high_risk_event_ratio": round(high_risk_ratio, 1),
                "risk_trend": trend,
                "last_observed_activity": data["last_activity"].isoformat() if data["last_activity"] else None
            })
        
        # Sort by high-risk ratio (descending)
        companies.sort(key=lambda x: x["high_risk_event_ratio"], reverse=True)
        
        return {
            "ok": True,
            "companies": companies
        }
    
    except Exception as e:
        logger.error(f"[Sanayi] Error fetching companies: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Şirketler alınamadı"
        )


@router.get("/sanayi/systems")
async def get_sanayi_systems(
    system_type: Optional[str] = Query(None, description="Filter by AI system type"),
    days: int = Query(30, ge=7, le=90, description="Time window in days"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    AI System Detail View - Non-content
    
    System-level risk & maturity inspection.
    """
    is_sanayi = current_user.get("is_sanayi", False)
    if not is_sanayi:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sanayi Bakanlığı erişimi gerekli"
        )
    
    try:
        from_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all IntentLogs
        query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        result = await db.execute(query)
        all_logs = result.scalars().all()
        
        # Group by source system
        system_data: Dict[str, Dict[str, Any]] = {}
        
        # Get ImpactEvents for systems
        impact_query = select(ImpactEvent).where(
            ImpactEvent.occurred_at >= from_date,
            ImpactEvent.deleted_by_user == False
        )
        impact_result = await db.execute(impact_query)
        impact_events = impact_result.scalars().all()
        
        # Map ImpactEvents to IntentLogs
        log_map = {str(log.id): log for log in all_logs}
        
        for impact in impact_events:
            if not impact.source_system or not impact.intent_log_id:
                continue
            
            source_system = impact.source_system
            log = log_map.get(str(impact.intent_log_id))
            
            if not log:
                continue
            
            if source_system not in system_data:
                system_data[source_system] = {
                    "system_name": source_system,
                    "system_type": classify_ai_system_type(source_system),
                    "models_used": set(),
                    "ethical_scores": [],
                    "risk_categories": {},
                    "fail_safe_count": 0,
                    "total_events": 0
                }
            
            data = system_data[source_system]
            data["total_events"] += 1
            
            # Track ethical scores from IntentLog
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            data["ethical_scores"].append(ethical_score)
            
            # Track models
            provider = extract_model_provider(impact.source_system, None)
            data["models_used"].add(provider)
            
            # Track risk categories from flags
            if log.flags:
                flag_list = []
                if isinstance(log.flags, dict):
                    flag_list = log.flags.get('flags', []) or []
                elif isinstance(log.flags, list):
                    flag_list = log.flags
                
                for flag in flag_list:
                    flag_name = ""
                    if isinstance(flag, dict):
                        flag_name = flag.get('flag', '') or flag.get('type', '')
                    elif isinstance(flag, str):
                        flag_name = flag
                    
                    if flag_name:
                        data["risk_categories"][flag_name] = data["risk_categories"].get(flag_name, 0) + 1
            
            # Check for fail-safe triggers
            if log.flags and isinstance(log.flags, dict):
                fail_safe = log.flags.get('fail_safe_triggered') or log.flags.get('fail_safe')
                if fail_safe:
                    data["fail_safe_count"] += 1
        
        # Apply system type filter
        if system_type:
            system_data = {k: v for k, v in system_data.items() if v["system_type"] == system_type}
        
        # Build response
        systems = []
        for system_name, data in system_data.items():
            avg_ethical = sum(data["ethical_scores"]) / len(data["ethical_scores"]) if data["ethical_scores"] else 0
            
            # Risk distribution
            risk_dist = {"low": 0, "medium": 0, "high": 0}
            for score in data["ethical_scores"]:
                if score < 50:
                    risk_dist["high"] += 1
                elif score < 80:
                    risk_dist["medium"] += 1
                else:
                    risk_dist["low"] += 1
            
            systems.append({
                "system_name": system_name,
                "system_type": data["system_type"],
                "models_used": list(data["models_used"]),
                "average_ethical_index": round(avg_ethical, 1),
                "risk_distribution": risk_dist,
                "risk_categories": data["risk_categories"],
                "fail_safe_trigger_count": data["fail_safe_count"],
                "total_events": data["total_events"]
            })
        
        # Sort by total events (descending)
        systems.sort(key=lambda x: x["total_events"], reverse=True)
        
        return {
            "ok": True,
            "systems": systems,
            "time_window_days": days
        }
    
    except Exception as e:
        logger.error(f"[Sanayi] Error fetching systems: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sistemler alınamadı"
        )


@router.get("/sanayi/risk-patterns")
async def get_sanayi_risk_patterns(
    days: int = Query(30, ge=7, le=90, description="Time window in days"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Ecosystem Risk Patterns - Sanayi Bakanlığı view
    
    Detects systemic AI risks, not individual failures.
    """
    is_sanayi = current_user.get("is_sanayi", False)
    if not is_sanayi:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sanayi Bakanlığı erişimi gerekli"
        )
    
    try:
        from_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all IntentLogs
        query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        result = await db.execute(query)
        all_logs = result.scalars().all()
        
        # Group by system and organization
        system_patterns: Dict[str, Dict[str, Any]] = {}
        org_patterns: Dict[str, Dict[str, Any]] = {}
        
        for log in all_logs:
            org_id_str = str(log.organization_id)
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            
            # Track organization patterns
            if org_id_str not in org_patterns:
                org_patterns[org_id_str] = {
                    "organization_id": org_id_str,
                    "organization_name": None,
                    "high_risk_events": [],
                    "system_types": set()
                }
            
            if ethical_score < 50:
                org_patterns[org_id_str]["high_risk_events"].append({
                    "timestamp": log.created_at.isoformat() if log.created_at else None,
                    "score": ethical_score
                })
            
            # Track system patterns - will be populated from ImpactEvent query
        
        # Get ImpactEvents to populate system patterns
        impact_query = select(ImpactEvent).where(
            ImpactEvent.occurred_at >= from_date,
            ImpactEvent.deleted_by_user == False
        )
        impact_result = await db.execute(impact_query)
        impact_events = impact_result.scalars().all()
        
        # Map ImpactEvents to IntentLogs
        log_map = {str(log.id): log for log in all_logs}
        
        for impact in impact_events:
            if not impact.source_system or not impact.intent_log_id:
                continue
            
            log = log_map.get(str(impact.intent_log_id))
            if not log:
                continue
            
            org_id_str = str(log.organization_id)
            system_name = impact.source_system
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            
            if system_name not in system_patterns:
                system_patterns[system_name] = {
                    "system_name": system_name,
                    "system_type": classify_ai_system_type(system_name),
                    "model_provider": extract_model_provider(system_name, None),
                    "high_risk_count": 0,
                    "total_events": 0
                }
            
            system_patterns[system_name]["total_events"] += 1
            if ethical_score < 50:
                system_patterns[system_name]["high_risk_count"] += 1
            
            if org_id_str in org_patterns:
                org_patterns[org_id_str]["system_types"].add(classify_ai_system_type(system_name))
        
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
        
        # Build patterns
        repeated_high_risk_systems = [
            {
                "system_name": name,
                "system_type": data["system_type"],
                "model_provider": data["model_provider"],
                "high_risk_count": data["high_risk_count"],
                "total_events": data["total_events"],
                "high_risk_ratio": round((data["high_risk_count"] / data["total_events"] * 100) if data["total_events"] > 0 else 0, 1)
            }
            for name, data in system_patterns.items()
            if data["high_risk_count"] >= 3  # Repeated high-risk threshold
        ]
        
        repeated_high_risk_systems.sort(key=lambda x: x["high_risk_count"], reverse=True)
        
        # Risk clustering by model type
        model_clustering: Dict[str, Dict[str, int]] = {}
        for name, data in system_patterns.items():
            provider = data["model_provider"]
            if provider not in model_clustering:
                model_clustering[provider] = {
                    "total_systems": 0,
                    "high_risk_systems": 0,
                    "total_events": 0,
                    "high_risk_events": 0
                }
            
            model_clustering[provider]["total_systems"] += 1
            model_clustering[provider]["total_events"] += data["total_events"]
            model_clustering[provider]["high_risk_events"] += data["high_risk_count"]
            if data["high_risk_count"] >= 3:
                model_clustering[provider]["high_risk_systems"] += 1
        
        # Risk clustering by system type
        system_type_clustering: Dict[str, Dict[str, int]] = {}
        for name, data in system_patterns.items():
            sys_type = data["system_type"]
            if sys_type not in system_type_clustering:
                system_type_clustering[sys_type] = {
                    "total_systems": 0,
                    "high_risk_systems": 0,
                    "total_events": 0,
                    "high_risk_events": 0
                }
            
            system_type_clustering[sys_type]["total_systems"] += 1
            system_type_clustering[sys_type]["total_events"] += data["total_events"]
            system_type_clustering[sys_type]["high_risk_events"] += data["high_risk_count"]
            if data["high_risk_count"] >= 3:
                system_type_clustering[sys_type]["high_risk_systems"] += 1
        
        # Trend detection
        recent_logs = [log for log in all_logs 
                      if log.created_at and log.created_at >= datetime.utcnow() - timedelta(days=7)]
        older_logs = [log for log in all_logs 
                     if log.created_at and log.created_at < datetime.utcnow() - timedelta(days=7)]
        
        recent_high_risk = sum(1 for log in recent_logs 
                              if (log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50) < 50)
        older_high_risk = sum(1 for log in older_logs 
                             if (log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50) < 50)
        
        ecosystem_risk_trend = "Stable"
        if recent_high_risk > older_high_risk * 1.2:
            ecosystem_risk_trend = "Increasing"
        elif recent_high_risk < older_high_risk * 0.8:
            ecosystem_risk_trend = "Decreasing"
        
        return {
            "ok": True,
            "repeated_high_risk_systems": repeated_high_risk_systems,
            "model_clustering": model_clustering,
            "system_type_clustering": system_type_clustering,
            "ecosystem_risk_trend": ecosystem_risk_trend,
            "time_window_days": days
        }
    
    except Exception as e:
        logger.error(f"[Sanayi] Error fetching risk patterns: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Risk kalıpları alınamadı"
        )


@router.get("/sanayi/alerts")
async def get_sanayi_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_proxy_auth_production)
):
    """
    Observational Alerts - Tech Policy view
    
    Early warning for strategic risks.
    Alerts are informational, non-punitive, logged only.
    """
    is_sanayi = current_user.get("is_sanayi", False)
    if not is_sanayi:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sanayi Bakanlığı erişimi gerekli"
        )
    
    try:
        # Get logs from last 30 days
        from_date = datetime.utcnow() - timedelta(days=30)
        query = select(IntentLog).where(
            IntentLog.created_at >= from_date,
            IntentLog.deleted_by_user == False
        )
        result = await db.execute(query)
        all_logs = result.scalars().all()
        
        alerts = []
        
        # Alert 1: High external dependency on single AI provider
        # Get ImpactEvents for model provider analysis
        impact_query = select(ImpactEvent).where(
            ImpactEvent.occurred_at >= from_date,
            ImpactEvent.deleted_by_user == False
        )
        impact_result = await db.execute(impact_query)
        impact_events = impact_result.scalars().all()
        
        model_providers: Dict[str, int] = {}
        for impact in impact_events:
            if impact.source_system:
                provider = extract_model_provider(impact.source_system, None)
                model_providers[provider] = model_providers.get(provider, 0) + 1
        
        if model_providers:
            total_usage = sum(model_providers.values())
            max_provider = max(model_providers.items(), key=lambda x: x[1])
            max_provider_ratio = (max_provider[1] / total_usage * 100) if total_usage > 0 else 0
            
            if max_provider_ratio > 70:  # Threshold: 70%+ dependency
                alerts.append({
                    "type": "High External Dependency on Single AI Provider",
                    "severity": "High",
                    "description": f"{max_provider[0]} tek bir sağlayıcıya %{max_provider_ratio:.1f} bağımlılık tespit edildi",
                    "provider": max_provider[0],
                    "dependency_rate": round(max_provider_ratio, 1),
                    "timestamp": datetime.utcnow().isoformat()
                })
        
        # Alert 2: Rapid growth in high-risk AI systems
        recent_logs = [log for log in all_logs 
                      if log.created_at and log.created_at >= datetime.utcnow() - timedelta(days=7)]
        older_logs = [log for log in all_logs 
                     if log.created_at and log.created_at < datetime.utcnow() - timedelta(days=7)]
        
        recent_high_risk = sum(1 for log in recent_logs 
                              if (log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50) < 50)
        older_high_risk = sum(1 for log in older_logs 
                             if (log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50) < 50)
        
        if older_high_risk > 0 and recent_high_risk > older_high_risk * 2:  # 2x growth
            growth_rate = ((recent_high_risk - older_high_risk) / older_high_risk * 100) if older_high_risk > 0 else 0
            alerts.append({
                "type": "Rapid Growth in High-Risk AI Systems",
                "severity": "Medium",
                "description": f"Son 7 günde yüksek riskli AI sistemlerinde %{growth_rate:.1f} artış tespit edildi",
                "recent_count": recent_high_risk,
                "older_count": older_high_risk,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Alert 3: Declining ethical maturity in specific sector
        sector_ethical: Dict[str, List[float]] = {}
        for log in all_logs:
            sector = log.sector or "Unknown"
            if sector not in sector_ethical:
                sector_ethical[sector] = []
            
            ethical_score = log.risk_scores.get("ethical_index", 50) if isinstance(log.risk_scores, dict) else 50
            sector_ethical[sector].append(ethical_score)
        
        for sector, scores in sector_ethical.items():
            if len(scores) >= 20:  # Minimum sample size
                recent_scores = scores[-10:]
                older_scores = scores[:10]
                recent_avg = sum(recent_scores) / len(recent_scores)
                older_avg = sum(older_scores) / len(older_scores)
                
                if recent_avg < older_avg - 10:  # 10 point decline
                    alerts.append({
                        "type": "Declining Ethical Maturity in Specific Sector",
                        "severity": "Medium",
                        "description": f"{sector} sektöründe etik olgunluk indeksinde düşüş tespit edildi (Eski: {older_avg:.1f}, Yeni: {recent_avg:.1f})",
                        "sector": sector,
                        "decline": round(older_avg - recent_avg, 1),
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
        logger.error(f"[Sanayi] Error fetching alerts: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Uyarılar alınamadı"
        )

