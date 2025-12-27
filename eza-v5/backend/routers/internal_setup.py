# -*- coding: utf-8 -*-
"""
Internal Setup Router
Production-Safe Internal Test User Creation
⚠️ FOR INTERNAL USE ONLY - PROTECTED BY INTERNAL_SETUP_KEY
"""

import logging
import secrets
import string
from typing import Dict, Any
from fastapi import APIRouter, Header, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.utils.dependencies import get_db
from backend.models.production import User
from backend.services.production_auth import hash_password, normalize_email
from backend.config import get_settings

router = APIRouter(prefix="/internal", tags=["internal-setup"])
logger = logging.getLogger(__name__)

# Test user specification
TEST_USER_EMAIL = "regulator-test@ezacore.ai"
TEST_USER_ROLE = "REGULATOR_AUDITOR"


def generate_strong_password(length: int = 24) -> str:
    """Generate a strong temporary password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password


@router.post("/create-test-regulator-user")
async def create_test_regulator_user(
    internal_setup_key: str = Header(None, alias="internal-setup-key"),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Create or update test regulator user (INTERNAL USE ONLY)
    
    ⚠️ SECURITY: Protected by INTERNAL_SETUP_KEY header
    This endpoint should be disabled or key changed after use.
    """
    settings = get_settings()
    
    # Get INTERNAL_SETUP_KEY from environment
    required_key = getattr(settings, 'INTERNAL_SETUP_KEY', None)
    
    if not required_key:
        logger.error("[InternalSetup] INTERNAL_SETUP_KEY not configured in environment")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal setup key not configured"
        )
    
    # Validate key
    if not internal_setup_key or internal_setup_key != required_key:
        logger.warning(f"[InternalSetup] Invalid or missing internal-setup-key header")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid internal setup key"
        )
    
    try:
        # Normalize email
        normalized_email = normalize_email(TEST_USER_EMAIL)
        
        # Check if user already exists
        result = await db.execute(
            select(User).where(User.email == normalized_email)
        )
        existing_user = result.scalar_one_or_none()
        
        # Generate new password
        password = generate_strong_password()
        password_hash = hash_password(password)
        
        if existing_user:
            # Update existing user
            logger.info(f"[InternalSetup] Updating existing test regulator user: {TEST_USER_EMAIL}")
            existing_user.password_hash = password_hash
            existing_user.role = TEST_USER_ROLE
            existing_user.is_active = True
            existing_user.is_internal_test_user = True
            
            await db.commit()
            await db.refresh(existing_user)
            
            logger.info(f"[InternalSetup] Test regulator user updated successfully")
            
            return {
                "ok": True,
                "email": TEST_USER_EMAIL,
                "password": password,
                "role": TEST_USER_ROLE,
                "is_active": True,
                "is_internal_test_user": True,
                "note": "Temporary internal test user. Change password after login.",
                "warning": "⚠️ This endpoint should be disabled after use or INTERNAL_SETUP_KEY should be changed."
            }
        else:
            # Create new user
            logger.info(f"[InternalSetup] Creating new test regulator user: {TEST_USER_EMAIL}")
            
            new_user = User(
                email=normalized_email,
                password_hash=password_hash,
                role=TEST_USER_ROLE,
                is_active=True,
                is_internal_test_user=True
            )
            
            db.add(new_user)
            await db.commit()
            await db.refresh(new_user)
            
            logger.info(f"[InternalSetup] Test regulator user created successfully: {new_user.id}")
            
            return {
                "ok": True,
                "email": TEST_USER_EMAIL,
                "password": password,
                "role": TEST_USER_ROLE,
                "is_active": True,
                "is_internal_test_user": True,
                "note": "Temporary internal test user. Change password after login.",
                "warning": "⚠️ This endpoint should be disabled after use or INTERNAL_SETUP_KEY should be changed."
            }
            
    except Exception as e:
        await db.rollback()
        logger.error(f"[InternalSetup] Error creating test regulator user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error: {str(e)}"
        )

