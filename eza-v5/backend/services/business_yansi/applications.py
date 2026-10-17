"""Brand application intake. Submission never creates Business membership."""
import re
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, func
from backend.models.production import Organization, OrganizationUser
from backend.models.business_yansi import BusinessBrandApplication as Application, BusinessApplicationEvent as Event
from backend.services.business_yansi import service as svc

STATUSES = {'received', 'under_review', 'approved', 'rejected'}
OPEN = {'received', 'under_review'}
TRANSITIONS = {
    'received': {'under_review', 'rejected'},
    'under_review': {'approved', 'rejected', 'received'},
    'approved': set(),
    'rejected': set(),
}
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
URL_RE = re.compile(r'^https?://', re.I)


def normalize_brand(name: str) -> str:
    return re.sub(r'\s+', ' ', (name or '').strip().lower())


def validate_payload(data: dict):
    brand = (data.get('brandName') or '').strip()
    contact = (data.get('contactName') or '').strip()
    email = (data.get('corporateEmail') or '').strip().lower()
    website = (data.get('website') or '').strip() or None
    company = (data.get('companyInfo') or '').strip()
    if not brand or len(brand) > 120: svc.fail('invalid_brand_name', 422)
    if not contact or len(contact) > 120: svc.fail('invalid_contact_name', 422)
    if not email or len(email) > 255 or not EMAIL_RE.match(email): svc.fail('invalid_corporate_email', 422)
    if website:
        if len(website) > 500 or not URL_RE.match(website): svc.fail('invalid_website', 422)
    if len(company) > 2000: svc.fail('invalid_company_info', 422)
    svc.public_content(brand, contact, company, website or '')
    return {
        'brand_name': brand,
        'brand_name_normalized': normalize_brand(brand),
        'contact_name': contact,
        'corporate_email': email,
        'website': website,
        'company_info': company,
    }


async def audit(db, application_id, actor_id, action, from_status=None, to_status=None, detail=None):
    db.add(Event(
        id=uuid.uuid4(),
        application_id=svc.uid(application_id),
        actor_user_id=svc.uid(actor_id),
        action=action,
        from_status=from_status,
        to_status=to_status,
        detail=detail or {},
    ))


async def create_application(db, user_id, data):
    payload = validate_payload(data)
    open_row = await db.scalar(
        select(Application).where(
            Application.applicant_user_id == svc.uid(user_id),
            Application.brand_name_normalized == payload['brand_name_normalized'],
            Application.status.in_(OPEN),
        ).limit(1)
    )
    if open_row:
        svc.fail('application_already_open', 409)
    row = Application(
        id=uuid.uuid4(),
        applicant_user_id=svc.uid(user_id),
        status='received',
        reviewer_note='',
        **payload,
    )
    db.add(row)
    await db.flush()
    await audit(db, row.id, user_id, 'submitted', None, 'received', {'brand_name': row.brand_name})
    await db.commit()
    await db.refresh(row)
    return row


async def list_mine(db, user_id):
    return list((await db.scalars(
        select(Application).where(Application.applicant_user_id == svc.uid(user_id)).order_by(Application.created_at.desc())
    )).all())


async def list_all(db):
    return list((await db.scalars(select(Application).order_by(Application.created_at.desc()))).all())


async def get_owned(db, application_id, user_id):
    row = await db.get(Application, svc.uid(application_id))
    if not row or row.applicant_user_id != svc.uid(user_id):
        svc.fail('application_not_found', 404)
    return row


async def transition_application(db, admin_id, application_id, target, note='', slug=None):
    await svc.platform_admin(db, {'user_id': str(admin_id)})
    if target not in STATUSES:
        svc.fail('invalid_application_status', 422)
    row = await db.scalar(select(Application).where(Application.id == svc.uid(application_id)).with_for_update())
    if not row:
        svc.fail('application_not_found', 404)
    if target not in TRANSITIONS.get(row.status, set()):
        svc.fail('invalid_application_transition', 409)
    previous = row.status
    business_id = row.business_id
    if target == 'approved':
        if not slug:
            svc.fail('slug_required_for_approval', 422)
        # Platform admin only: create org + Business owner. Applicant cannot self-provision.
        org = Organization(id=uuid.uuid4(), name=row.brand_name, status='active', plan='free', proxy_access=False)
        db.add(org)
        await db.flush()
        db.add(OrganizationUser(org_id=org.id, user_id=row.applicant_user_id, role='org_admin', status='active'))
        # create_business commits; re-load application afterwards.
        business = await svc.create_business(db, None, {
            'organizationId': str(org.id),
            'ownerId': str(row.applicant_user_id),
            'slug': slug,
            'name': row.brand_name,
            'description': (row.company_info or '')[:500],
        })
        business_id = business.id
        row = await db.get(Application, svc.uid(application_id))
        if not row or row.status != previous:
            svc.fail('application_conflict', 409)
    row.status = target
    row.business_id = business_id
    row.reviewer_note = (note or '')[:1000]
    row.reviewed_by = svc.uid(admin_id)
    row.reviewed_at = datetime.now(timezone.utc)
    await audit(db, row.id, admin_id, 'status_changed', previous, target, {
        'note': row.reviewer_note,
        'business_id': str(row.business_id) if row.business_id else None,
        'slug': slug,
    })
    await db.commit()
    await db.refresh(row)
    return row


async def list_events(db, application_id):
    return list((await db.scalars(
        select(Event).where(Event.application_id == svc.uid(application_id)).order_by(Event.created_at.asc())
    )).all())


async def open_count_for_user(db, user_id):
    return int(await db.scalar(
        select(func.count()).select_from(Application).where(
            Application.applicant_user_id == svc.uid(user_id),
            Application.status.in_(OPEN),
        )
    ) or 0)
