"""Isolated PostgreSQL E2E for Yansı V2 bundle-scoped retrieval (Stage 3A).

Requires disposable Postgres URL. Never reads DATABASE_URL / production URLs.
Skips clearly when unavailable — mock suites are not E2E proof.
"""
from __future__ import annotations

import hashlib
import os
import uuid
from contextlib import asynccontextmanager

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from backend.core.utils.dependencies import Base
from backend.models.business_yansi import (
    BusinessKnowledgeChunk,
    BusinessKnowledgeVersion,
    BusinessMember,
    BusinessProfile,
)
from backend.models.production import Organization, User
from backend.services.business_yansi.chunking import split_knowledge
from backend.services.business_yansi.retrieval import (
    authorize_retrieved_sources,
    list_sibling_chunks,
    search_public_knowledge,
)


def _env_url() -> str:
    for name in (
        "BILIGN_YANSI_V2_PG_TEST_URL",
        "BILIGN_COVER_RETARGET_TEST_URL",
        "BUSINESS_STUDIO_TEST_POSTGRES_URL",
        "BUSINESS_VIDEO_AUTH_TEST_POSTGRES_URL",
    ):
        raw = os.getenv(name, "").strip()
        if raw:
            return raw
    return ""


def _require_url() -> str:
    raw = _env_url()
    if not raw:
        pytest.skip(
            "BLOCKED: izole PostgreSQL yok — BILIGN_YANSI_V2_PG_TEST_URL "
            "(veya BILIGN_COVER_RETARGET_TEST_URL) ayarlanmadı. "
            "Gerçek retrieval E2E bu ortamda ÇALIŞTIRILMADI."
        )
    if raw.startswith("postgresql://"):
        raw = "postgresql+asyncpg://" + raw[len("postgresql://"):]
    if not raw.startswith("postgresql+asyncpg://"):
        pytest.skip("BLOCKED: disposable PostgreSQL URL must use the postgresql scheme")
    url = make_url(raw)
    if url.host not in {"127.0.0.1", "localhost", "::1"}:
        pytest.skip("BLOCKED: disposable PostgreSQL host must be localhost")
    return raw


def _digest(text_value: str) -> str:
    return hashlib.sha256(text_value.encode("utf-8")).hexdigest()


def _allow_text_vector_without_pgvector():
    """Disposable schemas: embedding column as TEXT when system pgvector is absent."""
    from sqlalchemy.ext.compiler import compiles

    from backend.models.business_yansi import Vector1536

    @compiles(Vector1536, "postgresql")
    def _pg_vector_as_text(type_, compiler, **kw):  # noqa: ARG001
        return "TEXT"


@asynccontextmanager
async def _database():
    url = _require_url()
    _allow_text_vector_without_pgvector()
    schema = "yansi_v2_" + uuid.uuid4().hex[:12]
    engine = create_async_engine(
        url,
        connect_args={"server_settings": {"search_path": schema}},
    )
    async with engine.begin() as conn:
        await conn.execute(CreateSchema(schema))
        await conn.run_sync(
            lambda sync: Base.metadata.create_all(
                sync,
                tables=[
                    User.__table__,
                    Organization.__table__,
                    BusinessProfile.__table__,
                    BusinessMember.__table__,
                    BusinessKnowledgeVersion.__table__,
                    BusinessKnowledgeChunk.__table__,
                ],
            )
        )
    Session = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with Session() as db:
            yield db
    finally:
        async with engine.begin() as conn:
            await conn.execute(DropSchema(schema, cascade=True))
        await engine.dispose()


async def _seed(db):
    owner = User(id=uuid.uuid4(), email=f"o-{uuid.uuid4().hex}@t.test", role="user", is_active=True)
    other_user = User(id=uuid.uuid4(), email=f"x-{uuid.uuid4().hex}@t.test", role="user", is_active=True)
    org = Organization(id=uuid.uuid4(), name="A", status="active")
    org_b = Organization(id=uuid.uuid4(), name="B", status="active")
    biz = BusinessProfile(
        id=org.id, slug=f"a-{uuid.uuid4().hex[:6]}", name="A", owner_id=owner.id, status="active",
    )
    biz_b = BusinessProfile(
        id=org_b.id, slug=f"b-{uuid.uuid4().hex[:6]}", name="B", owner_id=other_user.id, status="active",
    )
    db.add_all([owner, other_user, org, org_b])
    await db.flush()
    db.add_all([biz, biz_b])
    await db.flush()

    item_a = uuid.uuid4()
    item_b = uuid.uuid4()
    item_foreign = uuid.uuid4()
    content_a = "WX-100 için garanti 2 yıldır. Fatura gerekir."
    content_b = "WX-200 için garanti 3 yıldır."
    content_foreign = "Foreign tenant secret warranty 9 years."

    kv_a = BusinessKnowledgeVersion(
        id=uuid.uuid4(), business_id=biz.id, item_id=item_a, version=1,
        title="WX-100", category="garanti", content=content_a, source="pool",
        public_allowed=False, status="published", created_by=owner.id, approved_by=owner.id,
    )
    kv_b = BusinessKnowledgeVersion(
        id=uuid.uuid4(), business_id=biz.id, item_id=item_b, version=1,
        title="WX-200", category="garanti", content=content_b, source="pool",
        public_allowed=True, status="published", created_by=owner.id, approved_by=owner.id,
    )
    kv_foreign = BusinessKnowledgeVersion(
        id=uuid.uuid4(), business_id=biz_b.id, item_id=item_foreign, version=1,
        title="Secret", category="garanti", content=content_foreign, source="pool",
        public_allowed=True, status="published", created_by=other_user.id, approved_by=other_user.id,
    )
    db.add_all([kv_a, kv_b, kv_foreign])
    await db.flush()

    async def add_chunks(kv, business_id):
        parts = split_knowledge(kv.title, kv.category, kv.content)
        for index, part in enumerate(parts):
            db.add(BusinessKnowledgeChunk(
                id=uuid.uuid4(),
                business_id=business_id,
                knowledge_version_id=kv.id,
                item_id=kv.item_id,
                chunk_index=index,
                text=part,
                content_hash=_digest(part),
                index_status="ready",
                token_count=max(1, len(part.split())),
            ))

    await add_chunks(kv_a, biz.id)
    await add_chunks(kv_b, biz.id)
    await add_chunks(kv_foreign, biz_b.id)
    await db.commit()
    return {
        "biz": biz,
        "biz_b": biz_b,
        "kv_a": kv_a,
        "kv_b": kv_b,
        "kv_foreign": kv_foreign,
        "content_a": content_a,
    }


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ANSWERS_ENABLED", "true")


@pytest.mark.asyncio
async def test_postgres_bundle_allowlist_filters_at_sql(enabled):
    async with _database() as db:
        seed = await _seed(db)
        biz = seed["biz"]
        kv_a = seed["kv_a"]
        kv_b = seed["kv_b"]

        # Bundle A allowlist: only kv_a (private knowledge is OK under allowlist join).
        found = await search_public_knowledge(
            db,
            biz.id,
            "garanti",
            allowed_knowledge_version_ids=[kv_a.id],
        )
        assert found["reason"] in {None, "low_relevance"}
        ids = {row["knowledge_version_id"] for row in found["results"]}
        assert str(kv_a.id) in ids
        assert str(kv_b.id) not in ids

        # Without allowlist (V1): private kv_a excluded by public_allowed; kv_b visible.
        v1 = await search_public_knowledge(db, biz.id, "garanti")
        v1_ids = {row["knowledge_version_id"] for row in v1["results"]}
        assert str(kv_b.id) in v1_ids
        assert str(kv_a.id) not in v1_ids


@pytest.mark.asyncio
async def test_postgres_sibling_and_authorize_respect_allowlist(enabled):
    async with _database() as db:
        seed = await _seed(db)
        biz = seed["biz"]
        kv_a = seed["kv_a"]
        kv_b = seed["kv_b"]

        siblings = await list_sibling_chunks(
            db,
            biz.id,
            [kv_a.id, kv_b.id],
            allowed_knowledge_version_ids=[kv_a.id],
        )
        assert siblings["reason"] in {None, "empty"}
        assert all(str(c["knowledge_version_id"]) == str(kv_a.id) for c in siblings["chunks"])

        # Craft a retrieved row for kv_b and ensure authorize with allowlist rejects it.
        bad = {
            "business_id": str(biz.id),
            "item_id": str(kv_b.item_id),
            "knowledge_version_id": str(kv_b.id),
            "chunk_id": str(uuid.uuid4()),
            "title": kv_b.title,
            "text": "WX-200 için garanti 3 yıldır.",
        }
        # Real chunk from kv_a
        listed = await list_sibling_chunks(db, biz.id, [kv_a.id], allowed_knowledge_version_ids=[kv_a.id])
        assert listed["chunks"]
        good = listed["chunks"][0]
        auth = await authorize_retrieved_sources(
            db,
            biz.id,
            [good, bad],
            allowed_knowledge_version_ids=[kv_a.id],
        )
        kept = {str(s["knowledge_version_id"]) for s in auth["sources"]}
        assert str(kv_a.id) in kept
        assert str(kv_b.id) not in kept


@pytest.mark.asyncio
async def test_postgres_foreign_tenant_not_returned(enabled):
    async with _database() as db:
        seed = await _seed(db)
        biz = seed["biz"]
        foreign = seed["kv_foreign"]
        found = await search_public_knowledge(
            db,
            biz.id,
            "warranty",
            allowed_knowledge_version_ids=[foreign.id],
        )
        # Allowlist asks for foreign id but JOIN still requires business_id = biz.
        assert found["results"] == []


@pytest.mark.asyncio
async def test_postgres_revoked_ready_filter(enabled):
    async with _database() as db:
        seed = await _seed(db)
        biz = seed["biz"]
        kv_a = seed["kv_a"]
        # Retire chunks → must disappear from retrieval.
        await db.execute(
            text(
                "UPDATE business_knowledge_chunks SET index_status = 'retired' "
                "WHERE knowledge_version_id = :vid"
            ),
            {"vid": kv_a.id},
        )
        await db.commit()
        found = await search_public_knowledge(
            db,
            biz.id,
            "garanti",
            allowed_knowledge_version_ids=[kv_a.id],
        )
        assert found["results"] == []
