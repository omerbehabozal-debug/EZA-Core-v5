#!/usr/bin/env python3
"""
Verify Regulator Test Users

Verifies that test regulator users exist in the database and can authenticate.
"""

import asyncio
import sys
from pathlib import Path

# Add backend parent directory to path
backend_dir = Path(__file__).parent.parent
backend_parent = backend_dir.parent
sys.path.insert(0, str(backend_parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from backend.models.production import User
from backend.services.production_auth import normalize_email, verify_password
from backend.config import get_settings

# Test users
TEST_USERS = [
    {"email": "rtuk-test@ezacore.ai", "role": "REGULATOR_RTUK"},
    {"email": "tech-test@ezacore.ai", "role": "REGULATOR_SANAYI"},
    {"email": "finance-test@ezacore.ai", "role": "REGULATOR_FINANCE"},
    {"email": "health-test@ezacore.ai", "role": "REGULATOR_HEALTH"},
]

COMMON_PASSWORD = "Ez@Core-Test-2025"


async def verify_users():
    """Verify test users exist and can authenticate"""
    settings = get_settings()
    
    # Get database URL
    database_url = settings.DATABASE_URL
    if not database_url:
        print("❌ ERROR: DATABASE_URL is not set")
        sys.exit(1)
    
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    
    # Mask password in URL for display
    if "@" in database_url:
        parts = database_url.split("@")
        if len(parts) == 2:
            user_pass = parts[0].split("://")[1] if "://" in parts[0] else parts[0]
            if ":" in user_pass:
                user, _ = user_pass.split(":", 1)
                masked_url = database_url.replace(user_pass, f"{user}:***")
            else:
                masked_url = database_url.replace(user_pass, "***")
        else:
            masked_url = "***"
    else:
        masked_url = "***"
    
    print("=" * 80)
    print("VERIFY REGULATOR TEST USERS")
    print("=" * 80)
    print(f"Database URL: {masked_url}")
    print()
    
    # Create engine
    engine = create_async_engine(database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    results = []
    
    async with async_session() as session:
        for user_spec in TEST_USERS:
            email = user_spec["email"]
            expected_role = user_spec["role"]
            normalized_email = normalize_email(email)
            
            print(f"[{email}]")
            
            # Check if user exists
            result = await session.execute(
                select(User).where(User.email == normalized_email)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                print(f"  ❌ NOT FOUND")
                results.append({"email": email, "status": "NOT_FOUND"})
                continue
            
            # Check role
            if user.role != expected_role:
                print(f"  ⚠️  WRONG ROLE: Expected {expected_role}, got {user.role}")
                results.append({"email": email, "status": "WRONG_ROLE", "expected": expected_role, "actual": user.role})
            else:
                print(f"  ✓ Role: {user.role}")
            
            # Check is_active
            is_active = getattr(user, 'is_active', True)
            if not is_active:
                print(f"  ⚠️  INACTIVE")
                results.append({"email": email, "status": "INACTIVE"})
            else:
                print(f"  ✓ Is Active: {is_active}")
            
            # Check is_internal_test_user
            is_test = getattr(user, 'is_internal_test_user', False)
            if not is_test:
                print(f"  ⚠️  NOT MARKED AS TEST USER")
            else:
                print(f"  ✓ Is Test User: {is_test}")
            
            # Test password verification
            try:
                password_valid = verify_password(COMMON_PASSWORD, user.password_hash)
                if password_valid:
                    print(f"  ✓ Password: VALID")
                    results.append({"email": email, "status": "OK"})
                else:
                    print(f"  ❌ Password: INVALID")
                    print(f"     Hash: {user.password_hash[:50]}...")
                    results.append({"email": email, "status": "PASSWORD_INVALID"})
            except Exception as e:
                print(f"  ❌ Password Verification Error: {e}")
                results.append({"email": email, "status": "PASSWORD_ERROR", "error": str(e)})
            
            print()
    
    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    ok_count = sum(1 for r in results if r["status"] == "OK")
    not_found_count = sum(1 for r in results if r["status"] == "NOT_FOUND")
    error_count = len(results) - ok_count - not_found_count
    
    print(f"\n✓ OK: {ok_count}")
    print(f"❌ Not Found: {not_found_count}")
    print(f"⚠️  Errors: {error_count}")
    print(f"  Total: {len(results)}")
    
    if not_found_count > 0:
        print("\n⚠️  WARNING: Some users not found in database!")
        print("   Run: python scripts/create_regulator_test_users.py")
    
    if error_count > 0:
        print("\n⚠️  WARNING: Some users have errors!")
        for r in results:
            if r["status"] != "OK" and r["status"] != "NOT_FOUND":
                print(f"   {r['email']}: {r['status']}")
    
    print()


if __name__ == "__main__":
    asyncio.run(verify_users())

