"""The live Business answer path is the orchestrator for every brand."""
import inspect
from unittest.mock import AsyncMock

import pytest

from backend.services.business_yansi import answers
from backend.services.business_yansi.answers import BusinessHistory, answer


@pytest.mark.asyncio
async def test_every_brand_uses_the_orchestrator_and_not_the_quote_engine(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ANSWERS_ENABLED", "true")
    monkeypatch.setattr(answers, "_grounded_answer", AsyncMock(side_effect=AssertionError("quote engine")))
    seen = []

    async def fake_run(db, business_id, question, **kwargs):
        seen.append((str(business_id), question, kwargs.get("provider")))
        return {
            "assistant_answer": "Garanti iki yıldır.",
            "sources": [{"title": "Garanti", "chunk_id": "c", "knowledge_version_id": "v", "item_id": "i"}],
            "reason": None,
            "status": "answered",
        }

    monkeypatch.setattr("backend.services.business_yansi.business_rag_orchestrator.run_business_rag", fake_run)
    provider = AsyncMock()
    first = await answer("Garanti kaç yıl?", BusinessHistory([], "brand-a", [{"text": "secret"}]), provider=provider, db=object())
    second = await answer("Fiyat nedir?", BusinessHistory([], "brand-b", []), provider=provider, db=object())
    assert first["assistant_answer"] == "Garanti iki yıldır."
    assert "secret" not in first["assistant_answer"]
    assert "text" not in first["sources"][0]
    assert second["status"] == "answered"
    assert [row[0] for row in seen] == ["brand-a", "brand-b"]
    assert seen[0][2] is provider
    provider.assert_not_called()


def test_live_module_has_no_brand_allowlist():
    source = inspect.getsource(answers)
    assert "allowlist" not in source
    assert "_grounded_answer(" not in inspect.getsource(answers.answer)
