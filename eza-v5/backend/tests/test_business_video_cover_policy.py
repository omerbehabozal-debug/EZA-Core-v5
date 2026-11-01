"""Cover selection uses the duration and size recorded at ingest."""
import uuid

import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock

from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_yansi import BusinessPublication, BusinessYansiDraft
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.brand_assets import normalize_asset
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.services.business_yansi.video_ingest import COVER_MAX_BYTES, COVER_MAX_SECONDS, ingest_upload
from backend.services.business_yansi.video_storage import MemoryVideoStore
from backend.tests.test_business_video_storage import Upload, VideoQuotaRedis, _mp4
from backend.tests.test_business_yansi import sample, source


_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24


@pytest.fixture(autouse=True)
def _budget_and_probe(monkeypatch):
    quota = VideoQuotaRedis()

    async def client():
        return quota

    monkeypatch.setattr("backend.services.business_yansi.video_ingest._redis", client)

    async def accept(_path: str) -> None:
        return None

    monkeypatch.setattr("backend.services.business_yansi.video_mp4.probe_file", accept)


@pytest.fixture
def asset_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path))
    return tmp_path


def _steps(knowledge):
    return [
        {"question": f"Atolye adimi {index}?", "answer": knowledge.content, "sources": [str(knowledge.id)]}
        for index in range(8)
    ]


def _sized(seconds: int, total: int) -> bytes:
    bare = _mp4(seconds=seconds)
    body = _mp4(seconds=seconds, pad=total - len(bare))
    assert len(body) == total
    return body


async def _stored(sample, body: bytes, *, purpose: str, title: str = "Atolye filmi"):
    return await ingest_upload(
        sample.db,
        sample.business.id,
        sample.editor.id,
        store=MemoryVideoStore(),
        upload=Upload(body),
        title=title,
        caption="",
        purpose=purpose,
        public_allowed=True,
    )


async def _confirm(sample, knowledge, row):
    return await library.set_links(
        sample.db, sample.business.id, sample.editor.id, row.id, [knowledge.id], row.revision,
    )


async def test_step_video_cover_uses_verified_duration_and_size(sample, asset_dir):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    long = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=40), purpose="step"))
    short = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=12), purpose="step", title="Kisa film"))
    exact = await _confirm(
        sample, knowledge, await _stored(sample, _sized(20, COVER_MAX_BYTES), purpose="step", title="Sinir filmi"),
    )
    heavy = await _confirm(
        sample, knowledge, await _stored(sample, _sized(12, 16 * 1024 * 1024), purpose="step", title="Agir film"),
    )
    assert long.verified_timescale == 1000
    assert long.verified_duration == 40 * 1000
    assert long.verified_duration > COVER_MAX_SECONDS * long.verified_timescale
    assert exact.verified_duration == 20 * exact.verified_timescale
    assert exact.verified_size_bytes == COVER_MAX_BYTES
    assert heavy.verified_size_bytes == 16 * 1024 * 1024
    assert heavy.verified_duration <= COVER_MAX_SECONDS * heavy.verified_timescale
    steps = _steps(knowledge)
    assert media.select_step_blocks("Atolye filmi nedir?", knowledge.content, [long])[0]["assetId"] == str(long.id)
    with pytest.raises(HTTPException) as rejected:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye", steps, cover_asset_id=long.id,
        )
    assert rejected.value.detail["code"] == "video_cover_rejected"
    long.locator_kind = "https"
    long.locator = "https://cdn.example/long.mp4"
    await sample.db.commit()
    with pytest.raises(HTTPException) as rewritten:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye", steps, cover_asset_id=long.id,
        )
    assert rewritten.value.detail["code"] == "video_cover_rejected"
    with pytest.raises(HTTPException) as heavy_rejected:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye", steps, cover_asset_id=heavy.id,
        )
    assert heavy_rejected.value.detail["code"] == "video_cover_rejected"
    chosen = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Baska baslik", "Baska", steps, cover_asset_id=short.id,
    )
    assert chosen.media_plan["coverAssetId"] == str(short.id)
    bounded = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Baska baslik", "Baska", steps, cover_asset_id=exact.id,
    )
    assert bounded.media_plan["coverAssetId"] == str(exact.id)
    shown = library.present_asset(exact, [])
    assert "verified_duration" not in shown and "verified_size_bytes" not in shown
    assert shown["locator"] is None and shown["locator_kind"] == "storage"


async def test_automatic_cover_uses_the_same_limits(sample, asset_dir):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=40), purpose="step"))
    skipped = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye filmi", _steps(knowledge),
    )
    assert skipped.media_plan["coverAssetId"] is None
    short = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=12), purpose="step"))
    picked = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye filmi", _steps(knowledge),
    )
    assert picked.media_plan["coverAssetId"] == str(short.id)


async def test_missing_and_untrusted_measurements_are_rejected(sample, asset_dir):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    missing = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=12), purpose="step", title="Eski film"))
    missing.verified_duration = None
    missing.verified_timescale = None
    missing.verified_size_bytes = None
    await sample.db.commit()
    steps = _steps(knowledge)
    with pytest.raises(HTTPException) as absent:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id, "Baska", "Baska", steps, cover_asset_id=missing.id,
        )
    assert absent.value.detail["code"] == "video_cover_rejected"
    broken = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=12), purpose="step", title="Bozuk film"))
    broken.verified_timescale = 0
    await sample.db.commit()
    with pytest.raises(HTTPException) as untrusted:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id, "Baska", "Baska", steps, cover_asset_id=broken.id,
        )
    assert untrusted.value.detail["code"] == "video_cover_rejected"


async def test_foreign_and_archived_videos_are_rejected(sample, asset_dir):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    archived = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=12), purpose="step"))
    archived = await library.archive_asset(
        sample.db, sample.business.id, sample.editor.id, archived.id, archived.revision,
    )
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id), "slug": "akdeniz", "name": "Akdeniz",
    })
    fields = normalize_asset(
        business_id=other.id,
        asset_type="video",
        title="Atolye filmi",
        locator_kind="storage",
        locator=f"brand-videos/{other.id}/{'ab' * 32}.mp4",
    )
    foreign = BusinessBrandAsset(business_id=other.id, created_by=sample.outsider.id, revision=1)
    library._apply_fields(foreign, fields, sample.outsider.id, True)
    foreign.verified_duration = 12 * 1000
    foreign.verified_timescale = 1000
    foreign.verified_size_bytes = 1000
    sample.db.add(foreign)
    await sample.db.commit()
    steps = _steps(knowledge)
    for cover in (archived.id, foreign.id):
        with pytest.raises(HTTPException) as rejected:
            await svc.create_draft(
                sample.db, sample.business.id, sample.editor.id, "Baska", "Baska", steps, cover_asset_id=cover,
            )
        assert rejected.value.detail["code"] == "asset_choice_rejected"


async def test_draft_update_and_publication_cannot_bypass_the_cover(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    image = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Atolye gorseli", "caption": "", "public_allowed": True,
    }, image_bytes=_PNG)
    image = await _confirm(sample, knowledge, image)
    long = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=40), purpose="step"))
    steps = _steps(knowledge)
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps, cover_asset_id=image.id,
    )
    assert draft.media_plan["coverAssetId"] == str(image.id)
    business_id, owner_id, editor_id = sample.business.id, sample.owner.id, sample.editor.id
    image_id, long_id, draft_id = image.id, long.id, draft.id
    with pytest.raises(HTTPException) as revised:
        await svc.revise_draft(
            sample.db, business_id, editor_id, draft_id, draft.revision,
            "Atolye gorseli", "Atolye", steps, cover_asset_id=long_id,
        )
    assert revised.value.detail["code"] == "video_cover_rejected"
    await sample.db.rollback()
    draft = await sample.db.get(BusinessYansiDraft, draft_id)
    draft = await svc.transition_draft(sample.db, business_id, owner_id, draft.id, "review", draft.revision)
    draft.media_plan = {**draft.media_plan, "coverAssetId": str(long_id)}
    await sample.db.commit()
    with pytest.raises(HTTPException) as approval:
        await svc.transition_draft(sample.db, business_id, owner_id, draft.id, "approved", draft.revision)
    assert approval.value.detail["code"] == "video_cover_rejected"
    await sample.db.rollback()
    draft = await sample.db.get(BusinessYansiDraft, draft_id)
    draft.media_plan = {"coverAssetId": str(image_id), "blocks": draft.media_plan["blocks"], "seal": None}
    await sample.db.commit()
    draft = await svc.transition_draft(sample.db, business_id, owner_id, draft.id, "approved", draft.revision)
    assert draft.media_plan["coverAssetId"] == str(image.id)
    assert draft.media_plan["seal"] == media.media_seal(draft.media_plan)
    await export_editorial_conversation(sample.db, business_id, editor_id, draft.id)
    await sample.db.refresh(draft)
    conversation = await sample.db.get(StandaloneConversation, draft.conversation_id)
    node = MirrorNetworkNode(
        slug="atolye-kapak", user_id=draft.created_by, conversation_id=conversation.client_conversation_id,
        visibility="private", safety_status="open", card_title="Atolye", card_date="2026-10-31",
        scene_image_url=None, public_payload={}, private_payload={}, journey_version=1,
    )
    swapped = {
        "coverAssetId": str(long_id),
        "blocks": draft.media_plan["blocks"],
        "seal": None,
    }
    swapped["seal"] = media.media_seal(swapped)
    draft.media_plan = swapped
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
    with pytest.raises(HTTPException) as published:
        await publish_draft(sample.db, business_id, owner_id, draft.id, node.slug, draft.revision)
    assert published.value.detail["code"] == "video_cover_rejected"


async def test_unmeasured_https_video_is_rejected_for_every_new_cover(sample, asset_dir):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    remote = await _confirm(sample, knowledge, await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "video", "title": "Atolye filmi", "caption": "",
        "locator": "https://cdn.example/atolye.mp4", "public_allowed": True,
    }))
    assert remote.verified_duration is None and remote.verified_timescale is None and remote.verified_size_bytes is None
    steps = _steps(knowledge)
    with pytest.raises(HTTPException) as manual:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id, "Baska", "Baska", steps, cover_asset_id=remote.id,
        )
    assert manual.value.detail["code"] == "video_cover_rejected"
    automatic = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye filmi", "Atolye filmi", steps,
    )
    assert automatic.media_plan["coverAssetId"] is None
    stepped = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Baska", "Baska", steps,
        media_choices=[[{"type": "video", "assetId": str(remote.id)}]] + [[] for _ in range(7)],
    )
    assert stepped.media_plan["coverAssetId"] is None
    assert stepped.media_plan["blocks"][0] == [{"type": "video", "assetId": str(remote.id)}]


async def test_locator_change_forgets_the_old_measurement(sample, asset_dir):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    short = await _confirm(sample, knowledge, await _stored(sample, _mp4(seconds=12), purpose="step", title="Kisa film"))
    duration, scale, size = short.verified_duration, short.verified_timescale, short.verified_size_bytes
    renamed = await library.update_asset(sample.db, sample.business.id, sample.editor.id, short.id, {
        "title": "Kisa film notu", "caption": "", "public_allowed": True, "revision": short.revision,
    })
    assert (renamed.verified_duration, renamed.verified_timescale, renamed.verified_size_bytes) == (duration, scale, size)
    assert renamed.verified_has_audio is False
    assert renamed.locator_kind == "storage"
    moved = await library.update_asset(sample.db, sample.business.id, sample.editor.id, renamed.id, {
        "title": "Kisa film notu", "caption": "", "locator": "https://cdn.example/kisa.mp4",
        "public_allowed": True, "revision": renamed.revision,
    })
    assert moved.locator_kind == "https" and moved.locator == "https://cdn.example/kisa.mp4"
    assert moved.verified_duration is None and moved.verified_timescale is None and moved.verified_size_bytes is None
    assert moved.verified_has_audio is None
    steps = _steps(knowledge)
    with pytest.raises(HTTPException) as rejected:
        await svc.create_draft(
            sample.db, sample.business.id, sample.editor.id, "Baska", "Baska", steps, cover_asset_id=moved.id,
        )
    assert rejected.value.detail["code"] == "video_cover_rejected"
    stepped = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Baska", "Baska", steps,
        media_choices=[[{"type": "video", "assetId": str(moved.id)}]] + [[] for _ in range(7)],
    )
    assert stepped.media_plan["blocks"][0] == [{"type": "video", "assetId": str(moved.id)}]
    assert stepped.media_plan["coverAssetId"] is None


async def test_published_https_cover_stays_readable_and_a_draft_cannot_publish_one(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Atolye filmi kapak secimi icin yeterince aciktir.")
    remote = await _confirm(sample, knowledge, await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "video", "title": "Eski film", "caption": "",
        "locator": "https://cdn.example/eski.mp4", "public_allowed": True,
    }))
    image = await _confirm(sample, knowledge, await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Atolye gorseli", "caption": "", "public_allowed": True,
    }, image_bytes=_PNG))
    steps = _steps(knowledge)
    historical = {"coverAssetId": str(remote.id), "blocks": [[] for _ in range(8)], "seal": None}
    sample.db.add(MirrorNetworkNode(
        slug="eski-kapak", user_id=sample.owner.id, visibility="public", safety_status="open",
        card_title="Eski", card_date="2026-10-31", public_payload={}, private_payload={},
    ))
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye", steps, cover_asset_id=image.id,
    )
    sample.db.add(BusinessPublication(
        slug="eski-kapak", journey_version=1, business_id=sample.business.id, draft_id=draft.id,
        knowledge_snapshot=[], media_plan=historical, published_by=sample.owner.id,
    ))
    await sample.db.commit()
    shown = await media.publication_media(sample.db, "eski-kapak", 1)
    assert shown["cover"]["href"] == "https://cdn.example/eski.mp4"
    assert shown["cover"]["assetId"] == str(remote.id)
    stored = await sample.db.get(BusinessPublication, ("eski-kapak", 1))
    assert stored.media_plan["coverAssetId"] == str(remote.id)

    business_id, owner_id, editor_id = sample.business.id, sample.owner.id, sample.editor.id
    image_id, remote_id, draft_id = image.id, remote.id, draft.id
    draft = await svc.transition_draft(sample.db, business_id, editor_id, draft_id, "review", draft.revision)
    draft.media_plan = {**draft.media_plan, "coverAssetId": str(remote_id)}
    await sample.db.commit()
    with pytest.raises(HTTPException) as approval:
        await svc.transition_draft(sample.db, business_id, owner_id, draft.id, "approved", draft.revision)
    assert approval.value.detail["code"] == "video_cover_rejected"
    await sample.db.rollback()
    draft = await sample.db.get(BusinessYansiDraft, draft_id)
    draft.media_plan = {"coverAssetId": str(image_id), "blocks": draft.media_plan["blocks"], "seal": None}
    await sample.db.commit()
    draft = await svc.transition_draft(sample.db, business_id, owner_id, draft.id, "approved", draft.revision)
    await export_editorial_conversation(sample.db, business_id, editor_id, draft.id)
    await sample.db.refresh(draft)
    conversation = await sample.db.get(StandaloneConversation, draft.conversation_id)
    node = MirrorNetworkNode(
        slug="yeni-kapak", user_id=draft.created_by, conversation_id=conversation.client_conversation_id,
        visibility="private", safety_status="open", card_title="Yeni", card_date="2026-10-31",
        scene_image_url=None, public_payload={}, private_payload={}, journey_version=1,
    )
    swapped = {"coverAssetId": str(remote_id), "blocks": draft.media_plan["blocks"], "seal": None}
    swapped["seal"] = media.media_seal(swapped)
    draft.media_plan = swapped
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
    with pytest.raises(HTTPException) as published:
        await publish_draft(sample.db, business_id, owner_id, draft.id, node.slug, draft.revision)
    assert published.value.detail["code"] == "video_cover_rejected"
    again = await media.publication_media(sample.db, "eski-kapak", 1)
    assert again["cover"]["href"] == "https://cdn.example/eski.mp4"
    assert again["cover"]["assetId"] == str(remote_id)
