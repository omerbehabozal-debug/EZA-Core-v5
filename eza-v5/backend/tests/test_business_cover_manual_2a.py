"""Manual cover confirmation: no job on upload, explicit window, seals unchanged."""
import uuid
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select, update

from backend.models.business_video_cover_jobs import BusinessVideoCoverJob
from backend.models.production import User
from backend.models.business_yansi import BusinessPublication, BusinessYansiDraft
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.cover_jobs import (
    job_for_source,
    latest_for_asset,
    mutable_window_clause,
    retarget_cover,
    retry_cover,
)
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.tests.test_business_video_cover_policy import _PNG, _confirm, _steps, _stored, asset_dir, sample
from backend.tests.test_business_video_storage import VideoQuotaRedis, _mp4
from backend.tests.test_business_yansi import source
from unittest.mock import AsyncMock


@pytest.fixture(autouse=True)
def _budget_and_probe(monkeypatch):
    quota = VideoQuotaRedis()

    async def client():
        return quota

    monkeypatch.setattr("backend.services.business_yansi.video_ingest._redis", client)

    async def accept(_path: str) -> None:
        return None

    monkeypatch.setattr("backend.services.business_yansi.video_mp4.probe_file", accept)


async def test_upload_does_not_enqueue_and_confirmation_creates_the_job(sample, asset_dir):
    from backend.services.business_yansi.video_ingest import ingest_upload
    from backend.services.business_yansi.video_storage import MemoryVideoStore
    from backend.tests.test_business_video_storage import Upload

    business_id, editor_id, viewer_id = sample.business.id, sample.editor.id, sample.viewer.id
    owner_id, outsider_id, other_org, admin_id = sample.owner.id, sample.outsider.id, sample.other.id, sample.admin.id
    legacy = await _stored(sample, _mp4(seconds=8), purpose="step", title="Eski yukleme")
    assert await latest_for_asset(sample.db, business_id, legacy.id) is not None
    row = await ingest_upload(
        sample.db, business_id, editor_id, store=MemoryVideoStore(), upload=Upload(_mp4(seconds=8)),
        title="Manuel film", caption="", purpose="step", public_allowed=True, prepare_cover=False,
    )
    asset_id = row.id
    assert await latest_for_asset(sample.db, business_id, asset_id) is None
    with pytest.raises(HTTPException) as viewer:
        await retarget_cover(sample.db, business_id, viewer_id, asset_id, 0, 8)
    assert viewer.value.status_code == 403
    await sample.db.rollback()
    admin = await sample.db.get(User, admin_id)
    other = await svc.create_business(sample.db, admin, {
        "organizationId": str(other_org), "ownerId": str(outsider_id), "slug": "diger", "name": "Diger",
    })
    other_id = other.id
    with pytest.raises(HTTPException) as foreign:
        await retarget_cover(sample.db, other_id, editor_id, asset_id, 0, 8)
    assert foreign.value.status_code == 403
    await sample.db.rollback()
    with pytest.raises(HTTPException) as crossed:
        await retarget_cover(sample.db, other_id, outsider_id, asset_id, 0, 8)
    assert crossed.value.status_code == 404
    await sample.db.rollback()
    job = await retarget_cover(sample.db, business_id, editor_id, asset_id, 1, 6)
    assert job.status == "awaiting_encode"
    assert job.strategy == "chosen_span"
    assert await latest_for_asset(sample.db, business_id, asset_id) is not None
    ready = await retarget_cover(sample.db, business_id, owner_id, asset_id, 0, 8)
    assert ready.status == "ready"
    assert ready.result_asset_id == asset_id


async def test_cover_kind_mismatch_and_unready_derivative_are_rejected(sample, asset_dir):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    image = await _confirm(sample, knowledge, await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Atolye gorseli", "caption": "", "public_allowed": True,
    }, image_bytes=_PNG))
    original = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=8), purpose="step"))
    derivative = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "video", "title": "Turev", "caption": "",
        "locator": "https://cdn.example/turev.mp4", "public_allowed": True,
    })
    derivative.source_asset_id = original.id
    derivative.verified_duration = 8000
    derivative.verified_timescale = 1000
    derivative.verified_size_bytes = 1000
    derivative.verified_has_audio = False
    sample.db.add(BusinessVideoCoverJob(
        id=uuid.uuid4(), business_id=sample.business.id, source_asset_id=original.id,
        idempotency_key=uuid.uuid4().hex, strategy="chosen_span", start_ticks=0, end_ticks=8000,
        encoder_profile="silent-derivative-v1", status="failed", attempts=1, max_attempts=3,
        result_asset_id=derivative.id, error_code="cover_encode_failed", created_by=sample.editor.id,
    ))
    await sample.db.commit()
    derivative = await _confirm(sample, knowledge, derivative)
    business_id, editor_id = sample.business.id, sample.editor.id
    image_id, derivative_id = image.id, derivative.id
    steps = _steps(knowledge)
    with pytest.raises(HTTPException) as missing:
        await svc.create_draft(
            sample.db, business_id, editor_id, "Atolye", "Atolye", steps, cover_kind="image",
        )
    assert missing.value.detail["code"] == "cover_choice_required"
    await sample.db.rollback()
    with pytest.raises(HTTPException) as mismatch:
        await svc.create_draft(
            sample.db, business_id, editor_id, "Atolye", "Atolye", steps,
            cover_asset_id=image_id, cover_kind="video",
        )
    assert mismatch.value.detail["code"] in {"cover_type_mismatch", "asset_choice_rejected"}
    await sample.db.rollback()
    with pytest.raises(HTTPException) as pending:
        await svc.create_draft(
            sample.db, business_id, editor_id, "Atolye", "Atolye", steps,
            cover_asset_id=derivative_id, cover_kind="video",
        )
    assert pending.value.detail["code"] == "cover_not_ready"
    await sample.db.rollback()
    draft = await svc.create_draft(
        sample.db, business_id, editor_id, "Atolye gorseli", "Atolye", steps,
        cover_asset_id=image_id, cover_kind="image",
    )
    assert draft.media_plan["coverKind"] == "image"
    assert draft.media_plan["coverMode"] == "explicit"
    kept = await svc.revise_draft(
        sample.db, business_id, editor_id, draft.id, draft.revision,
        draft.title, draft.summary, steps, cover_specified=False,
    )
    assert kept.media_plan["coverKind"] == "image"
    assert kept.media_plan["coverAssetId"] == str(image.id)
    assert media.media_seal(kept.media_plan) == media.media_seal({"coverAssetId": str(image.id), "blocks": kept.media_plan["blocks"]})


async def test_existing_publication_seal_ignores_cover_kind(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    image = await _confirm(sample, knowledge, await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Atolye gorseli", "caption": "", "public_allowed": True,
    }, image_bytes=_PNG))
    steps = _steps(knowledge)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps, cover_asset_id=image.id,
    )
    assert "coverKind" not in draft.media_plan
    draft = await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, draft.id, "review", draft.revision)
    draft = await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision)
    assert "coverKind" not in draft.media_plan
    assert draft.media_plan["seal"] == media.media_seal(draft.media_plan)
    sealed = draft.media_plan["seal"]
    await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, draft.id)
    await sample.db.refresh(draft)
    conversation = await sample.db.get(StandaloneConversation, draft.conversation_id)
    node = MirrorNetworkNode(
        slug="eski-kapak", user_id=draft.created_by, conversation_id=conversation.client_conversation_id,
        visibility="private", safety_status="open", card_title="Atolye", card_date="2026-11-06",
        scene_image_url=None, public_payload={}, private_payload={}, journey_version=1,
    )
    sample.db.add(node)
    await sample.db.commit()
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.get_frozen_journey_artifact",
        AsyncMock(return_value={"frozen": True}),
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.to_public_frozen_journey_artifact",
        lambda _internal: {"steps": [{"publicQuestion": step["question"], "publicAnswer": step["answer"]} for step in steps]},
    )
    await publish_draft(sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision)
    await sample.db.refresh(draft)
    assert draft.status == "published"
    assert draft.media_plan["seal"] == sealed
    assert "coverKind" not in draft.media_plan
    row = await sample.db.get(BusinessPublication, (node.slug, node.journey_version))
    assert row is not None
    assert row.media_plan["seal"] == sealed


async def test_manual_video_requires_a_confirmed_interval(sample, asset_dir):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    silent = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=8), purpose="step", title="Sessiz film"))
    business_id, editor_id, viewer_id, silent_id = sample.business.id, sample.editor.id, sample.viewer.id, silent.id
    steps = _steps(knowledge)
    legacy = await svc.create_draft(
        sample.db, business_id, editor_id, "Sessiz film", "Atolye", steps, cover_asset_id=silent_id,
    )
    assert legacy.media_plan["coverAssetId"] == str(silent_id)
    assert "coverKind" not in legacy.media_plan
    with pytest.raises(HTTPException) as missing:
        await svc.create_draft(
            sample.db, business_id, editor_id, "Sessiz film", "Atolye", steps,
            cover_asset_id=silent_id, cover_kind="video",
        )
    assert missing.value.detail["code"] == "cover_interval_required"
    await sample.db.rollback()
    confirmed = await retarget_cover(sample.db, business_id, editor_id, silent_id, 0, 8)
    assert confirmed.status == "ready" and confirmed.strategy == "chosen_span" and confirmed.result_asset_id == silent_id
    chosen = await svc.create_draft(
        sample.db, business_id, editor_id, "Sessiz film", "Atolye", steps,
        cover_asset_id=silent_id, cover_kind="video",
    )
    assert chosen.media_plan["coverKind"] == "video"
    assert chosen.media_plan["coverAssetId"] == str(silent_id)
    with pytest.raises(HTTPException) as viewer:
        await retarget_cover(sample.db, business_id, viewer_id, silent_id, 1, 4)
    assert viewer.value.status_code == 403


async def test_later_interval_does_not_invalidate_an_approved_derivative(sample, asset_dir, monkeypatch):
    from datetime import datetime, timedelta, timezone

    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    original = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=40), purpose="step", title="Uzun film"))
    derivative = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "video", "title": "Hazir turev", "caption": "",
        "locator": "https://cdn.example/hazir.mp4", "public_allowed": True,
    })
    derivative.source_asset_id = original.id
    derivative.verified_duration = 8000
    derivative.verified_timescale = 1000
    derivative.verified_size_bytes = 1000
    derivative.verified_has_audio = False
    ready = BusinessVideoCoverJob(
        id=uuid.uuid4(), business_id=sample.business.id, source_asset_id=original.id,
        idempotency_key=uuid.uuid4().hex, strategy="chosen_span", start_ticks=0, end_ticks=8000,
        encoder_profile="silent-derivative-v1", status="ready", attempts=1, max_attempts=3,
        result_asset_id=derivative.id, created_by=sample.editor.id,
        created_at=datetime.now(timezone.utc) + timedelta(seconds=5),
    )
    sample.db.add(ready)
    await sample.db.commit()
    derivative = await _confirm(sample, knowledge, derivative)
    ready_id, derivative_id, original_id = ready.id, derivative.id, original.id
    steps = _steps(knowledge)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Hazir turev", "Atolye", steps,
        cover_asset_id=derivative_id, cover_kind="video",
    )
    draft = await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, draft.id, "review", draft.revision)
    draft = await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, draft.id, "approved", draft.revision)
    sealed = draft.media_plan["seal"]
    assert draft.media_plan["coverAssetId"] == str(derivative_id)
    changed = await retarget_cover(sample.db, sample.business.id, sample.editor.id, original_id, 5, 15)
    assert changed.id != ready_id and changed.status == "awaiting_encode"
    kept = await sample.db.get(BusinessVideoCoverJob, ready_id)
    assert kept.status == "ready" and kept.result_asset_id == derivative_id
    await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, draft.id)
    await sample.db.refresh(draft)
    conversation = await sample.db.get(StandaloneConversation, draft.conversation_id)
    node = MirrorNetworkNode(
        slug="korunan-kapak", user_id=draft.created_by, conversation_id=conversation.client_conversation_id,
        visibility="private", safety_status="open", card_title="Atolye", card_date="2026-11-06",
        scene_image_url=None, public_payload={}, private_payload={}, journey_version=1,
    )
    sample.db.add(node)
    await sample.db.commit()
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.get_frozen_journey_artifact",
        AsyncMock(return_value={"frozen": True}),
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.to_public_frozen_journey_artifact",
        lambda _internal: {"steps": [{"publicQuestion": step["question"], "publicAnswer": step["answer"]} for step in steps]},
    )
    await publish_draft(sample.db, sample.business.id, sample.owner.id, draft.id, node.slug, draft.revision)
    await sample.db.refresh(draft)
    assert draft.status == "published"
    assert draft.media_plan["seal"] == sealed
    assert draft.media_plan["coverAssetId"] == str(derivative_id)
    published = await sample.db.get(BusinessPublication, (node.slug, node.journey_version))
    assert published.media_plan["seal"] == sealed
    assert published.media_plan["coverAssetId"] == str(derivative_id)


async def _manual_video(sample, body, title, business_id, editor_id):
    from backend.services.business_yansi.video_ingest import ingest_upload
    from backend.services.business_yansi.video_storage import MemoryVideoStore
    from backend.tests.test_business_video_storage import Upload

    return await ingest_upload(
        sample.db, business_id, editor_id, store=MemoryVideoStore(), upload=Upload(body),
        title=title, caption="", purpose="step", public_allowed=True, prepare_cover=False,
    )


def _freeze(monkeypatch, steps):
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.get_frozen_journey_artifact",
        AsyncMock(return_value={"frozen": True}),
    )
    monkeypatch.setattr(
        "backend.services.mirror_network.frozen_journey_artifact.to_public_frozen_journey_artifact",
        lambda _internal: {"steps": [{"publicQuestion": step["question"], "publicAnswer": step["answer"]} for step in steps]},
    )


async def _node(sample, draft, slug, business_id, editor_id):
    await export_editorial_conversation(sample.db, business_id, editor_id, draft.id)
    await sample.db.refresh(draft)
    conversation = await sample.db.get(StandaloneConversation, draft.conversation_id)
    node = MirrorNetworkNode(
        slug=slug, user_id=draft.created_by, conversation_id=conversation.client_conversation_id,
        visibility="private", safety_status="open", card_title="Atolye", card_date="2026-11-06",
        scene_image_url=None, public_payload={}, private_payload={}, journey_version=1,
    )
    sample.db.add(node)
    await sample.db.commit()
    return node


async def test_empty_library_manual_video_links_confirms_and_creates_a_draft(sample, asset_dir):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    business_id, editor_id, viewer_id = sample.business.id, sample.editor.id, sample.viewer.id
    assert await sample.db.scalar(select(func.count()).select_from(library.Asset).where(library.Asset.business_id == business_id)) == 0
    original = await _manual_video(sample, _mp4(seconds=8), "Sessiz orijinal", business_id, editor_id)
    original_id, revision, knowledge_id = original.id, original.revision, knowledge.id
    steps = _steps(knowledge)
    with pytest.raises(HTTPException) as unlinked:
        await svc.create_draft(
            sample.db, business_id, editor_id, "Sessiz orijinal", "Atolye", steps,
            cover_asset_id=original_id, cover_kind="video",
        )
    assert unlinked.value.detail["code"] == "asset_choice_rejected"
    await sample.db.rollback()
    with pytest.raises(HTTPException) as viewer:
        await library.set_links(sample.db, business_id, viewer_id, original_id, [knowledge_id], revision)
    assert viewer.value.status_code == 403
    await sample.db.rollback()
    linked = await library.set_links(sample.db, business_id, editor_id, original_id, [knowledge_id], revision)
    with pytest.raises(HTTPException) as bare:
        await svc.create_draft(
            sample.db, business_id, editor_id, "Sessiz orijinal", "Atolye", steps,
            cover_asset_id=linked.id, cover_kind="video",
        )
    assert bare.value.detail["code"] == "cover_interval_required"
    await sample.db.rollback()
    ready = await retarget_cover(sample.db, business_id, editor_id, original_id, 0, 8)
    assert ready.status == "ready" and ready.strategy == "chosen_span" and ready.result_asset_id == original_id
    draft = await svc.create_draft(
        sample.db, business_id, editor_id, "Sessiz orijinal", "Atolye", steps,
        cover_asset_id=original_id, cover_kind="video",
    )
    assert draft.media_plan["coverKind"] == "video"
    assert draft.media_plan["coverAssetId"] == str(original_id)

    long = await _manual_video(sample, _mp4(seconds=40), "Uzun film", business_id, editor_id)
    long_id, long_revision = long.id, long.revision
    await library.set_links(sample.db, business_id, editor_id, long_id, [knowledge_id], long_revision)
    pending = await retarget_cover(sample.db, business_id, editor_id, long_id, 5, 15)
    assert pending.status == "awaiting_encode" and pending.result_asset_id is None
    derivative = await library.create_asset(sample.db, business_id, editor_id, {
        "asset_type": "video", "title": "Islenmis turev", "caption": "",
        "locator": "https://cdn.example/islenmis.mp4", "public_allowed": True,
    })
    derivative.source_asset_id = long_id
    derivative.verified_duration = 8000
    derivative.verified_timescale = 1000
    derivative.verified_size_bytes = 1000
    derivative.verified_has_audio = False
    await sample.db.commit()
    derivative = await library.set_links(sample.db, business_id, editor_id, derivative.id, [knowledge_id], derivative.revision)
    derivative_id, pending_id = derivative.id, pending.id
    with pytest.raises(HTTPException) as unready:
        await svc.create_draft(
            sample.db, business_id, editor_id, "Islenmis turev", "Atolye", steps,
            cover_asset_id=derivative_id, cover_kind="video",
        )
    assert unready.value.detail["code"] == "cover_not_ready"
    await sample.db.rollback()
    job = await sample.db.get(BusinessVideoCoverJob, pending_id)
    await sample.db.refresh(job)
    job.status = "ready"
    job.result_asset_id = derivative_id
    await sample.db.commit()
    processed = await svc.create_draft(
        sample.db, business_id, editor_id, "Islenmis turev", "Atolye", steps,
        cover_asset_id=derivative_id, cover_kind="video",
    )
    assert processed.media_plan["coverAssetId"] == str(derivative_id)
    assert processed.media_plan["coverKind"] == "video"


async def test_cover_job_identity_does_not_follow_the_latest_window(sample, asset_dir):
    from backend.routers.business_yansi import cover_job, cover_job_by_id, cover_job_retry

    business_id, editor_id, viewer_id = sample.business.id, sample.editor.id, sample.viewer.id
    film = await _manual_video(sample, _mp4(seconds=8), "Kimlik filmi", business_id, editor_id)
    film_id = film.id
    ready = await retarget_cover(sample.db, business_id, editor_id, film_id, 0, 8)
    pending = await retarget_cover(sample.db, business_id, editor_id, film_id, 1, 6)
    again = await retarget_cover(sample.db, business_id, editor_id, film_id, 0, 8)
    ready_id, pending_id = ready.id, pending.id
    assert again.id == ready_id
    assert pending_id != ready_id and pending.status == "awaiting_encode"
    assert (await latest_for_asset(sample.db, business_id, film_id)).id == pending_id
    assert (await job_for_source(sample.db, business_id, film_id, ready_id)).result_asset_id == film_id
    assert (await job_for_source(sample.db, business_id, film_id, pending_id)).result_asset_id is None
    assert await job_for_source(sample.db, uuid.uuid4(), film_id, ready_id) is None
    viewer_claims = {"user_id": str(viewer_id)}
    shown_ready = await cover_job_by_id(business_id, film_id, ready_id, sample.db, viewer_claims)
    shown_pending = await cover_job_by_id(business_id, film_id, pending_id, sample.db, viewer_claims)
    shown_latest = await cover_job(business_id, film_id, sample.db, viewer_claims)
    assert shown_ready["jobId"] == str(ready_id) and shown_ready["resultAssetId"] == str(film_id)
    assert shown_pending["jobId"] == str(pending_id) and shown_pending["resultAssetId"] is None
    assert shown_latest["jobId"] == str(pending_id)
    with pytest.raises(HTTPException) as missing:
        await cover_job_by_id(business_id, film_id, uuid.uuid4(), sample.db, viewer_claims)
    assert missing.value.status_code == 404
    failed = await sample.db.get(BusinessVideoCoverJob, pending_id)
    failed.status = "failed"
    failed.error_code = "cover_encode_failed"
    await sample.db.commit()
    with pytest.raises(HTTPException) as viewer_retry:
        await retry_cover(sample.db, business_id, viewer_id, film_id, pending_id)
    assert viewer_retry.value.status_code == 403
    await sample.db.rollback()
    retried = await cover_job_retry(business_id, film_id, pending_id, sample.db, {"user_id": str(editor_id)})
    assert retried["jobId"] == str(pending_id) and retried["status"] == "awaiting_encode"
    kept = await sample.db.get(BusinessVideoCoverJob, ready_id)
    assert kept.status == "ready" and kept.result_asset_id == film_id
    from datetime import timedelta

    stamp = datetime(2030, 1, 1, tzinfo=timezone.utc)
    low = uuid.UUID("00000000-0000-4000-8000-00000000000a")
    high = uuid.UUID("ffffffff-ffff-4fff-8fff-ffffffffffff")
    sample.db.add(BusinessVideoCoverJob(
        id=high, business_id=business_id, source_asset_id=film_id, idempotency_key="high-window",
        strategy="chosen_span", start_ticks=2000, end_ticks=4000, encoder_profile="silent-derivative-v1",
        status="queued", attempts=0, max_attempts=3, created_by=editor_id, created_at=stamp,
    ))
    sample.db.add(BusinessVideoCoverJob(
        id=low, business_id=business_id, source_asset_id=film_id, idempotency_key="low-window",
        strategy="chosen_span", start_ticks=3000, end_ticks=5000, encoder_profile="silent-derivative-v1",
        status="queued", attempts=0, max_attempts=3, created_by=editor_id,
        created_at=stamp + timedelta(microseconds=1),
    ))
    await sample.db.commit()
    assert (await latest_for_asset(sample.db, business_id, film_id)).id == low


async def test_stale_retarget_update_cannot_clear_a_ready_result(sample, asset_dir):
    business_id, editor_id = sample.business.id, sample.editor.id
    film = await _manual_video(sample, _mp4(seconds=40), "Yaris filmi", business_id, editor_id)
    derivative = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "video", "title": "Yaris turevi", "caption": "",
        "locator": "https://cdn.example/yaris.mp4", "public_allowed": True,
    })
    derivative.source_asset_id = film.id
    job = BusinessVideoCoverJob(
        id=uuid.uuid4(), business_id=business_id, source_asset_id=film.id,
        idempotency_key=uuid.uuid4().hex, strategy="chosen_span", start_ticks=0, end_ticks=8000,
        encoder_profile="silent-derivative-v1", status="ready", attempts=1, max_attempts=3,
        result_asset_id=derivative.id, created_by=sample.editor.id,
    )
    sample.db.add(job)
    await sample.db.commit()
    job_id, derivative_id = job.id, derivative.id
    outcome = await sample.db.execute(
        update(BusinessVideoCoverJob)
        .where(*mutable_window_clause(job_id, business_id))
        .values(status="awaiting_encode", result_asset_id=None, start_ticks=5000, end_ticks=15000)
        .execution_options(synchronize_session=False)
    )
    await sample.db.commit()
    assert outcome.rowcount == 0
    kept = await sample.db.get(BusinessVideoCoverJob, job_id)
    assert kept.status == "ready" and kept.result_asset_id == derivative_id and kept.start_ticks == 0
    assert await sample.db.scalar(
        select(func.count()).select_from(BusinessVideoCoverJob).where(BusinessVideoCoverJob.source_asset_id == film.id)
    ) == 1


async def test_legacy_sealed_derivative_publishes_after_its_job_result_was_cleared(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    business_id, editor_id, owner_id = sample.business.id, sample.editor.id, sample.owner.id
    original = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=40), purpose="step", title="Eski film"))
    derivative = await library.create_asset(sample.db, business_id, editor_id, {
        "asset_type": "video", "title": "Eski turev", "caption": "",
        "locator": "https://cdn.example/eski-turev.mp4", "public_allowed": True,
    })
    derivative.source_asset_id = original.id
    derivative.verified_duration = 8000
    derivative.verified_timescale = 1000
    derivative.verified_size_bytes = 1000
    derivative.verified_has_audio = False
    job = BusinessVideoCoverJob(
        id=uuid.uuid4(), business_id=business_id, source_asset_id=original.id,
        idempotency_key=uuid.uuid4().hex, strategy="chosen_span", start_ticks=0, end_ticks=8000,
        encoder_profile="silent-derivative-v1", status="ready", attempts=1, max_attempts=3,
        result_asset_id=derivative.id, created_by=editor_id,
    )
    sample.db.add(job)
    await sample.db.commit()
    derivative = await _confirm(sample, knowledge, derivative)
    steps = _steps(knowledge)
    draft = await svc.create_draft(
        sample.db, business_id, editor_id, "Eski turev", "Atolye", steps,
        cover_asset_id=derivative.id, cover_kind="video",
    )
    draft = await svc.transition_draft(sample.db, business_id, owner_id, draft.id, "review", draft.revision)
    draft = await svc.transition_draft(sample.db, business_id, owner_id, draft.id, "approved", draft.revision)
    sealed = draft.media_plan["seal"]
    approved_cover = draft.media_plan["coverAssetId"]
    draft_id = draft.id
    assert sealed == media.media_seal(draft.media_plan)
    job.result_asset_id = None
    job.status = "awaiting_encode"
    await sample.db.commit()
    derivative_id = derivative.id
    with pytest.raises(HTTPException) as fresh:
        await svc.create_draft(
            sample.db, business_id, editor_id, "Yeni turev", "Atolye", steps,
            cover_asset_id=derivative_id, cover_kind="video",
        )
    assert fresh.value.detail["code"] == "cover_not_ready"
    await sample.db.rollback()
    draft = await sample.db.get(BusinessYansiDraft, draft_id)
    await sample.db.refresh(draft)
    node = await _node(sample, draft, "eski-turev-yayin", business_id, editor_id)
    _freeze(monkeypatch, steps)
    await publish_draft(sample.db, business_id, owner_id, draft.id, node.slug, draft.revision)
    await sample.db.refresh(draft)
    published = await sample.db.get(BusinessPublication, (node.slug, node.journey_version))
    assert draft.status == "published"
    assert draft.media_plan["seal"] == sealed and draft.media_plan["coverAssetId"] == approved_cover
    assert published.media_plan["seal"] == sealed and published.media_plan["coverAssetId"] == approved_cover
    assert published.media_plan["blocks"] == draft.media_plan["blocks"]


async def test_existing_seal_rejects_a_different_cover_asset(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    business_id, editor_id, owner_id = sample.business.id, sample.editor.id, sample.owner.id
    image = await _confirm(sample, knowledge, await library.create_asset(sample.db, business_id, editor_id, {
        "asset_type": "image", "title": "Onayli gorsel", "caption": "", "public_allowed": True,
    }, image_bytes=_PNG))
    other = await _confirm(sample, knowledge, await library.create_asset(sample.db, business_id, editor_id, {
        "asset_type": "image", "title": "Baska gorsel", "caption": "", "public_allowed": True,
    }, image_bytes=_PNG))
    steps = _steps(knowledge)
    image_id, other_id = image.id, other.id
    draft = await svc.create_draft(
        sample.db, business_id, editor_id, "Onayli gorsel", "Atolye", steps, cover_asset_id=image_id,
    )
    draft = await svc.transition_draft(sample.db, business_id, owner_id, draft.id, "review", draft.revision)
    draft = await svc.transition_draft(sample.db, business_id, owner_id, draft.id, "approved", draft.revision)
    sealed = draft.media_plan["seal"]
    approved_cover = draft.media_plan["coverAssetId"]
    draft_id = draft.id
    replaced = dict(draft.media_plan)
    replaced["coverAssetId"] = str(other_id)
    draft.media_plan = replaced
    await sample.db.commit()
    assert media.media_seal(draft.media_plan) != sealed
    node = await _node(sample, draft, "degisen-kapak", business_id, editor_id)
    publication_key = (node.slug, node.journey_version)
    _freeze(monkeypatch, steps)
    with pytest.raises(HTTPException) as mismatch:
        await publish_draft(sample.db, business_id, owner_id, draft.id, node.slug, draft.revision)
    assert mismatch.value.detail["code"] == "sealed_media_mismatch"
    await sample.db.rollback()
    draft = await sample.db.get(BusinessYansiDraft, draft_id)
    await sample.db.refresh(draft)
    assert draft.status == "approved"
    assert draft.media_plan["seal"] == sealed
    assert draft.media_plan["coverAssetId"] == str(other_id)
    assert await sample.db.get(BusinessPublication, publication_key) is None
    assert approved_cover == str(image_id)


async def test_confirmed_intervals_keep_separate_job_identities(sample, asset_dir):
    from backend.routers.business_yansi import cover_job_by_id
    from backend.services.business_yansi.cover_jobs import claim_encode, complete_owned, present_job

    business_id, editor_id, viewer_id = sample.business.id, sample.editor.id, sample.viewer.id
    film = await _manual_video(sample, _mp4(seconds=40), "Iki kesit", business_id, editor_id)
    film_id = film.id
    first = await retarget_cover(sample.db, business_id, editor_id, film_id, 1, 6)
    second = await retarget_cover(sample.db, business_id, editor_id, film_id, 0, 8)
    first_id, second_id = first.id, second.id
    assert first_id != second_id
    assert first.start_ticks == 1000 and first.end_ticks == 6000
    assert second.start_ticks == 0 and second.end_ticks == 8000
    shown = await cover_job_by_id(business_id, film_id, first_id, sample.db, {"user_id": str(viewer_id)})
    assert shown["jobId"] == str(first_id)
    assert shown["startSeconds"] == 1 and shown["endSeconds"] == 6
    assert present_job(second, 1000)["jobId"] == str(second_id)
    again = await retarget_cover(sample.db, business_id, editor_id, film_id, 1, 6)
    assert again.id == first_id and again.start_ticks == 1000 and again.end_ticks == 6000
    failed = await sample.db.get(BusinessVideoCoverJob, first_id)
    failed.status = "failed"
    failed.error_code = "cover_encode_failed"
    await sample.db.commit()
    retried = await retry_cover(sample.db, business_id, editor_id, film_id, first_id)
    assert retried.id == first_id and retried.start_ticks == 1000 and retried.end_ticks == 6000
    untouched = await sample.db.get(BusinessVideoCoverJob, second_id)
    assert untouched.status == "awaiting_encode" and untouched.start_ticks == 0 and untouched.end_ticks == 8000
    claimed_first = await claim_encode(sample.db)
    await sample.db.commit()
    assert claimed_first.id == first_id
    assert await complete_owned(
        sample.db, first_id, business_id, claimed_first.claim_token,
        values={"status": "ready", "result_asset_id": film_id},
    )
    await sample.db.commit()
    claimed_second = await claim_encode(sample.db)
    await sample.db.commit()
    assert claimed_second.id == second_id
    assert await complete_owned(
        sample.db, second_id, business_id, claimed_second.claim_token,
        values={"status": "ready", "result_asset_id": film_id},
    )
    await sample.db.commit()
    kept = await sample.db.get(BusinessVideoCoverJob, first_id)
    finished = await sample.db.get(BusinessVideoCoverJob, second_id)
    assert kept.status == "ready" and kept.start_ticks == 1000 and kept.end_ticks == 6000
    assert finished.status == "ready" and finished.start_ticks == 0 and finished.end_ticks == 8000


async def test_revision_preserves_manual_cover_kind(sample, asset_dir):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    business_id, editor_id, owner_id = sample.business.id, sample.editor.id, sample.owner.id
    knowledge_id = knowledge.id
    uploaded = await _manual_video(sample, _mp4(seconds=8), "Ilk sessiz", business_id, editor_id)
    original = await library.set_links(
        sample.db, business_id, editor_id, uploaded.id, [knowledge_id], uploaded.revision,
    )
    original_id = original.id
    await retarget_cover(sample.db, business_id, editor_id, original_id, 0, 8)
    steps = _steps(knowledge)
    draft = await svc.create_draft(
        sample.db, business_id, editor_id, "Ilk sessiz", "Atolye", steps,
        cover_asset_id=original_id, cover_kind="video",
    )
    draft_id = draft.id
    uploaded_other = await _manual_video(sample, _mp4(seconds=8), "Ikinci sessiz", business_id, editor_id)
    other = await library.set_links(
        sample.db, business_id, editor_id, uploaded_other.id, [knowledge_id], uploaded_other.revision,
    )
    other_id = other.id
    with pytest.raises(HTTPException) as missing:
        await svc.revise_draft(
            sample.db, business_id, editor_id, draft_id, draft.revision,
            draft.title, draft.summary, steps, cover_asset_id=other_id,
        )
    assert missing.value.detail["code"] == "cover_interval_required"
    await sample.db.rollback()
    draft = await sample.db.get(BusinessYansiDraft, draft_id)
    await sample.db.refresh(draft)
    assert draft.media_plan["coverKind"] == "video"
    assert draft.media_plan["coverAssetId"] == str(original_id)
    await retarget_cover(sample.db, business_id, editor_id, other_id, 0, 8)
    revised = await svc.revise_draft(
        sample.db, business_id, editor_id, draft_id, draft.revision,
        draft.title, draft.summary, steps, cover_asset_id=other_id,
    )
    assert revised.media_plan["coverKind"] == "video"
    assert revised.media_plan["coverAssetId"] == str(other_id)
    created_image = await library.create_asset(sample.db, business_id, editor_id, {
        "asset_type": "image", "title": "Gorsel kapak", "caption": "", "public_allowed": True,
    }, image_bytes=_PNG)
    image = await library.set_links(
        sample.db, business_id, editor_id, created_image.id, [knowledge_id], created_image.revision,
    )
    image_id = image.id
    switched = await svc.revise_draft(
        sample.db, business_id, editor_id, revised.id, revised.revision,
        revised.title, revised.summary, steps, cover_asset_id=image_id,
        cover_kind="image", cover_kind_specified=True,
    )
    assert switched.media_plan["coverKind"] == "image"
    assert switched.media_plan["coverAssetId"] == str(image_id)
    restored = await svc.revise_draft(
        sample.db, business_id, editor_id, switched.id, switched.revision,
        switched.title, switched.summary, steps, cover_asset_id=other_id,
        cover_kind="video", cover_kind_specified=True,
    )
    assert restored.media_plan["coverKind"] == "video"
    assert restored.media_plan["coverAssetId"] == str(other_id)
    uploaded_legacy = await _manual_video(sample, _mp4(seconds=8), "Eski sessiz", business_id, editor_id)
    legacy_video = await library.set_links(
        sample.db, business_id, editor_id, uploaded_legacy.id, [knowledge_id], uploaded_legacy.revision,
    )
    legacy = await svc.create_draft(
        sample.db, business_id, editor_id, "Eski sessiz", "Atolye", steps, cover_asset_id=legacy_video.id,
    )
    assert "coverKind" not in legacy.media_plan
    legacy_kept = await svc.revise_draft(
        sample.db, business_id, editor_id, legacy.id, legacy.revision,
        legacy.title, legacy.summary, steps, cover_asset_id=original_id,
    )
    assert "coverKind" not in legacy_kept.media_plan
    assert legacy_kept.media_plan["coverAssetId"] == str(original_id)
    reviewed = await svc.transition_draft(
        sample.db, business_id, editor_id, restored.id, "review", restored.revision,
    )
    evidence = await sample.db.scalar(
        select(BusinessVideoCoverJob).where(
            BusinessVideoCoverJob.business_id == business_id,
            BusinessVideoCoverJob.result_asset_id == other_id,
            BusinessVideoCoverJob.status == "ready",
        )
    )
    evidence.status = "failed"
    evidence.result_asset_id = None
    await sample.db.commit()
    reviewed_id, reviewed_revision = reviewed.id, reviewed.revision
    with pytest.raises(HTTPException) as approval:
        await svc.transition_draft(
            sample.db, business_id, owner_id, reviewed_id, "approved", reviewed_revision,
        )
    assert approval.value.detail["code"] == "cover_interval_required"
    await sample.db.rollback()
    reviewed = await sample.db.get(BusinessYansiDraft, reviewed_id)
    await sample.db.refresh(reviewed)
    assert reviewed.status == "review"
    assert reviewed.media_plan["coverKind"] == "video"
    assert reviewed.media_plan["coverAssetId"] == str(other_id)


async def test_sqlite_confirmation_rollback_leaves_no_ready_job(sample, asset_dir, monkeypatch):
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from backend.services.business_yansi import cover_jobs as covers

    real_apply = covers.apply_ready_cover
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    business_id, editor_id, owner_id = sample.business.id, sample.editor.id, sample.owner.id
    knowledge_id = knowledge.id
    steps = _steps(knowledge)
    approved_video = await _manual_video(sample, _mp4(seconds=8), "Onayli sessiz", business_id, editor_id)
    approved_video = await library.set_links(
        sample.db, business_id, editor_id, approved_video.id, [knowledge_id], approved_video.revision,
    )
    approved_id = approved_video.id
    ready = await retarget_cover(sample.db, business_id, editor_id, approved_id, 0, 8)
    ready_id = ready.id
    assert ready.status == "ready" and ready.strategy == "chosen_span" and ready.result_asset_id == approved_id
    await sample.db.rollback()
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as other:
        stored = await other.get(BusinessVideoCoverJob, ready_id)
        assert stored is not None and stored.status == "ready" and stored.result_asset_id == approved_id
    draft = await svc.create_draft(
        sample.db, business_id, editor_id, "Onayli sessiz", "Atolye", steps,
        cover_asset_id=approved_id, cover_kind="video",
    )
    draft = await svc.transition_draft(sample.db, business_id, owner_id, draft.id, "review", draft.revision)
    draft = await svc.transition_draft(sample.db, business_id, owner_id, draft.id, "approved", draft.revision)
    draft_id, draft_revision = draft.id, draft.revision
    sealed = draft.media_plan["seal"]
    approved_cover = draft.media_plan["coverAssetId"]
    failed_video = await _manual_video(sample, _mp4(seconds=8), "Yarim kalan", business_id, editor_id)
    failed_video = await library.set_links(
        sample.db, business_id, editor_id, failed_video.id, [knowledge_id], failed_video.revision,
    )
    failed_id = failed_video.id

    async def abort_after_insert(_db, _job):
        raise RuntimeError("cover-confirmation-aborted")

    monkeypatch.setattr(covers, "apply_ready_cover", abort_after_insert)
    with pytest.raises(RuntimeError, match="cover-confirmation-aborted"):
        await retarget_cover(sample.db, business_id, editor_id, failed_id, 0, 8)
    await sample.db.rollback()
    async with async_sessionmaker(sample.db.bind, expire_on_commit=False)() as other:
        leaked = (await other.scalars(
            select(BusinessVideoCoverJob).where(BusinessVideoCoverJob.source_asset_id == failed_id)
        )).all()
        assert leaked == []
        ready_evidence = await other.scalar(
            select(func.count()).select_from(BusinessVideoCoverJob).where(
                BusinessVideoCoverJob.source_asset_id == failed_id,
                BusinessVideoCoverJob.strategy == "chosen_span",
                BusinessVideoCoverJob.status == "ready",
            )
        )
        assert ready_evidence == 0
    with pytest.raises(HTTPException) as rejected:
        await svc.create_draft(
            sample.db, business_id, editor_id, "Yarim kalan", "Atolye", steps,
            cover_asset_id=failed_id, cover_kind="video",
        )
    assert rejected.value.detail["code"] == "cover_interval_required"
    await sample.db.rollback()
    monkeypatch.setattr(covers, "apply_ready_cover", real_apply)
    repeated = await retarget_cover(sample.db, business_id, editor_id, approved_id, 0, 8)
    assert repeated.id == ready_id and repeated.start_ticks == 0 and repeated.end_ticks == 8000
    original_scalar = sample.db.scalar
    hidden = {"once": True}

    async def hide_existing_key(statement, *args, **kwargs):
        if hidden["once"] and "idempotency_key" in str(statement):
            hidden["once"] = False
            return None
        return await original_scalar(statement, *args, **kwargs)

    sample.db.scalar = hide_existing_key
    try:
        conflict = await retarget_cover(sample.db, business_id, editor_id, approved_id, 0, 8)
    finally:
        sample.db.scalar = original_scalar
    assert hidden["once"] is False
    assert conflict.id == ready_id and conflict.start_ticks == 0 and conflict.end_ticks == 8000
    other_window = await retarget_cover(sample.db, business_id, editor_id, approved_id, 1, 6)
    assert other_window.id != ready_id
    assert other_window.start_ticks == 1000 and other_window.end_ticks == 6000
    kept = await sample.db.get(BusinessVideoCoverJob, ready_id)
    await sample.db.refresh(kept)
    assert kept.status == "ready" and kept.start_ticks == 0 and kept.end_ticks == 8000
    assert kept.result_asset_id == approved_id
    draft = await sample.db.get(BusinessYansiDraft, draft_id)
    await sample.db.refresh(draft)
    assert draft.status == "approved" and draft.revision == draft_revision
    node = await _node(sample, draft, "onayli-sessiz-yayin", business_id, editor_id)
    _freeze(monkeypatch, steps)
    await publish_draft(sample.db, business_id, owner_id, draft_id, node.slug, draft.revision)
    await sample.db.refresh(draft)
    published = await sample.db.get(BusinessPublication, (node.slug, node.journey_version))
    assert draft.status == "published"
    assert draft.media_plan["seal"] == sealed and draft.media_plan["coverAssetId"] == approved_cover
    assert published.media_plan["seal"] == sealed and published.media_plan["coverAssetId"] == approved_cover
