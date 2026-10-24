"""Startup must not ask PostgreSQL for the pgvector type."""
import importlib
import os
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from backend.core.utils.dependencies import apply_startup_schema, startup_create_all_tables
from backend.models.business_yansi import BusinessKnowledgeChunk
from backend.services.business_yansi.rag import enabled


def test_production_startup_does_not_call_create_all(monkeypatch):
    def forbidden(*_args, **_kwargs):
        raise AssertionError("create_all")

    monkeypatch.setattr("backend.core.utils.dependencies.Base.metadata.create_all", forbidden)
    assert apply_startup_schema(object(), SimpleNamespace(ENV="production", EZA_ENV=None)) is False
    assert apply_startup_schema(object(), SimpleNamespace(ENV="dev", EZA_ENV="prod")) is False


def test_chunk_table_is_outside_startup_and_is_the_vector_table():
    names = {table.name for table in startup_create_all_tables()}
    assert "business_knowledge_chunks" not in names
    assert "business_knowledge_versions" in names
    dialect = postgresql.dialect()
    chunk_sql = str(CreateTable(BusinessKnowledgeChunk.__table__).compile(dialect=dialect))
    assert "vector(1536)" in chunk_sql
    for table in startup_create_all_tables():
        compiled = str(CreateTable(table).compile(dialect=dialect))
        assert "vector(" not in compiled


def test_rag_flag_defaults_off(monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_RAG_ENABLED", raising=False)
    assert enabled() is False


def test_release_does_not_include_later_rag_engines():
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("backend.services.business_yansi.grounded_answers")
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("backend.services.business_yansi.retrieval")


def test_studio_and_mirror_do_not_use_public_chat_coercion():
    root = Path(__file__).resolve().parents[1]
    studio = (root / "services/business_yansi/studio_execution.py").read_text(encoding="utf-8")
    mirror = (root / "services/mirror/providers/openai_provider.py").read_text(encoding="utf-8")
    studio_model = (root / "services/business_yansi/studio.py").read_text(encoding="utf-8")
    assert "coerce_public_chat_model" not in studio
    assert "coerce_public_chat_model" not in mirror
    assert "BILIGN_STUDIO_MODEL" in studio_model
    assert "groq" not in mirror.lower()
    assert "mistral" not in mirror.lower()


def test_plain_postgres_production_startup_never_touches_vector():
    url = os.getenv("EZA_PLAIN_PG_TEST_URL", "").strip()
    if not url:
        pytest.skip("plain PostgreSQL without pgvector was not provided")
    engine = create_engine(url)
    try:
        with engine.begin() as connection:
            vector_type = connection.execute(
                text("SELECT 1 FROM pg_type WHERE typname = 'vector'")
            ).scalar()
            assert vector_type is None
            ran = apply_startup_schema(connection, SimpleNamespace(ENV="production", EZA_ENV=None))
            assert ran is False
            chunk_table = connection.execute(
                text("SELECT to_regclass('public.business_knowledge_chunks')")
            ).scalar()
            assert chunk_table is None
    finally:
        engine.dispose()
