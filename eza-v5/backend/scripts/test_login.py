#!/usr/bin/env python3
"""
Test Login Script
Test user authentication with email and password
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func
from backend.models.production import User
from backend.services.production_auth import normalize_email, verify_password, hash_password
from backend.core.utils.dependencies import get_db
from backend.config import get_settings

async def test_login(email: str, password: str):
    """Test login with email and password"""
    settings = get_settings()
    
    # Get database URL
    DATABASE_URL = settings.DATABASE_URL
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    elif DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://")
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        normalized_email = normalize_email(email)
        print(f"\n=== Testing Login ===")
        print(f"Original email: {email}")
        print(f"Normalized email: {normalized_email}")
        
        # Check if user exists
        result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"❌ User not found in database")
            
            # List all users
            all_users_result = await db.execute(select(User.email, User.role).limit(20))
            all_users = all_users_result.all()
            print(f"\nAvailable users in database:")
            for user_email, user_role in all_users:
                print(f"  - {user_email} (role: {user_role})")
            return False
        
        print(f"✅ User found: {user.email} (role: {user.role})")
        print(f"   User ID: {user.id}")
        print(f"   Created at: {user.created_at}")
        print(f"   Password hash length: {len(user.password_hash)}")
        
        # Test password
        print(f"\nTesting password verification...")
        password_valid = verify_password(password, user.password_hash)
        
        if password_valid:
            print(f"✅ Password is CORRECT")
            return True
        else:
            print(f"❌ Password is INCORRECT")
            print(f"\nTrying to hash the provided password for comparison...")
            new_hash = hash_password(password)
            print(f"New hash: {new_hash[:50]}...")
            print(f"Old hash: {user.password_hash[:50]}...")
            return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_login.py <email> <password>")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    
    result = asyncio.run(test_login(email, password))
    sys.exit(0 if result else 1)

