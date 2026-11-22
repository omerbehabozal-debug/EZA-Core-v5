"""Yansı V2 Stage 01 — frozen 1–8 conversation draft / approve / publish."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import Base
from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_yansi import BusinessProfile, BusinessYansiDraft
from backend.models.mirror_network import YansiPublicationVersionV2
from backend.models.yansi_knowledge_bundle import YansiKnowledgeBundle, YansiKnowledgeBundleVersion
from backend.models.yansi_v2_conversation_draft import YansiV2ConversationDraft
from backend.services.mirror_network import yansi_v2_contract as pub
from backend.services.yansi import conversation_draft_v2 as drafts
from backend.services.yansi.public_read import read_public_image_publication, read_public_v2_publication
from backend.services.yansi.publish_conversation_v2 import (
    ConversationPublishV2Error,
    publish_approved_conversation_v2,
)
from backend.services.yansi.publish_image_v2 import publish_single_image_grounded_v2
from backend.tests.test_business_yansi import sample, source  # noqa: F401


def _turns(n: int) -> list[dict]:
    return [
        {
            "stepIndex": i,
            "question": f"Merak {i}?",
            "answer": f"Cevap {i}.",
        }
        for i in range(1, n + 1)
    ]


async def _ensure_tables(db: AsyncSession):
    def create(sync):
        Base.metadata.create_all(
            sync.connection(),
            tables=[
                YansiKnowledgeBundle.__table__,
                YansiKnowledgeBundleVersion.__table__,
                YansiPublicationVersionV2.__table__,
                YansiV2ConversationDraft.__table__,
            ],
        )
    await db.run_sync(create)


async def _image_asset(sample, *, revision=1, business=None):
    biz = business or sample.business
    asset = BusinessBrandAsset(
        id=uuid.uuid4(),
        business_id=biz.id,
        asset_type="image",
        title="Turn media",
        locator_kind="storage",
        locator=f"brand-assets/{biz.id}/{uuid.uuid4().hex}.png",
        public_allowed=True,
        status="published",
        created_by=sample.owner.id,
        approved_by=sample.owner.id,
        revision=revision,
    )
    sample.db.add(asset)
    await sample.db.commit()
    await sample.db.refresh(asset)
    return asset


async def _approve_ready(sample, *, n=3, knowledge=None, media=None):
    await _ensure_tables(sample.db)
    turns = _turns(n)
    if media is not None:
        turns[0]["media"] = [{
            "type": "image",
            "assetId": str(media.id),
            "assetRevision": int(media.revision),
            "title": media.title,
        }]
    pins = None
    if knowledge is not None:
        pins = [{
            "knowledgeVersionId": str(knowledge.id),
            "expectedRevision": int(knowledge.revision),
        }]
    created = await drafts.create_conversation_draft_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.editor.id),
        title=f"Sohbet {n}",
        turns=turns,
        knowledge_sources=pins,
    )
    reviewed = await drafts.transition_conversation_draft_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.editor.id),
        draft_id=created["id"],
        target="review",
        expected_revision=created["revision"],
    )
    approved = await drafts.transition_conversation_draft_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        draft_id=reviewed["id"],
        target="approved",
        expected_revision=reviewed["revision"],
        approval_note="Marka onayı",
    )
    return approved


# --- Contract / turn count -------------------------------------------------


@pytest.mark.parametrize("n,ok", [(0, False), (1, True), (3, True), (8, True), (9, False)])
def test_turn_count_bounds(n, ok):
    if n == 0:
        with pytest.raises(drafts.ConversationDraftV2Error) as err:
            drafts.normalize_draft_turns([])
        assert err.value.code == "turns_too_few"
        return
    if not ok:
        with pytest.raises(drafts.ConversationDraftV2Error) as err:
            drafts.normalize_draft_turns(_turns(n))
        assert err.value.code == "turns_too_many"
        return
    assert len(drafts.normalize_draft_turns(_turns(n))) == n
    manifest = {"blocks": [{"type": "frozen_conversation", "turns": _turns(n)}]}
    sealed = pub.build_contract(
        node_id="11111111-1111-1111-1111-111111111111",
        response_policy="open",
        content_kind="conversation",
        content_manifest=manifest,
        publication_version=1,
    )
    assert sealed["contentKind"] == "conversation"
    assert pub.curiosity_question_from_manifest(sealed["contentManifest"]) == "Merak 1?"


def test_empty_question_or_answer_rejected():
    with pytest.raises(drafts.ConversationDraftV2Error) as empty_q:
        drafts.normalize_draft_turns([{
            "stepIndex": 1, "question": "   ", "answer": "ok",
        }])
    assert empty_q.value.code == "frozen_turn_empty"
    with pytest.raises(drafts.ConversationDraftV2Error) as empty_a:
        drafts.normalize_draft_turns([{
            "stepIndex": 1, "question": "ok?", "answer": "",
        }])
    assert empty_a.value.code == "frozen_turn_empty"
    with pytest.raises(drafts.ConversationDraftV2Error) as pad:
        drafts.normalize_draft_turns([{
            "stepIndex": 1, "question": " ok?", "answer": "yes",
        }])
    assert pad.value.code == "frozen_turn_padding"


def test_turn_order_must_be_contiguous():
    with pytest.raises(drafts.ConversationDraftV2Error) as err:
        drafts.normalize_draft_turns([
            {"stepIndex": 1, "question": "A?", "answer": "a"},
            {"stepIndex": 3, "question": "B?", "answer": "b"},
        ])
    assert err.value.code == "frozen_turn_order_invalid"


def test_image_only_contract_unchanged():
    asset = "22222222-2222-2222-2222-222222222222"
    biz = "33333333-3333-3333-3333-333333333333"
    sealed = pub.build_contract(
        node_id="11111111-1111-1111-1111-111111111111",
        response_policy="open",
        content_kind="image",
        content_manifest={"blocks": [{
            "type": "image",
            "assetId": asset,
            "title": "Cover",
            "contentPath": f"/api/business-yansi/public-media/{biz}/{asset}",
        }]},
        publication_version=1,
    )
    assert sealed["contentKind"] == "image"
    assert pub.extract_frozen_conversation_block(sealed["contentManifest"]) is None


# --- Draft lifecycle -------------------------------------------------------


@pytest.mark.asyncio
async def test_draft_revise_invalidates_approval(sample):
    approved = await _approve_ready(sample, n=2)
    assert approved["status"] == "approved"
    revised = await drafts.revise_conversation_draft_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.editor.id),
        draft_id=approved["id"],
        expected_revision=approved["revision"],
        title="Yeni başlık",
        turns=_turns(2),
    )
    assert revised["status"] == "draft"
    assert revised["approvedBy"] is None
    assert revised["approvedContentDigest"] is None
    assert revised["revision"] == approved["revision"] + 1


@pytest.mark.asyncio
async def test_publish_without_approval_rejected(sample):
    await _ensure_tables(sample.db)
    created = await drafts.create_conversation_draft_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        title="Taslak",
        turns=_turns(1),
    )
    with pytest.raises(ConversationPublishV2Error) as err:
        await publish_approved_conversation_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            draft_id=created["id"],
            expected_draft_revision=created["revision"],
            slug=f"no-appr-{uuid.uuid4().hex[:8]}",
        )
    assert err.value.code == "approval_required"


@pytest.mark.asyncio
async def test_publish_after_revise_without_reapprove_rejected(sample):
    approved = await _approve_ready(sample, n=1)
    revised = await drafts.revise_conversation_draft_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        draft_id=approved["id"],
        expected_revision=approved["revision"],
        title="Değişti",
        turns=_turns(1),
    )
    # Force status approved with stale digest would be blocked; try publish on draft.
    with pytest.raises(ConversationPublishV2Error) as err:
        await publish_approved_conversation_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            draft_id=revised["id"],
            expected_draft_revision=revised["revision"],
            slug=f"stale-{uuid.uuid4().hex[:8]}",
        )
    assert err.value.code == "approval_required"


@pytest.mark.asyncio
async def test_idempotent_publish_same_key(sample):
    approved = await _approve_ready(sample, n=3)
    slug = f"idem-{uuid.uuid4().hex[:8]}"
    first = await publish_approved_conversation_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        draft_id=approved["id"],
        expected_draft_revision=approved["revision"],
        slug=slug,
        expected_current_version=None,
        idempotency_key="conv-key-1",
    )
    assert first["idempotent"] is False
    assert first["turnCount"] == 3
    draft_row = await sample.db.get(YansiV2ConversationDraft, uuid.UUID(approved["id"]))
    second = await publish_approved_conversation_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        draft_id=approved["id"],
        expected_draft_revision=int(draft_row.revision),
        node_id=first["nodeId"],
        expected_current_version=1,
        idempotency_key="conv-key-1",
    )
    assert second["idempotent"] is True
    assert second["publicationVersion"] == first["publicationVersion"]
    assert second["contractHash"] == first["contractHash"]
    versions = (
        await sample.db.scalars(
            select(YansiPublicationVersionV2).where(
                YansiPublicationVersionV2.node_id == uuid.UUID(first["nodeId"])
            )
        )
    ).all()
    assert len(versions) == 1


@pytest.mark.asyncio
async def test_foreign_tenant_knowledge_and_media_rejected(sample):
    await _ensure_tables(sample.db)
    other_biz = BusinessProfile(
        id=sample.other.id,
        slug="other-biz",
        name="Other",
        owner_id=sample.outsider.id,
        status="active",
        verified=True,
        official=False,
    )
    sample.db.add(other_biz)
    await sample.db.commit()

    foreign_asset = await _image_asset(sample, business=other_biz)
    with pytest.raises(drafts.ConversationDraftV2Error) as media_err:
        await drafts.create_conversation_draft_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            title="Foreign media",
            turns=[{
                "stepIndex": 1,
                "question": "Q?",
                "answer": "A",
                "media": [{
                    "type": "image",
                    "assetId": str(foreign_asset.id),
                    "assetRevision": 1,
                    "title": "x",
                }],
            }],
        )
    assert media_err.value.code == "foreign_tenant_asset"

    # Revoked / non-published knowledge
    kv = await source(sample, content="Gizli kaynak metni.")
    kv.status = "archived"
    kv.revision = int(kv.revision) + 1
    await sample.db.commit()
    with pytest.raises(drafts.ConversationDraftV2Error) as kv_err:
        await drafts.create_conversation_draft_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            title="Revoked",
            turns=_turns(1),
            knowledge_sources=[{
                "knowledgeVersionId": str(kv.id),
                "expectedRevision": int(kv.revision),
            }],
        )
    assert kv_err.value.code == "knowledge_source_not_ready"


@pytest.mark.asyncio
async def test_media_revision_conflict_and_public_no_locator(sample):
    asset = await _image_asset(sample, revision=2)
    approved = await _approve_ready(sample, n=1, media=asset)
    published = await publish_approved_conversation_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        draft_id=approved["id"],
        expected_draft_revision=approved["revision"],
        slug=f"media-{uuid.uuid4().hex[:8]}",
        expected_current_version=None,
    )
    public = published["public"]
    assert "locator" not in str(public).lower() or "contentpath" in str(public).lower()
    # Stronger: no storage locator substring from asset.
    assert asset.locator not in str(public)
    assert public["conversation"]["curiosityQuestion"] == "Merak 1?"
    assert public["conversation"]["turns"][0]["media"][0]["assetRevision"] == 2
    pub.validate_contract(public["contract"])

    # Bad revision at create time
    with pytest.raises(drafts.ConversationDraftV2Error) as err:
        await drafts.create_conversation_draft_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            title="Bad rev",
            turns=[{
                "stepIndex": 1,
                "question": "Q?",
                "answer": "A",
                "media": [{
                    "type": "image",
                    "assetId": str(asset.id),
                    "assetRevision": 99,
                    "title": "x",
                }],
            }],
        )
    assert err.value.code == "revision_conflict"


@pytest.mark.asyncio
async def test_public_read_conversation_and_image_regression(sample):
    approved = await _approve_ready(sample, n=2)
    conv = await publish_approved_conversation_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        draft_id=approved["id"],
        expected_draft_revision=approved["revision"],
        slug=f"read-c-{uuid.uuid4().hex[:8]}",
    )
    read = await read_public_v2_publication(sample.db, slug=conv["slug"])
    assert read["contentKind"] == "conversation"
    assert read["public"]["conversation"]["turnCount"] == 2
    assert read["public"]["conversation"]["turns"][0]["stepIndex"] == 1
    assert read["public"]["conversation"]["curiosityQuestion"] == "Merak 1?"
    assert "locator" not in str(read["public"])

    # Image-only regression via same tables
    asset = await _image_asset(sample)
    img = await publish_single_image_grounded_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        asset_id=str(asset.id),
        expected_asset_revision=1,
        title="Image only",
        slug=f"read-i-{uuid.uuid4().hex[:8]}",
        expected_current_version=None,
    )
    img_read = await read_public_image_publication(sample.db, slug=img["slug"])
    assert img_read["public"]["contract"]["contentKind"] == "image"
    img_dispatch = await read_public_v2_publication(sample.db, slug=img["slug"])
    assert img_dispatch["contentKind"] == "image"
    assert img_dispatch["public"]["media"]["assetId"] == str(asset.id).lower()


@pytest.mark.asyncio
async def test_v1_eight_step_draft_table_untouched(sample):
    """V1 BusinessYansiDraft still enforces 8 steps in its own service — not called here.

    Stage 01 must not write V1 draft rows for V2 conversation drafts.
    """
    await _ensure_tables(sample.db)
    await drafts.create_conversation_draft_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        title="V2 only",
        turns=_turns(1),
    )
    v1_count = len((await sample.db.scalars(select(BusinessYansiDraft))).all())
    v2_count = len((await sample.db.scalars(select(YansiV2ConversationDraft))).all())
    assert v1_count == 0
    assert v2_count == 1


@pytest.mark.asyncio
async def test_guest_continuation_binds_conversation_version(sample):
    from backend.services.yansi.continuation_v2 import bind_yansi_v2_history

    approved = await _approve_ready(sample, n=2)
    published = await publish_approved_conversation_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        draft_id=approved["id"],
        expected_draft_revision=approved["revision"],
        slug=f"cont-{uuid.uuid4().hex[:8]}",
    )
    bound = await bind_yansi_v2_history(
        sample.db, published["slug"], published["publicationVersion"], [],
    )
    assert bound is not None
    assert bound.publication_version == published["publicationVersion"]
    assert bound.contract_hash == published["contractHash"]
    assert bound.business_id == str(sample.business.id).lower()


@pytest.mark.asyncio
async def test_frozen_hash_seal_stable(sample):
    approved = await _approve_ready(sample, n=1)
    published = await publish_approved_conversation_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        draft_id=approved["id"],
        expected_draft_revision=approved["revision"],
        slug=f"seal-{uuid.uuid4().hex[:8]}",
    )
    contract = published["public"]["contract"]
    recomputed = pub.compute_manifest_hash(contract["contentManifest"])
    assert recomputed == contract["manifestHash"]
    assert pub.compute_contract_hash(
        node_id=contract["nodeId"],
        publication_version=contract["publicationVersion"],
        response_policy=contract["responsePolicy"],
        content_kind=contract["contentKind"],
        manifest_hash=contract["manifestHash"],
        knowledge_bundle_version_ref=contract["knowledgeBundleVersionRef"],
    ) == contract["contractHash"]


@pytest.mark.asyncio
async def test_sqlite_duplicate_version_gate_with_different_keys(sample):
    """Two different keys on same expected version → second fails closed."""
    approved = await _approve_ready(sample, n=1)
    slug = f"race-{uuid.uuid4().hex[:8]}"
    first = await publish_approved_conversation_v2(
        sample.db,
        business_id=str(sample.business.id),
        actor_user_id=str(sample.owner.id),
        draft_id=approved["id"],
        expected_draft_revision=approved["revision"],
        slug=slug,
        expected_current_version=None,
        idempotency_key="k-a",
    )
    # Draft already published — cannot publish again without new draft/approval.
    with pytest.raises(ConversationPublishV2Error) as err:
        await publish_approved_conversation_v2(
            sample.db,
            business_id=str(sample.business.id),
            actor_user_id=str(sample.owner.id),
            draft_id=approved["id"],
            expected_draft_revision=first["public"]["contract"]["publicationVersion"],
            node_id=first["nodeId"],
            expected_current_version=1,
            idempotency_key="k-b",
        )
    # draft status published → approval_required or revision_conflict or draft_immutable path
    assert err.value.code in {
        "approval_required",
        "revision_conflict",
        "draft_immutable",
        "approval_stale",
    }
