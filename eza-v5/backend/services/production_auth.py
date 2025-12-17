# -*- coding: utf-8 -*-
"""
Production Authentication Service
Bcrypt password hashing and JWT token management
"""

import bcrypt
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from jose import jwt

from backend.config import get_settings
from backend.models.production import User, Organization, OrganizationUser
from backend.auth.jwt import create_jwt

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def normalize_email(email: str) -> str:
    """Normalize email: lowercase and strip whitespace"""
    return email.strip().lower()


async def create_user(
    db: AsyncSession,
    email: str,
    password: str,
    role: str = "user"
) -> User:
    """Create a new user"""
    try:
        logger.info(f"[create_user] Step 1: Normalizing email: {email}")
        # Normalize email (lowercase and trim)
        normalized_email = normalize_email(email)
        logger.info(f"[create_user] Step 2: Normalized email: {normalized_email}")
        
        # Check if user already exists
        logger.info(f"[create_user] Step 3: Checking if user already exists...")
        result = await db.execute(select(User).where(User.email == normalized_email))
        existing = result.scalar_one_or_none()
        if existing:
            logger.warning(f"[create_user] User already exists: {normalized_email}")
            raise ValueError(f"User with email {normalized_email} already exists")
        logger.info(f"[create_user] Step 4: User does not exist, proceeding...")
        
        # Hash password
        logger.info(f"[create_user] Step 5: Hashing password...")
        password_hash = hash_password(password)
        logger.info(f"[create_user] Step 6: Password hashed. Length: {len(password_hash)}, Starts with: {password_hash[:20]}...")
        
        # Create user
        logger.info(f"[create_user] Step 7: Creating User object...")
        user = User(
            email=normalized_email,
            password_hash=password_hash,
            role=role
        )
        logger.info(f"[create_user] Step 8: Adding user to database session...")
        db.add(user)
        logger.info(f"[create_user] Step 9: Committing to database...")
        await db.commit()
        logger.info(f"[create_user] Step 10: Refreshing user from database...")
        await db.refresh(user)
        logger.info(f"[create_user] Step 11: User refreshed. ID: {user.id}")
        
        # Verify the password was saved correctly
        logger.info(f"[create_user] Step 12: Verifying password hash...")
        test_verify = verify_password(password, user.password_hash)
        logger.info(f"[create_user] Step 13: Password verification result: {test_verify}")
        if not test_verify:
            logger.error(f"[create_user] CRITICAL: Password hash verification failed immediately after user creation!")
            logger.error(f"[create_user] Original hash: {password_hash[:50]}...")
            logger.error(f"[create_user] Saved hash: {user.password_hash[:50] if user.password_hash else 'None'}...")
        else:
            logger.info(f"[create_user] Step 14: ✓ Password verification successful")
        
        logger.info(f"[create_user] ✓ Created user: {normalized_email} with role {role}, ID: {user.id}")
        return user
    except ValueError:
        # Re-raise ValueError as-is
        raise
    except Exception as e:
        logger.exception(f"[create_user] ✗ Error creating user: {e}")
        raise


async def authenticate_user(
    db: AsyncSession,
    email: str,
    password: str
) -> Optional[User]:
    """Authenticate user by email and password"""
    try:
        # Normalize email (lowercase and trim)
        normalized_email = normalize_email(email)
        
        # Try exact match first (for normalized emails)
        result = await db.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()
        
        # If not found, try case-insensitive search (for legacy emails)
        if not user:
            result = await db.execute(
                select(User).where(func.lower(User.email) == normalized_email)
            )
            user = result.scalar_one_or_none()
            
            # If found with case-insensitive, update to normalized email
            if user:
                logger.info(f"Found user with case-insensitive match, updating email to normalized: {normalized_email}")
                user.email = normalized_email
                await db.commit()
                await db.refresh(user)
        
        if not user:
            logger.debug(f"Authentication failed: User not found for email {normalized_email}")
            return None
        
        # Verify password
        logger.info(f"[Auth] Verifying password for user: {normalized_email}")
        logger.info(f"[Auth] Password hash length: {len(user.password_hash) if user.password_hash else 0}")
        logger.info(f"[Auth] Password hash starts with: {user.password_hash[:20] if user.password_hash else 'None'}...")
        
        try:
            password_valid = verify_password(password, user.password_hash)
            logger.info(f"[Auth] Password verification result: {password_valid}")
        except Exception as verify_err:
            logger.error(f"[Auth] Password verification exception: {verify_err}")
            logger.error(f"[Auth] Hash format may be invalid. Hash: {user.password_hash[:50] if user.password_hash else 'None'}...")
            return None
        
        if not password_valid:
            logger.warning(f"[Auth] Authentication failed: Invalid password for email {normalized_email}")
            logger.warning(f"[Auth] Password verification failed - hash may be incorrect or password doesn't match")
            logger.warning(f"[Auth] Consider using password reset endpoint to set a new password")
            return None
        
        logger.info(f"Authentication successful for user: {normalized_email} (role: {user.role})")
        return user
    except Exception as e:
        logger.exception(f"Authentication error for {email}: {e}")
        return None


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    """Get user by UUID"""
    import uuid
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        return None
    
    result = await db.execute(select(User).where(User.id == user_uuid))
    return result.scalar_one_or_none()


async def reset_user_password(
    db: AsyncSession,
    email: str,
    new_password: str
) -> bool:
    """Reset user password by email"""
    try:
        # Normalize email (lowercase and trim)
        normalized_email = normalize_email(email)
        
        # Try exact match first (for normalized emails)
        result = await db.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()
        
        # If not found, try case-insensitive search (for legacy emails)
        if not user:
            result = await db.execute(
                select(User).where(func.lower(User.email) == normalized_email)
            )
            user = result.scalar_one_or_none()
            
            # If found with case-insensitive, update to normalized email
            if user:
                logger.info(f"Found user with case-insensitive match for password reset, updating email to normalized: {normalized_email}")
                user.email = normalized_email
        
        if not user:
            logger.warning(f"Password reset failed: User not found for email {normalized_email}")
            return False
        
        # Hash the new password
        new_hash = hash_password(new_password)
        logger.debug(f"Password reset: Generated hash for {normalized_email} (length: {len(new_hash)})")
        
        # Store old hash for comparison
        old_hash = user.password_hash
        
        # Update password hash
        user.password_hash = new_hash
        await db.commit()
        await db.refresh(user)
        
        # Verify the password was actually updated
        if user.password_hash == old_hash:
            logger.error(f"Password reset failed: Hash did not change for {normalized_email}")
            await db.rollback()
            return False
        
        # Test password verification
        if verify_password(new_password, user.password_hash):
            logger.info(f"Password reset successful for user: {normalized_email}")
            return True
        else:
            logger.error(f"Password reset failed: Verification failed for {normalized_email}")
            await db.rollback()
            return False
    except Exception as e:
        logger.exception(f"Password reset error for {email}: {e}")
        await db.rollback()
        return False


async def check_bootstrap_allowed(db: AsyncSession) -> bool:
    """Check if bootstrap is allowed (no users or orgs exist)"""
    # Check if any users exist
    result = await db.execute(select(User).limit(1))
    has_users = result.scalar_one_or_none() is not None
    
    # Check if any organizations exist
    result = await db.execute(select(Organization).limit(1))
    has_orgs = result.scalar_one_or_none() is not None
    
    # Bootstrap allowed only if no users AND no orgs
    return not has_users and not has_orgs


def create_access_token(user: User, expires_in_hours: int = 8) -> str:
    """Create JWT access token for user"""
    try:
        settings = get_settings()
        jwt_secret = getattr(settings, "EZA_JWT_SECRET", None) or getattr(settings, "JWT_SECRET", None)
        
        if not jwt_secret:
            logger.error("JWT_SECRET is not configured! Cannot create access token.")
            raise ValueError("JWT_SECRET is not configured in environment variables")
        
        expire = datetime.utcnow() + timedelta(hours=expires_in_hours)
        
        payload = {
            "sub": str(user.id),  # UUID as string
            "user_id": str(user.id),
            "role": user.role,
            "email": user.email,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        }
        
        encoded_jwt = jwt.encode(
            payload,
            jwt_secret,
            algorithm="HS256"
        )
        
        logger.debug(f"JWT token created for user {user.id} with role {user.role}")
        return encoded_jwt
    except Exception as e:
        logger.exception(f"Error creating access token: {e}")
        raise

