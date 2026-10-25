"""Run hybrid retrieval, context building, and one package answer.

Live routers do not call this module. It does not call the quote answer path
or the sentence-verification answer path. A failed step does not fall through
to either of them.

The provider and embedder are injected. This module does not open a network
client. Both RAG flags are checked before an embedding or an answer call.
"""
from backend.core.llm.providers.openai_client import EMBEDDING_MODEL
from backend.models.business_yansi import canonical_embedding
from backend.services.business_yansi.chunking import product_codes
from backend.services.business_yansi.context_builder import build_business_context
from backend.services.business_yansi.grounded_answers import (
    MAX_EMBED_INPUT_TOKENS,
    MESSAGES,
    answers_enabled,
    embed_token_count,
)
from backend.services.business_yansi.package_answers import NO_INFORMATION, answer_from_package
from backend.services.business_yansi.rag import _uuid, enabled as retrieval_enabled
from backend.services.business_yansi.retrieval import (
    authorize_retrieved_sources,
    query_char_limit,
    search_public_knowledge,
    sources_for_model,
)


def _unique(values):
    found = []
    for value in values:
        if value not in found:
            found.append(value)
    return found


def _server_code(value):
    if isinstance(value, str) and product_codes(value) == [value]:
        return value
    return None


def resolve_product_context(question, product_context, history, business_id):
    """Current question code wins. Otherwise use a server stamp, never assistant prose."""
    stated = _unique(product_codes(question or ""))
    if len(stated) > 1:
        return {"kind": "ambiguous", "product_code": None, "item_id": None}
    if len(stated) == 1:
        return {"kind": "code", "product_code": stated[0], "item_id": None}
    codes = []
    items = []
    if isinstance(product_context, dict):
        code = _server_code(product_context.get("product_code"))
        if code:
            codes.append(code)
        item = product_context.get("item_id")
        if isinstance(item, str) and item.strip():
            items.append(item.strip())
    tenant = str(business_id)
    for turn in history or []:
        if not isinstance(turn, dict) or str(turn.get("business_id") or "") != tenant:
            continue
        for code in turn.get("product_codes") or []:
            checked = _server_code(code)
            if checked and checked not in codes:
                codes.append(checked)
        for item in turn.get("item_ids") or []:
            if isinstance(item, str) and item.strip() and item.strip() not in items:
                items.append(item.strip())
    if len(codes) > 1 or (not codes and len(items) > 1):
        return {"kind": "ambiguous", "product_code": None, "item_id": None}
    if len(codes) == 1:
        return {
            "kind": "code",
            "product_code": codes[0],
            "item_id": items[0] if len(items) == 1 else None,
        }
    if len(items) == 1:
        return {"kind": "item", "product_code": None, "item_id": items[0]}
    return {"kind": "none", "product_code": None, "item_id": None}


def _result(
    status,
    *,
    answer=None,
    refs=None,
    sources=None,
    reason=None,
    usage=None,
    package_status=None,
    retrieval_mode=None,
):
    text = MESSAGES.get(status, NO_INFORMATION) if answer is None else answer
    if status == "no_information" and answer is None:
        text = NO_INFORMATION
    return {
        "status": status,
        "assistant_answer": text,
        "answer": text,
        "sources": list(sources or []),
        "source_refs": list(refs or []),
        "reason": reason,
        "business_grounded": True,
        "usage": usage,
        "package_status": package_status,
        "retrieval_mode": retrieval_mode,
    }


def _usage(embedding_calls, embedding_tokens, answer_calls, answer_usage):
    return {
        "embedding_calls": embedding_calls,
        "embedding_prompt_tokens": embedding_tokens,
        "answer_calls": answer_calls,
        "answer": answer_usage,
    }


async def _rollback(db):
    rollback = getattr(db, "rollback", None)
    if rollback is None:
        return False
    try:
        await rollback()
    except Exception:
        return False
    return True


def _accept_embedding(result):
    if not isinstance(result, dict) or not result.get("ok"):
        return None, "embedding_failed"
    if result.get("model_name") != EMBEDDING_MODEL:
        return None, "embedding_model"
    usage = result.get("usage") or {}
    tokens = usage.get("prompt_tokens")
    if isinstance(tokens, int) and not isinstance(tokens, bool) and tokens > MAX_EMBED_INPUT_TOKENS:
        return None, "embedding_failed"
    vectors = result.get("vectors")
    if not isinstance(vectors, list) or len(vectors) != 1 or canonical_embedding(vectors[0]) is None:
        return None, "embedding_vector"
    return vectors[0], None


def _embedding_tokens(result):
    usage = result.get("usage") if isinstance(result, dict) else None
    tokens = usage.get("prompt_tokens") if isinstance(usage, dict) else None
    if isinstance(tokens, int) and not isinstance(tokens, bool):
        return tokens
    return None


def _public_sources(package, refs):
    by_chunk = {}
    for document in package.get("documents") or []:
        for section in document.get("sections") or []:
            by_chunk[str(section.get("chunk_id") or "")] = {
                "title": document.get("title") or "",
                "chunk_id": str(section.get("chunk_id") or ""),
                "knowledge_version_id": str(document.get("knowledge_version_id") or ""),
                "item_id": str(document.get("item_id") or ""),
            }
    return [by_chunk[ref["chunk_id"]] for ref in refs if ref.get("chunk_id") in by_chunk]


async def run_business_rag(
    db,
    business_id,
    question,
    *,
    product_context=None,
    history=None,
    search_fn=None,
    authorize_fn=None,
    sibling_loader=None,
    embedder=None,
    provider=None,
    lexical_only=False,
    token_budget=None,
):
    """Answer from the authorized package for one brand. The live path calls this."""
    if not answers_enabled() or not retrieval_enabled():
        return _result("flag_off", reason="flag_off", usage=_usage(0, None, 0, None))
    try:
        business_id = _uuid(business_id)
    except (TypeError, ValueError):
        return _result("retrieval_unavailable", reason="business_id", usage=_usage(0, None, 0, None))
    question = question if isinstance(question, str) else str(question or "")
    stripped = question.strip()
    if len(stripped) > query_char_limit():
        return _result("query_too_long", usage=_usage(0, None, 0, None))
    if not stripped:
        return _result("empty_query", usage=_usage(0, None, 0, None))
    focus = resolve_product_context(stripped, product_context, history, business_id)
    if focus["kind"] == "ambiguous":
        return _result("needs_clarification", usage=_usage(0, None, 0, None))
    if not await _rollback(db):
        return _result("retrieval_unavailable", reason="rollback_failed", usage=_usage(0, None, 0, None))
    code = focus.get("product_code")
    search_text = f"{code} {stripped}".strip() if code and code not in stripped else stripped
    mode = "lexical" if lexical_only else "hybrid"
    embedding_calls = 0
    embedding_tokens = None
    vector = None
    model = None
    if not lexical_only:
        counted = embed_token_count(search_text)
        if counted is None:
            return _result("retrieval_unavailable", reason="embedding_token_count", retrieval_mode=mode, usage=_usage(0, None, 0, None))
        if counted > MAX_EMBED_INPUT_TOKENS:
            return _result("query_too_long", retrieval_mode=mode, usage=_usage(0, None, 0, None))
        if embedder is None:
            return _result("retrieval_unavailable", reason="embedding_not_configured", retrieval_mode=mode, usage=_usage(0, None, 0, None))
        try:
            embedded = await embedder(search_text, timeout=12)
        except Exception:
            return _result("retrieval_unavailable", reason="embedding_failed", retrieval_mode=mode, usage=_usage(1, None, 0, None))
        embedding_calls = 1
        vector, error = _accept_embedding(embedded)
        embedding_tokens = _embedding_tokens(embedded)
        if error:
            return _result(
                "retrieval_unavailable",
                reason=error,
                retrieval_mode=mode,
                usage=_usage(1, embedding_tokens, 0, None),
            )
        model = EMBEDDING_MODEL
    search = search_fn or search_public_knowledge
    authorize = authorize_fn or authorize_retrieved_sources
    try:
        found = await search(
            db, business_id, search_text, client=None, query_vector=vector, query_model=model,
        )
    except Exception:
        await _rollback(db)
        return _result(
            "retrieval_unavailable",
            reason="search_failed",
            retrieval_mode=mode,
            usage=_usage(embedding_calls, embedding_tokens, 0, None),
        )
    if not await _rollback(db):
        return _result(
            "retrieval_unavailable",
            reason="rollback_failed",
            retrieval_mode=mode,
            usage=_usage(embedding_calls, embedding_tokens, 0, None),
        )
    if not isinstance(found, dict):
        return _result("retrieval_unavailable", reason="search_failed", retrieval_mode=mode, usage=_usage(embedding_calls, embedding_tokens, 0, None))
    reason = found.get("reason")
    if reason == "query_too_long":
        return _result("query_too_long", retrieval_mode=mode, usage=_usage(embedding_calls, embedding_tokens, 0, None))
    if reason == "empty_query":
        return _result("empty_query", retrieval_mode=mode, usage=_usage(embedding_calls, embedding_tokens, 0, None))
    if reason not in {None, "no_match", "low_relevance"}:
        return _result("retrieval_unavailable", reason="search_failed", retrieval_mode=mode, usage=_usage(embedding_calls, embedding_tokens, 0, None))
    rows = [row for row in list(found.get("results") or []) if str(row.get("business_id") or "") == str(business_id)]
    if focus.get("item_id") and code and code not in stripped:
        rows = [row for row in rows if str(row.get("item_id") or "") == focus["item_id"]]
    if not rows:
        return _result("no_information", reason="no_information", retrieval_mode=mode, usage=_usage(embedding_calls, embedding_tokens, 0, None))
    try:
        authorization = await authorize(db, business_id, rows)
    except Exception:
        await _rollback(db)
        return _result("authorization_failed", reason="authorization_error", retrieval_mode=mode, usage=_usage(embedding_calls, embedding_tokens, 0, None))
    if not await _rollback(db):
        return _result("retrieval_unavailable", reason="rollback_failed", retrieval_mode=mode, usage=_usage(embedding_calls, embedding_tokens, 0, None))
    if not isinstance(authorization, dict) or authorization.get("reason") not in {None}:
        return _result("authorization_failed", reason="authorization_error", retrieval_mode=mode, usage=_usage(embedding_calls, embedding_tokens, 0, None))
    granted = [
        source for source in sources_for_model(authorization)
        if str(source.get("business_id") or "") == str(business_id)
    ]
    if not granted:
        return _result("no_information", reason="unauthorized", retrieval_mode=mode, usage=_usage(embedding_calls, embedding_tokens, 0, None))
    context = None
    if focus.get("product_code") or focus.get("item_id"):
        context = {"product_code": focus.get("product_code"), "item_id": focus.get("item_id")}
    package = await build_business_context(
        stripped,
        business_id=business_id,
        sources=granted,
        product_context=context,
        sibling_loader=sibling_loader,
        authorize_fn=authorize,
        db=None if sibling_loader is not None else db,
        **({"token_budget": token_budget} if token_budget is not None else {}),
    )
    if package.get("status") != "ready":
        return _result(
            "no_information",
            reason=package.get("reason") or package.get("status"),
            package_status=package.get("status"),
            retrieval_mode=mode,
            usage=_usage(embedding_calls, embedding_tokens, 0, None),
        )
    calls = {"answer": 0}

    async def _once(prompt, *, timeout, max_tokens):
        calls["answer"] += 1
        return await provider(prompt, timeout=timeout, max_tokens=max_tokens)

    produced = await answer_from_package(
        stripped,
        package,
        product_context=context,
        provider=_once if provider is not None else None,
    )
    return _result(
        produced["status"] if produced.get("status") in {"answered", "no_information", "flag_off"} else "no_information",
        answer=produced.get("answer"),
        refs=produced.get("source_refs"),
        sources=_public_sources(package, produced.get("source_refs") or []),
        reason=produced.get("reason"),
        usage=_usage(embedding_calls, embedding_tokens, calls["answer"], produced.get("usage")),
        package_status="ready",
        retrieval_mode=mode,
    )
