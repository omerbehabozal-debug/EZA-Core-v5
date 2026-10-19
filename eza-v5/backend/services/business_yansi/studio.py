"""Admission/reservations only. No queue, provider, draft creation, or publication."""
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
import os

from sqlalchemy import select, func
from backend.core.schemas.business_studio import GenerationRequest, GenerationResponse, PROMPT_VERSION
from backend.models.business_studio import BusinessStudioGeneration as Job, BusinessStudioUsage as Usage
from backend.models.business_yansi import BusinessProfile
from backend.services.business_yansi import service as business
from .studio_validation import canonical_hash, digest, validate_snapshot, validate_candidate, safe_content


@dataclass(frozen=True)
class Limits:
    daily_jobs: int = 10
    daily_tokens: int = 260000
    daily_cost: Decimal = Decimal('1.00')
    input_tokens: int = 20000
    output_tokens: int = 6000
    job_cost: Decimal = Decimal('.10')
    max_attempts: int = 2
    timeout_seconds: int = 60


async def snapshot_sources(db, business_id, ids):
    rows = await business.published_knowledge(db, business_id, [str(i) for i in ids], fresh=True)
    if len(rows) != len(set(ids)):
        business.fail('studio_source_unavailable', 422)
    sources = []
    for row in sorted(rows, key=lambda r: str(r.id)):
        safe_content(row.title, row.category, row.content, row.source)
        sources.append({'versionId': str(row.id), 'version': row.version, 'title': row.title,
                        'category': row.category, 'content': row.content, 'source': row.source,
                        'approvedBy': str(row.approved_by), 'contentHash': digest(row.content)})
    snapshot = {'businessId': str(business_id), 'sources': sources}
    fingerprint = canonical_hash(snapshot)
    validate_snapshot(snapshot, fingerprint, business_id)
    return snapshot, fingerprint


async def revalidate(db, job):
    """Existing admissions fail closed as stale when pinned sources disappear or change."""
    identities = validate_snapshot(job.source_snapshot, job.snapshot_hash, job.business_id)
    try:
        current, fingerprint = await snapshot_sources(db, job.business_id, identities.keys())
    except Exception as error:
        # published_knowledge misses (revoked/archived/foreign) surface as unavailable on
        # fresh admission; for an existing job that is a stale snapshot, not a bad request.
        detail = getattr(error, 'detail', None)
        code = detail.get('code') if isinstance(detail, dict) else None
        if code == 'studio_source_unavailable':
            business.fail('studio_snapshot_stale', 409)
        raise
    if fingerprint != job.snapshot_hash or current != job.source_snapshot:
        business.fail('studio_snapshot_stale', 409)


async def lock_business(db, business_id, user_id, role):
    # A future worker must recheck account activity, not just the stored actor ID.
    from backend.models.production import User, Organization
    from backend.models.business_yansi import BusinessMember
    await db.get(User, business.uid(user_id), populate_existing=True)
    await business.actor(db, {'user_id': str(user_id)})
    await db.get(BusinessMember, (business.uid(business_id), business.uid(user_id)), populate_existing=True)
    await db.get(Organization, business.uid(business_id), populate_existing=True)
    await db.scalar(select(BusinessProfile).where(BusinessProfile.id == business.uid(business_id))
                    .with_for_update().execution_options(populate_existing=True))
    return await business.access(db, business_id, user_id, role)


async def create_job(db, business_id, user_id, body, kind, limits=Limits()):
    """Caller owns rollback on error; lock serializes keys and daily reservations."""
    if kind not in {'topics', 'draft'} or (kind == 'draft' and not isinstance(body, GenerationRequest)):
        business.fail('studio_invalid_request', 422)
    await lock_business(db, business_id, user_id, 'editor')
    safe_content(body.topicHint)
    payload = {'kind': kind, 'actorId': str(user_id), 'request': body.model_dump(mode='json', exclude={'idempotencyKey'})}
    request_hash = canonical_hash(payload)
    existing = await db.scalar(select(Job).where(Job.business_id == business.uid(business_id), Job.idempotency_key == body.idempotencyKey))
    if existing:
        if existing.request_hash != request_hash:
            business.fail('studio_idempotency_conflict', 409)
        from .studio_execution import recover
        existing = await recover(db, existing)
        await revalidate(db, existing)
        return existing
    snapshot, fingerprint = await snapshot_sources(db, business_id, body.sourceVersionIds)
    if kind == 'draft' and body.expectedSnapshotHash != fingerprint:
        business.fail('studio_snapshot_stale', 409)
    day = datetime.now(timezone.utc).date()
    count, tokens, cost = (await db.execute(select(func.count(Job.id),
        func.coalesce(func.sum(Job.reserved_input_tokens + Job.reserved_output_tokens), 0),
        func.coalesce(func.sum(Job.cost_limit_usd), 0)).where(Job.business_id == business.uid(business_id), Job.quota_day == day))).one()
    if count >= limits.daily_jobs or tokens + limits.input_tokens + limits.output_tokens > limits.daily_tokens or Decimal(cost) + limits.job_cost > limits.daily_cost:
        business.fail('studio_business_budget_exceeded', 429)
    row = Job(business_id=business.uid(business_id), actor_id=business.uid(user_id),
        idempotency_key=body.idempotencyKey, request_hash=request_hash, request_payload=payload['request'], kind=kind,
        source_snapshot=snapshot, snapshot_hash=fingerprint, status='blocked',
        model=os.getenv('BILIGN_STUDIO_MODEL') or None, prompt_version=PROMPT_VERSION,
        max_attempts=limits.max_attempts, reserved_input_tokens=limits.input_tokens,
        reserved_output_tokens=limits.output_tokens, cost_limit_usd=limits.job_cost,
        quota_day=day, error_code='studio_execution_not_implemented')
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def read_job(db, business_id, user_id, generation_id):
    await business.access(db, business_id, user_id, 'viewer')
    row = await db.scalar(select(Job).where(Job.id == generation_id, Job.business_id == business.uid(business_id)))
    if not row:
        business.fail('studio_generation_not_found', 404)
    from .studio_execution import recover
    row = await recover(db, row)
    await revalidate(db, row)
    return row


def response(row):
    return GenerationResponse(generationId=row.id, businessId=row.business_id, kind=row.kind,
        status={'pending': 'queued', 'succeeded': 'completed'}.get(row.status, row.status),
        executionAvailable=bool(row.execution), result=(row.execution or {}).get('result') if row.status == 'succeeded' else None,
        usageEstimated=bool((row.execution or {}).get('usageEstimated')), snapshotHash=row.snapshot_hash, sources=[{'versionId': s['versionId'],
        'version': s['version'], 'contentHash': s['contentHash']} for s in row.source_snapshot['sources']],
        model=row.model, promptVersion=row.prompt_version, attemptCount=row.attempts,
        maxAttempts=row.max_attempts, reservedInputTokens=row.reserved_input_tokens,
        reservedOutputTokens=row.reserved_output_tokens, inputTokens=row.input_tokens,
        outputTokens=row.output_tokens, costUsd=row.cost_usd, costLimitUsd=row.cost_limit_usd,
        errorCode=row.error_code, draftId=row.draft_id, createdAt=row.created_at, updatedAt=row.updated_at)


# Future worker contracts, intentionally not exposed by Phase 1 HTTP routes.
# A blocked job is never automatically promoted; there is no executable worker.
async def begin_attempt(db, job, limits=Limits()):
    await lock_business(db, job.business_id, job.actor_id, 'editor')
    job = await db.scalar(select(Job).where(Job.id == job.id).with_for_update().execution_options(populate_existing=True))
    if job.status != 'pending':
        business.fail('studio_invalid_transition', 409)
    if job.attempts >= job.max_attempts or job.input_tokens >= job.reserved_input_tokens or job.output_tokens >= job.reserved_output_tokens or job.cost_usd >= job.cost_limit_usd:
        business.fail('studio_attempt_budget_exceeded', 429)
    await revalidate(db, job)
    job.attempts += 1
    job.status = 'running'
    job.deadline_at = datetime.now(timezone.utc) + timedelta(seconds=limits.timeout_seconds)
    job.error_code = None
    await db.flush()
    await db.refresh(job)
    db.expunge(job)
    await db.commit()  # Return a detached snapshot, without a read transaction/pool slot.
    return job


async def settle_attempt(db, job, *, attempt, input_tokens, output_tokens, cost_usd,
                         outcome, error_code=None, candidate=None):
    try:
        cost_usd = Decimal(str(cost_usd))
        if not cost_usd.is_finite() or cost_usd != cost_usd.quantize(Decimal('.00000001')):
            business.fail('studio_invalid_usage', 422)
    except (InvalidOperation, ValueError):
        business.fail('studio_invalid_usage', 422)
    if type(input_tokens) is not int or type(output_tokens) is not int or input_tokens < 0 or output_tokens < 0 or not cost_usd.is_finite() or cost_usd < 0 or outcome not in {'validated', 'failed', 'expired'}:
        business.fail('studio_invalid_usage', 422)
    settlement_hash = canonical_hash({'attempt': attempt, 'input': input_tokens, 'output': output_tokens,
        'cost': format(cost_usd.normalize(), 'f'), 'outcome': outcome, 'error': error_code, 'candidate': candidate})
    await lock_business(db, job.business_id, job.actor_id, 'editor')
    job = await db.scalar(select(Job).where(Job.id == job.id).with_for_update().execution_options(populate_existing=True))
    old = await db.get(Usage, (job.id, attempt))
    if old:
        if old.settlement_hash != settlement_hash:
            business.fail('studio_usage_conflict', 409)
        if old.outcome == 'validated':
            await revalidate(db, job)
        return job
    if job.status != 'running' or job.attempts != attempt:
        business.fail('studio_invalid_transition', 409)
    if job.input_tokens + input_tokens > job.reserved_input_tokens or job.output_tokens + output_tokens > job.reserved_output_tokens or job.cost_usd + cost_usd > job.cost_limit_usd:
        business.fail('studio_usage_budget_exceeded', 429)
    deadline = job.deadline_at
    if deadline is not None and deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if outcome == 'validated':
        if deadline is None or datetime.now(timezone.utc) > deadline:
            business.fail('studio_deadline_exceeded', 409)
        if job.kind != 'draft' or candidate is None:
            business.fail('studio_invalid_candidate', 422)
        await revalidate(db, job)
        validate_candidate(candidate, job.source_snapshot, job.snapshot_hash, job.business_id)
    db.add(Usage(generation_id=job.id, attempt=attempt, settlement_hash=settlement_hash,
        input_tokens=input_tokens, output_tokens=output_tokens, cost_usd=cost_usd,
        outcome=outcome, error_code=error_code))
    job.input_tokens += input_tokens
    job.output_tokens += output_tokens
    job.cost_usd += cost_usd
    job.status = outcome
    job.error_code = error_code
    # No draft is created in Stage 1. Success here only verifies the future worker contract.
    await db.commit()
    await db.refresh(job)
    return job


async def retry_failed(db, job):
    await lock_business(db, job.business_id, job.actor_id, 'editor')
    job = await db.scalar(select(Job).where(Job.id == job.id).with_for_update().execution_options(populate_existing=True))
    if job.status not in {'failed', 'expired'} or job.attempts >= job.max_attempts:
        business.fail('studio_retry_exhausted', 409)
    await revalidate(db, job)
    job.status = 'pending'
    await db.commit()
    await db.refresh(job)
    return job
