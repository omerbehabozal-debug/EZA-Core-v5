import copy
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import UUID, dialect
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.models.yansi_editorial import YansiEditorialVersion
from backend.models.mirror_network import MirrorNetworkNode
from backend.services.mirror_network import editorial_version as service
from backend.services.mirror_network.editorial_structure import (
    answer_blocks, build_metadata, validate_metadata, source_hash, utf16_length,
)


@compiles(UUID, "sqlite")
def compile_uuid(_type, _compiler, **_kw):
    return "CHAR(32)"


def public(version=1, answer="# Başlık\n\nTürkçe 😀.\n\n1. Bir\n   - İki\n\n```md\n# Kod\n```\n\n## Son\nAlıntı"):
    return {"slug": "editorial-test", "journeyVersion": version, "publicTitle": "Orijinal başlık",
            "steps": [{"stepIndex": i, "publicQuestion": "Soru 😀?", "publicAnswer": answer} for i in range(1, 7)]}


@pytest.mark.parametrize("newline", ["\n", "\r\n", "\r"])
def test_lossless_unicode_markdown(newline):
    p = public(answer=public()["steps"][0]["publicAnswer"].replace("\n", newline))
    before = copy.deepcopy(p)
    metadata = build_metadata(p)
    validate_metadata(p, metadata)
    for source, step in zip(p["steps"], metadata):
        encoded = source["publicAnswer"].encode("utf-16-le")
        parts = [encoded[b["startOffset"]*2:b["endOffset"]*2].decode("utf-16-le") for b in step["blocks"]]
        assert "".join(parts) == source["publicAnswer"]
        assert [b["displayNumber"] for b in step["blocks"] if b["type"] == "sectionHeading"] == ["01", "02"]
        assert step["blocks"][-1]["endOffset"] == utf16_length(source["publicAnswer"])
    assert p == before


def test_flattened_text_is_not_invented_sections():
    text = "1. Öz farkındalık: Bir paragraf. 2. Bağlam: Başka paragraf."
    assert answer_blocks(text) == [{"type": "markdown", "startOffset": 0, "endOffset": len(text)}]


@pytest.mark.parametrize("change", ["gap", "order", "fake_heading", "hash"])
def test_invalid_metadata_rejected(change):
    p = public(); metadata = build_metadata(p)
    if change == "gap": metadata[0]["blocks"][0]["endOffset"] -= 1
    if change == "order": metadata.reverse()
    if change == "fake_heading": metadata[0]["blocks"][1]["type"] = "sectionHeading"
    if change == "hash": metadata[0]["answerHash"] = "wrong"
    with pytest.raises(ValueError): validate_metadata(p, metadata)


class Database:
    def __init__(self, session): self.session = session
    async def execute(self, statement):
        if statement.column_descriptions[0]["entity"] is MirrorNetworkNode:
            assert "FOR UPDATE" in str(statement.compile(dialect=dialect()))
            return SimpleNamespace(scalar_one_or_none=lambda: object())
        return self.session.execute(statement)
    def add(self, row): self.session.add(row)
    async def commit(self): self.session.commit()
    async def rollback(self): self.session.rollback()


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    YansiEditorialVersion.__table__.create(engine)
    with Session(engine) as session: yield Database(session)
    engine.dispose()


@pytest.mark.asyncio
async def test_persistence_hit_and_version_hash_isolation(db, monkeypatch):
    loader = AsyncMock(return_value=public())
    monkeypatch.setattr(service, "get_public_frozen_journey_artifact", loader)
    original = service.build_metadata
    calls = []
    def build(p): calls.append(p["journeyVersion"]); return original(p)
    monkeypatch.setattr(service, "build_metadata", build)
    first = await service.get_editorial_version(db, slug="editorial-test")
    second = await service.get_editorial_version(db, slug="editorial-test")
    assert first == second and first["status"] == "ready" and calls == [1]
    loader.return_value = public(2)
    await service.get_editorial_version(db, slug="editorial-test", journey_version=2)
    loader.return_value = public(2, "Changed public content")
    await service.get_editorial_version(db, slug="editorial-test", journey_version=2)
    assert len(db.session.execute(select(YansiEditorialVersion)).scalars().all()) == 3
    assert calls == [1, 2, 2]


@pytest.mark.asyncio
async def test_failure_is_persisted_no_immediate_retry_and_inaccessible_hit_denied(db, monkeypatch):
    loader = AsyncMock(return_value=public())
    monkeypatch.setattr(service, "get_public_frozen_journey_artifact", loader)
    def fail(p): raise ValueError("invalid")
    monkeypatch.setattr(service, "build_metadata", fail)
    first = await service.get_editorial_version(db, slug="editorial-test")
    second = await service.get_editorial_version(db, slug="editorial-test")
    assert first == second and first["status"] == "failed" and first["steps"] == []
    assert db.session.execute(select(YansiEditorialVersion)).scalar_one().attempts == 1
    for _ in range(4):
        row = db.session.execute(select(YansiEditorialVersion)).scalar_one()
        row.retry_after = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.session.commit()
        await service.get_editorial_version(db, slug="editorial-test")
    assert db.session.execute(select(YansiEditorialVersion)).scalar_one().attempts == 3
    loader.return_value = None
    assert await service.get_editorial_version(db, slug="editorial-test") is None


def test_database_constraint_prevents_duplicate_but_separates_language_template_and_version(db):
    identity = {"slug": "editorial-test", "journey_version": 1, "language": "und", "template_version": 1, "source_hash": "a" * 64}
    db.session.add(YansiEditorialVersion(**identity, status="ready", attempts=1))
    db.session.commit()
    db.session.add(YansiEditorialVersion(**identity, status="ready", attempts=1))
    with pytest.raises(IntegrityError): db.session.commit()
    db.session.rollback()
    for change in ({"language": "en"}, {"template_version": 2}, {"journey_version": 2}):
        db.session.add(YansiEditorialVersion(**{**identity, **change}, status="ready", attempts=1))
    db.session.commit()
    assert len(db.session.execute(select(YansiEditorialVersion)).scalars().all()) == 4


def test_unique_identity_and_original_language_only():
    unique = next(c for c in YansiEditorialVersion.__table__.constraints if c.name == "uq_yansi_editorial_identity")
    assert [c.name for c in unique.columns] == ["slug", "journey_version", "language", "template_version", "source_hash"]
    p = public(); assert source_hash(p) != source_hash(public(1, "different"))


def test_private_extras_cannot_enter_hash_or_structure():
    p = public(); before = copy.deepcopy(p)
    p["private_payload"] = {"intent": "private", "ezaFinal": 99}
    for step in p["steps"]:
        step["ezaSnapshot"] = {"assistantScore": 99, "userScore": 88, "intent": "private"}
        step["source_user_message_id"] = "private-id"
    assert source_hash(p) == source_hash(before)
    assert build_metadata(p) == build_metadata(before)


@pytest.mark.parametrize("version", [1, 3])
def test_anonymous_endpoint_allowlists_no_private_fields(version, monkeypatch):
    from backend.routers import mirror_network as routes
    from backend.services.mirror_network import frozen_journey_artifact as frozen
    from backend.tests.test_public_yansi_privacy_hotfix import assert_no_analysis
    # Real public projection remains the endpoint's input boundary.
    p = public(version)
    payload = {"slug": p["slug"], "journeyVersion": version, "language": "und", "templateVersion": 1,
               "sourceHash": source_hash(p), "offsetEncoding": "utf-16", "status": "ready", "steps": build_metadata(p)}
    monkeypatch.setattr(service, "get_editorial_version", AsyncMock(return_value=payload))
    app = FastAPI(); app.include_router(routes.router)
    app.dependency_overrides[routes.get_db] = lambda: object()
    app.dependency_overrides[routes.rate_limit_standalone] = lambda: None
    with TestClient(app) as client:
        response = client.get(f"/api/mirror-network/editorial-test/editorial?journeyVersion={version}")
        assert client.get("/api/mirror-network/editorial-test/editorial?language=en").status_code == 422
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    assert_no_analysis(response.json())
    assert "sourceConversationId" not in response.json() and "authorUserId" not in response.json()
    assert "publicAnswer" not in str(response.json())
