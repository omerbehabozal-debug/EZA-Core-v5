# -*- coding: utf-8 -*-
"""
Model Registry Service (EU AI Act)
Handles AI model registration and risk profiling
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.models.model_registry import ModelRegistry
from backend.core.engines.eza_risk_engine import compute_risk
import json


async def register_model(
    db: AsyncSession,
    model_name: str,
    version: str,
    risk_profile: Optional[Dict[str, Any]] = None,
    provider: Optional[str] = None
) -> ModelRegistry:
    """
    Register a new AI model
    
    Args:
        db: Database session
        model_name: Model name
        version: Model version
        risk_profile: Risk profile dictionary
        provider: Model provider name
    
    Returns:
        Created ModelRegistry object
    """
    # If risk_profile not provided, compute basic one
    if risk_profile is None:
        # Use a default description to compute risk
        default_text = f"AI model {model_name} version {version}"
        risk_result = compute_risk(default_text)
        risk_profile = {
            "risk_score": risk_result["risk_score"],
            "risk_level": risk_result["risk_level"],
            "computed_at": risk_result.get("input_analysis", {})
        }
    
    # Create model registry entry
    model_registry = ModelRegistry(
        model_name=model_name,
        version=version,
        risk_profile=json.dumps(risk_profile) if risk_profile else None,
        provider=provider,
        compliance_status="pending"
    )
    
    db.add(model_registry)
    await db.commit()
    await db.refresh(model_registry)
    
    return model_registry


async def list_models(
    db: AsyncSession,
    provider: Optional[str] = None,
    compliance_status: Optional[str] = None
) -> List[ModelRegistry]:
    """
    List registered models
    
    Args:
        db: Database session
        provider: Filter by provider
        compliance_status: Filter by compliance status
    
    Returns:
        List of ModelRegistry objects
    """
    query = select(ModelRegistry)
    
    if provider:
        query = query.where(ModelRegistry.provider == provider)
    
    if compliance_status:
        query = query.where(ModelRegistry.compliance_status == compliance_status)
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_model_by_id(db: AsyncSession, model_id: int) -> Optional[ModelRegistry]:
    """Get a model by ID"""
    result = await db.execute(select(ModelRegistry).where(ModelRegistry.id == model_id))
    return result.scalar_one_or_none()


async def get_risk_profile(
    db: AsyncSession,
    model_id: int
) -> Optional[Dict[str, Any]]:
    """
    Get risk profile for a model
    
    Args:
        db: Database session
        model_id: Model ID
    
    Returns:
        Risk profile dictionary or None
    """
    model = await get_model_by_id(db, model_id)
    if not model or not model.risk_profile:
        return None
    
    return json.loads(model.risk_profile)

