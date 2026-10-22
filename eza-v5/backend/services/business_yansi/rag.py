"""Business knowledge index. Off unless BILIGN_BUSINESS_RAG_ENABLED is true.

Saving a record only queues chunk rows. Embedding runs in process_index_queue
or backfill_public_knowledge, never inside the answer, Studio, or Discover path.
Do not run the backfill against production in this stage.
"""
import asyncio
import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select

from backend.core.llm.providers.openai_client import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL
from backend.models.business_yansi import BusinessKnowledgeChunk as Chunk, BusinessKnowledgeVersion as Knowledge
from backend.services.business_yansi.chunking import split_knowledge

MAX_ATTEMPTS = 5
logger = logging.getLogger(__name__)


def enabled():
    return os.getenv("BILIGN_BUSINESS_RAG_ENABLED", "false").strip().lower() in {"1", "true", "yes", "on"}


def _uuid(value):
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def _eligible(version):
    """Published, public, and approved. Verified is not required."""
    return bool(
        version
        and version.status == "published"
        and version.public_allowed
        and version.approved_by is not None
    )


def _digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def _reusable_embedding(db, business_id, digest):
    return await db.scalar(
        select(Chunk.embedding).where(
            Chunk.business_id == business_id,
            Chunk.content_hash == digest,
            Chunk.embedding_model == EMBEDDING_MODEL,
            Chunk.index_status == "ready",
            Chunk.embedding.is_not(None),
        ).limit(1)
    )


async def _retire_version(db, version_id):
    rows = (await db.scalars(
        select(Chunk).where(Chunk.knowledge_version_id == version_id, Chunk.index_status != "retired")
    )).all()
    for row in rows:
        row.index_status = "retired"
        row.last_error = None


async def sync_version(db, version):
    """Write or retire chunk rows for one version. Does not call the embedding provider."""
    if not _eligible(version):
        await _retire_version(db, version.id)
        return
    desired = split_knowledge(version.title, version.category or "", version.content)
    existing = {
        row.chunk_index: row
        for row in (await db.scalars(select(Chunk).where(Chunk.knowledge_version_id == version.id))).all()
    }
    for index, text in enumerate(desired):
        digest = _digest(text)
        row = existing.get(index)
        if (
            row
            and row.content_hash == digest
            and row.embedding_model == EMBEDDING_MODEL
            and row.index_status == "ready"
            and row.embedding
        ):
            continue
        same_job = (
            row is not None
            and row.content_hash == digest
            and row.embedding_model == EMBEDDING_MODEL
            and row.index_status in {"pending", "failed"}
        )
        if row is None:
            row = Chunk(
                id=uuid.uuid4(),
                business_id=version.business_id,
                knowledge_version_id=version.id,
                item_id=version.item_id,
                chunk_index=index,
                attempts=0,
                text=text,
                content_hash=digest,
                embedding_model=EMBEDDING_MODEL,
                token_count=max(1, len(text) // 3),
                index_status="pending",
            )
            db.add(row)
        reused = None if same_job else await _reusable_embedding(db, version.business_id, digest)
        row.business_id = version.business_id
        row.item_id = version.item_id
        row.chunk_index = index
        row.text = text
        row.content_hash = digest
        row.embedding_model = EMBEDDING_MODEL
        row.token_count = max(1, len(text) // 3)
        if reused:
            row.embedding = list(reused)
            row.index_status = "ready"
            row.indexed_at = datetime.now(timezone.utc)
            row.last_error = None
            await db.flush()
        elif same_job:
            continue
        else:
            row.embedding = None
            row.index_status = "pending"
            row.indexed_at = None
            row.last_error = None
            row.attempts = 0
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


def _queue_query(version_ids=None, business_id=None):
    query = select(Chunk).where(
        Chunk.index_status.in_(("pending", "failed")),
        Chunk.attempts < MAX_ATTEMPTS,
    )
    if version_ids is not None:
        query = query.where(Chunk.knowledge_version_id.in_(version_ids))
    if business_id is not None:
        query = query.where(Chunk.business_id == _uuid(business_id))
    if version_ids is not None and not version_ids:
        query = query.where(Chunk.id.is_(None))
    return query.order_by(Chunk.created_at, Chunk.chunk_index)


async def process_index_queue(db, client, *, limit=16, pause_seconds=0.0, version_ids=None, business_id=None):
    """Embed pending chunks. A provider failure leaves the knowledge row in place."""
    if not enabled():
        return {"embedded": 0, "failed": 0, "retired": 0, "reason": "flag_off"}
    query = _queue_query(version_ids, business_id).limit(limit)
    bind = db.get_bind()
    if bind is not None and bind.dialect.name == "postgresql":
        query = query.with_for_update(skip_locked=True)
    rows = (await db.scalars(query)).all()
    embedded = failed = retired = api_calls = 0
    for row in rows:
        version = await db.get(Knowledge, row.knowledge_version_id)
        if version is None or version.business_id != row.business_id or not _eligible(version):
            row.index_status = "retired"
            row.last_error = None
            retired += 1
            continue
        if pause_seconds and api_calls:
            await asyncio.sleep(pause_seconds)
            version = await db.get(Knowledge, row.knowledge_version_id)
            if version is None or version.business_id != row.business_id or not _eligible(version):
                row.index_status = "retired"
                row.last_error = None
                retired += 1
                continue
        try:
            result = await client.embed_texts([row.text])
        except Exception:
            result = {"ok": False}
        api_calls += 1
        vectors = result.get("vectors") if isinstance(result, dict) and result.get("ok") else None
        vector = vectors[0] if vectors else None
        if not isinstance(vector, list) or len(vector) != EMBEDDING_DIMENSIONS:
            row.attempts = (row.attempts or 0) + 1
            row.index_status = "failed"
            row.last_error = "embedding_failed"
            failed += 1
            continue
        row.embedding = vector
        row.index_status = "ready"
        row.embedding_model = EMBEDDING_MODEL
        row.indexed_at = datetime.now(timezone.utc)
        row.last_error = None
        usage = result.get("usage") or {}
        if usage.get("prompt_tokens"):
            row.token_count = int(usage["prompt_tokens"])
        embedded += 1
    await db.commit()
    return {"embedded": embedded, "failed": failed, "retired": retired}


async def _versions_needing_index(db, limit):
    pending = (
        select(func.count(Chunk.id))
        .where(
            Chunk.knowledge_version_id == Knowledge.id,
            Chunk.index_status.in_(("pending", "failed")),
        )
        .scalar_subquery()
    )
    present = (
        select(func.count(Chunk.id))
        .where(Chunk.knowledge_version_id == Knowledge.id)
        .scalar_subquery()
    )
    query = (
        select(Knowledge)
        .where(
            Knowledge.status == "published",
            Knowledge.public_allowed.is_(True),
            Knowledge.approved_by.is_not(None),
            or_(present == 0, pending > 0),
        )
        .order_by(Knowledge.created_at, Knowledge.id)
        .limit(limit)
    )
    return (await db.scalars(query)).all()


async def backfill_public_knowledge(db, client, *, limit=20, pause_seconds=0.0):
    """Idempotent, rate-limited indexing of current public knowledge. Not invoked on import."""
    if not enabled():
        return {"embedded": 0, "failed": 0, "retired": 0, "reason": "flag_off"}
    versions = await _versions_needing_index(db, limit)
    for version in versions:
        await sync_version(db, version)
    await db.commit()
    return await process_index_queue(
        db,
        client,
        limit=limit,
        pause_seconds=pause_seconds,
        version_ids=[version.id for version in versions],
    )


async def current_public_chunks(db, business_id):
    """Chunks that may be retrieved for one tenant. Not used by the live answer path."""
    business_id = _uuid(business_id)
    query = (
        select(Chunk)
        .join(Knowledge, Knowledge.id == Chunk.knowledge_version_id)
        .where(
            Chunk.business_id == business_id,
            Knowledge.business_id == business_id,
            Knowledge.status == "published",
            Knowledge.public_allowed.is_(True),
            Knowledge.approved_by.is_not(None),
            Chunk.index_status == "ready",
        )
        .order_by(Knowledge.item_id, Chunk.chunk_index)
    )
    return (await db.scalars(query)).all()
