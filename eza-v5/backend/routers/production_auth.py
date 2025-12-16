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
    create_user, authenticate_user, create_access_token, check_bootstrap_allowed
)
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
    
    # In bootstrap mode, allow first user to be admin
    # Otherwise, require admin role (TODO: implement admin-only check)
    if not is_bootstrap and request.role in ["admin", "org_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only existing admins can create admin users. Use bootstrap mode for first admin."
        )
    
    try:
        user = await create_user(
            db=db,
            email=request.email,
            password=request.password,
            role=request.role
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

