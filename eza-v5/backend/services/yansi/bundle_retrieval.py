"""Bundle-scoped wrappers over Business RAG retrieval primitives.

V1 ``search_public_knowledge`` / authorize / sibling paths stay unchanged when
``allowed_knowledge_version_ids`` is omitted. V2 Grounded always passes the
sealed usage allowlist through every layer.
"""
from __future__ import annotations

from typing import Any, Callable, Awaitable

from backend.services.business_yansi.retrieval import (
    authorize_retrieved_sources,
    list_sibling_chunks,
    search_public_knowledge,
)
from backend.services.yansi.publication_context import GroundedPublicationContext


def scoped_search_fn(context: GroundedPublicationContext):
    """Bind publication allowlist into search (vector / lexical / hybrid / exact)."""

    async def search(db, business_id, query, **kwargs):
        if str(business_id).lower() != context.business_id:
            return {"results": [], "reason": "no_match", "errors": [], "notices": []}
        kwargs = dict(kwargs)
        kwargs["allowed_knowledge_version_ids"] = context.usage_knowledge_version_ids
        found = await search_public_knowledge(db, business_id, query, **kwargs)
        if not isinstance(found, dict):
            return {"results": [], "reason": "search_failed", "errors": ["search"], "notices": []}
        results = []
        for row in list(found.get("results") or []):
            version_id = str(row.get("knowledge_version_id") or "").lower()
            if version_id not in context.usage_knowledge_version_ids:
                continue
            if str(row.get("business_id") or "").lower() != context.business_id:
                continue
            results.append(row)
        return {
            "results": results,
            "reason": found.get("reason") if results or found.get("reason") not in {None, "no_match"} else (
                "no_match" if not results else found.get("reason")
            ),
            "errors": list(found.get("errors") or []),
            "notices": list(found.get("notices") or []),
        }

    return search


def scoped_authorize_fn(context: GroundedPublicationContext):
    """Authorize only inside the sealed usage allowlist."""

    async def authorize(db, business_id, sources, **_kwargs):
        if str(business_id).lower() != context.business_id:
            return {
                "sources": [],
                "rejected": [str(source.get("chunk_id")) for source in sources or []],
                "reason": "empty",
            }
        filtered = []
        rejected = []
        for source in sources or []:
            version_id = str(source.get("knowledge_version_id") or "").lower()
            if version_id not in context.usage_knowledge_version_ids:
                rejected.append(str(source.get("chunk_id")))
                continue
            if str(source.get("business_id") or "").lower() != context.business_id:
                rejected.append(str(source.get("chunk_id")))
                continue
            filtered.append(source)
        if not filtered:
            return {"sources": [], "rejected": rejected, "reason": "empty"}
        granted = await authorize_retrieved_sources(
            db,
            business_id,
            filtered,
            allowed_knowledge_version_ids=context.usage_knowledge_version_ids,
        )
        if not isinstance(granted, dict):
            return {"sources": [], "rejected": rejected, "reason": "authorization_failed"}
        kept = []
        for source in granted.get("sources") or []:
            version_id = str(source.get("knowledge_version_id") or "").lower()
            if version_id not in context.usage_knowledge_version_ids:
                rejected.append(str(source.get("chunk_id")))
                continue
            kept.append(source)
        out_rejected = list(granted.get("rejected") or []) + rejected
        return {
            "sources": kept,
            "rejected": out_rejected,
            "reason": granted.get("reason"),
        }

    return authorize


def scoped_sibling_loader(context: GroundedPublicationContext, db=None):
    """Sibling expansion intersected with the sealed allowlist."""

    async def load(business_id, version_ids):
        if str(business_id).lower() != context.business_id:
            return []
        allowed = [
            version_id
            for version_id in version_ids or []
            if str(version_id).lower() in context.usage_knowledge_version_ids
        ]
        if not allowed:
            return []
        if db is None:
            return []
        listed = await list_sibling_chunks(
            db,
            business_id,
            allowed,
            allowed_knowledge_version_ids=context.usage_knowledge_version_ids,
        )
        if listed.get("reason") not in {None, "empty"}:
            return []
        chunks = []
        for chunk in listed.get("chunks") or []:
            version_id = str(chunk.get("knowledge_version_id") or "").lower()
            if version_id not in context.usage_knowledge_version_ids:
                continue
            if str(chunk.get("business_id") or "").lower() != context.business_id:
                continue
            chunks.append(chunk)
        return chunks

    return load


def filter_display_sources(
    sources: list[dict[str, Any]],
    context: GroundedPublicationContext,
) -> list[dict[str, Any]]:
    """Public citation list: only viewAllowed knowledge versions, no locators."""
    display = []
    for source in sources or []:
        version_id = str(source.get("knowledge_version_id") or "").lower()
        if version_id not in context.view_knowledge_version_ids:
            continue
        display.append({
            "title": source.get("title") or "",
            "chunk_id": str(source.get("chunk_id") or ""),
            "knowledge_version_id": version_id,
            "item_id": str(source.get("item_id") or ""),
        })
    return display


def creator_text_evidence(context: GroundedPublicationContext) -> list[dict[str, Any]]:
    """Usage-allowed creator_text rows as synthetic evidence (not vector-retrieved)."""
    rows = []
    for item in context.items:
        if item.get("sourceKind") != "creator_text":
            continue
        if not item.get("usageAllowed"):
            continue
        text = item.get("text") or ""
        if not text:
            continue
        rows.append({
            "index": item["index"],
            "title": item.get("title") or "Creator note",
            "text": text,
            "viewAllowed": bool(item.get("viewAllowed")),
            "provenanceType": "creator",
            "contentDigest": item["contentDigest"],
        })
    return rows


def observation_provenance_notes(context: GroundedPublicationContext) -> list[dict[str, Any]]:
    """AI observations usable for grounding context, never as verified brand facts."""
    notes = []
    for item in context.items:
        if item.get("sourceKind") != "media_observation":
            continue
        if not item.get("usageAllowed"):
            continue
        notes.append({
            "index": item["index"],
            "provenanceType": "ai_observation",
            "analyzerProfile": item.get("analyzerProfile"),
            "contentDigest": item["contentDigest"],
            "sourceRefId": item.get("sourceRefId"),
            "observationId": item.get("observationId"),
            "viewAllowed": False,  # never expose observation body as public citation
            "verifiedBrandFact": False,
        })
    return notes


SearchFn = Callable[..., Awaitable[dict[str, Any]]]
AuthorizeFn = Callable[..., Awaitable[dict[str, Any]]]
