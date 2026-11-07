"""Automatic covers follow the Yansı text, not the newest video job."""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from backend.models.business_yansi import BusinessPublication
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.cover_jobs import latest_for_asset, process_one
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.services.business_yansi.video_ingest import ingest_upload
from backend.services.business_yansi.video_storage import MemoryVideoStore
from backend.tests.test_business_video_cover_policy import _confirm, asset_dir, sample
from backend.tests.brand_library_image_fixtures import distinct_library_png
from backend.tests.test_business_video_storage import Upload, VideoQuotaRedis, _mp4
from backend.tests.test_business_yansi import source

_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


class _Asset:
    def __init__(self, asset_id, asset_type, title, caption=""):
        self.id = asset_id
        self.asset_type = asset_type
        self.title = title
        self.caption = caption
        self.verified_duration = 8_000
        self.verified_timescale = 1000
        self.verified_size_bytes = 200
        self.verified_has_audio = False


@pytest.fixture(autouse=True)
def _quota_and_probe(monkeypatch):
    quota = VideoQuotaRedis()

    async def client():
        return quota

    async def accept(_path: str) -> None:
        return None

    monkeypatch.setattr("backend.services.business_yansi.video_ingest._redis", client)
    monkeypatch.setattr("backend.services.business_yansi.video_mp4.probe_file", accept)


def test_images_and_silent_videos_share_one_score():
    image = _Asset("00000000-0000-4000-8000-000000000010", "image", "Zeytinyagi")
    closer_video = _Asset("00000000-0000-4000-8000-000000000099", "video", "Zeytinyagi hasadi ozeti")
    tied_video = _Asset("00000000-0000-4000-8000-000000000002", "video", "Zeytinyagi")
    earlier_image = _Asset("00000000-0000-4000-8000-000000000001", "image", "Zeytinyagi")
    lamp = _Asset("00000000-0000-4000-8000-000000000030", "image", "Lamba isigi")
    steps = [{"question": "Lamba isigi nerede?", "answer": "Lamba isigi aksam yanar."}]
    assert media.select_cover("Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", [image, closer_video]) == str(closer_video.id)
    assert media.select_cover("Zeytinyagi kaydi", "", [image, tied_video]) == str(tied_video.id)
    assert media.select_cover("Zeytinyagi kaydi", "", [tied_video, earlier_image]) == str(earlier_image.id)
    assert media.select_cover("Baska konu", "Baska ozet", [image, lamp], steps) == str(lamp.id)
    assert media.select_cover("Baska konu", "Baska ozet", [image, tied_video]) is None


def _phrase_steps(knowledge, phrase):
    return [
        {"question": f"{phrase} nedir?", "answer": knowledge.content, "sources": [str(knowledge.id)]}
        for _index in range(8)
    ]


async def _image(sample, knowledge, title):
    row = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": title, "caption": "", "public_allowed": True,
    }, image_bytes=distinct_library_png(title.encode()))
    return await _confirm(sample, knowledge, row)


async def _video(sample, store, knowledge, title):
    from backend.services.business_yansi.cover_jobs import ensure_cover_job
    row = await ingest_upload(
        sample.db, sample.business.id, sample.editor.id, store=store, upload=Upload(_mp4(seconds=8)),
        title=title, caption="", purpose="step", public_allowed=True,
    )
    await ensure_cover_job(sample.db, row, sample.editor.id)
    await sample.db.flush()
    return await _confirm(sample, knowledge, row)


async def _ready(sample, asset):
    """Finish this asset's job. Claim order follows created_at and id, not upload order."""
    for _ignored in range(8):
        current = await latest_for_asset(sample.db, sample.business.id, asset.id)
        if current is not None and current.status == "ready":
            assert current.result_asset_id == asset.id
            return current
        claimed = await process_one(sample.db)
        await sample.db.commit()
        if claimed is None:
            break
    current = await latest_for_asset(sample.db, sample.business.id, asset.id)
    assert current is not None and current.source_asset_id == asset.id and current.status == "ready"
    assert current.result_asset_id == asset.id
    return current


async def test_context_ranks_covers_and_a_finished_job_does_not_replace_one(sample, asset_dir, monkeypatch):
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    olive_steps = _phrase_steps(knowledge, "Zeytinyagi hasadi")
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id), "slug": "baska-secim", "name": "Baska",
    })
    foreign = await library.create_asset(sample.db, other.id, sample.outsider.id, {
        "asset_type": "image", "title": "Zeytinyagi hasadi", "caption": "", "public_allowed": True,
    }, image_bytes=distinct_library_png(b"foreign"))
    images = [
        await _image(sample, knowledge, title)
        for title in (
            "Zeytinyagi", "Lamba isigi", "Depo rafti", "Masa ortusu", "Kapi kolu", "Zeytinyagi hasadi",
        )
    ]
    olive, lamp = images[0], images[1]
    matching = images[5]
    opened = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", olive_steps,
    )
    explicit = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", olive_steps, cover_asset_id=lamp.id,
    )
    assert opened.media_plan["coverMode"] == "automatic"
    assert opened.media_plan["coverAssetId"] == str(matching.id)
    assert opened.media_plan["coverAssetId"] != str(foreign.id)
    assert explicit.media_plan["coverMode"] == "explicit"
    assert explicit.media_plan["coverAssetId"] == str(lamp.id)
    with pytest.raises(HTTPException) as denied:
        await svc.create_draft(
            sample.db, sample.business.id, sample.outsider.id,
            "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", olive_steps,
        )
    assert denied.value.status_code == 403
    store = MemoryVideoStore()
    early = [
        await _video(sample, store, knowledge, title)
        for title in ("Sessiz orman", "Film kaydi bir", "Film kaydi iki")
    ]
    held = opened.media_plan["coverAssetId"]
    finished = []
    for _ignored in early:
        job = await process_one(sample.db)
        await sample.db.commit()
        assert job is not None and job.status == "ready" and job.result_asset_id == job.source_asset_id
        finished.append(job.source_asset_id)
        await sample.db.refresh(opened)
        await sample.db.refresh(explicit)
        assert opened.media_plan["coverAssetId"] == held
        assert opened.media_plan["coverMode"] == "automatic"
        assert explicit.media_plan["coverAssetId"] == str(lamp.id)
        assert explicit.revision == 1
    assert set(finished) == {video.id for video in early}
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for index, video in enumerate(early):
        job = await latest_for_asset(sample.db, sample.business.id, video.id)
        job.created_at = base + timedelta(days=index)
    await sample.db.commit()
    forest_steps = _phrase_steps(knowledge, "Sessiz orman")
    forest = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Sessiz orman", "Sessiz orman ozeti", forest_steps,
    )
    lamp_steps = _phrase_steps(knowledge, "Lamba isigi")
    lamps = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Lamba isigi", "Lamba isigi ozeti", lamp_steps,
    )
    assert forest.media_plan["coverMode"] == "automatic"
    assert forest.media_plan["coverAssetId"] == str(early[0].id)
    assert lamps.media_plan["coverAssetId"] == str(lamp.id)
    assert forest.media_plan["coverAssetId"] != lamps.media_plan["coverAssetId"]
    stable = await svc.revise_draft(
        sample.db, sample.business.id, sample.editor.id, opened.id, opened.revision,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", olive_steps,
    )
    assert stable.media_plan["coverMode"] == "automatic"
    assert stable.media_plan["coverAssetId"] == str(matching.id)
    kept = await svc.revise_draft(
        sample.db, sample.business.id, sample.editor.id, explicit.id, explicit.revision,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", olive_steps, cover_asset_id=lamp.id,
    )
    assert kept.media_plan["coverMode"] == "explicit"
    assert kept.media_plan["coverAssetId"] == str(lamp.id)
    for state in ("review", "approved"):
        actor = sample.editor.id if state == "review" else sample.owner.id
        forest = await svc.transition_draft(sample.db, sample.business.id, actor, forest.id, state, forest.revision)
    assert "coverMode" not in forest.media_plan
    assert forest.media_plan["coverAssetId"] == str(early[0].id)
    assert forest.media_plan["seal"] == media.media_seal(forest.media_plan)
    sealed = forest.media_plan["seal"]
    closer = await _video(sample, store, knowledge, "Zeytinyagi hasadi ozeti")
    await _ready(sample, closer)
    await sample.db.refresh(forest)
    await sample.db.refresh(stable)
    await sample.db.refresh(kept)
    assert forest.media_plan["seal"] == sealed
    assert forest.media_plan["coverAssetId"] == str(early[0].id)
    assert stable.media_plan["coverAssetId"] == str(matching.id)
    assert kept.media_plan["coverAssetId"] == str(lamp.id)
    revised = await svc.revise_draft(
        sample.db, sample.business.id, sample.editor.id, stable.id, stable.revision,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", olive_steps,
    )
    assert revised.media_plan["coverMode"] == "automatic"
    assert revised.media_plan["coverAssetId"] == str(closer.id)
    again = await svc.revise_draft(
        sample.db, sample.business.id, sample.editor.id, revised.id, revised.revision,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", olive_steps,
    )
    assert again.media_plan["coverAssetId"] == str(closer.id)
    await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, forest.id)
    await sample.db.refresh(forest)
    conversation = await sample.db.get(StandaloneConversation, forest.conversation_id)
    sample.db.add(MirrorNetworkNode(
        slug="zeytin-secimi", user_id=forest.created_by, conversation_id=conversation.client_conversation_id,
        visibility="private", safety_status="open", card_title="Sessiz orman", card_date="2026-11-01",
        scene_image_url=None, public_payload={}, private_payload={}, journey_version=1,
    ))
    await sample.db.commit()
    await sample.db.refresh(forest)

    def matching_journey(_internal):
        return {"steps": [{"publicQuestion": step["question"], "publicAnswer": step["answer"]} for step in forest_steps]}

    monkeypatch.setattr("backend.services.mirror_network.frozen_journey_artifact.get_frozen_journey_artifact", AsyncMock(return_value={"frozen": True}))
    monkeypatch.setattr("backend.services.mirror_network.frozen_journey_artifact.to_public_frozen_journey_artifact", matching_journey)
    await publish_draft(sample.db, sample.business.id, sample.owner.id, forest.id, "zeytin-secimi", forest.revision)
    published = await sample.db.get(BusinessPublication, ("zeytin-secimi", 1))
    assert published.media_plan["coverAssetId"] == str(early[0].id)
    assert published.media_plan["seal"] == sealed
    await library.archive_asset(sample.db, sample.business.id, sample.editor.id, closer.id, closer.revision)
    await sample.db.refresh(again)
    assert again.media_plan["coverAssetId"] == str(closer.id)
    assert media.public_media_view(again.media_plan, [])["coverAssetId"] is None
    with pytest.raises(HTTPException) as blocked:
        await svc.transition_draft(sample.db, sample.business.id, sample.editor.id, again.id, "review", again.revision)
    assert blocked.value.detail["code"] == "sealed_media_unavailable"
    replaced = await svc.revise_draft(
        sample.db, sample.business.id, sample.editor.id, again.id, again.revision,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", olive_steps,
    )
    assert replaced.media_plan["coverMode"] == "automatic"
    assert replaced.media_plan["coverAssetId"] == str(matching.id)
    reviewed = await svc.transition_draft(
        sample.db, sample.business.id, sample.editor.id, replaced.id, "review", replaced.revision,
    )
    assert reviewed.media_plan["coverAssetId"] == str(matching.id)
    await sample.db.refresh(published)
    assert published.media_plan["seal"] == sealed
    assert published.media_plan["coverAssetId"] == str(early[0].id)


async def test_omitted_cover_field_keeps_the_explicit_choice_and_null_returns_to_automatic(sample, asset_dir):
    import httpx
    from fastapi import FastAPI

    from backend.routers import business_yansi as routes

    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    lamp = await _image(sample, knowledge, "Lamba isigi")
    other = await _image(sample, knowledge, "Zeytinyagi hasadi")
    steps = _phrase_steps(knowledge, "Lamba isigi")
    explicit = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Lamba isigi", "Lamba isigi ozeti", steps,
        cover_asset_id=lamp.id,
    )
    approved = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Lamba isigi", "Lamba isigi ozeti", steps,
        cover_asset_id=lamp.id,
    )
    approved = await svc.transition_draft(sample.db, sample.business.id, sample.editor.id, approved.id, "review", approved.revision)
    approved = await svc.transition_draft(sample.db, sample.business.id, sample.owner.id, approved.id, "approved", approved.revision)
    sealed = approved.media_plan["seal"]
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[routes.get_db] = lambda: sample.db
    app.dependency_overrides[routes.get_current_user] = lambda: {"user_id": str(sample.editor.id)}
    body = {"title": "Lamba isigi", "summary": "Yeni ozet", "revision": explicit.revision, "steps": steps}
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        omitted = await client.patch(f"/api/business-yansi/{sample.business.id}/drafts/{explicit.id}", json=body)
        assert omitted.status_code == 200, omitted.text
        plan = omitted.json()["media_plan"]
        assert plan["coverMode"] == "explicit" and plan["coverAssetId"] == str(lamp.id) and plan["seal"] is None
        body["revision"] = omitted.json()["revision"]
        body["coverAssetId"] = None
        body["summary"] = "Zeytinyagi hasadi ozeti"
        body["title"] = "Zeytinyagi hasadi"
        body["steps"] = _phrase_steps(knowledge, "Zeytinyagi hasadi")
        automatic = await client.patch(f"/api/business-yansi/{sample.business.id}/drafts/{explicit.id}", json=body)
        assert automatic.status_code == 200, automatic.text
        switched = automatic.json()["media_plan"]
        assert switched["coverMode"] == "automatic" and switched["coverAssetId"] == str(other.id)
        denied = await client.patch(
            f"/api/business-yansi/{sample.business.id}/drafts/{approved.id}",
            json={"title": approved.title, "summary": approved.summary, "revision": approved.revision, "steps": steps},
        )
        assert denied.status_code == 409
    await sample.db.refresh(approved)
    assert approved.media_plan["seal"] == sealed
    assert approved.media_plan["coverAssetId"] == str(lamp.id)
    assert "coverMode" not in approved.media_plan
