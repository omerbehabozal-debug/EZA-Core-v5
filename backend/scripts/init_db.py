# -*- coding: utf-8 -*-
"""
Database Initialization Script
Creates initial roles and admin user
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from backend.models.role import Role
from backend.models.user import User
from backend.core.utils.security import get_password_hash
from backend.core.utils.dependencies import Base, DATABASE_URL


async def init_roles(session: AsyncSession):
    """Initialize default roles"""
    roles = [
        {"name": "public_user", "description": "Public user - Standalone mode only"},
        {"name": "corporate_client", "description": "Corporate client - Standalone + billing"},
        {"name": "institution_auditor", "description": "Institution auditor - Proxy-Lite mode"},
        {"name": "eza_internal", "description": "EZA internal - Proxy mode"},
        {"name": "admin", "description": "Administrator - All modes"},
    ]
    
    for role_data in roles:
        result = await session.execute(
            select(Role).where(Role.name == role_data["name"])
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            role = Role(**role_data)
            session.add(role)
            print(f"Created role: {role_data['name']}")
        else:
            print(f"Role already exists: {role_data['name']}")
    
    await session.commit()


async def create_admin_user(session: AsyncSession, email: str, password: str):
    """Create admin user"""
    # Get admin role
    result = await session.execute(
        select(Role).where(Role.name == "admin")
    )
    admin_role = result.scalar_one_or_none()
    
    if not admin_role:
        print("Error: Admin role not found. Please run init_roles first.")
        return
    
    # Check if admin user exists
    result = await session.execute(
        select(User).where(User.email == email)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        print(f"Admin user already exists: {email}")
        return
    
    # Create admin user
    admin_user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name="Admin User",
        role_id=admin_role.id,
        is_active=True,
        is_verified=True
    )
    
    session.add(admin_user)
    await session.commit()
    print(f"Created admin user: {email}")


async def main():
    """Main initialization function"""
    engine = create_async_engine(DATABASE_URL, echo=True)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("Database tables created")
    
    # Initialize roles
    async with AsyncSessionLocal() as session:
        await init_roles(session)
    
    # Create admin user (optional)
    import os
    admin_email = os.getenv("ADMIN_EMAIL", "admin@eza.local")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
    
    if input(f"Create admin user ({admin_email})? (y/n): ").lower() == 'y':
        async with AsyncSessionLocal() as session:
            await create_admin_user(session, admin_email, admin_password)
    
    await engine.dispose()
    print("Database initialization complete!")


if __name__ == "__main__":
    asyncio.run(main())

