"""Tenant-scoped Business management. No private conversation read endpoints."""
import hashlib
import json
import re
import uuid
from fastapi import HTTPException
from sqlalchemy import select, func
from backend.models.production import User, Organization
from backend.models.business_yansi import BusinessProfile, BusinessMember, BusinessKnowledgeVersion as Knowledge, BusinessYansiDraft as Draft, BusinessPublication

ROLES = {'owner': 3, 'editor': 2, 'viewer': 1}
TRANSITIONS = {'draft': {'review'}, 'review': {'draft', 'approved'}, 'approved': {'draft', 'published'}, 'published': {'archived'}, 'archived': set()}
def fail(code, status=403):
    raise HTTPException(status, detail={'code': code})
def uid(value):
    try: return uuid.UUID(str(value))
    except (ValueError, TypeError): fail('invalid_id', 422)
def public_content(*values):
    from backend.services.mirror.journey_step_sanitization import _flags_for_text
    if any(_flags_for_text(v) or re.search(r'<(?:script|iframe|object)\b|javascript:', v, re.I) for v in values):
        fail('public_content_review_required',422)

def source_hash(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

async def actor(db, claims):
    row = await db.get(User, uid(claims.get('user_id') or claims.get('sub')))
    if not row or not row.is_active: fail('inactive_account', 401)
    return row
async def platform_admin(db, claims):
    """BiligN platform admin — capability bilign.platform_admin only (not EZA role=admin)."""
    from backend.services import user_capabilities as caps

    row = await actor(db, claims)
    if not await caps.has_capability(db, row.id, caps.BILIGN_PLATFORM_ADMIN):
        fail('platform_admin_required')
    return row

async def can_provision(db, user) -> bool:
    from backend.services import user_capabilities as caps

    return await caps.has_capability(db, user.id, caps.BILIGN_PLATFORM_ADMIN)
async def access(db, business_id, user_id, minimum='viewer'):
    business = await db.get(BusinessProfile, uid(business_id))
    membership = await db.get(BusinessMember, (uid(business_id), uid(user_id)))
    # Corporate membership/admin role never confers Business membership.
    organization = await db.get(Organization, uid(business_id))
    if not business or not organization or organization.status != 'active' or business.status != 'active': fail('business_not_found', 404)
    if not membership or ROLES.get(membership.role, 0) < ROLES[minimum]: fail('business_access_denied')
    return business

async def create_business(db, admin, data):
    org = await db.get(Organization, uid(data['organizationId']))
    owner = await db.get(User, uid(data['ownerId']))
    if not org or org.status != 'active' or not owner or not owner.is_active: fail('invalid_organization_or_owner', 422)
    if await db.get(BusinessProfile, org.id): fail('business_already_exists', 409)
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', data['slug']): fail('invalid_slug', 422)
    if await db.scalar(select(BusinessProfile.id).where(BusinessProfile.slug == data['slug'])): fail('slug_taken', 409)
    business = BusinessProfile(id=org.id, owner_id=owner.id, slug=data['slug'], name=data['name'], description=data.get('description',''), logo_url=data.get('logoUrl'), verified=False, official=False)
    db.add(business); await db.flush()
    db.add(BusinessMember(business_id=org.id, user_id=owner.id, role='owner'))
    await db.commit(); await db.refresh(business); return business

async def list_knowledge(db, business_id):
    return list((await db.scalars(select(Knowledge).where(Knowledge.business_id == uid(business_id)).order_by(Knowledge.created_at.desc()))).all())

async def create_knowledge(db, business_id, user_id, data):
    await access(db,business_id,user_id,'editor')
    item_id=uid(data['itemId']) if data.get('itemId') else uuid.uuid4()
    # Lock tenant row to serialize new versions including the first version.
    await db.scalar(select(BusinessProfile).where(BusinessProfile.id==uid(business_id)).with_for_update())
    previous=await db.scalar(select(func.max(Knowledge.version)).where(Knowledge.business_id==uid(business_id),Knowledge.item_id==item_id))
    row=Knowledge(business_id=uid(business_id),item_id=item_id,version=(previous or 0)+1,title=data['title'],category=data.get('category',''),content=data['content'],source=data['source'],public_allowed=data.get('publicAllowed',False),created_by=uid(user_id),status='draft',revision=1)
    db.add(row);await db.commit();await db.refresh(row);return row

async def transition_knowledge(db,business_id,user_id,version_id,target,revision):
    await access(db,business_id,user_id,'owner' if target in {'approved','published','archived'} else 'editor')
    await db.scalar(select(BusinessProfile).where(BusinessProfile.id==uid(business_id)).with_for_update())
    row=await db.scalar(select(Knowledge).where(Knowledge.id==uid(version_id),Knowledge.business_id==uid(business_id)).with_for_update())
    if not row: fail('knowledge_not_found',404)
    if row.revision!=revision: fail('revision_conflict',409)
    if target not in TRANSITIONS.get(row.status,set()): fail('invalid_transition',409)
    if target=='published':
        if not row.public_allowed or not row.approved_by: fail('public_approval_required',422)
        from backend.services.mirror.journey_step_sanitization import _flags_for_text
        public_content(row.title,row.category,row.content,row.source)
        others=(await db.scalars(select(Knowledge).where(Knowledge.business_id==row.business_id,Knowledge.item_id==row.item_id,Knowledge.status=='published').with_for_update())).all()
        for other in others: other.status='archived';other.revision+=1
    row.status=target;row.revision+=1
    row.approved_by=uid(user_id) if target=='approved' else None if target=='draft' else row.approved_by
    await db.commit();await db.refresh(row);return row

async def published_knowledge(db,business_id,snapshot=None,*,fresh=False):
    query=select(Knowledge).where(Knowledge.business_id==uid(business_id),Knowledge.status=='published',Knowledge.public_allowed.is_(True),Knowledge.approved_by.is_not(None))
    if snapshot is not None: query=query.where(Knowledge.id.in_([uid(v) for v in snapshot]))
    return list((await db.scalars(query.order_by(Knowledge.id).execution_options(populate_existing=fresh))).all())

def rank_sources(question,rows,limit=4):
    words=set(re.findall(r'[^\W_]{3,}', question.casefold(), re.UNICODE))
    ranked=[]
    for row in rows:
        terms=set(re.findall(r'[^\W_]{3,}', (row.title+' '+row.category+' '+row.content).casefold(), re.UNICODE))
        score=len(words & terms)
        if score: ranked.append((score,str(row.id),row))
    return [row for _,_,row in sorted(ranked,key=lambda r:(-r[0],r[1]))[:limit]]

async def create_draft(db,business_id,user_id,title,summary,steps,*,commit=True):
    await access(db,business_id,user_id,'editor')
    public_content(title,summary,*(s['question'] for s in steps),*(s['answer'] for s in steps))
    if len(steps)!=8: fail('eight_steps_required',422)
    rows=await published_knowledge(db,business_id);allowed={str(row.id):row for row in rows}
    for step in steps:
        if not step['sources'] or any(v not in allowed for v in step['sources']): fail('published_sources_required',422)
        # Phase 1 accepts only source-exact answers; no unsupported brand claims.
        if not any(step['answer'] in allowed[v].content for v in step['sources']): fail('answer_not_supported_by_source',422)
    snapshot=sorted({v for step in steps for v in step['sources']})
    row=Draft(business_id=uid(business_id),created_by=uid(user_id),title=title,summary=summary,steps=steps,knowledge_snapshot=snapshot,source_hash=source_hash(steps),status='draft',revision=1)
    db.add(row)
    if commit: await db.commit();await db.refresh(row)
    else: await db.flush()
    return row

async def draft_row(db,business_id,draft_id,lock=False):
    query=select(Draft).where(Draft.id==uid(draft_id),Draft.business_id==uid(business_id))
    row=await db.scalar(query.with_for_update() if lock else query)
    if not row: fail('draft_not_found',404)
    return row

async def transition_draft(db,business_id,user_id,draft_id,target,revision):
    await access(db,business_id,user_id,'owner' if target=='approved' else 'editor')
    row=await draft_row(db,business_id,draft_id,True)
    if row.revision!=revision: fail('revision_conflict',409)
    if target not in TRANSITIONS.get(row.status,set()) or target=='published': fail('invalid_transition',409)
    if target=='approved':
        if len(await published_knowledge(db,business_id,row.knowledge_snapshot))!=len(row.knowledge_snapshot): fail('source_snapshot_unavailable',409)
        row.approved_by=uid(user_id)
    elif target=='draft': row.approved_by=None
    row.status=target;row.revision+=1;await db.commit();await db.refresh(row);return row

async def revise_draft(db,business_id,user_id,draft_id,revision,title,summary,steps):
    await access(db,business_id,user_id,'editor')
    row=await draft_row(db,business_id,draft_id,True)
    if row.revision!=revision or row.status!='draft' or row.conversation_id:
        fail('editable_draft_required',409)
    public_content(title,summary,*(s['question'] for s in steps),*(s['answer'] for s in steps))
    allowed={str(v.id):v for v in await published_knowledge(db,business_id)}
    if len(steps)!=8: fail('eight_steps_required',422)
    for step in steps:
        if not step['sources'] or any(v not in allowed for v in step['sources']): fail('published_sources_required',422)
        if not any(step['answer'] in allowed[v].content for v in step['sources']): fail('answer_not_supported_by_source',422)
    row.title=title;row.summary=summary;row.steps=steps
    row.knowledge_snapshot=sorted({v for step in steps for v in step['sources']})
    row.source_hash=source_hash(steps);row.revision+=1
    await db.commit();await db.refresh(row);return row
