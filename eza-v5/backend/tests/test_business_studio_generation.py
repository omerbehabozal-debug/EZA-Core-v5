"""Stage 2 QA: real SQL, mocked provider, no paid AI calls."""
import asyncio
import copy
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select, func
from backend.tests.test_business_studio import env, sample, request
from backend.models.business_studio import BusinessStudioGeneration as Job, BusinessStudioUsage as Usage
from backend.models.business_yansi import BusinessYansiDraft
from backend.core.schemas.business_studio import GenerationRequest, TopicsRequest
from backend.services.business_yansi import studio, studio_execution as execution, studio_generation as generation


@pytest_asyncio.fixture
async def ready(env, monkeypatch):
    monkeypatch.setenv('BILIGN_STUDIO_EXECUTION_ENABLED', 'true')
    monkeypatch.setenv('BILIGN_STUDIO_MODEL', 'openai/gpt-4o-mini')
    monkeypatch.setenv('BILIGN_STUDIO_PRICES_JSON', json.dumps({'openai/gpt-4o-mini': {'inputPerMillion': '.15', 'outputPerMillion': '.60'}}))
    env.knowledge.content = '\n\n'.join(['Brand workshop and design choices', 'Workshop product care and repairs',
        'The workshop selects durable materials for its verified product designs.',
        'The workshop uses reusable materials for its verified product range.',
        'The design team checks each product before shipping from the workshop.',
        'The repair service accepts the verified product range at the workshop.',
        'Customers can request a product repair through the workshop service.',
        'The packaging is designed for repeated use within the product range.',
        'Product care instructions are supplied with each verified product.',
        'The workshop publishes product care details in its printed guide.'])
    await env.db.commit()
    return env


def reply(value, **kw):
    return {'ok': True, 'output': json.dumps({'insufficientSources':False,'result':value}), 'usage': {'prompt_tokens': 100, 'completion_tokens': 100}, 'finish_reason': 'stop', **kw}


def fake(*values):
    return SimpleNamespace(generate=AsyncMock(side_effect=list(values)), available_models=['openai/gpt-4o-mini'], openai_client=SimpleNamespace(api_key=None))


def topics_output(passages):
    keys=[k for k,e in passages.items() if generation.answer_eligible(e)]
    titles=list(passages)
    return {'topics': [{'titlePassageId': titles[i], 'descriptionPassageId': keys[i], 'answerPassageIds': keys} for i in (0,2)]}


async def topics(s):
    job=await studio.create_job(s.db,s.business.id,s.owner.id,request(s,key='topic-request-001'),'topics')
    provider=fake(reply(topics_output(generation.catalog(job.source_snapshot))))
    return await execution.execute(s.db,job,router=provider),provider


def draft_output(parent):
    topic=parent.execution['result']['topics'][0]
    questions=['How does the workshop describe its design choices?', 'Which materials does the workshop use for products?',
        'How does the design team check each product?', 'Which products does the repair service accept?',
        'How can customers request a product repair?', 'How is packaging designed for repeated use?',
        'What care instructions accompany each product?', 'Where does the workshop publish product care details?']
    return {'titlePassageId': topic['titlePassageId'], 'summaryPassageId': topic['descriptionPassageId'],
            'steps':[{'question':q,'passageId':key} for q,key in zip(questions,topic['answerPassageIds'])]}


async def draft_job(s,parent):
    body=GenerationRequest(idempotencyKey='draft-request-001',sourceVersionIds=[s.knowledge.id],expectedSnapshotHash=parent.snapshot_hash,
        topicsGenerationId=parent.id,topicId='topic-1')
    return await studio.create_job(s.db,s.business.id,s.owner.id,body,'draft')


@pytest.mark.asyncio
async def test_grounded_draft_atomic_idempotency_no_transaction_over_ai(ready):
    s=ready;parent,router=await topics(s)
    assert studio.response(parent).status=='completed' and len(parent.execution['result']['topics'])==2
    assert router.generate.await_args.kwargs['retries']==0
    job=await draft_job(s,parent);provider=fake()
    async def generate(**kw):
        assert not s.db.in_transaction()
        return reply(draft_output(parent))
    provider.generate.side_effect=generate
    row=await execution.execute(s.db,job,router=provider)
    assert row.status=='succeeded' and row.draft_id
    draft=await s.db.get(BusinessYansiDraft,row.draft_id)
    assert draft.status=='draft' and draft.approved_by is None and draft.conversation_id is None
    assert len(draft.steps)==8
    for step in row.execution['result']['steps']:
        e=step['evidence'];assert s.knowledge.content[e['start']:e['end']]==step['answer']
    await execution.execute(s.db,await draft_job(s,parent),router=provider)
    assert provider.generate.await_count==1
    assert await s.db.scalar(select(func.count(BusinessYansiDraft.id)))==1
    assert await s.db.scalar(select(func.count(Usage.generation_id)))==2
    assert row.cost_usd==Decimal('.00007500')


@pytest.mark.asyncio
@pytest.mark.parametrize('failure',['json','foreign','duplicate','incomplete'])
async def test_invalid_output_retry_bound(ready,failure):
    s=ready;job=await studio.create_job(s.db,s.business.id,s.owner.id,request(s),'topics')
    value=topics_output(generation.catalog(job.source_snapshot));bad=reply(copy.deepcopy(value))
    if failure=='json':bad['output']='not JSON'
    if failure=='foreign':value['topics'][0]['answerPassageIds'][0]='foreign';bad=reply(value)
    if failure=='duplicate':value['topics'][1]=value['topics'][0];bad=reply(value)
    if failure=='incomplete':bad['finish_reason']='length'
    provider=fake(bad,bad);row=await execution.execute(s.db,job,router=provider)
    assert row.status=='failed' and row.attempts==2 and row.input_tokens==200 and row.draft_id is None
    assert provider.generate.await_count==2


@pytest.mark.asyncio
async def test_invalid_then_valid(ready):
    s=ready;job=await studio.create_job(s.db,s.business.id,s.owner.id,request(s),'topics')
    row=await execution.execute(s.db,job,router=fake(reply('bad'),reply(topics_output(generation.catalog(job.source_snapshot)))))
    assert row.status=='succeeded' and row.attempts==2


@pytest.mark.asyncio
@pytest.mark.parametrize('failure',['timeout','cancel','unknown_usage','provider'])
async def test_ambiguous_usage_reserved_not_free_and_never_retried(ready,failure):
    s=ready;job=await studio.create_job(s.db,s.business.id,s.owner.id,request(s),'topics')
    value=reply(topics_output(generation.catalog(job.source_snapshot)))
    effect={'timeout':TimeoutError(),'cancel':asyncio.CancelledError(),'unknown_usage':{**value,'usage':None},'provider':{'ok':False}}[failure]
    provider=fake(effect)
    if failure=='cancel':
        with pytest.raises(asyncio.CancelledError):await execution.execute(s.db,job,router=provider)
        row=await s.db.get(Job,job.id)
    else:row=await execution.execute(s.db,job,router=provider)
    assert row.status=='failed' and row.attempts==1 and row.cost_usd>0 and row.execution['usageEstimated']
    assert provider.generate.await_count==1
    assert (await s.db.get(Usage,(row.id,1))).estimated


@pytest.mark.asyncio
async def test_crash_recovery_and_running_duplicate(ready):
    s=ready;job=await studio.create_job(s.db,s.business.id,s.owner.id,request(s),'topics')
    running,work=await execution.prepare(s.db,job,studio.Limits());assert work
    provider=fake();assert (await execution.execute(s.db,running,router=provider)).status=='running'
    persisted=await s.db.get(Job,running.id);persisted.deadline_at=datetime.now(timezone.utc)-timedelta(seconds=1);await s.db.commit()
    row=await execution.recover(s.db,persisted)
    assert row.status=='failed' and row.error_code=='studio_execution_interrupted'
    await execution.execute(s.db,row,router=provider);provider.generate.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('failure',['insufficient','pricing','budget','topic'])
async def test_preflight_never_calls_paid_provider(ready,monkeypatch,failure):
    s=ready
    if failure=='insufficient':s.knowledge.content='Only one short source paragraph.';await s.db.commit()
    if failure=='pricing':monkeypatch.delenv('BILIGN_STUDIO_PRICES_JSON')
    if failure=='budget':monkeypatch.setenv('BILIGN_STUDIO_PRICES_JSON',json.dumps({'openai/gpt-4o-mini':{'inputPerMillion':999,'outputPerMillion':999}}))
    if failure=='topic':
        _,fingerprint=await studio.snapshot_sources(s.db,s.business.id,[s.knowledge.id])
        body=GenerationRequest(idempotencyKey='draft-missing-topic',sourceVersionIds=[s.knowledge.id],expectedSnapshotHash=fingerprint)
        job=await studio.create_job(s.db,s.business.id,s.owner.id,body,'draft')
    else:job=await studio.create_job(s.db,s.business.id,s.owner.id,request(s),'topics')
    provider=fake();row=await execution.execute(s.db,job,router=provider)
    assert row.status=='blocked' and row.attempts==0;provider.generate.assert_not_awaited()


@pytest.mark.asyncio
async def test_revocation_during_ai_accounts_usage_without_draft(ready):
    s=ready;parent,_=await topics(s);job=await draft_job(s,parent);provider=fake()
    async def generate(**kw):
        s.knowledge.public_allowed=False;await s.db.commit()
        return reply(draft_output(parent))
    provider.generate.side_effect=generate
    row=await execution.execute(s.db,job,router=provider)
    assert row.status=='failed' and row.error_code=='studio_snapshot_stale' and row.input_tokens==100
    assert await s.db.scalar(select(func.count(BusinessYansiDraft.id)))==0
    with pytest.raises(HTTPException):await studio.read_job(s.db,s.business.id,s.viewer.id,parent.id)

@pytest.mark.asyncio
@pytest.mark.parametrize('mutation',['membership','inactive','source'])
async def test_external_revocation_refreshes_identity_map(ready,mutation):
    from sqlalchemy import update
    from backend.models.production import User
    from backend.models.business_yansi import BusinessMember, BusinessKnowledgeVersion
    from sqlalchemy.ext.asyncio import async_sessionmaker
    s=ready;parent,_=await topics(s);job=await draft_job(s,parent);provider=fake()
    async def generate(**kw):
        async with async_sessionmaker(s.db.bind,expire_on_commit=False)() as other:
            if mutation=='membership':
                await other.execute(update(BusinessMember).where(BusinessMember.business_id==s.business.id,BusinessMember.user_id==s.owner.id).values(role='viewer'))
            elif mutation=='inactive':await other.execute(update(User).where(User.id==s.owner.id).values(is_active=False))
            else:await other.execute(update(BusinessKnowledgeVersion).where(BusinessKnowledgeVersion.id==s.knowledge.id).values(public_allowed=False))
            await other.commit()
        return reply(draft_output(parent))
    provider.generate.side_effect=generate
    row=await execution.execute(s.db,job,router=provider)
    assert row.status=='failed' and row.draft_id is None and row.input_tokens==100


@pytest.mark.asyncio
async def test_endpoint_executes_and_viewer_reads_without_source_instructions(ready,monkeypatch):
    import httpx
    from fastapi import FastAPI
    from backend.routers import business_yansi as routes
    s=ready
    monkeypatch.setenv('BILIGN_BUSINESS_ENABLED','true')
    snapshot,_=await studio.snapshot_sources(s.db,s.business.id,[s.knowledge.id])
    provider=fake(reply(topics_output(generation.catalog(snapshot))))
    monkeypatch.setattr(execution,'ModelRouter',lambda:provider)
    app=FastAPI();app.include_router(routes.router)
    app.dependency_overrides[routes.get_db]=lambda:s.db
    app.dependency_overrides[routes.get_current_user]=lambda:{'user_id':str(s.editor.id)}
    async with httpx.AsyncClient(app=app,base_url='http://test') as client:
        response=await client.post(f'/api/business-yansi/{s.business.id}/studio/topics',json=request(s).model_dump(mode='json'))
        assert response.status_code==202,response.text
        data=response.json();assert data['status']=='completed' and data['result']['topics']
        app.dependency_overrides[routes.get_current_user]=lambda:{'user_id':str(s.viewer.id)}
        response=await client.get(f"/api/business-yansi/{s.business.id}/studio/generations/{data['generationId']}")
        assert response.status_code==200
        assert (await client.post(f'/api/business-yansi/{s.business.id}/studio/topics',json=request(s).model_dump(mode='json'))).status_code==403
    assert 'untrusted DATA' in provider.generate.await_args.kwargs['prompt']


@pytest.mark.asyncio
async def test_openai_json_mode_and_usage_backwards_compatible(monkeypatch):
    from backend.core.llm.providers.openai_client import OpenAIClient
    import httpx
    seen=[]
    def transport(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200,json={'choices':[{'message':{'content':'{}'},'finish_reason':'stop'}],
            'usage':{'prompt_tokens':10,'completion_tokens':2}})
    original=httpx.AsyncClient
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw:original(transport=httpx.MockTransport(transport),**kw))
    client=OpenAIClient();client.api_key='local-mock-only'
    result=await client.generate('Return JSON','gpt-4o-mini',json_mode=True)
    assert result['usage']['prompt_tokens']==10 and seen[-1]['response_format']=={'type':'json_object'}
    await client.generate('normal chat','gpt-4o-mini')
    assert 'response_format' not in seen[-1]


def migration2():
    import importlib.util
    from pathlib import Path
    path=Path(__file__).parent.parent/'migrations/versions/add_business_studio_v2.py'
    spec=importlib.util.spec_from_file_location('studio_v2',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def test_stage2_migration_postgresql_ddl():
    import io
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    output=io.StringIO()
    context=MigrationContext.configure(dialect_name='postgresql',opts={'as_sql':True,'output_buffer':output})
    with Operations.context(context):migration2().upgrade()
    sql=output.getvalue()
    assert 'ADD COLUMN execution JSON' in sql and 'ADD COLUMN estimated BOOLEAN DEFAULT false NOT NULL' in sql
    assert migration2().down_revision=='add_business_studio_v1'


@pytest.mark.asyncio
async def test_stage2_empty_migration_upgrade_downgrade(sample):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from backend.tests.test_business_studio import migration
    async with sample.db.bind.begin() as connection:
        def run(sync):
            with Operations.context(MigrationContext.configure(sync)):
                migration().upgrade();migration2().upgrade();migration2().downgrade();migration2().upgrade()
        await connection.run_sync(run)

@pytest.mark.asyncio
async def test_expired_revoked_source_recovers_even_when_read_is_denied(ready):
    s=ready;job=await studio.create_job(s.db,s.business.id,s.owner.id,request(s),'topics')
    running,_=await execution.prepare(s.db,job,studio.Limits())
    row=await s.db.get(Job,running.id)
    row.deadline_at=datetime.now(timezone.utc)-timedelta(seconds=1)
    s.knowledge.public_allowed=False;await s.db.commit()
    with pytest.raises(HTTPException):await studio.read_job(s.db,s.business.id,s.viewer.id,row.id)
    await s.db.rollback()
    refreshed=await s.db.get(Job,running.id)
    assert refreshed.status=='failed' and refreshed.execution['usageEstimated']


@pytest.mark.asyncio
async def test_queued_crash_expires_without_provider_usage(ready):
    s=ready;job=await studio.create_job(s.db,s.business.id,s.owner.id,request(s),'topics')
    row=await s.db.get(Job,job.id)
    row.status='pending';row.execution={'promptVersion':'business-studio-extractive-v2'}
    row.deadline_at=datetime.now(timezone.utc)-timedelta(seconds=1);await s.db.commit()
    result=await execution.recover(s.db,row)
    assert result.status=='failed' and result.error_code=='studio_queue_expired'
    assert result.cost_usd==0 and await s.db.scalar(select(func.count(Usage.generation_id)))==0


@pytest.mark.asyncio
async def test_stage2_downgrade_refuses_provenance_loss(ready):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    s=ready;await topics(s)
    await s.db.rollback()
    async with s.db.bind.begin() as connection:
        def run(sync):
            with Operations.context(MigrationContext.configure(sync)):
                with pytest.raises(RuntimeError):migration2().downgrade()
        await connection.run_sync(run)

@pytest.mark.asyncio
async def test_executor_passes_server_owned_enum_schema(ready):
    s=ready;parent,_=await topics(s);job=await draft_job(s,parent);provider=fake(reply(draft_output(parent)))
    row=await execution.execute(s.db,job,router=provider)
    assert row.status=='succeeded'
    schema=provider.generate.await_args.kwargs['json_schema']
    assert schema['$defs']['Question']['properties']['passageId']['enum']==parent.execution['result']['topics'][0]['answerPassageIds']
    assert schema['$defs']['DraftOutput']['properties']['titlePassageId']['enum']==[parent.execution['result']['topics'][0]['titlePassageId']]
    assert '"evidence"' not in provider.generate.await_args.kwargs['prompt']


@pytest.mark.asyncio
async def test_explicit_insufficient_source_envelope_is_terminal(ready):
    s=ready;job=await studio.create_job(s.db,s.business.id,s.owner.id,request(s),'topics')
    provider=fake({'ok':True,'output':json.dumps({'insufficientSources':True,'result':None}),
                  'finish_reason':'stop','usage':{'prompt_tokens':100,'completion_tokens':10}})
    row=await execution.execute(s.db,job,router=provider)
    assert row.status=='failed' and row.error_code=='studio_insufficient_sources'
    assert row.attempts==1 and not row.execution['usageEstimated']


@pytest.mark.asyncio
async def test_input_token_budget_is_checked_before_provider(ready):
    from dataclasses import replace
    s=ready
    job=await studio.create_job(s.db,s.business.id,s.owner.id,request(s),'topics',replace(studio.Limits(),input_tokens=10))
    provider=fake();row=await execution.execute(s.db,job,router=provider)
    assert row.status=='blocked' and row.error_code=='studio_attempt_budget_exceeded'
    provider.generate.assert_not_awaited()


@pytest.mark.asyncio
async def test_structured_router_forwards_enum_schema_without_default_chat_change(monkeypatch):
    from backend.core.utils.model_router import ModelRouter
    router=object.__new__(ModelRouter);router.timeout=1
    router._get_provider_from_model_id=lambda _:('openai','qa-model')
    router.is_model_available=lambda _:True
    router.openai_client=SimpleNamespace(generate=AsyncMock(return_value={'ok':True,'output':'{}'}))
    schema={'type':'object','properties':{},'additionalProperties':False}
    await router.generate('QA','openai/qa-model',retries=0,json_schema=schema)
    assert router.openai_client.generate.await_args.kwargs['json_schema']==schema
    await router.generate('normal','openai/qa-model',retries=0)
    assert 'json_schema' not in router.openai_client.generate.await_args.kwargs


@pytest.mark.asyncio
async def test_openai_strict_schema_is_sent_to_provider(monkeypatch):
    from backend.core.llm.providers.openai_client import OpenAIClient
    import httpx
    seen=[]
    def transport(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200,json={'choices':[{'message':{'content':'{}'},'finish_reason':'stop'}], 'usage':{'prompt_tokens':10,'completion_tokens':2}})
    original=httpx.AsyncClient
    monkeypatch.setattr(httpx,'AsyncClient',lambda **kw:original(transport=httpx.MockTransport(transport),**kw))
    client=OpenAIClient();client.api_key='local-mock-only'
    schema={'type':'object','properties':{},'additionalProperties':False}
    await client.generate('QA JSON','gpt-4o-mini',json_schema=schema)
    assert seen[0]['response_format']=={'type':'json_schema','json_schema':{'name':'business_studio','strict':True,'schema':schema}}
    assert seen[0]['messages'][0]['role']=='system'

@pytest.mark.asyncio
async def test_metadata_only_source_is_pinned_for_owner_review(ready):
    from backend.tests.test_business_yansi import source
    s=ready
    metadata=await source(s,content='Workshop approach to verified product care',title='Workshop identity')
    body=type(request(s))(idempotencyKey='metadata-source-topic',sourceVersionIds=[s.knowledge.id,metadata.id])
    job=await studio.create_job(s.db,s.business.id,s.owner.id,body,'topics')
    passages=generation.catalog(job.source_snapshot)
    value=topics_output(passages)
    metadata_key=next(k for k,e in passages.items() if e['versionId']==str(metadata.id))
    value['topics'][0]['titlePassageId']=metadata_key
    parent=await execution.execute(s.db,job,router=fake(reply(value)))
    request_body=GenerationRequest(idempotencyKey='metadata-source-draft',sourceVersionIds=[s.knowledge.id,metadata.id],
        expectedSnapshotHash=parent.snapshot_hash,topicsGenerationId=parent.id,topicId='topic-1')
    job=await studio.create_job(s.db,s.business.id,s.owner.id,request_body,'draft')
    row=await execution.execute(s.db,job,router=fake(reply(draft_output(parent))))
    draft=await s.db.get(BusinessYansiDraft,row.draft_id)
    assert str(metadata.id) in draft.knowledge_snapshot
    assert all(str(metadata.id) not in step['sources'] for step in draft.steps)
    metadata.public_allowed=False;await s.db.commit()
    from backend.services.business_yansi import service
    await service.transition_draft(s.db,s.business.id,s.owner.id,draft.id,'review',draft.revision)
    with pytest.raises(HTTPException) as error:
        await service.transition_draft(s.db,s.business.id,s.owner.id,draft.id,'approved',draft.revision)
    assert error.value.detail['code']=='source_snapshot_unavailable'

@pytest.mark.asyncio
async def test_source_revocation_prevents_even_repair_retry(ready):
    s=ready;job=await studio.create_job(s.db,s.business.id,s.owner.id,request(s),'topics');provider=fake()
    async def generate(**kw):
        s.knowledge.public_allowed=False;await s.db.commit()
        return reply('invalid model result')
    provider.generate.side_effect=generate
    row=await execution.execute(s.db,job,router=provider)
    assert row.status=='failed' and row.attempts==1 and row.error_code=='studio_snapshot_stale'
    assert provider.generate.await_count==1 and row.input_tokens==100

def test_job_caps_are_unchanged():
    limits = studio.Limits()
    assert limits.input_tokens == 20000 and limits.output_tokens == 6000 and limits.max_attempts == 2
    assert limits.job_cost == Decimal('.10') and limits.daily_cost == Decimal('1.00')
    assert limits.daily_tokens == 260000 and limits.daily_jobs == 10


def test_gpt_41_mini_count_uses_o200k_and_includes_schema_once():
    import tiktoken
    prompt = 'catalog only, no schema copy'
    schema = {'type': 'object', 'title': 'unique-schema-marker'}
    counted = execution.input_token_count('openai/gpt-4.1-mini', prompt, schema)
    encoder = tiktoken.encoding_for_model('gpt-4.1-mini')
    assert encoder.name == 'o200k_base'
    assert counted > len(encoder.encode(prompt)) + execution._TOKEN_MARGIN
    assert 'unique-schema-marker' not in prompt


def _paragraph(seed, target=3400):
    sentence = f"Kaynak {seed} maddesi atölyenin doğrulanmış ürün bakımı ve onarım yolunu ayrıntılı biçimde açıklar."
    parts = []
    while sum(len(part) + 1 for part in parts) < target:
        parts.append(sentence)
    text = " ".join(parts)
    if len(text) > 3900:
        text = text[:3890].rsplit(" ", 1)[0]
    if not text.endswith("."):
        text += "."
    return text


@pytest.mark.asyncio
async def test_five_sources_fit_one_attempt_without_a_second_call(ready, monkeypatch):
    from backend.tests.test_business_yansi import source
    s = ready
    monkeypatch.setenv('BILIGN_STUDIO_MODEL', 'openai/gpt-4.1-mini')
    monkeypatch.setenv('BILIGN_STUDIO_PRICES_JSON', json.dumps({
        'openai/gpt-4.1-mini': {'inputPerMillion': '0.40', 'outputPerMillion': '1.60'}}))
    rows = []
    for index in range(5):
        content = "\n\n".join([
            f"Kısa başlık {index} atölye kaydı ve ürün notu.",
            _paragraph(f"{index}a"),
            _paragraph(f"{index}b"),
            _paragraph(f"{index}c"),
        ])
        rows.append(await source(s, content=content, title=f"Kaynak {index}", source=f"Kaynak notu {index}"))
    body = TopicsRequest(
        idempotencyKey='five-source-topics-01', sourceVersionIds=[row.id for row in rows])
    job = await studio.create_job(s.db, s.business.id, s.owner.id, body, 'topics')
    assert job.reserved_input_tokens == 20000 and Decimal(str(job.cost_limit_usd)) == Decimal('0.10')
    passages = generation.catalog(job.source_snapshot)
    short = [key for key, item in passages.items() if len(item['text'].strip()) <= 200]
    eligible = [key for key, item in passages.items() if generation.answer_eligible(item)]
    produced = {'topics': [
        {'titlePassageId': short[0], 'descriptionPassageId': short[0], 'answerPassageIds': eligible[:8]},
        {'titlePassageId': short[1], 'descriptionPassageId': short[1], 'answerPassageIds': eligible[:8]},
    ]}
    provider = fake(reply(produced))
    row = await execution.execute(s.db, job, router=provider)
    assert row.status == 'succeeded' and row.attempts == 1 and provider.generate.await_count == 1
    assert row.execution['promptVersion'] == 'business-studio-extractive-v3'
    reserve_in = row.execution['reserveIn']
    assert 10000 < reserve_in <= 20000
    assert reserve_in * row.max_attempts > 20000
    assert Decimal(row.execution['reserveCost']) < Decimal('.10')
    prompt = provider.generate.await_args.kwargs['prompt']
    schema = provider.generate.await_args.kwargs['json_schema']
    assert '$defs' not in prompt and '$defs' in schema
    assert schema['$defs']['Topic']['properties']['answerPassageIds']['items']['enum']
    assert row.input_tokens == 100 and row.output_tokens == 100 and row.execution['usageEstimated'] is False


@pytest.mark.asyncio
async def test_oversized_prompt_stops_before_provider(ready, monkeypatch):
    s = ready
    monkeypatch.setenv('BILIGN_STUDIO_MODEL', 'openai/gpt-4.1-mini')
    monkeypatch.setenv('BILIGN_STUDIO_PRICES_JSON', json.dumps({
        'openai/gpt-4.1-mini': {'inputPerMillion': '0.40', 'outputPerMillion': '1.60'}}))
    passages = ["Kısa başlık atölye kaydı ve ürün notu."]
    passages += [("汉" * 2500) + f" item {index} one two three four five." for index in range(8)]
    s.knowledge.content = "\n\n".join(passages)
    assert len(s.knowledge.content.encode('utf-8')) <= 64000
    await s.db.commit()
    job = await studio.create_job(s.db, s.business.id, s.owner.id, request(s), 'topics')
    provider = fake()
    row = await execution.execute(s.db, job, router=provider)
    assert row.status == 'blocked' and row.error_code == 'studio_attempt_budget_exceeded'
    assert row.attempts == 0 and row.input_tokens == 0 and row.cost_usd == 0
    provider.generate.assert_not_awaited()


@pytest.mark.asyncio
async def test_retry_skipped_when_remainder_cannot_hold_another_call(ready):
    s = ready
    job = await studio.create_job(s.db, s.business.id, s.owner.id, request(s), 'topics')
    bad = reply('not JSON')
    bad['usage'] = {'prompt_tokens': 19000, 'completion_tokens': 100}
    provider = fake(bad, reply(topics_output(generation.catalog(job.source_snapshot))))
    row = await execution.execute(s.db, job, router=provider)
    assert provider.generate.await_count == 1
    assert row.status == 'failed' and row.attempts == 1 and row.error_code == 'studio_invalid_model_output'
    assert row.input_tokens == 19000 and row.output_tokens == 100 and row.execution['usageEstimated'] is False
    assert row.execution['reserveIn'] < 19000
    assert row.reserved_input_tokens - row.input_tokens < row.execution['reserveIn']


@pytest.mark.asyncio
async def test_real_usage_above_reservation_stays_inside_cap(ready):
    s = ready
    job = await studio.create_job(s.db, s.business.id, s.owner.id, request(s), 'topics')
    provider = fake(reply(topics_output(generation.catalog(job.source_snapshot)),
                           usage={'prompt_tokens': 8000, 'completion_tokens': 40}))
    row = await execution.execute(s.db, job, router=provider)
    assert row.status == 'succeeded' and row.attempts == 1 and provider.generate.await_count == 1
    assert row.execution['reserveIn'] < 8000
    assert row.input_tokens == 8000 and row.output_tokens == 40 and row.execution['usageEstimated'] is False
    ledger = await s.db.get(Usage, (row.id, 1))
    assert ledger.input_tokens == 8000 and ledger.output_tokens == 40 and ledger.estimated is False
    assert ledger.cost_usd == execution.cost(8000, 40, row.execution['rates'])


@pytest.mark.asyncio
async def test_token_count_failure_blocks_before_provider(ready, monkeypatch):
    import tiktoken
    s = ready
    monkeypatch.setattr(tiktoken, 'encoding_for_model', lambda model: (_ for _ in ()).throw(KeyError(model)))
    job = await studio.create_job(s.db, s.business.id, s.owner.id, request(s), 'topics')
    provider = fake()
    row = await execution.execute(s.db, job, router=provider)
    assert row.status == 'blocked' and row.error_code == 'studio_token_count_unavailable'
    assert row.attempts == 0 and row.cost_usd == 0
    provider.generate.assert_not_awaited()


@pytest.mark.asyncio
async def test_daily_dollar_cap_still_blocks_admission(ready):
    from dataclasses import replace
    s = ready
    limits = replace(studio.Limits(), daily_cost=Decimal('0.05'))
    with pytest.raises(HTTPException) as error:
        await studio.create_job(s.db, s.business.id, s.owner.id, request(s), 'topics', limits)
    assert error.value.status_code == 429 and error.value.detail['code'] == 'studio_business_budget_exceeded'


@pytest.mark.asyncio
async def test_crlf_and_original_evidence_whitespace_remain_exact(ready):
    s=ready;s.knowledge.content=s.knowledge.content.replace('\n','\r\n');await s.db.commit()
    parent,_=await topics(s);assert parent.status=='succeeded'
    job=await draft_job(s,parent)
    row=await execution.execute(s.db,job,router=fake(reply(draft_output(parent))))
    assert row.status=='succeeded'
    for step in row.execution['result']['steps']:
        e=step['evidence'];assert s.knowledge.content[e['start']:e['end']]==e['text']
        assert step['answer']==e['text'].strip()
