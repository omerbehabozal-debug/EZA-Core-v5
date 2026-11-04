"""Implementation 2B-1E: operation-local primary exception tracking for Draft restore.

SQLite identity-map checks — not PostgreSQL overlapping-transaction proofs.
"""
from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm.attributes import get_history

from backend.models.business_yansi import BusinessPublication, BusinessYansiDraft as Draft
from backend.services.business_yansi import service as svc
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.tests.test_business_publish_knowledge_auth import _approved_exportable
from backend.tests.test_business_studio_media import _approve, _asset, _steps
from backend.tests.test_business_video_cover_policy import asset_dir, sample
from backend.tests.test_business_yansi import source

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
_BACKEND = Path(__file__).resolve().parents[1]
_DIRTY_TITLE = "DirtyPendingOuterExceptTitle"
_OUTER = "outer_caller_runtime_error"
_RESTORE = "forced_restore_failure_2b1e"


async def _db_draft(sample, draft_id):
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as session_b:
        return await session_b.get(Draft, draft_id)


async def _approved_only(sample, asset_dir, *, title="ExportReady"):
    knowledge = await source(sample, content="Outer except restore icin yeterince aciktir.")
    await _asset(
        sample, knowledge, asset_type="image", title="Kapak", caption="", public_allowed=True,
        image_bytes=_PNG + b"2b1e",
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, title, title, _steps(knowledge),
    )
    return await _approve(sample, draft)


def _boom_restore(_draft, _parked):
    raise ValueError(_RESTORE)


async def _call_inside_outer_except(coro_factory):
    """Invoke the Business operation while an unrelated outer except is active."""
    try:
        raise RuntimeError(_OUTER)
    except RuntimeError:
        return await coro_factory()


# --- A–D: successful op inside outer except + restore failure must propagate ---


async def test_a_d_publish_success_outer_except_restore_failure_propagates(sample, asset_dir, monkeypatch):
    draft, node, _ = await _approved_exportable(sample, monkeypatch, slug="yansi-2b1e-pub-a")
    draft_id = draft.id
    before = draft.revision
    committed_title = draft.title
    slug = node.slug
    draft.title = _DIRTY_TITLE
    assert get_history(draft, "title").has_changes()
    monkeypatch.setattr(svc, "restore_dirty_draft_content", _boom_restore)

    with pytest.raises(ValueError) as raised:
        await _call_inside_outer_except(
            lambda: publish_draft(
                sample.db, sample.business.id, sample.owner.id, draft_id, slug, before,
            )
        )
    assert _RESTORE in str(raised.value)
    assert _OUTER not in str(raised.value)
    assert _DIRTY_TITLE not in str(raised.value)
    assert getattr(raised.value, "__restore_error__", None) is None
    # Commit completed before restore failed — persisted published state.
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "published"
    assert remote.revision == before + 1
    assert remote.title == committed_title
    assert await sample.db.get(BusinessPublication, (slug, node.journey_version)) is not None
    await sample.db.rollback()


async def test_b_d_export_success_outer_except_restore_failure_propagates(sample, asset_dir, monkeypatch):
    draft = await _approved_only(sample, asset_dir, title="ExportOuter")
    draft_id = draft.id
    committed_title = draft.title
    draft.title = _DIRTY_TITLE
    assert get_history(draft, "title").has_changes()
    monkeypatch.setattr(svc, "restore_dirty_draft_content", _boom_restore)

    with pytest.raises(ValueError) as raised:
        await _call_inside_outer_except(
            lambda: export_editorial_conversation(
                sample.db, sample.business.id, sample.editor.id, draft_id,
            )
        )
    assert _RESTORE in str(raised.value)
    assert _OUTER not in str(raised.value)
    assert _DIRTY_TITLE not in str(raised.value)
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "approved"
    assert remote.conversation_id is not None
    assert remote.title == committed_title
    await sample.db.rollback()


async def test_c_d_unapprove_success_outer_except_restore_failure_propagates(sample, asset_dir, monkeypatch):
    draft = await _approved_only(sample, asset_dir, title="UnapproveOuter")
    draft_id = draft.id
    before = draft.revision
    committed_title = draft.title
    draft.title = _DIRTY_TITLE
    assert get_history(draft, "title").has_changes()
    monkeypatch.setattr(svc, "restore_dirty_draft_content", _boom_restore)

    with pytest.raises(ValueError) as raised:
        await _call_inside_outer_except(
            lambda: svc.transition_draft(
                sample.db, sample.business.id, sample.editor.id, draft_id, "draft", before,
            )
        )
    assert _RESTORE in str(raised.value)
    assert _OUTER not in str(raised.value)
    assert _DIRTY_TITLE not in str(raised.value)
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "draft"
    assert remote.revision == before + 1
    assert remote.title == committed_title
    await sample.db.rollback()


# --- E: success + successful restore inside outer except ---


async def test_e_success_inside_outer_except_with_restore(sample, asset_dir):
    draft = await _approved_only(sample, asset_dir, title="OuterOk")
    draft_id = draft.id
    before = draft.revision
    draft.title = _DIRTY_TITLE
    assert get_history(draft, "title").has_changes()

    row = await _call_inside_outer_except(
        lambda: svc.transition_draft(
            sample.db, sample.business.id, sample.editor.id, draft_id, "draft", before,
        )
    )
    assert row.status == "draft"
    assert draft.title == _DIRTY_TITLE
    assert get_history(draft, "title").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "draft"
    assert remote.revision == before + 1
    assert remote.title == "OuterOk"
    await sample.db.rollback()


# --- F: operation failure + restore failure preserves primary ---


async def test_f_operation_and_restore_failure_preserves_primary(sample, asset_dir, monkeypatch):
    draft = await _approved_only(sample, asset_dir, title="BothFail")
    draft_id = draft.id
    before = draft.revision
    draft.title = _DIRTY_TITLE

    real_commit = sample.db.commit

    async def boom_commit():
        raise RuntimeError("operation_commit_failure")

    monkeypatch.setattr(sample.db, "commit", boom_commit)
    monkeypatch.setattr(svc, "restore_dirty_draft_content", _boom_restore)

    with pytest.raises(RuntimeError) as raised:
        await svc.transition_draft(
            sample.db, sample.business.id, sample.editor.id, draft_id, "draft", before,
        )
    assert "operation_commit_failure" in str(raised.value)
    secondary = getattr(raised.value, "__restore_error__", None)
    assert secondary is not None
    assert _RESTORE in str(secondary)
    assert _DIRTY_TITLE not in str(secondary)
    assert raised.value.__cause__ is None
    sample.db.commit = real_commit
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "approved"
    assert remote.revision == before
    await sample.db.rollback()


# --- G–H: CancelledError + restore failure; inspectable without Draft body ---


async def test_g_h_cancelled_plus_restore_preserves_cancellation(sample, asset_dir, monkeypatch):
    draft = await _approved_only(sample, asset_dir, title="CancelOuter")
    draft_id = draft.id
    before = draft.revision
    draft.title = _DIRTY_TITLE

    real_refresh = sample.db.refresh

    async def cancel_refresh(instance):
        if isinstance(instance, Draft) and getattr(instance, "id", None) == draft_id:
            raise asyncio.CancelledError()
        return await real_refresh(instance)

    sample.db.refresh = cancel_refresh
    monkeypatch.setattr(svc, "restore_dirty_draft_content", _boom_restore)
    try:
        with pytest.raises(asyncio.CancelledError) as raised:
            await _call_inside_outer_except(
                lambda: svc.transition_draft(
                    sample.db, sample.business.id, sample.editor.id, draft_id, "draft", before,
                )
            )
        secondary = getattr(raised.value, "__restore_error__", None)
        assert secondary is not None
        assert _RESTORE in str(secondary)
        assert _DIRTY_TITLE not in str(secondary)
        assert _OUTER not in str(secondary)
        assert raised.value.__cause__ is None
    finally:
        sample.db.refresh = real_refresh
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "draft"
    assert remote.revision == before + 1
    await sample.db.rollback()


# --- I–J: restore success preserves dirty/history; DB reflects commit ---


async def test_i_j_restore_preserves_dirty_and_committed_db(sample, asset_dir):
    draft = await _approved_only(sample, asset_dir, title="DirtyKeep")
    draft_id = draft.id
    before = draft.revision
    committed_title = draft.title
    draft.title = _DIRTY_TITLE

    await svc.transition_draft(
        sample.db, sample.business.id, sample.editor.id, draft_id, "draft", before,
    )
    assert draft.title == _DIRTY_TITLE
    assert get_history(draft, "title").has_changes()
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "draft"
    assert remote.revision == before + 1
    assert remote.title == committed_title
    await sample.db.rollback()


# --- K: autoflush modes ---


async def test_k_autoflush_true_outer_except_restore_failure(sample, asset_dir, monkeypatch):
    assert sample.db.autoflush is True
    draft = await _approved_only(sample, asset_dir, title="AfTrue")
    draft_id = draft.id
    before = draft.revision
    draft.title = _DIRTY_TITLE
    monkeypatch.setattr(svc, "restore_dirty_draft_content", _boom_restore)
    with pytest.raises(ValueError):
        await _call_inside_outer_except(
            lambda: svc.transition_draft(
                sample.db, sample.business.id, sample.editor.id, draft_id, "draft", before,
            )
        )
    remote = await _db_draft(sample, draft_id)
    assert remote.status == "draft"
    await sample.db.rollback()


async def test_k2_autoflush_false_outer_except_restore_failure(sample, asset_dir, monkeypatch):
    draft = await _approved_only(sample, asset_dir, title="AfFalse")
    draft_id = draft.id
    before = draft.revision
    editor_id = sample.editor.id
    business_id = sample.business.id
    sample.db.autoflush = False
    try:
        draft.title = _DIRTY_TITLE
        monkeypatch.setattr(svc, "restore_dirty_draft_content", _boom_restore)
        with pytest.raises(ValueError):
            await _call_inside_outer_except(
                lambda: svc.transition_draft(
                    sample.db, business_id, editor_id, draft_id, "draft", before,
                )
            )
        remote = await _db_draft(sample, draft_id)
        assert remote.status == "draft"
    finally:
        sample.db.autoflush = True
        await sample.db.rollback()


def test_source_has_no_ambient_exc_info_on_restore_paths():
    svc_text = (_BACKEND / "services/business_yansi/service.py").read_text(encoding="utf-8")
    pub_text = (_BACKEND / "services/business_yansi/publication.py").read_text(encoding="utf-8")
    transition = svc_text.split("async def transition_draft", 1)[1].split("async def revise_draft", 1)[0]
    # Forbid ambient capture; comments may mention the anti-pattern by name.
    assert "sys.exc_info()[1]" not in transition
    assert "primary=sys.exc_info" not in transition
    assert "except BaseException as exc" in transition
    assert "primary = exc" in transition
    export = pub_text.split("async def export_editorial_conversation", 1)[1].split("async def publish_draft", 1)[0]
    publish = pub_text.split("async def publish_draft", 1)[1]
    assert "sys.exc_info()[1]" not in export
    assert "sys.exc_info()[1]" not in publish
    assert "primary=sys.exc_info" not in export
    assert "primary=sys.exc_info" not in publish
    assert "except BaseException as exc" in export
    assert "except BaseException as exc" in publish
    assert "import sys" not in pub_text
