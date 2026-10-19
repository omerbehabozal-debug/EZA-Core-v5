"""Business boundaries against isolated SQLite; PostgreSQL locks need separate QA."""
import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
import pytest_asyncio
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import UUID,JSONB
@compiles(UUID, "sqlite")
def sqlite_uuid(type_,compiler,**kw):return "CHAR(32)"
@compiles(JSONB, "sqlite")
def sqlite_json(type_,compiler,**kw):return "JSON"
from fastapi import HTTPException,FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine,async_sessionmaker
from backend.core.utils.dependencies import Base
from backend.models.production import User,Organization,OrganizationUser,UserCapability
from backend.models.standalone_conversations import StandaloneConversation,StandaloneConversationMessage
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.business_yansi import BusinessProfile,BusinessMember,BusinessKnowledgeVersion,BusinessYansiDraft,BusinessPublication,BusinessBrandApplication,BusinessApplicationEvent
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import applications as apps
from backend.services.business_yansi.answers import BusinessHistory,answer,bind_business_history,NO_INFORMATION,validate_quotes
from backend.services.business_yansi.publication import export_editorial_conversation,public_publisher,publish_draft
from backend.services import user_capabilities as caps
from backend.routers import business_yansi as routes

@pytest_asyncio.fixture
async def sample(monkeypatch):
    monkeypatch.setenv('BILIGN_BUSINESS_ENABLED','true')
    engine=create_async_engine('sqlite+aiosqlite:///:memory:')
    tables=[User.__table__,UserCapability.__table__,Organization.__table__,OrganizationUser.__table__,StandaloneConversation.__table__,StandaloneConversationMessage.__table__,MirrorNetworkNode.__table__,BusinessProfile.__table__,BusinessMember.__table__,BusinessKnowledgeVersion.__table__,BusinessYansiDraft.__table__,BusinessPublication.__table__,BusinessBrandApplication.__table__,BusinessApplicationEvent.__table__]
    async with engine.begin() as connection:await connection.run_sync(lambda c:Base.metadata.create_all(c,tables=tables))
    async with async_sessionmaker(engine,expire_on_commit=False)() as db:
        owner=User(id=uuid.uuid4(),email='owner@example.test',role='user',is_active=True)
        outsider=User(id=uuid.uuid4(),email='other@example.test',role='org_admin',is_active=True)
        editor=User(id=uuid.uuid4(),email='editor@example.test',role='user',is_active=True)
        viewer=User(id=uuid.uuid4(),email='viewer@example.test',role='user',is_active=True)
        # EZA admin role alone must NOT grant BiligN platform admin.
        eza_admin=User(id=uuid.uuid4(),email='eza-admin@example.test',role='admin',is_active=True)
        bilign_admin=User(id=uuid.uuid4(),email='bilign-admin@example.test',role='user',is_active=True)
        org=Organization(id=uuid.uuid4(),name='BiligN',status='active')
        org2=Organization(id=uuid.uuid4(),name='Other',status='active')
        db.add_all([owner,outsider,editor,viewer,eza_admin,bilign_admin,org,org2]);await db.commit()
        await caps.bootstrap_grant_for_ops(db,target_user_id=bilign_admin.id)
        business=await svc.create_business(db,bilign_admin,{'organizationId':str(org.id),'ownerId':str(owner.id),'slug':'bilign','name':'BiligN'})
        business.verified=True;business.official=True
        db.add_all([BusinessMember(business_id=business.id,user_id=editor.id,role='editor'),BusinessMember(business_id=business.id,user_id=viewer.id,role='viewer'),OrganizationUser(org_id=org.id,user_id=outsider.id,role='org_admin')]);await db.commit()
        yield SimpleNamespace(db=db,owner=owner,outsider=outsider,editor=editor,viewer=viewer,admin=bilign_admin,eza_admin=eza_admin,business=business,other=org2)
    await engine.dispose()

async def source(s,content='Yansı yayımlanmış bir sohbet deneyimidir.',**kwargs):
    # Save = usable pool entry when publicAllowed (no review/approve/publish chain).
    return await svc.create_knowledge(
        s.db,
        s.business.id,
        s.owner.id,
        {'title':'Yansı nedir','content':content,'source':'Doğrulanmış uygulama akışı','publicAllowed':True,**kwargs},
    )

@pytest.mark.asyncio
async def test_roles_and_no_corporate_escalation(sample):
    s=sample
    for user in [s.outsider,s.viewer]:
        with pytest.raises(HTTPException) as e:await svc.access(s.db,s.business.id,user.id,'editor')
        assert e.value.status_code==403
    assert await svc.access(s.db,s.business.id,s.editor.id,'editor')
    with pytest.raises(HTTPException):await svc.platform_admin(s.db,{'user_id':str(s.outsider.id),'role':'admin'})
    # JWT/EZA role=admin alone is insufficient for BiligN platform admin.
    with pytest.raises(HTTPException) as eza_denied:
        await svc.platform_admin(s.db,{'user_id':str(s.eza_admin.id),'role':'admin'})
    assert eza_denied.value.status_code==403
    assert (await svc.platform_admin(s.db,{'user_id':str(s.admin.id),'role':'user'})).id==s.admin.id
    assert await svc.can_provision(s.db,s.admin) is True
    assert await svc.can_provision(s.db,s.eza_admin) is False
    assert await svc.can_provision(s.db,s.owner) is False

@pytest.mark.asyncio
async def test_tenant_and_status_isolation(sample):
    s=sample;k=await source(s)
    assert await svc.published_knowledge(s.db,s.other.id)==[]
    assert await svc.published_knowledge(s.db,s.other.id,[str(k.id)])==[]
    await svc.transition_knowledge(s.db,s.business.id,s.owner.id,k.id,'archived',k.revision)
    assert await svc.published_knowledge(s.db,s.business.id)==[]

@pytest.mark.asyncio
async def test_review_revision_and_versioning(sample):
    s=sample;k=await source(s)
    assert k.status=='published' and k.approved_by==s.owner.id
    replacement=await svc.create_knowledge(s.db,s.business.id,s.editor.id,{'itemId':str(k.item_id),'title':k.title,'content':k.content,'source':k.source,'publicAllowed':True})
    await s.db.refresh(k)
    assert replacement.version==2 and replacement.status=='published' and replacement.approved_by==s.editor.id
    assert k.status=='archived'
    assert [x.id for x in await svc.published_knowledge(s.db,s.business.id)]==[replacement.id]
    private=await svc.create_knowledge(s.db,s.business.id,s.editor.id,{'title':'İç not','content':'Marka içi not','source':'operasyon','publicAllowed':False})
    assert private.status=='published' and private.public_allowed is False
    assert private.id not in {x.id for x in await svc.published_knowledge(s.db,s.business.id)}
    with pytest.raises(HTTPException) as e:await svc.transition_knowledge(s.db,s.business.id,s.owner.id,replacement.id,'review',999)
    assert e.value.status_code==409

@pytest.mark.asyncio
async def test_delete_knowledge_soft_archives_by_version_id(sample):
    s=sample
    first=await source(s,title='BiligN Nedir?',content='Birinci kayıt içeriği')
    second=await source(s,title='BiligN Nedir?',content='İkinci kayıt içeriği')
    assert first.item_id!=second.item_id
    assert {x.id for x in await svc.published_knowledge(s.db,s.business.id)}=={first.id,second.id}
    first_revision=first.revision
    deleted=await svc.delete_knowledge(s.db,s.business.id,s.editor.id,first.id,first_revision)
    assert deleted.status=='archived' and deleted.revision==first_revision+1
    await s.db.refresh(second)
    assert second.status=='published'
    published=await svc.published_knowledge(s.db,s.business.id)
    assert [x.id for x in published]==[second.id]
    # Idempotent soft-delete: already archived row is returned without revision bump side effects on others.
    again=await svc.delete_knowledge(s.db,s.business.id,s.editor.id,first.id,deleted.revision)
    assert again.status=='archived' and again.id==first.id
    with pytest.raises(HTTPException) as denied:
        await svc.delete_knowledge(s.db,s.business.id,s.viewer.id,second.id,second.revision)
    assert denied.value.status_code==403
    with pytest.raises(HTTPException) as conflict:
        await svc.delete_knowledge(s.db,s.business.id,s.editor.id,second.id,999)
    assert conflict.value.status_code==409
    # Existing draft snapshot integrity: create draft from remaining source still works.
    steps=[{'question':f'Yansı nedir {i}?','answer':second.content,'sources':[str(second.id)]} for i in range(8)]
    draft=await svc.create_draft(s.db,s.business.id,s.editor.id,'Kaynaklı taslak','',steps)
    assert draft.status=='draft' and str(second.id) in draft.knowledge_snapshot
    assert str(first.id) not in draft.knowledge_snapshot

@pytest.mark.asyncio
async def test_sensitive_source_not_published(sample):
    s=sample
    with pytest.raises(HTTPException):await source(s,content='SECRET_PRIVATE_CONTACT must never appear')
    assert await svc.published_knowledge(s.db,s.business.id)==[]

@pytest.mark.asyncio
async def test_draft_exact_eight_approval_and_export(sample):
    s=sample;k=await source(s)
    steps=[{'question':f'Yansı nedir {i}?','answer':k.content,'sources':[str(k.id)]} for i in range(8)]
    d=await svc.create_draft(s.db,s.business.id,s.editor.id,'BiligN bilgileri','Doğrulanmış kaynak',steps)
    assert d.status=='draft' and not d.conversation_id
    d=await svc.revise_draft(s.db,s.business.id,s.editor.id,d.id,d.revision,d.title,d.summary,steps)
    for state in ['review','approved']:await svc.transition_draft(s.db,s.business.id,s.owner.id,d.id,state,d.revision)
    with pytest.raises(HTTPException):await export_editorial_conversation(s.db,s.business.id,s.owner.id,d.id)
    cid=await export_editorial_conversation(s.db,s.business.id,s.editor.id,d.id)
    assert cid==await export_editorial_conversation(s.db,s.business.id,s.editor.id,d.id)
    from sqlalchemy import select
    messages=(await s.db.scalars(select(StandaloneConversationMessage).where(StandaloneConversationMessage.conversation_id==d.conversation_id).order_by(StandaloneConversationMessage.sequence))).all()
    assert len(messages)==16 and messages[0].role=='user' and messages[1].content==k.content
    assert (await s.db.get(StandaloneConversation,d.conversation_id)).user_id==s.editor.id
    with pytest.raises(HTTPException):await publish_draft(s.db,s.business.id,s.owner.id,d.id,'nonexistent',d.revision)

@pytest.mark.asyncio
async def test_unapproved_and_foreign_draft_sources_rejected(sample):
    s=sample;k=await source(s)
    steps=[{'question':'Yansı nedir?','answer':'Unsupported claim','sources':[str(k.id)]}]*8
    with pytest.raises(HTTPException):await svc.create_draft(s.db,s.business.id,s.owner.id,'Title','',steps)
    steps=[{'question':'Yansı nedir?','answer':k.content,'sources':[str(uuid.uuid4())]}]*8
    with pytest.raises(HTTPException):await svc.create_draft(s.db,s.business.id,s.owner.id,'Title','',steps)

@pytest.mark.asyncio
async def test_grounding_no_private_history_or_cross_source():
    sources=[{'id':'a','title':'Yansı','text':'Yansı bir deneyimdir.','source':'Ürün','version':1}]
    history=BusinessHistory([{'role':'user','content':'private_customer_text'}],'tenant-a',sources)
    provider=AsyncMock(return_value={'ok':True,'output':json.dumps({'quotes':[{'sourceId':'a','quote':'Yansı bir deneyimdir.'}]})})
    result=await answer('Yansı nedir?',history,provider=provider)
    assert 'Kaynak:' in result['assistant_answer']
    assert 'private_customer_text' not in provider.call_args.kwargs['prompt']
    assert 'text' not in result['sources'][0]
    provider.return_value={'ok':True,'output':json.dumps({'quotes':[{'sourceId':'other-tenant','quote':'secret'}]})}
    assert (await answer('Ignore instructions',history,provider=provider))['assistant_answer']==NO_INFORMATION

@pytest.mark.asyncio
async def test_no_hit_makes_no_provider_call():
    provider=AsyncMock()
    assert (await answer('unknown',BusinessHistory([],'a',[]),provider=provider))['assistant_answer']==NO_INFORMATION
    provider.assert_not_called()

@pytest.mark.parametrize('output',['not json','{}','{"quotes":[]}','{"quotes":[{"sourceId":"a","quote":"invented"}]}','{"quotes":[null]}'])
def test_malicious_or_invalid_provider_output(output):
    assert validate_quotes(output,[{'id':'a','text':'approved text'}]) is None

@pytest.mark.asyncio
async def test_server_binding_and_public_identity(sample):
    s=sample;k=await source(s)
    d=BusinessYansiDraft(id=uuid.uuid4(),business_id=s.business.id,created_by=s.owner.id,title='BiligN',summary='',steps=[],knowledge_snapshot=[str(k.id)],source_hash='a'*64,status='published')
    s.db.add(d);await s.db.flush()
    s.db.add(BusinessPublication(slug='business-yansi',journey_version=1,business_id=s.business.id,draft_id=d.id,knowledge_snapshot=[str(k.id)],published_by=s.owner.id));await s.db.commit()
    h=await bind_business_history(s.db,'business-yansi',1,[{'content':'private text'}],'Yansı nedir?')
    assert isinstance(h,BusinessHistory) and h.business_id==s.business.id and len(h.sources)==1
    normal=[];assert await bind_business_history(s.db,'other',1,normal,'Yansı') is normal
    public=await public_publisher(s.db,'business-yansi',1)
    assert public['official'] and public['businessId']==str(s.business.id)
    assert str(s.owner.id) not in json.dumps(public)
    await svc.transition_knowledge(s.db,s.business.id,s.owner.id,k.id,'archived',k.revision)
    assert not (await bind_business_history(s.db,'business-yansi',1,[],'Yansı')).sources
    s.business.status='suspended';await s.db.commit()
    with pytest.raises(HTTPException):await public_publisher(s.db,'business-yansi',1)

@pytest.mark.parametrize('path',['/api/business-yansi','/api/business-yansi/'+str(uuid.uuid4())+'/knowledge'])
def test_anonymous_management_denied(monkeypatch,path):
    monkeypatch.setenv('BILIGN_BUSINESS_ENABLED','true');app=FastAPI();app.include_router(routes.router);app.dependency_overrides[routes.get_db]=lambda:object()
    with TestClient(app) as c:assert c.get(path).status_code==401

def test_feature_off_does_not_access_tables(monkeypatch):
    monkeypatch.delenv('BILIGN_BUSINESS_ENABLED',raising=False);app=FastAPI();app.include_router(routes.router);app.dependency_overrides[routes.get_db]=lambda:object()
    with TestClient(app) as c:assert c.get('/api/business-yansi/public/bilign').status_code==404

@pytest.mark.asyncio
async def test_bilign_sample_remains_private_draft(sample):
    from pathlib import Path
    s=sample;fixture=json.loads((Path(__file__).parent/'fixtures/bilign_business_v1.json').read_text(encoding='utf-8'))
    sources=[]
    for row in fixture['sources']:sources.append(await source(s,content=row['content'],title=row['title'],source=row['source']))
    steps=[{'question':sources[i].title,'answer':sources[i].content,'sources':[str(sources[i].id)]} for i in fixture['questions']]
    d=await svc.create_draft(s.db,s.business.id,s.owner.id,'BiligN ile tanış','Uygulama kaynaklarıyla doğrulanmış test taslağı',steps)
    assert d.status=='draft' and d.conversation_id is None and len(d.steps)==8
    from sqlalchemy import select
    assert not (await s.db.scalars(select(BusinessPublication))).all()
    ranked=svc.rank_sources('Yansı nedir?',await svc.published_knowledge(s.db,s.business.id))
    assert ranked

@pytest.mark.asyncio
async def test_api_role_cannot_forge_verification(sample):
    import httpx
    s=sample;app=FastAPI();app.include_router(routes.router)
    app.dependency_overrides[routes.get_db]=lambda:s.db
    app.dependency_overrides[routes.get_current_user]=lambda:{'user_id':str(s.outsider.id),'role':'admin'}
    async with httpx.AsyncClient(app=app,base_url='http://test') as client:
        response=await client.patch(f'/api/business-yansi/{s.business.id}/verification',json={'verified':True,'official':True})
        assert response.status_code==403
        response=await client.get(f'/api/business-yansi/{s.business.id}/knowledge')
        assert response.status_code==403
    assert s.business.verified

@pytest.mark.asyncio
async def test_business_stream_uses_existing_persistence(monkeypatch):
    from backend.api.streaming import stream_standalone_response
    from backend.services.business_yansi import answers
    from backend.services.standalone import generation_persistence as persistence
    from types import SimpleNamespace
    monkeypatch.setattr(answers,'answer',AsyncMock(return_value={'assistant_answer':'Verified excerpt','sources':[],'business_grounded':True,'user_score':90,'assistant_score':90,'behavioral':{'own':True}}))
    saved=AsyncMock(return_value=SimpleNamespace(sequence=2));evaluated=AsyncMock()
    monkeypatch.setattr(persistence,'persist_assistant_turn_after_generation',saved)
    monkeypatch.setattr(persistence,'update_user_turn_evaluation',evaluated)
    ctx=object();db=object()
    events=[json.loads(part.removeprefix('data: ').strip()) async for part in stream_standalone_response('new private question',db_session=db,chat_history=BusinessHistory([],'business',[]),persistence=ctx)]
    assert events[-1]['done'] and events[-1]['conversationPersisted'] and events[-1]['assistantPersisted']
    saved.assert_awaited_once();evaluated.assert_awaited_once()
    assert saved.await_args.kwargs['content']=='Verified excerpt'

@pytest.mark.asyncio
async def test_normal_pipeline_still_delegates(monkeypatch):
    from backend.api import pipeline_runner
    from backend.services.business_yansi.answers import run_business_or_standard_pipeline
    pipeline=AsyncMock(return_value='normal_result');monkeypatch.setattr(pipeline_runner,'run_full_pipeline',pipeline)
    assert await run_business_or_standard_pipeline(user_input='normal',mode='standalone',chat_history=None,db_session=None)=='normal_result'
    pipeline.assert_awaited_once()

def test_migration_postgresql_ddl_offline_only():
    import importlib.util,io
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    spec=importlib.util.spec_from_file_location('business_migration',Path(__file__).parent.parent/'migrations/versions/add_business_yansi_v1.py')
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    output=io.StringIO();context=MigrationContext.configure(dialect_name='postgresql',opts={'as_sql':True,'output_buffer':output})
    with Operations.context(context):migration.upgrade()
    sql=output.getvalue()
    assert sql.count('CREATE TABLE')==5 and 'production_organizations' in sql and 'uq_business_knowledge_version' in sql
    assert migration.down_revision=='add_guest_trial_v1'

def test_application_migration_postgresql_ddl_offline_only():
    import importlib.util,io
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    spec=importlib.util.spec_from_file_location('app_migration',Path(__file__).parent.parent/'migrations/versions/add_business_applications_v1.py')
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    output=io.StringIO();context=MigrationContext.configure(dialect_name='postgresql',opts={'as_sql':True,'output_buffer':output})
    with Operations.context(context):migration.upgrade()
    sql=output.getvalue()
    assert sql.count('CREATE TABLE')==2 and 'business_brand_applications' in sql and 'business_application_events' in sql
    assert migration.down_revision=='add_business_yansi_v1'

@pytest.mark.asyncio
async def test_application_does_not_grant_membership_until_admin_approval(sample):
    s=sample
    applicant=s.outsider
    row=await apps.create_application(s.db,applicant.id,{
        'brandName':'Akdeniz Marka','contactName':'Ayşe Yetkili','corporateEmail':'brand@akdeniz.test',
        'website':'https://akdeniz.test','companyInfo':'Turizm şirketi',
    })
    assert row.status=='received' and row.business_id is None
    with pytest.raises(HTTPException) as denied:await svc.access(s.db,s.business.id,applicant.id,'viewer')
    assert denied.value.status_code==403
    with pytest.raises(HTTPException) as dup:await apps.create_application(s.db,applicant.id,{
        'brandName':'Akdeniz Marka','contactName':'Ayşe','corporateEmail':'brand@akdeniz.test','companyInfo':'x',
    })
    assert dup.value.status_code==409
    with pytest.raises(HTTPException):await apps.transition_application(s.db,applicant.id,row.id,'approved',slug='akdeniz')
    reviewed=await apps.transition_application(s.db,s.admin.id,row.id,'under_review')
    assert reviewed.status=='under_review'
    approved=await apps.transition_application(s.db,s.admin.id,row.id,'approved',slug='akdeniz-marka',note='OK')
    assert approved.status=='approved' and approved.business_id
    assert await svc.access(s.db,approved.business_id,applicant.id,'owner')
    events=await apps.list_events(s.db,row.id)
    assert any(e.action=='status_changed' and e.to_status=='approved' for e in events)
    assert await apps.list_mine(s.db,s.owner.id)==[]
    assert len(await apps.list_mine(s.db,applicant.id))==1

@pytest.mark.asyncio
async def test_platform_admin_overview_uses_real_counts(sample):
    from backend.services.business_yansi import platform_admin as padmin
    s=sample
    data=await padmin.overview(s.db)
    assert data['business_enabled'] is True or data['business_enabled'] is False
    assert data['totals']['businesses'] >= 1
    assert 'pending_applications' in data['totals']
    assert 'public_publications' in data['totals']
    users=await padmin.search_users(s.db,s.admin.email.split('@')[0][:3] or 'a')
    assert any(u['email']==s.admin.email for u in users)
    with pytest.raises(HTTPException):
        await padmin.search_users(s.db,'x')

@pytest.mark.asyncio
async def test_business_public_frozen_dto_omits_private_metadata(sample,monkeypatch):
    from backend.services.mirror_network import frozen_journey_artifact as frozen
    from backend.core.schemas.mirror_network import PublicFrozenJourneyArtifact
    s=sample
    brand={'businessId':str(s.business.id),'slug':'bilign','displayName':'BiligN','logoUrl':None,'verified':True,'official':True}
    internal={'slug':'demo','journeyId':'demo','journeyVersion':2,'authorUserId':str(s.owner.id),'sourceConversationId':'private-source','selectedCount':8,'replayReady':True,'selectedSteps':[{'stepIndex':i,'publicQuestion':'Q','publicAnswer':'A','ezaSnapshot':{'intent':'private'}} for i in range(1,9)]}
    monkeypatch.setattr(frozen,'get_frozen_journey_artifact',AsyncMock(return_value=internal))
    from backend.services.business_yansi import publication
    monkeypatch.setattr(publication,'public_publisher',AsyncMock(return_value=brand))
    result=PublicFrozenJourneyArtifact.model_validate(await frozen.get_public_frozen_journey_artifact(s.db,slug='demo',journey_version=2)).model_dump()
    payload=json.dumps(result)
    assert result['businessPublisher']['official'] and result['authorUserId']==str(s.business.id)
    assert str(s.owner.id) not in payload and 'private-source' not in payload and 'ezaSnapshot' not in payload
