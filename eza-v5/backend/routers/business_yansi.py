"""Explicit Business administration; ordinary users get no new sidebar entry."""
import uuid
from typing import Literal
from datetime import datetime
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.security import HTTPAuthorizationCredentials
from starlette.datastructures import UploadFile as ParsedUploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select
from backend.auth.deps import get_current_user, security
from backend.auth.jwt import get_user_from_token
from backend.core.utils.dependencies import get_db
from backend.models.business_yansi import BusinessProfile, BusinessMember, BusinessKnowledgeVersion, BusinessYansiDraft, BusinessPublication
from backend.services.business_yansi import service as svc
from backend.services.business_yansi.video_authority import (
    assign_member_role,
    remove_business_member,
    update_brand_verification,
)
from backend.services.business_yansi.video_upload_gate import admit_video_upload
from backend.services.business_yansi import applications as apps
from backend.services.business_yansi import platform_admin as padmin
from backend.services.business_yansi.publication import enabled, publisher, export_editorial_conversation, publish_draft
from backend.services.business_yansi import brand_asset_library as assets
from backend.services.business_yansi.brand_asset_library import MAX_BRAND_LIBRARY_IMAGE_BYTES
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
        if v and not (v.startswith('https://') or v.startswith('/static/profile-avatars/') or v.startswith('/api/public/profile-avatars/')): raise ValueError('public_https_logo_required')
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
class VideoImport(Body):
    url: str=Field(min_length=8,max_length=1000)
    title: str=Field(default='',max_length=160)
    caption: str=Field(default='',max_length=500)
    purpose: Literal['cover','step']
    publicAllowed: bool=False
class AssetWrite(Body):
    assetType: Literal['video','place','link']
    title: str=Field(default='',max_length=160)
    caption: str=Field(default='',max_length=500)
    publicAllowed: bool=False
    locator: str|None=Field(default=None,max_length=1000)
    latitude: str|None=Field(default=None,max_length=32)
    longitude: str|None=Field(default=None,max_length=32)
class AssetUpdate(AssetWrite):
    revision: int=Field(ge=1)
    assetType: Literal['video','place','link','image']='image'
class AssetLinks(Body):
    knowledgeVersionIds: list[uuid.UUID]=Field(default_factory=list,max_length=32)
    revision: int=Field(ge=1)
class AssetArchive(Body):
    revision: int=Field(ge=1)
class AssetDelete(Body):
    revision: int=Field(ge=1)
class CoverSegment(Body):
    startSeconds: float=Field(ge=0)
    endSeconds: float=Field(gt=0)
class CoverSuggestion(Body):
    idempotencyKey: str=Field(min_length=8,max_length=128)
class CoverImageSuggestion(Body):
    idempotencyKey: str=Field(min_length=8,max_length=128)
class CoverImageConfirm(Body):
    knowledgeVersionIds: list[uuid.UUID]=Field(default_factory=list,max_length=32)
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
    coverAssetId: uuid.UUID|None=None
    coverKind: Literal['video','image']|None=None
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
    await svc.platform_admin(db,claims)
    row=await update_brand_verification(db,business_id,verified=body.verified,official=body.official,status=body.status)
    return await recorded(db,row)
@router.get('/{business_id}/cover-ai')
async def cover_ai_availability(business_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    """Whether interval suggestions can be requested. This does not call a provider."""
    from backend.services.business_yansi.cover_ai import enabled as cover_ai_enabled
    user=await svc.actor(db,claims)
    await svc.access(db,business_id,user.id,'viewer')
    return {'enabled':cover_ai_enabled()}
@router.get('/{business_id}/overview')
async def overview(business_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    """Shell payload for the initial Business dashboard. Includes counts so Genel Bakış
    does not need to load knowledge/drafts lists first."""
    user,business=await manager(db,claims,business_id)
    from backend.models.mirror_network import MirrorNetworkNode
    rows=(await db.execute(select(BusinessPublication,MirrorNetworkNode.visibility).join(MirrorNetworkNode,MirrorNetworkNode.slug==BusinessPublication.slug).where(BusinessPublication.business_id==business_id))).all()
    publications=[{**record(row),'visibility':visibility} for row,visibility in rows]
    draft_count=await db.scalar(
        select(func.count()).select_from(BusinessYansiDraft).where(
            BusinessYansiDraft.business_id==business_id,
            BusinessYansiDraft.status!='published',
        )
    )
    knowledge_count=await db.scalar(
        select(func.count()).select_from(BusinessKnowledgeVersion).where(
            BusinessKnowledgeVersion.business_id==business_id,
            BusinessKnowledgeVersion.status=='published',
            BusinessKnowledgeVersion.public_allowed.is_(True),
        )
    )
    return {
        'business':record(business),
        'role':(await db.get(BusinessMember,(business_id,user.id))).role,
        'publications':publications,
        'stats':{
            'draftCount':int(draft_count or 0),
            'usableKnowledgeCount':int(knowledge_count or 0),
        },
    }
@router.patch('/{business_id}/settings')
async def settings(business_id:uuid.UUID,body:Settings,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    row=await svc.update_business_settings(
        db,business_id,user.id,
        name=body.name,description=body.description,
        logo_url=body.logoUrl,logo_specified='logoUrl' in body.model_fields_set,
    )
    return await recorded(db,row)
@router.post('/{business_id}/logo')
async def upload_logo(business_id:uuid.UUID,file:UploadFile=File(...),db=Depends(get_db),claims=Depends(get_current_user)):
    """Owner uploads a brand avatar through the existing profile-avatar store."""
    user=await svc.actor(db,claims)
    return await recorded(db,await svc.set_brand_logo(db,business_id,user.id,await file.read()))
@router.get('/{business_id}/members')
async def members(business_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    await manager(db,claims,business_id,'owner');return {'items':[record(row) for row in (await db.scalars(select(BusinessMember).where(BusinessMember.business_id==business_id))).all()]}
@router.put('/{business_id}/members')
async def member(business_id:uuid.UUID,body:Member,db=Depends(get_db),claims=Depends(get_current_user)):
    user,_=await manager(db,claims,business_id,'owner')
    row=await assign_member_role(db,business_id,user.id,body.userId,body.role)
    return await recorded(db,row)
def _asset_payload(body):
    return {'asset_type':body.assetType,'title':body.title,'caption':body.caption,'public_allowed':body.publicAllowed,'locator':body.locator,'latitude':body.latitude,'longitude':body.longitude,'revision':getattr(body,'revision',None)}
async def _read_image(upload:UploadFile):
    data=await upload.read(MAX_BRAND_LIBRARY_IMAGE_BYTES+1)
    if len(data)>MAX_BRAND_LIBRARY_IMAGE_BYTES: svc.fail('asset_file_too_large',400)
    return data
@router.get('/{business_id}/place-search')
async def place_search(business_id:uuid.UUID,q:str='',db=Depends(get_db),claims=Depends(get_current_user)):
    """Authenticated Nominatim proxy. Upstream host is fixed server-side (no SSRF)."""
    from backend.services.business_yansi import place_geocode as geocode
    user=await svc.actor(db,claims)
    await svc.access(db,business_id,user.id,'editor')
    hits=await geocode.search_places(q,user_id=str(user.id),business_id=str(business_id))
    return {'items':[hit.as_dict() for hit in hits],'attribution':geocode.search_attribution()}
@router.get('/{business_id}/assets')
async def brand_library(business_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    return {'items':await assets.list_assets(db,business_id,user.id)}
@router.post('/{business_id}/assets')
async def add_brand_asset(business_id:uuid.UUID,body:AssetWrite,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    row=await assets.create_asset(db,business_id,user.id,_asset_payload(body))
    return await _asset_view(db,business_id,row.id)
@router.post('/{business_id}/assets/image')
async def add_brand_image(business_id:uuid.UUID,file:UploadFile=File(...),title:str=Form(''),caption:str=Form(''),publicAllowed:str=Form('false'),db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    row=await assets.create_asset(db,business_id,user.id,{'asset_type':'image','title':title,'caption':caption,'public_allowed':publicAllowed.lower() in {'1','true','on','yes'}},image_bytes=await _read_image(file))
    return await _asset_view(db,business_id,row.id)
@router.post('/{business_id}/assets/video')
async def add_stored_video(business_id:uuid.UUID, request:Request, _upload_gate=Depends(admit_video_upload), db=Depends(get_db), claims=Depends(get_current_user)):
    """Store an uploaded H.264 MP4 only after authentication. The body is not a File() parameter."""
    from backend.services.business_yansi.video_ingest import ingest_upload
    from backend.services.business_yansi.video_storage import video_store_from_env
    from backend.services.business_yansi.video_upload_gate import read_upload_form
    form = await read_upload_form(request)
    try:
        upload = form.get('file')
        title = form.get('title')
        if title is None:
            title = ''
        caption = form.get('caption') or ''
        purpose = form.get('purpose')
        public = form.get('publicAllowed') or 'false'
        preparation = form.get('coverPreparation') or ''
        # Title may be empty (optional metadata); non-empty titles remain length-checked downstream.
        if not isinstance(upload, ParsedUploadFile) or not isinstance(title, str) or not isinstance(purpose, str) or not isinstance(caption, str):
            svc.fail('video_file_rejected', 422)
        if len(title.strip()) > 160:
            svc.fail('asset_title_rejected', 422)
        if not isinstance(preparation, str):
            svc.fail('video_file_rejected', 422)
        user=await svc.actor(db,claims)
        store=video_store_from_env()
        try:
            row=await ingest_upload(
                db, business_id, user.id, store=store, upload=upload, title=title, caption=caption,
                purpose=purpose, public_allowed=str(public).lower() in {'1','true','on','yes'},
                prepare_cover=preparation.strip().lower() != 'manual',
            )
        finally:
            await store.aclose()
        return await _asset_view(db, business_id, row.id)
    finally:
        await form.close()
@router.post('/{business_id}/assets/video-import')
async def import_stored_video(business_id:uuid.UUID,body:VideoImport,db=Depends(get_db),claims=Depends(get_current_user)):
    """Copy one HTTPS video into object storage, then create the asset."""
    from backend.services.business_yansi.video_ingest import ingest_url
    from backend.services.business_yansi.video_storage import video_store_from_env
    user=await svc.actor(db,claims)
    store=video_store_from_env()
    try:
        row=await ingest_url(db,business_id,user.id,store=store,url=body.url,title=body.title,caption=body.caption,purpose=body.purpose,public_allowed=body.publicAllowed)
    finally:
        await store.aclose()
    return await _asset_view(db,business_id,row.id)
@router.patch('/{business_id}/assets/{asset_id}')
async def edit_brand_asset(business_id:uuid.UUID,asset_id:uuid.UUID,body:AssetUpdate,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    row=await assets.update_asset(db,business_id,user.id,asset_id,_asset_payload(body))
    return await _asset_view(db,business_id,row.id)
@router.post('/{business_id}/assets/{asset_id}/image')
async def replace_brand_image(business_id:uuid.UUID,asset_id:uuid.UUID,file:UploadFile=File(...),title:str=Form(''),caption:str=Form(''),publicAllowed:str=Form('false'),revision:int=Form(...),db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    row=await assets.update_asset(db,business_id,user.id,asset_id,{'asset_type':'image','title':title,'caption':caption,'public_allowed':publicAllowed.lower() in {'1','true','on','yes'},'revision':revision},image_bytes=await _read_image(file))
    return await _asset_view(db,business_id,row.id)
@router.post('/{business_id}/assets/{asset_id}/links')
async def confirm_brand_asset_links(business_id:uuid.UUID,asset_id:uuid.UUID,body:AssetLinks,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    row=await assets.set_links(db,business_id,user.id,asset_id,body.knowledgeVersionIds,body.revision)
    return await _asset_view(db,business_id,row.id)
@router.get('/{business_id}/assets/{asset_id}/cover-job')
async def cover_job(business_id:uuid.UUID,asset_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    """Preparation status. No storage key and no playback URL."""
    from backend.services.business_yansi.cover_jobs import latest_for_asset, present_job
    user=await svc.actor(db,claims)
    await svc.access(db,business_id,user.id,'viewer')
    job=await latest_for_asset(db,business_id,asset_id)
    if job is None: svc.fail('cover_job_not_found',404)
    from backend.models.business_brand_assets import BusinessBrandAsset
    source=await db.get(BusinessBrandAsset,asset_id)
    scale=source.verified_timescale if source is not None and source.business_id==business_id else None
    return present_job(job, scale if type(scale) is int else None)
@router.get('/{business_id}/assets/{asset_id}/cover-jobs/{job_id}')
async def cover_job_by_id(business_id:uuid.UUID,asset_id:uuid.UUID,job_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    """One cover job. A newer window on the same video is a different row."""
    from backend.services.business_yansi.cover_jobs import job_for_source, present_job
    user=await svc.actor(db,claims)
    await svc.access(db,business_id,user.id,'viewer')
    job=await job_for_source(db,business_id,asset_id,job_id)
    if job is None: svc.fail('cover_job_not_found',404)
    from backend.models.business_brand_assets import BusinessBrandAsset
    source=await db.get(BusinessBrandAsset,asset_id)
    scale=source.verified_timescale if source is not None and source.business_id==business_id else None
    return present_job(job, scale if type(scale) is int else None)
@router.post('/{business_id}/assets/{asset_id}/cover-jobs/{job_id}/retry')
async def cover_job_retry(business_id:uuid.UUID,asset_id:uuid.UUID,job_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    from backend.services.business_yansi.cover_jobs import present_job, retry_cover
    user=await svc.actor(db,claims)
    job=await retry_cover(db,business_id,user.id,asset_id,job_id)
    from backend.models.business_brand_assets import BusinessBrandAsset
    source=await db.get(BusinessBrandAsset,asset_id)
    scale=source.verified_timescale if source is not None and source.business_id==business_id else None
    return present_job(job, scale if type(scale) is int else None)
@router.post('/{business_id}/assets/{asset_id}/cover-suggestions')
async def create_cover_suggestion(business_id:uuid.UUID,asset_id:uuid.UUID,body:CoverSuggestion,db=Depends(get_db),claims=Depends(get_current_user)):
    """Suggest intervals from the stored video. Confirmation is a separate cover-segment request."""
    from backend.services.business_yansi.brand_asset_library import _asset_row
    from backend.services.business_yansi.cover_video_suggestions import present_suggestion, source_matches, suggest_video_intervals
    user=await svc.actor(db,claims)
    row=await suggest_video_intervals(db,business_id,user.id,asset_id,body.idempotencyKey)
    try:
        asset=await _asset_row(db,business_id,asset_id)
        current=source_matches(row,asset)
    except Exception:
        current=False
    return present_suggestion(row,asset_id,source_current=current)
@router.get('/{business_id}/assets/{asset_id}/cover-suggestions/{proposal_id}')
async def cover_suggestion(business_id:uuid.UUID,asset_id:uuid.UUID,proposal_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    from backend.services.business_yansi.cover_video_suggestions import read_cover_suggestion
    user=await svc.actor(db,claims)
    return await read_cover_suggestion(db,business_id,user.id,asset_id,proposal_id)
@router.post('/{business_id}/drafts/{draft_id}/cover-image-suggestions')
async def create_cover_image_suggestion(business_id:uuid.UUID,draft_id:uuid.UUID,body:CoverImageSuggestion,db=Depends(get_db),claims=Depends(get_current_user)):
    """Generate a private AI cover-image proposal. Confirmation is a separate step."""
    from backend.services.business_yansi.cover_image_suggestions import current_draft_matches, present_image_suggestion, suggest_image_cover
    user=await svc.actor(db,claims)
    row=await suggest_image_cover(db,business_id,user.id,draft_id,body.idempotencyKey)
    current=await current_draft_matches(db,row,business_id,draft_id)
    return present_image_suggestion(row,draft_id,source_current=current)
@router.get('/{business_id}/drafts/{draft_id}/cover-image-suggestions/{proposal_id}')
async def cover_image_suggestion(business_id:uuid.UUID,draft_id:uuid.UUID,proposal_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    from backend.services.business_yansi.cover_image_suggestions import read_image_suggestion
    user=await svc.actor(db,claims)
    return await read_image_suggestion(db,business_id,user.id,draft_id,proposal_id)
@router.get('/{business_id}/drafts/{draft_id}/cover-image-suggestions/{proposal_id}/preview')
async def cover_image_suggestion_preview(business_id:uuid.UUID,draft_id:uuid.UUID,proposal_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    """Private preview bytes for the authorized business member. Not a public asset URL."""
    from backend.services.business_yansi.cover_image_suggestions import read_image_preview
    user=await svc.actor(db,claims)
    blob,mime=await read_image_preview(db,business_id,user.id,draft_id,proposal_id)
    return Response(content=blob,media_type=mime,headers={'Cache-Control':'private, no-store'})
@router.post('/{business_id}/drafts/{draft_id}/cover-image-suggestions/{proposal_id}/confirm')
async def confirm_cover_image_suggestion(business_id:uuid.UUID,draft_id:uuid.UUID,proposal_id:uuid.UUID,body:CoverImageConfirm,db=Depends(get_db),claims=Depends(get_current_user)):
    """Promote a private AI preview into the brand asset library. Does not publish the Yansı."""
    from backend.services.business_yansi.cover_image_suggestions import confirm_image_suggestion
    user=await svc.actor(db,claims)
    asset=await confirm_image_suggestion(
        db,business_id,user.id,draft_id,proposal_id,
        link_version_ids=body.knowledgeVersionIds or None,
    )
    return await _asset_view(db,business_id,asset.id)
@router.post('/{business_id}/assets/{asset_id}/cover-segment')
async def cover_segment(business_id:uuid.UUID,asset_id:uuid.UUID,body:CoverSegment,db=Depends(get_db),claims=Depends(get_current_user)):
    """Ask for a different cover window. The uploaded video stays intact."""
    from backend.services.business_yansi.cover_jobs import present_job, retarget_cover
    user=await svc.actor(db,claims)
    job=await retarget_cover(db,business_id,user.id,asset_id,body.startSeconds,body.endSeconds)
    from backend.models.business_brand_assets import BusinessBrandAsset
    source=await db.get(BusinessBrandAsset,asset_id)
    scale=source.verified_timescale if source is not None else None
    return present_job(job, scale if type(scale) is int else None)
@router.post('/{business_id}/assets/{asset_id}/cover-retry')
async def cover_retry(business_id:uuid.UUID,asset_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    """Try a failed cover again. This does not edit an approved Yansı."""
    from backend.services.business_yansi.cover_jobs import present_job, retry_cover
    user=await svc.actor(db,claims)
    job=await retry_cover(db,business_id,user.id,asset_id)
    from backend.models.business_brand_assets import BusinessBrandAsset
    source=await db.get(BusinessBrandAsset,asset_id)
    scale=source.verified_timescale if source is not None else None
    return present_job(job, scale if type(scale) is int else None)
@router.post('/{business_id}/assets/{asset_id}/video-stream')
async def brand_video_stream_ticket(business_id:uuid.UUID,asset_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    """Mint a short-lived ticket so <video> can issue native Range requests without a Bearer header."""
    from backend.services.business_yansi.library_media_ticket import mint_library_video_ticket
    from backend.services.business_yansi.video_preview import preview_video
    from backend.services.business_yansi.video_storage import video_store_from_env
    user=await svc.actor(db,claims)
    store=video_store_from_env()
    try:
        # Authorize membership and asset shape before issuing a ticket.
        await preview_video(db,business_id,user.id,asset_id,'bytes=0-0',store)
    finally:
        await store.aclose()
    minted=mint_library_video_ticket(user_id=user.id,business_id=business_id,asset_id=asset_id)
    path=f'/api/business-yansi/{business_id}/assets/{asset_id}/video?ticket={minted["ticket"]}'
    return {'streamPath':path,'expiresAt':minted['expiresAt'],'expiresIn':minted['expiresIn']}
@router.get('/{business_id}/assets/{asset_id}/video')
async def brand_video_preview(
    business_id:uuid.UUID,
    asset_id:uuid.UUID,
    request:Request,
    db=Depends(get_db),
    credentials:HTTPAuthorizationCredentials|None=Depends(security),
    ticket:str|None=Query(default=None),
):
    """Private byte range for a brand member. Bearer or short-lived ticket. No public R2 URL."""
    from backend.services.business_yansi.library_media_ticket import parse_library_video_ticket
    from backend.services.business_yansi.video_preview import preview_video
    from backend.services.business_yansi.video_storage import video_store_from_env
    if ticket:
        parsed=parse_library_video_ticket(ticket)
        if parsed['business_id']!=str(business_id) or parsed['asset_id']!=str(asset_id):
            raise HTTPException(401,detail={'code':'media_ticket_rejected'})
        claims={'user_id':parsed['user_id']}
    elif credentials is not None:
        user_info=get_user_from_token(credentials.credentials)
        if user_info is None:
            raise HTTPException(401,detail='Invalid or expired token')
        claims=user_info
    else:
        raise HTTPException(401,detail='Authentication required')
    user=await svc.actor(db,claims)
    store=video_store_from_env()
    try:
        payload=await preview_video(db,business_id,user.id,asset_id,request.headers.get('range'),store)
    finally:
        await store.aclose()
    return Response(content=payload['body'],status_code=payload['status'],media_type='video/mp4',headers=payload['headers'])
@router.post('/{business_id}/assets/{asset_id}/archive')
async def archive_brand_asset(business_id:uuid.UUID,asset_id:uuid.UUID,body:AssetArchive,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    row=await assets.archive_asset(db,business_id,user.id,asset_id,body.revision)
    return await _asset_view(db,business_id,row.id)
@router.delete('/{business_id}/assets/{asset_id}')
async def delete_brand_asset(business_id:uuid.UUID,asset_id:uuid.UUID,body:AssetDelete,db=Depends(get_db),claims=Depends(get_current_user)):
    """Permanently delete one unused library asset. Referenced Yansı media returns 409."""
    user=await svc.actor(db,claims)
    return await assets.delete_asset(db,business_id,user.id,asset_id,body.revision)
@router.get('/{business_id}/assets/{asset_id}/content')
async def brand_asset_content(
    business_id:uuid.UUID,
    asset_id:uuid.UUID,
    db=Depends(get_db),
    claims=Depends(get_current_user),
    variant:Literal['original','thumb']=Query(default='original'),
):
    """Original image bytes, image card thumb, or video card poster. Asset IDs unchanged."""
    user=await svc.actor(db,claims)
    if variant=='thumb':
        data,mime=await assets.stored_card_media_thumbnail(db,business_id,user.id,asset_id)
    else:
        data,mime=await assets.stored_preview(db,business_id,user.id,asset_id)
    return Response(content=data,media_type=mime,headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
async def _asset_view(db,business_id,asset_id):
    """Management payload by id. Includes cover derivatives hidden from library lists."""
    return await assets.present_asset_by_id(db,business_id,asset_id)
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
@router.get('/{business_id}/drafts/{draft_id}/media-preview')
async def draft_media_preview(
    business_id: uuid.UUID, draft_id: uuid.UUID, revision: int,
    db=Depends(get_db), claims=Depends(get_current_user),
):
    from backend.services.business_yansi.studio_media import draft_preview_media

    await manager(db, claims, business_id)
    row = (await db.execute(select(
        BusinessYansiDraft.revision, BusinessYansiDraft.steps, BusinessYansiDraft.media_plan,
    ).where(
        BusinessYansiDraft.business_id == business_id, BusinessYansiDraft.id == draft_id,
    ))).one_or_none()
    if row is None:
        raise HTTPException(404, detail={'code': 'draft_not_found'})
    if row.revision != revision:
        raise HTTPException(409, detail={'code': 'draft_revision_conflict'})
    blocks = await draft_preview_media(db, business_id, row.steps, row.media_plan)
    return JSONResponse(
        {'revision': row.revision, 'steps': row.steps, 'blocks': blocks,
         'hasAssignments': any((row.media_plan or {}).get('blocks') or [])},
        headers={'Cache-Control': 'private, no-store'},
    )
@router.post('/{business_id}/drafts')
async def add_draft(business_id:uuid.UUID,body:DraftCreate,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims);return await recorded(db,await svc.create_draft(db,business_id,user.id,body.title,body.summary,[s.model_dump(mode='json') for s in body.steps],cover_asset_id=body.coverAssetId,cover_kind=body.coverKind))
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
    profile=await db.scalar(select(BusinessProfile).where(BusinessProfile.slug==slug,BusinessProfile.status=='active'))
    if not profile:svc.fail('business_not_found',404)
    from backend.models.production import Organization
    organization=await db.get(Organization,profile.id)
    if not organization or organization.status!='active':svc.fail('business_not_found',404)
    return publisher(profile)

@router.patch('/{business_id}/drafts/{draft_id}')
async def edit_draft(business_id:uuid.UUID,draft_id:uuid.UUID,body:DraftUpdate,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    return await recorded(db,await svc.revise_draft(db,business_id,user.id,draft_id,body.revision,body.title,body.summary,[s.model_dump(mode='json') for s in body.steps],body.coverAssetId,cover_specified='coverAssetId' in body.model_fields_set,cover_kind=body.coverKind if 'coverKind' in body.model_fields_set else None,cover_kind_specified='coverKind' in body.model_fields_set))

@router.delete('/{business_id}/members/{user_id}')
async def remove_member(business_id:uuid.UUID,user_id:uuid.UUID,db=Depends(get_db),claims=Depends(get_current_user)):
    user=await svc.actor(db,claims)
    await remove_business_member(db,business_id,user.id,user_id)
    return {'ok':True}

@router.get('/public-media/{business_id}/{asset_id}')
async def public_brand_media(business_id:uuid.UUID,asset_id:uuid.UUID,db=Depends(get_db)):
    from backend.services.business_yansi.studio_media import live_public_asset
    asset = await live_public_asset(db, business_id, asset_id)
    if asset is None or asset.asset_type != 'image':
        raise HTTPException(404, 'not_found')
    body, mime = assets.read_stored_image(business_id, asset.locator)
    return Response(content=body, media_type=mime, headers={'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store'})

@router.post('/{business_id}/preview-answer')
async def preview_answer(business_id:uuid.UUID,body:Question,db=Depends(get_db),claims=Depends(get_current_user),credentials=Depends(security)):
    await manager(db,claims,business_id,'editor')
    from sqlalchemy.ext.asyncio import AsyncSession
    from backend.services.business_yansi.answers import BusinessHistory,answer
    from backend.services.business_yansi.studio_media import answer_media
    result = await answer(body.question,BusinessHistory([],business_id,[]),db=db)
    if isinstance(db, AsyncSession):
        shown = await answer_media(db, business_id, result.get('assistant_answer') or '', result.get('sources') or [])
        if shown:
            result['business_media'] = shown
    return result


# Child routes inherit the Business feature gate; existing endpoints are unchanged.
from backend.routers.business_studio import router as studio_router
router.include_router(studio_router)
