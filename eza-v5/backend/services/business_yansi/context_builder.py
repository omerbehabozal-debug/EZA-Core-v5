"""Build a Business context package from authorized retrieval rows.

Live answer endpoints do not call this module. It does not call OpenAI and it
does not publish an answer. The package is the input a later answer step may
send. Product identity comes from the knowledge document and from the server
product context, never from model text.

A sibling chunk enters the package only after the same authorization check
used for retrieved rows. A warranty section is not sent without a condition
or exception that belongs with it. Conflicting authorized values are not
resolved by the knowledge version number.
"""
import re

from backend.services.business_yansi.chunking import product_codes
from backend.services.business_yansi.grounded_answers import (
    ANSWER_MODEL,
    commercial_topics,
    document_product_identity,
    scopes_in,
    source_sentences,
)
from backend.services.business_yansi.retrieval import (
    authorize_retrieved_sources,
    fold_turkish,
    list_sibling_chunks,
)

DEFAULT_CONTEXT_TOKEN_BUDGET = 2000

_NUMBER = re.compile(r"\d+")


def count_tokens(text, model=ANSWER_MODEL):
    """Token count for the answer model. None means the count is unavailable."""
    try:
        import tiktoken
        encoder = tiktoken.encoding_for_model(model)
        return len(encoder.encode(text or ""))
    except Exception:
        return None


def _asked_codes(question, product_context):
    """The question's own code wins. A follow-up uses the server context."""
    stated = []
    for code in product_codes(question or ""):
        if code not in stated:
            stated.append(code)
    if len(stated) > 1:
        return None
    if len(stated) == 1:
        return stated
    focus = (product_context or {}).get("product_code")
    if isinstance(focus, str) and focus.strip():
        return [focus.strip()]
    return []


def _numbers(text):
    return tuple(_NUMBER.findall(text or ""))


def _sort_key(chunk):
    index = chunk.get("chunk_index")
    try:
        index = int(index)
    except (TypeError, ValueError):
        index = 10**9
    return (index, str(chunk.get("chunk_id") or ""))


def _same_tenant(chunk, business_id):
    return str(chunk.get("business_id") or "") == str(business_id)


def _document_identity(chunks):
    ordered = sorted(chunks, key=_sort_key)
    meta = None
    for chunk in ordered:
        value = chunk.get("product_codes")
        if isinstance(value, (list, tuple)) and value:
            meta = value
            break
    return document_product_identity({
        "title": ordered[0].get("title") or "",
        "text": "\n".join(chunk.get("text") or "" for chunk in ordered),
        "product_codes": meta,
    })


def _relevant(text, question):
    topics = set(commercial_topics(question))
    chunk_topics = set(commercial_topics(text))
    if topics and topics & chunk_topics:
        return True
    if topics and scopes_in(text) and not chunk_topics:
        return True
    if topics:
        return False
    folded = fold_turkish(text)
    for code in _asked_codes(question, None) or []:
        if fold_turkish(code) in folded:
            return True
    terms = re.findall(r"[0-9A-Za-zÇĞİÖŞÜçğıöşü]{4,}", fold_turkish(question or ""))
    return any(term in folded for term in terms)


def _claims(text):
    found = []
    for sentence in source_sentences(text):
        topics = commercial_topics(sentence)
        numbers = _numbers(sentence)
        if not topics or not numbers:
            continue
        found.append({
            "topics": tuple(topics),
            "numbers": numbers,
            "scopes": tuple(scopes_in(sentence)),
            "sentence": fold_turkish(sentence),
        })
    return found


def _conflicts(documents):
    """Different numbers for one product and attribute. Version is not a winner."""
    across = {}
    for document in documents:
        version_id = document["knowledge_version_id"]
        within = {}
        for section in document["sections"]:
            for claim in _claims(section["text"]):
                for topic in claim["topics"]:
                    slot = (claim["numbers"], claim["scopes"], claim["sentence"])
                    within.setdefault(topic, []).append(slot)
                    across.setdefault(topic, {}).setdefault(version_id, set()).add(slot)
        for topic, slots in within.items():
            by_scope = {}
            for numbers, scopes, _sentence in slots:
                by_scope.setdefault(scopes, set()).add(numbers)
            for numbers in by_scope.values():
                if len(numbers) > 1:
                    return topic
    for topic, versions in across.items():
        if len(versions) < 2:
            continue
        signatures = {frozenset(slots) for slots in versions.values()}
        if len(signatures) > 1:
            return topic
    return None


def _package(
    *,
    status,
    reason,
    codes,
    origin,
    documents,
    conditions,
    refs,
    gaps,
    conflicts,
    token_count,
    token_budget,
):
    return {
        "status": status,
        "reason": reason,
        "product": {"codes": list(codes), "origin": origin},
        "documents": documents,
        "conditions": conditions,
        "source_refs": refs,
        "gaps": gaps,
        "conflicts": conflicts,
        "token_count": token_count,
        "token_budget": token_budget,
    }


def _blocked(reason, codes, origin, token_budget, gaps=None, conflicts=None):
    return _package(
        status="conflict" if reason == "source_conflict" else "insufficient",
        reason=reason,
        codes=codes,
        origin=origin,
        documents=[],
        conditions=[],
        refs=[],
        gaps=list(gaps or [reason]),
        conflicts=list(conflicts or []),
        token_count=0,
        token_budget=token_budget,
    )


def _section_tokens(text, model):
    counted = count_tokens(text, model)
    if counted is None:
        return None
    separator = count_tokens("\n", model)
    if separator is None:
        return None
    return counted + separator


async def _expand_siblings(business_id, version_ids, sibling_loader, db):
    if sibling_loader is not None:
        loaded = await sibling_loader(business_id, version_ids)
        return list(loaded or []), None
    if db is None:
        return [], None
    listed = await list_sibling_chunks(db, business_id, version_ids)
    if listed.get("reason") not in {None, "empty"}:
        return [], listed.get("reason") or "sibling_unavailable"
    return list(listed.get("chunks") or []), None


async def build_business_context(
    question,
    *,
    business_id,
    sources,
    product_context=None,
    token_budget=DEFAULT_CONTEXT_TOKEN_BUDGET,
    sibling_loader=None,
    authorize_fn=None,
    db=None,
    answer_model=ANSWER_MODEL,
):
    """Assemble one tenant package. This does not call a model or a live route.

    ``sources`` are retrieval rows the caller has already authorized. Extra
    chunks of the same knowledge version are included only when a sibling read
    succeeds and ``authorize_fn`` grants them. Without a database or a loader,
    the supplied rows are the whole document set.
    """
    if not isinstance(token_budget, int) or isinstance(token_budget, bool) or token_budget < 1:
        return _blocked("token_budget", [], "absent", 0)
    asked = _asked_codes(question, product_context)
    if asked is None:
        return _blocked("product_unresolved", [], "ambiguous", token_budget)
    tenant_sources = [source for source in sources or [] if isinstance(source, dict) and _same_tenant(source, business_id)]
    if sources and not tenant_sources:
        return _blocked("tenant", asked or [], "absent", token_budget)
    version_ids = []
    for source in tenant_sources:
        version_id = str(source.get("knowledge_version_id") or "")
        if version_id and version_id not in version_ids:
            version_ids.append(version_id)
    extra, sibling_error = await _expand_siblings(business_id, version_ids, sibling_loader, db)
    if sibling_error:
        return _blocked("sibling_unavailable", asked or [], "absent", token_budget)
    candidates = []
    seen = {str(source.get("chunk_id") or "") for source in tenant_sources}
    for chunk in extra:
        if not isinstance(chunk, dict):
            continue
        chunk_id = str(chunk.get("chunk_id") or "")
        if not chunk_id or chunk_id in seen:
            continue
        seen.add(chunk_id)
        candidates.append(chunk)
    foreign = [chunk for chunk in candidates if not _same_tenant(chunk, business_id)]
    own = [chunk for chunk in candidates if _same_tenant(chunk, business_id)]
    granted = []
    rejected_chunks = list(foreign)
    if own:
        checker = authorize_fn
        if checker is None and db is not None and sibling_loader is None:
            checker = authorize_retrieved_sources
        if checker is None:
            rejected_chunks.extend(own)
        else:
            authorization = await checker(db, business_id, own)
            if not isinstance(authorization, dict) or authorization.get("reason") not in {None}:
                return _blocked("sibling_unavailable", asked or [], "absent", token_budget)
            granted_ids = set()
            for source in authorization.get("sources") or []:
                if _same_tenant(source, business_id):
                    granted.append(source)
                    granted_ids.add(str(source.get("chunk_id") or ""))
            for chunk in own:
                if str(chunk.get("chunk_id") or "") not in granted_ids:
                    rejected_chunks.append(chunk)
    grouped = {}
    for source in tenant_sources + granted:
        version_id = str(source.get("knowledge_version_id") or "")
        grouped.setdefault(version_id, []).append(source)
    documents = []
    skipped = []
    for version_id, chunks in grouped.items():
        identity = _document_identity(chunks)
        if asked and (identity["origin"] in {"absent", "ambiguous"} or identity["codes"] != asked):
            skipped.append(identity["origin"])
            continue
        if not asked and identity["origin"] == "ambiguous":
            skipped.append(identity["origin"])
            continue
        ordered = sorted(chunks, key=_sort_key)
        documents.append({
            "item_id": str(ordered[0].get("item_id") or ""),
            "knowledge_version_id": version_id,
            "title": ordered[0].get("title") or "",
            "identity": identity,
            "chunks": ordered,
        })
    if asked and not documents:
        reason = "product_unresolved" if any(origin in {"ambiguous", "absent"} for origin in skipped) else "product_mismatch"
        return _blocked(reason, asked, "unresolved", token_budget)
    if not asked and skipped and not documents:
        return _blocked("product_unresolved", [], "ambiguous", token_budget)
    if not documents:
        return _blocked("empty", [], "absent", token_budget)
    kept_versions = {document["knowledge_version_id"] for document in documents}
    for chunk in rejected_chunks:
        if str(chunk.get("knowledge_version_id") or "") not in kept_versions:
            continue
        if _relevant(chunk.get("text") or "", question):
            return _blocked("missing_condition", asked or documents[0]["identity"]["codes"], documents[0]["identity"]["origin"], token_budget)
    topic = _conflicts([
        {
            "knowledge_version_id": document["knowledge_version_id"],
            "sections": [{"text": chunk.get("text") or ""} for chunk in document["chunks"]],
        }
        for document in documents
    ])
    if topic:
        return _blocked(
            "source_conflict",
            asked or documents[0]["identity"]["codes"],
            documents[0]["identity"]["origin"],
            token_budget,
            gaps=["source_conflict"],
            conflicts=[{
                "attribute": topic,
                "source_ids": [chunk.get("chunk_id") for document in documents for chunk in document["chunks"]],
            }],
        )
    question_topics = set(commercial_topics(question))
    relevant = []
    extras = []
    for document in documents:
        for chunk in document["chunks"]:
            record = (document, chunk)
            if _relevant(chunk.get("text") or "", question):
                relevant.append(record)
            else:
                extras.append(record)
    if question_topics and not relevant:
        return _blocked("attribute_absent", asked or documents[0]["identity"]["codes"], documents[0]["identity"]["origin"], token_budget)
    selected = []
    used = 0
    for document, chunk in relevant:
        counted = _section_tokens(chunk.get("text") or "", answer_model)
        if counted is None:
            return _blocked("token_count_unavailable", asked or document["identity"]["codes"], document["identity"]["origin"], token_budget)
        if used + counted > token_budget:
            return _blocked("token_budget", asked or document["identity"]["codes"], document["identity"]["origin"], token_budget)
        used += counted
        selected.append((document, chunk, "primary" if commercial_topics(chunk.get("text") or "") else "condition"))
    for document, chunk in extras:
        counted = _section_tokens(chunk.get("text") or "", answer_model)
        if counted is None:
            return _blocked("token_count_unavailable", asked or document["identity"]["codes"], document["identity"]["origin"], token_budget)
        if used + counted > token_budget:
            continue
        used += counted
        selected.append((document, chunk, "document"))
    if not selected:
        return _blocked("empty", asked or [], "absent", token_budget)
    by_version = {}
    conditions = []
    refs = []
    for document, chunk, role in selected:
        version_id = document["knowledge_version_id"]
        entry = by_version.setdefault(version_id, {
            "item_id": document["item_id"],
            "knowledge_version_id": version_id,
            "title": document["title"],
            "product": document["identity"],
            "sections": [],
        })
        text = chunk.get("text") or ""
        entry["sections"].append({
            "chunk_id": str(chunk.get("chunk_id") or ""),
            "text": text,
            "role": role,
        })
        if role == "condition":
            conditions.append(text)
        refs.append({
            "chunk_id": str(chunk.get("chunk_id") or ""),
            "knowledge_version_id": version_id,
            "item_id": document["item_id"],
        })
    identity = documents[0]["identity"]
    return _package(
        status="ready",
        reason=None,
        codes=identity["codes"],
        origin=identity["origin"],
        documents=list(by_version.values()),
        conditions=conditions,
        refs=refs,
        gaps=[],
        conflicts=[],
        token_count=used,
        token_budget=token_budget,
    )
