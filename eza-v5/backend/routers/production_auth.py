# -*- coding: utf-8 -*-
"""
Production Authentication Router
Register, Login, Logout endpoints
"""

import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.services.production_auth import (
    create_user, authenticate_user, create_access_token, check_bootstrap_allowed,
    hash_password, reset_user_password, normalize_email
)
from backend.models.production import User
from sqlalchemy import select, func
from backend.services.production_org import create_organization

router = APIRouter()
logger = logging.getLogger(__name__)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"  # admin, org_admin, user, ops, regulator
    full_name: str | None = None  # Optional full name (not stored in DB yet)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    email: str


class LogoutRequest(BaseModel):
    pass  # JWT is stateless, logout is client-side (token removal)


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str


@router.post("/register", response_model=TokenResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user
    
    In bootstrap mode (no users exist), first user can be admin.
    Otherwise, only admins can create users (future: admin-only endpoint).
    """
    # Check if bootstrap allowed
    is_bootstrap = await check_bootstrap_allowed(db)
    
    # Determine final role
    final_role = request.role
    
    # In bootstrap mode, first user MUST be admin
    if is_bootstrap:
        if request.role not in ["admin", "org_admin"]:
            logger.warning(f"[Register] Bootstrap mode: Forcing role to 'admin' (requested: {request.role})")
            final_role = "admin"
    else:
        # Not bootstrap mode: Only existing admins can create admin users
        if request.role in ["admin", "org_admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only existing admins can create admin users. Use bootstrap mode for first admin."
            )
    
    try:
        user = await create_user(
            db=db,
            email=request.email,
            password=request.password,
            role=final_role
        )
        
        # Create JWT token
        access_token = create_access_token(user)
        
        return TokenResponse(
            access_token=access_token,
            user_id=str(user.id),
            role=user.role,
            email=user.email
        )
    except ValueError as e:
        logger.error(f"Register validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Register error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """User login with email and password"""
    user = await authenticate_user(db, request.email, request.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create JWT token
    access_token = create_access_token(user)
    
    return TokenResponse(
        access_token=access_token,
        user_id=str(user.id),
        role=user.role,
        email=user.email
    )


@router.post("/logout")
async def logout():
    """
    Logout endpoint (client-side token removal)
    
    JWT is stateless, so logout is handled by client removing token.
    This endpoint exists for API contract consistency.
    """
    return {"message": "Logged out successfully"}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset user password by email
    NOTE: In production, this should require email verification or admin access
    For now, this is a simple reset endpoint for development/testing
    """
    try:
        success = await reset_user_password(db, request.email, request.new_password)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {"message": "Password reset successfully"}
    except Exception as e:
        logger.exception(f"Password reset error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password reset failed: {str(e)}"
        )


@router.get("/debug/check-email")
async def debug_check_email(
    email: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Debug endpoint to check if email exists in database
    Returns email variations found in DB
    """
    normalized = normalize_email(email)
    
    # Try exact match
    result = await db.execute(select(User).where(User.email == normalized))
    exact_user = result.scalar_one_or_none()
    
    # Try case-insensitive
    result = await db.execute(select(User).where(func.lower(User.email) == normalized))
    case_insensitive_user = result.scalar_one_or_none()
    
    # Get all users with similar email (for debugging)
    result = await db.execute(
        select(User.email, User.role, User.created_at)
        .where(func.lower(User.email).like(f"%{normalized.split('@')[0]}%"))
        .limit(5)
    )
    similar_emails = result.all()
    
    return {
        "normalized_email": normalized,
        "exact_match": exact_user.email if exact_user else None,
        "case_insensitive_match": case_insensitive_user.email if case_insensitive_user else None,
        "similar_emails": [{"email": row[0], "role": row[1], "created_at": str(row[2])} for row in similar_emails]
    }

