#!/usr/bin/env python3
"""
Create Regulator Test Users

Creates production-safe internal test regulator users for all regulator panels.
These users:
- Are created in the backend database
- Have correct REGULATOR roles
- Are marked as internal + test users
- Are idempotent (running twice does NOT create duplicates)
- Work with existing auth & RBAC system
- Do NOT affect real users or production data

Usage:
    python backend/scripts/create_regulator_test_users.py
"""

import asyncio
import sys
import os
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add backend parent directory to path (so 'backend' module can be imported)
backend_dir = Path(__file__).parent.parent
backend_parent = backend_dir.parent
sys.path.insert(0, str(backend_parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, text
from backend.models.production import User
from backend.services.production_auth import hash_password, normalize_email
from backend.config import get_settings

# Common password for all test users
COMMON_PASSWORD = "Ez@Core-Test-2025"

# Test users specification
TEST_USERS = [
    {
        "email": "rtuk-test@ezacore.ai",
        "role": "REGULATOR_RTUK",
        "panel": "rtuk.ezacore.ai",
        "name": "RTÜK"
    },
    {
        "email": "tech-test@ezacore.ai",
        "role": "REGULATOR_SANAYI",  # Note: Codebase uses REGULATOR_SANAYI (not REGULATOR_TECH)
        "panel": "sanayi.ezacore.ai",
        "name": "SANAYI / AI"
    },
    {
        "email": "finance-test@ezacore.ai",
        "role": "REGULATOR_FINANCE",
        "panel": "finance.ezacore.ai",
        "name": "FINANCE"
    },
    {
        "email": "health-test@ezacore.ai",
        "role": "REGULATOR_HEALTH",
        "panel": "health.ezacore.ai",
        "name": "HEALTH"
    },
]


async def ensure_columns_exist(conn):
    """Ensure is_active and is_internal_test_user columns exist"""
    # Check if is_active column exists
    result = await conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'production_users' 
        AND column_name = 'is_active'
    """))
    if not result.fetchone():
        await conn.execute(text("""
            ALTER TABLE production_users 
            ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE
        """))
        print("✓ Added is_active column")
    
    # Check if is_internal_test_user column exists
    result = await conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'production_users' 
        AND column_name = 'is_internal_test_user'
    """))
    if not result.fetchone():
        await conn.execute(text("""
            ALTER TABLE production_users 
            ADD COLUMN is_internal_test_user BOOLEAN DEFAULT FALSE
        """))
        print("✓ Added is_internal_test_user column")


async def create_or_update_user(
    session: AsyncSession,
    email: str,
    role: str,
    password: str,
    name: str,
    panel: str
) -> Dict[str, Any]:
    """
    Create or update a test regulator user (idempotent)
    
    Returns:
        Dict with status: 'CREATED', 'UPDATED', or 'SKIPPED'
    """
    normalized_email = normalize_email(email)
    
    # Check if user already exists
    result = await session.execute(
        select(User).where(User.email == normalized_email)
    )
    existing_user = result.scalar_one_or_none()
    
    # Hash password
    password_hash = hash_password(password)
    
    if existing_user:
        # Check if user already has correct role and flags
        if (existing_user.role == role and 
            existing_user.is_active == True and 
            existing_user.is_internal_test_user == True):
            # User already exists with correct settings - skip
            return {
                "status": "SKIPPED",
                "email": email,
                "role": role,
                "user_id": str(existing_user.id),
                "message": f"User already exists with correct role and flags"
            }
        
        # Update existing user
        existing_user.role = role
        existing_user.is_active = True
        existing_user.is_internal_test_user = True
        existing_user.password_hash = password_hash  # Update password
        
        await session.commit()
        await session.refresh(existing_user)
        
        return {
            "status": "UPDATED",
            "email": email,
            "role": role,
            "user_id": str(existing_user.id),
            "message": f"Updated existing user with role {role}"
        }
    else:
        # Create new user
        new_user = User(
            email=normalized_email,
            password_hash=password_hash,
            role=role,
            is_active=True,
            is_internal_test_user=True
        )
        
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)
        
        return {
            "status": "CREATED",
            "email": email,
            "role": role,
            "user_id": str(new_user.id),
            "message": f"Created new user with role {role}"
        }


async def create_all_regulator_test_users():
    """Create all regulator test users"""
    settings = get_settings()
    
    # Get database URL
    database_url = settings.DATABASE_URL
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    
    # Create engine
    engine = create_async_engine(database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    print("=" * 80)
    print("REGULATOR TEST USERS CREATION")
    print("=" * 80)
    print(f"\nCommon Password: {COMMON_PASSWORD}")
    print(f"Total Users: {len(TEST_USERS)}")
    print("\n" + "-" * 80)
    
    async with engine.begin() as conn:
        # Ensure columns exist
        await ensure_columns_exist(conn)
    
    results: List[Dict[str, Any]] = []
    
    async with async_session() as session:
        try:
            for user_spec in TEST_USERS:
                email = user_spec["email"]
                role = user_spec["role"]
                name = user_spec["name"]
                panel = user_spec["panel"]
                
                print(f"\n[{name}] Processing: {email}")
                print(f"  Role: {role}")
                print(f"  Panel: {panel}")
                
                result = await create_or_update_user(
                    session=session,
                    email=email,
                    role=role,
                    password=COMMON_PASSWORD,
                    name=name,
                    panel=panel
                )
                
                results.append(result)
                
                # Print status
                status = result["status"]
                if status == "CREATED":
                    print(f"  ✓ CREATED - User ID: {result['user_id']}")
                elif status == "UPDATED":
                    print(f"  ✓ UPDATED - User ID: {result['user_id']}")
                elif status == "SKIPPED":
                    print(f"  ⊘ SKIPPED - User already exists with correct settings")
                
        except Exception as e:
            await session.rollback()
            print(f"\n❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    # Print summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    created_count = sum(1 for r in results if r["status"] == "CREATED")
    updated_count = sum(1 for r in results if r["status"] == "UPDATED")
    skipped_count = sum(1 for r in results if r["status"] == "SKIPPED")
    
    print(f"\n✓ Created: {created_count}")
    print(f"✓ Updated: {updated_count}")
    print(f"⊘ Skipped: {skipped_count}")
    print(f"  Total: {len(results)}")
    
    print("\n" + "=" * 80)
    print("USER CREDENTIALS")
    print("=" * 80)
    print(f"\nCommon Password: {COMMON_PASSWORD}")
    print("\nUsers:")
    for user_spec, result in zip(TEST_USERS, results):
        print(f"\n  [{user_spec['name']}]")
        print(f"    Email: {user_spec['email']}")
        print(f"    Role: {user_spec['role']}")
        print(f"    Panel: {user_spec['panel']}")
        print(f"    Status: {result['status']}")
        print(f"    User ID: {result['user_id']}")
    
    print("\n" + "=" * 80)
    print("ACCESS INFORMATION")
    print("=" * 80)
    print("\nAll users:")
    print(f"  • Password: {COMMON_PASSWORD}")
    print("  • Is Active: True")
    print("  • Is Internal Test User: True")
    print("  • Has NO organization_id")
    print("  • Has NO API key")
    print("  • Has NO billing relationship")
    print("\nPanel Access:")
    for user_spec in TEST_USERS:
        print(f"  • {user_spec['name']}: {user_spec['panel']}/login")
    
    print("\n" + "=" * 80)
    print("✅ COMPLETED")
    print("=" * 80)
    print("\n⚠️  IMPORTANT:")
    print("  • These are internal test users for development/testing")
    print("  • Password is shared across all test users")
    print("  • Change password after first login if needed")
    print("  • These users are read-only (GET-only API access)")
    print("  • Script is idempotent - safe to run multiple times")
    print()


if __name__ == "__main__":
    asyncio.run(create_all_regulator_test_users())

