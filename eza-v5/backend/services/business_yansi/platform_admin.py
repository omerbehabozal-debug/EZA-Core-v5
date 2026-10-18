"""Platform-admin read models for BiligN Business console. No customer chat content."""
from __future__ import annotations

from sqlalchemy import select, func, or_, union
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.business_yansi import (
    BusinessProfile,
    BusinessMember,
    BusinessPublication,
    BusinessBrandApplication,
    BusinessApplicationEvent,
    BusinessKnowledgeVersion,
    BusinessYansiDraft,
)
from backend.models.production import User
from backend.models.mirror_network import MirrorNetworkNode
from backend.services.business_yansi import service as svc
from backend.services.business_yansi.publication import enabled


def _uid(value):
    return svc.uid(value)


async def overview(db: AsyncSession) -> dict:
    business_total = await db.scalar(select(func.count()).select_from(BusinessProfile)) or 0
    verified_total = await db.scalar(
        select(func.count()).select_from(BusinessProfile).where(BusinessProfile.verified.is_(True))
    ) or 0
    pending_apps = await db.scalar(
        select(func.count())
        .select_from(BusinessBrandApplication)
        .where(BusinessBrandApplication.status.in_(('received', 'under_review')))
    ) or 0
    active_publications = await db.scalar(
        select(func.count())
        .select_from(BusinessPublication)
        .join(MirrorNetworkNode, MirrorNetworkNode.slug == BusinessPublication.slug)
        .where(MirrorNetworkNode.visibility == 'public')
    ) or 0

    recent_apps = (
        await db.scalars(
            select(BusinessBrandApplication)
            .order_by(BusinessBrandApplication.created_at.desc())
            .limit(8)
        )
    ).all()
    recent_events = (
        await db.scalars(
            select(BusinessApplicationEvent)
            .order_by(BusinessApplicationEvent.created_at.desc())
            .limit(12)
        )
    ).all()

    return {
        'business_enabled': enabled(),
        'totals': {
            'businesses': int(business_total),
            'verified_businesses': int(verified_total),
            'pending_applications': int(pending_apps),
            'public_publications': int(active_publications),
        },
        'recent_applications': recent_apps,
        'recent_events': recent_events,
    }


async def list_businesses(db: AsyncSession) -> list[dict]:
    rows = (
        await db.scalars(select(BusinessProfile).order_by(BusinessProfile.created_at.desc()))
    ).all()
    items = []
    for row in rows:
        owner = await db.get(User, row.owner_id)
        pub_count = await db.scalar(
            select(func.count())
            .select_from(BusinessPublication)
            .where(BusinessPublication.business_id == row.id)
        ) or 0
        member_count = await db.scalar(
            select(func.count())
            .select_from(BusinessMember)
            .where(BusinessMember.business_id == row.id)
        ) or 0
        items.append(
            {
                'business': row,
                'owner_email': owner.email if owner else None,
                'owner_id': str(row.owner_id),
                'publication_count': int(pub_count),
                'member_count': int(member_count),
            }
        )
    return items


async def business_detail(db: AsyncSession, business_id) -> dict:
    row = await db.get(BusinessProfile, _uid(business_id))
    if not row:
        svc.fail('business_not_found', 404)
    owner = await db.get(User, row.owner_id)
    members = (
        await db.scalars(select(BusinessMember).where(BusinessMember.business_id == row.id))
    ).all()
    member_items = []
    for m in members:
        user = await db.get(User, m.user_id)
        member_items.append(
            {
                'user_id': str(m.user_id),
                'role': m.role,
                'email': user.email if user else None,
            }
        )
    knowledge = (
        await db.scalars(
            select(BusinessKnowledgeVersion)
            .where(BusinessKnowledgeVersion.business_id == row.id)
            .order_by(BusinessKnowledgeVersion.updated_at.desc())
            .limit(20)
        )
    ).all()
    drafts = (
        await db.scalars(
            select(BusinessYansiDraft)
            .where(BusinessYansiDraft.business_id == row.id)
            .order_by(BusinessYansiDraft.updated_at.desc())
            .limit(20)
        )
    ).all()
    pubs = (
        await db.execute(
            select(BusinessPublication, MirrorNetworkNode.visibility)
            .join(MirrorNetworkNode, MirrorNetworkNode.slug == BusinessPublication.slug)
            .where(BusinessPublication.business_id == row.id)
        )
    ).all()
    return {
        'business': row,
        'owner_email': owner.email if owner else None,
        'members': member_items,
        'knowledge_versions': knowledge,
        'drafts': drafts,
        'publications': [{'row': p, 'visibility': vis} for p, vis in pubs],
    }


async def search_users(db: AsyncSession, q: str, limit: int = 20) -> list[dict]:
    """Search only BiligN-related users (membership, application, owner, or BiligN capability)."""
    from backend.models.production import UserCapability
    from backend.services.user_capabilities import BILIGN_PLATFORM_ADMIN

    query = (q or '').strip()
    if len(query) < 2:
        svc.fail('search_query_too_short', 422)
    limit = max(1, min(int(limit or 20), 50))
    pattern = f'%{query.lower()}%'
    bilign_related = union(
        select(BusinessMember.user_id),
        select(BusinessBrandApplication.applicant_user_id),
        select(BusinessProfile.owner_id),
        select(UserCapability.user_id).where(
            UserCapability.capability == BILIGN_PLATFORM_ADMIN,
            UserCapability.revoked_at.is_(None),
        ),
    )
    rows = (
        await db.scalars(
            select(User)
            .where(
                User.id.in_(bilign_related),
                or_(
                    func.lower(User.email).like(pattern),
                    func.lower(func.coalesce(User.public_display_name, '')).like(pattern),
                ),
            )
            .order_by(User.created_at.desc())
            .limit(limit)
        )
    ).all()
    items = []
    for user in rows:
        memberships = (
            await db.execute(
                select(BusinessMember, BusinessProfile)
                .join(BusinessProfile, BusinessProfile.id == BusinessMember.business_id)
                .where(BusinessMember.user_id == user.id)
            )
        ).all()
        items.append(
            {
                'user_id': str(user.id),
                'email': user.email,
                'role': user.role,
                'is_active': bool(user.is_active),
                'public_display_name': user.public_display_name,
                'created_at': user.created_at,
                'memberships': [
                    {
                        'business_id': str(profile.id),
                        'business_name': profile.name,
                        'business_slug': profile.slug,
                        'role': member.role,
                    }
                    for member, profile in memberships
                ],
            }
        )
    return items


async def list_publications(db: AsyncSession, limit: int = 50) -> list[dict]:
    limit = max(1, min(int(limit or 50), 100))
    rows = (
        await db.execute(
            select(BusinessPublication, BusinessProfile, MirrorNetworkNode.visibility)
            .join(BusinessProfile, BusinessProfile.id == BusinessPublication.business_id)
            .join(MirrorNetworkNode, MirrorNetworkNode.slug == BusinessPublication.slug)
            .order_by(BusinessPublication.created_at.desc())
            .limit(limit)
        )
    ).all()
    return [
        {
            'slug': pub.slug,
            'journey_version': pub.journey_version,
            'business_id': str(profile.id),
            'business_name': profile.name,
            'business_slug': profile.slug,
            'visibility': visibility,
            'created_at': pub.created_at,
            'draft_id': str(pub.draft_id),
            'published_by': str(pub.published_by),
        }
        for pub, profile, visibility in rows
    ]


async def system_status(db: AsyncSession) -> dict:
    pending = await db.scalar(
        select(func.count())
        .select_from(BusinessBrandApplication)
        .where(BusinessBrandApplication.status.in_(('received', 'under_review')))
    ) or 0
    return {
        'business_enabled': enabled(),
        'pending_applications': int(pending),
        # No secrets / connection strings — operational flags only.
        'features': {
            'brand_applications': True,
            'knowledge_pool': True,
            'yansi_studio': True,
            'publications': True,
            'verification': True,
        },
    }
