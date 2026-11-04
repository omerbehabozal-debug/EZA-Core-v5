"""Implementation 2B-1D: Draft writer identity guards + cancellation-safe unapproval restore.

SQLite identity-map checks — not PostgreSQL overlapping-transaction proofs.
"""
from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm.attributes import get_history

from backend.models.business_yansi import BusinessPublication, BusinessYansiDraft as Draft
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.business_yansi import service as svc
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.tests.test_business_publish_knowledge_auth import _approved_exportable
from backend.tests.test_business_studio_media import _approve, _asset, _steps
from backend.tests.test_business_video_cover_policy import asset_dir, sample
from backend.tests.test_business_yansi import source

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
_BACKEND = Path(__file__).resolve().parents[1]
_DIRTY_TITLE = "DirtyPendingCancelTitle"


async def _db_draft(sample, draft_id):
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        return await session_b.get(Draft, draft_id)


async def _editable(sample, asset_dir):
    knowledge = await source(sample, content="Writer identity icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True,
        image_bytes=_PNG + b"2b1d",
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Writer", "Writer", _steps(knowledge),
    )
    return draft, knowledge


# --- A–C: revise_draft identity ---


async def test_a_dirty_business_id_rejected_on_revise(sample, asset_dir):
    draft, knowledge = await _editable(sample, asset_dir)
    draft_id = draft.id
    before = draft.revision
    business_id = sample.business.id
    forged = uuid.uuid4()
    draft.business_id = forged
    with pytest.raises(HTTPException) as raised:
        await svc.revise_draft(
            sample.db, business_id, sample.editor.id, draft_id, before,
            "Writer", "Writer", _steps(knowledge),
        )
    assert raised.value.detail["code"] == "revision_conflict"
    assert draft.business_id == forged
    assert get_history(draft, "business_id").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.business_id == business_id
    assert remote.revision == before
    await sample.db.rollback()


async def test_b_dirty_id_rejected_on_revise(sample, asset_dir):
    draft, knowledge = await _editable(sample, asset_dir)
    draft_id = draft.id
    before = draft.revision
    forged = uuid.uuid4()
    draft.id = forged
    with pytest.raises(HTTPException) as raised:
        await svc.revise_draft(
            sample.db, sample.business.id, sample.editor.id, draft_id, before,
            "Writer", "Writer", _steps(knowledge),
        )
    assert raised.value.detail["code"] == "revision_conflict"
    assert draft.id == forged
    assert get_history(draft, "id").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.id == draft_id
    await sample.db.rollback()


async def test_c_dirty_created_by_rejected_on_revise(sample, asset_dir):
    draft, knowledge = await _editable(sample, asset_dir)
    draft_id = draft.id
    before = draft.revision
    committed_creator = draft.created_by
    draft.created_by = sample.owner.id
    assert get_history(draft, "created_by").has_changes()
    with pytest.raises(HTTPException) as raised:
        await svc.revise_draft(
            sample.db, sample.business.id, sample.editor.id, draft_id, before,
            "Writer", "Writer", _steps(knowledge),
        )
    assert raised.value.detail["code"] == "revision_conflict"
    assert draft.created_by == sample.owner.id
    assert get_history(draft, "created_by").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.created_by == committed_creator
    await sample.db.rollback()


# --- D–E: publish_draft identity ---


async def test_d_dirty_business_id_rejected_on_publish(sample, asset_dir, monkeypatch):
    draft, node, seal = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1d-pub-b")
    draft_id = draft.id
    business_id = sample.business.id
    owner_id = sample.owner.id
    slug = node.slug
    journey = node.journey_version
    before = draft.revision
    draft.business_id = uuid.uuid4()
    with pytest.raises(HTTPException) as raised:
        await publish_draft(sample.db, business_id, owner_id, draft_id, slug, before)
    assert raised.value.detail["code"] == "revision_conflict"
    assert get_history(draft, "business_id").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.business_id == business_id
    assert remote.status == "approved"
    assert await sample.db.get(BusinessPublication, (slug, journey)) is None
    if seal is not None:
        assert remote.media_plan.get("seal") == seal
    await sample.db.rollback()


async def test_e_dirty_created_by_rejected_on_publish(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1d-pub-c")
    draft_id = draft.id
    business_id = sample.business.id
    owner_id = sample.owner.id
    before = draft.revision
    committed_creator = draft.created_by
    draft.created_by = owner_id
    with pytest.raises(HTTPException) as raised:
        await publish_draft(sample.db, business_id, owner_id, draft_id, node.slug, before)
    assert raised.value.detail["code"] == "revision_conflict"
    assert get_history(draft, "created_by").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.created_by == committed_creator
    assert remote.status == "approved"
    await sample.db.rollback()


# --- F–G: export identity ---


async def test_f_dirty_business_id_rejected_on_new_export(sample, asset_dir):
    knowledge = await source(sample, content="Export business identity icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True,
        image_bytes=_PNG + b"exidb",
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Export", "Export", _steps(knowledge),
    )
    draft = await _approve(sample, draft)
    draft_id = draft.id
    business_id = sample.business.id
    editor_id = sample.editor.id
    draft.business_id = uuid.uuid4()
    with pytest.raises(HTTPException) as raised:
        await export_editorial_conversation(sample.db, business_id, editor_id, draft_id)
    assert raised.value.detail["code"] == "revision_conflict"
    remote = await _db_draft(sample, draft_id)
    assert remote.business_id == business_id
    assert remote.conversation_id is None
    await sample.db.rollback()


async def test_g_dirty_created_by_rejected_on_new_export(sample, asset_dir):
    knowledge = await source(sample, content="Export creator identity icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True,
        image_bytes=_PNG + b"exidc",
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Export", "Export", _steps(knowledge),
    )
    draft = await _approve(sample, draft)
    draft_id = draft.id
    business_id = sample.business.id
    editor_id = sample.editor.id
    owner_id = sample.owner.id
    committed_creator = draft.created_by
    draft.created_by = owner_id
    with pytest.raises(HTTPException):
        await export_editorial_conversation(sample.db, business_id, editor_id, draft_id)
    assert get_history(draft, "created_by").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.created_by == committed_creator
    assert remote.conversation_id is None
    await sample.db.rollback()


# --- H–K: reject hygiene + clean path ---


async def test_h_i_j_reject_preserves_history_db_and_no_artifact(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1d-rej")
    draft_id = draft.id
    before = draft.revision
    forged = uuid.uuid4()
    draft.business_id = forged
    with pytest.raises(HTTPException):
        await publish_draft(sample.db, sample.business.id, sample.owner.id, draft_id, node.slug, before)
    assert draft.business_id == forged
    assert get_history(draft, "business_id").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.business_id == sample.business.id
    assert remote.status == "approved"
    assert await sample.db.get(BusinessPublication, (node.slug, node.journey_version)) is None
    await sample.db.rollback()


async def test_k_clean_revise_still_works(sample, asset_dir):
    draft, knowledge = await _editable(sample, asset_dir)
    before = draft.revision
    revised = await svc.revise_draft(
        sample.db, sample.business.id, sample.editor.id, draft.id, before,
        "Writer2", "Writer2", _steps(knowledge),
    )
    assert revised.revision == before + 1
    assert revised.title == "Writer2"
    remote = await _db_draft(sample, draft.id)
    assert remote.business_id == sample.business.id
    assert remote.created_by == sample.editor.id


# --- L–Q: cancellation-safe unapproval restore ---


async def test_l_m_n_o_cancellation_after_unapproval_commit_restores_pending(sample, asset_dir):
    knowledge = await source(sample, content="Cancel restore icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True,
        image_bytes=_PNG + b"canc",
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Cancel", "Cancel", _steps(knowledge),
    )
    draft = await _approve(sample, draft)
    draft_id = draft.id
    committed_title = draft.title
    before = draft.revision
    draft.title = _DIRTY_TITLE
    assert get_history(draft, "title").has_changes()

    real_refresh = sample.db.refresh

    async def cancel_refresh(instance):
        if isinstance(instance, Draft) and getattr(instance, "id", None) == draft_id:
            raise asyncio.CancelledError()
        return await real_refresh(instance)

    sample.db.refresh = cancel_refresh
    try:
        with pytest.raises(asyncio.CancelledError):
            await svc.transition_draft(
                sample.db, sample.business.id, sample.editor.id, draft_id, "draft", before,
            )
    finally:
        sample.db.refresh = real_refresh

    assert draft.title == _DIRTY_TITLE
    assert get_history(draft, "title").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "draft"
    assert remote.revision == before + 1
    assert remote.title == committed_title
    await sample.db.rollback()


async def test_p_q_restore_failure_does_not_mask_cancellation(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Restore mask icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True,
        image_bytes=_PNG + b"mask",
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Mask", "Mask", _steps(knowledge),
    )
    draft = await _approve(sample, draft)
    draft_id = draft.id
    before = draft.revision
    draft.title = _DIRTY_TITLE

    real_refresh = sample.db.refresh

    async def cancel_refresh(instance):
        if isinstance(instance, Draft) and getattr(instance, "id", None) == draft_id:
            raise asyncio.CancelledError()
        return await real_refresh(instance)

    def boom_restore(obj, parked):
        raise RuntimeError("forced_restore_failure")

    sample.db.refresh = cancel_refresh
    monkeypatch.setattr(svc, "restore_dirty_draft_content", boom_restore)
    try:
        with pytest.raises(asyncio.CancelledError) as raised:
            await svc.transition_draft(
                sample.db, sample.business.id, sample.editor.id, draft_id, "draft", before,
            )
        # Primary remains CancelledError; secondary restore is observable without
        # inverting causality via __cause__.
        secondary = getattr(raised.value, "__restore_error__", None)
        assert secondary is not None
        assert "forced_restore_failure" in str(secondary)
        assert raised.value.__cause__ is None
        assert _DIRTY_TITLE not in str(secondary)
    finally:
        sample.db.refresh = real_refresh
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "draft"
    assert remote.revision == before + 1
    await sample.db.rollback()


# --- R–T: autoflush + source policy ---


async def test_r_autoflush_true_revise_identity(sample, asset_dir):
    draft, knowledge = await _editable(sample, asset_dir)
    assert sample.db.autoflush is True
    draft.business_id = uuid.uuid4()
    with pytest.raises(HTTPException) as raised:
        await svc.revise_draft(
            sample.db, sample.business.id, sample.editor.id, draft.id, draft.revision,
            "Writer", "Writer", _steps(knowledge),
        )
    assert raised.value.detail["code"] == "revision_conflict"
    await sample.db.rollback()


async def test_r2_autoflush_false_revise_identity(sample, asset_dir):
    draft, knowledge = await _editable(sample, asset_dir)
    draft_id = draft.id
    before = draft.revision
    business_id = sample.business.id
    editor_id = sample.editor.id
    steps = _steps(knowledge)
    sample.db.autoflush = False
    try:
        draft.business_id = uuid.uuid4()
        with pytest.raises(HTTPException) as raised:
            await svc.revise_draft(
                sample.db, business_id, editor_id, draft_id, before,
                "Writer", "Writer", steps,
            )
        assert raised.value.detail["code"] == "revision_conflict"
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


def test_s_t_writer_coverage_and_lock_order_in_source():
    svc_text = (_BACKEND / "services/business_yansi/service.py").read_text(encoding="utf-8")
    pub_text = (_BACKEND / "services/business_yansi/publication.py").read_text(encoding="utf-8")
    identity = svc_text.split("_DRAFT_IDENTITY_ATTRS", 1)[1].split("_DRAFT_FREEZE_CONTENT_ATTRS", 1)[0]
    assert '"id"' in identity and '"business_id"' in identity and '"created_by"' in identity
    revise = svc_text.split("async def revise_draft", 1)[1]
    assert "assert_draft_writer_identity" in revise
    assert "assert_draft_writer_identity" in pub_text
    transition = svc_text.split("async def transition_draft", 1)[1].split("async def revise_draft", 1)[0]
    assert "finally:" in transition
    assert "_restore_parked_draft_best_effort" in transition
    assert transition.index("business_media_lock") < transition.index("require_locked_access")
    publish = pub_text.split("async def publish_draft", 1)[1]
    assert publish.index("business_media_lock") < publish.index("require_locked_actor")
    assert publish.index("require_locked_actor") < publish.index("draft_decision")
    assert publish.index("assert_draft_writer_identity") < publish.index("park_dirty_draft_content")
