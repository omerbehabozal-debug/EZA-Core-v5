"""Tenant-scoped Business management. No private conversation read endpoints."""
import hashlib
import json
import re
import uuid
from dataclasses import dataclass
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
    # no_autoflush: auth precheck must not persist unrelated pending ORM rows
    # (e.g. dirty Draft/Knowledge titles) before the writer takes its locks.
    with db.no_autoflush:
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

async def set_brand_logo(db, business_id, user_id, image_bytes: bytes):
    """Store a brand avatar with the existing profile-avatar pipeline. Owner only."""
    from backend.services.profile_avatar_store import MAX_PROFILE_AVATAR_BYTES, save_profile_avatar_bytes

    business = await access(db, business_id, user_id, 'owner')
    if not image_bytes:
        fail('avatar_empty', 400)
    if len(image_bytes) > MAX_PROFILE_AVATAR_BYTES:
        fail('avatar_too_large', 400)
    try:
        public_url, _, _ = save_profile_avatar_bytes(image_bytes, str(business.id))
    except ValueError as exc:
        fail(str(exc), 400)
    business.logo_url = public_url
    await db.commit()
    await db.refresh(business)
    return business

async def list_knowledge(db, business_id):
    return list((await db.scalars(select(Knowledge).where(Knowledge.business_id == uid(business_id)).order_by(Knowledge.created_at.desc()))).all())

async def _sync_knowledge_index(db, versions):
    """Queue derived chunks after the source row is saved. No embedding call here."""
    from backend.services.business_yansi import rag
    await rag.on_versions_changed(db, versions)

async def create_knowledge(db, business_id, user_id, data):
    """Save knowledge into the brand pool.

    Product rule: Bilgi Havuzu is brand record-keeping, not a publish workflow.
    A save creates a new version that is immediately usable by Studio / answer
    ranking when public_allowed is true. Older published versions of the same
    item are archived for integrity. public_allowed=false never enters
    published_knowledge / end-user grounding.
    """
    await access(db,business_id,user_id,'editor')
    item_id=uid(data['itemId']) if data.get('itemId') else uuid.uuid4()
    public_allowed=bool(data.get('publicAllowed', False))
    title=data['title']; category=data.get('category',''); content=data['content']; source=data['source']
    if public_allowed:
        public_content(title, category, content, source)
    from backend.services.business_yansi.video_authority import require_locked_actor
    # Lock tenant row to serialize new versions including the first version.
    await _lock_business_row(db, business_id)
    await require_locked_actor(db, business_id, user_id, "editor")
    with db.no_autoflush:
        previous=await db.scalar(select(func.max(Knowledge.version)).where(Knowledge.business_id==uid(business_id),Knowledge.item_id==item_id))
        others=(await db.scalars(select(Knowledge).where(Knowledge.business_id==uid(business_id),Knowledge.item_id==item_id,Knowledge.status=='published').with_for_update())).all()
    for other in others:
        other.status='archived'
        other.revision+=1
    row=Knowledge(
        business_id=uid(business_id),
        item_id=item_id,
        version=(previous or 0)+1,
        title=title,
        category=category,
        content=content,
        source=source,
        public_allowed=public_allowed,
        created_by=uid(user_id),
        approved_by=uid(user_id),
        status='published',
        revision=1,
    )
    db.add(row)
    affected = [*others, row]
    await db.commit(); await db.refresh(row)
    await _sync_knowledge_index(db, affected)
    await db.refresh(row)
    return row

async def transition_knowledge(db,business_id,user_id,version_id,target,revision):
    minimum = 'owner' if target in {'approved','published','archived'} else 'editor'
    await access(db,business_id,user_id,minimum)
    from backend.services.business_yansi.video_authority import require_locked_actor
    await _lock_business_row(db, business_id)
    await require_locked_actor(db, business_id, user_id, minimum)
    parked = {}
    row = None
    others = []
    try:
        with db.no_autoflush:
            snap = await _knowledge_writer_snapshot(db, business_id, version_id, lock=True)
            if snap.revision != revision:
                fail("revision_conflict", 409)
            if target not in TRANSITIONS.get(snap.status, set()):
                fail("invalid_transition", 409)
            row = await db.get(Knowledge, snap.id)
            if row is None:
                fail("knowledge_not_found", 404)
            if target == "published":
                if not snap.public_allowed or not snap.approved_by:
                    fail("public_approval_required", 422)
                from backend.services.mirror.journey_step_sanitization import _flags_for_text  # noqa: F401
                public_content(snap.title, snap.category, snap.content, snap.source)
                others = (
                    await db.scalars(
                        select(Knowledge)
                        .where(
                            Knowledge.business_id == snap.business_id,
                            Knowledge.item_id == snap.item_id,
                            Knowledge.status == "published",
                        )
                        .with_for_update()
                    )
                ).all()
                for other in others:
                    other.status = "archived"
                    other.revision += 1
            # Park dirty content so commit only writes intentional lifecycle fields from snap.
            parked = park_dirty_knowledge_content(row, snap)
            row.status = target
            row.revision = snap.revision + 1
            row.approved_by = (
                uid(user_id) if target == "approved" else None if target == "draft" else snap.approved_by
            )
        await db.commit()
    except Exception:
        # Restore before any refresh/expire so failed writes keep caller pending state.
        if parked and row is not None:
            restore_dirty_knowledge_content(row, parked)
        raise
    # Refresh/index may expire the instance — always restore after the last touch,
    # including when indexing fails (commit already succeeded; session may still need caller rollback).
    try:
        await db.refresh(row)
        await _sync_knowledge_index(db, [*others, row])
        await db.refresh(row)
    finally:
        if parked:
            restore_dirty_knowledge_content(row, parked)
    return row

async def delete_knowledge(db, business_id, user_id, version_id, revision):
    """Soft-delete one knowledge version by id (archive). Other titles/items untouched."""
    await access(db, business_id, user_id, 'editor')
    from backend.services.business_yansi.video_authority import require_locked_actor
    await _lock_business_row(db, business_id)
    await require_locked_actor(db, business_id, user_id, "editor")
    parked = {}
    row = None
    already_archived = False
    try:
        with db.no_autoflush:
            snap = await _knowledge_writer_snapshot(db, business_id, version_id, lock=True)
            if snap.revision != revision:
                fail("revision_conflict", 409)
            row = await db.get(Knowledge, snap.id)
            if row is None:
                fail("knowledge_not_found", 404)
            already_archived = snap.status == "archived"
            if not already_archived:
                parked = park_dirty_knowledge_content(row, snap)
                row.status = "archived"
                row.revision = snap.revision + 1
        if already_archived:
            # Capture pending content across index sync / refresh without persisting it.
            parked = park_dirty_knowledge_content(row, snap)
            try:
                await _sync_knowledge_index(db, [row])
                await db.refresh(row)
            finally:
                if parked:
                    restore_dirty_knowledge_content(row, parked)
            return row
        await db.commit()
    except Exception:
        if parked and row is not None:
            restore_dirty_knowledge_content(row, parked)
        raise
    try:
        await db.refresh(row)
        await _sync_knowledge_index(db, [row])
        await db.refresh(row)
    finally:
        if parked:
            restore_dirty_knowledge_content(row, parked)
    return row

async def published_knowledge(db,business_id,snapshot=None,*,fresh=False):
    query=select(Knowledge).where(Knowledge.business_id==uid(business_id),Knowledge.status=='published',Knowledge.public_allowed.is_(True),Knowledge.approved_by.is_not(None))
    if snapshot is not None: query=query.where(Knowledge.id.in_([uid(v) for v in snapshot]))
    query=query.order_by(Knowledge.id).execution_options(populate_existing=fresh)
    if not fresh:
        return list((await db.scalars(query)).all())
    with db.no_autoflush:
        return list((await db.scalars(query)).all())

def rank_sources(question,rows,limit=4):
    words=set(re.findall(r'[^\W_]{3,}', question.casefold(), re.UNICODE))
    ranked=[]
    for row in rows:
        terms=set(re.findall(r'[^\W_]{3,}', (row.title+' '+row.category+' '+row.content).casefold(), re.UNICODE))
        score=len(words & terms)
        if score: ranked.append((score,str(row.id),row))
    return [row for _,_,row in sorted(ranked,key=lambda r:(-r[0],r[1]))[:limit]]

def _qa_steps(steps):
    clean=[]
    for step in steps:
        if set(step)-{'question','answer','sources'}: fail('asset_choice_rejected',422)
        clean.append({'question':step['question'],'answer':step['answer'],'sources':list(step['sources'])})
    return clean

@dataclass(frozen=True, slots=True)
class DraftDecisionSnapshot:
    """Authoritative Draft columns for writer decisions.

    Built from a projected SELECT under ``no_autoflush``. Never written back onto
    identity-map instances via ``populate_existing`` / ``set_committed_value``.
    Pending dirty ORM attributes and SQLAlchemy history stay on the instance.
    Policy A: decisions use this snapshot; caller-owned dirty Draft state is preserved.
    """

    id: object
    business_id: object
    revision: int
    status: str
    conversation_id: object
    media_plan: object
    steps: object
    knowledge_snapshot: object
    approved_by: object
    created_by: object
    title: str
    summary: object
    source_hash: str


@dataclass(frozen=True, slots=True)
class KnowledgeWriterSnapshot:
    """Authoritative Knowledge columns for transition/delete decisions."""

    id: object
    business_id: object
    item_id: object
    revision: int
    status: str
    public_allowed: bool
    approved_by: object
    title: str
    category: object
    content: str
    source: str


# Content columns that a status/revision writer must not flush from pending local edits.
_DRAFT_CONTENT_ATTRS = (
    "title",
    "summary",
    "steps",
    "knowledge_snapshot",
    "media_plan",
    "source_hash",
    "approved_by",
    "conversation_id",
    "created_by",
)

# Fields that participate in review/approval freeze decisions. Pending local edits make
# "validated snapshot vs committed ORM row" ambiguous — reject rather than park/approve.
_DRAFT_FREEZE_CONTENT_ATTRS = (
    "title",
    "summary",
    "steps",
    "knowledge_snapshot",
    "source_hash",
    "media_plan",
    "created_by",
    "conversation_id",
)

_KNOWLEDGE_CONTENT_ATTRS = (
    "title",
    "category",
    "content",
    "source",
    "public_allowed",
    "approved_by",
    "item_id",
)


def assert_no_pending_draft_freeze_content(draft) -> None:
    """Reject review/approval when the session holds pending freeze-relevant Draft edits.

    Preferred policy for Implementation 2B-1B: do not approve or advance to review while
    caller-owned content/provenance differs from the locked DB snapshot used for
    validation. Preserves dirty state and history; does not persist unverified content.
    """
    from sqlalchemy.orm.attributes import get_history

    for name in _DRAFT_FREEZE_CONTENT_ATTRS:
        if get_history(draft, name).has_changes():
            fail("revision_conflict", 409)


def park_dirty_draft_content(draft, snap: DraftDecisionSnapshot) -> dict:
    """Align dirty content attrs with the locked DB snapshot before a status write.

    Policy A: decisions already used ``snap``. Pending caller values are parked so
    ``commit`` cannot publish them, then restored onto the identity-map instance.
    Uses ``set_committed_value`` only for this write-path park — never as a lock-read
    writeback into the identity map for decisions.
    """
    from sqlalchemy.orm.attributes import get_history, set_committed_value

    values = {
        "title": snap.title,
        "summary": snap.summary,
        "steps": snap.steps,
        "knowledge_snapshot": snap.knowledge_snapshot,
        "media_plan": snap.media_plan,
        "source_hash": snap.source_hash,
        "approved_by": snap.approved_by,
        "conversation_id": snap.conversation_id,
        "created_by": snap.created_by,
    }
    parked = {}
    for name in _DRAFT_CONTENT_ATTRS:
        if get_history(draft, name).has_changes():
            parked[name] = getattr(draft, name)
            set_committed_value(draft, name, values[name])
    return parked


def restore_dirty_draft_content(draft, parked: dict) -> None:
    """Re-apply parked caller-owned Draft content after commit."""
    for name, value in parked.items():
        setattr(draft, name, value)


def park_dirty_knowledge_content(row, snap: KnowledgeWriterSnapshot) -> dict:
    """Park dirty Knowledge content so a status/revision commit cannot publish it."""
    from sqlalchemy.orm.attributes import get_history, set_committed_value

    values = {
        "title": snap.title,
        "category": snap.category,
        "content": snap.content,
        "source": snap.source,
        "public_allowed": snap.public_allowed,
        "approved_by": snap.approved_by,
        "item_id": snap.item_id,
    }
    parked = {}
    for name in _KNOWLEDGE_CONTENT_ATTRS:
        if get_history(row, name).has_changes():
            parked[name] = getattr(row, name)
            set_committed_value(row, name, values[name])
    return parked


def restore_dirty_knowledge_content(row, parked: dict) -> None:
    for name, value in parked.items():
        setattr(row, name, value)


async def _lock_business_row(db, business_id) -> None:
    """Acquire the Business FOR UPDATE lock without autoflush or ORM refresh."""
    with db.no_autoflush:
        locked = await db.execute(
            select(BusinessProfile.id)
            .where(BusinessProfile.id == uid(business_id))
            .with_for_update()
        )
        if locked.scalar_one_or_none() is None:
            fail("business_not_found", 404)


def _assert_supported_steps(steps, allowed):
    for step in steps:
        if not step['sources'] or any(v not in allowed for v in step['sources']): fail('published_sources_required',422)
        # Phase 1 accepts only source-exact answers; no unsupported brand claims.
        if not any(step['answer'] in allowed[v].content for v in step['sources']): fail('answer_not_supported_by_source',422)

async def create_draft(db,business_id,user_id,title,summary,steps,*,commit=True,media_choices=None,cover_asset_id=None):
    await access(db,business_id,user_id,'editor')
    public_content(title,summary,*(s['question'] for s in steps),*(s['answer'] for s in steps))
    if len(steps)!=8: fail('eight_steps_required',422)
    steps=_qa_steps(steps)
    # Phase 7G-4c.3A remediations: Business lock, re-auth, fresh knowledge, one select+persist.
    from backend.services.business_yansi.studio_media import bind_media_plan, business_media_lock
    from backend.services.business_yansi.video_authority import require_locked_access
    async with business_media_lock(db, business_id):
        await require_locked_access(db, business_id, user_id, 'editor')
        allowed={str(row.id):row for row in await published_knowledge(db,business_id,fresh=True)}
        _assert_supported_steps(steps, allowed)
        plan=await bind_media_plan(db,business_id,title,summary,steps,media_choices,cover_asset_id)
        snapshot=sorted({v for step in steps for v in step['sources']})
        row=Draft(business_id=uid(business_id),created_by=uid(user_id),title=title,summary=summary,steps=steps,knowledge_snapshot=snapshot,media_plan=plan,source_hash=source_hash(steps),status='draft',revision=1)
        db.add(row)
        if commit: await db.commit();await db.refresh(row)
        else: await db.flush()
        return row

async def draft_decision(db, business_id, draft_id, *, lock: bool = False) -> DraftDecisionSnapshot:
    """Read Draft decision columns from the database without mutating the identity map."""
    criteria = (Draft.id == uid(draft_id), Draft.business_id == uid(business_id))
    query = select(
        Draft.id,
        Draft.business_id,
        Draft.revision,
        Draft.status,
        Draft.conversation_id,
        Draft.media_plan,
        Draft.steps,
        Draft.knowledge_snapshot,
        Draft.approved_by,
        Draft.created_by,
        Draft.title,
        Draft.summary,
        Draft.source_hash,
    ).where(*criteria)
    if lock:
        query = query.with_for_update()
    with db.no_autoflush:
        current = await db.execute(query)
        locked = current.one_or_none()
    if locked is None:
        fail("draft_not_found", 404)
    return DraftDecisionSnapshot(
        id=locked.id,
        business_id=locked.business_id,
        revision=int(locked.revision),
        status=str(locked.status),
        conversation_id=locked.conversation_id,
        media_plan=locked.media_plan,
        steps=locked.steps,
        knowledge_snapshot=locked.knowledge_snapshot,
        approved_by=locked.approved_by,
        created_by=locked.created_by,
        title=str(locked.title),
        summary=locked.summary,
        source_hash=str(locked.source_hash),
    )

async def draft_row(db,business_id,draft_id,lock=False):
    """Return the Draft ORM instance. Locked path uses a decision snapshot, not refresh."""
    if not lock:
        row=await db.scalar(select(Draft).where(Draft.id==uid(draft_id),Draft.business_id==uid(business_id)))
        if not row: fail('draft_not_found',404)
        return row
    snap = await draft_decision(db, business_id, draft_id, lock=True)
    row = await db.get(Draft, snap.id)
    if row is None:
        fail("draft_not_found", 404)
    return row

async def _knowledge_writer_snapshot(db, business_id, version_id, *, lock: bool = True) -> KnowledgeWriterSnapshot:
    """Authoritative Knowledge row for transition/delete. Does not trust the identity map."""
    query = select(
        Knowledge.id,
        Knowledge.business_id,
        Knowledge.item_id,
        Knowledge.revision,
        Knowledge.status,
        Knowledge.public_allowed,
        Knowledge.approved_by,
        Knowledge.title,
        Knowledge.category,
        Knowledge.content,
        Knowledge.source,
    ).where(Knowledge.id == uid(version_id), Knowledge.business_id == uid(business_id))
    if lock:
        query = query.with_for_update()
    with db.no_autoflush:
        current = await db.execute(query)
        locked = current.one_or_none()
    if locked is None:
        fail("knowledge_not_found", 404)
    return KnowledgeWriterSnapshot(
        id=locked.id,
        business_id=locked.business_id,
        item_id=locked.item_id,
        revision=int(locked.revision),
        status=str(locked.status),
        public_allowed=bool(locked.public_allowed),
        approved_by=locked.approved_by,
        title=str(locked.title),
        category=locked.category,
        content=str(locked.content),
        source=str(locked.source),
    )

async def transition_draft(db,business_id,user_id,draft_id,target,revision):
    role='owner' if target=='approved' else 'editor'
    await access(db,business_id,user_id,role)
    from backend.services.business_yansi.studio_media import business_media_lock
    from backend.services.business_yansi.video_authority import require_locked_access
    async with business_media_lock(db,business_id):
        await require_locked_access(db,business_id,user_id,role)
        parked = {}
        with db.no_autoflush:
            snap = await draft_decision(db, business_id, draft_id, lock=True)
            if snap.revision != revision:
                fail("revision_conflict", 409)
            if target not in TRANSITIONS.get(snap.status, set()) or target == "published":
                fail("invalid_transition", 409)
            row = await db.get(Draft, snap.id)
            if row is None:
                fail("draft_not_found", 404)
            # Review/approval freeze: reject pending content/provenance so commit cannot
            # persist unverified ORM edits that differ from the validated snapshot.
            if target in {"review", "approved"}:
                assert_no_pending_draft_freeze_content(row)
            if target in {"review", "approved"} and snap.media_plan is not None:
                from backend.services.business_yansi.studio_media import assert_live_plan
                await assert_live_plan(db, business_id, snap.steps, snap.media_plan)
            if target == "approved":
                if len(await published_knowledge(db, business_id, snap.knowledge_snapshot, fresh=True)) != len(snap.knowledge_snapshot):
                    fail("source_snapshot_unavailable", 409)
                if snap.media_plan is not None:
                    from backend.services.business_yansi.studio_media import media_seal
                    plan = {
                        "coverAssetId": snap.media_plan.get("coverAssetId"),
                        "blocks": snap.media_plan.get("blocks") or [],
                        "seal": None,
                    }
                    plan["seal"] = media_seal(plan)
                    row.media_plan = plan
                row.approved_by = uid(user_id)
            elif target == "draft":
                # Unapprove: park pending content so commit only writes lifecycle fields.
                parked = park_dirty_draft_content(row, snap)
                row.approved_by = None
                if isinstance(snap.media_plan, dict):
                    plan = {
                        "coverAssetId": snap.media_plan.get("coverAssetId"),
                        "blocks": snap.media_plan.get("blocks") or [],
                        "seal": None,
                    }
                    if snap.media_plan.get("coverMode") == "automatic" and not snap.media_plan.get("seal"):
                        plan["coverMode"] = "automatic"
                    row.media_plan = plan
            row.status = target
            row.revision = snap.revision + 1
        try:
            await db.commit()
        except Exception:
            if parked:
                restore_dirty_draft_content(row, parked)
            raise
        await db.refresh(row)
        if parked:
            restore_dirty_draft_content(row, parked)
        return row

async def revise_draft(db,business_id,user_id,draft_id,revision,title,summary,steps,cover_asset_id=None,*,cover_specified=True):
    await access(db,business_id,user_id,'editor')
    public_content(title,summary,*(s['question'] for s in steps),*(s['answer'] for s in steps))
    if len(steps)!=8: fail('eight_steps_required',422)
    steps=_qa_steps(steps)
    # Phase 7G-4c.3A: Business → re-auth → fresh Draft → knowledge → one selection pass.
    from backend.services.business_yansi.studio_media import bind_media_plan, business_media_lock
    from backend.services.business_yansi.video_authority import require_locked_access
    async with business_media_lock(db, business_id):
        await require_locked_access(db, business_id, user_id, 'editor')
        snap = await draft_decision(db, business_id, draft_id, lock=True)
        if snap.revision != revision or snap.status != "draft" or snap.conversation_id:
            fail("editable_draft_required", 409)
        row = await db.get(Draft, snap.id)
        if row is None:
            fail("draft_not_found", 404)
        allowed={str(v.id):v for v in await published_knowledge(db,business_id,fresh=True)}
        _assert_supported_steps(steps, allowed)
        if not cover_specified and isinstance(snap.media_plan, dict):
            if snap.media_plan.get("coverMode") == "explicit" and snap.media_plan.get("coverAssetId"):
                cover_asset_id = snap.media_plan.get("coverAssetId")
        row.title=title;row.summary=summary;row.steps=steps
        row.media_plan=await bind_media_plan(db,business_id,title,summary,steps,cover_asset_id=cover_asset_id)
        row.knowledge_snapshot=sorted({v for step in steps for v in step['sources']})
        row.source_hash=source_hash(steps)
        row.revision = snap.revision + 1
        await db.commit();await db.refresh(row);return row
