"""Opt-in REAL PostgreSQL QA. Never uses DATABASE_URL or production credentials.

Create an empty disposable local database named business_studio_* yourself, then
set BUSINESS_STUDIO_TEST_POSTGRES_URL. Only an isolated random schema is touched.

URL tip: passwords with special characters must use SQLAlchemy
`URL.render_as_string(hide_password=False)` — bare `str(url)` can truncate at `#`.
"""
import asyncio
import os
import uuid
from dataclasses import replace
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import select, func, text
from sqlalchemy.engine import make_url
from sqlalchemy.schema import CreateSchema, DropSchema
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from alembic.migration import MigrationContext
from alembic.operations import Operations

from backend.tests.test_business_studio import migration
from backend.tests.test_business_studio_generation import migration2
from backend.models.production import User, Organization
from backend.models.standalone_conversations import StandaloneConversation
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.business_yansi import BusinessProfile, BusinessMember, BusinessKnowledgeVersion, BusinessYansiDraft
from backend.models.business_studio import BusinessStudioGeneration
from backend.core.utils.dependencies import Base
from backend.core.schemas.business_studio import TopicsRequest
from backend.services.business_yansi import studio


@pytest.mark.asyncio
@pytest.mark.skipif(not os.getenv('BUSINESS_STUDIO_TEST_POSTGRES_URL'), reason='No explicitly provisioned disposable local PostgreSQL database')
async def test_real_pg_migration_and_parallel_admission():
    url = make_url(os.environ['BUSINESS_STUDIO_TEST_POSTGRES_URL'])
    assert url.drivername == 'postgresql+asyncpg'
    assert url.host in {'127.0.0.1', 'localhost', '::1'}
    assert url.database and url.database.startswith('business_studio_')
    schema = 'studio_qa_' + uuid.uuid4().hex
    engine = create_async_engine(url, connect_args={'server_settings': {'search_path': schema}})
    made_schema = False
    try:
        async with engine.begin() as connection:
            await connection.execute(CreateSchema(schema))
            made_schema = True

            def setup(sync):
                tables = [
                    User.__table__,
                    Organization.__table__,
                    StandaloneConversation.__table__,
                    MirrorNetworkNode.__table__,
                    BusinessProfile.__table__,
                    BusinessMember.__table__,
                    BusinessKnowledgeVersion.__table__,
                    BusinessYansiDraft.__table__,
                ]
                Base.metadata.create_all(sync, tables=tables)
                with Operations.context(MigrationContext.configure(sync)):
                    migration().upgrade()
                    migration().downgrade()  # empty Studio tables, actual PG DDL
                    migration().upgrade()
                    migration2().upgrade()
                    migration2().downgrade()
                    migration2().upgrade()

            await connection.run_sync(setup)

        # Constraint inventory on the isolated schema
        async with engine.connect() as connection:
            constraints = {
                row[0]
                for row in (
                    await connection.execute(
                        text(
                            """
                            SELECT conname FROM pg_constraint c
                            JOIN pg_namespace n ON n.oid = c.connamespace
                            WHERE n.nspname = :schema
                            """
                        ),
                        {'schema': schema},
                    )
                ).all()
            }
            assert 'uq_business_studio_idempotency' in constraints
            assert 'ck_studio_kind' in constraints
            assert 'ck_studio_status' in constraints
            assert 'ck_studio_attempts' in constraints
            assert 'ck_studio_tokens' in constraints
            assert 'ck_studio_cost' in constraints
            assert 'ck_studio_usage_nonnegative' in constraints
            assert 'ck_studio_usage_outcome' in constraints

        sessions = async_sessionmaker(engine, expire_on_commit=False)
        owner, viewer, outsider = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        business_id, other_business, source_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        async with sessions() as db:
            db.add_all(
                [
                    User(id=owner, email='studio-qa@example.test', role='user', is_active=True),
                    User(id=viewer, email='studio-viewer@example.test', role='user', is_active=True),
                    User(id=outsider, email='studio-out@example.test', role='user', is_active=True),
                    Organization(id=business_id, name='Studio QA', status='active'),
                    Organization(id=other_business, name='Other Studio', status='active'),
                ]
            )
            await db.flush()
            db.add(BusinessProfile(id=business_id, owner_id=owner, slug='studio-qa', name='Studio QA'))
            db.add(BusinessProfile(id=other_business, owner_id=outsider, slug='other-studio', name='Other'))
            await db.flush()
            db.add_all(
                [
                    BusinessMember(business_id=business_id, user_id=owner, role='owner'),
                    BusinessMember(business_id=business_id, user_id=viewer, role='viewer'),
                    BusinessMember(business_id=other_business, user_id=outsider, role='owner'),
                    BusinessKnowledgeVersion(
                        id=source_id,
                        business_id=business_id,
                        item_id=uuid.uuid4(),
                        version=1,
                        title='Studio',
                        category='',
                        content='Studio QA public information.',
                        source='QA approved source',
                        public_allowed=True,
                        status='published',
                        created_by=owner,
                        approved_by=owner,
                        revision=3,
                    ),
                ]
            )
            await db.commit()

        async def admit(key, actor=owner, hint='', limits=None):
            async with sessions() as db:
                try:
                    row = await studio.create_job(
                        db,
                        business_id,
                        actor,
                        TopicsRequest(idempotencyKey=key, sourceVersionIds=[source_id], topicHint=hint),
                        'topics',
                        limits or replace(studio.Limits(), daily_jobs=2),
                    )
                    return str(row.id)
                except HTTPException as error:
                    await db.rollback()
                    return error.status_code

        # Concurrent identical idempotency key → one row
        duplicates = await asyncio.gather(admit('parallel-same-key'), admit('parallel-same-key'))
        assert duplicates[0] == duplicates[1] and isinstance(duplicates[0], str)

        # Different payload, same key → 409
        conflict = await admit('parallel-same-key', hint='changed-direction')
        assert conflict == 409

        # Daily job limit serialization under FOR UPDATE
        distinct = await asyncio.gather(admit('parallel-other-1'), admit('parallel-other-2'))
        assert sum(isinstance(value, str) for value in distinct) == 1 and 429 in distinct

        # Token / USD daily budgets on PostgreSQL
        assert await admit('token-budget-key', limits=replace(studio.Limits(), daily_tokens=1)) == 429
        assert await admit('cost-budget-key', limits=replace(studio.Limits(), daily_cost=Decimal('0.01'))) == 429

        # Role + tenant isolation
        assert await admit('viewer-denied', actor=viewer) == 403
        async with sessions() as db:
            row = await studio.create_job(
                db,
                business_id,
                owner,
                TopicsRequest(idempotencyKey='read-scope-key', sourceVersionIds=[source_id]),
                'topics',
                replace(studio.Limits(), daily_jobs=20),
            )
            await studio.read_job(db, business_id, viewer, row.id)
            with pytest.raises(HTTPException) as denied:
                await studio.read_job(db, other_business, outsider, row.id)
            assert denied.value.status_code in {403, 404}
            generation_id = row.id

        # Stage 2: two independent requests for the same job make one provider call.
        import os
        from types import SimpleNamespace
        from unittest.mock import AsyncMock, patch
        from backend.services.business_yansi import studio_execution, studio_generation
        from backend.tests.test_business_studio_generation import topics_output, reply
        async with sessions() as db:
            knowledge = await db.get(BusinessKnowledgeVersion, source_id)
            knowledge.content = '\n\n'.join(f'Workshop product detail number {i} describes a separate verified material choice.' for i in range(8))
            await db.commit()
            job = await studio.create_job(db, business_id, owner,
                TopicsRequest(idempotencyKey='stage2-concurrent', sourceVersionIds=[source_id]), 'topics',
                replace(studio.Limits(), daily_jobs=20))
            job_id = job.id
            output = topics_output(studio_generation.catalog(job.source_snapshot))
        started, release = asyncio.Event(), asyncio.Event()
        provider = SimpleNamespace(available_models=['openai/gpt-4o-mini'], openai_client=SimpleNamespace(api_key=None))
        async def generate(**kwargs):
            started.set()
            await release.wait()
            return reply(output)
        provider.generate = AsyncMock(side_effect=generate)
        async def execute_request():
            async with sessions() as db:
                row = await studio.read_job(db, business_id, owner, job_id)
                return await studio_execution.execute(db, row, router=provider)
        with patch.dict(os.environ, {'BILIGN_STUDIO_EXECUTION_ENABLED': 'true'}):
            # Pin model in the job just as admission does from deployment config.
            async with sessions() as db:
                row = await db.get(BusinessStudioGeneration, job_id)
                row.model = 'openai/gpt-4o-mini'
                await db.commit()
            with patch.dict(os.environ, {'BILIGN_STUDIO_PRICES_JSON': '{"openai/gpt-4o-mini":{"inputPerMillion":".15","outputPerMillion":".60"}}'}):
                first = asyncio.create_task(execute_request())
                try:
                    await asyncio.wait_for(started.wait(), 10)
                    second = await asyncio.wait_for(execute_request(), 10)
                    assert second.status == 'running' and provider.generate.await_count == 1
                finally:
                    release.set()
                    completed = await asyncio.wait_for(first, 10)
                assert completed.status == 'succeeded' and provider.generate.await_count == 1

        # Source revoke / mutate → snapshot stale (rollback leaves no new admission)
        async with sessions() as db:
            knowledge = await db.get(BusinessKnowledgeVersion, source_id)
            knowledge.public_allowed = False
            await db.commit()
        async with sessions() as db:
            with pytest.raises(HTTPException) as stale:
                await studio.read_job(db, business_id, owner, generation_id)
            assert stale.value.status_code == 409
            assert stale.value.detail['code'] == 'studio_snapshot_stale'
            before = await db.scalar(select(func.count(BusinessStudioGeneration.id)))
            with pytest.raises(HTTPException):
                await studio.create_job(
                    db,
                    business_id,
                    owner,
                    TopicsRequest(idempotencyKey='after-revoke', sourceVersionIds=[source_id]),
                    'topics',
                    replace(studio.Limits(), daily_jobs=20),
                )
            await db.rollback()
            after = await db.scalar(select(func.count(BusinessStudioGeneration.id)))
            assert after == before

        async with sessions() as db:
            assert await db.scalar(select(func.count(BusinessStudioGeneration.id))) == 4

        async with engine.begin() as connection:

            def guard(sync):
                with Operations.context(MigrationContext.configure(sync)):
                    with pytest.raises(RuntimeError):
                        migration().downgrade()

            await connection.run_sync(guard)
    finally:
        if made_schema:
            async with engine.begin() as connection:
                await connection.execute(DropSchema(schema, cascade=True))
        await engine.dispose()
