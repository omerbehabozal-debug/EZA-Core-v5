"""Implementation 2B-1B: Draft approval content integrity + Knowledge pending restore.

SQLite identity-map and controlled interleavings — not PostgreSQL overlapping proofs.
"""
from __future__ import annotations

import copy
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm.attributes import get_history

from backend.models.business_yansi import BusinessKnowledgeVersion as Knowledge
from backend.models.business_yansi import BusinessYansiDraft as Draft
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.publication import publish_draft
from backend.tests.test_business_publish_knowledge_auth import _approved_exportable
from backend.tests.brand_library_image_fixtures import distinct_library_png
from backend.tests.test_business_studio_media import _approve, _asset, _steps
from backend.tests.test_business_video_cover_policy import asset_dir, sample
from backend.tests.test_business_yansi import source

_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)
_BACKEND = Path(__file__).resolve().parents[1]
_DIRTY_TITLE = "DirtyPendingKnowledgeTitle"


async def _reviewable(sample, asset_dir):
    knowledge = await source(sample, content="Onay butunlugu icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True, image_bytes=distinct_library_png(b"2b1b"),
    )
    steps = _steps(knowledge, question="Onay nedir?")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Onay", "Onay", steps,
    )
    draft = await svc.transition_draft(
        sample.db, sample.business.id, sample.editor.id, draft.id, "review", draft.revision,
    )
    return draft, knowledge


def _unsupported_steps(knowledge):
    return [
        {
            "question": f"Kirli adim {index}?",
            "answer": "Bu cevap kaynakta yok ve desteklenmez.",
            "sources": [str(knowledge.id)],
        }
        for index in range(8)
    ]


async def _db_draft(sample, draft_id):
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        return await session_b.get(Draft, draft_id)


async def _db_knowledge(sample, version_id):
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        return await session_b.get(Knowledge, version_id)


# --- A–H: Draft approval / review freeze ---


async def test_a_dirty_steps_rejected_on_approval(sample, asset_dir):
    draft, knowledge = await _reviewable(sample, asset_dir)
    sample.db.autoflush = False
    try:
        before = draft.revision
        committed_steps = copy.deepcopy(draft.steps)
        draft.steps = _unsupported_steps(knowledge)
        assert get_history(draft, "steps").has_changes()
        with pytest.raises(HTTPException) as raised:
            await svc.transition_draft(
                sample.db, sample.business.id, sample.owner.id, draft.id, "approved", before,
            )
        assert raised.value.status_code == 409
        assert raised.value.detail["code"] == "revision_conflict"
        assert get_history(draft, "steps").has_changes()
        remote = await _db_draft(sample, draft.id)
        assert remote.status == "review"
        assert remote.revision == before
        assert remote.steps == committed_steps
        assert remote.approved_by is None
        assert not (isinstance(remote.media_plan, dict) and remote.media_plan.get("seal"))
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


async def test_b_dirty_knowledge_snapshot_rejected_on_approval(sample, asset_dir):
    draft, _ = await _reviewable(sample, asset_dir)
    sample.db.autoflush = False
    try:
        before = draft.revision
        committed = list(draft.knowledge_snapshot)
        draft.knowledge_snapshot = [str(uuid.uuid4())]
        assert get_history(draft, "knowledge_snapshot").has_changes()
        with pytest.raises(HTTPException) as raised:
            await svc.transition_draft(
                sample.db, sample.business.id, sample.owner.id, draft.id, "approved", before,
            )
        assert raised.value.detail["code"] == "revision_conflict"
        assert get_history(draft, "knowledge_snapshot").has_changes()
        remote = await _db_draft(sample, draft.id)
        assert remote.knowledge_snapshot == committed
        assert remote.status == "review"
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


async def test_c_dirty_source_hash_rejected_on_approval(sample, asset_dir):
    draft, _ = await _reviewable(sample, asset_dir)
    sample.db.autoflush = False
    try:
        before = draft.revision
        committed = draft.source_hash
        draft.source_hash = "0" * 64
        assert get_history(draft, "source_hash").has_changes()
        with pytest.raises(HTTPException) as raised:
            await svc.transition_draft(
                sample.db, sample.business.id, sample.owner.id, draft.id, "approved", before,
            )
        assert raised.value.detail["code"] == "revision_conflict"
        assert draft.source_hash == "0" * 64
        assert get_history(draft, "source_hash").has_changes()
        remote = await _db_draft(sample, draft.id)
        assert remote.source_hash == committed
        assert remote.status == "review"
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


async def test_d_dirty_title_summary_rejected_on_approval(sample, asset_dir):
    draft, _ = await _reviewable(sample, asset_dir)
    sample.db.autoflush = False
    try:
        before = draft.revision
        draft.title = "DirtyFreezeTitle"
        draft.summary = "DirtyFreezeSummary"
        assert get_history(draft, "title").has_changes()
        assert get_history(draft, "summary").has_changes()
        with pytest.raises(HTTPException) as raised:
            await svc.transition_draft(
                sample.db, sample.business.id, sample.owner.id, draft.id, "approved", before,
            )
        assert raised.value.detail["code"] == "revision_conflict"
        assert draft.title == "DirtyFreezeTitle"
        remote = await _db_draft(sample, draft.id)
        assert remote.title == "Onay"
        assert remote.status == "review"
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


async def test_e_approval_rejection_preserves_dirty_history(sample, asset_dir):
    draft, knowledge = await _reviewable(sample, asset_dir)
    sample.db.autoflush = False
    try:
        draft.steps = _unsupported_steps(knowledge)
        with pytest.raises(HTTPException):
            await svc.transition_draft(
                sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision,
            )
        assert get_history(draft, "steps").has_changes()
        assert draft.steps[0]["answer"] == "Bu cevap kaynakta yok ve desteklenmez."
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


async def test_f_approval_rejection_does_not_seal(sample, asset_dir):
    draft, knowledge = await _reviewable(sample, asset_dir)
    sample.db.autoflush = False
    try:
        before_plan = None if draft.media_plan is None else copy.deepcopy(draft.media_plan)
        draft.steps = _unsupported_steps(knowledge)
        with pytest.raises(HTTPException):
            await svc.transition_draft(
                sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision,
            )
        remote = await _db_draft(sample, draft.id)
        assert remote.status == "review"
        assert remote.approved_by is None
        assert remote.media_plan == before_plan
        if isinstance(remote.media_plan, dict):
            assert remote.media_plan.get("seal") in (None, before_plan.get("seal"))
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


async def test_g_successful_approval_persists_authoritative_snapshot_only(sample, asset_dir):
    draft, knowledge = await _reviewable(sample, asset_dir)
    before = draft.revision
    committed_steps = copy.deepcopy(draft.steps)
    committed_hash = draft.source_hash
    committed_snapshot = list(draft.knowledge_snapshot)
    approved = await svc.transition_draft(
        sample.db, sample.business.id, sample.owner.id, draft.id, "approved", before,
    )
    assert approved.status == "approved"
    remote = await _db_draft(sample, draft.id)
    assert remote.status == "approved"
    assert remote.steps == committed_steps
    assert remote.source_hash == committed_hash
    assert remote.knowledge_snapshot == committed_snapshot
    assert remote.approved_by == sample.owner.id
    if remote.media_plan is not None:
        assert remote.media_plan.get("seal") == media.media_seal(remote.media_plan)


async def test_h_review_rejects_unvalidated_pending_steps(sample, asset_dir):
    knowledge = await source(sample, content="Review freeze icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True, image_bytes=distinct_library_png(b"rev"),
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Review", "Review", _steps(knowledge),
    )
    sample.db.autoflush = False
    try:
        before = draft.revision
        committed = copy.deepcopy(draft.steps)
        draft.steps = _unsupported_steps(knowledge)
        with pytest.raises(HTTPException) as raised:
            await svc.transition_draft(
                sample.db, sample.business.id, sample.editor.id, draft.id, "review", before,
            )
        assert raised.value.detail["code"] == "revision_conflict"
        remote = await _db_draft(sample, draft.id)
        assert remote.status == "draft"
        assert remote.steps == committed
        assert get_history(draft, "steps").has_changes()
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


# --- I–L: Knowledge pending restore + lifecycle ---


async def test_i_successful_transition_preserves_pending_title(sample):
    knowledge = await source(sample, content="Gecis pending title icin yeterince aciktir.")
    committed_title = knowledge.title
    knowledge.title = _DIRTY_TITLE
    assert get_history(knowledge, "title").has_changes()
    before = knowledge.revision
    updated = await svc.transition_knowledge(
        sample.db, sample.business.id, sample.owner.id, knowledge.id, "archived", before,
    )
    assert updated.status == "archived"
    assert updated.title == _DIRTY_TITLE
    assert get_history(updated, "title").has_changes()
    remote = await _db_knowledge(sample, knowledge.id)
    assert remote.title == committed_title
    assert remote.status == "archived"
    assert remote.revision == before + 1


async def test_j_successful_delete_preserves_pending_title(sample):
    knowledge = await source(sample, content="Silme pending title icin yeterince aciktir.")
    committed_title = knowledge.title
    knowledge.title = _DIRTY_TITLE
    before = knowledge.revision
    deleted = await svc.delete_knowledge(
        sample.db, sample.business.id, sample.editor.id, knowledge.id, before,
    )
    assert deleted.status == "archived"
    assert deleted.title == _DIRTY_TITLE
    assert get_history(deleted, "title").has_changes()
    remote = await _db_knowledge(sample, knowledge.id)
    assert remote.title == committed_title
    assert remote.revision == before + 1


async def test_k_knowledge_lifecycle_does_not_persist_unrelated_pending_title(sample):
    knowledge = await source(sample, content="Unrelated pending yazilmaz yeterince aciktir.")
    committed_title = knowledge.title
    knowledge.title = _DIRTY_TITLE
    await svc.transition_knowledge(
        sample.db, sample.business.id, sample.owner.id, knowledge.id, "archived", knowledge.revision,
    )
    remote = await _db_knowledge(sample, knowledge.id)
    assert remote.title == committed_title


async def test_l_stale_knowledge_revision_still_409(sample):
    knowledge = await source(sample, content="Stale revision 2b1b icin yeterince aciktir.")
    stale = await sample.db.get(Knowledge, knowledge.id)
    r = stale.revision
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        remote = await session_b.get(Knowledge, knowledge.id)
        remote.status = "archived"
        remote.revision = r + 1
        await session_b.commit()
    with pytest.raises(HTTPException) as raised:
        await svc.transition_knowledge(
            sample.db, sample.business.id, sample.owner.id, stale.id, "archived", r,
        )
    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "revision_conflict"
    assert stale.status == "published"
    assert stale.revision == r


# --- M–P: prior regressions, auth, autoflush, reject hygiene ---


async def test_m_publication_dirty_draft_title_still_parked(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1b-pub")
    committed = draft.title
    draft.title = "DirtyPendingDraftTitle"
    await publish_draft(
        sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision,
    )
    assert draft.title == "DirtyPendingDraftTitle"
    assert get_history(draft, "title").has_changes()
    remote = await _db_draft(sample, draft.id)
    assert remote.title == committed
    assert remote.status == "published"


async def test_n_cross_business_and_seal_protections(sample, asset_dir, monkeypatch):
    draft, node, seal = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1b-seal")
    draft_id = draft.id
    knowledge = await source(sample, content="Tenant siniri 2b1b icin yeterince aciktir.")
    other = await svc.create_business(
        sample.db, sample.admin,
        {
            "organizationId": str(sample.other.id),
            "ownerId": str(sample.outsider.id),
            "slug": "baska-2b1b",
            "name": "Baska",
        },
    )
    with pytest.raises(HTTPException) as raised:
        await svc.delete_knowledge(
            sample.db, other.id, sample.outsider.id, knowledge.id, knowledge.revision,
        )
    assert raised.value.detail["code"] == "knowledge_not_found"
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "approved"
    if seal is not None:
        assert remote.media_plan.get("seal") == seal
    await sample.db.refresh(knowledge)
    assert knowledge.status == "published"


async def test_o_autoflush_true_reject_dirty_approval(sample, asset_dir):
    draft, knowledge = await _reviewable(sample, asset_dir)
    assert sample.db.autoflush is True
    draft.steps = _unsupported_steps(knowledge)
    with pytest.raises(HTTPException) as raised:
        await svc.transition_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision,
        )
    assert raised.value.detail["code"] == "revision_conflict"
    assert get_history(draft, "steps").has_changes()
    await sample.db.rollback()


async def test_o2_autoflush_false_reject_dirty_approval(sample, asset_dir):
    draft, knowledge = await _reviewable(sample, asset_dir)
    sample.db.autoflush = False
    try:
        draft.steps = _unsupported_steps(knowledge)
        with pytest.raises(HTTPException) as raised:
            await svc.transition_draft(
                sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision,
            )
        assert raised.value.detail["code"] == "revision_conflict"
        assert get_history(draft, "steps").has_changes()
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


async def test_p_rejected_ops_leave_no_unintended_mutation(sample, asset_dir):
    draft, knowledge = await _reviewable(sample, asset_dir)
    draft_id = draft.id
    business_id = sample.business.id
    owner_id = sample.owner.id
    editor_id = sample.editor.id
    before = draft.revision
    draft.steps = _unsupported_steps(knowledge)
    with pytest.raises(HTTPException):
        await svc.transition_draft(
            sample.db, business_id, owner_id, draft_id, "approved", before,
        )
    await sample.db.rollback()
    remote = await _db_draft(sample, draft_id)
    assert remote.revision == before
    assert remote.status == "review"
    assert remote.approved_by is None

    knowledge = await svc.create_knowledge(
        sample.db,
        business_id,
        owner_id,
        {
            "title": "Yansi nedir",
            "content": "Reject knowledge icin yeterince aciktir.",
            "source": "Dogrulanmis uygulama akisi",
            "publicAllowed": True,
        },
    )
    knowledge_id = knowledge.id
    before_k = knowledge.revision
    knowledge.title = _DIRTY_TITLE
    with pytest.raises(HTTPException):
        await svc.delete_knowledge(
            sample.db, business_id, editor_id, knowledge_id, before_k - 1,
        )
    assert knowledge.title == _DIRTY_TITLE
    assert get_history(knowledge, "title").has_changes()
    await sample.db.rollback()
    remote_k = await _db_knowledge(sample, knowledge_id)
    assert remote_k.status == "published"
    assert remote_k.revision == before_k


def test_lock_order_and_freeze_policy_in_source():
    text = (_BACKEND / "services/business_yansi/service.py").read_text(encoding="utf-8")
    transition = text.split("async def transition_draft", 1)[1].split("async def revise_draft", 1)[0]
    assert transition.index("business_media_lock") < transition.index("require_locked_access")
    assert transition.index("require_locked_access") < transition.index("draft_decision")
    assert "assert_no_pending_draft_freeze_content" in transition
    assert transition.index("assert_no_pending_draft_freeze_content") < transition.index('target == "approved"')
    freeze = text.split("_DRAFT_FREEZE_CONTENT_ATTRS", 1)[1].split("_KNOWLEDGE_CONTENT_ATTRS", 1)[0]
    for field in (
        "title", "summary", "steps", "knowledge_snapshot", "source_hash",
        "media_plan", "created_by", "conversation_id",
    ):
        assert f'"{field}"' in freeze
    knowledge = text.split("async def transition_knowledge", 1)[1].split("async def delete_knowledge", 1)[0]
    # Success-path restore must follow the last refresh (except-path restore may appear earlier).
    assert knowledge.rfind("restore_dirty_knowledge_content") > knowledge.rfind("await db.refresh(row)")


async def test_approval_reject_does_not_commit_unrelated_user_dirty(sample, asset_dir):
    """Rejection path must not flush unrelated pending User changes."""
    from backend.models.production import User

    draft, knowledge = await _reviewable(sample, asset_dir)
    owner_id = sample.owner.id
    original_email = sample.owner.email
    sample.owner.email = f"dirty-{uuid.uuid4().hex[:8]}@example.test"
    assert get_history(sample.owner, "email").has_changes()
    draft.steps = _unsupported_steps(knowledge)
    with pytest.raises(HTTPException) as raised:
        await svc.transition_draft(
            sample.db, sample.business.id, owner_id, draft.id, "approved", draft.revision,
        )
    assert raised.value.detail["code"] == "revision_conflict"
    await sample.db.rollback()
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        remote_user = await session_b.get(User, owner_id)
    assert remote_user.email == original_email


async def test_successful_approval_can_flush_unrelated_user_dirty_preexisting(sample, asset_dir):
    """Documented residual: service commit flushes the whole session (pre-existing)."""
    from backend.models.production import User

    draft, _ = await _reviewable(sample, asset_dir)
    owner_id = sample.owner.id
    dirty_email = f"flushed-{uuid.uuid4().hex[:8]}@example.test"
    sample.owner.email = dirty_email
    await svc.transition_draft(
        sample.db, sample.business.id, owner_id, draft.id, "approved", draft.revision,
    )
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        remote_user = await session_b.get(User, owner_id)
    assert remote_user.email == dirty_email
    # Restore fixture email for later tests in this process if any share DB — isolated per fixture.


async def test_knowledge_commit_failure_restores_pending_title(sample):
    knowledge = await source(sample, content="Commit fail restore icin yeterince aciktir.")
    knowledge_id = knowledge.id
    committed = knowledge.title
    knowledge.title = _DIRTY_TITLE
    before = knowledge.revision
    real_commit = sample.db.commit

    async def boom():
        raise RuntimeError("forced_knowledge_commit_failure")

    sample.db.commit = boom
    try:
        with pytest.raises(RuntimeError, match="forced_knowledge_commit_failure"):
            await svc.transition_knowledge(
                sample.db, sample.business.id, sample.owner.id, knowledge_id, "archived", before,
            )
    finally:
        sample.db.commit = real_commit
    assert knowledge.title == _DIRTY_TITLE
    assert get_history(knowledge, "title").has_changes()
    await sample.db.rollback()
    remote = await _db_knowledge(sample, knowledge_id)
    assert remote.title == committed
    assert remote.status == "published"
    assert remote.revision == before


async def test_knowledge_index_failure_after_commit_still_restores_pending(sample, monkeypatch):
    knowledge = await source(sample, content="Index fail restore icin yeterince aciktir.")
    committed = knowledge.title
    knowledge.title = _DIRTY_TITLE
    before = knowledge.revision

    async def boom_sync(db, versions):
        raise RuntimeError("forced_index_failure")

    monkeypatch.setattr(svc, "_sync_knowledge_index", boom_sync)
    with pytest.raises(RuntimeError, match="forced_index_failure"):
        await svc.transition_knowledge(
            sample.db, sample.business.id, sample.owner.id, knowledge.id, "archived", before,
        )
    # Commit already succeeded; pending title must be restored onto the ORM after the failed index.
    assert knowledge.title == _DIRTY_TITLE
    assert get_history(knowledge, "title").has_changes()
    remote = await _db_knowledge(sample, knowledge.id)
    assert remote.status == "archived"
    assert remote.revision == before + 1
    assert remote.title == committed
    # Failed post-commit work does not make the transaction reusable — caller rollback.
    await sample.db.rollback()
