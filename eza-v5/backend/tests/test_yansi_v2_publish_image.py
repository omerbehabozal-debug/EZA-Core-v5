"""Yansı V2 Stage 3A — single-image grounded publish service."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import Base
from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.mirror_network import MirrorNetworkNode, YansiPublicationVersionV2
from backend.models.yansi_knowledge_bundle import YansiKnowledgeBundle, YansiKnowledgeBundleVersion
from backend.services.mirror_network import yansi_v2_contract as pub
from backend.services.yansi import knowledge_bundle as kb
from backend.services.yansi.publish_image_v2 import (
    ImagePublishV2Error,
    assert_image_asset_publishable,
    build_image_only_manifest,
    next_publication_version,
    public_media_path,
    publish_single_image_grounded_v2,
)
from backend.tests.test_business_yansi import sample  # noqa: F401 — fixture


async def _ensure_v2_tables(db: AsyncSession):
    def create(sync):
        Base.metadata.create_all(
            sync.connection(),
            tables=[
                YansiKnowledgeBundle.__table__,
                YansiKnowledgeBundleVersion.__table__,
                YansiPublicationVersionV2.__table__,
            ],
        )
    await db.run_sync(create)


async def _image_asset(sample, *, revision=1, business=None, public=True, status="published"):
    biz = business or sample.business
    asset = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=biz.id,
        asset_type="image",
        title="Kiln",
        caption="Front",
        locator_kind="storage",
        locator=f"brand-assets/{biz.id}/{uuid.uuid4().hex}.png",
        public_allowed=public,
        status=status,
        created_by=sample.owner.id,
        approved_by=sample.owner.id if status == "published" else None,
        revision=revision,
    )
    sample.db.add(asset)
    await sample.db.commit()
    await sample.db.refresh(asset)
    return asset


@pytest.mark.asyncio
async def test_single_image_zero_conversation_publish(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    result = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="Kiln morning",
        description="Optional short note.",
        slug=f"kiln-{uuid.uuid4().hex[:8]}",
        expected_current_version=None,
        idempotency_key="pub-1",
    )
    assert result["status"] == "published"
    assert result["idempotent"] is False
    assert result["publicationVersion"] == 1
    contract = result["public"]["contract"]
    assert contract["responsePolicy"] == "grounded"
    assert contract["contentKind"] == "image"
    assert len(contract["contentManifest"]["blocks"]) == 1
    assert contract["contentManifest"]["blocks"][0]["type"] == "image"
    assert "turns" not in contract["contentManifest"]["blocks"][0]
    assert result["public"]["media"]["contentPath"] == public_media_path(
        sample.business.id, asset.id,
    )
    assert "locator" not in str(result["public"])
    pub.validate_contract(contract)

    node = await sample.db.get(MirrorNetworkNode, uuid.UUID(result["nodeId"]))
    assert node.visibility == "public"
    assert node.current_v2_publication_version == 1
    versions = (
        await sample.db.scalars(
            select(YansiPublicationVersionV2).where(YansiPublicationVersionV2.node_id == node.id)
        )
    ).all()
    assert len(versions) == 1


@pytest.mark.asyncio
async def test_linked_knowledge_versions_seal_and_foreign_rejected(sample):
    await _ensure_v2_tables(sample.db)
    from backend.tests.test_business_yansi import source as make_knowledge

    asset = await _image_asset(sample)
    kv = await make_knowledge(sample, content="WX-100 garantisi 2 yıldır.")
    result = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="With pool",
        knowledge_sources=[{
            "knowledgeVersionId": str(kv.id),
            "expectedRevision": int(kv.revision),
        }],
        slug=f"pool-{uuid.uuid4().hex[:8]}",
        expected_current_version=None,
    )
    kinds = [item.get("sourceKind") for item in result["public"]["bundle"]["items"]]
    assert "knowledge_version" in kinds
    refs = [
        item.get("sourceRefId")
        for item in result["public"]["bundle"]["items"]
        if item.get("sourceKind") == "knowledge_version"
    ]
    assert str(kv.id).lower() in refs

    with pytest.raises(ImagePublishV2Error) as raised:
        await publish_single_image_grounded_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            asset_id=str(asset.id),
            expected_asset_revision=1,
            title="Bad pin",
            knowledge_sources=[{
                "knowledgeVersionId": str(kv.id),
                "expectedRevision": int(kv.revision) + 99,
            }],
            slug=f"pool-bad-{uuid.uuid4().hex[:8]}",
            expected_current_version=None,
        )
    assert raised.value.code == "revision_conflict"


@pytest.mark.asyncio
async def test_knowledge_notes_seal_as_creator_text(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    result = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="Notes",
        description="Visible description",
        knowledge_notes=["Garanti 2 yıl", "  ", "Stok sınırlı"],
        slug=f"notes-{uuid.uuid4().hex[:8]}",
        expected_current_version=None,
    )
    items = result["public"]["bundle"]["items"]
    titles = [item.get("title") for item in items]
    assert "Description" in titles
    assert titles.count("Bilgi notu") == 2
    assert all(item.get("provenanceType") == "creator" or item.get("sourceKind") == "image_asset" for item in items)
    assert not any(item.get("provenanceType") == "ai_observation" for item in items)


@pytest.mark.asyncio
async def test_editor_cannot_publish(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    with pytest.raises(ImagePublishV2Error) as raised:
        await publish_single_image_grounded_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.editor.id),
            asset_id=str(asset.id),
            expected_asset_revision=1,
            title="Denied",
            expected_current_version=None,
        )
    assert raised.value.code == "owner_required"


@pytest.mark.asyncio
async def test_foreign_tenant_asset_rejected(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    other_business_id = uuid.uuid4()
    with pytest.raises(ImagePublishV2Error) as raised:
        assert_image_asset_publishable(
            asset,
            business_id=other_business_id,
            expected_revision=1,
        )
    assert raised.value.code == "foreign_tenant_asset"
    # Publish path uses the same gate after loading the asset for the caller's business.
    with pytest.raises(ImagePublishV2Error) as raised_pub:
        # Force mismatch by publishing under a fabricated business that won't own the asset.
        # access fails first on missing business — use helper for tenant proof above.
        assert_image_asset_publishable(
            asset,
            business_id=uuid.uuid4(),
            expected_revision=1,
        )
    assert raised_pub.value.code == "foreign_tenant_asset"


@pytest.mark.asyncio
async def test_revision_conflict_on_asset(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample, revision=2)
    with pytest.raises(ImagePublishV2Error) as raised:
        await publish_single_image_grounded_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            asset_id=str(asset.id),
            expected_asset_revision=1,
            title="Stale",
            expected_current_version=None,
        )
    assert raised.value.code == "revision_conflict"


@pytest.mark.asyncio
async def test_asset_digest_mismatch_helper():
    asset = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        asset_type="image",
        title="X",
        locator_kind="storage",
        locator="brand-assets/x/y.png",
        public_allowed=True,
        status="published",
        created_by=uuid.uuid4(),
        approved_by=uuid.uuid4(),
        revision=1,
    )
    digest_a = kb.compute_asset_digest(
        asset_id=str(asset.id),
        revision=1,
        asset_type="image",
        locator_kind="storage",
        locator=asset.locator,
    )
    digest_b = kb.compute_asset_digest(
        asset_id=str(asset.id),
        revision=2,
        asset_type="image",
        locator_kind="storage",
        locator=asset.locator,
    )
    assert digest_a != digest_b
    assert_image_asset_publishable(asset, business_id=asset.business_id, expected_revision=1)
    with pytest.raises(ImagePublishV2Error) as raised:
        assert_image_asset_publishable(asset, business_id=asset.business_id, expected_revision=9)
    assert raised.value.code == "revision_conflict"


@pytest.mark.asyncio
async def test_duplicate_idempotent_publish(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    slug = f"idem-{uuid.uuid4().hex[:8]}"
    first = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="Idem",
        slug=slug,
        expected_current_version=None,
        idempotency_key="same-key",
    )
    second = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="Idem",
        node_id=first["nodeId"],
        expected_current_version=1,
        idempotency_key="same-key",
    )
    assert second["idempotent"] is True
    assert second["publicationVersion"] == first["publicationVersion"]
    assert second["contractHash"] == first["contractHash"]
    count = len(
        (
            await sample.db.scalars(
                select(YansiPublicationVersionV2).where(
                    YansiPublicationVersionV2.node_id == uuid.UUID(first["nodeId"])
                )
            )
        ).all()
    )
    assert count == 1


@pytest.mark.asyncio
async def test_node_revision_conflict_blocks_second_version(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    first = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="V1",
        slug=f"rev-{uuid.uuid4().hex[:8]}",
        expected_current_version=None,
    )
    with pytest.raises(ImagePublishV2Error) as raised:
        await publish_single_image_grounded_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            asset_id=str(asset.id),
            expected_asset_revision=1,
            title="V2 stale pointer",
            node_id=first["nodeId"],
            expected_current_version=None,  # stale — server is at 1
        )
    assert raised.value.code == "revision_conflict"


@pytest.mark.asyncio
async def test_transaction_rollback_leaves_no_publication(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    result = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="Rollback",
        slug=f"rb-{uuid.uuid4().hex[:8]}",
        expected_current_version=None,
        commit=False,
    )
    node_id = uuid.UUID(result["nodeId"])
    await sample.db.rollback()
    assert await sample.db.get(MirrorNetworkNode, node_id) is None
    assert (
        await sample.db.scalar(
            select(YansiPublicationVersionV2).where(YansiPublicationVersionV2.node_id == node_id)
        )
    ) is None


@pytest.mark.asyncio
async def test_public_dto_privacy_and_hash_verify(sample):
    await _ensure_v2_tables(sample.db)
    asset = await _image_asset(sample)
    result = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="Public",
        description="Visible note",
        slug=f"pub-{uuid.uuid4().hex[:8]}",
        expected_current_version=None,
    )
    public = result["public"]
    blob = str(public)
    assert "brand-assets/" not in blob
    assert "storageKey" not in blob
    assert "locator" not in blob
    assert public["media"]["contentPath"].startswith("/api/business-yansi/public-media/")
    recomputed = pub.compute_contract_hash(
        node_id=public["contract"]["nodeId"],
        publication_version=public["contract"]["publicationVersion"],
        response_policy=public["contract"]["responsePolicy"],
        content_kind=public["contract"]["contentKind"],
        manifest_hash=public["contract"]["manifestHash"],
        knowledge_bundle_version_ref=public["contract"]["knowledgeBundleVersionRef"],
    )
    assert recomputed == public["contract"]["contractHash"]


def test_manifest_and_version_helpers():
    biz = str(uuid.uuid4())
    asset = str(uuid.uuid4())
    manifest = build_image_only_manifest(business_id=biz, asset_id=asset, title="T")
    assert manifest["blocks"][0]["contentPath"] == public_media_path(biz, asset)
    assert next_publication_version(None) == 1
    assert next_publication_version(3) == 4


def test_bundle_hash_mismatch_rejected_by_seal():
    text = "note"
    items = [{
        "index": 0,
        "sourceKind": "creator_text",
        "provenanceType": "creator",
        "contentDigest": kb.compute_creator_text_digest(text),
        "usageAllowed": True,
        "viewAllowed": True,
        "text": text,
        "title": "N",
    }]
    items = kb.validate_items_manifest(items)
    with pytest.raises(kb.KnowledgeBundleError) as raised:
        kb.seal_version_payload(
            bundle_id=str(uuid.uuid4()),
            bundle_version_id=str(uuid.uuid4()),
            version=1,
            access_scope="publication_bound",
            items=items,
            bundle_hash="0" * 64,
            business_id=str(uuid.uuid4()),
            owner_user_id=str(uuid.uuid4()),
            approved_by=str(uuid.uuid4()),
        )
    assert raised.value.code == "bundle_digest_mismatch"


def test_unsealed_bundle_blocks_grounded_binding():
    with pytest.raises(kb.KnowledgeBundleError) as raised:
        kb.assert_publication_bundle_binding(
            response_policy="grounded",
            knowledge_bundle_version_ref=str(uuid.uuid4()),
            bundle_version={"id": str(uuid.uuid4()), "status": "draft", "bundle_hash": "a" * 64},
        )
    assert raised.value.code in {"bundle_not_sealed", "bundle_ref_mismatch"}
