"""PostgreSQL checks for the Business RAG migration and worker.

Missing pgvector in CI is BLOCKED, not a skipped success. Local runs without a
server also report BLOCKED and skip only outside CI.
"""
from __future__ import annotations

import asyncio
import os
import re
import subprocess
import sys
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.core.llm.providers.openai_client import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL
from backend.models.business_yansi import canonical_embedding
from backend.services.business_yansi import rag
from backend.services.business_yansi.chunking import split_knowledge
from backend.services.business_yansi.retrieval import (
    FOLD_FROM,
    FOLD_TO,
    FULLTEXT_SQL,
    VECTOR_SQL,
    authorize_retrieved_sources,
    fold_turkish,
    search_public_knowledge,
)


def rag_chunk(content):
    parts = split_knowledge("Başlık", "", content)
    assert len(parts) == 1
    return parts[0]


BACKEND = Path(__file__).resolve().parents[1]
PHASE42_REVISION = "add_mirror_journey_phase42_eza_snapshot"
PARENT_REVISION = "add_business_studio_v2"


def _redact(value):
    return re.sub(r"postgresql(?:\+\w+)?://\S+", "postgresql://redacted", value or "")


def _async_url(url):
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _has_vector(url):
    engine = create_engine(url)
    try:
        with engine.connect() as connection:
            return bool(connection.execute(text("SELECT 1 FROM pg_available_extensions WHERE name = 'vector'")).scalar())
    except Exception:
        return False
    finally:
        engine.dispose()


@contextmanager
def _disposable(admin_url):
    maintenance = make_url(admin_url)
    name = f"eza_rag_{uuid.uuid4().hex[:10]}"
    admin = create_engine(maintenance, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}"'))
    target = maintenance.set(database=name).render_as_string(hide_password=False)
    try:
        yield target
    finally:
        with admin.connect() as connection:
            connection.execute(
                text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :name AND pid <> pg_backend_pid()"),
                {"name": name},
            )
            connection.execute(text(f'DROP DATABASE IF EXISTS "{name}"'))
        admin.dispose()


def _alembic(args, database_url):
    env = os.environ.copy()
    env["DATABASE_URL"] = _async_url(database_url)
    env["EZA_ENV"] = "ci"
    env["ENV"] = "ci"
    env["BILIGN_BUSINESS_RAG_ENABLED"] = "false"
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=str(BACKEND),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def _revision(url):
    engine = create_engine(url)
    with engine.connect() as connection:
        value = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
    engine.dispose()
    return value


def _stamp_from_phase42(url):
    """Match the CI capacity path: stamp, then the parent tables later migrations reference."""
    stamped = _alembic(["stamp", PHASE42_REVISION], url)
    assert stamped.returncode == 0, _redact(stamped.stderr or stamped.stdout)[-2000:]
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE IF NOT EXISTS production_users (id UUID PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE IF NOT EXISTS production_organizations (id UUID PRIMARY KEY)"))
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS mirror_network_nodes (id UUID PRIMARY KEY, slug VARCHAR(64) UNIQUE)"
        ))
        connection.execute(text(
            """
            CREATE TABLE IF NOT EXISTS conversation_groups (
                id UUID PRIMARY KEY,
                user_id UUID REFERENCES production_users(id) ON DELETE CASCADE,
                guest_token VARCHAR(128),
                title VARCHAR(120) NOT NULL,
                source VARCHAR(20) NOT NULL DEFAULT 'manual',
                parent_group_id UUID,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            )
            """
        ))
    engine.dispose()


def _ci_required():
    return any(os.getenv(name, "").strip().lower() in {"1", "true", "yes", "ci"} for name in ("CI", "GITHUB_ACTIONS", "EZA_ENV"))


def _require_database(url, reason):
    if url:
        return url
    message = f"BLOCKED: {reason}"
    if _ci_required():
        pytest.fail(message)
    pytest.skip(message)


def _plain_url():
    explicit = os.getenv("EZA_MIGRATION_PLAIN_DATABASE_URL")
    if explicit:
        return explicit
    shared = os.getenv("EZA_MIGRATION_TEST_DATABASE_URL")
    if shared and not _has_vector(shared):
        return shared
    return None


def _vector_url():
    for name in ("EZA_PGVECTOR_TEST_URL", "EZA_MIGRATION_TEST_DATABASE_URL"):
        candidate = os.getenv(name)
        if candidate and _has_vector(candidate):
            return candidate
    return None


def test_migration_fails_clearly_without_pgvector():
    admin = _require_database(_plain_url(), "plain PostgreSQL without pgvector is not configured")
    with _disposable(admin) as url:
        _stamp_from_phase42(url)
        failed = _alembic(["upgrade", "head"], url)
        output = _redact((failed.stderr or "") + (failed.stdout or ""))
        assert failed.returncode != 0
        assert "pgvector" in output.lower()
        assert "revision was not applied" in output
        assert _revision(url) in {PHASE42_REVISION, PARENT_REVISION}
        assert _revision(url) != "add_business_knowledge_chunks_v1"
        engine = create_engine(url)
        with engine.connect() as connection:
            present = connection.execute(text(
                "SELECT 1 FROM information_schema.tables WHERE table_name = 'business_knowledge_chunks'"
            )).scalar()
            knowledge_table = connection.execute(text(
                "SELECT 1 FROM information_schema.tables WHERE table_name = 'business_knowledge_versions'"
            )).scalar()
            knowledge_rows = (
                connection.execute(text("SELECT count(*) FROM business_knowledge_versions")).scalar()
                if knowledge_table else 0
            )
        engine.dispose()
        assert present is None
        assert knowledge_rows == 0


def test_pgvector_migration_upgrade_downgrade_and_hnsw():
    admin = _require_database(_vector_url(), "PostgreSQL with the pgvector package is not available")
    with _disposable(admin) as url:
        _stamp_from_phase42(url)
        upgraded = _alembic(["upgrade", "head"], url)
        assert upgraded.returncode == 0, _redact(upgraded.stderr or upgraded.stdout)[-2000:]
        engine = create_engine(url)
        with engine.connect() as connection:
            column = connection.execute(text(
                "SELECT format_type(a.atttypid, a.atttypmod) "
                "FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid "
                "WHERE c.relname = 'business_knowledge_chunks' AND a.attname = 'embedding'"
            )).scalar()
            indexdef = connection.execute(text(
                "SELECT indexdef FROM pg_indexes WHERE indexname = 'ix_business_knowledge_chunks_embedding'"
            )).scalar()
            before = connection.execute(text("SELECT count(*) FROM business_knowledge_versions")).scalar()
        assert column == "vector(1536)"
        assert "hnsw" in indexdef and "vector_cosine_ops" in indexdef
        engine.dispose()
        downgraded = _alembic(["downgrade", PARENT_REVISION], url)
        assert downgraded.returncode == 0, _redact(downgraded.stderr or downgraded.stdout)[-2000:]
        engine = create_engine(url)
        with engine.connect() as connection:
            present = connection.execute(text(
                "SELECT 1 FROM information_schema.tables WHERE table_name = 'business_knowledge_chunks'"
            )).scalar()
            after = connection.execute(text("SELECT count(*) FROM business_knowledge_versions")).scalar()
        engine.dispose()
        assert present is None
        assert after == before
        again = _alembic(["upgrade", "head"], url)
        assert again.returncode == 0, _redact(again.stderr or again.stdout)[-2000:]


class _Embedder:
    def __init__(self, delay=0, revoke=None):
        self.calls = 0
        self.texts = []
        self.delay = delay
        self.revoke = revoke

    async def embed_texts(self, texts):
        self.calls += 1
        self.texts.extend(texts)
        if self.revoke:
            await self.revoke()
        if self.delay:
            await asyncio.sleep(self.delay)
        return {"ok": True, "vectors": [[0.02] * EMBEDDING_DIMENSIONS for _ in texts], "model_name": EMBEDDING_MODEL}


def _ids():
    return {
        "user": uuid.uuid4(),
        "org": uuid.uuid4(),
        "knowledge": uuid.uuid4(),
        "item": uuid.uuid4(),
        "chunk": uuid.uuid4(),
    }


def _seed(url, ids, content="PostgreSQL izin metni kalır."):
    """The phase42 stamp omits pre-phase42 user and organization columns. Add the status column the live model already has."""
    chunk_text = rag_chunk(content)
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE production_organizations ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active'"
        ))
        connection.execute(text("INSERT INTO production_users (id) VALUES (:id)"), {"id": ids["user"]})
        connection.execute(text(
            "INSERT INTO production_organizations (id, status) VALUES (:id, 'active')"
        ), {"id": ids["org"]})
        connection.execute(text(
            "INSERT INTO business_profiles (id, slug, name, description, owner_id, verified, official, status) "
            "VALUES (:id, :slug, 'Marka', '', :owner, false, false, 'active')"
        ), {"id": ids["org"], "slug": ids["org"].hex[:12], "owner": ids["user"]})
        connection.execute(text(
            "INSERT INTO business_knowledge_versions "
            "(id, business_id, item_id, version, title, category, content, source, public_allowed, status, created_by, approved_by, revision) "
            "VALUES (:id, :business, :item, 1, 'Başlık', '', :content, 'katalog', true, 'published', :user, :user, 1)"
        ), {"id": ids["knowledge"], "business": ids["org"], "item": ids["item"], "content": content, "user": ids["user"]})
        connection.execute(text(
            "INSERT INTO business_knowledge_chunks "
            "(id, business_id, knowledge_version_id, item_id, chunk_index, text, content_hash, embedding_model, token_count, index_status, attempts) "
            "VALUES (:id, :business, :knowledge, :item, 0, :text, :hash, :model, 8, 'pending', 0)"
        ), {
            "id": ids["chunk"],
            "business": ids["org"],
            "knowledge": ids["knowledge"],
            "item": ids["item"],
            "text": chunk_text,
            "hash": rag._digest(chunk_text),
            "model": EMBEDDING_MODEL,
        })
    engine.dispose()


@pytest.mark.asyncio
async def test_postgres_worker_isolation_lease_and_flag():
    admin = _require_database(_vector_url(), "PostgreSQL with the pgvector package is not available")
    with _disposable(admin) as url:
        _stamp_from_phase42(url)
        upgraded = _alembic(["upgrade", "head"], url)
        assert upgraded.returncode == 0, _redact(upgraded.stderr or upgraded.stdout)[-2000:]
        ids = _ids()
        _seed(url, ids)
        engine = create_async_engine(_async_url(url))
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        previous = os.environ.get("BILIGN_BUSINESS_RAG_ENABLED")
        try:
            os.environ["BILIGN_BUSINESS_RAG_ENABLED"] = "false"
            async with sessions() as db:
                skipped = await rag.process_index_queue(db, _Embedder(), backoff_seconds=0)
            assert skipped["reason"] == "flag_off"
            os.environ["BILIGN_BUSINESS_RAG_ENABLED"] = "true"
            first = _Embedder(delay=0.2)
            second = _Embedder(delay=0.2)
            async with sessions() as left, sessions() as right:
                await asyncio.gather(
                    rag.process_index_queue(left, first, worker_id="left", backoff_seconds=0),
                    rag.process_index_queue(right, second, worker_id="right", backoff_seconds=0),
                )
            assert first.calls + second.calls == 1
            async with engine.connect() as connection:
                status = (await connection.execute(text(
                    "SELECT index_status FROM business_knowledge_chunks WHERE id = :id"
                ), {"id": ids["chunk"]})).scalar()
            assert status == "ready"

            revoked = _ids()
            _seed(url, revoked, content="Bu metin çağrı sırasında gizlenir.")

            async def hide():
                async with sessions() as db:
                    await db.execute(text(
                        "UPDATE business_knowledge_versions SET public_allowed = false WHERE id = :id"
                    ), {"id": revoked["knowledge"]})
                    await db.commit()

            hider = _Embedder(revoke=hide)
            async with sessions() as db:
                outcome = await rag.process_index_queue(db, hider, backoff_seconds=0, worker_id="revoker")
            assert hider.calls == 1 and outcome["embedded"] == 0
            async with sessions() as db:
                visible = await rag.current_public_chunks(db, revoked["org"])
            assert revoked["knowledge"] not in {row.knowledge_version_id for row in visible}

            expired = _ids()
            _seed(url, expired, content="Lease süresi dolan iş yeniden alınır.")
            async with sessions() as db:
                await db.execute(text(
                    "UPDATE business_knowledge_chunks SET index_status = 'leased', claim_token = :token, "
                    "claim_owner = 'old', lease_expires_at = :expiry, attempts = 1 WHERE id = :id"
                ), {
                    "token": uuid.uuid4(),
                    "expiry": datetime.now(timezone.utc) - timedelta(seconds=10),
                    "id": expired["chunk"],
                })
                await db.commit()
                recovered = await rag.process_index_queue(db, _Embedder(), worker_id="recovery", backoff_seconds=0)
            assert recovered["embedded"] == 1
            snapshot = None
            async with sessions() as db:
                await db.execute(text(
                    "UPDATE business_knowledge_chunks SET index_status = 'exhausted', attempts = 5 WHERE id = :id"
                ), {"id": expired["chunk"]})
                await db.commit()
                snapshot = await rag.queue_snapshot(db, expired["org"])
            assert snapshot["exhausted"] >= 1

            async with engine.connect() as connection:
                stored = (await connection.execute(text(
                    "SELECT embedding::text FROM business_knowledge_chunks WHERE id = :id"
                ), {"id": ids["chunk"]})).scalar()
            first = float(stored.strip().strip("[]").split(",")[0])
            assert abs(first - 0.02) < 1e-6
            assert "nan" not in stored.lower() and "inf" not in stored.lower()
            async with sessions() as db:
                await db.execute(text(
                    "UPDATE business_profiles SET status = 'suspended' WHERE id = :id"
                ), {"id": ids["org"]})
                await db.commit()
                assert await rag.current_public_chunks(db, ids["org"]) == []

            race = _ids()
            _seed(url, race, content="Backfill ve worker aynı işi bir kez alır.")
            filler = _Embedder()
            rival = _Embedder()
            async with sessions() as left, sessions() as right:
                await asyncio.gather(
                    rag.backfill_public_knowledge(left, filler, limit=4, backoff_seconds=0, worker_id="backfill"),
                    rag.process_index_queue(right, rival, backoff_seconds=0, worker_id="worker"),
                )
            assert filler.calls + rival.calls == 1
        finally:
            if previous is None:
                os.environ.pop("BILIGN_BUSINESS_RAG_ENABLED", None)
            else:
                os.environ["BILIGN_BUSINESS_RAG_ENABLED"] = previous
            await engine.dispose()


def _axis(index, value=1.0):
    row = [0.0] * EMBEDDING_DIMENSIONS
    row[index] = value
    return row


def _store_embedding(url, chunk_id, vector):
    rendered = canonical_embedding(vector)
    assert rendered
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text(
            "UPDATE business_knowledge_chunks SET embedding = CAST(:embedding AS vector), index_status = 'ready' WHERE id = :id"
        ), {"embedding": rendered, "id": chunk_id})
    engine.dispose()


def _insert_chunk(url, org, user, content, *, status="published", public_allowed=True, vector=None, index_status="ready", item=None, version=1):
    knowledge = uuid.uuid4()
    item = item or uuid.uuid4()
    chunk = uuid.uuid4()
    chunk_text = rag_chunk(content)
    rendered = canonical_embedding(vector) if vector is not None else None
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO business_knowledge_versions "
            "(id, business_id, item_id, version, title, category, content, source, public_allowed, status, created_by, approved_by, revision) "
            "VALUES (:id, :business, :item, :version, 'Başlık', '', :content, 'katalog', :public, :status, :user, :user, 1)"
        ), {
            "id": knowledge, "business": org, "item": item, "version": version,
            "content": content, "public": public_allowed, "status": status, "user": user,
        })
        if rendered is None:
            connection.execute(text(
                "INSERT INTO business_knowledge_chunks "
                "(id, business_id, knowledge_version_id, item_id, chunk_index, text, content_hash, embedding_model, token_count, index_status, attempts) "
                "VALUES (:id, :business, :knowledge, :item, 0, :text, :hash, :model, 8, :index_status, 0)"
            ), {
                "id": chunk, "business": org, "knowledge": knowledge, "item": item,
                "text": chunk_text, "hash": rag._digest(chunk_text), "model": EMBEDDING_MODEL,
                "index_status": index_status,
            })
        else:
            connection.execute(text(
                "INSERT INTO business_knowledge_chunks "
                "(id, business_id, knowledge_version_id, item_id, chunk_index, text, content_hash, embedding, embedding_model, token_count, index_status, attempts) "
                "VALUES (:id, :business, :knowledge, :item, 0, :text, :hash, CAST(:embedding AS vector), :model, 8, :index_status, 0)"
            ), {
                "id": chunk, "business": org, "knowledge": knowledge, "item": item,
                "text": chunk_text, "hash": rag._digest(chunk_text), "embedding": rendered,
                "model": EMBEDDING_MODEL, "index_status": index_status,
            })
    engine.dispose()
    return {"knowledge": knowledge, "item": item, "chunk": chunk, "text": chunk_text}


@pytest.mark.asyncio
async def test_hybrid_retrieval_filters_and_ranking():
    admin = _require_database(_vector_url(), "PostgreSQL with the pgvector package is not available")
    with _disposable(admin) as url:
        _stamp_from_phase42(url)
        upgraded = _alembic(["upgrade", "head"], url)
        assert upgraded.returncode == 0, _redact(upgraded.stderr or upgraded.stdout)[-2000:]
        brand = _ids()
        other = _ids()
        _seed(url, brand, content="Seramik bakım ürünü SKU-120-A fiyat 12.500 TL")
        _seed(url, other, content="Seramik bakım ürünü SKU-120-A başka marka")
        _store_embedding(url, brand["chunk"], _axis(0))
        _store_embedding(url, other["chunk"], _axis(1))
        lexical = _insert_chunk(url, brand["org"], brand["user"], "Seramik vitrin notu", vector=_axis(1))
        hidden = _insert_chunk(
            url, brand["org"], brand["user"], "ESKI_SURUM_YOK bu satir arşivdedir",
            status="archived", vector=_axis(0),
        )
        current = _insert_chunk(
            url, brand["org"], brand["user"], "Guncel surum metni yayinda",
            vector=_axis(2), item=hidden["item"], version=2,
        )
        missing = _insert_chunk(
            url, brand["org"], brand["user"], "yalnizca sozcuksel kayit",
            vector=None, index_status="ready",
        )
        private = _insert_chunk(
            url, brand["org"], brand["user"], "GIZLI_IZIN_KALDIRILDI ozel kayit",
            public_allowed=False, vector=_axis(0),
        )
        suspended = _ids()
        _seed(url, suspended, content="Askida marka metni burada")
        _store_embedding(url, suspended["chunk"], _axis(3))
        engine = create_engine(url)
        with engine.begin() as connection:
            connection.execute(text(
                "UPDATE business_profiles SET status = 'suspended' WHERE id = :id"
            ), {"id": suspended["org"]})
        engine.dispose()
        async_engine = create_async_engine(_async_url(url))
        sessions = async_sessionmaker(async_engine, expire_on_commit=False)
        previous = os.environ.get("BILIGN_BUSINESS_RAG_ENABLED")
        try:
            os.environ["BILIGN_BUSINESS_RAG_ENABLED"] = "false"
            async with sessions() as db:
                off = await search_public_knowledge(db, brand["org"], "seramik", query_vector=_axis(0), query_model=EMBEDDING_MODEL)
            assert off["reason"] == "flag_off" and off["results"] == []
            os.environ["BILIGN_BUSINESS_RAG_ENABLED"] = "true"
            async with sessions() as db:
                empty = await search_public_knowledge(db, brand["org"], "   ")
                semantic = await search_public_knowledge(db, brand["org"], "", query_vector=_axis(0, 0.9), query_model=EMBEDDING_MODEL)
                lexical_hit = await search_public_knowledge(db, brand["org"], "seramik")
                exact = await search_public_knowledge(db, brand["org"], "SKU-120-A")
                hybrid = await search_public_knowledge(db, brand["org"], "seramik SKU-120-A", query_vector=_axis(0, 0.9), query_model=EMBEDDING_MODEL)
                turkish = await search_public_knowledge(db, brand["org"], "SERAMİK")
                old = await search_public_knowledge(db, brand["org"], "ESKI_SURUM_YOK")
                fresh = await search_public_knowledge(db, brand["org"], "Guncel surum")
                words = await search_public_knowledge(db, brand["org"], "yalnizca sozcuksel")
                blocked = await search_public_knowledge(db, suspended["org"], "Askida marka")
                hidden_permission = await search_public_knowledge(db, brand["org"], "GIZLI_IZIN_KALDIRILDI")

            assert empty["reason"] == "empty_query" and empty["results"] == []
            assert semantic["results"] and semantic["results"][0]["chunk_id"] == str(brand["chunk"])
            assert all(row["business_id"] == str(brand["org"]) for row in lexical_hit["results"])
            assert "fulltext" not in lexical_hit["errors"]
            assert any("fulltext" in row["methods"] for row in lexical_hit["results"])
            assert str(other["chunk"]) not in {row["chunk_id"] for row in exact["results"]}
            assert str(brand["chunk"]) in {row["chunk_id"] for row in exact["results"]}
            assert hybrid["results"][0]["chunk_id"] == str(brand["chunk"])
            assert hybrid["results"][0]["score"] >= hybrid["results"][-1]["score"]
            assert "vector" in hybrid["results"][0]["methods"]
            assert str(lexical["chunk"]) != hybrid["results"][0]["chunk_id"]
            assert turkish["results"]
            assert all(row["chunk_id"] != str(hidden["chunk"]) for row in old["results"])
            assert any(row["chunk_id"] == str(current["chunk"]) for row in fresh["results"])
            assert any(row["chunk_id"] == str(missing["chunk"]) for row in words["results"])
            assert blocked["results"] == []
            assert hidden_permission["results"] == []
            assert str(private["chunk"]) not in {row["chunk_id"] for row in semantic["results"]}

            class Boom:
                def __init__(self, inner):
                    self.inner = inner

                def get_bind(self):
                    return self.inner.get_bind()

                async def rollback(self):
                    await self.inner.rollback()

                async def execute(self, statement, params=None, **kwargs):
                    if "<=>" in str(statement):
                        from sqlalchemy.exc import ProgrammingError
                        raise ProgrammingError("vector", {}, Exception("vector unavailable"))
                    return await self.inner.execute(statement, params, **kwargs)

            async with sessions() as db:
                failed_method = await search_public_knowledge(
                    Boom(db), brand["org"], "seramik SKU-120-A", query_vector=_axis(0), query_model=EMBEDDING_MODEL,
                )
            assert "vector" in failed_method["errors"]
            assert failed_method["results"]
            assert all(row["business_id"] == str(brand["org"]) for row in failed_method["results"])
            assert str(other["chunk"]) not in {row["chunk_id"] for row in failed_method["results"]}

            pending = _ids()
            _seed(url, pending, content="Henuz hazir olmayan kayit")
            found = {}

            async def run_search():
                async with sessions() as db:
                    found["value"] = await search_public_knowledge(db, pending["org"], "Henuz hazir")

            async def run_worker():
                async with sessions() as db:
                    await rag.process_index_queue(db, _Embedder(), business_id=pending["org"], backoff_seconds=0)

            await asyncio.gather(run_search(), run_worker())
            async with sessions() as db:
                for row in found["value"]["results"]:
                    status = (await db.execute(text(
                        "SELECT index_status FROM business_knowledge_chunks WHERE id = :id"
                    ), {"id": row["chunk_id"]})).scalar()
                    assert status == "ready"
                    assert row["business_id"] == str(pending["org"])

            engine = create_engine(url)
            with engine.begin() as connection:
                connection.execute(text(
                    "UPDATE business_knowledge_versions SET public_allowed = false WHERE id = :id"
                ), {"id": brand["knowledge"]})
            engine.dispose()
            async with sessions() as db:
                revoked = await search_public_knowledge(
                    db, brand["org"], "SKU-120-A", query_vector=_axis(0, 0.9), query_model=EMBEDDING_MODEL,
                )
            assert str(brand["chunk"]) not in {row["chunk_id"] for row in revoked["results"]}
        finally:
            if previous is None:
                os.environ.pop("BILIGN_BUSINESS_RAG_ENABLED", None)
            else:
                os.environ["BILIGN_BUSINESS_RAG_ENABLED"] = previous
            await async_engine.dispose()


def _plans(url, business_id):
    engine = create_engine(url)
    shared = {"business_id": business_id, "candidate_limit": 48}
    vector_params = {
        **shared,
        "query_vector": canonical_embedding(_axis(0)),
        "embedding_model": EMBEDDING_MODEL,
        "max_distance": 0.5,
    }
    fulltext_params = {**shared, "folded": "seramik"}

    def _explain(connection, sql, params):
        return "\n".join(row[0] for row in connection.execute(text("EXPLAIN " + sql), params))

    with engine.begin() as connection:
        connection.execute(text("ANALYZE business_knowledge_chunks"))
        default_vector = _explain(connection, VECTOR_SQL, vector_params)
        default_fulltext = _explain(connection, FULLTEXT_SQL, fulltext_params)
        connection.execute(text("SET LOCAL enable_seqscan = off"))
        forced_vector = _explain(connection, VECTOR_SQL, vector_params)
        forced_fulltext = _explain(connection, FULLTEXT_SQL, fulltext_params)
        bare_vector = _explain(connection, """
            SELECT c.id
            FROM business_knowledge_chunks c
            WHERE c.index_status = 'ready' AND c.embedding IS NOT NULL
            ORDER BY c.embedding <=> CAST(:query_vector AS vector)
            LIMIT :candidate_limit
        """, vector_params)
        bare_fulltext = _explain(connection, """
            SELECT c.id
            FROM business_knowledge_chunks c
            WHERE c.index_status = 'ready'
              AND to_tsvector('simple', c.text) @@ plainto_tsquery('simple', :folded)
        """, fulltext_params)
    engine.dispose()
    print("RAG_PLAN default_vector\n" + default_vector)
    print("RAG_PLAN default_fulltext\n" + default_fulltext)
    print("RAG_PLAN forced_vector\n" + forced_vector)
    print("RAG_PLAN forced_fulltext\n" + forced_fulltext)
    print("RAG_PLAN bare_vector\n" + bare_vector)
    print("RAG_PLAN bare_fulltext\n" + bare_fulltext)
    return forced_vector, forced_fulltext, bare_vector, bare_fulltext


@pytest.mark.asyncio
async def test_hybrid_retrieval_contracts():
    admin = _require_database(_vector_url(), "PostgreSQL with the pgvector package is not available")
    with _disposable(admin) as url:
        _stamp_from_phase42(url)
        upgraded = _alembic(["upgrade", "head"], url)
        assert upgraded.returncode == 0, _redact(upgraded.stderr or upgraded.stdout)[-2000:]
        assert _revision(url) == "add_business_yansi_media_plan_v1"
        brand = _ids()
        other = _ids()
        _seed(url, brand, content="Seramik bakım ürünü SKU-120-A fiyat 12.500 TL")
        _seed(url, other, content="Seramik bakım ürünü SKU-120-A başka marka")
        _store_embedding(url, brand["chunk"], _axis(0))
        _store_embedding(url, other["chunk"], _axis(1))
        exact = _insert_chunk(url, brand["org"], brand["user"], "kod WX-100 bitti", vector=_axis(5))
        prefix = _insert_chunk(url, brand["org"], brand["user"], "kod WX-1000 bitti", vector=_axis(6))
        spare = _insert_chunk(url, brand["org"], brand["user"], "yedek QX-200 parca", vector=_axis(7))
        accented = _insert_chunk(url, brand["org"], brand["user"], "ürün Şİ-10 listede", vector=_axis(8))
        alien = _insert_chunk(url, brand["org"], brand["user"], "seramik uzay modeli", vector=_axis(0))
        kept = _insert_chunk(
            url, brand["org"], brand["user"],
            "alfa bravo charlie delta echo foxtrot golf hotel",
        )
        late = _insert_chunk(url, brand["org"], brand["user"], "sadece india kelimesi")
        left = _insert_chunk(url, brand["org"], brand["user"], "AYNI QX-200 kaydi", vector=_axis(4))
        right = _insert_chunk(url, brand["org"], brand["user"], "AYNI QX-200 kaydi", vector=_axis(4))
        engine = create_engine(url)
        with engine.begin() as connection:
            sample = "İIŞĞÜÖÇQWXÉß ışık"
            folded = connection.execute(
                text("SELECT translate(:value, :src, :dst)"),
                {"value": sample, "src": FOLD_FROM, "dst": FOLD_TO},
            ).scalar()
            assert folded == fold_turkish(sample)
            connection.execute(text(
                "UPDATE business_knowledge_chunks SET embedding_model = 'text-embedding-3-large' WHERE id = :id"
            ), {"id": alien["chunk"]})
        engine.dispose()
        names = create_engine(url)
        with names.connect() as connection:
            indexes = {row[0] for row in connection.execute(text(
                "SELECT indexname FROM pg_indexes WHERE tablename = 'business_knowledge_chunks'"
            ))}
        names.dispose()
        assert "ix_business_knowledge_chunks_embedding" in indexes
        assert "ix_business_knowledge_chunks_text_simple" in indexes
        _forced_vector, _forced_fulltext, bare_vector, bare_fulltext = _plans(url, brand["org"])
        assert "ix_business_knowledge_chunks_embedding" in bare_vector
        assert "ix_business_knowledge_chunks_text_simple" in bare_fulltext
        async_engine = create_async_engine(_async_url(url))
        sessions = async_sessionmaker(async_engine, expire_on_commit=False)
        previous = os.environ.get("BILIGN_BUSINESS_RAG_ENABLED")

        class OtherModel:
            async def embed_texts(self, texts):
                return {"ok": True, "vectors": [_axis(0)], "model_name": "text-embedding-3-large"}

        class RevokeAfterFirst:
            def __init__(self, inner):
                self.inner = inner
                self.done = False

            def get_bind(self):
                return self.inner.get_bind()

            async def rollback(self):
                await self.inner.rollback()

            async def execute(self, statement, params=None, **kwargs):
                result = await self.inner.execute(statement, params, **kwargs)
                if not self.done:
                    self.done = True
                    sync = create_engine(url)
                    with sync.begin() as connection:
                        connection.execute(text(
                            "UPDATE business_knowledge_versions SET public_allowed = false WHERE id = :id"
                        ), {"id": brand["knowledge"]})
                    sync.dispose()
                return result

        try:
            os.environ["BILIGN_BUSINESS_RAG_ENABLED"] = "true"
            async with sessions() as db:
                codes = await search_public_knowledge(db, brand["org"], "WX-100")
                spare_hit = await search_public_knowledge(db, brand["org"], "QX-200")
                accent_hit = await search_public_knowledge(db, brand["org"], "Şİ-10")
                isolated = await search_public_knowledge(db, other["org"], "WX-100")
                missing_model = await search_public_knowledge(
                    db, brand["org"], "seramik", query_vector=_axis(0),
                )
                wrong_model = await search_public_knowledge(db, brand["org"], "seramik", client=OtherModel())
                semantic = await search_public_knowledge(
                    db, brand["org"], "", query_vector=_axis(0, 0.9), query_model=EMBEDDING_MODEL,
                )
                limited = await search_public_knowledge(
                    db, brand["org"],
                    "alfa bravo charlie delta echo foxtrot golf hotel india",
                )
                none = await search_public_knowledge(db, brand["org"], "yokboylekelime")
                first = await search_public_knowledge(
                    db, brand["org"], "AYNI QX-200 kaydi",
                    query_vector=_axis(4), query_model=EMBEDDING_MODEL,
                )
                second = await search_public_knowledge(
                    db, brand["org"], "AYNI QX-200 kaydi",
                    query_vector=_axis(4), query_model=EMBEDDING_MODEL,
                )
                granted = await authorize_retrieved_sources(db, brand["org"], codes["results"])
                tampered = await authorize_retrieved_sources(db, brand["org"], [
                    {**codes["results"][0], "text": codes["results"][0]["text"] + "x"},
                ])
            assert any(row["chunk_id"] == str(exact["chunk"]) and "exact" in row["methods"] for row in codes["results"])
            assert all("exact" not in row["methods"] for row in codes["results"] if row["chunk_id"] == str(prefix["chunk"]))
            assert any(row["chunk_id"] == str(spare["chunk"]) and "exact" in row["methods"] for row in spare_hit["results"])
            assert any(row["chunk_id"] == str(accented["chunk"]) and "exact" in row["methods"] for row in accent_hit["results"])
            assert all(row["business_id"] == str(other["org"]) for row in isolated["results"])
            assert str(exact["chunk"]) not in {row["chunk_id"] for row in isolated["results"]}
            assert "vector_model" in missing_model["errors"]
            assert all("vector" not in row["methods"] for row in missing_model["results"])
            assert missing_model["results"]
            assert "vector_model" in wrong_model["errors"]
            assert all("vector" not in row["methods"] for row in wrong_model["results"])
            assert str(alien["chunk"]) not in {row["chunk_id"] for row in semantic["results"]}
            assert semantic["results"][0]["chunk_id"] == str(brand["chunk"])
            assert "token_limit" in limited["notices"]
            assert str(kept["chunk"]) in {row["chunk_id"] for row in limited["results"]}
            assert str(late["chunk"]) not in {row["chunk_id"] for row in limited["results"]}
            assert none["reason"] == "no_match" and none["results"] == []
            assert first["results"] == second["results"]
            assert first["results"][0]["chunk_id"] == min(str(left["chunk"]), str(right["chunk"]))
            assert granted["reason"] is None and granted["sources"]
            assert tampered["sources"] == [] and tampered["rejected"]
            engine = create_engine(url)
            with engine.begin() as connection:
                connection.execute(text(
                    "UPDATE business_knowledge_chunks SET content_hash = :hash WHERE id = :id"
                ), {"hash": "0" * 64, "id": exact["chunk"]})
            engine.dispose()
            async with sessions() as db:
                hashed = await authorize_retrieved_sources(db, brand["org"], [
                    row for row in codes["results"] if row["chunk_id"] == str(exact["chunk"])
                ])
                stale = await search_public_knowledge(
                    RevokeAfterFirst(db), brand["org"], "seramik SKU-120-A",
                    query_vector=_axis(0), query_model=EMBEDDING_MODEL,
                )
                checked = await authorize_retrieved_sources(db, brand["org"], stale["results"])
                fresh = await search_public_knowledge(
                    db, brand["org"], "seramik SKU-120-A",
                    query_vector=_axis(0), query_model=EMBEDDING_MODEL,
                )
            assert hashed["sources"] == []
            assert str(exact["chunk"]) in hashed["rejected"]
            assert str(brand["chunk"]) in {row["chunk_id"] for row in stale["results"]}
            assert str(brand["chunk"]) in checked["rejected"]
            assert str(brand["chunk"]) not in {row["chunk_id"] for row in fresh["results"]}
            assert all(row["business_id"] == str(brand["org"]) for row in fresh["results"])
        finally:
            if previous is None:
                os.environ.pop("BILIGN_BUSINESS_RAG_ENABLED", None)
            else:
                os.environ["BILIGN_BUSINESS_RAG_ENABLED"] = previous
            await async_engine.dispose()


def _equal_distance_chunks(url, org, user, count=49):
    rendered = canonical_embedding(_axis(0))
    assert rendered
    ids = []
    engine = create_engine(url)
    with engine.begin() as connection:
        for _index in range(count):
            knowledge = uuid.uuid4()
            item = uuid.uuid4()
            chunk = uuid.uuid4()
            content = f"esit mesafe kaydi {chunk.hex}"
            chunk_text = rag_chunk(content)
            connection.execute(text(
                "INSERT INTO business_knowledge_versions "
                "(id, business_id, item_id, version, title, category, content, source, public_allowed, status, created_by, approved_by, revision) "
                "VALUES (:id, :business, :item, 1, 'Başlık', '', :content, 'katalog', true, 'published', :user, :user, 1)"
            ), {
                "id": knowledge, "business": org, "item": item, "content": content, "user": user,
            })
            connection.execute(text(
                "INSERT INTO business_knowledge_chunks "
                "(id, business_id, knowledge_version_id, item_id, chunk_index, text, content_hash, embedding, embedding_model, token_count, index_status, attempts) "
                "VALUES (:id, :business, :knowledge, :item, 0, :text, :hash, CAST(:embedding AS vector), :model, 8, 'ready', 0)"
            ), {
                "id": chunk, "business": org, "knowledge": knowledge, "item": item,
                "text": chunk_text, "hash": rag._digest(chunk_text), "embedding": rendered,
                "model": EMBEDDING_MODEL,
            })
            ids.append(chunk)
    engine.dispose()
    return ids, rendered


@pytest.mark.asyncio
async def test_source_integrity_vector_cutoff_and_query_limit():
    admin = _require_database(_vector_url(), "PostgreSQL with the pgvector package is not available")
    with _disposable(admin) as url:
        _stamp_from_phase42(url)
        upgraded = _alembic(["upgrade", "head"], url)
        assert upgraded.returncode == 0, _redact(upgraded.stderr or upgraded.stdout)[-2000:]
        brand = _ids()
        other = _ids()
        pool = _ids()
        _seed(url, brand, content="Butunluk markasi")
        _seed(url, other, content="Diger marka")
        _seed(url, pool, content="Mesafe havuzu")
        stable = _insert_chunk(url, brand["org"], brand["user"], "Sabit kaynak metni")
        paired = _insert_chunk(url, brand["org"], brand["user"], "Orijinal chunk metni")
        meta = _insert_chunk(url, brand["org"], brand["user"], "Metadata kaynagi durur")
        perm = _insert_chunk(url, brand["org"], brand["user"], "Izinli metin burada")
        arch = _insert_chunk(url, brand["org"], brand["user"], "Arsiv oncesi metin")
        owned = _insert_chunk(url, brand["org"], brand["user"], "Marka A ozel metin")
        first_version = _insert_chunk(url, brand["org"], brand["user"], "Ilk surum metni burada")
        _equal_ids, vector = _equal_distance_chunks(url, pool["org"], pool["user"], 49)
        async_engine = create_async_engine(_async_url(url))
        sessions = async_sessionmaker(async_engine, expire_on_commit=False)
        previous = os.environ.get("BILIGN_BUSINESS_RAG_ENABLED")
        ceiling = os.environ.get("BILIGN_BUSINESS_RAG_MAX_RESULTS")
        try:
            os.environ["BILIGN_BUSINESS_RAG_ENABLED"] = "true"
            os.environ["BILIGN_BUSINESS_RAG_MAX_RESULTS"] = "20"

            async def _auth(db, business, row):
                return await authorize_retrieved_sources(db, business, [{
                    "chunk_id": str(row["chunk"]),
                    "text": row["text"],
                }])

            async with sessions() as db:
                assert (await _auth(db, brand["org"], stable))["sources"]
                assert (await _auth(db, brand["org"], meta))["sources"]
                assert (await _auth(db, brand["org"], perm))["sources"]
                assert (await _auth(db, brand["org"], owned))["sources"]
            engine = create_engine(url)
            with engine.begin() as connection:
                connection.execute(text(
                    "UPDATE business_knowledge_versions SET content = :content WHERE id = :id"
                ), {"content": "Baska icerik oldu", "id": stable["knowledge"]})
                connection.execute(text(
                    "UPDATE business_knowledge_chunks SET text = :text, content_hash = :hash WHERE id = :id"
                ), {
                    "text": paired["text"] + " fazladan",
                    "hash": rag._digest(paired["text"] + " fazladan"),
                    "id": paired["chunk"],
                })
                connection.execute(text(
                    "UPDATE business_knowledge_versions SET source = 'katalog-2' WHERE id = :id"
                ), {"id": meta["knowledge"]})
                connection.execute(text(
                    "UPDATE business_knowledge_versions SET public_allowed = false WHERE id = :id"
                ), {"id": perm["knowledge"]})
                connection.execute(text(
                    "UPDATE business_knowledge_versions SET status = 'archived' WHERE id = :id"
                ), {"id": arch["knowledge"]})
                connection.execute(text(
                    "UPDATE business_knowledge_versions SET status = 'archived' WHERE id = :id"
                ), {"id": first_version["knowledge"]})
            engine.dispose()
            second = _insert_chunk(
                url, brand["org"], brand["user"], "Ikinci surum metni burada",
                item=first_version["item"], version=2,
            )
            async with sessions() as db:
                changed = await _auth(db, brand["org"], stable)
                rewritten = await authorize_retrieved_sources(db, brand["org"], [{
                    "chunk_id": str(paired["chunk"]),
                    "text": paired["text"] + " fazladan",
                }])
                labeled = await _auth(db, brand["org"], meta)
                denied = await _auth(db, brand["org"], perm)
                archived = await _auth(db, brand["org"], arch)
                old_version = await _auth(db, brand["org"], first_version)
                new_version = await _auth(db, brand["org"], second)
                foreign = await _auth(db, other["org"], owned)
            assert changed["sources"] == [] and str(stable["chunk"]) in changed["rejected"]
            assert rewritten["sources"] == [] and str(paired["chunk"]) in rewritten["rejected"]
            assert labeled["sources"] and labeled["sources"][0]["chunk_id"] == str(meta["chunk"])
            engine = create_engine(url)
            with engine.begin() as connection:
                connection.execute(text(
                    "UPDATE business_knowledge_versions SET title = 'Baska baslik' WHERE id = :id"
                ), {"id": meta["knowledge"]})
            engine.dispose()
            async with sessions() as db:
                retitled = await _auth(db, brand["org"], meta)
                from backend.services.business_yansi.retrieval import sources_for_model
                assert sources_for_model(labeled) != sources_for_model(retitled)
                assert sources_for_model(retitled) == []
            assert denied["sources"] == []
            assert archived["sources"] == []
            assert old_version["sources"] == []
            assert new_version["sources"] and new_version["sources"][0]["chunk_id"] == str(second["chunk"])
            assert foreign["sources"] == [] and str(owned["chunk"]) in foreign["rejected"]

            engine = create_engine(url)
            params = {
                "business_id": pool["org"],
                "candidate_limit": 48,
                "query_vector": vector,
                "embedding_model": EMBEDDING_MODEL,
                "max_distance": 0.5,
            }
            with engine.connect() as connection:
                ordered = [str(row[0]) for row in connection.execute(text(
                    "SELECT id FROM business_knowledge_chunks "
                    "WHERE business_id = :business AND index_status = 'ready' AND embedding IS NOT NULL "
                    "ORDER BY id"
                ), {"business": pool["org"]})]
                first_cut = [str(row[0]) for row in connection.execute(text(
                    "SELECT chunk_id FROM (" + VECTOR_SQL + ") candidates"
                ), params)]
                second_cut = [str(row[0]) for row in connection.execute(text(
                    "SELECT chunk_id FROM (" + VECTOR_SQL + ") candidates"
                ), params)]
            engine.dispose()
            assert len(ordered) == 49
            assert first_cut == second_cut == ordered[:48]
            assert ordered[48] not in first_cut
            async with sessions() as db:
                first_search = await search_public_knowledge(
                    db, pool["org"], "", query_vector=_axis(0), query_model=EMBEDDING_MODEL, limit=20,
                )
                second_search = await search_public_knowledge(
                    db, pool["org"], "", query_vector=_axis(0), query_model=EMBEDDING_MODEL, limit=20,
                )
            assert first_search["results"] == second_search["results"]
            assert [row["chunk_id"] for row in first_search["results"]] == ordered[:20]

            class Recorder:
                def __init__(self, inner):
                    self.inner = inner
                    self.calls = 0

                def get_bind(self):
                    return self.inner.get_bind()

                async def rollback(self):
                    await self.inner.rollback()

                async def execute(self, statement, params=None, **kwargs):
                    self.calls += 1
                    return await self.inner.execute(statement, params, **kwargs)

            class Client:
                def __init__(self):
                    self.calls = 0

                async def embed_texts(self, texts):
                    self.calls += 1
                    raise AssertionError("provider")

            async with sessions() as db:
                recorder = Recorder(db)
                client = Client()
                huge = await search_public_knowledge(
                    recorder, brand["org"], "ş" * 99999, client=client,
                    query_vector=_axis(0), query_model=EMBEDDING_MODEL,
                )
            assert huge["reason"] == "query_too_long" and huge["results"] == []
            assert recorder.calls == 0 and client.calls == 0
        finally:
            if previous is None:
                os.environ.pop("BILIGN_BUSINESS_RAG_ENABLED", None)
            else:
                os.environ["BILIGN_BUSINESS_RAG_ENABLED"] = previous
            if ceiling is None:
                os.environ.pop("BILIGN_BUSINESS_RAG_MAX_RESULTS", None)
            else:
                os.environ["BILIGN_BUSINESS_RAG_MAX_RESULTS"] = ceiling
            await async_engine.dispose()
