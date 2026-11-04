"""Implementation 2B-1: publish / export / Knowledge post-lock authorization.

Controlled SQLite interleavings and state freshness — not PostgreSQL lock proofs.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import select, update

from backend.models.business_yansi import BusinessMember, BusinessProfile
from backend.models.business_yansi import BusinessKnowledgeVersion as Knowledge
from backend.models.business_yansi import BusinessPublication, BusinessYansiDraft as Draft
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.production import Organization, User
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.services.business_yansi.video_authority import (
    assign_member_role,
    require_locked_actor,
    update_brand_verification,
)
from backend.tests.test_business_studio_media import _approve, _asset, _steps
from backend.tests.test_business_video_cover_policy import asset_dir, sample
from backend.tests.test_business_yansi import source

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
_BACKEND = Path(__file__).resolve().parents[1]


def _patch_lock_after(monkeypatch, side_effect):
    real_lock = media.business_media_lock

    @asynccontextmanager
    async def lock_spy(db, business_id):
        await side_effect(db)
        async with real_lock(db, business_id) as snap:
            yield snap

    import backend.services.business_yansi.studio_media as studio_mod

    monkeypatch.setattr(studio_mod, "business_media_lock", lock_spy)


def _patch_require_after(monkeypatch, side_effect):
    """Run side_effect immediately before require_locked_actor (Knowledge writers)."""
    import backend.services.business_yansi.video_authority as va

    real = va.require_locked_actor

    async def spy(db, business_id, actor_id, minimum="editor", **kwargs):
        await side_effect(db)
        return await real(db, business_id, actor_id, minimum, **kwargs)

    monkeypatch.setattr(va, "require_locked_actor", spy)


async def _force_member_role(db, business_id, user_id, role: str):
    await db.execute(
        update(BusinessMember)
        .where(BusinessMember.business_id == business_id, BusinessMember.user_id == user_id)
        .values(role=role)
        .execution_options(synchronize_session=False)
    )
    await db.commit()


async def _approved_exportable(sample, monkeypatch, *, slug="yansi-2b1"):
    knowledge = await source(sample, content="Yayin yetkisi kaydi icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True, image_bytes=_PNG + b"2b1",
    )
    steps = _steps(knowledge, question="Yayin nedir?")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Yayin", "Yayin", steps,
    )
    draft = await _approve(sample, draft)
    seal = None if draft.media_plan is None else draft.media_plan.get("seal")
    await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, draft.id)
    await sample.db.refresh(draft)
    conversation = await sample.db.get(StandaloneConversation, draft.conversation_id)
    node = MirrorNetworkNode(
        slug=slug,
        user_id=draft.created_by,
        conversation_id=conversation.client_conversation_id,
        visibility="private",
        safety_status="open",
        card_title="Yayin",
        card_date="2026-11-04",
        scene_image_url=None,
        public_payload={},
        private_payload={},
        journey_version=1,
    )
    sample.db.add(node)
    await sample.db.commit()
    await sample.db.refresh(draft)

    def matching(_internal):
        return {"steps": [{"publicQuestion": step["question"], "publicAnswer": step["answer"]} for step in steps]}

    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.get_frozen_journey_artifact",
        AsyncMock(return_value={"frozen": True}),
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.to_public_frozen_journey_artifact",
        matching,
    )
    return draft, node, seal


# --- Publication ---


async def test_owner_demoted_before_publication(sample, asset_dir, monkeypatch):
    draft, node, seal = await _approved_exportable(sample, monkeypatch, slug="yansi-demote")

    async def demote(db):
        await _force_member_role(db, sample.business.id, sample.owner.id, "viewer")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
        )
    assert raised.value.status_code == 403
    await sample.db.refresh(draft)
    assert draft.status == "approved"
    if draft.media_plan is not None:
        assert draft.media_plan.get("seal") == seal
    assert await sample.db.get(BusinessPublication, (node.slug, node.journey_version)) is None


async def test_owner_membership_revoked_before_publication(sample, asset_dir, monkeypatch):
    draft, node, seal = await _approved_exportable(sample, monkeypatch, slug="yansi-revoke")

    async def revoke(db):
        member = await db.get(BusinessMember, (sample.business.id, sample.owner.id))
        if member is not None:
            await db.delete(member)
            await db.commit()

    _patch_lock_after(monkeypatch, revoke)
    with pytest.raises(HTTPException) as raised:
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
        )
    assert raised.value.status_code == 403
    await sample.db.refresh(draft)
    assert draft.status == "approved"
    if draft.media_plan is not None:
        assert draft.media_plan.get("seal") == seal


async def test_owner_deactivated_before_publication(sample, asset_dir, monkeypatch):
    draft, node, seal = await _approved_exportable(sample, monkeypatch, slug="yansi-inactive")

    async def deactivate(db):
        await db.execute(
            update(User)
            .where(User.id == sample.owner.id)
            .values(is_active=False)
            .execution_options(synchronize_session=False)
        )
        await db.commit()

    _patch_lock_after(monkeypatch, deactivate)
    with pytest.raises(HTTPException) as raised:
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
        )
    assert raised.value.status_code == 403
    await sample.db.refresh(draft)
    assert draft.status == "approved"


async def test_business_suspended_before_publication(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-suspend")

    async def suspend(db):
        await update_brand_verification(
            db, sample.business.id, verified=False, official=False, status="suspended",
        )

    _patch_lock_after(monkeypatch, suspend)
    with pytest.raises(HTTPException) as raised:
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
        )
    assert raised.value.status_code == 404
    await sample.db.refresh(draft)
    assert draft.status == "approved"


async def test_organization_archived_before_publication(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-org-arch")

    async def archive_org(db):
        await db.execute(
            update(Organization)
            .where(Organization.id == sample.business.id)
            .values(status="archived")
            .execution_options(synchronize_session=False)
        )
        await db.commit()

    _patch_lock_after(monkeypatch, archive_org)
    with pytest.raises(HTTPException) as raised:
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
        )
    assert raised.value.status_code == 404
    await sample.db.refresh(draft)
    assert draft.status == "approved"


async def test_brand_verification_revoked_before_publication(sample, asset_dir, monkeypatch):
    draft, node, seal = await _approved_exportable(sample, monkeypatch, slug="yansi-unverif")
    # Stale ORM still looks verified after concurrent revoke.
    sample.business.verified = True

    async def revoke_verified(db):
        await update_brand_verification(
            db, sample.business.id, verified=False, official=False, status="active",
        )

    _patch_lock_after(monkeypatch, revoke_verified)
    with pytest.raises(HTTPException) as raised:
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
        )
    assert raised.value.detail["code"] == "business_verification_required"
    await sample.db.refresh(draft)
    assert draft.status == "approved"
    if draft.media_plan is not None:
        assert draft.media_plan.get("seal") == seal
    assert await sample.db.get(BusinessPublication, (node.slug, node.journey_version)) is None


async def test_rejected_publication_leaves_seal_and_state_unchanged(sample, asset_dir, monkeypatch):
    draft, node, seal = await _approved_exportable(sample, monkeypatch, slug="yansi-reject-seal")
    before_rev = draft.revision

    async def demote(db):
        await _force_member_role(db, sample.business.id, sample.owner.id, "editor")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException):
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
        )
    await sample.db.refresh(draft)
    await sample.db.refresh(node)
    assert draft.status == "approved"
    assert draft.revision == before_rev
    assert node.visibility == "private"
    if draft.media_plan is not None:
        assert draft.media_plan.get("seal") == seal
        assert seal == media.media_seal(draft.media_plan)


# --- Editorial export ---


async def test_editorial_export_after_actor_downgrade(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Yayin yetkisi kaydi icin yeterince aciktir.")
    steps = _steps(knowledge)
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Yayin", "Yayin", steps)
    draft = await _approve(sample, draft)

    async def demote(db):
        await assign_member_role(db, sample.business.id, sample.owner.id, sample.editor.id, "viewer")

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, draft.id)
    assert raised.value.status_code == 403
    await sample.db.refresh(draft)
    assert draft.conversation_id is None


async def test_editorial_export_after_membership_revocation(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Yayin yetkisi kaydi icin yeterince aciktir.")
    steps = _steps(knowledge)
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Yayin", "Yayin", steps)
    draft = await _approve(sample, draft)

    async def revoke(db):
        member = await db.get(BusinessMember, (sample.business.id, sample.editor.id))
        if member is not None:
            await db.delete(member)
            await db.commit()

    _patch_lock_after(monkeypatch, revoke)
    with pytest.raises(HTTPException) as raised:
        await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, draft.id)
    assert raised.value.status_code == 403


def test_editorial_export_lock_ordering_is_business_first():
    text = (_BACKEND / "services/business_yansi/publication.py").read_text(encoding="utf-8")
    export = text.split("async def export_editorial_conversation", 1)[1].split("async def publish_draft", 1)[0]
    assert export.index("business_media_lock") < export.index("require_locked_actor")
    assert export.index("require_locked_actor") < export.index("draft_row")
    publish = text.split("async def publish_draft", 1)[1]
    assert publish.index("business_media_lock") < publish.index("require_locked_actor")
    assert publish.index("require_locked_actor") < publish.index("draft_row")
    assert "require_verified=True" in publish


# --- Knowledge writers ---


async def test_knowledge_creation_after_editor_downgrade(sample, monkeypatch):
    async def demote(db):
        # Direct role write — avoid assign_member_role which also calls require_locked_actor.
        await _force_member_role(db, sample.business.id, sample.editor.id, "viewer")

    _patch_require_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await svc.create_knowledge(
            sample.db, sample.business.id, sample.editor.id,
            {"title": "Yeni", "content": "Editor dusuruldukten sonra yazilamaz.", "source": "test", "publicAllowed": True},
        )
    assert raised.value.status_code == 403


async def test_knowledge_transition_after_membership_revocation(sample, monkeypatch):
    knowledge = await source(sample, content="Gecis once yayinlandi yeterince aciktir.")
    # Force a draft-like transition path: create private published, then try archive as owner path
    private = await svc.create_knowledge(
        sample.db, sample.business.id, sample.editor.id,
        {"title": "Ic", "content": "Ic not yeterince acik bir cumledir.", "source": "ops", "publicAllowed": False},
    )

    async def revoke(db):
        member = await db.get(BusinessMember, (sample.business.id, sample.owner.id))
        if member is not None:
            await db.delete(member)
            await db.commit()

    _patch_require_after(monkeypatch, revoke)
    with pytest.raises(HTTPException) as raised:
        await svc.transition_knowledge(
            sample.db, sample.business.id, sample.owner.id, private.id, "archived", private.revision,
        )
    assert raised.value.status_code == 403
    await sample.db.refresh(private)
    assert private.status == "published"


async def test_knowledge_deletion_after_user_deactivation(sample, monkeypatch):
    knowledge = await source(sample, content="Silme once yayinlandi yeterince aciktir.")

    async def deactivate(db):
        await db.execute(
            update(User)
            .where(User.id == sample.editor.id)
            .values(is_active=False)
            .execution_options(synchronize_session=False)
        )
        await db.commit()

    _patch_require_after(monkeypatch, deactivate)
    with pytest.raises(HTTPException) as raised:
        await svc.delete_knowledge(
            sample.db, sample.business.id, sample.editor.id, knowledge.id, knowledge.revision,
        )
    assert raised.value.status_code == 403
    await sample.db.refresh(knowledge)
    assert knowledge.status == "published"


async def test_cross_business_knowledge_mutation_rejected(sample):
    knowledge = await source(sample, content="Tenant siniri icin yeterince aciktir.")
    other = await svc.create_business(
        sample.db, sample.admin,
        {
            "organizationId": str(sample.other.id),
            "ownerId": str(sample.outsider.id),
            "slug": "baska-bilgi",
            "name": "Baska",
        },
    )
    with pytest.raises(HTTPException) as raised:
        await svc.delete_knowledge(
            sample.db, other.id, sample.outsider.id, knowledge.id, knowledge.revision,
        )
    assert raised.value.detail["code"] == "knowledge_not_found"
    await sample.db.refresh(knowledge)
    assert knowledge.status == "published"


async def test_dirty_knowledge_orm_preserved_across_locked_auth(sample):
    knowledge = await source(sample, content="Dirty alan korunur yeterince aciktir.")
    knowledge.title = "DirtyLocalKnowledgeTitle"
    async with media.business_media_lock(sample.db, sample.business.id):
        await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
        assert knowledge.title == "DirtyLocalKnowledgeTitle"
    await sample.db.rollback()


async def test_no_unintended_autoflush_during_knowledge_auth_read(sample):
    ghost = User(id=uuid.uuid4(), email=f"g-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
    sample.db.add(ghost)
    await sample.db.flush()
    pending = BusinessMember(business_id=sample.business.id, user_id=ghost.id, role="viewer")
    sample.db.add(pending)
    assert pending in sample.db.new
    with sample.db.no_autoflush:
        await sample.db.scalar(
            select(BusinessProfile.id).where(BusinessProfile.id == sample.business.id).with_for_update()
        )
        await require_locked_actor(sample.db, sample.business.id, sample.editor.id, "editor")
        assert pending in sample.db.new
    await sample.db.rollback()


async def test_successful_publish_still_works_after_reauth(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-ok")
    published = await publish_draft(
        sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
    )
    assert published.visibility == "public"
    await sample.db.refresh(draft)
    assert draft.status == "published"
