"""Hybrid retrieval over ready Business knowledge chunks.

Not used by the live answer path. Every candidate query keeps the same SQL
eligibility filters. A failed method is omitted; it does not widen the search.

Candidate contract, shared by this module and its tests:
- each method returns at most METHOD_CANDIDATE_LIMIT (48) rows
- at most MAX_METHODS (4) methods are fused
- fusion therefore sees at most MAX_FUSION_CANDIDATES (192) distinct rows
- a call returns at most HARD_MAX_LIMIT (20) rows
- the default return count is DEFAULT_LIMIT (8)

``BILIGN_BUSINESS_RAG_MAX_RESULTS`` is the per-call ceiling, not the candidate
pool. Unset, blank, non-integer, or values below 1 use the default ceiling of
8. Values above 20 are clamped to 20. ``limit=None`` returns min(8, ceiling).
An explicit ``limit`` returns min(ceiling, limit). The candidate pool stays 48
per method either way.

Turkish folding is one explicit map shared with SQL ``translate``. Characters
outside that map, including ``É`` and ``ß``, stay unchanged. ``casefold()`` is
not used, so there is no silent expansion such as ``ß`` to ``ss``. ``I`` folds
to ``ı`` and ``İ`` folds to ``i``.

Retrieval output is not an authorization decision. Each method is its own
read-committed statement. A revocation between statements can leave a stale
candidate in the fused list. ``authorize_retrieved_sources`` must run
immediately before any later model call and must not be cached.

``BILIGN_BUSINESS_RAG_MAX_QUERY_CHARS`` bounds the query before any provider
or SQL call. The default is 2000 characters: enough for a long user question,
and far below a 99999-character embedding request. text-embedding-3-small is
billed per input token, and a query of that size is also a large full-text
parameter. Values below 1 or non-integers use 2000. Values above 8000 are
clamped to 8000. This ceiling is separate from the eight lexical tokens.

Vector candidates are ordered by cosine distance, then chunk_id, and only
then limited to 48. An exact sort of one tenant's rows is deterministic at
that cutoff. HNSW remains approximate: if the planner uses it, those 48 rows
are nearest-neighbor candidates, not a proof of the exact top 48. The query
does not turn the index off or scan every embedding in the database.
"""
import os
import re

from sqlalchemy import bindparam, text
from sqlalchemy.exc import DBAPIError, OperationalError, ProgrammingError

from backend.core.llm.providers.openai_client import EMBEDDING_MODEL
from backend.models.business_yansi import canonical_embedding
from backend.services.business_yansi.chunking import product_codes, split_knowledge
from backend.services.business_yansi.rag import _chunk_table_missing, _digest, _uuid, enabled

DEFAULT_LIMIT = 8
HARD_MAX_LIMIT = 20
METHOD_CANDIDATE_LIMIT = 48
MAX_METHODS = 4
MAX_FUSION_CANDIDATES = METHOD_CANDIDATE_LIMIT * MAX_METHODS
MAX_QUERY_TOKENS = 8
DEFAULT_MAX_QUERY_CHARS = 2000
HARD_MAX_QUERY_CHARS = 8000
RRF_K = 60
MAX_VECTOR_DISTANCE = 0.5
METHOD_ORDER = ("vector", "fulltext", "lexical", "exact")

# 1:1 with SQL translate. Q, W, and X are included. İ/i and I/ı stay distinct.
FOLD_FROM = "ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZ"
FOLD_TO = "abcçdefgğhıijklmnoöpqrsştuüvwxyz"
if len(FOLD_FROM) != len(FOLD_TO):
    raise RuntimeError("Turkish fold map is not 1:1")
_FOLD_TABLE = str.maketrans(FOLD_FROM, FOLD_TO)

_PHRASE = re.compile(r'"([^"]{2,80})"')
_TOKEN = re.compile(r"[0-9a-zçğıöşü]{3,}")
_REGEX_META = re.compile(r"([\\.^$|?*+(){}\[\]])")
_CODE_EDGE = "[^0-9a-zçğıöşü/-]"

_FOLDED = f"translate(c.text, '{FOLD_FROM}', '{FOLD_TO}')"
_JOINS = """
FROM business_knowledge_chunks c
JOIN business_knowledge_versions k ON k.id = c.knowledge_version_id
JOIN business_profiles p ON p.id = k.business_id
JOIN production_organizations o ON o.id = k.business_id
WHERE c.business_id = :business_id
  AND k.business_id = :business_id
  AND c.item_id = k.item_id
  AND k.status = 'published'
  AND k.public_allowed IS TRUE
  AND k.approved_by IS NOT NULL
  AND p.status = 'active'
  AND o.status = 'active'
  AND c.index_status = 'ready'
"""
_COLUMNS = "c.id AS chunk_id, c.business_id, c.item_id, c.knowledge_version_id, c.text, k.title"
_FILTER = f"SELECT {_COLUMNS} {_JOINS}"

# Distance, then chunk_id, then LIMIT. The tie-break is inside the limited
# set. HNSW may still approximate which neighbors are visited; see the module note.
VECTOR_SQL = f"""
SELECT chunk_id, business_id, item_id, knowledge_version_id, text, title
FROM (
    SELECT {_COLUMNS},
           (c.embedding <=> CAST(:query_vector AS vector)) AS distance
    {_JOINS}
      AND c.embedding IS NOT NULL
      AND c.embedding_model = :embedding_model
    ORDER BY c.embedding <=> CAST(:query_vector AS vector), c.id
    LIMIT :candidate_limit
) ranked
WHERE ranked.distance <= :max_distance
ORDER BY ranked.distance, ranked.chunk_id
"""
FULLTEXT_SQL = _FILTER + """
  AND to_tsvector('simple', c.text) @@ plainto_tsquery('simple', :folded)
  ORDER BY ts_rank(to_tsvector('simple', c.text), plainto_tsquery('simple', :folded)) DESC,
           c.id
  LIMIT :candidate_limit
"""


def fold_turkish(value):
    """Apply the shared Turkish map. This is not Unicode casefold."""
    return (value or "").translate(_FOLD_TABLE)


def code_pattern(code):
    """Bounded product-code pattern. A shorter prefix is not a match."""
    literal = _REGEX_META.sub(r"\\\1", fold_turkish(code))
    return f"(^|{_CODE_EDGE}){literal}({_CODE_EDGE}|$)"


def query_tokens(value):
    tokens, _truncated = split_query_tokens(value)
    return tokens


def split_query_tokens(value):
    found = _TOKEN.findall(fold_turkish(value))
    return found[:MAX_QUERY_TOKENS], len(found) > MAX_QUERY_TOKENS


def quoted_phrases(value):
    phrases = []
    for match in _PHRASE.finditer(value or ""):
        phrase = fold_turkish(match.group(1)).strip()
        if phrase and phrase not in phrases:
            phrases.append(phrase)
    return phrases[:4]


def query_char_limit():
    """Character ceiling applied before a provider or SQL call."""
    raw = os.getenv("BILIGN_BUSINESS_RAG_MAX_QUERY_CHARS", "").strip()
    if not raw:
        return DEFAULT_MAX_QUERY_CHARS
    try:
        cap = int(raw)
    except ValueError:
        return DEFAULT_MAX_QUERY_CHARS
    if cap < 1:
        return DEFAULT_MAX_QUERY_CHARS
    return min(cap, HARD_MAX_QUERY_CHARS)


def chunk_derived_from_source(title, category, content, chunk_index, chunk_text):
    """True when the chunk is exactly one deterministic split of the current source.

    Title and category are part of the chunk header, so a change to either of
    them is a source change. The knowledge ``source`` label is not. Overlap
    and the hard size cap are the same rules ``split_knowledge`` used at index
    time. This does not embed and does not lock rows.
    """
    derived = split_knowledge(title or "", category or "", content or "")
    try:
        index = int(chunk_index)
    except (TypeError, ValueError):
        return False
    if index < 0 or index >= len(derived):
        return False
    return derived[index] == chunk_text


def result_limit(requested):
    """Ceiling from the environment, then the caller's limit. See the module contract."""
    raw = os.getenv("BILIGN_BUSINESS_RAG_MAX_RESULTS", "").strip()
    if not raw:
        cap = DEFAULT_LIMIT
    else:
        try:
            cap = int(raw)
        except ValueError:
            cap = DEFAULT_LIMIT
        if cap < 1:
            cap = DEFAULT_LIMIT
        elif cap > HARD_MAX_LIMIT:
            cap = HARD_MAX_LIMIT
    if requested is None:
        return min(DEFAULT_LIMIT, cap)
    try:
        asked = int(requested)
    except (TypeError, ValueError):
        asked = DEFAULT_LIMIT
    if asked < 1:
        asked = DEFAULT_LIMIT
    return min(cap, asked)


def fuse_ranks(rankings):
    """Reciprocal rank fusion. k=60. Equal scores break on chunk_id."""
    scores = {}
    methods = {}
    rows = {}
    for method in METHOD_ORDER:
        ranked = list(rankings.get(method) or [])[:METHOD_CANDIDATE_LIMIT]
        for rank, row in enumerate(ranked, start=1):
            key = row["chunk_id"]
            scores[key] = scores.get(key, 0.0) + 1.0 / (RRF_K + rank)
            methods.setdefault(key, [])
            if method not in methods[key]:
                methods[key].append(method)
            rows[key] = row
    ordered = sorted(scores, key=lambda key: (-scores[key], str(key)))
    return [(scores[key], methods[key], rows[key]) for key in ordered[:MAX_FUSION_CANDIDATES]]


def order_identity_matches(query, rows):
    """Product-code and quoted-phrase hits stay ahead of a semantic-only hit.

    Hybrid search still returns the other methods. The reorder does not drop
    tenant filters and does not treat a shorter code as the longer code.
    """
    rows = list(rows or [])
    if not product_codes(query) and not quoted_phrases(query):
        return rows

    def rank(row):
        methods = row.get("methods") or []
        return (0 if "exact" in methods else 1, -float(row.get("score") or 0), str(row.get("chunk_id")))

    return sorted(rows, key=rank)


def result_reason(results):
    """Empty is no_match. A list with only one weak lexical method is low_relevance."""
    if not results:
        return "no_match"
    for row in results:
        methods = set(row.get("methods") or [])
        if methods & {"vector", "exact"} or len(methods) >= 2:
            return None
    return "low_relevance"


def _empty(reason, errors=None, notices=None):
    return {"results": [], "reason": reason, "errors": list(errors or []), "notices": list(notices or [])}


def _row(mapping):
    return {
        "chunk_id": mapping["chunk_id"],
        "business_id": mapping["business_id"],
        "item_id": mapping["item_id"],
        "knowledge_version_id": mapping["knowledge_version_id"],
        "title": mapping["title"],
        "text": mapping["text"],
    }


async def _run(db, sql, params):
    result = await db.execute(text(sql), params)
    return [_row(row) for row in result.mappings()]


async def _guard(db, exc, errors):
    await db.rollback()
    if _chunk_table_missing(exc):
        return _empty("schema_missing", errors)
    return None


def _vector_inputs(query, query_vector, query_model, client_result):
    """Semantic search runs only for an explicit matching model and a 1536-d vector."""
    if query_vector is not None:
        if query_model != EMBEDDING_MODEL:
            return None, "vector_model"
        rendered = canonical_embedding(query_vector)
        if rendered is None:
            return None, "vector"
        return rendered, None
    if client_result is None:
        return None, None
    if not isinstance(client_result, dict) or not client_result.get("ok"):
        return None, "vector"
    if client_result.get("model_name") != EMBEDDING_MODEL:
        return None, "vector_model"
    vectors = client_result.get("vectors")
    rendered = canonical_embedding(vectors[0]) if vectors else None
    if rendered is None:
        return None, "vector"
    return rendered, None


async def search_public_knowledge(
    db, business_id, query, *, client=None, query_vector=None, query_model=None, limit=None,
):
    """Search one tenant. Live answer endpoints do not call this."""
    if not enabled():
        return _empty("flag_off")
    query = (query or "").strip()
    if len(query) > query_char_limit():
        return _empty("query_too_long")
    if not query and query_vector is None:
        return _empty("empty_query")
    bind = db.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return _empty("postgres_required")
    limit = result_limit(limit)
    business_id = _uuid(business_id)
    params = {"business_id": business_id, "candidate_limit": METHOD_CANDIDATE_LIMIT}
    rankings = {}
    errors = []
    notices = []
    tokens, truncated = split_query_tokens(query)
    if truncated:
        notices.append("token_limit")

    client_result = None
    if query_vector is None and client is not None and query:
        try:
            client_result = await client.embed_texts([query])
        except Exception:
            client_result = {"ok": False}
    vector_text, vector_error = _vector_inputs(query, query_vector, query_model, client_result)
    if vector_error:
        errors.append(vector_error)
    if vector_text is not None:
        try:
            rankings["vector"] = await _run(db, VECTOR_SQL, {
                **params,
                "query_vector": vector_text,
                "embedding_model": EMBEDDING_MODEL,
                "max_distance": MAX_VECTOR_DISTANCE,
            })
        except (ProgrammingError, OperationalError, DBAPIError) as exc:
            empty = await _guard(db, exc, errors)
            if empty is not None:
                empty["notices"] = notices
                return empty
            errors.append("vector")

    folded = fold_turkish(query)
    if folded:
        try:
            rankings["fulltext"] = await _run(db, FULLTEXT_SQL, {**params, "folded": folded})
        except (ProgrammingError, OperationalError, DBAPIError) as exc:
            empty = await _guard(db, exc, errors)
            if empty is not None:
                empty["notices"] = notices
                return empty
            errors.append("fulltext")

    if tokens:
        token_sql = " AND ".join(
            f"strpos({_FOLDED}, :token_{index}) > 0" for index in range(len(tokens))
        )
        token_params = {f"token_{index}": token for index, token in enumerate(tokens)}
        try:
            rankings["lexical"] = await _run(
                db,
                _FILTER + f" AND {token_sql} ORDER BY c.id LIMIT :candidate_limit",
                {**params, **token_params},
            )
        except (ProgrammingError, OperationalError, DBAPIError) as exc:
            empty = await _guard(db, exc, errors)
            if empty is not None:
                empty["notices"] = notices
                return empty
            errors.append("lexical")

    clauses = []
    needle_params = {}
    for index, code in enumerate(product_codes(query)[:MAX_QUERY_TOKENS]):
        clauses.append(f"({_FOLDED} ~ :code_{index})")
        needle_params[f"code_{index}"] = code_pattern(code)
    for index, phrase in enumerate(quoted_phrases(query)):
        clauses.append(f"strpos({_FOLDED}, :phrase_{index}) > 0")
        needle_params[f"phrase_{index}"] = phrase
    if clauses:
        try:
            rankings["exact"] = await _run(
                db,
                _FILTER + f" AND ({' OR '.join(clauses)}) ORDER BY c.id LIMIT :candidate_limit",
                {**params, **needle_params},
            )
        except (ProgrammingError, OperationalError, DBAPIError) as exc:
            empty = await _guard(db, exc, errors)
            if empty is not None:
                empty["notices"] = notices
                return empty
            errors.append("exact")

    fused = []
    seen = set()
    for score, methods, row in fuse_ranks(rankings):
        if row["chunk_id"] in seen:
            continue
        seen.add(row["chunk_id"])
        fused.append({
            "business_id": str(row["business_id"]),
            "item_id": str(row["item_id"]),
            "knowledge_version_id": str(row["knowledge_version_id"]),
            "chunk_id": str(row["chunk_id"]),
            "title": row["title"],
            "text": row["text"],
            "method": methods[0],
            "methods": methods,
            "score": round(score, 6),
        })
    fused = order_identity_matches(query, fused)[:limit]
    if not fused and errors and not rankings:
        return _empty("search_failed", errors, notices)
    return {"results": fused, "reason": result_reason(fused), "errors": errors, "notices": notices}


AUTHORIZATION_CONTRACT = (
    "revalidate_every_request",
    "immediately_before_model",
    "no_long_lived_snapshot",
    "close_transaction_before_provider",
    "do_not_reuse_prior_grant",
    "failed_authorization_sends_nothing",
)


def sources_for_model(authorization):
    """Return sources only from the authorization that just succeeded.

    Stage 2C must call ``authorize_retrieved_sources`` on every user request,
    immediately before the model, then close the database transaction before
    any provider call. A previous request's grant is not reusable. A failure,
    including ``query_too_long`` or a rejected row, sends nothing from that
    grant. A permission change that commits after this function's SELECT is
    outside the snapshot and is caught only by the next request.
    Live answer endpoints do not call this.
    """
    if not isinstance(authorization, dict) or authorization.get("reason") is not None:
        return []
    return list(authorization.get("sources") or [])


async def authorize_retrieved_sources(db, business_id, sources):
    """Re-read eligibility immediately before a model would see these sources.

    Retrieval is not an authorization decision. This issues one SELECT and
    returns. It does not take row locks, call a provider, or keep a snapshot
    open. The decision is valid only for the rows just read. A revocation
    that commits after this return is outside the snapshot. The caller must
    finish the database transaction before any provider call and must not
    reuse the result on a later request.

    Permission, publication, and tenant checks are the SQL filters. Separately,
    the chunk must still be the deterministic split of the current title,
    category, and content at its chunk index. A same-version content or title
    change therefore rejects the old chunk. A label stored only in the
    knowledge ``source`` column does not. The chunk hash must still match the
    stored chunk text, and that text must be what would be sent. A failed
    check rejects that source. This path does not embed.
    """
    rejected = []
    if not enabled():
        return {"sources": [], "rejected": rejected, "reason": "flag_off"}
    if not sources:
        return {"sources": [], "rejected": rejected, "reason": "empty"}
    bind = db.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return {"sources": [], "rejected": [str(source.get("chunk_id")) for source in sources], "reason": "postgres_required"}
    business_id = _uuid(business_id)
    requested = []
    for source in sources:
        try:
            requested.append((_uuid(source.get("chunk_id")), source.get("text")))
        except (TypeError, ValueError):
            rejected.append(str(source.get("chunk_id")))
    if not requested:
        return {"sources": [], "rejected": rejected, "reason": "empty"}
    statement = text(
        f"SELECT {_COLUMNS}, c.content_hash, c.chunk_index, k.category AS category, "
        f"k.content AS source_content {_JOINS} AND c.id IN :chunk_ids"
    ).bindparams(bindparam("chunk_ids", expanding=True))
    try:
        result = await db.execute(statement, {
            "business_id": business_id,
            "chunk_ids": [chunk_id for chunk_id, _text in requested],
        })
    except (ProgrammingError, OperationalError, DBAPIError) as exc:
        await db.rollback()
        reason = "schema_missing" if _chunk_table_missing(exc) else "authorization_failed"
        rejected.extend(str(chunk_id) for chunk_id, _text in requested)
        return {"sources": [], "rejected": rejected, "reason": reason}
    found = {row["chunk_id"]: row for row in result.mappings()}
    kept = []
    derived = {}
    for chunk_id, sent_text in requested:
        row = found.get(chunk_id)
        if row is None or sent_text != row["text"] or _digest(row["text"]) != row["content_hash"]:
            rejected.append(str(chunk_id))
            continue
        if row["business_id"] != business_id:
            rejected.append(str(chunk_id))
            continue
        version_id = row["knowledge_version_id"]
        if version_id not in derived:
            derived[version_id] = split_knowledge(
                row["title"] or "", row["category"] or "", row["source_content"] or "",
            )
        parts = derived[version_id]
        try:
            index = int(row["chunk_index"])
        except (TypeError, ValueError):
            index = -1
        if index < 0 or index >= len(parts) or parts[index] != row["text"]:
            rejected.append(str(chunk_id))
            continue
        kept.append({
            "business_id": str(row["business_id"]),
            "item_id": str(row["item_id"]),
            "knowledge_version_id": str(row["knowledge_version_id"]),
            "chunk_id": str(row["chunk_id"]),
            "title": row["title"],
            "text": row["text"],
        })
    return {"sources": kept, "rejected": rejected, "reason": None}


async def list_sibling_chunks(db, business_id, version_ids):
    """List ready chunks of the given knowledge versions for one tenant.

    Uses the same publication and tenant filters as retrieval. The result is
    not authorization: the caller must pass it through
    ``authorize_retrieved_sources`` before a package can include it. This does
    not embed and does not read a version number as a priority.
    """
    if not enabled():
        return {"chunks": [], "reason": "flag_off"}
    if not version_ids:
        return {"chunks": [], "reason": "empty"}
    bind = db.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return {"chunks": [], "reason": "postgres_required"}
    ids = []
    for value in version_ids:
        try:
            ids.append(_uuid(value))
        except (TypeError, ValueError):
            continue
    if not ids:
        return {"chunks": [], "reason": "empty"}
    statement = text(
        f"SELECT {_COLUMNS}, c.chunk_index {_JOINS} AND k.id IN :version_ids "
        "ORDER BY c.chunk_index, c.id"
    ).bindparams(bindparam("version_ids", expanding=True))
    try:
        result = await db.execute(statement, {"business_id": _uuid(business_id), "version_ids": ids})
    except (ProgrammingError, OperationalError, DBAPIError) as exc:
        await db.rollback()
        reason = "schema_missing" if _chunk_table_missing(exc) else "sibling_failed"
        return {"chunks": [], "reason": reason}
    chunks = []
    for row in result.mappings():
        chunks.append({
            "business_id": str(row["business_id"]),
            "item_id": str(row["item_id"]),
            "knowledge_version_id": str(row["knowledge_version_id"]),
            "chunk_id": str(row["chunk_id"]),
            "chunk_index": row["chunk_index"],
            "title": row["title"],
            "text": row["text"],
        })
    return {"chunks": chunks, "reason": None}
