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
from backend.config import get_settings

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
        logger.info(f"[Register] Step 1: Starting registration for email: {request.email}, role: {final_role}")
        logger.info(f"[Register] Step 2: Calling create_user...")
        
        user = await create_user(
            db=db,
            email=request.email,
            password=request.password,
            role=final_role
        )
        
        logger.info(f"[Register] Step 3: User created successfully. User ID: {user.id}, Email: {user.email}")
        
        # Immediately test login with the same credentials
        logger.info(f"[Register] Step 4: Testing login immediately after registration...")
        test_user = await authenticate_user(db, request.email, request.password)
        if test_user:
            logger.info(f"[Register] Step 5: ✓ Login test successful immediately after registration")
        else:
            logger.error(f"[Register] Step 5: ✗ CRITICAL: Login test FAILED immediately after registration!")
            logger.error(f"[Register] This indicates a password hashing/verification issue")
        
        # Create JWT token
        logger.info(f"[Register] Step 6: Creating JWT access token...")
        try:
            access_token = create_access_token(user)
            logger.info(f"[Register] Step 7: JWT token created successfully (length: {len(access_token)})")
        except Exception as jwt_error:
            logger.error(f"[Register] Step 7: ✗ JWT token creation failed: {jwt_error}")
            raise
        
        logger.info(f"[Register] Step 8: Preparing response...")
        response = TokenResponse(
            access_token=access_token,
            user_id=str(user.id),
            role=user.role,
            email=user.email
        )
        logger.info(f"[Register] Step 9: ✓ Registration completed successfully for {user.email} (role: {user.role})")
        return response
    except ValueError as e:
        logger.error(f"Register validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        settings = get_settings()
        error_trace = traceback.format_exc()
        logger.exception(f"Register error: {e}")
        logger.error(f"Register error traceback: {error_trace}")
        # Return more detailed error in development, generic in production
        error_detail = str(e) if getattr(settings, "ENV", "production") == "dev" else "Registration failed. Please check server logs."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
        )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """User login with email and password"""
    try:
        normalized_email = normalize_email(request.email)
        logger.info(f"[Login] Step 1: Attempting login for email: {normalized_email} (original: {request.email})")
        
        # Check if user exists (for better error messages)
        logger.info(f"[Login] Step 2: Checking if user exists...")
        result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
        user_exists = result.scalar_one_or_none()
        
        if not user_exists:
            logger.warning(f"[Login] Step 3: User not found: {normalized_email}")
            # Try to find similar emails for debugging
            all_users_result = await db.execute(select(User.email, User.role).limit(10))
            all_emails = [(row[0], row[1]) for row in all_users_result.all()]
            logger.warning(f"[Login] Available users in DB (sample): {all_emails}")
            logger.warning(f"[Login] Searched for normalized email: '{normalized_email}'")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        logger.info(f"[Login] Step 3: User found, authenticating...")
        # Authenticate
        user = await authenticate_user(db, request.email, request.password)
        
        if not user:
            logger.warning(f"[Login] Step 4: Authentication failed for: {normalized_email} (user exists but password incorrect)")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        logger.info(f"[Login] Step 4: Authentication successful. Role: {user.role}")
        logger.info(f"[Login] Step 5: Creating JWT token...")
        
        # Create JWT token
        try:
            access_token = create_access_token(user)
            logger.info(f"[Login] Step 6: JWT token created successfully (length: {len(access_token)})")
        except Exception as jwt_error:
            logger.error(f"[Login] Step 6: ✗ JWT token creation failed: {jwt_error}")
            import traceback
            logger.error(f"[Login] JWT error traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token creation failed. Please check server logs."
            )
        
        logger.info(f"[Login] Step 7: ✓ Login successful for: {normalized_email} (role: {user.role})")
        
        return TokenResponse(
            access_token=access_token,
            user_id=str(user.id),
            role=user.role,
            email=user.email
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        import traceback
        settings = get_settings()
        error_trace = traceback.format_exc()
        logger.exception(f"[Login] ✗ Login error: {e}")
        logger.error(f"[Login] Error traceback: {error_trace}")
        error_detail = str(e) if getattr(settings, "ENV", "production") == "dev" else "Login failed. Please check server logs."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
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
        logger.info(f"[ResetPassword] Step 1: Starting password reset for email: {request.email}")
        logger.info(f"[ResetPassword] Step 2: Calling reset_user_password...")
        
        success = await reset_user_password(db, request.email, request.new_password)
        
        if not success:
            logger.warning(f"[ResetPassword] Step 3: Password reset failed - user not found or reset failed")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found or password reset failed"
            )
        
        logger.info(f"[ResetPassword] Step 3: ✓ Password reset successful for: {request.email}")
        return {"message": "Password reset successfully"}
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        import traceback
        settings = get_settings()
        error_trace = traceback.format_exc()
        logger.exception(f"[ResetPassword] ✗ Password reset error: {e}")
        logger.error(f"[ResetPassword] Error traceback: {error_trace}")
        error_detail = str(e) if getattr(settings, "ENV", "production") == "dev" else "Password reset failed. Please check server logs."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail
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
    
    # Get all users (for debugging)
    result = await db.execute(
        select(User.email, User.role, User.created_at)
        .order_by(User.created_at.desc())
        .limit(50)
    )
    all_users = result.all()
    
    # Get total user count
    count_result = await db.execute(select(func.count(User.id)))
    total_users = count_result.scalar() or 0
    
    return {
        "normalized_email": normalized,
        "original_email": email,
        "total_users_in_db": total_users,
        "exact_match": {
            "found": exact_user is not None,
            "email": exact_user.email if exact_user else None,
            "role": exact_user.role if exact_user else None,
            "user_id": str(exact_user.id) if exact_user else None
        },
        "case_insensitive_match": {
            "found": case_insensitive_user is not None,
            "email": case_insensitive_user.email if case_insensitive_user else None,
            "role": case_insensitive_user.role if case_insensitive_user else None,
            "user_id": str(case_insensitive_user.id) if case_insensitive_user else None
        },
        "all_users_in_db": [
            {
                "email": row[0], 
                "role": row[1], 
                "created_at": str(row[2])
            } for row in all_users
        ]
    }


@router.post("/debug/test-login")
async def debug_test_login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Debug endpoint to test login with detailed logging
    """
    from backend.services.production_auth import authenticate_user, verify_password, normalize_email
    from sqlalchemy import select, func
    
    normalized_email = normalize_email(request.email)
    logger.info(f"[Debug Login] Testing login for: {normalized_email}")
    
    # Find user
    result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    user = result.scalar_one_or_none()
    
    if not user:
        return {
            "found": False,
            "error": "User not found",
            "searched_email": normalized_email
        }
    
    # Test password verification
    password_valid = verify_password(request.password, user.password_hash)
    
    return {
        "found": True,
        "email": user.email,
        "role": user.role,
        "user_id": str(user.id),
        "password_hash_length": len(user.password_hash) if user.password_hash else 0,
        "password_hash_preview": user.password_hash[:30] + "..." if user.password_hash else None,
        "password_valid": password_valid,
        "normalized_email": normalized_email,
        "email_match": user.email == normalized_email
    }

