"""Yansı V2 Stage 3B — HTTP publish, public read, continuation binding."""
from __future__ import annotations

import uuid

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import get_current_user
from backend.core.utils.dependencies import Base, get_db
from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.mirror_network import (
    ARTIFACT_KIND_JOURNEY_V1,
    MirrorNetworkNode,
    YansiPublicationVersionV2,
)
from backend.models.yansi_knowledge_bundle import YansiKnowledgeBundle, YansiKnowledgeBundleVersion
from backend.routers import yansi_v2 as routes
from backend.services.mirror_network.discover import (
    is_canonical_discover_node_structure,
    load_discover_eligible_nodes,
    load_merged_discover_eligible_nodes,
)
from backend.services.mirror_network.frozen_journey_artifact import FREEZE_STATUS_FROZEN
from backend.services.yansi.continuation_v2 import (
    ContinuationV2Error,
    YansiV2History,
    answer_yansi_v2_continuation,
    reject_client_overrides,
)
from backend.services.yansi.discover_v2 import is_v2_discover_eligible, load_v2_discover_eligible_nodes
from backend.services.yansi.publish_image_v2 import public_media_path
from backend.services.business_yansi.answers import BusinessHistory, bind_business_history
from backend.tests.test_business_yansi import sample  # noqa: F401
from backend.tests.test_yansi_v2_publish_image import _ensure_v2_tables, _image_asset


def _app(db, user_id: str) -> FastAPI:
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: {"user_id": user_id, "role": "user"}
    app.dependency_overrides[routes.rate_limit_standalone] = lambda: None
    return app


async def _publish(client, business_id, body: dict):
    return await client.post(
        f"/api/business-yansi/{business_id}/v2/publications/image",
        json=body,
    )


@pytest.mark.asyncio
async def test_owner_publish_single_image_zero_chat(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    slug = f"kiln-http-{uuid.uuid4().hex[:8]}"
    app = _app(sample.db, str(sample.owner.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        res = await _publish(client, sample.business.id, {
            "assetId": str(asset.id),
            "expectedAssetRevision": 1,
            "title": "Kiln morning",
            "description": "Optional note for grounded answers.",
            "slug": slug,
            "expectedCurrentVersion": None,
            "idempotencyKey": "http-1",
        })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "published"
    assert data["idempotent"] is False
    assert data["publicationVersion"] == 1
    assert data["public"]["contract"]["contentKind"] == "image"
    assert data["public"]["media"]["contentPath"] == public_media_path(sample.business.id, asset.id)
    public_blob = str(data["public"])
    for banned in ("storageKey", "storage_key", "brand-assets/", '"locator"', "absolutePath"):
        assert banned not in public_blob
    assert "turns" not in str(data["public"]["contract"]["contentManifest"])


@pytest.mark.asyncio
async def test_editor_forbidden_and_foreign_tenant(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    # Editor cannot publish.
    app_editor = _app(sample.db, str(sample.editor.id))
    async with httpx.AsyncClient(app=app_editor, base_url="http://test") as client:
        denied = await _publish(client, sample.business.id, {
            "assetId": str(asset.id),
            "expectedAssetRevision": 1,
            "title": "Denied",
            "expectedCurrentVersion": None,
        })
    assert denied.status_code == 403
    assert denied.json()["detail"]["code"] == "owner_required"

    # Foreign tenant: outsider owns another org, asset belongs to sample.business.
    other_owner = sample.outsider
    # Create membership as owner on other org business is hard; call service under wrong business.
    app_owner = _app(sample.db, str(sample.owner.id))
    async with httpx.AsyncClient(app=app_owner, base_url="http://test") as client:
        foreign = await _publish(client, sample.other.id, {
            "assetId": str(asset.id),
            "expectedAssetRevision": 1,
            "title": "Cross",
            "expectedCurrentVersion": None,
        })
    # business_not_found (other org has no BusinessProfile) or foreign_tenant
    assert foreign.status_code in {403, 404}
    assert foreign.json()["detail"]["code"] in {
        "business_not_found", "foreign_tenant_asset", "owner_required",
    }


@pytest.mark.asyncio
async def test_idempotent_publish_and_revision_conflict(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    slug = f"idem-{uuid.uuid4().hex[:8]}"
    body = {
        "assetId": str(asset.id),
        "expectedAssetRevision": 1,
        "title": "Idem",
        "slug": slug,
        "expectedCurrentVersion": None,
        "idempotencyKey": "same-key",
    }
    app = _app(sample.db, str(sample.owner.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        first = await _publish(client, sample.business.id, body)
        assert first.status_code == 200, first.text
        node_id = first.json()["nodeId"]
        second = await _publish(client, sample.business.id, {
            **body,
            "slug": None,
            "nodeId": node_id,
            "expectedCurrentVersion": 1,
        })
        conflict = await _publish(client, sample.business.id, {
            "assetId": str(asset.id),
            "expectedAssetRevision": 1,
            "title": "Conflict",
            "idempotencyKey": "other-key",
            "expectedCurrentVersion": None,  # stale — node already at v1
            "nodeId": node_id,
        })
        rev = await _publish(client, sample.business.id, {
            "assetId": str(asset.id),
            "expectedAssetRevision": 99,
            "title": "Bad rev",
            "expectedCurrentVersion": None,
            "slug": f"rev-{uuid.uuid4().hex[:8]}",
        })
    assert second.status_code == 200, second.text
    assert second.json()["idempotent"] is True
    assert second.json()["publicationVersion"] == first.json()["publicationVersion"]
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "revision_conflict"
    assert rev.status_code == 409
    assert rev.json()["detail"]["code"] == "revision_conflict"


@pytest.mark.asyncio
async def test_public_read_privacy_and_old_version(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    slug = f"pub-{uuid.uuid4().hex[:8]}"
    app = _app(sample.db, str(sample.owner.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        first = await _publish(client, sample.business.id, {
            "assetId": str(asset.id),
            "expectedAssetRevision": 1,
            "title": "V1",
            "description": "Secret creator note that must not leak as private locator.",
            "slug": slug,
            "expectedCurrentVersion": None,
            "idempotencyKey": "v1",
        })
        node_id = first.json()["nodeId"]
        second = await _publish(client, sample.business.id, {
            "assetId": str(asset.id),
            "expectedAssetRevision": 1,
            "title": "V2",
            "description": "Second sealed note.",
            "nodeId": node_id,
            "expectedCurrentVersion": 1,
            "idempotencyKey": "v2",
        })
        assert second.status_code == 200
        current = await client.get(f"/api/business-yansi/v2/public/{slug}")
        old = await client.get(f"/api/business-yansi/v2/public/{slug}/versions/1")
        missing = await client.get(f"/api/business-yansi/v2/public/{slug}/versions/99")

    assert current.status_code == 200
    assert current.json()["publicationVersion"] == 2
    assert current.json()["isCurrent"] is True
    assert old.status_code == 200
    assert old.json()["publicationVersion"] == 1
    assert old.json()["isCurrent"] is False
    assert missing.status_code == 404

    blob = str(current.json())
    assert "locator" not in blob.lower() or "contentpath" in blob.lower()
    for banned in ("storageKey", "storage_key", "brand-assets/", "s3Key", "absolutePath"):
        assert banned not in blob

    # Draft / private node must not be readable.
    node = await sample.db.get(MirrorNetworkNode, uuid.UUID(node_id))
    node.visibility = "private"
    await sample.db.commit()
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        draft = await client.get(f"/api/business-yansi/v2/public/{slug}")
    assert draft.status_code == 404
    assert draft.json()["detail"]["code"] in {"not_public", "draft_not_readable"}


@pytest.mark.asyncio
async def test_wrong_contract_hash_and_client_bundle_override(sample, monkeypatch):
    await _ensure_v2_tables(sample.db)
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ANSWERS_ENABLED", "true")
    asset = await _image_asset(sample)
    slug = f"hash-{uuid.uuid4().hex[:8]}"
    app = _app(sample.db, str(sample.owner.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        published = await _publish(client, sample.business.id, {
            "assetId": str(asset.id),
            "expectedAssetRevision": 1,
            "title": "Hash",
            "description": "Kiln fires at dawn.",
            "slug": slug,
            "expectedCurrentVersion": None,
        })
        assert published.status_code == 200
        # Body with forbidden override keys — extra=forbid → 422
        override = await client.post(
            f"/api/business-yansi/v2/public/{slug}/answer",
            json={
                "question": "What fires?",
                "bundleId": str(uuid.uuid4()),
                "responsePolicy": "open",
            },
        )
        assert override.status_code == 422

    with pytest.raises(ContinuationV2Error) as raised:
        reject_client_overrides({"bundleId": str(uuid.uuid4())})
    assert raised.value.code == "client_override_forbidden"

    # Tamper contract hash on row → public read / continuation fail closed.
    pub_row = (
        await sample.db.scalars(
            select(YansiPublicationVersionV2).where(
                YansiPublicationVersionV2.publication_version == 1,
            )
        )
    ).first()
    pub_row.contract_hash = "0" * 64
    await sample.db.commit()

    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        bad = await client.get(f"/api/business-yansi/v2/public/{slug}")
        ans = await client.post(
            f"/api/business-yansi/v2/public/{slug}/answer",
            json={"question": "What fires?", "publicationVersion": 1},
        )
        missing_pin = await client.post(
            f"/api/business-yansi/v2/public/{slug}/answer",
            json={"question": "What fires?"},
        )
    assert bad.status_code in {404, 409}
    assert bad.json()["detail"]["code"] == "contract_hash_mismatch"
    assert ans.status_code == 404  # bind returns None when integrity fails
    assert missing_pin.status_code == 422  # Stage 04E: publicationVersion required


@pytest.mark.asyncio
async def test_grounded_continuation_source_isolation(sample, monkeypatch):
    await _ensure_v2_tables(sample.db)
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_RAG_ANSWERS_ENABLED", "true")
    asset = await _image_asset(sample)
    slug = f"cont-{uuid.uuid4().hex[:8]}"
    app = _app(sample.db, str(sample.owner.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        published = await _publish(client, sample.business.id, {
            "assetId": str(asset.id),
            "expectedAssetRevision": 1,
            "title": "Continuation",
            "description": "WX-100 garantisi 2 yıldır.",
            "slug": slug,
            "expectedCurrentVersion": None,
        })
    assert published.status_code == 200
    contract_hash = published.json()["contractHash"]

    bound = await bind_business_history(sample.db, slug, 1, [], "garanti")
    assert isinstance(bound, YansiV2History)
    assert bound.contract_hash == contract_hash
    assert not hasattr(bound, "bundleId") or getattr(bound, "bundleId", None) is None

    async def fake_provider(prompt, *, timeout, max_tokens):
        return {
            "ok": True,
            "output": (
                '{"answer":"WX-100 için garanti 2 yıldır.",'
                '"source_refs":[{"chunk_id":"creator:'
                + bound.slug
                + '","knowledge_version_id":"creator:x:0","item_id":"creator:x:0"}]}'
            ),
            "usage": {"completion_tokens": 20},
        }

    result = await answer_yansi_v2_continuation(
        sample.db,
        "Garanti kaç yıl?",
        bound,
        provider=fake_provider,
        lexical_only=True,
        client_payload={"question": "Garanti kaç yıl?"},
    )
    assert result["yansi_v2_grounded"] is True
    assert result["publication"]["contractHash"] == contract_hash
    # Client cannot force open policy via payload
    with pytest.raises(ContinuationV2Error):
        await answer_yansi_v2_continuation(
            sample.db,
            "x",
            bound,
            client_payload={"responsePolicy": "open"},
            lexical_only=True,
        )


@pytest.mark.asyncio
async def test_v1_bind_and_discover_regression(sample):
    await _ensure_v2_tables(sample.db)
    # V1 bind still returns plain history when no BusinessPublication / V2.
    normal = []
    out = await bind_business_history(sample.db, "no-such-slug", 1, normal, "q")
    assert out is normal

    # V1 Discover structural gate must reject V2 image nodes (legacy_landing, non_frozen).
    asset = await _image_asset(sample)
    slug = f"disc-{uuid.uuid4().hex[:8]}"
    app = _app(sample.db, str(sample.owner.id))
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        published = await _publish(client, sample.business.id, {
            "assetId": str(asset.id),
            "expectedAssetRevision": 1,
            "title": "Discover V2",
            "slug": slug,
            "expectedCurrentVersion": None,
        })
    assert published.status_code == 200
    node = await sample.db.get(MirrorNetworkNode, uuid.UUID(published.json()["nodeId"]))
    assert is_canonical_discover_node_structure(node) is False
    assert is_v2_discover_eligible(node) is True

    v1_pool = await load_discover_eligible_nodes(sample.db)
    assert all(n.slug != slug for n, _ in v1_pool)

    v2_pool = await load_v2_discover_eligible_nodes(sample.db)
    assert any(n.slug == slug for n, _ in v2_pool)

    # Stage 04B: merged feed includes V2 without rewriting V1 SQL.
    merged = await load_merged_discover_eligible_nodes(sample.db)
    assert any(n.slug == slug for n, _ in merged)
    merged_v2 = next(n for n, _ in merged if n.slug == slug)
    assert getattr(merged_v2, "freeze_status", None) != FREEZE_STATUS_FROZEN

    # A fabricated frozen journey_v1 still matches V1 structure helper (regression lock).
    frozen = MirrorNetworkNode(
        id=uuid.uuid4(),
        slug=f"frozen-{uuid.uuid4().hex[:8]}",
        user_id=sample.owner.id,
        visibility="public",
        safety_status="open",
        card_title="Frozen",
        card_date="2026-01-01",
        scene_image_url="https://cdn.example.test/scene.jpg",
        public_payload={},
        private_payload={},
        artifact_kind=ARTIFACT_KIND_JOURNEY_V1,
        journey_version=1,
        freeze_status=FREEZE_STATUS_FROZEN,
        published_at=node.published_at,
    )
    sample.db.add(frozen)
    await sample.db.commit()
    assert is_canonical_discover_node_structure(frozen) is True
    assert is_v2_discover_eligible(frozen) is False


@pytest.mark.asyncio
async def test_v1_publish_endpoint_untouched(sample, monkeypatch):
    """V1 draft publish route path remains registered separately from V2."""
    from backend.routers import business_yansi as v1

    paths = {getattr(r, "path", "") for r in v1.router.routes}
    assert any(p.endswith("/drafts/{draft_id}/publish") for p in paths)
    v2_paths = {getattr(r, "path", "") for r in routes.router.routes}
    assert any("/v2/publications/image" in p for p in v2_paths)
    assert not any("/drafts/{draft_id}/publish" in p for p in v2_paths)
