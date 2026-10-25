"""Business knowledge index. Off unless BILIGN_BUSINESS_RAG_ENABLED is true.

The API process does not embed during a save and does not start a worker.
After an approved migration, an external scheduler may call
``process_index_queue`` on a short interval and ``backfill_public_knowledge``
once for rows that already exist. This module registers no loop, cron, or
startup hook. Do not point that scheduler at production until a later approval.

Queue state is visible through ``queue_snapshot``: pending, leased,
lease_expired, failed, exhausted, ready, and retired.
"""
import hashlib
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, or_, select, update

from backend.core.llm.providers.openai_client import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL
from sqlalchemy.exc import OperationalError, ProgrammingError

from backend.models.business_yansi import (
    BusinessKnowledgeChunk as Chunk,
    BusinessKnowledgeVersion as Knowledge,
    BusinessProfile,
    canonical_embedding,
)
from backend.models.production import Organization
from backend.services.business_yansi.chunking import split_knowledge

MAX_ATTEMPTS = 5
LEASE_SECONDS = 120
BACKOFF_CAP_SECONDS = 300
logger = logging.getLogger(__name__)


def enabled():
    return os.getenv("BILIGN_BUSINESS_RAG_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


def _uuid(value):
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def _now():
    return datetime.now(timezone.utc)


def _digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _vector_ok(vector):
    """Accept only a vector that stays finite, 1536-d, and non-zero after storage rounding."""
    return canonical_embedding(vector) is not None


_UNDEFINED_RELATION = re.compile(
    r'relation ["\']?([A-Za-z0-9_.]+)["\']? does not exist',
    re.IGNORECASE,
)


def _missing_relation(exc):
    """Relation named by PostgreSQL 42P01, or the SQLite chunk table. Permission errors are not missing tables."""
    orig = getattr(exc, "orig", None)
    if orig is None:
        return None
    sqlstate = getattr(orig, "pgcode", None) or getattr(orig, "sqlstate", None)
    message = " ".join(
        part for part in (str(orig), str(getattr(orig, "pgerror", "") or "")) if part
    )
    if sqlstate:
        if str(sqlstate) != "42P01":
            return None
        match = _UNDEFINED_RELATION.search(message)
        if match is None:
            return None
        return match.group(1).rsplit(".", 1)[-1]
    lowered = message.lower()
    if "no such table" in lowered and "business_knowledge_chunks" in lowered:
        return "business_knowledge_chunks"
    return None


def _chunk_table_missing(exc):
    """True only when business_knowledge_chunks itself is the missing relation."""
    return _missing_relation(exc) == "business_knowledge_chunks"


def _empty_counts(**extra):
    counts = {"embedded": 0, "failed": 0, "retired": 0, "exhausted": 0, "discarded": 0}
    counts.update(extra)
    return counts


def _source_ok(source):
    """Current published public knowledge for an active brand. Verified is not required."""
    return bool(
        source
        and source["status"] == "published"
        and source["public_allowed"]
        and source["approved_by"] is not None
        and source["profile_status"] == "active"
        and source["org_status"] == "active"
    )


def _desired_hashes(source):
    return {_digest(text) for text in split_knowledge(source["title"], source["category"], source["content"])}


def _is_postgres(db):
    bind = db.get_bind()
    return bind is not None and bind.dialect.name == "postgresql"


async def _read_source(db, version_id, lock=False):
    """Read the committed source. populate_existing ignores a stale identity map."""
    stmt = (
        select(Knowledge, BusinessProfile.status, Organization.status)
        .join(BusinessProfile, BusinessProfile.id == Knowledge.business_id)
        .join(Organization, Organization.id == Knowledge.business_id)
        .where(Knowledge.id == version_id)
        .execution_options(populate_existing=True)
    )
    if lock and _is_postgres(db):
        stmt = stmt.with_for_update()
    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        return None
    knowledge, profile_status, org_status = row
    return {
        "id": knowledge.id,
        "business_id": knowledge.business_id,
        "item_id": knowledge.item_id,
        "status": knowledge.status,
        "public_allowed": bool(knowledge.public_allowed),
        "approved_by": knowledge.approved_by,
        "title": knowledge.title,
        "category": knowledge.category or "",
        "content": knowledge.content,
        "profile_status": profile_status,
        "org_status": org_status,
    }


async def _read_job(db, chunk_id, lock=False):
    stmt = (
        select(
            Chunk.id,
            Chunk.business_id,
            Chunk.knowledge_version_id,
            Chunk.item_id,
            Chunk.text,
            Chunk.content_hash,
            Chunk.index_status,
            Chunk.claim_token,
            Chunk.attempts,
        )
        .where(Chunk.id == chunk_id)
        .execution_options(populate_existing=True)
    )
    if lock and _is_postgres(db):
        stmt = stmt.with_for_update()
    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        return None
    return {
        "id": row.id,
        "business_id": row.business_id,
        "knowledge_version_id": row.knowledge_version_id,
        "item_id": row.item_id,
        "text": row.text,
        "content_hash": row.content_hash,
        "index_status": row.index_status,
        "claim_token": row.claim_token,
        "attempts": row.attempts,
    }


def _job_matches(job, current, source):
    if current is None or source is None:
        return False
    return (
        current["claim_token"] == job["token"]
        and current["index_status"] == "leased"
        and current["business_id"] == job["business_id"] == source["business_id"]
        and current["knowledge_version_id"] == job["knowledge_version_id"] == source["id"]
        and current["item_id"] == job["item_id"] == source["item_id"]
        and current["content_hash"] == job["content_hash"]
        and current["text"] == job["text"]
        and job["content_hash"] in _desired_hashes(source)
        and _source_ok(source)
    )


async def _reusable_embedding(db, business_id, digest, exclude_id=None):
    stmt = (
        select(Chunk.embedding)
        .join(Knowledge, Knowledge.id == Chunk.knowledge_version_id)
        .join(BusinessProfile, BusinessProfile.id == Knowledge.business_id)
        .join(Organization, Organization.id == Knowledge.business_id)
        .where(
            Chunk.business_id == business_id,
            Knowledge.business_id == business_id,
            Chunk.item_id == Knowledge.item_id,
            Chunk.content_hash == digest,
            Chunk.embedding_model == EMBEDDING_MODEL,
            Chunk.index_status == "ready",
            Chunk.embedding.is_not(None),
            Knowledge.status == "published",
            Knowledge.public_allowed.is_(True),
            Knowledge.approved_by.is_not(None),
            BusinessProfile.status == "active",
            Organization.status == "active",
        )
        .limit(1)
        .execution_options(populate_existing=True)
    )
    if exclude_id is not None:
        stmt = stmt.where(Chunk.id != exclude_id)
    vector = await db.scalar(stmt)
    if not _vector_ok(vector):
        return None
    return list(vector)


async def _retire_version(db, version_id):
    await db.execute(
        update(Chunk)
        .where(Chunk.knowledge_version_id == version_id, Chunk.index_status != "retired")
        .values(
            index_status="retired",
            embedding=None,
            claim_token=None,
            claim_owner=None,
            lease_expires_at=None,
            last_error=None,
        )
    )


async def sync_version(db, version):
    """Write or retire chunk rows. Does not call the embedding provider."""
    source = await _read_source(db, getattr(version, "id", version))
    version_id = source["id"] if source else getattr(version, "id", version)
    if not _source_ok(source):
        await _retire_version(db, version_id)
        return
    desired = split_knowledge(source["title"], source["category"], source["content"])
    existing = {
        row.chunk_index: row
        for row in (await db.scalars(
            select(Chunk).where(Chunk.knowledge_version_id == source["id"]).execution_options(populate_existing=True)
        )).all()
    }
    for index, text in enumerate(desired):
        digest = _digest(text)
        row = existing.get(index)
        if (
            row
            and row.content_hash == digest
            and row.embedding_model == EMBEDDING_MODEL
            and row.index_status == "ready"
            and _vector_ok(row.embedding)
        ):
            continue
        same_job = (
            row is not None
            and row.content_hash == digest
            and row.embedding_model == EMBEDDING_MODEL
            and row.index_status in {"pending", "failed", "leased"}
        )
        if row is None:
            row = Chunk(
                id=uuid.uuid4(),
                business_id=source["business_id"],
                knowledge_version_id=source["id"],
                item_id=source["item_id"],
                chunk_index=index,
                attempts=0,
                text=text,
                content_hash=digest,
                embedding_model=EMBEDDING_MODEL,
                token_count=max(1, len(text) // 3),
                index_status="pending",
            )
            db.add(row)
        reused = None if same_job else await _reusable_embedding(db, source["business_id"], digest, getattr(row, "id", None))
        row.business_id = source["business_id"]
        row.item_id = source["item_id"]
        row.chunk_index = index
        row.text = text
        row.content_hash = digest
        row.embedding_model = EMBEDDING_MODEL
        row.token_count = max(1, len(text) // 3)
        if reused:
            row.embedding = reused
            row.index_status = "ready"
            row.indexed_at = _now()
            row.last_error = None
            row.claim_token = None
            row.claim_owner = None
            row.lease_expires_at = None
            await db.flush()
        elif same_job:
            continue
        else:
            row.embedding = None
            row.index_status = "pending"
            row.indexed_at = None
            row.last_error = None
            row.attempts = 0
            row.claim_token = None
            row.claim_owner = None
            row.lease_expires_at = None
            row.next_attempt_at = None
    for index, row in existing.items():
        if index >= len(desired):
            await db.delete(row)


async def on_versions_changed(db, versions):
    """Queue index work after the knowledge transaction has committed. Never raises."""
    if not enabled():
        return
    try:
        for version in versions:
            await sync_version(db, version)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.warning("business knowledge index sync failed (%s)", exc.__class__.__name__)


def _claimable(now):
    retryable = and_(
        Chunk.index_status.in_(("pending", "failed")),
        Chunk.attempts < MAX_ATTEMPTS,
        or_(Chunk.next_attempt_at.is_(None), Chunk.next_attempt_at <= now),
    )
    expired = and_(
        Chunk.index_status == "leased",
        Chunk.lease_expires_at.is_not(None),
        Chunk.lease_expires_at <= now,
        Chunk.attempts < MAX_ATTEMPTS,
    )
    return or_(retryable, expired)


async def _recover_expired_leases(db, now):
    await db.execute(
        update(Chunk)
        .where(
            Chunk.index_status == "leased",
            Chunk.lease_expires_at.is_not(None),
            Chunk.lease_expires_at <= now,
            Chunk.attempts >= MAX_ATTEMPTS,
        )
        .values(
            index_status="exhausted",
            claim_token=None,
            claim_owner=None,
            lease_expires_at=None,
            last_error="lease_exhausted",
        )
    )


async def _claim_batch(db, *, worker_id, limit, business_id=None, version_ids=None):
    now = _now()
    await _recover_expired_leases(db, now)
    query = select(Chunk).where(_claimable(now))
    if business_id is not None:
        query = query.where(Chunk.business_id == _uuid(business_id))
    if version_ids is not None:
        ids = list(version_ids)
        if not ids:
            return []
        query = query.where(Chunk.knowledge_version_id.in_(ids))
    bind = db.get_bind()
    if bind is not None and bind.dialect.name == "postgresql":
        query = query.with_for_update(skip_locked=True)
    rows = (await db.scalars(query.order_by(Chunk.created_at, Chunk.chunk_index).limit(limit))).all()
    claimed = []
    expires = now + timedelta(seconds=LEASE_SECONDS)
    for row in rows:
        token = uuid.uuid4()
        row.index_status = "leased"
        row.claim_token = token
        row.claim_owner = worker_id[:64]
        row.lease_expires_at = expires
        row.attempts = (row.attempts or 0) + 1
        claimed.append({
            "id": row.id,
            "token": token,
            "text": row.text,
            "content_hash": row.content_hash,
            "knowledge_version_id": row.knowledge_version_id,
            "business_id": row.business_id,
            "item_id": row.item_id,
            "attempts": row.attempts,
        })
    await db.commit()
    return claimed


def _backoff_deadline(attempts, backoff_seconds):
    if backoff_seconds == 0:
        return _now()
    delay = min(BACKOFF_CAP_SECONDS, 2 ** max(1, attempts))
    return _now() + timedelta(seconds=delay)


async def _renew_lease(db, job):
    """Give the current owner a fresh lease before work that can outlast the original claim."""
    owned = await _owned_update(
        db,
        job,
        {"lease_expires_at": _now() + timedelta(seconds=LEASE_SECONDS)},
    )
    await db.commit()
    return owned


async def _owned_update(db, job, values):
    result = await db.execute(
        update(Chunk)
        .where(
            Chunk.id == job["id"],
            Chunk.claim_token == job["token"],
            Chunk.index_status == "leased",
        )
        .values(**values)
    )
    return result.rowcount == 1


async def _finish_job(db, job, *, backoff_seconds, vector=None, error=None):
    current = await _read_job(db, job["id"], lock=True)
    source = await _read_source(db, job["knowledge_version_id"], lock=True)
    if current is None or current["claim_token"] != job["token"]:
        await db.commit()
        return "discarded"
    if not _job_matches(job, current, source):
        owned = await _owned_update(db, job, {
            "index_status": "retired",
            "embedding": None,
            "claim_token": None,
            "claim_owner": None,
            "lease_expires_at": None,
            "last_error": None,
        })
        await db.commit()
        return "retired" if owned else "discarded"
    if vector is None:
        status = "exhausted" if job["attempts"] >= MAX_ATTEMPTS else "failed"
        owned = await _owned_update(db, job, {
            "index_status": status,
            "claim_token": None,
            "claim_owner": None,
            "lease_expires_at": None,
            "last_error": error or "embedding_failed",
            "next_attempt_at": None if status == "exhausted" else _backoff_deadline(job["attempts"], backoff_seconds),
        })
        await db.commit()
        return status if owned else "discarded"
    owned = await _owned_update(db, job, {
        "embedding": vector,
        "embedding_model": EMBEDDING_MODEL,
        "index_status": "ready",
        "indexed_at": _now(),
        "claim_token": None,
        "claim_owner": None,
        "lease_expires_at": None,
        "next_attempt_at": None,
        "last_error": None,
        "token_count": max(1, len(job["text"]) // 3),
    })
    await db.commit()
    return "ready" if owned else "discarded"


async def process_index_queue(
    db,
    client,
    *,
    limit=16,
    pause_seconds=0.0,
    version_ids=None,
    business_id=None,
    worker_id=None,
    backoff_seconds=None,
):
    """Claim jobs, call the provider outside a transaction, then save only as the owner."""
    if not enabled():
        return _empty_counts(reason="flag_off")
    worker = worker_id or os.getenv("BILIGN_RAG_WORKER_ID") or "rag-worker"
    try:
        claimed = await _claim_batch(
            db,
            worker_id=worker,
            limit=limit,
            business_id=business_id,
            version_ids=version_ids,
        )
    except (ProgrammingError, OperationalError) as exc:
        await db.rollback()
        if _chunk_table_missing(exc):
            return _empty_counts(reason="schema_missing")
        raise
    counts = _empty_counts()
    calls = 0
    for job in claimed:
        if not await _renew_lease(db, job):
            counts["discarded"] += 1
            continue
        current = await _read_job(db, job["id"])
        source = await _read_source(db, job["knowledge_version_id"])
        await db.commit()
        if not _job_matches(job, current, source):
            outcome = await _finish_job(db, job, backoff_seconds=backoff_seconds, error="source_not_eligible")
            counts["retired" if outcome == "retired" else "discarded"] += 1
            continue
        reused = await _reusable_embedding(db, job["business_id"], job["content_hash"], job["id"])
        await db.commit()
        vector = reused
        if vector is None:
            if pause_seconds and calls:
                import asyncio
                await asyncio.sleep(pause_seconds)
            if not await _renew_lease(db, job):
                counts["discarded"] += 1
                continue
            current = await _read_job(db, job["id"])
            source = await _read_source(db, job["knowledge_version_id"])
            await db.commit()
            if not _job_matches(job, current, source):
                outcome = await _finish_job(db, job, backoff_seconds=backoff_seconds, error="source_not_eligible")
                counts["retired" if outcome == "retired" else "discarded"] += 1
                continue
            try:
                result = await client.embed_texts([job["text"]])
            except Exception:
                result = {"ok": False}
            calls += 1
            vectors = result.get("vectors") if isinstance(result, dict) and result.get("ok") else None
            candidate = vectors[0] if vectors else None
            model_name = result.get("model_name") if isinstance(result, dict) else None
            if model_name not in (None, EMBEDDING_MODEL) or not _vector_ok(candidate):
                vector = None
            else:
                vector = candidate
        outcome = await _finish_job(
            db,
            job,
            backoff_seconds=backoff_seconds,
            vector=vector,
            error=None if vector else "embedding_failed",
        )
        if outcome == "ready":
            counts["embedded"] += 1
        elif outcome == "failed":
            counts["failed"] += 1
        elif outcome == "exhausted":
            counts["exhausted"] += 1
        elif outcome == "retired":
            counts["retired"] += 1
        else:
            counts["discarded"] += 1
    return counts


def _actionable(now):
    return _claimable(now)


async def _versions_needing_index(db, limit):
    now = _now()
    actionable = (
        select(func.count(Chunk.id))
        .where(Chunk.knowledge_version_id == Knowledge.id, _actionable(now))
        .scalar_subquery()
    )
    present = (
        select(func.count(Chunk.id))
        .where(Chunk.knowledge_version_id == Knowledge.id)
        .scalar_subquery()
    )
    query = (
        select(Knowledge)
        .join(BusinessProfile, BusinessProfile.id == Knowledge.business_id)
        .join(Organization, Organization.id == Knowledge.business_id)
        .where(
            Knowledge.status == "published",
            Knowledge.public_allowed.is_(True),
            Knowledge.approved_by.is_not(None),
            BusinessProfile.status == "active",
            Organization.status == "active",
            or_(present == 0, actionable > 0),
        )
        .order_by(Knowledge.created_at, Knowledge.id)
        .limit(limit)
        .execution_options(populate_existing=True)
    )
    return (await db.scalars(query)).all()


async def reconcile_index(db):
    """Retire chunks whose committed source is no longer retrievable. No provider call."""
    if not enabled():
        return {"retired": 0, "reason": "flag_off"}
    rows = (await db.scalars(
        select(Chunk.knowledge_version_id)
        .where(Chunk.index_status != "retired")
        .distinct()
    )).all()
    retired = 0
    for version_id in rows:
        source = await _read_source(db, version_id)
        if _source_ok(source):
            continue
        await _retire_version(db, version_id)
        retired += 1
    await db.commit()
    return {"retired": retired}


async def backfill_public_knowledge(db, client, *, limit=20, pause_seconds=0.0, backoff_seconds=None, worker_id=None):
    """Rebuild missing queues, then embed a bounded batch. Exhausted jobs do not consume the batch."""
    if not enabled():
        return _empty_counts(reason="flag_off")
    try:
        await reconcile_index(db)
        versions = await _versions_needing_index(db, limit)
        version_ids = [version.id for version in versions]
        for version in versions:
            await sync_version(db, version)
        await db.commit()
    except (ProgrammingError, OperationalError) as exc:
        await db.rollback()
        if _chunk_table_missing(exc):
            return _empty_counts(reason="schema_missing")
        raise
    return await process_index_queue(
        db,
        client,
        limit=limit,
        pause_seconds=pause_seconds,
        version_ids=version_ids,
        backoff_seconds=backoff_seconds,
        worker_id=worker_id,
    )


async def queue_snapshot(db, business_id=None):
    """Counts for pending work, expired leases, and retries that will not run again."""
    now = _now()
    query = select(Chunk.index_status, Chunk.attempts, Chunk.lease_expires_at)
    if business_id is not None:
        query = query.where(Chunk.business_id == _uuid(business_id))
    rows = (await db.execute(query)).all()
    snapshot = {"pending": 0, "leased": 0, "lease_expired": 0, "failed": 0, "exhausted": 0, "ready": 0, "retired": 0}
    for status, _attempts, lease_expires_at in rows:
        if status == "leased" and lease_expires_at is not None and lease_expires_at <= now:
            snapshot["lease_expired"] += 1
        elif status in snapshot:
            snapshot[status] += 1
    return snapshot


async def current_public_chunks(db, business_id):
    """Chunks that may be retrieved for one active tenant. Not used by the live answer path."""
    business_id = _uuid(business_id)
    query = (
        select(Chunk)
        .join(Knowledge, Knowledge.id == Chunk.knowledge_version_id)
        .join(BusinessProfile, BusinessProfile.id == Knowledge.business_id)
        .join(Organization, Organization.id == Knowledge.business_id)
        .where(
            Chunk.business_id == business_id,
            Knowledge.business_id == business_id,
            Chunk.item_id == Knowledge.item_id,
            Knowledge.status == "published",
            Knowledge.public_allowed.is_(True),
            Knowledge.approved_by.is_not(None),
            BusinessProfile.status == "active",
            Organization.status == "active",
            Chunk.index_status == "ready",
            Chunk.embedding.is_not(None),
        )
        .order_by(Knowledge.item_id, Chunk.chunk_index)
        .execution_options(populate_existing=True)
    )
    return (await db.scalars(query)).all()
