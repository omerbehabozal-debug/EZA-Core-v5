"""End-to-end package orchestration with mock retrieval and a mock provider."""
import json
import uuid

import pytest

from backend.services.business_yansi.business_rag_orchestrator import run_business_rag

BRAND = uuid.UUID("00000000-0000-0000-0000-0000000000aa")
OTHER = uuid.UUID("00000000-0000-0000-0000-0000000000bb")


class DB:
    async def rollback(self):
        return None


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ANSWERS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ENABLED", "true")


def _chunk(business, text, title, version=None, item=None):
    return {
        "business_id": str(business),
        "item_id": str(item or uuid.uuid4()),
        "knowledge_version_id": str(version or uuid.uuid4()),
        "chunk_id": str(uuid.uuid4()),
        "chunk_index": 0,
        "title": title,
        "text": text,
    }


def _allow(rows):
    async def authorize(db, business_id, sources):
        return {"sources": list(sources), "rejected": [], "reason": None}
    return authorize


def _search(rows, check=None):
    async def search(db, business_id, query, **kwargs):
        if check:
            check(query, kwargs)
        assert kwargs.get("client") is None
        return {"results": rows, "reason": None, "errors": [], "notices": []}
    return search


def _reply(answer, refs):
    async def provider(prompt, *, timeout, max_tokens):
        return {
            "ok": True,
            "output": json.dumps({"answer": answer, "source_refs": refs}, ensure_ascii=False),
            "usage": {"prompt_tokens": 24, "completion_tokens": 12},
        }
    return provider


def _refs(chunks):
    return [{
        "chunk_id": chunk["chunk_id"],
        "knowledge_version_id": chunk["knowledge_version_id"],
        "item_id": chunk["item_id"],
    } for chunk in chunks]


@pytest.mark.asyncio
async def test_product_question_returns_a_natural_answer_once(enabled):
    warranty = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100")
    calls = {"provider": 0, "embed": 0}

    async def embedder(text, *, timeout):
        calls["embed"] += 1
        from backend.core.llm.providers.openai_client import EMBEDDING_MODEL
        return {
            "ok": True,
            "vectors": [[0.02] * 1536],
            "model_name": EMBEDDING_MODEL,
            "usage": {"prompt_tokens": 4},
        }

    async def provider(prompt, *, timeout, max_tokens):
        calls["provider"] += 1
        assert "Garanti 2 yıldır." in prompt
        return {
            "ok": True,
            "output": json.dumps({
                "answer": "WX-100 için garanti iki yıldır.",
                "source_refs": _refs([warranty]),
            }, ensure_ascii=False),
            "usage": {"prompt_tokens": 20, "completion_tokens": 8},
        }

    found = await run_business_rag(
        DB(), BRAND, "WX-100 garantisi kaç yıl?",
        search_fn=_search([warranty]),
        authorize_fn=_allow([warranty]),
        sibling_loader=_empty_siblings,
        embedder=embedder,
        provider=provider,
    )
    assert found["status"] == "answered"
    assert found["assistant_answer"] == "WX-100 için garanti iki yıldır."
    assert found["business_grounded"] is True
    assert found["sources"][0]["title"] == "WX-100"
    assert "text" not in found["sources"][0]
    assert calls == {"provider": 1, "embed": 1}
    assert found["usage"]["embedding_calls"] == 1
    assert found["usage"]["answer_calls"] == 1
    assert found["usage"]["embedding_prompt_tokens"] == 4


async def _empty_siblings(business_id, version_ids):
    return []


@pytest.mark.asyncio
async def test_warranty_exception_and_several_topics_reach_the_provider(enabled):
    version = uuid.uuid4()
    item = uuid.uuid4()
    warranty = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100", version, item)
    exception = _chunk(BRAND, "Ticari kullanımda garanti geçerli değildir.", "WX-100", version, item)
    exception["chunk_index"] = 1
    cloth = _chunk(BRAND, "Kumaşı pamuktur.", "WX-100", version, item)
    cloth["chunk_index"] = 2
    seen = {}

    async def provider(prompt, *, timeout, max_tokens):
        seen["prompt"] = prompt
        return {
            "ok": True,
            "output": json.dumps({
                "answer": "WX-100 pamuk kumaşlıdır. Garantisi iki yıldır ve ticari kullanımda geçerli değildir.",
                "source_refs": _refs([warranty, exception, cloth]),
            }, ensure_ascii=False),
            "usage": {"prompt_tokens": 30, "completion_tokens": 16},
        }

    async def load(business_id, version_ids):
        return [exception, cloth]

    found = await run_business_rag(
        DB(), BRAND, "WX-100 garantisi ve kumaşı nedir?",
        search_fn=_search([warranty]),
        authorize_fn=_allow(None),
        sibling_loader=load,
        provider=provider,
        lexical_only=True,
    )
    assert found["status"] == "answered"
    assert "pamuk" in found["answer"] and "ticari kullanımda" in found["answer"]
    assert "geçerli değildir" in seen["prompt"]
    assert "Kumaşı pamuktur." in seen["prompt"]
    assert found["usage"]["answer_calls"] == 1
    assert found["usage"]["embedding_calls"] == 0


@pytest.mark.asyncio
async def test_follow_up_uses_server_stamp_and_a_new_code_replaces_it(enabled):
    current = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100")
    other = _chunk(BRAND, "Garanti 9 yıldır.", "WX-200")
    queries = []

    async def search(db, business_id, query, **kwargs):
        queries.append(query)
        rows = [current] if "WX-100" in query else [other]
        return {"results": rows, "reason": None, "errors": [], "notices": []}

    async def provider(prompt, *, timeout, max_tokens):
        answer = "WX-100 için garanti iki yıldır." if "WX-100" in prompt else "WX-200 için garanti dokuz yıldır."
        refs = _refs([current] if "WX-100" in prompt else [other])
        return {
            "ok": True,
            "output": json.dumps({"answer": answer, "source_refs": refs}, ensure_ascii=False),
            "usage": {"prompt_tokens": 12, "completion_tokens": 8},
        }

    followed = await run_business_rag(
        DB(), BRAND, "Garantisi kaç yıl?",
        product_context={"product_code": "WX-100"},
        history=[{
            "role": "assistant",
            "content": "WX-200 çok daha uzun garantilidir.",
            "business_id": str(BRAND),
        }],
        search_fn=search,
        authorize_fn=_allow(None),
        sibling_loader=_empty_siblings,
        provider=provider,
        lexical_only=True,
    )
    assert queries[0].startswith("WX-100 ")
    assert "WX-200" not in queries[0]
    assert followed["answer"] == "WX-100 için garanti iki yıldır."
    switched = await run_business_rag(
        DB(), BRAND, "WX-200 garantisi kaç yıl?",
        product_context={"product_code": "WX-100"},
        search_fn=search,
        authorize_fn=_allow(None),
        sibling_loader=_empty_siblings,
        provider=provider,
        lexical_only=True,
    )
    assert queries[1] == "WX-200 garantisi kaç yıl?"
    assert switched["answer"] == "WX-200 için garanti dokuz yıldır."


@pytest.mark.asyncio
async def test_wrong_product_tenant_unauthorized_conflict_and_gap_skip_the_provider(enabled):
    calls = {"provider": 0}

    async def provider(prompt, *, timeout, max_tokens):
        calls["provider"] += 1
        raise AssertionError("provider")

    wrong = _chunk(BRAND, "Garanti 5 yıldır.", "WX-200")
    missed = await run_business_rag(
        DB(), BRAND, "WX-100 garantisi kaç yıl?",
        search_fn=_search([wrong]),
        authorize_fn=_allow(None),
        sibling_loader=_empty_siblings,
        provider=provider,
        lexical_only=True,
    )
    assert missed["status"] == "no_information"
    assert missed["reason"] == "product_mismatch"
    assert "5 yıldır" not in missed["answer"]

    foreign = _chunk(OTHER, "Garanti 2 yıldır.", "WX-100")
    isolated = await run_business_rag(
        DB(), BRAND, "WX-100 garantisi kaç yıl?",
        search_fn=_search([foreign]),
        authorize_fn=_allow(None),
        sibling_loader=_empty_siblings,
        provider=provider,
        lexical_only=True,
    )
    assert isolated["status"] == "no_information"
    assert isolated["reason"] == "no_information"

    hidden = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100")

    async def deny(db, business_id, sources):
        return {"sources": [], "rejected": [source["chunk_id"] for source in sources], "reason": None}

    blocked = await run_business_rag(
        DB(), BRAND, "WX-100 garantisi kaç yıl?",
        search_fn=_search([hidden]),
        authorize_fn=deny,
        sibling_loader=_empty_siblings,
        provider=provider,
        lexical_only=True,
    )
    assert blocked["reason"] == "unauthorized"

    older = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100")
    newer = _chunk(BRAND, "Garanti 5 yıldır.", "WX-100")
    conflict = await run_business_rag(
        DB(), BRAND, "WX-100 garantisi kaç yıl?",
        search_fn=_search([older, newer]),
        authorize_fn=_allow(None),
        sibling_loader=_empty_siblings,
        provider=provider,
        lexical_only=True,
    )
    assert conflict["status"] == "no_information"
    assert conflict["reason"] == "source_conflict"
    assert conflict["package_status"] == "conflict"

    version = uuid.uuid4()
    item = uuid.uuid4()
    warranty = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100", version, item)
    exception = _chunk(BRAND, "Ticari kullanımda garanti geçerli değildir.", "WX-100", version, item)

    async def deny_exception(db, business_id, sources):
        kept = [source for source in sources if source["chunk_id"] != exception["chunk_id"]]
        return {"sources": kept, "rejected": [exception["chunk_id"]], "reason": None}

    async def load(business_id, version_ids):
        return [exception]

    gap = await run_business_rag(
        DB(), BRAND, "WX-100 garantisi kaç yıl?",
        search_fn=_search([warranty]),
        authorize_fn=deny_exception,
        sibling_loader=load,
        provider=provider,
        lexical_only=True,
    )
    assert gap["reason"] == "missing_condition"
    assert calls["provider"] == 0


@pytest.mark.asyncio
async def test_flags_budget_provider_failure_and_bad_ref(enabled, monkeypatch):
    chunk = _chunk(BRAND, "Garanti 2 yıldır.", "WX-100")

    async def explode(prompt, *, timeout, max_tokens):
        raise AssertionError("provider")

    async def search(db, business_id, query, **kwargs):
        raise AssertionError("search")

    monkeypatch.delenv("BILIGN_BUSINESS_RAG_ENABLED", raising=False)
    flagged = await run_business_rag(
        DB(), BRAND, "WX-100 garantisi kaç yıl?",
        search_fn=search,
        provider=explode,
        embedder=explode,
    )
    assert flagged["status"] == "flag_off"
    assert flagged["usage"]["embedding_calls"] == 0
    assert flagged["usage"]["answer_calls"] == 0
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ENABLED", "true")

    tight = await run_business_rag(
        DB(), BRAND, "WX-100 garantisi kaç yıl?",
        search_fn=_search([chunk]),
        authorize_fn=_allow(None),
        sibling_loader=_empty_siblings,
        provider=explode,
        lexical_only=True,
        token_budget=1,
    )
    assert tight["reason"] == "token_budget"
    assert tight["usage"]["answer_calls"] == 0

    async def fail(prompt, *, timeout, max_tokens):
        raise TimeoutError("sk-proj-secretsecretsecret")

    failed = await run_business_rag(
        DB(), BRAND, "WX-100 garantisi kaç yıl?",
        search_fn=_search([chunk]),
        authorize_fn=_allow(None),
        sibling_loader=_empty_siblings,
        provider=fail,
        lexical_only=True,
    )
    assert failed["status"] == "no_information"
    assert failed["reason"] == "provider_timeout"
    assert "sk-" not in failed["answer"]
    assert failed["usage"]["answer_calls"] == 1

    async def bad_ref(prompt, *, timeout, max_tokens):
        return {
            "ok": True,
            "output": json.dumps({
                "answer": "WX-100 için garanti iki yıldır.",
                "source_refs": [{
                    "chunk_id": str(uuid.uuid4()),
                    "knowledge_version_id": chunk["knowledge_version_id"],
                    "item_id": chunk["item_id"],
                }],
            }),
            "usage": {"prompt_tokens": 10, "completion_tokens": 4},
        }

    broken = await run_business_rag(
        DB(), BRAND, "WX-100 garantisi kaç yıl?",
        search_fn=_search([chunk]),
        authorize_fn=_allow(None),
        sibling_loader=_empty_siblings,
        provider=bad_ref,
        lexical_only=True,
    )
    assert broken["reason"] == "unsupported_source"
    assert broken["source_refs"] == []
    assert "iki yıldır" not in broken["answer"]


@pytest.mark.asyncio
async def test_two_product_codes_ask_for_clarification_without_search(enabled):
    async def search(db, business_id, query, **kwargs):
        raise AssertionError("search")

    async def provider(prompt, *, timeout, max_tokens):
        raise AssertionError("provider")

    found = await run_business_rag(
        DB(), BRAND, "WX-100 ve WX-200 farkı nedir?",
        search_fn=search,
        provider=provider,
        lexical_only=True,
    )
    assert found["status"] == "needs_clarification"
    assert "WX-100" not in found["answer"] and "WX-200" not in found["answer"]


def test_orchestrator_does_not_import_the_other_answer_engines():
    import backend.services.business_yansi.business_rag_orchestrator as orchestrator
    import inspect
    source = inspect.getsource(orchestrator)
    assert "answer_business_question" not in source
    assert "services.business_yansi.answers" not in source
