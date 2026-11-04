"""Implementation 2B-1A: Draft dirty-state + Knowledge revision integrity.

Controlled SQLite interleavings — not PostgreSQL overlapping-transaction proofs.
Policy A: authoritative decisions use projected DB snapshots; caller-owned dirty ORM
attributes and SQLAlchemy history are preserved (not silently cleared via lock writeback).
"""
from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm.attributes import get_history

from backend.models.business_yansi import BusinessMember
from backend.models.business_yansi import BusinessKnowledgeVersion as Knowledge
from backend.models.business_yansi import BusinessPublication, BusinessYansiDraft as Draft
from backend.models.production import User
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.tests.test_business_publish_knowledge_auth import _approved_exportable, _patch_lock_after
from backend.tests.test_business_studio_media import _approve, _asset, _steps
from backend.tests.test_business_video_cover_policy import asset_dir, sample
from backend.tests.test_business_yansi import source

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
_BACKEND = Path(__file__).resolve().parents[1]
_DIRTY_TITLE = "DirtyPendingDraftTitle"


def _assert_dirty_title(draft, expected=_DIRTY_TITLE):
    assert draft.title == expected
    assert get_history(draft, "title").has_changes()


# --- A–C: Draft dirty-state Codex reproductions ---


async def test_a_successful_publish_preserves_dirty_draft_title(sample, asset_dir, monkeypatch):
    draft, node, seal = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1a-ok")
    committed_title = draft.title
    draft.title = _DIRTY_TITLE
    _assert_dirty_title(draft)

    published = await publish_draft(
        sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
    )
    assert published.visibility == "public"
    _assert_dirty_title(draft)

    await sample.db.refresh(draft)
    assert draft.status == "published"
    assert draft.title == committed_title
    pub = await sample.db.get(BusinessPublication, (node.slug, node.journey_version))
    assert pub is not None
    if seal is not None:
        assert draft.media_plan is not None
        assert draft.media_plan.get("seal") == seal
        assert seal == media.media_seal(draft.media_plan)


async def test_b_rejected_publish_wrong_revision_preserves_dirty_title(sample, asset_dir, monkeypatch):
    draft, node, seal = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1a-badrev")
    before_rev = draft.revision
    draft.title = _DIRTY_TITLE
    _assert_dirty_title(draft)

    with pytest.raises(HTTPException) as raised:
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, before_rev - 1,
        )
    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "approved_editorial_source_required"
    _assert_dirty_title(draft)
    await sample.db.refresh(draft)
    assert draft.status == "approved"
    assert draft.revision == before_rev
    assert draft.title != _DIRTY_TITLE
    assert await sample.db.get(BusinessPublication, (node.slug, node.journey_version)) is None
    if seal is not None:
        assert draft.media_plan.get("seal") == seal


async def test_c_existing_conversation_export_preserves_dirty_title(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Yayin yetkisi kaydi icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True, image_bytes=_PNG + b"2b1a-c",
    )
    steps = _steps(knowledge, question="Yayin nedir?")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Yayin", "Yayin", steps,
    )
    draft = await _approve(sample, draft)
    first = await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, draft.id)
    await sample.db.refresh(draft)
    committed_title = draft.title
    assert draft.conversation_id is not None

    draft.title = _DIRTY_TITLE
    _assert_dirty_title(draft)
    second = await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, draft.id)
    assert second == first
    _assert_dirty_title(draft)
    await sample.db.refresh(draft)
    assert draft.title == committed_title


# --- D–E: Knowledge stale revision (two-session SQLite interleaving) ---


async def test_d_two_session_stale_revision_transition_conflict(sample):
    knowledge = await source(sample, content="Gecis revizyonu icin yeterince aciktir.")
    stale = await sample.db.get(Knowledge, knowledge.id)
    r = stale.revision
    assert stale.status == "published"

    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        remote = await session_b.get(Knowledge, knowledge.id)
        remote.status = "archived"
        remote.revision = r + 1
        await session_b.commit()

    assert stale.revision == r
    assert stale.status == "published"

    with pytest.raises(HTTPException) as raised:
        await svc.transition_knowledge(
            sample.db, sample.business.id, sample.owner.id, stale.id, "archived", r,
        )
    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "revision_conflict"
    assert stale.revision == r
    assert stale.status == "published"

    fresh = await sample.db.get(Knowledge, knowledge.id)
    # Identity map still holds Session A object; reload via core projection.
    snap = await svc._knowledge_writer_snapshot(sample.db, sample.business.id, knowledge.id, lock=False)
    assert snap.revision == r + 1
    assert snap.status == "archived"


async def test_e_two_session_stale_revision_delete_conflict(sample):
    knowledge = await source(sample, content="Silme revizyonu icin yeterince aciktir.")
    stale = await sample.db.get(Knowledge, knowledge.id)
    r = stale.revision

    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        remote = await session_b.get(Knowledge, knowledge.id)
        remote.status = "archived"
        remote.revision = r + 1
        await session_b.commit()

    with pytest.raises(HTTPException) as raised:
        await svc.delete_knowledge(sample.db, sample.business.id, sample.editor.id, stale.id, r)
    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "revision_conflict"
    assert stale.status == "published"
    assert stale.revision == r


# --- F–G: Dirty Knowledge + stale status ---


async def test_f_dirty_knowledge_title_preserved_on_revision_conflict(sample):
    knowledge = await source(sample, content="Dirty bilgi alani icin yeterince aciktir.")
    knowledge.title = "DirtyLocalKnowledgeTitle"
    assert get_history(knowledge, "title").has_changes()
    with pytest.raises(HTTPException) as raised:
        await svc.transition_knowledge(
            sample.db, sample.business.id, sample.owner.id, knowledge.id, "archived", knowledge.revision - 1,
        )
    assert raised.value.detail["code"] == "revision_conflict"
    assert knowledge.title == "DirtyLocalKnowledgeTitle"
    assert get_history(knowledge, "title").has_changes()
    await sample.db.rollback()


async def test_g_stale_orm_status_cannot_authorize_invalid_transition(sample):
    knowledge = await source(sample, content="Status freshness icin yeterince aciktir.")
    committed_rev = knowledge.revision
    # Lie: ORM looks like draft (would allow approve), DB remains published.
    knowledge.status = "draft"
    assert get_history(knowledge, "status").has_changes()

    with pytest.raises(HTTPException) as raised:
        await svc.transition_knowledge(
            sample.db, sample.business.id, sample.owner.id, knowledge.id, "approved", committed_rev,
        )
    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "invalid_transition"
    assert knowledge.status == "draft"
    snap = await svc._knowledge_writer_snapshot(sample.db, sample.business.id, knowledge.id, lock=False)
    assert snap.status == "published"
    await sample.db.rollback()


# --- H–I: Autoflush boundaries ---


async def test_h_no_unintended_autoflush_with_autoflush_false(sample):
    knowledge = await source(sample, content="Autoflush false icin yeterince aciktir.")
    sample.db.autoflush = False
    try:
        ghost = User(id=uuid.uuid4(), email=f"h-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
        sample.db.add(ghost)
        await sample.db.flush()
        pending = BusinessMember(business_id=sample.business.id, user_id=ghost.id, role="viewer")
        sample.db.add(pending)
        assert pending in sample.db.new
        with pytest.raises(HTTPException):
            await svc.transition_knowledge(
                sample.db, sample.business.id, sample.owner.id, knowledge.id, "archived", knowledge.revision - 1,
            )
        assert pending in sample.db.new
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


async def test_i_no_unintended_autoflush_with_autoflush_true(sample):
    knowledge = await source(sample, content="Autoflush true icin yeterince aciktir.")
    assert sample.db.autoflush is True
    ghost = User(id=uuid.uuid4(), email=f"i-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
    sample.db.add(ghost)
    await sample.db.flush()
    pending = BusinessMember(business_id=sample.business.id, user_id=ghost.id, role="viewer")
    sample.db.add(pending)
    assert pending in sample.db.new
    # No outer no_autoflush — writers must protect authoritative lock/read themselves.
    with pytest.raises(HTTPException):
        await svc.delete_knowledge(
            sample.db, sample.business.id, sample.editor.id, knowledge.id, knowledge.revision - 1,
        )
    assert pending in sample.db.new
    await sample.db.rollback()


# --- J–N: Auth, isolation, contracts, seals, F1/F2/F3 lock order ---


async def test_j_post_lock_actor_demotion_still_enforced(sample, asset_dir, monkeypatch):
    draft, node, seal = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1a-demote")
    draft.title = _DIRTY_TITLE
    _assert_dirty_title(draft)

    async def demote(_db):
        # Separate session so the demotion commit cannot flush Session A's dirty Draft.
        async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
            await session_b.execute(
                update(BusinessMember)
                .where(
                    BusinessMember.business_id == sample.business.id,
                    BusinessMember.user_id == sample.owner.id,
                )
                .values(role="viewer")
                .execution_options(synchronize_session=False)
            )
            await session_b.commit()

    _patch_lock_after(monkeypatch, demote)
    with pytest.raises(HTTPException) as raised:
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
        )
    assert raised.value.status_code == 403
    _assert_dirty_title(draft)
    await sample.db.rollback()
    await sample.db.refresh(draft)
    assert draft.status == "approved"
    if seal is not None:
        assert draft.media_plan.get("seal") == seal


async def test_k_cross_business_knowledge_mutation_rejected(sample):
    knowledge = await source(sample, content="Tenant siniri 2b1a icin yeterince aciktir.")
    other = await svc.create_business(
        sample.db, sample.admin,
        {
            "organizationId": str(sample.other.id),
            "ownerId": str(sample.outsider.id),
            "slug": "baska-2b1a",
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


async def test_l_publication_error_contracts_compatible(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1a-contract")
    with pytest.raises(HTTPException) as raised:
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision - 1,
        )
    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "approved_editorial_source_required"

    knowledge = await source(sample, content="Sozlesme kodlari icin yeterince aciktir.")
    steps = _steps(knowledge)
    bare = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Taslak", "Taslak", steps)
    with pytest.raises(HTTPException) as export_raised:
        await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, bare.id)
    assert export_raised.value.status_code == 409
    assert export_raised.value.detail["code"] == "draft_approval_required"


async def test_m_f1_f2_f3_lock_and_decision_protections_intact():
    """F1 Business-first lock, F2 draft_decision (no lock writeback), F3 Knowledge projected revision."""
    pub = (_BACKEND / "services/business_yansi/publication.py").read_text(encoding="utf-8")
    svc_text = (_BACKEND / "services/business_yansi/service.py").read_text(encoding="utf-8")
    # F1: Business → actor → draft_decision
    publish = pub.split("async def publish_draft", 1)[1]
    assert publish.index("business_media_lock") < publish.index("require_locked_actor")
    assert publish.index("require_locked_actor") < publish.index("draft_decision")
    # F2: no destructive lock writeback helpers on decision path
    assert "populate_existing" not in publish
    assert "Policy A" in pub
    # F3: Knowledge writers use projected snapshot + revision_conflict
    assert "async def _knowledge_writer_snapshot" in svc_text
    assert "_knowledge_writer_snapshot" in svc_text.split("async def transition_knowledge", 1)[1].split(
        "async def delete_knowledge", 1
    )[0]
    assert "_knowledge_writer_snapshot" in svc_text.split("async def delete_knowledge", 1)[1].split(
        "async def published_knowledge", 1
    )[0]
    assert "revision_conflict" in svc_text.split("async def transition_knowledge", 1)[1]


async def test_n_approved_published_seals_unchanged_on_dirty_reject(sample, asset_dir, monkeypatch):
    draft, node, seal = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1a-seal")
    before_plan = None if draft.media_plan is None else dict(draft.media_plan)
    draft.title = _DIRTY_TITLE
    with pytest.raises(HTTPException):
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision - 1,
        )
    await sample.db.refresh(draft)
    assert draft.status == "approved"
    assert draft.media_plan == before_plan
    if seal is not None:
        assert draft.media_plan.get("seal") == seal
        assert seal == media.media_seal(draft.media_plan)
    assert await sample.db.get(BusinessPublication, (node.slug, node.journey_version)) is None


async def test_draft_decision_ignores_unflushed_dirty_revision(sample, asset_dir, monkeypatch):
    draft, _, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1a-snap")
    committed = draft.revision
    async with media.business_media_lock(sample.db, sample.business.id):
        draft.revision = 50
        draft.title = _DIRTY_TITLE
        snap = await svc.draft_decision(sample.db, sample.business.id, draft.id, lock=True)
        assert snap.revision == committed
        assert snap.title == "Yayin"
        assert draft.revision == 50
        _assert_dirty_title(draft)
    await sample.db.rollback()


# --- Park/restore transaction lifecycle (history + DB state) ---


async def test_d_flush_failure_after_park_restores_dirty_history(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Flush hatasi icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True, image_bytes=_PNG + b"flush",
    )
    steps = _steps(knowledge, question="Flush?")
    draft = await svc.create_draft(sample.db, sample.business.id, sample.editor.id, "Yayin", "Yayin", steps)
    draft = await _approve(sample, draft)
    committed_title = draft.title
    draft.title = _DIRTY_TITLE
    _assert_dirty_title(draft)

    real_flush = sample.db.flush

    async def boom_flush(*args, **kwargs):
        raise RuntimeError("forced_flush_failure")

    monkeypatch.setattr(sample.db, "flush", boom_flush)
    with pytest.raises(RuntimeError, match="forced_flush_failure"):
        await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, draft.id)
    monkeypatch.setattr(sample.db, "flush", real_flush)

    _assert_dirty_title(draft)
    await sample.db.rollback()
    await sample.db.refresh(draft)
    assert draft.title == committed_title
    assert draft.conversation_id is None


async def test_e_commit_failure_after_park_restores_dirty_without_persisting(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1a-commit-fail")
    committed_title = draft.title
    before_rev = draft.revision
    pub_key = (node.slug, node.journey_version)
    draft.title = _DIRTY_TITLE
    _assert_dirty_title(draft)

    real_commit = sample.db.commit

    async def boom_commit():
        raise RuntimeError("forced_commit_failure")

    monkeypatch.setattr(sample.db, "commit", boom_commit)
    with pytest.raises(RuntimeError, match="forced_commit_failure"):
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, pub_key[0], before_rev,
        )
    monkeypatch.setattr(sample.db, "commit", real_commit)

    _assert_dirty_title(draft)
    await sample.db.rollback()
    await sample.db.refresh(draft)
    assert draft.title == committed_title
    assert draft.status == "approved"
    assert draft.revision == before_rev
    assert await sample.db.get(BusinessPublication, pub_key) is None


async def test_f_explicit_rollback_after_reject_keeps_db_authoritative(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1a-rollback")
    committed_title = draft.title
    draft.title = _DIRTY_TITLE
    _assert_dirty_title(draft)
    with pytest.raises(HTTPException):
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision - 1,
        )
    _assert_dirty_title(draft)
    await sample.db.rollback()
    await sample.db.refresh(draft)
    assert draft.title == committed_title
    assert get_history(draft, "title").has_changes() is False
    assert draft.status == "approved"


async def test_g_h_second_flush_and_commit_after_restore_persist_pending(sample, asset_dir, monkeypatch):
    """Policy A: after successful publish, restored dirty title is pending again.

    A later caller flush/commit intentionally persists it — not a silent publish during
    the publication transaction itself.
    """
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1a-second")
    committed_title = draft.title
    draft_id = draft.id
    draft.title = _DIRTY_TITLE
    await publish_draft(
        sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
    )
    _assert_dirty_title(draft)
    # Separate session reads the true committed row, not Session A's identity map.
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        title_in_db = (await session_b.execute(select(Draft.title).where(Draft.id == draft_id))).scalar_one()
    assert title_in_db == committed_title

    await sample.db.flush()
    await sample.db.commit()
    assert get_history(draft, "title").has_changes() is False
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        title_after_second_commit = (
            await session_b.execute(select(Draft.title).where(Draft.id == draft_id))
        ).scalar_one()
    assert title_after_second_commit == _DIRTY_TITLE
    assert draft.title == _DIRTY_TITLE


async def test_i_refresh_after_restore_loads_authoritative_db_title(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1a-refresh")
    committed_title = draft.title
    draft.title = _DIRTY_TITLE
    await publish_draft(
        sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
    )
    _assert_dirty_title(draft)
    await sample.db.refresh(draft)
    assert draft.title == committed_title
    assert get_history(draft, "title").has_changes() is False
    assert draft.status == "published"


async def test_j_unrelated_dirty_summary_survives_rejected_publish(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1a-summary")
    draft.summary = "DirtyPendingSummary"
    assert get_history(draft, "summary").has_changes()
    with pytest.raises(HTTPException):
        await publish_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision - 1,
        )
    assert draft.summary == "DirtyPendingSummary"
    assert get_history(draft, "summary").has_changes()
    await sample.db.rollback()


async def test_pending_membership_does_not_authorize_with_autoflush_true(sample):
    knowledge = await source(sample, content="Pending uyelik yetki vermez yeterince aciktir.")
    ghost = User(id=uuid.uuid4(), email=f"auth-{uuid.uuid4().hex[:8]}@example.test", role="user", is_active=True)
    sample.db.add(ghost)
    await sample.db.flush()
    # Pending owner-looking membership must not authorize via autoflush into auth reads.
    sample.db.add(BusinessMember(business_id=sample.business.id, user_id=ghost.id, role="owner"))
    assert sample.db.autoflush is True
    with pytest.raises(HTTPException) as raised:
        await svc.transition_knowledge(
            sample.db, sample.business.id, ghost.id, knowledge.id, "archived", knowledge.revision,
        )
    assert raised.value.status_code in {403, 404}
    await sample.db.rollback()
