"""Bounded in-request execution, not a worker. Never holds a transaction over AI I/O."""
import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_UP

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select, update
from backend.models.business_studio import BusinessStudioGeneration as Job, BusinessStudioUsage as Usage
from backend.core.utils.model_router import ModelRouter
from . import studio, studio_generation as generation, service as business
from .studio_validation import canonical_hash


def enabled():
    return os.getenv('BILIGN_STUDIO_EXECUTION_ENABLED', 'false').lower() == 'true'


def configuration(model):
    try:
        rates = json.loads(os.environ['BILIGN_STUDIO_PRICES_JSON'])[model]
        values = [Decimal(str(rates[key])) for key in ('inputPerMillion', 'outputPerMillion')]
        if not isinstance(model, str) or not model.startswith('openai/') or any(not v.is_finite() or v <= 0 or v > 1000 for v in values):
            raise ValueError()
        return [str(v) for v in values]
    except (KeyError, ValueError, TypeError, ArithmeticError):
        business.fail('studio_model_or_pricing_not_configured', 503)


def cost(tokens_in, tokens_out, rates):
    return ((tokens_in * Decimal(rates[0]) + tokens_out * Decimal(rates[1])) / Decimal(1000000)).quantize(Decimal('.00000001'), rounding=ROUND_UP)


async def selected_topic(db, job):
    if job.kind != 'draft':
        return None
    payload = job.request_payload
    if not payload.get('topicsGenerationId') or not payload.get('topicId'):
        business.fail('studio_selected_topic_required', 422)
    topics = await db.scalar(select(Job).where(Job.id == business.uid(payload['topicsGenerationId']), Job.business_id == job.business_id))
    if not topics or topics.kind != 'topics' or topics.status != 'succeeded' or topics.snapshot_hash != job.snapshot_hash:
        business.fail('studio_topic_unavailable', 409)
    await studio.revalidate(db, topics)
    for item in (topics.execution or {}).get('result', {}).get('topics', []):
        if item['id'] == payload['topicId']:
            return item
    business.fail('studio_topic_unavailable', 409)


async def prepare(db, job, limits):
    """Claim by conditional UPDATE as well as PostgreSQL row lock. Existing keys never rerun."""
    await studio.lock_business(db, job.business_id, job.actor_id, 'editor')
    job = await db.scalar(select(Job).where(Job.id == job.id).with_for_update().execution_options(populate_existing=True))
    if job.status != 'blocked' or job.attempts != 0 or job.error_code != 'studio_execution_not_implemented':
        db.expunge(job)
        await db.commit()
        return job, None
    try:
        await studio.revalidate(db, job)
        passages = generation.catalog(job.source_snapshot)
        topic = await selected_topic(db, job)
        rates = configuration(job.model)
        text = generation.prompt(job.kind, passages, job.request_payload.get('topicHint', ''), topic)
        # UTF-8 bytes plus framing is a deliberately conservative input token bound.
        schema = generation.output_schema(job.kind, passages, topic)
        reserve_in = len(text.encode('utf-8')) + len(json.dumps(schema).encode('utf-8')) + 1024
        reserve_out = job.reserved_output_tokens // job.max_attempts
        reserve_cost = cost(reserve_in, reserve_out, rates)
        if reserve_in * job.max_attempts > job.reserved_input_tokens or reserve_cost * job.max_attempts > job.cost_limit_usd:
            business.fail('studio_attempt_budget_exceeded', 429)
    except HTTPException as error:
        job.error_code = error.detail['code']
        await db.flush(); await db.refresh(job); db.expunge(job); await db.commit()
        return job, None
    execution = {'promptVersion': generation.PROMPT_VERSION, 'rates': rates, 'reserveIn': reserve_in,
                 'reserveOut': reserve_out, 'reserveCost': str(reserve_cost), 'usageEstimated': False}
    now = datetime.now(timezone.utc)
    claimed = await db.execute(update(Job).where(Job.id == job.id, Job.status == 'blocked', Job.attempts == 0,
        Job.error_code == 'studio_execution_not_implemented').values(status='pending', attempts=0,
        prompt_version=generation.PROMPT_VERSION, error_code=None, execution=execution,
        deadline_at=now + timedelta(seconds=limits.timeout_seconds)).execution_options(synchronize_session=False))
    if claimed.rowcount != 1:
        await db.refresh(job); db.expunge(job); await db.commit()
        return job, None
    await db.refresh(job); db.expunge(job); await db.commit()
    # Persist the queued state before claiming; no queue/worker is implied.
    await studio.lock_business(db, job.business_id, job.actor_id, 'editor')
    await studio.revalidate(db, job)
    claim = await db.execute(update(Job).where(Job.id == job.id, Job.status == 'pending', Job.attempts == 0)
        .values(status='running', attempts=1).execution_options(synchronize_session=False))
    job = await db.scalar(select(Job).where(Job.id == job.id).execution_options(populate_existing=True))
    db.expunge(job); await db.commit()
    return job, (text, passages, topic) if claim.rowcount == 1 else None


def usage(result, execution):
    if (result or {}).get('skipped') is True:
        return 0, 0, Decimal('0'), False
    reported = (result or {}).get('usage') or {}
    ni, no = reported.get('prompt_tokens'), reported.get('completion_tokens')
    known = type(ni) is int and type(no) is int and 0 <= ni <= execution['reserveIn'] and 0 <= no <= execution['reserveOut']
    if known:
        return ni, no, cost(ni, no, execution['rates']), False
    # Ambiguous provider failures MUST NOT be recorded as a free call or retried.
    return execution['reserveIn'], execution['reserveOut'], Decimal(execution['reserveCost']), True


async def settle(db, snapshot, result, parsed, error, *, allow_retry=False):
    """Usage and exactly one draft/result commit atomically. Failure still accounts AI usage."""
    # Consistent Business -> generation lock order, including timeout recovery.
    from backend.models.business_yansi import BusinessProfile
    await db.scalar(select(BusinessProfile).where(BusinessProfile.id == snapshot.business_id).with_for_update())
    job = await db.scalar(select(Job).where(Job.id == snapshot.id).with_for_update().execution_options(populate_existing=True))
    if job.status != 'running' or job.attempts != snapshot.attempts:
        db.expunge(job); await db.commit()
        return job
    execution = dict(job.execution)
    ni, no, charge, estimated = usage(result, execution)
    candidate, draft_data = None, None
    try:
        # Recheck before every automatic retry as well as before accepting output.
        await studio.lock_business(db, job.business_id, job.actor_id, 'editor')
        await studio.revalidate(db, job)
        deadline = job.deadline_at.replace(tzinfo=timezone.utc) if job.deadline_at.tzinfo is None else job.deadline_at
        if datetime.now(timezone.utc) >= deadline:
            business.fail('studio_deadline_exceeded', 409)
        if not error and job.kind == 'draft':
            candidate, draft_data = parsed
    except HTTPException as failure:
        # Keep interruption/cancellation diagnostics while still forbidding retry.
        error = error if error in {'studio_execution_interrupted', 'studio_request_cancelled'} else failure.detail['code']
        allow_retry = False
    if not error and estimated:
        error = 'studio_usage_unknown'
    if not error and draft_data:
        # Preserve existing draft validation; defer its commit for atomic provenance.
        try:
            async with db.begin_nested():
                draft = await business.create_draft(db, job.business_id, job.actor_id, **draft_data, commit=False)
                # Include metadata-only/selected sources so existing owner approval
                # also fails closed after their revocation. No publishing-path change.
                draft.knowledge_snapshot = sorted(s['versionId'] for s in job.source_snapshot['sources'])
                job.draft_id = draft.id
        except HTTPException as failure:
            error = failure.detail['code']
    if not error:
        execution['result'] = candidate if job.kind == 'draft' else parsed
    execution['usageEstimated'] = execution.get('usageEstimated', False) or estimated
    outcome = 'failed' if error else 'validated'
    db.add(Usage(generation_id=job.id, attempt=job.attempts, settlement_hash=canonical_hash({
        'attempt': job.attempts, 'input': ni, 'output': no, 'cost': str(charge), 'error': error}),
        input_tokens=ni, output_tokens=no, cost_usd=charge, outcome=outcome, error_code=error, estimated=estimated))
    job.input_tokens += ni; job.output_tokens += no; job.cost_usd += charge
    job.error_code = error
    # Only known-usage invalid model output gets an automatic repair attempt.
    retry = bool(error and allow_retry and not estimated and job.attempts < job.max_attempts)
    deadline = job.deadline_at.replace(tzinfo=timezone.utc) if job.deadline_at.tzinfo is None else job.deadline_at
    retry = retry and datetime.now(timezone.utc) < deadline
    if retry:
        job.attempts += 1
    else:
        job.status = 'failed' if error else 'succeeded'
    job.execution = execution
    await db.flush(); await db.refresh(job); db.expunge(job); await db.commit()
    return job


async def recover(db, job):
    if job.status not in {'pending', 'running'} or not job.execution:
        return job
    deadline = job.deadline_at.replace(tzinfo=timezone.utc) if job.deadline_at.tzinfo is None else job.deadline_at
    if datetime.now(timezone.utc) < deadline:
        return job
    if job.status == 'pending':
        # Crash before any provider attempt: expire without fabricated usage.
        await db.execute(update(Job).where(Job.id == job.id, Job.status == 'pending', Job.attempts == 0)
            .values(status='failed', error_code='studio_queue_expired'))
        await db.refresh(job); db.expunge(job); await db.commit()
        return job
    return await settle(db, job, None, None, 'studio_execution_interrupted')


async def execute(db, job, *, router=None, limits=studio.Limits()):
    if not enabled():
        return job
    job = await recover(db, job)
    job, work = await prepare(db, job, limits)
    if work is None:
        return job
    text, passages, topic = work
    router = router or ModelRouter()
    # Router has a legacy fixed model list. Permit the explicitly configured OpenAI
    # model only when its existing provider credential is available; no fallback.
    if job.model not in router.available_models and router.openai_client.api_key:
        router.available_models.append(job.model)
    while job.status == 'running':
        result, parsed, error, retry = None, None, None, False
        try:
            deadline = job.deadline_at.replace(tzinfo=timezone.utc) if job.deadline_at.tzinfo is None else job.deadline_at
            remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
            if remaining <= 0:
                raise TimeoutError()
            result = await asyncio.wait_for(router.generate(prompt=text, model_id=job.model,
                temperature=0, max_tokens=job.execution['reserveOut'], timeout=remaining,
                retries=0, json_schema=generation.output_schema(job.kind, passages, topic)), timeout=remaining)
            if not result.get('ok'):
                error = 'studio_provider_failed'
            else:
                value = json.loads(result['output'])
                if result.get('finish_reason') != 'stop':
                    raise ValueError('incomplete output')
                value = generation.unwrap(job.kind, value)
                if value is None:
                    error = 'studio_insufficient_sources'
                else:
                    parsed = generation.validate_topics(value, passages) if job.kind == 'topics' else generation.validate_draft(value, passages, topic, job)
        except asyncio.CancelledError:
            await asyncio.shield(settle(db, job, result, None, 'studio_request_cancelled'))
            raise
        except (TimeoutError, asyncio.TimeoutError):
            error = 'studio_provider_timeout'
        except (ValueError, KeyError, TypeError, ValidationError, HTTPException):
            error, retry = 'studio_invalid_model_output', True
        except Exception:
            # Do not expose provider exception strings or credentials.
            error = 'studio_provider_failed'
        job = await settle(db, job, result, parsed, error, allow_retry=retry)
    return job
