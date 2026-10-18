"""BiligN capability isolation from EZA role=admin."""
import uuid
from types import SimpleNamespace

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import UUID, JSONB

@compiles(UUID, 'sqlite')
def _sqlite_uuid(type_, compiler, **kw):
    return 'CHAR(32)'


@compiles(JSONB, 'sqlite')
def _sqlite_json(type_, compiler, **kw):
    return 'JSON'

from backend.core.utils.dependencies import Base
from backend.models.production import User, UserCapability, Organization
from backend.models.business_yansi import (
    BusinessProfile,
    BusinessMember,
    BusinessBrandApplication,
)
from backend.services import user_capabilities as caps
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import platform_admin as padmin


@pytest_asyncio.fixture
async def cap_db(monkeypatch):
    monkeypatch.setenv('BILIGN_BUSINESS_ENABLED', 'true')
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    tables = [
        User.__table__,
        UserCapability.__table__,
        Organization.__table__,
        BusinessProfile.__table__,
        BusinessMember.__table__,
        BusinessBrandApplication.__table__,
    ]
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        eza_admin = User(id=uuid.uuid4(), email='eza@example.test', role='admin', is_active=True)
        bilign_admin = User(id=uuid.uuid4(), email='bilign@example.test', role='user', is_active=True)
        owner = User(id=uuid.uuid4(), email='owner@example.test', role='user', is_active=True)
        normal = User(id=uuid.uuid4(), email='normal@example.test', role='user', is_active=True)
        eza_only = User(id=uuid.uuid4(), email='proxy-ops@ezacore.test', role='ops', is_active=True)
        org = Organization(id=uuid.uuid4(), name='Alpha', status='active')
        db.add_all([eza_admin, bilign_admin, owner, normal, eza_only, org])
        await db.commit()
        await caps.bootstrap_grant_for_ops(db, target_user_id=bilign_admin.id)
        business = await svc.create_business(
            db,
            bilign_admin,
            {
                'organizationId': str(org.id),
                'ownerId': str(owner.id),
                'slug': 'alpha-brand',
                'name': 'Alpha Brand',
            },
        )
        yield SimpleNamespace(
            db=db,
            eza_admin=eza_admin,
            bilign_admin=bilign_admin,
            owner=owner,
            normal=normal,
            eza_only=eza_only,
            business=business,
        )
    await engine.dispose()


@pytest.mark.asyncio
async def test_eza_admin_denied_bilign_platform(cap_db):
    s = cap_db
    with pytest.raises(HTTPException) as e:
        await svc.platform_admin(s.db, {'user_id': str(s.eza_admin.id), 'role': 'admin'})
    assert e.value.status_code == 403
    assert await svc.can_provision(s.db, s.eza_admin) is False


@pytest.mark.asyncio
async def test_bilign_admin_allowed_without_eza_role(cap_db):
    s = cap_db
    assert s.bilign_admin.role == 'user'
    admin = await svc.platform_admin(s.db, {'user_id': str(s.bilign_admin.id), 'role': 'user'})
    assert admin.id == s.bilign_admin.id


@pytest.mark.asyncio
async def test_owner_and_normal_denied(cap_db):
    s = cap_db
    for user in (s.owner, s.normal):
        with pytest.raises(HTTPException):
            await svc.platform_admin(s.db, {'user_id': str(user.id)})
        assert await svc.can_provision(s.db, user) is False


@pytest.mark.asyncio
async def test_revoke_takes_effect_immediately(cap_db):
    s = cap_db
    target = User(id=uuid.uuid4(), email='second-admin@example.test', role='user', is_active=True)
    s.db.add(target)
    await s.db.commit()
    await caps.grant_capability(
        s.db,
        target_user_id=target.id,
        capability=caps.BILIGN_PLATFORM_ADMIN,
        actor_user_id=s.bilign_admin.id,
    )
    assert await svc.can_provision(s.db, target) is True
    await caps.revoke_capability(
        s.db,
        target_user_id=target.id,
        capability=caps.BILIGN_PLATFORM_ADMIN,
        actor_user_id=s.bilign_admin.id,
    )
    with pytest.raises(HTTPException) as e:
        await svc.platform_admin(s.db, {'user_id': str(target.id)})
    assert e.value.status_code == 403
    # History preserved
    history = (
        await s.db.scalars(
            select(UserCapability).where(
                UserCapability.user_id == target.id,
                UserCapability.capability == caps.BILIGN_PLATFORM_ADMIN,
            )
        )
    ).all()
    assert len(history) == 1 and history[0].revoked_at is not None


@pytest.mark.asyncio
async def test_cannot_modify_own_or_without_capability(cap_db):
    s = cap_db
    with pytest.raises(HTTPException) as own:
        await caps.grant_capability(
            s.db,
            target_user_id=s.bilign_admin.id,
            capability=caps.BILIGN_PLATFORM_ADMIN,
            actor_user_id=s.bilign_admin.id,
        )
    assert own.value.status_code == 403
    with pytest.raises(HTTPException) as unauth:
        await caps.grant_capability(
            s.db,
            target_user_id=s.normal.id,
            capability=caps.BILIGN_PLATFORM_ADMIN,
            actor_user_id=s.normal.id,
        )
    assert unauth.value.status_code == 403
    with pytest.raises(HTTPException) as eza_actor:
        await caps.grant_capability(
            s.db,
            target_user_id=s.normal.id,
            capability=caps.BILIGN_PLATFORM_ADMIN,
            actor_user_id=s.eza_admin.id,
        )
    assert eza_actor.value.status_code == 403


@pytest.mark.asyncio
async def test_user_search_scoped_to_bilign_related(cap_db):
    s = cap_db
    # EZA-only identity must not appear even when query matches email.
    assert await padmin.search_users(s.db, 'proxy-ops', limit=50) == []
    owner_hits = await padmin.search_users(s.db, 'owner', limit=50)
    assert any(h['email'] == 'owner@example.test' for h in owner_hits)
    admin_hits = await padmin.search_users(s.db, 'bilign', limit=50)
    assert any(h['email'] == 'bilign@example.test' for h in admin_hits)


@pytest.mark.asyncio
async def test_dual_product_admin_keeps_roles_independent(cap_db):
    s = cap_db
    # Same person may hold EZA role=admin and BiligN capability independently.
    await caps.grant_capability(
        s.db,
        target_user_id=s.eza_admin.id,
        capability=caps.BILIGN_PLATFORM_ADMIN,
        actor_user_id=s.bilign_admin.id,
    )
    assert s.eza_admin.role == 'admin'
    assert await svc.can_provision(s.db, s.eza_admin) is True
    await caps.revoke_capability(
        s.db,
        target_user_id=s.eza_admin.id,
        capability=caps.BILIGN_PLATFORM_ADMIN,
        actor_user_id=s.bilign_admin.id,
    )
    assert s.eza_admin.role == 'admin'  # EZA role unchanged
    assert await svc.can_provision(s.db, s.eza_admin) is False
