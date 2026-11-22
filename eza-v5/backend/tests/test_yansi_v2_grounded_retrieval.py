"""Yansı V2 Stage 2B — publication-scoped retrieval and answer safety."""
from __future__ import annotations

import copy
import json
import os
import uuid
from pathlib import Path

import pytest

from backend.services.business_yansi.business_rag_orchestrator import run_business_rag
from backend.services.business_yansi.retrieval import (
    _normalize_version_allowlist,
    _sql_for_allowlist,
    search_public_knowledge,
)
from backend.services.mirror_network import yansi_v2_contract as pub
from backend.services.yansi import knowledge_bundle as kb
from backend.services.yansi.bundle_retrieval import (
    filter_display_sources,
    observation_provenance_notes,
    scoped_authorize_fn,
    scoped_search_fn,
    scoped_sibling_loader,
)
from backend.services.yansi.grounded_v2 import (
    refuse_open_publication_grounded_path,
    run_yansi_v2_grounded_answer,
)
from backend.services.yansi.publication_context import (
    PublicationContextError,
    resolve_grounded_publication_context,
)

FIXTURES = json.loads(
    Path(__file__).resolve().parents[2].joinpath("fixtures/yansi_v2_publication_fixtures.json").read_text(
        encoding="utf-8"
    )
)

BIZ = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
OTHER_BIZ = "dddddddd-dddd-dddd-dddd-dddddddddddd"
OWNER = "cccccccc-cccc-cccc-cccc-cccccccccccc"
NODE = FIXTURES["nodeId"]
BUNDLE = "11111111-1111-1111-1111-111111111111"
BUNDLE_VER = "12121212-1212-1212-1212-121212121212"
KV_A = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
KV_B = "efefefef-efef-efef-efef-efefefefefef"
KV_OTHER = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0"
ASSET = "22222222-2222-2222-2222-222222222222"
OBS = "ffffffff-ffff-ffff-ffff-ffffffffffff"


class DB:
    async def rollback(self):
        return None


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ANSWERS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ENABLED", "true")


def _content_a():
    return "WX-100 için garanti 2 yıldır. Koşullar: fatura gerekir."


def _content_b():
    return "WX-200 için garanti 3 yıldır."


def _live_sources(*, content_a=None, content_b=None, asset_revision=2, obs_digest=None, kv_a_public=False):
    return {
        "knowledge_versions": {
            KV_A: {
                "business_id": BIZ,
                "content": content_a if content_a is not None else _content_a(),
                "version": 1,
                "title": "WX-100",
                "public_allowed": kv_a_public,
            },
            KV_B: {
                "business_id": BIZ,
                "content": content_b if content_b is not None else _content_b(),
                "version": 1,
                "title": "WX-200",
                "public_allowed": True,
            },
            KV_OTHER: {
                "business_id": OTHER_BIZ,
                "content": "Foreign tenant secret",
                "version": 1,
                "title": "Secret",
                "public_allowed": True,
            },
        },
        "assets": {
            ASSET: {
                "business_id": BIZ,
                "asset_type": "image",
                "revision": asset_revision,
                "locator_kind": "storage",
                "locator": f"business/{BIZ}/image/{ASSET}.png",
                "public_allowed": True,
                "title": "Kiln",
            }
        },
        "observations": {
            OBS: {
                "business_id": BIZ,
                "asset_id": ASSET,
                "content_sha256": obs_digest or ("a" * 64),
                "analyzer_profile": "vision-v1",
                "status": "ready",
            }
        },
    }


def _items_for_yansi_a(*, include_obs=True, usage_b=False, view_a=False):
    sources = _live_sources(kv_a_public=view_a)
    items = [
        {
            "index": 0,
            "sourceKind": "creator_text",
            "provenanceType": "creator",
            "contentDigest": kb.compute_creator_text_digest("Creator kiln note."),
            "usageAllowed": True,
            "viewAllowed": True,
            "text": "Creator kiln note.",
            "title": "Note",
        },
        {
            "index": 1,
            "sourceKind": "knowledge_version",
            "provenanceType": "business_knowledge",
            "sourceRefId": KV_A,
            "knowledgeVersion": 1,
            "contentDigest": kb.compute_knowledge_digest(sources["knowledge_versions"][KV_A]["content"]),
            "usageAllowed": True,
            "viewAllowed": view_a,
            "title": "WX-100",
        },
    ]
    if usage_b:
        items.append({
            "index": 2,
            "sourceKind": "knowledge_version",
            "provenanceType": "business_knowledge",
            "sourceRefId": KV_B,
            "knowledgeVersion": 1,
            "contentDigest": kb.compute_knowledge_digest(sources["knowledge_versions"][KV_B]["content"]),
            "usageAllowed": True,
            "viewAllowed": True,
            "title": "WX-200",
        })
    asset = sources["assets"][ASSET]
    items.append({
        "index": len(items),
        "sourceKind": "image_asset",
        "provenanceType": "brand_asset",
        "sourceRefId": ASSET,
        "contentDigest": kb.compute_asset_digest(
            asset_id=ASSET,
            revision=asset["revision"],
            asset_type=asset["asset_type"],
            locator_kind=asset["locator_kind"],
            locator=asset["locator"],
        ),
        "usageAllowed": True,
        "viewAllowed": True,
        "title": "Kiln",
    })
    if include_obs:
        items.append({
            "index": len(items),
            "sourceKind": "media_observation",
            "provenanceType": "ai_observation",
            "sourceRefId": ASSET,
            "observationId": OBS,
            "analyzerProfile": "vision-v1",
            "contentDigest": "a" * 64,
            "usageAllowed": True,
            "viewAllowed": False,
        })
    return items


def _seal(items):
    items = kb.validate_items_manifest(items)
    bundle_hash = kb.compute_bundle_hash(items)
    return items, bundle_hash


def _conversation_manifest():
    return copy.deepcopy(FIXTURES["validConversationManifest"])


def _publication(*, policy="grounded", version=1, bundle_version_id=BUNDLE_VER, contract_tamper=False):
    raw_manifest = _conversation_manifest()
    manifest_hash = pub.compute_manifest_hash(raw_manifest)
    ref = bundle_version_id if policy == "grounded" else None
    contract_hash = pub.compute_contract_hash(
        node_id=NODE,
        publication_version=version,
        response_policy=policy,
        content_kind="conversation",
        manifest_hash=manifest_hash,
        knowledge_bundle_version_ref=ref,
    )
    if contract_tamper:
        contract_hash = "0" * 64
    return {
        "id": str(uuid.uuid4()),
        "node_id": NODE,
        "publication_version": version,
        "contract_version": "yansi-publication-v2",
        "response_policy": policy,
        "content_kind": "conversation",
        "content_manifest": raw_manifest,
        "manifest_hash": manifest_hash,
        "contract_hash": contract_hash,
        "knowledge_bundle_version_ref": ref,
        "knowledge_bundle_version_id": bundle_version_id if policy == "grounded" else None,
    }


def _rows(items, bundle_hash, *, status="sealed", bundle_version_id=BUNDLE_VER, version=1, policy="grounded"):
    publication = _publication(
        policy=policy,
        version=version,
        bundle_version_id=bundle_version_id,
    )
    node = {"id": NODE, "user_id": OWNER}
    bundle = {
        "id": BUNDLE,
        "business_id": BIZ,
        "owner_user_id": OWNER,
        "access_scope": "publication_bound",
    }
    bundle_version = {
        "id": bundle_version_id,
        "bundle_id": BUNDLE,
        "version": version,
        "status": status,
        "items_manifest": items,
        "bundle_hash": bundle_hash,
        "created_by": OWNER,
    }
    return publication, node, bundle, bundle_version


# --- Allowlist SQL helpers (V1 unchanged when None) ---


def test_allowlist_none_keeps_v1_joins():
    filtr, vector, fulltext, extra = _sql_for_allowlist(None)
    assert "allowed_version_ids" not in filtr
    assert extra == {}
    assert "business_knowledge_chunks" in vector


def test_allowlist_empty_normalizes():
    assert _normalize_version_allowlist([]) == frozenset()
    assert _normalize_version_allowlist(None) is None
    ids = _normalize_version_allowlist([KV_A, "not-a-uuid", KV_A])
    assert ids == frozenset({uuid.UUID(KV_A)})


def test_allowlist_sql_injects_in_clause():
    allow = frozenset({uuid.UUID(KV_A)})
    filtr, vector, fulltext, extra = _sql_for_allowlist(allow)
    assert "k.id IN :allowed_version_ids" in filtr
    assert "k.id IN :allowed_version_ids" in vector
    assert "k.id IN :allowed_version_ids" in fulltext
    assert extra["allowed_version_ids"] == [uuid.UUID(KV_A)]


@pytest.mark.asyncio
async def test_empty_allowlist_short_circuits_search(enabled):
    class FakeBind:
        dialect = type("D", (), {"name": "postgresql"})()

    class FakeDB:
        def get_bind(self):
            return FakeBind()

        async def execute(self, *args, **kwargs):
            raise AssertionError("empty allowlist must not query")

        async def rollback(self):
            return None

    found = await search_public_knowledge(
        FakeDB(), BIZ, "garanti", allowed_knowledge_version_ids=[],
    )
    assert found["reason"] == "no_match"
    assert found["results"] == []


# --- Publication context ---


def test_resolve_grounded_context_ok():
    items, bundle_hash = _seal(_items_for_yansi_a(view_a=False))
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=_live_sources(),
        expected_contract_hash=publication["contract_hash"],
        expected_bundle_hash=bundle_hash,
        expected_business_id=BIZ,
        expected_owner_user_id=OWNER,
    )
    assert KV_A in ctx.usage_knowledge_version_ids
    assert KV_A not in ctx.view_knowledge_version_ids
    assert ctx.bundle_hash == bundle_hash
    assert ctx.response_policy == "grounded"


def test_open_policy_rejected():
    items, bundle_hash = _seal(_items_for_yansi_a())
    publication, node, bundle, bundle_version = _rows(items, bundle_hash, policy="open")
    with pytest.raises(PublicationContextError) as raised:
        resolve_grounded_publication_context(
            publication_row=publication,
            node_row=node,
            bundle_row=bundle,
            bundle_version_row=bundle_version,
            live_sources=_live_sources(),
        )
    assert raised.value.code == "open_not_grounded"
    assert refuse_open_publication_grounded_path("open")["status"] == "open_not_grounded"


def test_unsealed_bundle_fail_closed():
    items, bundle_hash = _seal(_items_for_yansi_a())
    publication, node, bundle, bundle_version = _rows(items, bundle_hash, status="draft")
    with pytest.raises(PublicationContextError) as raised:
        resolve_grounded_publication_context(
            publication_row=publication,
            node_row=node,
            bundle_row=bundle,
            bundle_version_row=bundle_version,
            live_sources=_live_sources(),
        )
    assert raised.value.code == "bundle_not_sealed"


def test_contract_hash_mismatch_fail_closed():
    items, bundle_hash = _seal(_items_for_yansi_a())
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    with pytest.raises(PublicationContextError) as raised:
        resolve_grounded_publication_context(
            publication_row=publication,
            node_row=node,
            bundle_row=bundle,
            bundle_version_row=bundle_version,
            live_sources=_live_sources(),
            expected_contract_hash="f" * 64,
        )
    assert raised.value.code == "contract_hash_mismatch"


def test_digest_mismatch_drops_source():
    items, bundle_hash = _seal(_items_for_yansi_a())
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    live = _live_sources(content_a="TAMPERED CONTENT")
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=live,
    )
    assert KV_A not in ctx.usage_knowledge_version_ids
    assert any("bundle_digest_mismatch" in row for row in ctx.dropped_digest_mismatches)


def test_asset_id_alone_not_enough_revision_mismatch():
    items, bundle_hash = _seal(_items_for_yansi_a())
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    live = _live_sources(asset_revision=99)
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=live,
    )
    assert any("image_asset" in row and "digest" in row for row in ctx.dropped_digest_mismatches)


def test_revoked_usage_excluded_from_allowlist():
    items = _items_for_yansi_a()
    for item in items:
        if item["sourceKind"] == "knowledge_version" and item["sourceRefId"] == KV_A:
            item["usageAllowed"] = False
    items, bundle_hash = _seal(items)
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=_live_sources(),
    )
    assert KV_A not in ctx.usage_knowledge_version_ids


def test_foreign_tenant_knowledge_dropped():
    items = _items_for_yansi_a()
    # Inject foreign KV into sealed items (should be rejected at live revalidation).
    items.append({
        "index": len(items),
        "sourceKind": "knowledge_version",
        "provenanceType": "business_knowledge",
        "sourceRefId": KV_OTHER,
        "knowledgeVersion": 1,
        "contentDigest": kb.compute_knowledge_digest("Foreign tenant secret"),
        "usageAllowed": True,
        "viewAllowed": True,
        "title": "Secret",
    })
    items, bundle_hash = _seal(items)
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    # Bundle tenant is BIZ; live foreign row has OTHER_BIZ.
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=_live_sources(),
    )
    assert KV_OTHER not in ctx.usage_knowledge_version_ids


# --- Bundle-scoped retrieval layers ---


@pytest.mark.asyncio
async def test_scoped_search_filters_out_of_bundle(enabled):
    items, bundle_hash = _seal(_items_for_yansi_a())
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=_live_sources(),
    )
    out_of_bundle = {
        "business_id": BIZ,
        "item_id": str(uuid.uuid4()),
        "knowledge_version_id": KV_B,
        "chunk_id": str(uuid.uuid4()),
        "title": "WX-200",
        "text": _content_b(),
    }
    in_bundle = {
        "business_id": BIZ,
        "item_id": str(uuid.uuid4()),
        "knowledge_version_id": KV_A,
        "chunk_id": str(uuid.uuid4()),
        "title": "WX-100",
        "text": _content_a(),
    }

    async def fake_search(db, business_id, query, **kwargs):
        assert kwargs.get("allowed_knowledge_version_ids") == ctx.usage_knowledge_version_ids
        return {"results": [out_of_bundle, in_bundle], "reason": None, "errors": [], "notices": []}

    # Patch module search used by scoped wrapper.
    import backend.services.yansi.bundle_retrieval as br

    monkey_search = fake_search
    original = br.search_public_knowledge
    br.search_public_knowledge = monkey_search
    try:
        found = await scoped_search_fn(ctx)(DB(), BIZ, "garanti")
    finally:
        br.search_public_knowledge = original
    ids = {row["knowledge_version_id"] for row in found["results"]}
    assert KV_A in ids
    assert KV_B not in ids


@pytest.mark.asyncio
async def test_scoped_authorize_rejects_out_of_bundle(enabled):
    items, bundle_hash = _seal(_items_for_yansi_a())
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=_live_sources(),
    )
    foreign = {
        "business_id": BIZ,
        "item_id": str(uuid.uuid4()),
        "knowledge_version_id": KV_B,
        "chunk_id": str(uuid.uuid4()),
        "text": _content_b(),
        "title": "WX-200",
    }
    result = await scoped_authorize_fn(ctx)(DB(), BIZ, [foreign])
    assert result["sources"] == []
    assert str(foreign["chunk_id"]) in result["rejected"]


@pytest.mark.asyncio
async def test_scoped_sibling_intersects_allowlist(enabled):
    items, bundle_hash = _seal(_items_for_yansi_a())
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=_live_sources(),
    )
    loaded = await scoped_sibling_loader(ctx, db=None)(BIZ, [KV_A, KV_B])
    assert loaded == []  # no db → empty, and KV_B would be excluded anyway

    calls = {}

    async def fake_list(db, business_id, version_ids, **kwargs):
        calls["version_ids"] = list(version_ids)
        calls["allow"] = kwargs.get("allowed_knowledge_version_ids")
        return {
            "chunks": [
                {
                    "business_id": BIZ,
                    "knowledge_version_id": KV_A,
                    "chunk_id": str(uuid.uuid4()),
                    "item_id": str(uuid.uuid4()),
                    "title": "WX-100",
                    "text": _content_a(),
                    "chunk_index": 0,
                },
                {
                    "business_id": BIZ,
                    "knowledge_version_id": KV_B,
                    "chunk_id": str(uuid.uuid4()),
                    "item_id": str(uuid.uuid4()),
                    "title": "WX-200",
                    "text": _content_b(),
                    "chunk_index": 0,
                },
            ],
            "reason": None,
        }

    import backend.services.yansi.bundle_retrieval as br

    original = br.list_sibling_chunks
    br.list_sibling_chunks = fake_list
    try:
        chunks = await scoped_sibling_loader(ctx, db=DB())(BIZ, [KV_A, KV_B, KV_OTHER])
    finally:
        br.list_sibling_chunks = original
    assert calls["allow"] == ctx.usage_knowledge_version_ids
    assert all(c["knowledge_version_id"] == KV_A for c in chunks)


def test_display_sources_require_view_allowed():
    items, bundle_hash = _seal(_items_for_yansi_a(view_a=False))
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=_live_sources(),
    )
    sources = [{
        "title": "WX-100",
        "chunk_id": str(uuid.uuid4()),
        "knowledge_version_id": KV_A,
        "item_id": str(uuid.uuid4()),
        "text": "secret private body",
    }]
    display = filter_display_sources(sources, ctx)
    assert display == []


# --- Same business, different Yansı packages ---


@pytest.mark.asyncio
async def test_same_business_different_yansi_packages(enabled):
    items_a, hash_a = _seal(_items_for_yansi_a(usage_b=False))
    items_b = [
        {
            "index": 0,
            "sourceKind": "knowledge_version",
            "provenanceType": "business_knowledge",
            "sourceRefId": KV_B,
            "knowledgeVersion": 1,
            "contentDigest": kb.compute_knowledge_digest(_content_b()),
            "usageAllowed": True,
            "viewAllowed": True,
            "title": "WX-200",
        }
    ]
    items_b, hash_b = _seal(items_b)
    pub_a, node, bundle, ver_a = _rows(items_a, hash_a)
    ver_b_id = "13131313-1313-1313-1313-131313131313"
    pub_b, _node_b, _bundle_b, ver_b = _rows(
        items_b, hash_b, bundle_version_id=ver_b_id, version=2,
    )
    ctx_a = resolve_grounded_publication_context(
        publication_row=pub_a, node_row=node, bundle_row=bundle,
        bundle_version_row=ver_a, live_sources=_live_sources(),
    )
    ctx_b = resolve_grounded_publication_context(
        publication_row=pub_b, node_row=node, bundle_row=bundle,
        bundle_version_row=ver_b, live_sources=_live_sources(),
    )
    assert KV_A in ctx_a.usage_knowledge_version_ids
    assert KV_B not in ctx_a.usage_knowledge_version_ids
    assert KV_B in ctx_b.usage_knowledge_version_ids
    assert KV_A not in ctx_b.usage_knowledge_version_ids

    chunk_a = {
        "business_id": BIZ,
        "item_id": str(uuid.uuid4()),
        "knowledge_version_id": KV_A,
        "chunk_id": str(uuid.uuid4()),
        "title": "WX-100",
        "text": _content_a(),
        "chunk_index": 0,
    }
    chunk_b = {
        "business_id": BIZ,
        "item_id": str(uuid.uuid4()),
        "knowledge_version_id": KV_B,
        "chunk_id": str(uuid.uuid4()),
        "title": "WX-200",
        "text": _content_b(),
        "chunk_index": 0,
    }

    async def search_all(db, business_id, query, **kwargs):
        allow = kwargs.get("allowed_knowledge_version_ids") or set()
        rows = [chunk_a, chunk_b]
        return {
            "results": [r for r in rows if uuid.UUID(r["knowledge_version_id"]) in allow or str(r["knowledge_version_id"]) in {str(x) for x in allow}],
            "reason": None,
            "errors": [],
            "notices": [],
        }

    async def authorize(db, business_id, sources, **kwargs):
        return {"sources": list(sources), "rejected": [], "reason": None}

    async def empty_siblings(business_id, version_ids):
        return []

    async def embedder(text, *, timeout):
        from backend.core.llm.providers.openai_client import EMBEDDING_MODEL
        return {"ok": True, "vectors": [[0.01] * 1536], "model_name": EMBEDDING_MODEL, "usage": {"prompt_tokens": 3}}

    async def provider(prompt, *, timeout, max_tokens):
        # Answer engine should only see WX-100 package for ctx_a
        assert "WX-200" not in prompt or "garanti 3" not in prompt
        refs = [{
            "chunk_id": chunk_a["chunk_id"],
            "knowledge_version_id": KV_A,
            "item_id": chunk_a["item_id"],
        }]
        return {
            "ok": True,
            "output": json.dumps({"answer": "WX-100 garantisi 2 yıldır.", "source_refs": refs}, ensure_ascii=False),
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        }

    import backend.services.yansi.bundle_retrieval as br
    original = br.search_public_knowledge
    br.search_public_knowledge = search_all
    try:
        result = await run_yansi_v2_grounded_answer(
            DB(),
            context=ctx_a,
            question="WX-100 garantisi kaç yıl?",
            search_fn=scoped_search_fn(ctx_a),
            authorize_fn=authorize,
            sibling_loader=empty_siblings,
            embedder=embedder,
            provider=provider,
            lexical_only=True,
        )
    finally:
        br.search_public_knowledge = original
    assert result["status"] == "answered"
    assert result["yansi_v2_grounded"] is True
    assert all(s.get("knowledge_version_id") != KV_B for s in result["sources"])


@pytest.mark.asyncio
async def test_ai_observation_not_verified_fact(enabled):
    items, bundle_hash = _seal(_items_for_yansi_a(include_obs=True))
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=_live_sources(),
    )
    assert ctx.observation_item_indexes
    notes = observation_provenance_notes(ctx)
    assert notes
    assert all(n["verifiedBrandFact"] is False for n in notes)
    assert all(n["viewAllowed"] is False for n in notes)


@pytest.mark.asyncio
async def test_insufficient_sources_no_general_fallback(enabled):
    items, bundle_hash = _seal(_items_for_yansi_a())
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=_live_sources(),
    )

    async def search_empty(db, business_id, query, **kwargs):
        return {"results": [], "reason": "no_match", "errors": [], "notices": []}

    async def authorize(db, business_id, sources, **kwargs):
        return {"sources": [], "rejected": [], "reason": None}

    async def empty_siblings(business_id, version_ids):
        return []

    # Knowledge-only sealed package; empty search → insufficiency (no general fallback).
    items2 = []
    for index, item in enumerate(item for item in items if item["sourceKind"] == "knowledge_version"):
        row = dict(item)
        row["index"] = index
        items2.append(row)
    items2, hash2 = _seal(items2)
    pub2, node2, bundle2, ver2 = _rows(items2, hash2)
    ctx2 = resolve_grounded_publication_context(
        publication_row=pub2, node_row=node2, bundle_row=bundle2,
        bundle_version_row=ver2, live_sources=_live_sources(),
    )
    result = await run_yansi_v2_grounded_answer(
        DB(),
        context=ctx2,
        question="Stok var mı?",
        search_fn=search_empty,
        authorize_fn=authorize,
        sibling_loader=empty_siblings,
        lexical_only=True,
        provider=None,
    )
    assert result["status"] == "no_information"
    assert "paylaşılmış bilgilerinde" in result["answer"]


@pytest.mark.asyncio
async def test_hidden_source_not_in_display(enabled):
    items, bundle_hash = _seal(_items_for_yansi_a(view_a=False))
    publication, node, bundle, bundle_version = _rows(items, bundle_hash)
    ctx = resolve_grounded_publication_context(
        publication_row=publication,
        node_row=node,
        bundle_row=bundle,
        bundle_version_row=bundle_version,
        live_sources=_live_sources(),
    )
    chunk = {
        "business_id": BIZ,
        "item_id": str(uuid.uuid4()),
        "knowledge_version_id": KV_A,
        "chunk_id": str(uuid.uuid4()),
        "title": "WX-100",
        "text": _content_a(),
        "chunk_index": 0,
    }

    async def search(db, business_id, query, **kwargs):
        return {"results": [chunk], "reason": None, "errors": [], "notices": []}

    async def authorize(db, business_id, sources, **kwargs):
        return {"sources": list(sources), "rejected": [], "reason": None}

    async def empty_siblings(business_id, version_ids):
        return []

    async def provider(prompt, *, timeout, max_tokens):
        # Ensure private locator strings are not injected into package display path
        assert "storageKey" not in prompt
        assert f"business/{BIZ}/image" not in prompt
        refs = [{
            "chunk_id": chunk["chunk_id"],
            "knowledge_version_id": KV_A,
            "item_id": chunk["item_id"],
        }]
        return {
            "ok": True,
            "output": json.dumps({"answer": "Garanti 2 yıldır.", "source_refs": refs}, ensure_ascii=False),
            "usage": {"prompt_tokens": 8, "completion_tokens": 4},
        }

    result = await run_yansi_v2_grounded_answer(
        DB(),
        context=ctx,
        question="WX-100 garantisi?",
        search_fn=search,
        authorize_fn=authorize,
        sibling_loader=empty_siblings,
        lexical_only=True,
        provider=provider,
    )
    assert result["status"] == "answered"
    assert result["display_sources"] == []
    assert "locator" not in json.dumps(result)


# --- V1 regression ---


@pytest.mark.asyncio
async def test_v1_run_business_rag_unchanged_without_allowlist(enabled):
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
        assert "allowed_knowledge_version_ids" not in kwargs or kwargs.get("allowed_knowledge_version_ids") is None
        return {"results": [chunk], "reason": None, "errors": [], "notices": []}

    async def authorize(db, business_id, sources, **kwargs):
        return {"sources": list(sources), "rejected": [], "reason": None}

    async def empty_siblings(business_id, version_ids):
        return []

    async def embedder(text, *, timeout):
        from backend.core.llm.providers.openai_client import EMBEDDING_MODEL
        return {"ok": True, "vectors": [[0.02] * 1536], "model_name": EMBEDDING_MODEL, "usage": {"prompt_tokens": 4}}

    async def provider(prompt, *, timeout, max_tokens):
        refs = [{
            "chunk_id": chunk["chunk_id"],
            "knowledge_version_id": chunk["knowledge_version_id"],
            "item_id": chunk["item_id"],
        }]
        return {
            "ok": True,
            "output": json.dumps({"answer": "Garanti iki yıl.", "source_refs": refs}, ensure_ascii=False),
            "usage": {"prompt_tokens": 10, "completion_tokens": 4},
        }

    found = await run_business_rag(
        DB(),
        BIZ,
        "WX-100 garantisi kaç yıl?",
        search_fn=search,
        authorize_fn=authorize,
        sibling_loader=empty_siblings,
        embedder=embedder,
        provider=provider,
        lexical_only=True,
    )
    assert found["status"] == "answered"
    assert found.get("yansi_v2_grounded") is None


# --- Optional isolated PostgreSQL ---


def _pg_url():
    raw = (
        os.getenv("BILIGN_YANSI_V2_PG_TEST_URL")
        or os.getenv("BILIGN_COVER_RETARGET_TEST_URL")
        or ""
    ).strip()
    if not raw:
        return None
    if raw.startswith("postgresql://"):
        raw = "postgresql+asyncpg://" + raw[len("postgresql://"):]
    if not raw.startswith("postgresql+asyncpg://"):
        return None
    return raw


@pytest.mark.asyncio
async def test_postgres_allowlist_query_when_available(enabled):
    url = _pg_url()
    if url is None:
        pytest.skip("BLOCKED: disposable PostgreSQL URL not set (BILIGN_YANSI_V2_PG_TEST_URL)")

    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text as sql_text

    engine = create_async_engine(url, pool_pre_ping=True)
    try:
        async with engine.connect() as conn:
            dialect = conn.engine.dialect.name
            assert dialect == "postgresql"
            # Prove expanding allowlist bind works against real Postgres.
            allow = [uuid.UUID(KV_A), uuid.UUID(KV_B)]
            statement = sql_text(
                "SELECT x FROM (VALUES (CAST(:a AS uuid)), (CAST(:b AS uuid))) AS t(x) "
                "WHERE x IN :allowed_version_ids"
            ).bindparams(
                __import__("sqlalchemy", fromlist=["bindparam"]).bindparam(
                    "allowed_version_ids", expanding=True
                )
            )
            result = await conn.execute(
                statement,
                {"a": allow[0], "b": allow[1], "allowed_version_ids": allow[:1]},
            )
            rows = [str(row[0]) for row in result]
            assert KV_A in rows
            assert KV_B not in rows
    finally:
        await engine.dispose()
