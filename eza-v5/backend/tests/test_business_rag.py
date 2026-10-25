"""Business RAG index. SQLite covers queue and permissions; pgvector ANN stays on PostgreSQL."""
import importlib.util
import io
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import func, select, update

from backend.core.llm.providers.openai_client import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, OpenAIClient
from backend.core.utils.dependencies import apply_startup_schema, startup_create_all_tables
from backend.models.business_yansi import (
    BusinessKnowledgeChunk as Chunk,
    BusinessKnowledgeVersion as Knowledge,
    canonical_embedding,
)
from backend.services.business_yansi import rag, service as svc
from backend.services.business_yansi.chunking import split_knowledge
from backend.tests.test_business_yansi import sample


class Embedder:
    def __init__(self, fail=False):
        self.fail = fail
        self.calls = 0
        self.texts = []

    async def embed_texts(self, texts):
        self.calls += 1
        self.texts.extend(texts)
        if self.fail:
            return {"ok": False, "vectors": None, "error": "embedding_failed"}
        return {
            "ok": True,
            "vectors": [[0.02] * EMBEDDING_DIMENSIONS for _ in texts],
            "model_name": EMBEDDING_MODEL,
            "usage": {"prompt_tokens": 8},
        }


@pytest_asyncio.fixture
async def rag_db(sample, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ENABLED", "true")
    async with sample.db.bind.begin() as connection:
        await connection.run_sync(lambda sync: Chunk.__table__.create(sync))
    return sample


def test_chunking_preserves_turkish_titles_codes_and_numbers():
    body = (
        "Garanti koşulları\n\n"
        "İstanbul ofisinde ölçü 12,5 mm ve ücret 1.250.000 TL olarak yazılır. "
        "Ürün kodu SKU-120-A satırın ortasında kalır ve cümle bundan sonra da uzar. "
        "Ek açıklama metni parçalanırken kod ve sayı bütün kalmalıdır."
    )
    parts = split_knowledge(
        "Seramik bakım",
        "Ürün",
        body,
        target_chars=80,
        overlap_chars=20,
        hard_max_chars=90,
    )
    assert parts
    assert all(len(part) <= 90 for part in parts)
    assert all(part.startswith("Seramik bakım\nÜrün\n") for part in parts)
    joined = "\n".join(parts)
    assert "İstanbul" in joined and "Garanti koşulları" in joined
    for token in ("SKU-120-A", "1.250.000", "12,5"):
        assert token in joined
        for part in parts:
            if any(piece and piece in part for piece in (token[:3], token[-3:])):
                assert token in part


def test_long_header_and_product_code_stay_within_hard_limit():
    code = "SKU-" + ("AB12-" * 30)
    parts = split_knowledge(
        "Çok uzun başlık " * 12,
        "Metadata kategorisi " * 6,
        "Giriş metni " + code + " kapanış cümlesi.",
        target_chars=80,
        overlap_chars=10,
        hard_max_chars=90,
    )
    assert parts
    assert all(len(part) <= 90 for part in parts)
    assert "".join(parts).count("SKU-") >= 1


def test_startup_does_not_create_chunk_table_and_production_skips_bootstrap():
    from types import SimpleNamespace
    names = {table.name for table in startup_create_all_tables()}
    assert "business_knowledge_chunks" not in names
    assert "business_knowledge_versions" in names
    assert apply_startup_schema(None, SimpleNamespace(ENV="production", EZA_ENV=None)) is False
    assert apply_startup_schema(None, SimpleNamespace(ENV="dev", EZA_ENV="prod")) is False


def test_vector_round_trip_rejects_nan_infinity_and_rounded_zero():
    assert canonical_embedding([float("nan")] * 1536) is None
    assert canonical_embedding([float("inf")] * 1536) is None
    assert canonical_embedding([0.0] * 1536) is None
    assert canonical_embedding([1e-12] * 1536) is None
    values = [0.0] * 1536
    values[0] = 0.25
    rendered = canonical_embedding(values)
    assert rendered.startswith("[0.25000000,")
    assert "nan" not in rendered and "inf" not in rendered
    assert rag._vector_ok(values) is True
    assert rag._vector_ok([1e-12] * 1536) is False
    overflow = [0.25] * 1536
    overflow[0] = 1e39
    assert canonical_embedding(overflow) is None


def test_missing_chunk_table_uses_sqlstate_not_message_text():
    from sqlalchemy.exc import ProgrammingError

    class MissingChunks(Exception):
        def __init__(self):
            super().__init__('relation "business_knowledge_chunks" does not exist')
            self.pgcode = "42P01"

    class MissingOther(Exception):
        def __init__(self):
            super().__init__('relation "public.production_organizations" does not exist')
            self.pgcode = "42P01"

    class Bare(Exception):
        def __init__(self):
            super().__init__("relation missing")
            self.pgcode = "42P01"

    class Denied(Exception):
        def __init__(self):
            super().__init__("permission denied for table business_knowledge_chunks")
            self.pgcode = "42501"

    assert rag._chunk_table_missing(ProgrammingError("SELECT", {}, MissingChunks())) is True
    assert rag._missing_relation(ProgrammingError("SELECT", {}, MissingOther())) == "production_organizations"
    assert rag._chunk_table_missing(ProgrammingError("SELECT", {}, MissingOther())) is False
    assert rag._chunk_table_missing(ProgrammingError("SELECT", {}, Bare())) is False
    assert rag._chunk_table_missing(ProgrammingError("SELECT", {}, Denied())) is False


def test_rrf_and_turkish_fold(monkeypatch):
    import re
    from backend.services.business_yansi.retrieval import (
        FOLD_FROM,
        FOLD_TO,
        HARD_MAX_LIMIT,
        MAX_FUSION_CANDIDATES,
        MAX_METHODS,
        METHOD_CANDIDATE_LIMIT,
        code_pattern,
        fold_turkish,
        fuse_ranks,
        result_limit,
        result_reason,
        split_query_tokens,
    )
    monkeypatch.delenv("BILIGN_BUSINESS_RAG_MAX_RESULTS", raising=False)
    assert len(FOLD_FROM) == len(FOLD_TO)
    assert fold_turkish("İSTANBUL Işık") == "istanbul ışık"
    assert fold_turkish("QWXqwx") == "qwxqwx"
    assert fold_turkish("ŞĞÜÖÇ") == "şğüöç"
    assert fold_turkish("İI") == "iı"
    assert fold_turkish("Éß") == "Éß"
    assert fold_turkish("İSTANBUL Işık QWX") == "istanbul ışık qwx"
    assert re.search(code_pattern("WX-100"), fold_turkish("kod WX-100 bitti"))
    assert re.search(code_pattern("WX-100"), fold_turkish("kod WX-1000 bitti")) is None
    assert re.search(code_pattern("Şİ-10"), fold_turkish("ürün Şİ-10 listede"))
    both = {"chunk_id": "both"}
    only = {"chunk_id": "only"}
    fused = fuse_ranks({"vector": [both, only], "exact": [both], "ignored": [only]})
    assert fused[0][2]["chunk_id"] == "both"
    assert fused[0][0] > fused[1][0]
    tied_high = {"chunk_id": "bbbb"}
    tied_low = {"chunk_id": "aaaa"}
    tied = fuse_ranks({"vector": [tied_high, tied_low], "exact": [tied_low, tied_high]})
    assert tied[0][0] == tied[1][0]
    assert tied[0][2]["chunk_id"] == "aaaa"
    wide = [{"chunk_id": f"{index:04d}"} for index in range(60)]
    capped = fuse_ranks({method: wide for method in ("vector", "fulltext", "lexical", "exact")})
    assert len(capped) == METHOD_CANDIDATE_LIMIT
    assert METHOD_CANDIDATE_LIMIT == 48
    assert MAX_METHODS == 4
    assert MAX_FUSION_CANDIDATES == 192
    assert HARD_MAX_LIMIT == 20
    assert result_limit(None) == 8
    assert result_limit(100) == 8
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_MAX_RESULTS", "20")
    assert result_limit(None) == 8
    assert result_limit(100) == 20
    assert result_limit(3) == 3
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_MAX_RESULTS", "50")
    assert result_limit(100) == 20
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_MAX_RESULTS", "0")
    assert result_limit(None) == 8
    tokens, truncated = split_query_tokens(
        "alfa bravo charlie delta echo foxtrot golf hotel india"
    )
    assert truncated is True
    assert tokens == ["alfa", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"]
    assert result_reason([]) == "no_match"
    assert result_reason([{"methods": ["lexical"]}]) == "low_relevance"
    assert result_reason([{"methods": ["exact"]}]) is None
    assert result_reason([{"methods": ["fulltext", "lexical"]}]) is None
    from backend.services.business_yansi.retrieval import (
        AUTHORIZATION_CONTRACT,
        chunk_derived_from_source,
        query_char_limit,
        sources_for_model,
    )
    text = split_knowledge("Başlık", "", "Seramik bakım metni")[0]
    assert chunk_derived_from_source("Başlık", "", "Seramik bakım metni", 0, text) is True
    assert chunk_derived_from_source("Başlık", "", "Bambaşka içerik", 0, text) is False
    assert chunk_derived_from_source("Yeni başlık", "", "Seramik bakım metni", 0, text) is False
    assert "revalidate_every_request" in AUTHORIZATION_CONTRACT
    assert "close_transaction_before_provider" in AUTHORIZATION_CONTRACT
    assert sources_for_model({"sources": [{"chunk_id": "a"}], "reason": None}) == [{"chunk_id": "a"}]
    assert sources_for_model({"sources": [{"chunk_id": "a"}], "reason": "query_too_long"}) == []
    assert sources_for_model(None) == []
    monkeypatch.delenv("BILIGN_BUSINESS_RAG_MAX_QUERY_CHARS", raising=False)
    assert query_char_limit() == 2000


@pytest.mark.asyncio
async def test_search_stays_off_without_the_flag(sample):
    from backend.services.business_yansi.retrieval import search_public_knowledge
    found = await search_public_knowledge(sample.db, sample.business.id, "seramik")
    assert found["reason"] == "flag_off" and found["results"] == []


@pytest.mark.asyncio
async def test_oversized_query_never_reaches_provider_or_sql(monkeypatch):
    from backend.services.business_yansi.retrieval import search_public_knowledge, sources_for_model
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ENABLED", "true")
    monkeypatch.delenv("BILIGN_BUSINESS_RAG_MAX_QUERY_CHARS", raising=False)
    calls = {"sql": 0, "embed": 0}

    class DB:
        def get_bind(self):
            calls["sql"] += 1
            raise AssertionError("sql")

        async def execute(self, *args, **kwargs):
            calls["sql"] += 1
            raise AssertionError("sql")

    class Client:
        async def embed_texts(self, texts):
            calls["embed"] += 1
            raise AssertionError("provider")

    huge = "ş" * 99999
    found = await search_public_knowledge(
        DB(), "00000000-0000-0000-0000-000000000001", huge,
        client=Client(), query_vector=[0.2] * 1536, query_model=EMBEDDING_MODEL,
    )
    assert found["reason"] == "query_too_long" and found["results"] == []
    assert sources_for_model(found) == []
    assert calls == {"sql": 0, "embed": 0}
    turkish = "Ğüİşçö" * 400
    assert len(turkish) > 2000
    blocked = await search_public_knowledge(DB(), "00000000-0000-0000-0000-000000000001", turkish, client=Client())
    assert blocked["reason"] == "query_too_long"
    blank = await search_public_knowledge(DB(), "00000000-0000-0000-0000-000000000001", " \n\t")
    assert blank["reason"] == "empty_query"
    assert calls == {"sql": 0, "embed": 0}


@pytest.mark.asyncio
async def test_missing_chunk_table_does_not_create_schema(sample, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ENABLED", "true")
    result = await rag.process_index_queue(sample.db, Embedder(), backoff_seconds=0)
    assert result["reason"] == "schema_missing"
    assert result["embedded"] == 0
    from sqlalchemy import inspect
    names = set(await sample.db.run_sync(lambda sync: inspect(sync.get_bind()).get_table_names()))
    assert "business_knowledge_chunks" not in names


def test_migration_defines_pgvector_without_dropping_extension_on_downgrade():
    path = Path(__file__).parent.parent / "migrations/versions/add_business_knowledge_chunks_v1.py"
    spec = importlib.util.spec_from_file_location("chunks_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    upgrade_sql = io.StringIO()
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    upgrade_context = MigrationContext.configure(dialect_name="postgresql", opts={"as_sql": True, "output_buffer": upgrade_sql})
    with Operations.context(upgrade_context):
        migration.upgrade()
    sql = upgrade_sql.getvalue()
    source = path.read_text(encoding="utf-8")
    assert "PgvectorRequired" in source and "pg_available_extensions" in source
    assert "table_schema" not in source
    assert "CREATE EXTENSION IF NOT EXISTS vector" in sql
    assert "business_knowledge_chunks" in sql and "vector(1536)" in sql
    assert "USING hnsw" in sql and "vector_cosine_ops" in sql
    assert migration.down_revision == "add_business_studio_v2"
    downgrade_sql = io.StringIO()
    downgrade_context = MigrationContext.configure(dialect_name="postgresql", opts={"as_sql": True, "output_buffer": downgrade_sql})
    with Operations.context(downgrade_context):
        migration.downgrade()
    down = downgrade_sql.getvalue()
    assert "DROP TABLE business_knowledge_chunks" in down
    assert "DROP EXTENSION" not in down
    assert "DROP TABLE business_knowledge_versions" not in down
    assert "uq_business_knowledge_version_tenant" in down
    fts_path = Path(__file__).parent.parent / "migrations/versions/add_business_knowledge_chunks_fts_v1.py"
    fts_spec = importlib.util.spec_from_file_location("chunks_fts_migration", fts_path)
    fts = importlib.util.module_from_spec(fts_spec)
    fts_spec.loader.exec_module(fts)
    assert fts.down_revision == "add_business_knowledge_chunks_v1"
    fts_sql = io.StringIO()
    fts_context = MigrationContext.configure(dialect_name="postgresql", opts={"as_sql": True, "output_buffer": fts_sql})
    with Operations.context(fts_context):
        fts.upgrade()
    fts_up = fts_sql.getvalue()
    assert "USING gin" in fts_up and "to_tsvector('simple', text)" in fts_up
    assert "CREATE EXTENSION" not in fts_up and "DROP TABLE" not in fts_up
    fts_down_sql = io.StringIO()
    fts_down_context = MigrationContext.configure(dialect_name="postgresql", opts={"as_sql": True, "output_buffer": fts_down_sql})
    with Operations.context(fts_down_context):
        fts.downgrade()
    fts_down = fts_down_sql.getvalue()
    assert "DROP INDEX IF EXISTS ix_business_knowledge_chunks_text_simple" in fts_down
    assert "DROP TABLE" not in fts_down


def test_live_answer_studio_and_discover_do_not_call_the_index():
    root = Path(__file__).parent.parent
    for relative in (
        "services/business_yansi/answers.py",
        "services/business_yansi/publication.py",
        "services/business_yansi/studio_generation.py",
        "services/business_yansi/studio_execution.py",
        "api/streaming.py",
        "routers/business_yansi.py",
    ):
        text = (root / relative).read_text(encoding="utf-8")
        assert "current_public_chunks" not in text
        assert "search_public_knowledge" not in text
        assert "authorize_retrieved_sources" not in text
        assert "sources_for_model" not in text
        assert "answer_business_question" not in text
        assert "grounded_answers" not in text
        assert "business_knowledge_chunks" not in text
        if relative != "services/business_yansi/answers.py":
            assert "BILIGN_BUSINESS_RAG_ENABLED" not in text
    live = (root / "services/business_yansi/answers.py").read_text(encoding="utf-8")
    assert "run_business_rag" in live
    assert "allowlist" not in live


@pytest.mark.asyncio
async def test_embed_texts_uses_small_model_and_hides_errors(monkeypatch):
    captured = {}

    class Response:
        status_code = 200

        def json(self):
            return {"data": [{"index": 0, "embedding": [0.1] * EMBEDDING_DIMENSIONS}], "usage": {"prompt_tokens": 4}}

    class Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, headers, json):
            captured["url"] = url
            captured["body"] = json
            captured["auth"] = headers["Authorization"]
            return Response()

    monkeypatch.setattr(httpx, "AsyncClient", Client)
    client = OpenAIClient()
    client.api_key = "test-key"
    result = await client.embed_texts(["Merhaba 12.500 TL"])
    assert result["ok"] and result["model_name"] == "text-embedding-3-small"
    assert len(result["vectors"][0]) == 1536
    assert captured["url"].endswith("/embeddings")
    assert captured["body"]["model"] == EMBEDDING_MODEL and captured["body"]["dimensions"] == 1536
    assert captured["auth"] == "Bearer test-key"

    class Broken(Client):
        async def post(self, url, headers, json):
            raise httpx.TimeoutException("slow")

    monkeypatch.setattr(httpx, "AsyncClient", Broken)
    failed = await client.embed_texts(["gizli metin"])
    assert failed["ok"] is False and failed["error"] == "embedding_unavailable"
    assert "gizli" not in failed["error"]


@pytest.mark.asyncio
async def test_flag_off_saves_knowledge_without_chunks(sample):
    row = await svc.create_knowledge(
        sample.db, sample.business.id, sample.owner.id,
        {"title": "Yansı", "content": "Herkese açık açıklama.", "source": "kayıt", "publicAllowed": True},
    )
    assert row.status == "published"
    assert rag.enabled() is False
    skipped = await rag.backfill_public_knowledge(sample.db, Embedder())
    assert skipped["reason"] == "flag_off" and skipped["embedded"] == 0


@pytest.mark.asyncio
async def test_index_permissions_reuse_retry_and_backfill(rag_db):
    s = rag_db
    client = Embedder()
    first = await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"title": "Bakım", "category": "Ürün", "content": "İstanbul atölyesinde SKU-120-A ürünü 12.500 TL.", "source": "katalog", "publicAllowed": True},
    )
    assert first.public_allowed is True
    queued = (await s.db.scalars(select(Chunk).where(Chunk.knowledge_version_id == first.id))).all()
    assert queued and all(row.index_status == "pending" for row in queued)
    assert client.calls == 0

    other = await svc.create_business(
        s.db, s.admin,
        {"organizationId": str(s.other.id), "ownerId": str(s.outsider.id), "slug": "diger-marka", "name": "Diğer"},
    )
    assert other.verified is False
    foreign = await svc.create_knowledge(
        s.db, other.id, s.outsider.id,
        {"title": "Bakım", "category": "Ürün", "content": "İstanbul atölyesinde SKU-120-A ürünü 12.500 TL.", "source": "katalog", "publicAllowed": True},
    )

    created = await rag.process_index_queue(s.db, client)
    assert created["embedded"] == 2 and client.calls == 2
    visible = await rag.current_public_chunks(s.db, s.business.id)
    foreign_visible = await rag.current_public_chunks(s.db, other.id)
    assert {row.business_id for row in visible} == {s.business.id}
    assert {row.business_id for row in foreign_visible} == {other.id}
    assert all(row.embedding_model == EMBEDDING_MODEL and len(row.embedding) == 1536 for row in visible)

    same = await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"title": "Bakım", "category": "Ürün", "content": "İstanbul atölyesinde SKU-120-A ürünü 12.500 TL.", "source": "katalog", "publicAllowed": True},
    )
    assert same.item_id != first.item_id
    reused = (await s.db.scalars(select(Chunk).where(Chunk.knowledge_version_id == same.id))).all()
    assert reused and all(row.index_status == "ready" for row in reused)
    calls_after_reuse = client.calls
    again = await rag.process_index_queue(s.db, client, business_id=s.business.id)
    assert again["embedded"] == 0 and client.calls == calls_after_reuse

    updated = await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"itemId": str(first.item_id), "title": "Bakım", "category": "Ürün", "content": "Yeni açıklama: ürün artık 9.900 TL.", "source": "katalog", "publicAllowed": True},
    )
    await rag.process_index_queue(s.db, client, business_id=s.business.id)
    current = await rag.current_public_chunks(s.db, s.business.id)
    assert first.id not in {row.knowledge_version_id for row in current}
    assert updated.id in {row.knowledge_version_id for row in current}
    assert all("9.900" in row.text for row in current if row.knowledge_version_id == updated.id)
    stored = await s.db.get(Knowledge, first.id)
    assert stored.status == "archived" and stored.content.startswith("İstanbul")

    client.texts.clear()
    private = await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"itemId": str(updated.item_id), "title": "İç not", "content": "Bu gizli operasyon notu aramada olmamalı.", "source": "operasyon", "publicAllowed": False},
    )
    await rag.process_index_queue(s.db, client)
    assert private.status == "published" and private.public_allowed is False
    assert "gizli" not in " ".join(client.texts)
    assert updated.id not in {row.knowledge_version_id for row in await rag.current_public_chunks(s.db, s.business.id)}
    hidden_chunks = (await s.db.scalars(select(Chunk).where(Chunk.knowledge_version_id == private.id))).all()
    assert hidden_chunks == []

    removed = await svc.delete_knowledge(s.db, s.business.id, s.owner.id, same.id, same.revision)
    assert removed.status == "archived" and removed.content.startswith("İstanbul")
    assert same.id not in {row.knowledge_version_id for row in await rag.current_public_chunks(s.db, s.business.id)}

    failing = Embedder(fail=True)
    retry_row = await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"title": "Deneme", "content": "Worker hata verirse bu kayıt durur.", "source": "katalog", "publicAllowed": True},
    )
    failed = await rag.process_index_queue(s.db, failing, business_id=s.business.id, backoff_seconds=0)
    assert failed["failed"] >= 1
    kept = await s.db.get(Knowledge, retry_row.id)
    assert kept.content == "Worker hata verirse bu kayıt durur." and kept.status == "published"
    chunk = await s.db.scalar(select(Chunk).where(Chunk.knowledge_version_id == retry_row.id))
    assert chunk.index_status == "failed" and chunk.attempts == 1
    recovered = await rag.process_index_queue(s.db, client, business_id=s.business.id, backoff_seconds=0)
    assert recovered["embedded"] == 1
    await s.db.refresh(chunk)
    assert chunk.index_status == "ready"

    pending = await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"title": "Yarış", "content": "Arşivden sonra bu metin sağlayıcıya gitmez.", "source": "katalog", "publicAllowed": True},
    )
    race = await s.db.scalar(select(Chunk).where(Chunk.knowledge_version_id == pending.id))
    await svc.delete_knowledge(s.db, s.business.id, s.owner.id, pending.id, pending.revision)
    race.index_status = "pending"
    await s.db.commit()
    before = client.calls
    raced = await rag.process_index_queue(s.db, client, business_id=s.business.id)
    assert raced["retired"] == 1 and client.calls == before
    await s.db.refresh(race)
    assert race.index_status == "retired"
    assert (await s.db.get(Knowledge, pending.id)).status == "archived"

    extra = await svc.create_knowledge(
        s.db, other.id, s.outsider.id,
        {"title": "İkinci", "content": "Backfill ikinci kayıt yalnızca sıradaki turda gömülür.", "source": "katalog", "publicAllowed": True},
    )
    third = await svc.create_knowledge(
        s.db, other.id, s.outsider.id,
        {"title": "Üçüncü", "content": "Backfill üçüncü kayıt da tekrar çalışınca tamamlanır.", "source": "katalog", "publicAllowed": True},
    )
    backfill = Embedder()
    first_pass = await rag.backfill_public_knowledge(s.db, backfill, limit=1)
    assert first_pass["embedded"] == 1
    second_pass = await rag.backfill_public_knowledge(s.db, backfill, limit=1)
    assert second_pass["embedded"] == 1
    third_pass = await rag.backfill_public_knowledge(s.db, backfill, limit=1)
    assert third_pass["embedded"] == 0 and backfill.calls == 2
    ready = await s.db.scalar(select(func.count()).select_from(Chunk).where(
        Chunk.knowledge_version_id.in_([extra.id, third.id]), Chunk.index_status == "ready",
    ))
    assert ready == 2


def test_vector_rejects_nan_infinity_and_zero():
    assert rag._vector_ok([0.02] * EMBEDDING_DIMENSIONS)
    assert not rag._vector_ok([0.0] * EMBEDDING_DIMENSIONS)
    assert not rag._vector_ok([float("nan"), *([0.02] * (EMBEDDING_DIMENSIONS - 1))])
    assert not rag._vector_ok([float("inf"), *([0.02] * (EMBEDDING_DIMENSIONS - 1))])
    assert not rag._vector_ok([0.02] * (EMBEDDING_DIMENSIONS - 1))


@pytest.mark.asyncio
async def test_suspended_brand_and_org_are_not_indexed(rag_db):
    from backend.models.production import Organization
    s = rag_db
    client = Embedder()
    await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"title": "Askı", "content": "Askıdaki markanın metni gömülmez.", "source": "katalog", "publicAllowed": True},
    )
    s.business.status = "suspended"
    await s.db.commit()
    result = await rag.process_index_queue(s.db, client, business_id=s.business.id, backoff_seconds=0)
    assert client.calls == 0 and result["embedded"] == 0
    assert await rag.current_public_chunks(s.db, s.business.id) == []
    s.business.status = "active"
    await s.db.commit()
    await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"title": "Org", "content": "Organizasyon askıdaysa bu metin de gömülmez.", "source": "katalog", "publicAllowed": True},
    )
    organization = await s.db.get(Organization, s.business.id)
    organization.status = "suspended"
    await s.db.commit()
    blocked = await rag.process_index_queue(s.db, client, business_id=s.business.id, backoff_seconds=0)
    assert client.calls == 0 and blocked["embedded"] == 0
    assert await rag.current_public_chunks(s.db, s.business.id) == []
    organization.status = "active"
    await s.db.commit()


@pytest.mark.asyncio
async def test_stale_session_and_late_worker_cannot_publish(rag_db):
    from datetime import datetime, timedelta, timezone
    s = rag_db
    client = Embedder()
    row = await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"title": "Eski", "content": "ESKI_KIMLIK haritası bu metni sağlayıcıya vermemeli.", "source": "katalog", "publicAllowed": True},
    )
    loaded = await s.db.get(Knowledge, row.id)
    await s.db.execute(
        update(Knowledge).where(Knowledge.id == row.id).values(public_allowed=False),
        execution_options={"synchronize_session": False},
    )
    await s.db.commit()
    assert loaded.public_allowed is True
    revoked = await rag.process_index_queue(s.db, client, business_id=s.business.id, backoff_seconds=0)
    assert client.calls == 0 and revoked["retired"] >= 1
    assert "ESKI_KIMLIK" not in " ".join(client.texts)

    fresh = await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"title": "Kira", "content": "Lease dolunca eski worker sonucu yazılamaz.", "source": "katalog", "publicAllowed": True},
    )
    chunk = await s.db.scalar(select(Chunk).where(Chunk.knowledge_version_id == fresh.id))
    old_token = chunk.id
    chunk.index_status = "leased"
    chunk.claim_token = old_token
    chunk.claim_owner = "old-worker"
    chunk.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=5)
    chunk.attempts = 1
    late_job = {
        "id": chunk.id,
        "token": old_token,
        "text": chunk.text,
        "content_hash": chunk.content_hash,
        "knowledge_version_id": fresh.id,
        "business_id": s.business.id,
        "item_id": fresh.item_id,
        "attempts": 1,
    }
    await s.db.commit()
    stolen = await rag.process_index_queue(s.db, client, business_id=s.business.id, worker_id="new-worker", backoff_seconds=0)
    assert stolen["embedded"] == 1 and client.calls == 1
    late = await rag._finish_job(s.db, late_job, backoff_seconds=0, vector=[0.9] * EMBEDDING_DIMENSIONS)
    assert late == "discarded"
    await s.db.refresh(chunk)
    assert chunk.index_status == "ready" and chunk.embedding[0] == 0.02


@pytest.mark.asyncio
async def test_exhausted_jobs_do_not_block_backfill(rag_db):
    s = rag_db
    old = await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"title": "Eski hata", "content": "Bu iş deneme hakkını tüketmiş olmalı.", "source": "katalog", "publicAllowed": True},
    )
    blocked = await s.db.scalar(select(Chunk).where(Chunk.knowledge_version_id == old.id))
    blocked.index_status = "exhausted"
    blocked.attempts = 5
    await s.db.commit()
    new = await svc.create_knowledge(
        s.db, s.business.id, s.owner.id,
        {"title": "Yeni", "content": "Yeni kayıt tükenmiş işin arkasında kalmaz.", "source": "katalog", "publicAllowed": True},
    )
    client = Embedder()
    result = await rag.backfill_public_knowledge(s.db, client, limit=1, backoff_seconds=0, worker_id="backfill")
    assert result["embedded"] == 1
    assert "Yeni kayıt" in " ".join(client.texts)
    assert "tüketmiş" not in " ".join(client.texts)
    await s.db.refresh(blocked)
    assert blocked.index_status == "exhausted"
    ready = await s.db.scalar(select(Chunk).where(Chunk.knowledge_version_id == new.id))
    assert ready.index_status == "ready"
    snapshot = await rag.queue_snapshot(s.db, s.business.id)
    assert snapshot["exhausted"] >= 1


@pytest.mark.asyncio
async def test_sync_failure_keeps_the_knowledge_row(rag_db, monkeypatch):
    async def explode(db, version):
        raise RuntimeError("index unavailable")

    monkeypatch.setattr(rag, "sync_version", explode)
    row = await svc.create_knowledge(
        rag_db.db, rag_db.business.id, rag_db.owner.id,
        {"title": "Sağlam", "content": "İndeks çökse de kayıt kaybolmaz.", "source": "katalog", "publicAllowed": True},
    )
    assert row.content == "İndeks çökse de kayıt kaybolmaz."
    assert await rag_db.db.get(Knowledge, row.id) is not None
    assert (await rag_db.db.scalars(select(Chunk))).all() == []
