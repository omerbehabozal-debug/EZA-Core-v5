# -*- coding: utf-8 -*-
"""
Institution Router - Multi-tenant institution management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from backend.core.utils.dependencies import get_db, require_internal
from backend.models.institution import Institution
from backend.models.application import Application
from backend.models.api_key import APIKey
from backend.core.utils.security import hash_api_key
import secrets

router = APIRouter()


class InstitutionCreate(BaseModel):
    name: str
    code: Optional[str] = None
    domain: Optional[str] = None


class InstitutionResponse(BaseModel):
    id: int
    name: str
    code: Optional[str]
    domain: Optional[str]
    is_active: bool
    
    class Config:
        from_attributes = True


class ApplicationCreate(BaseModel):
    name: str


class ApplicationResponse(BaseModel):
    id: int
    institution_id: int
    name: str
    client_id: str
    status: str
    
    class Config:
        from_attributes = True


@router.get("/", response_model=List[InstitutionResponse])
async def list_institutions(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_internal())
):
    """List all institutions"""
    result = await db.execute(select(Institution))
    institutions = result.scalars().all()
    return institutions


@router.post("/", response_model=InstitutionResponse, status_code=status.HTTP_201_CREATED)
async def create_institution(
    data: InstitutionCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_internal())
):
    """Create new institution"""
    institution = Institution(
        name=data.name,
        code=data.code,
        domain=data.domain,
        is_active=True
    )
    db.add(institution)
    await db.commit()
    await db.refresh(institution)
    return institution


@router.get("/{institution_id}", response_model=InstitutionResponse)
async def get_institution(
    institution_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_internal())
):
    """Get institution details"""
    result = await db.execute(select(Institution).where(Institution.id == institution_id))
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    return institution


@router.post("/{institution_id}/apps", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    institution_id: int,
    data: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_internal())
):
    """Create application for institution"""
    # Verify institution exists
    result = await db.execute(select(Institution).where(Institution.id == institution_id))
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    # Generate client_id and client_secret
    client_id = f"app_{institution_id}_{secrets.token_urlsafe(16)}"
    client_secret = secrets.token_urlsafe(32)
    client_secret_hash = hash_api_key(client_secret)
    
    application = Application(
        institution_id=institution_id,
        name=data.name,
        client_id=client_id,
        client_secret=client_secret_hash,
        status="active"
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)
    
    # Return with unhashed secret (only time it's shown)
    response = ApplicationResponse(
        id=application.id,
        institution_id=application.institution_id,
        name=application.name,
        client_id=application.client_id,
        status=application.status
    )
    # Note: In production, return client_secret separately or via secure channel
    return response


@router.post("/{institution_id}/api-key", status_code=status.HTTP_201_CREATED)
async def create_api_key(
    institution_id: int,
    name: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_internal())
):
    """Create API key for institution"""
    # Verify institution exists
    result = await db.execute(select(Institution).where(Institution.id == institution_id))
    institution = result.scalar_one_or_none()
    if not institution:
        raise HTTPException(status_code=404, detail="Institution not found")
    
    # Generate API key
    api_key = secrets.token_urlsafe(32)
    api_key_hash = hash_api_key(api_key)
    
    key_record = APIKey(
        name=name,
        key_hash=api_key_hash,
        user_id=current_user.id if current_user else 1,  # TODO: Fix when auth is enabled
        institution_id=institution_id,
        is_active=True
    )
    db.add(key_record)
    await db.commit()
    
    return {
        "api_key": api_key,  # Only time it's shown
        "name": name,
        "institution_id": institution_id
    }

