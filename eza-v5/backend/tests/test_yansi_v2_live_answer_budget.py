"""07I.2 — live answer quota/budget gates (mock provider, no paid AI)."""
from __future__ import annotations

import asyncio
import uuid
from decimal import Decimal

import pytest

from backend.services.yansi import live_answer_budget as budget
from backend.services.yansi.grounded_v2 import run_yansi_v2_grounded_answer
from backend.services.yansi.live_answer_budget import (
    LiveAnswerBudgetError,
    estimate_usage_micro,
    load_limits,
    reset_live_answer_budget_for_tests,
    reserve_live_answer,
    settle_live_answer,
)
from backend.services.yansi.publication_context import resolve_grounded_publication_context
from backend.tests.test_yansi_v2_grounded_retrieval import (
    BIZ,
    DB,
    KV_A,
    _content_a,
    _items_for_yansi_a,
    _live_sources,
    _rows,
    _seal,
    enabled,
)


@pytest.fixture(autouse=True)
def _memory_ledger(monkeypatch):
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_LEDGER", "memory")
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_AUTH_DAILY_LIMIT", "50")
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_ANON_DAILY_LIMIT", "20")
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_BUSINESS_DAILY_LIMIT", "500")
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_BUSINESS_DAILY_USD", "2")
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_PLATFORM_DAILY_USD", "10")
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_INPUT_USD_PER_MILLION", "0.15")
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_OUTPUT_USD_PER_MILLION", "0.60")
    reset_live_answer_budget_for_tests()
    yield
    reset_live_answer_budget_for_tests()


def _ctx():
    items, bundle_hash = _seal(_items_for_yansi_a())
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    return resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=_live_sources(),
        expected_contract_hash=publication["contract_hash"],
        expected_bundle_hash=bundle_hash,
        expected_business_id=BIZ,
    )


def _chunk():
    return {
        "business_id": BIZ,
        "item_id": str(uuid.uuid4()),
        "knowledge_version_id": KV_A,
        "chunk_id": str(uuid.uuid4()),
        "title": "WX-100",
        "text": _content_a(),
        "chunk_index": 0,
    }


async def _empty_siblings(business_id, version_ids):
    return []


def test_official_gpt4o_mini_reserve_ceiling():
    limits = load_limits()
    assert limits.reserve_micro == 750
    assert limits.input_per_million == Decimal("0.15")
    assert limits.output_per_million == Decimal("0.60")
    assert estimate_usage_micro(prompt_tokens=1000, completion_tokens=100) == 210


@pytest.mark.asyncio
async def test_successful_grounded_answer_with_budget(enabled):
    ctx = _ctx()
    chunk = _chunk()
    calls = {"n": 0}

    async def search(db, business_id, query, **kwargs):
        return {"results": [chunk], "reason": None, "errors": [], "notices": []}

    async def authorize(db, business_id, sources, **kwargs):
        return {"sources": list(sources), "rejected": [], "reason": None}

    async def provider(prompt, *, timeout, max_tokens):
        calls["n"] += 1
        assert "Yansı V2 Grounded" in prompt
        assert "untrusted conversational context" in prompt
        return {
            "ok": True,
            "output": (
                '{"answer":"WX-100 için garanti 2 yıldır.",'
                f'"source_refs":[{{"chunk_id":"{chunk["chunk_id"]}","knowledge_version_id":"{KV_A}",'
                f'"item_id":"{chunk["item_id"]}"}}]}}'
            ),
            "usage": {"prompt_tokens": 200, "completion_tokens": 40},
        }

    result = await run_yansi_v2_grounded_answer(
        DB(),
        context=ctx,
        question="WX-100 garantisi kaç yıl?",
        search_fn=search,
        authorize_fn=authorize,
        sibling_loader=_empty_siblings,
        provider=provider,
        lexical_only=True,
        enforce_live_answer_budget=True,
        budget_user_id="user-1",
        budget_ip_hash="iphash",
    )
    assert result["status"] == "answered"
    assert calls["n"] == 1
    assert result["yansi_v2_grounded"] is True


@pytest.mark.asyncio
async def test_no_information_without_provider_spend(enabled):
    items, _bundle_hash = _seal(_items_for_yansi_a())
    items2 = []
    for index, item in enumerate(
        item for item in items if item["sourceKind"] == "knowledge_version"
    ):
        row = dict(item)
        row["index"] = index
        items2.append(row)
    items2, hash2 = _seal(items2)
    pub2, node2, bundle2, ver2 = _rows(items2, hash2)
    ctx2 = resolve_grounded_publication_context(
        publication_row=pub2,
        node_row=node2,
        bundle_row=bundle2,
        bundle_version_row=ver2,
        live_sources=_live_sources(),
    )
    calls = {"n": 0}

    async def search_empty(db, business_id, query, **kwargs):
        return {"results": [], "reason": "no_match", "errors": [], "notices": []}

    async def authorize(db, business_id, sources, **kwargs):
        return {"sources": [], "rejected": [], "reason": None}

    async def provider(prompt, *, timeout, max_tokens):
        calls["n"] += 1
        raise AssertionError("no provider on empty evidence")

    before = dict(budget._MEMORY_COUNTERS)
    result = await run_yansi_v2_grounded_answer(
        DB(),
        context=ctx2,
        question="Stok var mı?",
        search_fn=search_empty,
        authorize_fn=authorize,
        sibling_loader=_empty_siblings,
        provider=provider,
        lexical_only=True,
        enforce_live_answer_budget=True,
        budget_user_id="user-1",
        budget_ip_hash="iphash",
    )
    assert result["status"] == "no_information"
    assert calls["n"] == 0
    assert budget._MEMORY_COUNTERS == before


@pytest.mark.asyncio
async def test_multi_live_questions_consume_quota(enabled, monkeypatch):
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_AUTH_DAILY_LIMIT", "2")
    reset_live_answer_budget_for_tests()
    ctx = _ctx()
    chunk = _chunk()

    async def search(db, business_id, query, **kwargs):
        return {"results": [chunk], "reason": None, "errors": [], "notices": []}

    async def authorize(db, business_id, sources, **kwargs):
        return {"sources": list(sources), "rejected": [], "reason": None}

    async def provider(prompt, *, timeout, max_tokens):
        return {
            "ok": True,
            "output": (
                '{"answer":"WX-100 için garanti 2 yıldır.",'
                f'"source_refs":[{{"chunk_id":"{chunk["chunk_id"]}","knowledge_version_id":"{KV_A}",'
                f'"item_id":"{chunk["item_id"]}"}}]}}'
            ),
            "usage": {"prompt_tokens": 50, "completion_tokens": 20},
        }

    for _ in range(2):
        result = await run_yansi_v2_grounded_answer(
            DB(),
            context=ctx,
            question="WX-100 garantisi kaç yıl?",
            search_fn=search,
            authorize_fn=authorize,
            sibling_loader=_empty_siblings,
            provider=provider,
            lexical_only=True,
            enforce_live_answer_budget=True,
            budget_user_id="user-1",
            budget_ip_hash="iphash",
        )
        assert result["status"] == "answered"

    denied = await run_yansi_v2_grounded_answer(
        DB(),
        context=ctx,
        question="WX-100 garantisi kaç yıl?",
        search_fn=search,
        authorize_fn=authorize,
        sibling_loader=_empty_siblings,
        provider=provider,
        lexical_only=True,
        enforce_live_answer_budget=True,
        budget_user_id="user-1",
        budget_ip_hash="iphash",
    )
    assert denied["status"] == "quota_user"
    assert "$" not in denied["assistant_answer"]
    assert "gpt" not in denied["assistant_answer"].lower()


@pytest.mark.asyncio
async def test_flag_off_zero_provider_and_zero_budget(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ANSWERS_ENABLED", "false")
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ENABLED", "true")
    ctx = _ctx()
    calls = {"n": 0}

    async def provider(prompt, *, timeout, max_tokens):
        calls["n"] += 1
        raise AssertionError("provider must not run")

    before = dict(budget._MEMORY_COUNTERS)
    result = await run_yansi_v2_grounded_answer(
        DB(),
        context=ctx,
        question="Garanti?",
        provider=provider,
        lexical_only=True,
        enforce_live_answer_budget=True,
        budget_user_id="user-1",
        budget_ip_hash="iphash",
    )
    assert result["status"] == "flag_off"
    assert calls["n"] == 0
    assert budget._MEMORY_COUNTERS == before


@pytest.mark.asyncio
async def test_anon_quota_exceeded():
    limits = load_limits()
    for _ in range(limits.anon_daily):
        res = await reserve_live_answer(
            business_id=BIZ, user_id=None, ip_hash="anon-ip"
        )
        await settle_live_answer(
            res, outcome="settled", prompt_tokens=10, completion_tokens=10
        )
    with pytest.raises(LiveAnswerBudgetError) as raised:
        await reserve_live_answer(business_id=BIZ, user_id=None, ip_hash="anon-ip")
    assert raised.value.code == "quota_anon"


@pytest.mark.asyncio
async def test_auth_quota_exceeded(monkeypatch):
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_AUTH_DAILY_LIMIT", "2")
    reset_live_answer_budget_for_tests()
    for _ in range(2):
        res = await reserve_live_answer(
            business_id=BIZ, user_id="u1", ip_hash="ignored-when-auth"
        )
        await settle_live_answer(
            res, outcome="settled", prompt_tokens=5, completion_tokens=5
        )
    with pytest.raises(LiveAnswerBudgetError) as raised:
        await reserve_live_answer(business_id=BIZ, user_id="u1", ip_hash="x")
    assert raised.value.code == "quota_user"


@pytest.mark.asyncio
async def test_business_count_limit(monkeypatch):
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_BUSINESS_DAILY_LIMIT", "2")
    reset_live_answer_budget_for_tests()
    for i in range(2):
        res = await reserve_live_answer(
            business_id=BIZ, user_id=f"u{i}", ip_hash=None
        )
        await settle_live_answer(
            res, outcome="settled", prompt_tokens=5, completion_tokens=5
        )
    with pytest.raises(LiveAnswerBudgetError) as raised:
        await reserve_live_answer(business_id=BIZ, user_id="u9", ip_hash=None)
    assert raised.value.code == "quota_business"


@pytest.mark.asyncio
async def test_business_usd_budget(monkeypatch):
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_BUSINESS_DAILY_USD", "0.00075")
    reset_live_answer_budget_for_tests()
    res = await reserve_live_answer(business_id=BIZ, user_id="u1", ip_hash=None)
    await settle_live_answer(res, outcome="uncertain")
    with pytest.raises(LiveAnswerBudgetError) as raised:
        await reserve_live_answer(business_id=BIZ, user_id="u2", ip_hash=None)
    assert raised.value.code == "budget_business"


@pytest.mark.asyncio
async def test_platform_usd_budget(monkeypatch):
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_PLATFORM_DAILY_USD", "0.00075")
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_BUSINESS_DAILY_USD", "2")
    reset_live_answer_budget_for_tests()
    other = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    res = await reserve_live_answer(business_id=BIZ, user_id="u1", ip_hash=None)
    await settle_live_answer(res, outcome="uncertain")
    with pytest.raises(LiveAnswerBudgetError) as raised:
        await reserve_live_answer(business_id=other, user_id="u2", ip_hash=None)
    assert raised.value.code == "budget_platform"


@pytest.mark.asyncio
async def test_concurrent_reservation_respects_limit(monkeypatch):
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_ANON_DAILY_LIMIT", "5")
    reset_live_answer_budget_for_tests()

    async def one():
        try:
            res = await reserve_live_answer(
                business_id=BIZ, user_id=None, ip_hash="same-ip"
            )
            await settle_live_answer(
                res, outcome="settled", prompt_tokens=1, completion_tokens=1
            )
            return "ok"
        except LiveAnswerBudgetError as exc:
            return exc.code

    results = await asyncio.gather(*[one() for _ in range(20)])
    assert results.count("ok") == 5
    assert results.count("quota_anon") == 15


@pytest.mark.asyncio
async def test_provider_failure_release_allows_retry():
    res = await reserve_live_answer(business_id=BIZ, user_id="u1", ip_hash=None)
    await settle_live_answer(res, outcome="release")
    res2 = await reserve_live_answer(business_id=BIZ, user_id="u1", ip_hash=None)
    assert res2.token != res.token


@pytest.mark.asyncio
async def test_ledger_unavailable_fail_closed(monkeypatch):
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_LEDGER", "redis")

    async def none_redis():
        return None

    monkeypatch.setattr(budget, "_redis", none_redis)
    with pytest.raises(LiveAnswerBudgetError) as raised:
        await reserve_live_answer(business_id=BIZ, user_id="u1", ip_hash=None)
    assert raised.value.code == "budget_unavailable"


@pytest.mark.asyncio
async def test_release_refunds_usd_for_next_caller(monkeypatch):
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_BUSINESS_DAILY_USD", "0.00075")
    reset_live_answer_budget_for_tests()
    res = await reserve_live_answer(business_id=BIZ, user_id="u1", ip_hash=None)
    await settle_live_answer(res, outcome="release")
    res2 = await reserve_live_answer(business_id=BIZ, user_id="u2", ip_hash=None)
    assert res2.reserve_micro == 750


@pytest.mark.asyncio
async def test_tenant_isolation_separate_business_counters(monkeypatch):
    monkeypatch.setenv("BILIGN_LIVE_ANSWER_BUSINESS_DAILY_LIMIT", "1")
    reset_live_answer_budget_for_tests()
    other = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    res = await reserve_live_answer(business_id=BIZ, user_id="u1", ip_hash=None)
    await settle_live_answer(res, outcome="settled", prompt_tokens=1, completion_tokens=1)
    with pytest.raises(LiveAnswerBudgetError):
        await reserve_live_answer(business_id=BIZ, user_id="u2", ip_hash=None)
    # Other brand still has room.
    ok = await reserve_live_answer(business_id=other, user_id="u2", ip_hash=None)
    assert ok.business_id == other


@pytest.mark.asyncio
async def test_v1_run_business_rag_unaffected_by_live_budget(enabled, monkeypatch):
    """V1 orchestrator must not auto-enforce the V2 live-answer ledger."""
    from backend.services.business_yansi.business_rag_orchestrator import run_business_rag

    monkeypatch.setenv("BILIGN_LIVE_ANSWER_AUTH_DAILY_LIMIT", "0")
    reset_live_answer_budget_for_tests()
    chunk = {
        "business_id": BIZ,
        "item_id": str(uuid.uuid4()),
        "knowledge_version_id": str(uuid.uuid4()),
        "chunk_id": str(uuid.uuid4()),
        "chunk_index": 0,
        "title": "WX-100",
        "text": "WX-100 için garanti 2 yıldır.",
    }

    async def search(db, business_id, query, **kwargs):
        return {"results": [chunk], "reason": None, "errors": [], "notices": []}

    async def authorize(db, business_id, sources, **kwargs):
        return {"sources": list(sources), "rejected": [], "reason": None}

    async def provider(prompt, *, timeout, max_tokens):
        return {
            "ok": True,
            "output": (
                '{"answer":"WX-100 için garanti 2 yıldır.",'
                f'"source_refs":[{{"chunk_id":"{chunk["chunk_id"]}",'
                f'"knowledge_version_id":"{chunk["knowledge_version_id"]}",'
                f'"item_id":"{chunk["item_id"]}"}}]}}'
            ),
            "usage": {"prompt_tokens": 20, "completion_tokens": 10},
        }

    found = await run_business_rag(
        DB(),
        BIZ,
        "garanti",
        search_fn=search,
        authorize_fn=authorize,
        sibling_loader=_empty_siblings,
        provider=provider,
        lexical_only=True,
    )
    assert found["status"] == "answered"
    assert budget._MEMORY_COUNTERS == {}


@pytest.mark.asyncio
async def test_v1_answers_orchestrator_does_not_auto_inject_live_provider(enabled, monkeypatch):
    """Flag flip must not open unpaid V1 OpenAI calls without an explicit provider."""
    from backend.services.business_yansi.answers import BusinessHistory, answer

    calls = {"n": 0}

    async def boom(*args, **kwargs):
        calls["n"] += 1
        raise AssertionError("live provider must not auto-inject")

    monkeypatch.setattr(
        "backend.services.business_yansi.answers._live_provider", boom
    )
    monkeypatch.setattr(
        "backend.services.business_yansi.answers._live_embedder", boom
    )
    history = BusinessHistory([], BIZ, [{"id": "1", "title": "t", "text": "x", "source": "s", "version": 1}])
    result = await answer("garanti?", history, db=DB())
    assert calls["n"] == 0
    assert result.get("business_grounded") is True
    # Without an injected provider the orchestrator stays closed / no live spend.
    assert result.get("status") in {None, "flag_off", "no_information"} or (
        "bulunamadı" in (result.get("assistant_answer") or "")
        or "kapalı" in (result.get("assistant_answer") or "")
    )
