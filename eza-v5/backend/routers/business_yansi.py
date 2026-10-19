"""Explicit Business administration; ordinary users get no new sidebar entry."""
import uuid
from typing import Literal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from backend.auth.deps import get_current_user, security
from backend.core.utils.dependencies import get_db
from backend.models.business_yansi import BusinessProfile, BusinessMember, BusinessKnowledgeVersion, BusinessYansiDraft, BusinessPublication
from backend.models.production import User
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import applications as apps
from backend.services.business_yansi import platform_admin as padmin
from backend.services.business_yansi.publication import enabled, publisher, export_editorial_conversation, publish_draft
from backend.security.rate_limit import rate_limit_business_application

async def available():
    if not enabled(): raise HTTPException(404, 'not_found')
router=APIRouter(prefix='/api/business-yansi',tags=['Business Yansı'],dependencies=[Depends(available)])
class Body(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
class Create(Body):
    organizationId: uuid.UUID
    ownerId: uuid.UUID
    slug: str=Field(min_length=2,max_length=64)
    name: str=Field(min_length=1,max_length=120)
    description: str=Field(default='',max_length=500)
    logoUrl: str|None=None
    @field_validator('logoUrl')
    @classmethod
    def logo(cls,v):
        if v and not (v.startswith('https://') or v.startswith('/static/profile-avatars/')): raise ValueError('public_https_logo_required')
        return v
class Settings(Body):
    name: str=Field(min_length=1,max_length=120)
    description: str=Field(default='',max_length=500)
    logoUrl: str|None=None
    _logo=field_validator('logoUrl')(Create.logo.__func__)
class Verify(Body):
    verified: bool
    official: bool=False
    status: Literal['active','suspended','archived']='active'
class Member(Body):
    userId: uuid.UUID
    role: Literal['editor','viewer']
class KnowledgeCreate(Body):
    itemId: uuid.UUID|None=None
    title: str=Field(min_length=1,max_length=160)
    category: str=Field(default='',max_length=80)
    content: str=Field(min_length=1,max_length=12000)
    source: str=Field(min_length=1,max_length=1000)
    publicAllowed: bool=False
class Transition(Body):
    target: Literal['draft','review','approved','published','archived']
class KnowledgeDelete(Body):
    revision: int=Field(ge=1)
class Step(Body):
    question: str=Field(min_length=1,max_length=1000)
    answer: str=Field(min_length=1,max_length=4000)
    sources: list[uuid.UUID]=Field(min_length=1,max_length=4)
class DraftCreate(Body):
    title: str=Field(min_length=1,max_length=200)
    summary: str=Field(default='',max_length=500)
    steps: list[Step]=Field(min_length=8,max_length=8)
class DraftUpdate(DraftCreate):
    revision: int=Field(ge=1)
class Publish(Body):
    slug: str=Field(min_length=1,max_length=64)
    revision: int=Field(ge=1)
class Question(Body):
    question: str=Field(min_length=1,max_length=2000)
class ApplicationCreate(Body):
    brandName: str=Field(min_length=1,max_length=120)
    contactName: str=Field(min_length=1,max_length=120)
    corporateEmail: str=Field(min_length=3,max_length=255)
    website: str|None=Field(default=None,max_length=500)
    companyInfo: str=Field(default='',max_length=2000)
class ApplicationTransition(Body):
    target: Literal['received','under_review','approved','rejected']
    note: str=Field(default='',max_length=1000)
    slug: str|None=Field(default=None,min_length=2,max_length=64)
class CapabilityGrant(Body):
    userId: uuid.UUID
    capability: Literal['bilign.platform_admin']='bilign.platform_admin'

def record(row):
    # Management DTO only: these models contain no customer conversation text.
    result={column.name:getattr(row,column.name) for column in row.__table__.columns}
    return {key:str(v) if isinstance(v,(uuid.UUID,datetime)) else v for key,v in result.items()}
async def recorded(db,row):
    # AsyncSession expire_on_commit requires an explicit refresh before sync attribute reads.
    await db.refresh(row)
    return record(row)
async def manager(db,claims,business_id,role='viewer'):
    user=await svc.actor(db,claims);return user,await svc.access(db,business_id,user.id,role)

@router.get('')
async def mine(db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    rows=await db.scalars(select(BusinessProfile).join(BusinessMember,BusinessMember.business_id==BusinessProfile.id).where(BusinessMember.user_id==user.id))
    return {'items':[record(row) for row in rows],'canProvision':await svc.can_provision(db,user)}
@router.post('')
async def provision(body:Create,db=Depends(get_db),claims=Depends(get_current_user)):
    admin=await svc.platform_admin(db,claims);return await recorded(db,await svc.create_business(db,admin,body.model_dump(mode='json')))

@router.get('/applications/mine')
async def my_applications(db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    return {'items':[record(row) for row in await apps.list_mine(db,user.id)]}
@router.post('/applications')
async def submit_application(body:ApplicationCreate,request:Request,db=Depends(get_db),claims=Depends(get_current_user)):
    await rate_limit_business_application(request)
    user=await svc.actor(db,claims)
    return await recorded(db,await apps.create_application(db,user.id,body.model_dump(mode='json')))
@router.get('/applications')
async def all_applications(db=Depends(get_db),claims=Depends(get_current_user)):
    await svc.platform_admin(db,claims)
    return {'items':[record(row) for row in await apps.list_all(db)]}
@router.post('/applications/{application_id}/transition')
async def application_transition(application_id:uuid.UUID,body:ApplicationTransition,db=Depends(get_db),claims=Depends(get_current_user)):
    admin=await svc.platform_admin(db,claims)
    return await recorded(db,await apps.transition_application(db,admin.id,application_id,body.target,body.note,body.slug))
@router.get('/applications/{application_id}/events')
async def application_events(application_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    admin=await svc.platform_admin(db,claims);_ = admin
    return {'items':[record(row) for row in await apps.list_events(db,application_id)]}

@router.get('/admin/overview')
async def admin_overview(db=Depends(get_db),claims=Depends(get_current_user)):
    await svc.platform_admin(db,claims)
    data=await padmin.overview(db)
    return {
        'business_enabled':data['business_enabled'],
        'totals':data['totals'],
        'recent_applications':[record(row) for row in data['recent_applications']],
        'recent_events':[record(row) for row in data['recent_events']],
    }

@router.get('/admin/businesses')
async def admin_businesses(db=Depends(get_db),claims=Depends(get_current_user)):
    await svc.platform_admin(db,claims)
    rows=await padmin.list_businesses(db)
    return {
        'items':[
            {
                **record(item['business']),
                'owner_email':item['owner_email'],
                'owner_id':item['owner_id'],
                'publication_count':item['publication_count'],
                'member_count':item['member_count'],
            }
            for item in rows
        ]
    }

@router.get('/admin/businesses/{business_id}')
async def admin_business_detail(business_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    await svc.platform_admin(db,claims)
    data=await padmin.business_detail(db,business_id)
    return {
        'business':record(data['business']),
        'owner_email':data['owner_email'],
        'members':data['members'],
        'knowledge_versions':[record(row) for row in data['knowledge_versions']],
        'drafts':[record(row) for row in data['drafts']],
        'publications':[{**record(item['row']),'visibility':item['visibility']} for item in data['publications']],
    }

@router.get('/admin/users')
async def admin_users(q:str='',limit:int=20,db=Depends(get_db),claims=Depends(get_current_user)):
    await svc.platform_admin(db,claims)
    rows=await padmin.search_users(db,q,limit)
    return {
        'items':[
            {
                **row,
                'created_at':str(row['created_at']) if row.get('created_at') is not None else None,
            }
            for row in rows
        ]
    }

@router.get('/admin/publications')
async def admin_publications(limit:int=50,db=Depends(get_db),claims=Depends(get_current_user)):
    await svc.platform_admin(db,claims)
    rows=await padmin.list_publications(db,limit)
    return {
        'items':[
            {
                **row,
                'created_at':str(row['created_at']) if row.get('created_at') is not None else None,
            }
            for row in rows
        ]
    }

@router.get('/admin/system')
async def admin_system(db=Depends(get_db),claims=Depends(get_current_user)):
    await svc.platform_admin(db,claims)
    return await padmin.system_status(db)

@router.post('/admin/capabilities/grant')
async def admin_capability_grant(body:CapabilityGrant,db=Depends(get_db),claims=Depends(get_current_user)):
    from backend.services import user_capabilities as caps
    admin=await svc.platform_admin(db,claims)
    row=await caps.grant_capability(db,target_user_id=body.userId,capability=body.capability,actor_user_id=admin.id)
    return {'user_id':str(row.user_id),'capability':row.capability,'granted_at':str(row.granted_at),'revoked_at':None}

@router.post('/admin/capabilities/revoke')
async def admin_capability_revoke(body:CapabilityGrant,db=Depends(get_db),claims=Depends(get_current_user)):
    from backend.services import user_capabilities as caps
    admin=await svc.platform_admin(db,claims)
    row=await caps.revoke_capability(db,target_user_id=body.userId,capability=body.capability,actor_user_id=admin.id)
    return {'user_id':str(row.user_id),'capability':row.capability,'granted_at':str(row.granted_at),'revoked_at':str(row.revoked_at) if row.revoked_at else None}

@router.patch('/{business_id}/verification')
async def verification(business_id:uuid.UUID,body:Verify,db=Depends(get_db),claims=Depends(get_current_user)):
    await svc.platform_admin(db,claims);row=await db.get(BusinessProfile,business_id)
    if not row: svc.fail('business_not_found',404)
    if body.official and (not body.verified or row.slug!='bilign'):svc.fail('official_bilign_identity_required',422)
    row.verified=body.verified;row.official=body.official;row.status=body.status;await db.commit();return await recorded(db,row)
@router.get('/{business_id}/overview')
async def overview(business_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    user,business=await manager(db,claims,business_id)
    from backend.models.mirror_network import MirrorNetworkNode
    rows=(await db.execute(select(BusinessPublication,MirrorNetworkNode.visibility).join(MirrorNetworkNode,MirrorNetworkNode.slug==BusinessPublication.slug).where(BusinessPublication.business_id==business_id))).all()
    publications=[{**record(row),'visibility':visibility} for row,visibility in rows]
    return {'business':record(business),'role':(await db.get(BusinessMember,(business_id,user.id))).role,'publications':publications}
@router.patch('/{business_id}/settings')
async def settings(business_id:uuid.UUID,body:Settings,db=Depends(get_db),claims=Depends(get_current_user)):
    _,row=await manager(db,claims,business_id,'owner');row.name=body.name;row.description=body.description;row.logo_url=body.logoUrl;await db.commit();return await recorded(db,row)
@router.get('/{business_id}/members')
async def members(business_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    await manager(db,claims,business_id,'owner');return {'items':[record(row) for row in (await db.scalars(select(BusinessMember).where(BusinessMember.business_id==business_id))).all()]}
@router.put('/{business_id}/members')
async def member(business_id:uuid.UUID,body:Member,db=Depends(get_db),claims=Depends(get_current_user)):
    _,business=await manager(db,claims,business_id,'owner')
    user=await db.get(User,body.userId)
    if not user or not user.is_active or body.userId==business.owner_id:svc.fail('invalid_member',422)
    row=await db.get(BusinessMember,(business_id,body.userId))
    if row:row.role=body.role
    else:row=BusinessMember(business_id=business_id,user_id=body.userId,role=body.role);db.add(row)
    await db.commit();return await recorded(db,row)
@router.get('/{business_id}/knowledge')
async def knowledge(business_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    await manager(db,claims,business_id);return {'items':[record(row) for row in await svc.list_knowledge(db,business_id)]}
@router.post('/{business_id}/knowledge')
async def add_knowledge(business_id:uuid.UUID,body:KnowledgeCreate,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims);return await recorded(db,await svc.create_knowledge(db,business_id,user.id,body.model_dump(mode='json')))
@router.post('/{business_id}/knowledge/{version_id}/transition')
async def knowledge_transition(business_id:uuid.UUID,version_id:uuid.UUID,body:Transition,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims);return await recorded(db,await svc.transition_knowledge(db,business_id,user.id,version_id,body.target,body.revision))
@router.delete('/{business_id}/knowledge/{version_id}')
async def remove_knowledge(business_id:uuid.UUID,version_id:uuid.UUID,body:KnowledgeDelete,db=Depends(get_db),claims=Depends(get_current_user)):
    """Soft-delete a single knowledge version by id (archived). Does not touch other rows."""
    user=await svc.actor(db,claims)
    return await recorded(db,await svc.delete_knowledge(db,business_id,user.id,version_id,body.revision))
@router.get('/{business_id}/drafts')
async def drafts(business_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    await manager(db,claims,business_id);return {'items':[record(row) for row in (await db.scalars(select(BusinessYansiDraft).where(BusinessYansiDraft.business_id==business_id))).all()]}
@router.post('/{business_id}/drafts')
async def add_draft(business_id:uuid.UUID,body:DraftCreate,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims);return await recorded(db,await svc.create_draft(db,business_id,user.id,body.title,body.summary,[s.model_dump(mode='json') for s in body.steps]))
@router.post('/{business_id}/drafts/{draft_id}/transition')
async def draft_transition(business_id:uuid.UUID,draft_id:uuid.UUID,body:Transition,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims);return await recorded(db,await svc.transition_draft(db,business_id,user.id,draft_id,body.target,body.revision))
@router.post('/{business_id}/drafts/{draft_id}/editorial-conversation')
async def editorial(business_id:uuid.UUID,draft_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims);return {'clientConversationId':await export_editorial_conversation(db,business_id,user.id,draft_id)}
@router.post('/{business_id}/drafts/{draft_id}/publish')
async def publish(business_id:uuid.UUID,draft_id:uuid.UUID,body:Publish,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims);row=await publish_draft(db,business_id,user.id,draft_id,body.slug,body.revision);await db.refresh(row);return {'slug':row.slug,'journeyVersion':row.journey_version}
@router.post('/{business_id}/publications/{slug}/withdraw')
async def withdraw(business_id:uuid.UUID,slug:str,db=Depends(get_db),claims=Depends(get_current_user)):
    await manager(db,claims,business_id,'owner')
    from backend.models.mirror_network import MirrorNetworkNode
    links=(await db.scalars(select(BusinessPublication).where(BusinessPublication.business_id==business_id,BusinessPublication.slug==slug))).all()
    if not links:svc.fail('publication_not_found',404)
    node=await db.scalar(select(MirrorNetworkNode).where(MirrorNetworkNode.slug==slug).with_for_update());node.visibility='private';await db.commit();return {'ok':True}
@router.get('/public/{slug}')
async def public_profile(slug:str,db=Depends(get_db)):
    profile=await db.scalar(select(BusinessProfile).where(BusinessProfile.slug==slug,BusinessProfile.status=='active',BusinessProfile.verified.is_(True)))
    if not profile:svc.fail('business_not_found',404)
    from backend.models.production import Organization
    organization=await db.get(Organization,profile.id)
    if not organization or organization.status!='active':svc.fail('business_not_found',404)
    return publisher(profile)

@router.patch('/{business_id}/drafts/{draft_id}')
async def edit_draft(business_id:uuid.UUID,draft_id:uuid.UUID,body:DraftUpdate,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    return await recorded(db,await svc.revise_draft(db,business_id,user.id,draft_id,body.revision,body.title,body.summary,[s.model_dump(mode='json') for s in body.steps]))

@router.delete('/{business_id}/members/{user_id}')
async def remove_member(business_id:uuid.UUID,user_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    _,business=await manager(db,claims,business_id,'owner')
    if user_id==business.owner_id:svc.fail('cannot_remove_owner',409)
    row=await db.get(BusinessMember,(business_id,user_id))
    if row:await db.delete(row)
    await db.commit();return {'ok':True}

@router.post('/{business_id}/preview-answer')
async def preview_answer(business_id:uuid.UUID,body:Question,db=Depends(get_db),claims=Depends(get_current_user),credentials=Depends(security)):
    await manager(db,claims,business_id,'editor')
    from backend.core.account.guards import assert_can_send_message
    from backend.services.business_yansi.answers import BusinessHistory,answer
    await assert_can_send_message(db,message_text=body.question,credentials=credentials,guest_token=None,source_id=str(uuid.uuid4()))
    await db.commit()
    rows=svc.rank_sources(body.question,await svc.published_knowledge(db,business_id))
    sources=[{'id':str(r.id),'title':r.title,'text':r.content,'source':r.source,'version':r.version} for r in rows]
    return await answer(body.question,BusinessHistory([],business_id,sources))


# Child routes inherit the Business feature gate; existing endpoints are unchanged.
from backend.routers.business_studio import router as studio_router
router.include_router(studio_router)
