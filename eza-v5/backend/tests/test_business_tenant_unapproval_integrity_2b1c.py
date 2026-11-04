"""Implementation 2B-1C: Draft tenant identity freeze + unapproval restore on refresh failure.

SQLite identity-map checks — not PostgreSQL overlapping-transaction proofs.
"""
from __future__ import annotations

import copy
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm.attributes import get_history

from backend.models.business_yansi import BusinessYansiDraft as Draft
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.tests.test_business_studio_media import _approve, _asset, _steps
from backend.tests.test_business_video_cover_policy import asset_dir, sample
from backend.tests.test_business_yansi import source

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
_BACKEND = Path(__file__).resolve().parents[1]
_DIRTY_TITLE = "DirtyPendingUnapproveTitle"


async def _reviewable(sample, asset_dir):
    knowledge = await source(sample, content="Tenant kimlik freeze icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True,
        image_bytes=_PNG + b"2b1c",
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Tenant", "Tenant", _steps(knowledge),
    )
    draft = await svc.transition_draft(
        sample.db, sample.business.id, sample.editor.id, draft.id, "review", draft.revision,
    )
    return draft, knowledge


async def _db_draft(sample, draft_id):
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        return await session_b.get(Draft, draft_id)


# --- A–G: Tenant identity freeze ---


async def test_a_dirty_business_id_rejected_on_approval(sample, asset_dir):
    draft, _ = await _reviewable(sample, asset_dir)
    draft_id = draft.id
    before = draft.revision
    other = await svc.create_business(
        sample.db, sample.admin,
        {
            "organizationId": str(sample.other.id),
            "ownerId": str(sample.outsider.id),
            "slug": "baska-2b1c",
            "name": "Baska",
        },
    )
    other_id = other.id
    sample.db.autoflush = False
    try:
        draft.business_id = other_id
        assert get_history(draft, "business_id").has_changes()
        with pytest.raises(HTTPException) as raised:
            await svc.transition_draft(
                sample.db, sample.business.id, sample.owner.id, draft_id, "approved", before,
            )
        assert raised.value.status_code == 409
        assert raised.value.detail["code"] == "revision_conflict"
        assert draft.business_id == other_id
        assert get_history(draft, "business_id").has_changes()
        remote = await _db_draft(sample, draft_id)
        assert remote.business_id == sample.business.id
        assert remote.status == "review"
        assert remote.approved_by is None
        assert not (isinstance(remote.media_plan, dict) and remote.media_plan.get("seal"))
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


async def test_b_dirty_draft_id_rejected_on_approval(sample, asset_dir):
    """Safe identity-map scenario: pending primary-key assignment must not approve."""
    draft, _ = await _reviewable(sample, asset_dir)
    draft_id = draft.id
    before = draft.revision
    forged = uuid.uuid4()
    sample.db.autoflush = False
    try:
        draft.id = forged
        assert get_history(draft, "id").has_changes()
        with pytest.raises(HTTPException) as raised:
            await svc.transition_draft(
                sample.db, sample.business.id, sample.owner.id, draft_id, "approved", before,
            )
        assert raised.value.detail["code"] == "revision_conflict"
        assert draft.id == forged
        assert get_history(draft, "id").has_changes()
        remote = await _db_draft(sample, draft_id)
        assert remote.id == draft_id
        assert remote.status == "review"
        assert remote.business_id == sample.business.id
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


async def test_c_dirty_tenant_identity_rejected_on_review(sample, asset_dir):
    knowledge = await source(sample, content="Review tenant freeze icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True,
        image_bytes=_PNG + b"revc",
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Review", "Review", _steps(knowledge),
    )
    draft_id = draft.id
    before = draft.revision
    other = await svc.create_business(
        sample.db, sample.admin,
        {
            "organizationId": str(sample.other.id),
            "ownerId": str(sample.outsider.id),
            "slug": "review-2b1c",
            "name": "ReviewB",
        },
    )
    draft.business_id = other.id
    with pytest.raises(HTTPException) as raised:
        await svc.transition_draft(
            sample.db, sample.business.id, sample.editor.id, draft_id, "review", before,
        )
    assert raised.value.detail["code"] == "revision_conflict"
    assert get_history(draft, "business_id").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "draft"
    assert remote.business_id == sample.business.id
    await sample.db.rollback()


async def test_d_e_f_identity_conflict_preserves_history_db_and_no_seal(sample, asset_dir):
    draft, _ = await _reviewable(sample, asset_dir)
    draft_id = draft.id
    before = draft.revision
    before_plan = None if draft.media_plan is None else copy.deepcopy(draft.media_plan)
    other = await svc.create_business(
        sample.db, sample.admin,
        {
            "organizationId": str(sample.other.id),
            "ownerId": str(sample.outsider.id),
            "slug": "def-2b1c",
            "name": "Def",
        },
    )
    draft.business_id = other.id
    with pytest.raises(HTTPException):
        await svc.transition_draft(
            sample.db, sample.business.id, sample.owner.id, draft_id, "approved", before,
        )
    assert draft.business_id == other.id
    assert get_history(draft, "business_id").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.business_id == sample.business.id
    assert remote.status == "review"
    assert remote.revision == before
    assert remote.approved_by is None
    assert remote.media_plan == before_plan
    await sample.db.rollback()


async def test_g_clean_approval_retains_tenant_ownership(sample, asset_dir):
    draft, _ = await _reviewable(sample, asset_dir)
    draft_id = draft.id
    business_id = sample.business.id
    approved = await svc.transition_draft(
        sample.db, business_id, sample.owner.id, draft_id, "approved", draft.revision,
    )
    assert approved.business_id == business_id
    remote = await _db_draft(sample, draft_id)
    assert remote.business_id == business_id
    assert remote.status == "approved"
    if remote.media_plan is not None:
        assert remote.media_plan.get("seal") == media.media_seal(remote.media_plan)


# --- H–J: Unapproval restore after post-commit refresh failure ---


async def test_h_i_j_unapproval_refresh_failure_restores_pending_title(sample, asset_dir):
    knowledge = await source(sample, content="Unapprove restore icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True,
        image_bytes=_PNG + b"unap",
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Unapprove", "Unapprove", _steps(knowledge),
    )
    draft = await _approve(sample, draft)
    draft_id = draft.id
    committed_title = draft.title
    before = draft.revision
    draft.title = _DIRTY_TITLE
    assert get_history(draft, "title").has_changes()

    real_refresh = sample.db.refresh

    async def boom_refresh(instance):
        if isinstance(instance, Draft) and instance.id == draft_id:
            raise RuntimeError("forced_post_commit_refresh_failure")
        return await real_refresh(instance)

    sample.db.refresh = boom_refresh
    try:
        with pytest.raises(RuntimeError, match="forced_post_commit_refresh_failure"):
            await svc.transition_draft(
                sample.db, sample.business.id, sample.editor.id, draft_id, "draft", before,
            )
    finally:
        sample.db.refresh = real_refresh

    # Caller session: pending title restored despite refresh failure.
    assert draft.title == _DIRTY_TITLE
    assert get_history(draft, "title").has_changes()
    # DB: unapproval already committed; title remains authoritative committed value.
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "draft"
    assert remote.revision == before + 1
    assert remote.title == committed_title
    assert remote.approved_by is None
    # Failed session is not claimed reusable.
    await sample.db.rollback()


async def test_unapproval_commit_failure_restores_pending_without_lifecycle_write(sample, asset_dir):
    knowledge = await source(sample, content="Unapprove commit fail icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True,
        image_bytes=_PNG + b"ucf",
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Unapprove", "Unapprove", _steps(knowledge),
    )
    draft = await _approve(sample, draft)
    draft_id = draft.id
    committed_title = draft.title
    before = draft.revision
    draft.title = _DIRTY_TITLE

    real_commit = sample.db.commit

    async def boom_commit():
        raise RuntimeError("forced_unapproval_commit_failure")

    sample.db.commit = boom_commit
    try:
        with pytest.raises(RuntimeError, match="forced_unapproval_commit_failure"):
            await svc.transition_draft(
                sample.db, sample.business.id, sample.editor.id, draft_id, "draft", before,
            )
    finally:
        sample.db.commit = real_commit

    assert draft.title == _DIRTY_TITLE
    assert get_history(draft, "title").has_changes()
    await sample.db.rollback()
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "approved"
    assert remote.revision == before
    assert remote.title == committed_title


async def test_unapproval_explicit_rollback_after_reject_keeps_db(sample, asset_dir):
    draft, _ = await _reviewable(sample, asset_dir)
    draft_id = draft.id
    before = draft.revision
    business_id = sample.business.id
    draft.business_id = uuid.uuid4()
    with pytest.raises(HTTPException):
        await svc.transition_draft(
            sample.db, business_id, sample.owner.id, draft_id, "approved", before,
        )
    assert get_history(draft, "business_id").has_changes()
    await sample.db.rollback()
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "review"
    assert remote.revision == before
    assert remote.business_id == business_id


# --- K: Autoflush ---


async def test_k_autoflush_true_reject_dirty_business_id(sample, asset_dir):
    draft, _ = await _reviewable(sample, asset_dir)
    assert sample.db.autoflush is True
    forged = uuid.uuid4()
    draft.business_id = forged
    with pytest.raises(HTTPException) as raised:
        await svc.transition_draft(
            sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision,
        )
    assert raised.value.detail["code"] == "revision_conflict"
    assert draft.business_id == forged
    assert get_history(draft, "business_id").has_changes()
    await sample.db.rollback()


async def test_k2_autoflush_false_reject_dirty_business_id(sample, asset_dir):
    draft, _ = await _reviewable(sample, asset_dir)
    draft_id = draft.id
    business_id = sample.business.id
    sample.db.autoflush = False
    try:
        forged = uuid.uuid4()
        draft.business_id = forged
        with pytest.raises(HTTPException) as raised:
            await svc.transition_draft(
                sample.db, business_id, sample.owner.id, draft_id, "approved", draft.revision,
            )
        assert raised.value.detail["code"] == "revision_conflict"
        assert get_history(draft, "business_id").has_changes()
        remote = await _db_draft(sample, draft_id)
        assert remote.business_id == business_id
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


# --- L–M: Source policy + prior invariants smoke ---


def test_l_m_source_identity_and_restore_policy():
    text = (_BACKEND / "services/business_yansi/service.py").read_text(encoding="utf-8")
    transition = text.split("async def transition_draft", 1)[1].split("async def revise_draft", 1)[0]
    assert "assert_no_pending_draft_identity" in transition
    assert transition.index("assert_no_pending_draft_identity") < transition.index('target in {"review", "approved"}')
    identity = text.split("_DRAFT_IDENTITY_ATTRS", 1)[1].split("_DRAFT_FREEZE_CONTENT_ATTRS", 1)[0]
    assert '"id"' in identity
    assert '"business_id"' in identity
    post_commit = transition.split("await db.commit()", 1)[1]
    assert "await db.refresh(row)" in post_commit
    assert "_restore_parked_draft_best_effort" in post_commit
    assert post_commit.index("await db.refresh(row)") < post_commit.rfind("_restore_parked_draft_best_effort")
    assert transition.index("business_media_lock") < transition.index("require_locked_access")
    assert transition.index("require_locked_access") < transition.index("draft_decision")
