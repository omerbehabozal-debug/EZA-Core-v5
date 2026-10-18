"""Phase 1 SQL-backed QA; SQLite is not evidence of PostgreSQL locking."""
import copy
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import importlib.util
import io
from pathlib import Path
from unittest.mock import AsyncMock
import uuid

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException
from pydantic import ValidationError
from sqlalchemy import select, func, inspect
from alembic.migration import MigrationContext
from alembic.operations import Operations

from backend.tests.test_business_yansi import sample, source
from backend.models.business_studio import BusinessStudioGeneration as Job, BusinessStudioUsage as Usage
from backend.core.schemas.business_studio import TopicsRequest, GenerationRequest
from backend.services.business_yansi import studio
from backend.services.business_yansi.studio_validation import digest, canonical_hash, validate_candidate
from backend.routers import business_yansi as routes


@pytest_asyncio.fixture
async def env(sample, monkeypatch):
    monkeypatch.setenv('BILIGN_STUDIO_ADMISSION_ENABLED', 'true')
    async with sample.db.bind.begin() as c:
        await c.run_sync(lambda connection: Job.__table__.create(connection))
        await c.run_sync(lambda connection: Usage.__table__.create(connection))
    sample.knowledge = await source(sample)
    return sample


def request(s, key='request-key-0001', **kw):
    return TopicsRequest(idempotencyKey=key, sourceVersionIds=[s.knowledge.id], **kw)


def evidence(row, text=None, start=0):
    text = row.content if text is None else text
    return {'versionId': str(row.id), 'version': row.version, 'contentHash': digest(row.content),
            'start': start, 'end': start + len(text), 'text': text, 'passageHash': digest(text)}


def candidate(row):
    return {'title': row.content, 'summary': row.content, 'metadataEvidence': [evidence(row)],
            'steps': [{'question': f'Yansı hakkında {i + 1}. soru?', 'answer': row.content,
                       'evidence': evidence(row)} for i in range(8)]}


async def make_job(s, **kw):
    return await studio.create_job(s.db, s.business.id, s.owner.id, request(s), 'topics', **kw)


@pytest.mark.asyncio
@pytest.mark.parametrize('role', ['owner', 'editor'])
async def test_admission_is_honestly_blocked(env, role):
    s = env
    row = await studio.create_job(s.db, s.business.id, getattr(s, role).id, request(s), 'topics')
    result = studio.response(row)
    assert result.status == 'blocked' and result.errorCode == 'studio_execution_not_implemented'
    assert not result.executionAvailable and result.draftId is None and result.attemptCount == 0
    assert result.inputTokens == result.outputTokens == result.costUsd == 0
    assert row.source_snapshot['businessId'] == str(s.business.id)


@pytest.mark.asyncio
@pytest.mark.parametrize('role', ['viewer', 'outsider', 'admin', 'eza_admin'])
async def test_no_membership_escalation(env, role):
    s = env
    with pytest.raises(HTTPException) as error:
        await studio.create_job(s.db, s.business.id, getattr(s, role).id, request(s), 'topics')
    assert error.value.status_code == 403


@pytest.mark.asyncio
async def test_viewer_read_is_tenant_scoped(env):
    s = env; row = await make_job(s)
    assert (await studio.read_job(s.db, s.business.id, s.viewer.id, row.id)).id == row.id
    with pytest.raises(HTTPException):
        await studio.read_job(s.db, s.other.id, s.viewer.id, row.id)


@pytest.mark.asyncio
async def test_inactive_actor_cannot_begin_future_attempt(env):
    s = env; row = await make_job(s); row.status = 'pending'; s.owner.is_active = False
    await s.db.commit()
    with pytest.raises(HTTPException) as error: await studio.begin_attempt(s.db, row)
    assert error.value.status_code == 401 and row.attempts == 0


@pytest.mark.asyncio
async def test_idempotency_conflict_and_daily_limit(env):
    s = env; limits = replace(studio.Limits(), daily_jobs=1)
    row = await make_job(s, limits=limits)
    again = await make_job(s, limits=limits)
    assert row.id == again.id
    assert await s.db.scalar(select(func.count(Job.id))) == 1
    with pytest.raises(HTTPException) as error:
        await studio.create_job(s.db, s.business.id, s.owner.id, request(s, topicHint='Different'), 'topics')
    assert error.value.status_code == 409
    with pytest.raises(HTTPException) as error:
        await studio.create_job(s.db, s.business.id, s.owner.id, request(s, key='another-key'), 'topics', limits)
    assert error.value.status_code == 429


@pytest.mark.asyncio
@pytest.mark.parametrize('field,value', [('status', 'draft'), ('status', 'archived'), ('public_allowed', False), ('approved_by', None), ('business_id', 'foreign')])
async def test_unusable_sources_never_admitted(env, field, value):
    s = env
    setattr(s.knowledge, field, s.other.id if value == 'foreign' else value)
    await s.db.commit()
    with pytest.raises(HTTPException) as error:
        await make_job(s)
    assert error.value.detail['code'] == 'studio_source_unavailable'
    assert await s.db.scalar(select(func.count(Job.id))) == 0


@pytest.mark.asyncio
@pytest.mark.parametrize('field,value', [('status', 'archived'), ('public_allowed', False), ('content', 'Different public content')])
async def test_stale_snapshot_blocks_read_and_duplicate(env, field, value):
    s = env; row = await make_job(s)
    setattr(s.knowledge, field, value); await s.db.commit()
    with pytest.raises(HTTPException) as read_error:
        await studio.read_job(s.db, s.business.id, s.owner.id, row.id)
    # Existing admission → always stale (409), even when published_knowledge misses.
    assert read_error.value.status_code == 409
    assert read_error.value.detail['code'] == 'studio_snapshot_stale'
    with pytest.raises(HTTPException) as create_error:
        await make_job(s)
    # Fresh admission still reports unavailable/stale depending on whether sources resolve.
    assert create_error.value.status_code in {409, 422}


@pytest.mark.asyncio
async def test_generation_requires_expected_snapshot(env):
    s = env; topic = await make_job(s)
    body = GenerationRequest(idempotencyKey='draft-key-0001', sourceVersionIds=[s.knowledge.id], expectedSnapshotHash=topic.snapshot_hash)
    row = await studio.create_job(s.db, s.business.id, s.editor.id, body, 'draft')
    assert row.status == 'blocked' and row.kind == 'draft'
    with pytest.raises(HTTPException) as error:
        await studio.create_job(s.db, s.business.id, s.owner.id, body.model_copy(update={'idempotencyKey':'bad-hash-key','expectedSnapshotHash':'0'*64}), 'draft')
    assert error.value.status_code == 409
    with pytest.raises(ValidationError):
        GenerationRequest(idempotencyKey='missing-hash', sourceVersionIds=[s.knowledge.id])


@pytest.mark.asyncio
@pytest.mark.parametrize('limits', [replace(studio.Limits(), daily_tokens=1), replace(studio.Limits(), daily_cost=Decimal('.01'))])
async def test_tenant_token_and_cost_admission_limit(env, limits):
    with pytest.raises(HTTPException) as error:
        await make_job(env, limits=limits)
    assert error.value.status_code == 429


@pytest.mark.asyncio
async def test_validator_valid_output_compatible_with_manual_draft(env):
    s = env; row = await make_job(s)
    output = validate_candidate(candidate(s.knowledge), row.source_snapshot, row.snapshot_hash, s.business.id)
    assert len(output['steps']) == 8
    assert output['steps'][0]['sources'] == [str(s.knowledge.id)]
    from backend.services.business_yansi import service
    draft = await service.create_draft(s.db, s.business.id, s.owner.id, **output)
    assert draft.status == 'draft' and draft.approved_by is None


@pytest.mark.asyncio
@pytest.mark.parametrize('fault', ['seven', 'nine', 'blank', 'duplicate', 'answer', 'metadata', 'version', 'contentHash', 'passageHash', 'offset', 'foreign', 'pii', 'secret', 'html', 'harmful'])
async def test_invalid_output_rejected(env, fault):
    s = env; row = await make_job(s); data = candidate(s.knowledge)
    if fault == 'seven': data['steps'].pop()
    elif fault == 'nine': data['steps'].append(copy.deepcopy(data['steps'][0]))
    elif fault == 'blank': data['steps'][0]['question'] = '   '
    elif fault == 'duplicate': data['steps'][1]['question'] = data['steps'][0]['question'].upper() + ' !!!'
    elif fault == 'answer': data['steps'][0]['answer'] = 'Invented brand claim'
    elif fault == 'metadata': data['title'] = 'Unsupported superiority claim'
    elif fault in {'version','contentHash','passageHash'}: data['steps'][0]['evidence'][fault] = 99 if fault == 'version' else '0'*64
    elif fault == 'offset': data['steps'][0]['evidence']['start'] = 1
    elif fault == 'foreign': data['steps'][0]['evidence']['versionId'] = str(uuid.uuid4())
    elif fault == 'pii': data['steps'][0]['question'] = 'Contact private@example.test?'
    elif fault == 'secret': data['steps'][0]['question'] = 'SECRET_PRIVATE_ACCOUNT?'
    elif fault == 'html': data['steps'][0]['question'] = '<script>execute()</script>'
    elif fault == 'harmful': data['steps'][0]['question'] = 'how to kill someone?'
    with pytest.raises(HTTPException):
        validate_candidate(data, row.source_snapshot, row.snapshot_hash, s.business.id)


@pytest.mark.asyncio
async def test_snapshot_tamper_and_missing_snapshot(env):
    s = env; row = await make_job(s)
    for snapshot in [{}, {**row.source_snapshot, 'businessId': str(s.other.id)}, {**row.source_snapshot, 'sources': []}]:
        with pytest.raises(HTTPException):
            validate_candidate(candidate(s.knowledge), snapshot, row.snapshot_hash, s.business.id)


@pytest.mark.asyncio
async def test_mid_sentence_clipping_rejected(env):
    s = env; row = await make_job(s); data = candidate(s.knowledge)
    text = s.knowledge.content[6:]
    data['steps'][0]['answer'] = text
    data['steps'][0]['evidence'] = evidence(s.knowledge, text, start=6)
    with pytest.raises(HTTPException) as error:
        validate_candidate(data, row.source_snapshot, row.snapshot_hash, s.business.id)
    assert error.value.detail['code'] == 'studio_incomplete_passage'


@pytest.mark.asyncio
async def test_invalid_snapshot_cannot_begin_attempt(env):
    s = env; row = await make_job(s); row.status = 'pending'
    s.knowledge.public_allowed = False; await s.db.commit()
    with pytest.raises(HTTPException): await studio.begin_attempt(s.db, row)
    assert row.attempts == 0


@pytest.mark.asyncio
async def test_contract_validation_does_not_create_draft(env):
    from backend.models.business_yansi import BusinessYansiDraft
    s = env; row = await make_job(s); row.kind = 'draft'; row.status = 'pending'; await s.db.commit()
    row = await studio.begin_attempt(s.db, row)
    row = await studio.settle_attempt(s.db, row, attempt=1, input_tokens=2, output_tokens=2,
                                     cost_usd='.0001', outcome='validated', candidate=candidate(s.knowledge))
    assert row.status == 'validated' and row.draft_id is None
    assert await s.db.scalar(select(func.count(BusinessYansiDraft.id))) == 0


@pytest.mark.asyncio
async def test_attempt_contract_limits_and_idempotent_usage(env):
    s = env; row = await make_job(s)
    with pytest.raises(HTTPException):
        await studio.begin_attempt(s.db, row)  # blocked jobs cannot execute
    # Synthetic worker state, only to exercise the future contract. No AI is called.
    row.status = 'pending'; await s.db.commit()
    row = await studio.begin_attempt(s.db, row)
    assert row.attempts == 1 and row.status == 'running'
    assert not s.db.in_transaction()
    row = await studio.settle_attempt(s.db, row, attempt=1, input_tokens=100, output_tokens=10, cost_usd='.001', outcome='failed', error_code='provider_timeout')
    row = await studio.settle_attempt(s.db, row, attempt=1, input_tokens=100, output_tokens=10, cost_usd='.001', outcome='failed', error_code='provider_timeout')
    assert row.input_tokens == 100 and await s.db.scalar(select(func.count()).select_from(Usage)) == 1
    with pytest.raises(HTTPException):
        await studio.settle_attempt(s.db, row, attempt=1, input_tokens=101, output_tokens=10, cost_usd='.001', outcome='failed')
    row = await studio.retry_failed(s.db, row); row = await studio.begin_attempt(s.db, row)
    with pytest.raises(HTTPException) as error:
        await studio.settle_attempt(s.db, row, attempt=2, input_tokens=row.reserved_input_tokens, output_tokens=0, cost_usd=0, outcome='failed')
    assert error.value.status_code == 429
    row = await studio.settle_attempt(s.db, row, attempt=2, input_tokens=0, output_tokens=0, cost_usd=0, outcome='expired')
    with pytest.raises(HTTPException): await studio.retry_failed(s.db, row)


@pytest.mark.asyncio
async def test_late_completion_cannot_validate(env):
    s = env; row = await make_job(s); row.kind = 'draft'; row.status = 'pending'; await s.db.commit()
    row = await studio.begin_attempt(s.db, row)
    stored = await s.db.get(Job, row.id)
    stored.deadline_at = datetime.now(timezone.utc) - timedelta(seconds=1); await s.db.commit()
    with pytest.raises(HTTPException) as error:
        await studio.settle_attempt(s.db, row, attempt=1, input_tokens=1, output_tokens=1, cost_usd=0, outcome='validated', candidate=candidate(s.knowledge))
    assert error.value.detail['code'] == 'studio_deadline_exceeded'


@pytest.mark.asyncio
async def test_http_contract_and_no_ai(env, monkeypatch):
    s = env; app = FastAPI(); app.include_router(routes.router)
    app.dependency_overrides[routes.get_db] = lambda: s.db
    app.dependency_overrides[routes.get_current_user] = lambda: {'user_id':str(s.owner.id)}
    from backend.core.utils.model_router import ModelRouter
    provider = AsyncMock(side_effect=AssertionError('No Stage 1 provider calls'))
    monkeypatch.setattr(ModelRouter, 'generate', provider)
    async with httpx.AsyncClient(app=app, base_url='http://test') as client:
        result = await client.post(f'/api/business-yansi/{s.business.id}/studio/topics', json=request(s).model_dump(mode='json'))
        assert result.status_code == 202, result.text
        data = result.json(); assert data['status'] == 'blocked' and data['executionAvailable'] is False
        assert 'content' not in data['sources'][0]
        app.dependency_overrides[routes.get_current_user] = lambda: {'user_id':str(s.viewer.id)}
        assert (await client.get(f"/api/business-yansi/{s.business.id}/studio/generations/{data['generationId']}")).status_code == 200
        assert (await client.post(f'/api/business-yansi/{s.business.id}/studio/topics', json=request(s).model_dump(mode='json'))).status_code == 403
    provider.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize('retries,expected', [(0, 1), (2, 3), (None, 3)])
async def test_model_router_explicit_zero_preserves_default_retry(monkeypatch, retries, expected):
    from backend.core.utils.model_router import ModelRouter
    router = object.__new__(ModelRouter)
    router.timeout = 1; router.max_retries = 2
    router._get_provider_from_model_id = lambda model: ('openai','fake-model')
    router.is_model_available = lambda model: True
    router.openai_client = type('Provider', (), {'generate':AsyncMock(return_value={'ok':False,'error':'timeout'})})()
    monkeypatch.setattr('asyncio.sleep', AsyncMock())
    await router.generate('QA fixture', 'fake-model', **({} if retries is None else {'retries':retries}))
    assert router.openai_client.generate.await_count == expected


def migration():
    p = Path(__file__).parent.parent/'migrations/versions/add_business_studio_v1.py'
    spec = importlib.util.spec_from_file_location('studio_migration', p)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def test_migration_postgresql_ddl_offline():
    output = io.StringIO()
    context = MigrationContext.configure(dialect_name='postgresql', opts={'as_sql':True,'output_buffer':output})
    with Operations.context(context): migration().upgrade()
    assert output.getvalue().count('CREATE TABLE') == 2
    assert 'uq_business_studio_idempotency' in output.getvalue()
    assert migration().down_revision == 'add_user_capabilities_v1'


@pytest.mark.asyncio
async def test_admission_default_disabled_without_schema_access(monkeypatch):
    monkeypatch.setenv('BILIGN_BUSINESS_ENABLED', 'true')
    monkeypatch.delenv('BILIGN_STUDIO_ADMISSION_ENABLED', raising=False)
    app = FastAPI(); app.include_router(routes.router)
    app.dependency_overrides[routes.get_db] = lambda: object()
    async with httpx.AsyncClient(app=app, base_url='http://test') as client:
        result = await client.post(f'/api/business-yansi/{uuid.uuid4()}/studio/topics', json={'idempotencyKey':'disabled-key','sourceVersionIds':[str(uuid.uuid4())]})
    assert result.status_code == 503 and result.json()['detail']['code'] == 'studio_admission_disabled'


@pytest.mark.asyncio
async def test_migration_sqlite_upgrade_empty_downgrade(sample):
    # Actual isolated SQLite DDL, NOT a PostgreSQL migration execution.
    async with sample.db.bind.begin() as c:
        def run(connection):
            with Operations.context(MigrationContext.configure(connection)):
                migration().upgrade()
                assert 'business_studio_generations' in inspect(connection).get_table_names()
                migration().downgrade()
                assert 'business_studio_generations' not in inspect(connection).get_table_names()
        await c.run_sync(run)


@pytest.mark.asyncio
async def test_nonempty_downgrade_refuses_data_loss(env):
    s = env; await make_job(s)
    async with s.db.bind.begin() as c:
        def run(connection):
            with Operations.context(MigrationContext.configure(connection)):
                with pytest.raises(RuntimeError): migration().downgrade()
            assert 'business_studio_generations' in inspect(connection).get_table_names()
        await c.run_sync(run)
    assert await s.db.scalar(select(func.count(Job.id))) == 1
