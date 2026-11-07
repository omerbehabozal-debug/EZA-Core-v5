"""Phase 7G-4c.3A security remediations: auth / Draft / media state freshness.

These are controlled interleaving and identity-map freshness tests on the shared
SQLite ``sample`` fixture. They are NOT overlapping PostgreSQL lock proofs.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy import update

from backend.models.business_brand_assets import BusinessBrandAsset as Asset
from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.models.business_yansi import BusinessMember, BusinessYansiDraft as Draft
from backend.models.business_yansi import BusinessKnowledgeVersion as Knowledge
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import media_observations as observe
from backend.services.business_yansi import observation_rank as rank
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.media_observations import content_sha_from_locator
from backend.services.business_yansi.video_authority import assign_member_role, update_brand_verification
from backend.tests.test_business_video_cover_policy import _confirm, asset_dir, sample
from backend.tests.brand_library_image_fixtures import distinct_library_png
from backend.tests.test_business_yansi import source

_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _digest(asset) -> str:
    found = content_sha_from_locator(asset.locator)
    assert found is not None
    return found


def _steps(knowledge, phrase="Zeytinyagi hasadi"):
    return [
        {"question": f"{phrase} nedir?", "answer": knowledge.content, "sources": [str(knowledge.id)]}
        for _ in range(8)
    ]


async def _image(sample, knowledge, title: str, payload: bytes):
    row = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": title, "caption": "", "public_allowed": True},
        image_bytes=distinct_library_png(payload),
    )
    return await _confirm(sample, knowledge, row)


def _ready_obs(sample, asset, *, summary="Zeytinyagi hasadi ozeti"):
    return Observation(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        asset_id=asset.id,
        content_sha256=_digest(asset),
        analyzer_profile=observe.PROFILE,
        idempotency_key=uuid.uuid4().hex + uuid.uuid4().hex[:32],
        status="ready",
        attempts=1,
        max_attempts=3,
        origin="upload",
        created_by=sample.editor.id,
        summary=summary,
        tags=["zeytinyagi", "hasadi", "ozeti"],
        visible_text=None,
        provider_model="configured-vision",
        input_tokens=10,
        output_tokens=4,
    )


@pytest.fixture(autouse=True)
def _flags_default_off(monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)


def _patch_lock_after_side_effect(monkeypatch, sample, side_effect):
    """Run side_effect after preliminary work, before/at Business lock acquisition.

    Labels the suite as controlled interleaving — not PostgreSQL concurrency proof.
    """
    real_lock = media.business_media_lock

    @asynccontextmanager
    async def lock_spy(db, business_id):
        await side_effect(db)
        async with real_lock(db, business_id) as row:
            yield row

    import backend.services.business_yansi.studio_media as studio_mod

    monkeypatch.setattr(studio_mod, "business_media_lock", lock_spy)


# --- A / B / C: authorization freshness ---


async def test_a_membership_removed_before_protected_persist(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-a")

    async def revoke(db):
        member = await db.get(BusinessMember, (sample.business.id, sample.editor.id))
        if member is not None:
            await db.delete(member)
            await db.commit()

    _patch_lock_after_side_effect(monkeypatch, sample, revoke)
    with pytest.raises(HTTPException) as raised:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
        )
    assert raised.value.status_code == 403
    assert raised.value.detail["code"] == "business_access_denied"


async def test_b_role_demoted_to_viewer_before_protected_persist(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-b")

    async def demote(db):
        await assign_member_role(db, sample.business.id, sample.owner.id, sample.editor.id, "viewer")

    _patch_lock_after_side_effect(monkeypatch, sample, demote)
    with pytest.raises(HTTPException) as raised:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
        )
    assert raised.value.status_code == 403


async def test_c_business_suspended_before_protected_persist(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-c")

    async def suspend(db):
        await update_brand_verification(
            db, sample.business.id, verified=False, official=False, status="suspended",
        )

    _patch_lock_after_side_effect(monkeypatch, sample, suspend)
    with pytest.raises(HTTPException) as raised:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
        )
    assert raised.value.status_code == 404


# --- D / E / F: Draft identity-map freshness ---


async def test_d_stale_draft_revision_after_concurrent_revision(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-d")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    stale_revision = draft.revision
    await sample.db.execute(
        update(Draft)
        .where(Draft.id == draft.id)
        .values(revision=stale_revision + 1)
        .execution_options(synchronize_session=False)
    )
    await sample.db.commit()
    assert draft.revision == stale_revision  # identity map still stale
    with pytest.raises(HTTPException) as raised:
        await svc.revise_draft(
            sample.db, sample.business.id, sample.editor.id, draft.id, stale_revision,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
        )
    assert raised.value.status_code == 409
    assert raised.value.detail["code"] == "editable_draft_required"


async def test_e_stale_draft_after_concurrent_approval(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-e")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    sealed = {
        "coverAssetId": draft.media_plan["coverAssetId"],
        "blocks": draft.media_plan["blocks"],
        "seal": None,
    }
    sealed["seal"] = media.media_seal(sealed)
    await sample.db.execute(
        update(Draft)
        .where(Draft.id == draft.id)
        .values(
            status="approved",
            revision=draft.revision + 1,
            approved_by=sample.owner.id,
            media_plan=sealed,
        )
        .execution_options(synchronize_session=False)
    )
    await sample.db.commit()
    assert draft.status == "draft"  # stale identity map
    with pytest.raises(HTTPException) as raised:
        await svc.revise_draft(
            sample.db, sample.business.id, sample.editor.id, draft.id, draft.revision,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
        )
    assert raised.value.status_code == 409
    await sample.db.refresh(draft)
    assert draft.status == "approved"
    assert draft.media_plan["seal"] == sealed["seal"]


async def test_f_approved_draft_never_persists_unsealed_changed_plan(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    cover = await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-f")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    draft = await svc.transition_draft(
        sample.db, sample.business.id, sample.editor.id, draft.id, "review", draft.revision,
    )
    draft = await svc.transition_draft(
        sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision,
    )
    sealed = draft.media_plan["seal"]
    assert sealed
    with pytest.raises(HTTPException):
        await svc.revise_draft(
            sample.db, sample.business.id, sample.editor.id, draft.id, draft.revision,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
            cover_asset_id=cover.id,
        )
    await sample.db.refresh(draft)
    assert draft.status == "approved"
    assert draft.media_plan["seal"] == sealed
    assert draft.media_plan["coverAssetId"] == str(cover.id)


# --- G / H / I: knowledge and media freshness ---


async def test_g_knowledge_archived_before_protected_selection(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-g")

    async def archive_knowledge(db):
        await db.execute(
            update(Knowledge)
            .where(Knowledge.id == knowledge.id)
            .values(status="archived", revision=int(knowledge.revision or 1) + 1)
            .execution_options(synchronize_session=False)
        )
        await db.commit()

    _patch_lock_after_side_effect(monkeypatch, sample, archive_knowledge)
    with pytest.raises(HTTPException) as raised:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
        )
    assert raised.value.status_code == 422
    assert raised.value.detail["code"] == "published_sources_required"


async def test_h_stale_asset_after_concurrent_archive(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    keep = await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-h-keep")
    drop = await _image(sample, knowledge, "Atolye", b"fresh-h-drop")
    assert drop.status == "published"
    await sample.db.execute(
        update(Asset)
        .where(Asset.id == drop.id)
        .values(status="archived", public_allowed=False, revision=drop.revision + 1)
        .execution_options(synchronize_session=False)
    )
    await sample.db.commit()
    assert drop.status == "published"  # stale identity map
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    assert draft.media_plan["coverAssetId"] == str(keep.id)
    assert draft.media_plan["coverAssetId"] != str(drop.id)


async def test_i_stale_asset_after_public_permission_revocation(sample, asset_dir):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    keep = await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-i-keep")
    drop = await _image(sample, knowledge, "Atolye", b"fresh-i-drop")
    await sample.db.execute(
        update(Asset)
        .where(Asset.id == drop.id)
        .values(public_allowed=False, revision=drop.revision + 1)
        .execution_options(synchronize_session=False)
    )
    await sample.db.commit()
    assert drop.public_allowed is True  # stale identity map
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    assert draft.media_plan["coverAssetId"] == str(keep.id)
    assert draft.media_plan["coverAssetId"] != str(drop.id)


# --- J: no unintended autoflush / pending ORM preservation ---


async def test_j_locked_draft_refresh_preserves_unrelated_pending_orm(sample, asset_dir):
    from sqlalchemy import select

    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-j")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    pending = Knowledge(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        item_id=uuid.uuid4(),
        version=99,
        title="Pending",
        category="",
        content="pending row must not autoflush during draft lock",
        source="test",
        public_allowed=False,
        created_by=sample.editor.id,
        approved_by=None,
        status="published",
        revision=1,
    )
    sample.db.add(pending)
    assert pending in sample.db.new
    async with media.business_media_lock(sample.db, sample.business.id):
        locked = await svc.draft_row(sample.db, sample.business.id, draft.id, True)
        assert locked.id == draft.id
        assert pending in sample.db.new
        with sample.db.no_autoflush:
            assert await sample.db.scalar(select(Knowledge.id).where(Knowledge.id == pending.id)) is None
    assert pending in sample.db.new
    await sample.db.rollback()


async def test_j2_bind_and_auth_reads_do_not_autoflush_pending_knowledge(sample, asset_dir):
    """Controlled freshness: pool/auth SELECTs must not persist unrelated pending rows."""
    from sqlalchemy import select

    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-j2")
    pending = Knowledge(
        id=uuid.uuid4(),
        business_id=sample.business.id,
        item_id=uuid.uuid4(),
        version=98,
        title="PendingBind",
        category="",
        content="must stay unflushed through bind_media_plan",
        source="test",
        public_allowed=False,
        created_by=sample.editor.id,
        approved_by=None,
        status="published",
        revision=1,
    )
    sample.db.add(pending)
    steps = _steps(knowledge)
    async with media.business_media_lock(sample.db, sample.business.id):
        from backend.services.business_yansi.video_authority import require_locked_access

        await require_locked_access(sample.db, sample.business.id, sample.editor.id, "editor")
        await svc.published_knowledge(sample.db, sample.business.id, fresh=True)
        plan = await media.bind_media_plan(
            sample.db, sample.business.id, "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
        )
        assert plan["coverAssetId"]
        assert pending in sample.db.new
        with sample.db.no_autoflush:
            assert await sample.db.scalar(select(Knowledge.id).where(Knowledge.id == pending.id)) is None
    await sample.db.rollback()


# --- K / L: product behavior + no generation ---


async def test_k_explicit_flag_off_and_flag_on_ranking(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    lexical = await _image(sample, knowledge, "Zeytinyagi", b"fresh-k-lex")
    studio = await _image(sample, knowledge, "Atolye", b"fresh-k-obs")
    lamp = await _image(sample, knowledge, "Lamba", b"fresh-k-lamp")
    sample.db.add(_ready_obs(sample, studio))
    await sample.db.commit()
    steps = _steps(knowledge)

    off = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    legacy = media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [lexical, studio, lamp], steps)
    assert off.media_plan["coverAssetId"] == legacy

    explicit = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps, cover_asset_id=lamp.id,
    )
    assert explicit.media_plan["coverMode"] == "explicit"
    assert explicit.media_plan["coverAssetId"] == str(lamp.id)

    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    ranked = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert ranked.media_plan["coverAssetId"] == str(studio.id)


async def test_l_no_provider_or_observation_generation(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_COVER_OBS_RANKING_ENABLED", "true")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    asset = await _image(sample, knowledge, "Zeytinyagi hasadi", b"fresh-l")
    sample.db.add(_ready_obs(sample, asset))
    await sample.db.commit()
    vision = AsyncMock()
    ensure = AsyncMock()
    monkeypatch.setattr("backend.services.business_yansi.image_observe.call_vision", vision, raising=False)
    monkeypatch.setattr("backend.services.business_yansi.media_observations.ensure_observation", ensure, raising=False)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge),
    )
    assert draft.media_plan["coverAssetId"] == str(asset.id)
    assert vision.await_count == 0 and ensure.await_count == 0
    assert observe.enabled() is False
    assert rank.ranking_enabled() is True
