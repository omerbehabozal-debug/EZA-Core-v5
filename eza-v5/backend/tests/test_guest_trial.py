"""DB-backed lifecycle tests: isolated SQLite memory, no external DB/AI."""
import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB, UUID
from backend.models.account_usage_event import AccountUsageEvent
from backend.models.guest_trial import GuestTrial
from backend.core.schemas.pipeline import StandaloneRequest
from backend.core.schemas.mirror_sohbet import MirrorSohbetSessionResponse
from backend.core.account.guest_identity import resolve_guest_fingerprint
from backend.core.account.subject import AccountSubject
from backend.core.account.tiers import AccountTier, get_entitlements_for_tier
from backend.core.account.usage_service import count_usage_events, record_account_usage_event
from backend.services.mirror_network import guest_trial as service

@compiles(JSONB, 'sqlite')
def sqlite_json(type_, compiler, **kw): return 'JSON'
@compiles(UUID, 'sqlite')
def sqlite_uuid(type_, compiler, **kw): return 'CHAR(32)'
TOKEN='guest-trial-owner-0123456789'
FP=resolve_guest_fingerprint(TOKEN)

async def created(db, slug, token, **kw):
    return MirrorSohbetSessionResponse(sessionId='00000000-0000-0000-0000-000000000001' if slug=='source' else '00000000-0000-0000-0000-000000000002',guestToken=token,
        mirrorSlug=slug,cardTitle='Public',openingMessage='Open',expiresAt='2030-01-01T00:00:00Z',
        parentMirrorId=slug,rootMirrorId=slug,seedTopic='',seedCategory='',seedMood='')

def request(session, message='u1', text='Question'):
    return StandaloneRequest(query=text,guestTrialSessionId=session.sessionId,clientUserMessageId=message,clientAssistantMessageId='a'+message)

async def environment(action):
    engine=create_async_engine('sqlite+aiosqlite:///:memory:')
    async with engine.begin() as connection:
        await connection.run_sync(GuestTrial.__table__.create)
        await connection.run_sync(AccountUsageEvent.__table__.create)
    factory=async_sessionmaker(engine,expire_on_commit=False)
    async with factory() as db:
        with patch('backend.services.mirror_network.sohbet_session.create_sohbet_session',side_effect=created), patch('backend.services.mirror_network.service.fetch_public_mirror_by_slug',new=AsyncMock()), patch('backend.services.mirror_network.frozen_journey_artifact.get_public_frozen_journey_artifact',new=AsyncMock(return_value=object())), patch.object(service,'resolve_account_subject',new=AsyncMock(return_value=AccountSubject(AccountTier.GUEST,None,FP,False))):
            await action(db)
    await engine.dispose()

def run(action): asyncio.run(environment(action))

async def prepare(db,slug='source'):
    result=await service.prepare_guest_trial(db,slug,TOKEN,None);await db.commit();return result

async def accepted(db,session,id='u1'):
    req=request(session,id);row,cached=await service.begin_guest_turn(db,req,None,TOKEN)
    if not cached: await service.finish_guest_turn(db,row,req,'Answer',{'assistant_answer':'Answer'})
    return cached


def test_preparation_retry_is_free_and_stable():
    async def action(db):
        first=await prepare(db);second=await prepare(db)
        assert first.sessionId==second.sessionId
        assert await service.legacy_used(db,FP)==0
        assert second.guestTrialResumed
    run(action)


def test_success_persists_pair_and_spends_once_duplicate_replays():
    async def action(db):
        session=await prepare(db);await accepted(db,session)
        cached=await accepted(db,session)
        assert cached['answer']=='Answer'
        assert await service.legacy_used(db,FP)==1
        row=await service.find_trial(db,FP);assert len(row.turns)==1
    run(action)


def test_failure_rolls_back_and_retry_uses_same_trial():
    async def action(db):
        session=await prepare(db)
        await service.begin_guest_turn(db,request(session),None,TOKEN)
        await db.rollback()
        assert await service.legacy_used(db,FP)==0
        again=await prepare(db);assert again.sessionId==session.sessionId
        await accepted(db,again);assert await service.legacy_used(db,FP)==1
    run(action)


def test_resume_returns_same_conversation_and_server_history():
    async def action(db):
        session=await prepare(db);await accepted(db,session)
        resumed=await prepare(db)
        assert resumed.guestTrialSessionId==session.sessionId
        assert [m['isUser'] for m in resumed.guestTrialMessages]==[True,False]
        assert await service.legacy_used(db,FP)==1
    run(action)


def test_ten_messages_allowed_eleventh_denied():
    async def action(db):
        session=await prepare(db)
        for i in range(10):await accepted(db,session,'u'+str(i))
        with pytest.raises(HTTPException) as error:await service.begin_guest_turn(db,request(session,'u11'),None,TOKEN)
        assert error.value.detail['reason']=='guest_message_limit_reached'
        # Idempotent replay remains available even after reaching the cap.
        assert (await service.begin_guest_turn(db,request(session,'u0'),None,TOKEN))[1]
    run(action)


def test_other_source_denied_after_first_success():
    async def action(db):
        session=await prepare(db);await accepted(db,session)
        with pytest.raises(HTTPException) as error:await prepare(db,'other')
        assert error.value.detail['reason']=='guest_discover_limit_reached'
    run(action)


def test_abandoned_source_replace_invalidates_old_session():
    async def action(db):
        old=await prepare(db);new=await prepare(db,'other')
        assert old.sessionId!=new.sessionId
        with pytest.raises(HTTPException):await service.begin_guest_turn(db,request(old),None,TOKEN)
        assert await service.legacy_used(db,FP)==0
    run(action)


def test_different_guest_cannot_open_trial_with_known_id():
    async def action(db):
        session=await prepare(db)
        with patch.object(service,'resolve_account_subject',new=AsyncMock(return_value=AccountSubject(AccountTier.GUEST,None,'another-fingerprint',False))):
            with pytest.raises(HTTPException) as error:await service.begin_guest_turn(db,request(session),None,'other-token-long-enough')
            assert error.value.detail['reason']=='guest_trial_session_invalid'
    run(action)


def test_missing_token_is_identity_error():
    async def action(db):
        with pytest.raises(HTTPException) as error:await service.prepare_guest_trial(db,'source','short',None)
        assert error.value.detail['reason']=='guest_token_required'
    run(action)


def test_legacy_ambiguous_start_is_not_erased_or_given_free_trial():
    async def action(db):
        await record_account_usage_event(db,event_type='discover_conversation_started',guest_fingerprint=FP,source_id='old-source');await db.commit()
        with pytest.raises(HTTPException):await prepare(db)
        assert await service.legacy_used(db,FP)==1
    run(action)


def test_changed_payload_cannot_reuse_accepted_id():
    async def action(db):
        session=await prepare(db);await accepted(db,session)
        with pytest.raises(HTTPException) as error:await service.begin_guest_turn(db,request(session,text='Changed'),None,TOKEN)
        assert error.value.status_code==409
    run(action)


def test_501_chars_rejected_without_spending():
    async def action(db):
        session=await prepare(db)
        with pytest.raises(HTTPException):await service.begin_guest_turn(db,request(session,text='x'*501),None,TOKEN)
        assert await service.legacy_used(db,FP)==0
    run(action)


def test_authenticated_and_replay_only_bypass_trial_branch():
    async def action(db):
        assert await service.begin_guest_turn(db,StandaloneRequest(query='Q'),None,TOKEN) is None
        with patch.object(service,'resolve_account_subject',new=AsyncMock(return_value=AccountSubject(AccountTier.FREE,'owner',None,True))):
            session=await prepare(db)
            assert await service.begin_guest_turn(db,request(session),None,TOKEN) is None
        assert get_entitlements_for_tier(AccountTier.FREE)['dailyMessageLimit']==20
        assert get_entitlements_for_tier(AccountTier.FREE)['dailyDiscoverStartLimit']==1
    run(action)


def test_preparation_and_generation_use_same_transaction_lock():
    async def action(db):
        with patch.object(service,'lock_guest',new=AsyncMock()) as lock:
            session=await prepare(db);await service.begin_guest_turn(db,request(session),None,TOKEN)
            assert [call.args[1] for call in lock.await_args_list]==[FP,FP]
    run(action)


def test_postgres_lock_is_transaction_scoped():
    async def action():
        db=AsyncMock();db.get_bind=lambda:SimpleNamespace(dialect=SimpleNamespace(name='postgresql'))
        await service.lock_guest(db,FP)
        sql,params=db.execute.await_args.args
        assert str(sql)=='SELECT pg_advisory_xact_lock(:lock_id)'
        assert isinstance(params['lock_id'],int)
        db.commit.assert_not_awaited()
    asyncio.run(action())


def test_stream_commits_before_done_and_rolls_back_failure():
    async def action(db):
        session=await prepare(db);req=request(session)
        row,_=await service.begin_guest_turn(db,req,None,TOKEN)
        async def frames(**kwargs):
            yield 'data: {"token":"Answer"}\n\n'
            yield 'data: {"done":true}\n\n'
        with patch('backend.api.streaming.stream_standalone_response',side_effect=frames):
            stream=service.guest_stream(db,row,req,None)
            assert 'token' in await anext(stream)
            assert await service.legacy_used(db,FP)==0
            assert 'done' in await anext(stream)
            assert await service.legacy_used(db,FP)==1
            assert (await service.find_trial(db,FP)).turns[0]['answer']=='Answer'
            with pytest.raises(StopAsyncIteration):await anext(stream)
    run(action)


def test_failed_stream_does_not_consume_trial():
    async def action(db):
        session=await prepare(db);req=request(session)
        row,_=await service.begin_guest_turn(db,req,None,TOKEN)
        async def frames(**kwargs):
            yield 'data: {"error":"Offline"}\n\n'
        with patch('backend.api.streaming.stream_standalone_response',side_effect=frames):
            assert len([f async for f in service.guest_stream(db,row,req,None)])==1
        assert await service.legacy_used(db,FP)==0
    run(action)


def test_nonstream_endpoint_retry_returns_saved_pair_without_second_ai_call():
    from backend.main import standalone_endpoint
    from backend.core.schemas.pipeline import PipelineResponse
    async def action(db):
        session=await prepare(db);req=request(session)
        pipeline=AsyncMock(return_value={'ok':True,'mode':'standalone','data':{'assistant_answer':'Answer'}})
        with patch('backend.main.run_full_pipeline',new=pipeline), patch.object(service,'guest_history',new=AsyncMock(return_value=None)):
            result=await standalone_endpoint(req,db=db,credentials=None,x_guest_token=TOKEN)
            assert result.ok
            retry=await standalone_endpoint(req,db=db,credentials=None,x_guest_token=TOKEN)
            assert retry['data']['assistant_answer']=='Answer'
            pipeline.assert_awaited_once()
            assert pipeline.await_args.kwargs['db_session'] is None
        assert await service.legacy_used(db,FP)==1
    run(action)


def test_nonstream_endpoint_failed_ai_does_not_spend():
    from backend.main import standalone_endpoint
    from backend.core.schemas.pipeline import PipelineResponse
    async def action(db):
        session=await prepare(db);req=request(session)
        with patch('backend.main.run_full_pipeline',new=AsyncMock(return_value=PipelineResponse(ok=False,mode='standalone'))), patch.object(service,'guest_history',new=AsyncMock(return_value=None)):
            result=await standalone_endpoint(req,db=db,credentials=None,x_guest_token=TOKEN)
            assert not result.ok
        assert await service.legacy_used(db,FP)==0
        assert not (await service.find_trial(db,FP)).turns
    run(action)


def test_stream_endpoint_success_and_retry_use_durable_pair():
    from backend.main import standalone_stream_endpoint
    async def action(db):
        session=await prepare(db);req=request(session)
        async def frames(**kwargs):
            yield 'data: {"token":"Answer"}\n\n'
            yield 'data: {"done":true}\n\n'
        with patch('backend.api.streaming.stream_standalone_response',side_effect=frames) as ai, patch.object(service,'guest_history',new=AsyncMock(return_value=None)), patch('backend.main.enforce_public_demo_limits'):
            response=await standalone_stream_endpoint(req,db=db,credentials=None,x_guest_token=TOKEN)
            result=[f async for f in response.body_iterator]
            assert len(result)==2
            retry=await standalone_stream_endpoint(req,db=db,credentials=None,x_guest_token=TOKEN)
            replay=[f async for f in retry.body_iterator]
            assert 'Answer' in replay[0]
            assert ai.call_count==1
        assert await service.legacy_used(db,FP)==1
    run(action)


def test_assistant_id_cannot_be_reused_for_another_turn():
    async def action(db):
        session=await prepare(db);await accepted(db,session)
        other=request(session,'u2').model_copy(update={'clientAssistantMessageId':'au1'})
        with pytest.raises(HTTPException) as error:
            await service.begin_guest_turn(db,other,None,TOKEN)
        assert error.value.status_code==409
        assert len((await service.find_trial(db,FP)).turns)==1
    run(action)


def test_guest_replay_generation_requires_server_trial_binding():
    from backend.core.schemas.mirror_sohbet import PublicReplaySelection
    async def action(db):
        selection=PublicReplaySelection(slug='source',journeyVersion=1,completedStepCount=1)
        with pytest.raises(HTTPException) as error:
            await service.begin_guest_turn(db,StandaloneRequest(query='Q',publicReplaySelection=selection),None,TOKEN)
        assert error.value.detail['reason']=='guest_trial_session_invalid'
        assert await service.legacy_used(db,FP)==0
    run(action)


def test_parallel_preparations_share_one_trial_under_transaction_lock():
    # In-memory DB with a modeled transaction lock, not a live PostgreSQL test.
    async def action(db):
        factory=async_sessionmaker(db.bind,expire_on_commit=False)
        mutex=asyncio.Lock()
        async def lock(session,fingerprint):
            assert fingerprint==FP
            await mutex.acquire()
        async def start():
            async with factory() as session:
                try:
                    result=await service.prepare_guest_trial(session,'source',TOKEN,None)
                    await session.commit()
                    return result.sessionId
                finally:
                    mutex.release()
        with patch.object(service,'lock_guest',side_effect=lock):
            first,second=await asyncio.gather(start(),start())
        assert first==second
        assert len((await db.execute(select(GuestTrial))).scalars().all())==1
        assert await service.legacy_used(db,FP)==0
    run(action)
