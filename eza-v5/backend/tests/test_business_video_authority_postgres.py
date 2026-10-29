"""Two-session PostgreSQL proof for video authorization locks.

SQLite ignores FOR UPDATE. These tests are not a substitute for that, and they
do not run unless a disposable local database is named in
BUSINESS_VIDEO_AUTH_TEST_POSTGRES_URL. DATABASE_URL is never read.

The database name must start with business_video_auth_. Only an isolated
schema is created, then dropped.
"""
import asyncio
import os
import uuid
from contextlib import asynccontextmanager

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from backend.core.utils.dependencies import Base
from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_yansi import BusinessMember, BusinessProfile
from backend.models.production import Organization, User
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import video_ingest as ingest
from backend.services.business_yansi.video_authority import (
    assign_member_role,
    lock_user,
    set_user_active,
    update_brand_verification,
)
from backend.services.production_org import archive_organization, update_organization

pytestmark = pytest.mark.skipif(
    not os.getenv("BUSINESS_VIDEO_AUTH_TEST_POSTGRES_URL"),
    reason="BLOCKED: no disposable local PostgreSQL; two-session lock tests were not executed",
)


def _require_local_url():
    url = make_url(os.environ["BUSINESS_VIDEO_AUTH_TEST_POSTGRES_URL"])
    assert url.drivername == "postgresql+asyncpg"
    assert url.host in {"127.0.0.1", "localhost", "::1"}
    assert url.database and url.database.startswith("business_video_auth_")
    return url


@asynccontextmanager
async def _database():
    url = _require_local_url()
    schema = "video_auth_" + uuid.uuid4().hex
    engine = create_async_engine(
        url,
        connect_args={
            "server_settings": {
                "search_path": schema,
                "lock_timeout": "3s",
                "statement_timeout": "8s",
            }
        },
    )
    made = False
    try:
        async with engine.begin() as connection:
            await connection.execute(CreateSchema(schema))
            made = True

            def setup(sync):
                Base.metadata.create_all(
                    sync,
                    tables=[
                        User.__table__,
                        Organization.__table__,
                        BusinessProfile.__table__,
                        BusinessMember.__table__,
                        BusinessBrandAsset.__table__,
                    ],
                )

            await connection.run_sync(setup)
        maker = async_sessionmaker(engine, expire_on_commit=False)
        async with maker() as db:
            owner = User(id=uuid.uuid4(), email=f"owner-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
            editor = User(id=uuid.uuid4(), email=f"editor-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
            org = Organization(id=uuid.uuid4(), name="Auth", status="active")
            db.add_all([owner, editor, org])
            await db.commit()
            business = await svc.create_business(
                db,
                owner,
                {
                    "organizationId": str(org.id),
                    "ownerId": str(owner.id),
                    "slug": "auth-" + uuid.uuid4().hex[:8],
                    "name": "Auth",
                },
            )
            db.add(BusinessMember(business_id=business.id, user_id=editor.id, role="editor"))
            await db.commit()
            yield maker, business.id, editor.id
    finally:
        if made:
            async with engine.begin() as connection:
                await connection.execute(DropSchema(schema, cascade=True))
        await engine.dispose()


def _key(business_id) -> str:
    return f"brand-videos/{business_id}/{uuid.uuid4().hex}{uuid.uuid4().hex}.mp4"


async def _assets(db, business_id) -> int:
    return await db.scalar(
        select(func.count()).select_from(BusinessBrandAsset).where(BusinessBrandAsset.business_id == business_id)
    )


async def _insert(db, business_id, editor_id):
    return await ingest._insert_asset(
        db,
        business_id,
        editor_id,
        key=_key(business_id),
        title="Atolye filmi",
        caption="",
        public_allowed=False,
    )


async def _denied(maker, business_id, editor_id, status: int):
    async with maker() as db:
        with pytest.raises(HTTPException) as caught:
            await _insert(db, business_id, editor_id)
    assert caught.value.status_code == status
    async with maker() as db:
        assert await _assets(db, business_id) == 0


async def test_revocation_committed_first_rejects_insert():
    async with _database() as (maker, business_id, editor_id):
        async with maker() as db:
            await set_user_active(db, editor_id, False)
        await _denied(maker, business_id, editor_id, 403)
        async with maker() as db:
            await set_user_active(db, editor_id, True)

        async with maker() as db:
            await assign_member_role(db, business_id, editor_id, "viewer")
        await _denied(maker, business_id, editor_id, 403)
        async with maker() as db:
            await assign_member_role(db, business_id, editor_id, "editor")

        async with maker() as db:
            await update_brand_verification(db, business_id, verified=False, official=False, status="suspended")
        await _denied(maker, business_id, editor_id, 404)
        async with maker() as db:
            await update_brand_verification(db, business_id, verified=False, official=False, status="active")

        async with maker() as db:
            assert await archive_organization(db, str(business_id)) is True
        await _denied(maker, business_id, editor_id, 404)
        async with maker() as db:
            restored = await update_organization(db, str(business_id), {"status": "active"})
            assert restored is not None and restored.status == "active"


async def test_insert_lock_commits_before_revocation():
    release = asyncio.Event()
    holding = asyncio.Event()
    real = ingest._recheck_editor

    async def paused(db, business_id, user_id):
        await real(db, business_id, user_id)
        holding.set()
        await release.wait()

    async with _database() as (maker, business_id, editor_id):
        ingest._recheck_editor = paused
        insert_task = None
        revoke_task = None
        try:
            async def insert():
                async with maker() as db:
                    return await _insert(db, business_id, editor_id)

            async def revoke():
                async with maker() as db:
                    return await set_user_active(db, editor_id, False)

            insert_task = asyncio.create_task(insert())
            await asyncio.wait_for(holding.wait(), 5)
            revoke_task = asyncio.create_task(revoke())
            await asyncio.sleep(0.4)
            assert not revoke_task.done()
            release.set()
            row = await asyncio.wait_for(insert_task, 5)
            await asyncio.wait_for(revoke_task, 5)
        finally:
            ingest._recheck_editor = real
            release.set()
            for task in (insert_task, revoke_task):
                if task is not None and not task.done():
                    task.cancel()
        async with maker() as db:
            assert row.id is not None
            assert await _assets(db, business_id) == 1
            user = await db.get(User, editor_id)
            assert user.is_active is False


async def test_revocation_lock_blocks_insert_then_rejects_it():
    release = asyncio.Event()
    holding = asyncio.Event()

    async with _database() as (maker, business_id, editor_id):
        async def revoke():
            async with maker() as db:
                user = await lock_user(db, editor_id)
                user.is_active = False
                holding.set()
                await release.wait()
                await db.commit()

        async def insert():
            async with maker() as db:
                with pytest.raises(HTTPException) as caught:
                    await _insert(db, business_id, editor_id)
            assert caught.value.status_code == 403

        revoke_task = asyncio.create_task(revoke())
        await asyncio.wait_for(holding.wait(), 5)
        insert_task = asyncio.create_task(insert())
        await asyncio.sleep(0.4)
        assert not insert_task.done()
        release.set()
        await asyncio.wait_for(revoke_task, 5)
        await asyncio.wait_for(insert_task, 5)
        async with maker() as db:
            assert await _assets(db, business_id) == 0
            user = await db.get(User, editor_id)
            assert user.is_active is False


async def test_overlapping_orders_finish_without_deadlock():
    async with _database() as (maker, business_id, editor_id):
        previous = 0
        for _ in range(3):
            async with maker() as db:
                await set_user_active(db, editor_id, True)

            async def revoke():
                async with maker() as db:
                    await set_user_active(db, editor_id, False)

            async def insert():
                async with maker() as db:
                    try:
                        await _insert(db, business_id, editor_id)
                    except HTTPException as exc:
                        assert exc.status_code == 403
                        return "denied"
                    return "inserted"

            outcome = await asyncio.wait_for(asyncio.gather(revoke(), insert()), 6)
            assert outcome[1] in {"denied", "inserted"}
            async with maker() as db:
                count = await _assets(db, business_id)
                user = await db.get(User, editor_id)
            assert count >= previous
            previous = count
            assert user.is_active is False
            if outcome[1] == "inserted":
                assert count >= 1


async def test_deleted_membership_is_not_reused_from_the_identity_map():
    """Committed DELETE must win over a membership already present in the identity map."""
    async with _database() as (maker, business_id, editor_id):
        async with maker() as stale:
            cached = await stale.get(BusinessMember, (business_id, editor_id))
            assert cached is not None and cached.role == "editor"
            async with maker() as other:
                row = await other.get(BusinessMember, (business_id, editor_id))
                await other.delete(row)
                await other.commit()
            assert cached.role == "editor"
            with pytest.raises(HTTPException) as denied:
                await _insert(stale, business_id, editor_id)
            assert denied.value.status_code == 403
            assert await stale.get(BusinessMember, (business_id, editor_id)) is None
        async with maker() as db:
            assert await _assets(db, business_id) == 0
