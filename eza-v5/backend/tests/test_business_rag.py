"""Business RAG index. SQLite covers queue and permissions; pgvector ANN stays on PostgreSQL."""
import importlib.util
import io
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import func, select

from backend.core.llm.providers.openai_client import EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, OpenAIClient
from backend.models.business_yansi import BusinessKnowledgeChunk as Chunk, BusinessKnowledgeVersion as Knowledge
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
    assert all(part.startswith("Seramik bakım\nÜrün\n") for part in parts)
    joined = "\n".join(parts)
    assert "İstanbul" in joined and "Garanti koşulları" in joined
    for token in ("SKU-120-A", "1.250.000", "12,5"):
        assert token in joined
        for part in parts:
            if any(piece and piece in part for piece in (token[:3], token[-3:])):
                assert token in part


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
    assert "pg_available_extensions" in path.read_text(encoding="utf-8")
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
    assert "business_knowledge_versions" not in down.replace("business_knowledge_chunks", "")


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
        assert "business_knowledge_chunks" not in text
        assert "BILIGN_BUSINESS_RAG_ENABLED" not in text


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
    assert await rag.backfill_public_knowledge(sample.db, Embedder()) == {
        "embedded": 0, "failed": 0, "retired": 0, "reason": "flag_off",
    }


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
    failed = await rag.process_index_queue(s.db, failing, business_id=s.business.id)
    assert failed["failed"] >= 1
    kept = await s.db.get(Knowledge, retry_row.id)
    assert kept.content == "Worker hata verirse bu kayıt durur." and kept.status == "published"
    chunk = await s.db.scalar(select(Chunk).where(Chunk.knowledge_version_id == retry_row.id))
    assert chunk.index_status == "failed" and chunk.attempts == 1
    recovered = await rag.process_index_queue(s.db, client, business_id=s.business.id)
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
