#!/usr/bin/env python3
"""
Create Test Regulator User

Creates a test regulator user for internal testing of Regulator Oversight Panel.
This user:
- Has REGULATOR_AUDITOR role
- Can access regulator.ezacore.ai
- Can only call GET endpoints
- Cannot access platform/proxy panels
- Has no organization_id
- Has no API key
- Has no billing relationship

Usage:
    python scripts/create_test_regulator_user.py
"""

import asyncio
import sys
import os
from pathlib import Path

# Add backend parent directory to path (so 'backend' module can be imported)
backend_dir = Path(__file__).parent.parent
backend_parent = backend_dir.parent
sys.path.insert(0, str(backend_parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, text
from backend.models.production import User
from backend.services.production_auth import hash_password, normalize_email
from backend.config import get_settings
import secrets
import string

# Test user specification
TEST_USER_EMAIL = "regulator-test@ezacore.ai"
TEST_USER_ROLE = "REGULATOR_AUDITOR"


def generate_strong_password(length: int = 24) -> str:
    """Generate a strong temporary password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password


async def ensure_columns_exist(conn):
    """Ensure is_active and is_internal_test_user columns exist"""
    # Check if is_active column exists
    check_active = await conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'production_users' 
        AND column_name = 'is_active'
    """))
    if not check_active.scalar_one_or_none():
        await conn.execute(text("""
            ALTER TABLE production_users 
            ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_production_users_is_active 
            ON production_users(is_active)
        """))
        print("✓ Added is_active column")
    
    # Check if is_internal_test_user column exists
    check_test = await conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'production_users' 
        AND column_name = 'is_internal_test_user'
    """))
    if not check_test.scalar_one_or_none():
        await conn.execute(text("""
            ALTER TABLE production_users 
            ADD COLUMN is_internal_test_user BOOLEAN DEFAULT false
        """))
        print("✓ Added is_internal_test_user column")


async def create_test_regulator_user():
    """Create test regulator user"""
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
    
    async with engine.begin() as conn:
        # Ensure columns exist
        await ensure_columns_exist(conn)
    
    async with async_session() as session:
        try:
            # Check if user already exists
            normalized_email = normalize_email(TEST_USER_EMAIL)
            result = await session.execute(
                select(User).where(User.email == normalized_email)
            )
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print(f"⚠ User {TEST_USER_EMAIL} already exists")
                print(f"  ID: {existing_user.id}")
                print(f"  Role: {existing_user.role}")
                print(f"  Is Active: {getattr(existing_user, 'is_active', 'N/A')}")
                print(f"  Is Internal Test User: {getattr(existing_user, 'is_internal_test_user', 'N/A')}")
                
                # Update existing user
                existing_user.role = TEST_USER_ROLE
                existing_user.is_active = True
                existing_user.is_internal_test_user = True
                
                # Generate new password
                new_password = generate_strong_password()
                existing_user.password_hash = hash_password(new_password)
                
                await session.commit()
                
                print(f"\n✓ Updated existing user")
                print(f"  Email: {TEST_USER_EMAIL}")
                print(f"  Role: {TEST_USER_ROLE}")
                print(f"  Password: {new_password}")
                print(f"\n⚠ IMPORTANT: Save this password securely!")
                print(f"⚠ This is a temporary test password - change it after first login if needed.")
                
                return new_password
            else:
                # Create new user
                password = generate_strong_password()
                password_hash = hash_password(password)
                
                new_user = User(
                    email=normalized_email,
                    password_hash=password_hash,
                    role=TEST_USER_ROLE,
                    is_active=True,
                    is_internal_test_user=True
                )
                
                session.add(new_user)
                await session.commit()
                
                # Refresh to get ID
                await session.refresh(new_user)
                
                print(f"\n✓ Test regulator user created successfully!")
                print(f"  ID: {new_user.id}")
                print(f"  Email: {TEST_USER_EMAIL}")
                print(f"  Role: {TEST_USER_ROLE}")
                print(f"  Password: {password}")
                print(f"  Is Active: True")
                print(f"  Is Internal Test User: True")
                print(f"\n⚠ IMPORTANT: Save this password securely!")
                print(f"⚠ This is a temporary test password - change it after first login if needed.")
                print(f"\n✓ User has NO organization_id")
                print(f"✓ User has NO API key")
                print(f"✓ User has NO billing relationship")
                print(f"\n🔐 Access:")
                print(f"  ✅ Can login at: https://regulator.ezacore.ai/login")
                print(f"  ✅ Can access regulator dashboard")
                print(f"  ❌ Cannot access /proxy")
                print(f"  ❌ Cannot access /platform")
                print(f"  ❌ Cannot access /admin")
                print(f"  ✅ All API calls are GET-only")
                
                return password
                
        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating test regulator user: {e}")
            import traceback
            traceback.print_exc()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    print("=" * 60)
    print("Creating Test Regulator User")
    print("=" * 60)
    asyncio.run(create_test_regulator_user())

