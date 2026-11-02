"""Image observations. The model result is stored data, not a Yansı decision."""
import asyncio
import hashlib
import importlib.util
import io
import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.core.utils.dependencies import Base
from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.models.business_video_cover_jobs import BusinessVideoCoverJob
from backend.models.business_yansi import BusinessPublication
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import cover_jobs
from backend.services.business_yansi import image_observe as vision
from backend.services.business_yansi import media_observations as observe
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.tests.test_business_video_cover_policy import _confirm, asset_dir, sample
from backend.tests.test_business_yansi import source
from backend.worker.media_observe import serve

_BACKEND = Path(__file__).resolve().parents[1]
_SUMMARY = "Zeytin dalı ve taş duvar görünüyor."
_TAGS = ["zeytin dalı", "taş duvar"]


def _picture(width, height, fmt="PNG", color=(20, 90, 40)):
    image = Image.new("RGB", (width, height), color)
    out = io.BytesIO()
    image.save(out, format=fmt)
    return out.getvalue()


def _ok(summary=_SUMMARY, tags=None, visible="HASAT", usage=True):
    body = {"summary": summary, "tags": list(tags or _TAGS), "visibleText": visible}
    payload = {"model": "configured-vision", "choices": [{"message": {"content": json.dumps(body, ensure_ascii=False)}}]}
    if usage:
        payload["usage"] = {"prompt_tokens": 480, "completion_tokens": 36}
    return payload


def _steps(knowledge, phrase):
    return [
        {"question": f"{phrase} nedir?", "answer": knowledge.content, "sources": [str(knowledge.id)]}
        for _index in range(8)
    ]


def _sessions(db, stop, after):
    seen = {"n": 0}

    @asynccontextmanager
    async def factory():
        yield db
        seen["n"] += 1
        if seen["n"] >= after:
            stop.set()

    return factory


def _maker_sessions(maker, stop, after):
    seen = {"n": 0}

    @asynccontextmanager
    async def factory():
        async with maker() as db:
            yield db
        seen["n"] += 1
        if seen["n"] >= after:
            stop.set()

    return factory


def _texts(payload):
    found = []
    for message in payload["messages"]:
        content = message["content"]
        if isinstance(content, str):
            found.append(content)
            continue
        for part in content:
            if part.get("type") == "text":
                found.append(part["text"])
    return "\n".join(found)


async def _image(sample, label, color):
    return await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": label, "caption": "", "public_allowed": True,
    }, image_bytes=_picture(80, 40, color=color))


def test_resize_schema_and_limits_reject_unsafe_output(monkeypatch):
    wide, wide_mime = vision.resize_for_vision(_picture(1200, 600))
    tall, _tall_mime = vision.resize_for_vision(_picture(400, 2000))
    assert wide_mime == "image/jpeg" and wide.startswith(b"\xff\xd8")
    with Image.open(io.BytesIO(wide)) as image:
        assert image.size == (512, 256)
    with Image.open(io.BytesIO(tall)) as image:
        assert max(image.size) == 512 and image.size[1] == 512
    with pytest.raises(vision.ObservationFailure) as rejected:
        vision.resize_for_vision(b"not-an-image")
    assert rejected.value.code == "observation_image_rejected" and rejected.value.retryable is False
    with pytest.raises(vision.ObservationFailure) as gif:
        vision.resize_for_vision(_picture(8, 8, fmt="GIF"))
    assert gif.value.code == "observation_image_rejected"
    parsed = vision.parse_visual_observation(json.dumps({
        "summary": _SUMMARY, "tags": _TAGS, "visibleText": "  ",
    }, ensure_ascii=False))
    assert parsed == {"summary": _SUMMARY, "tags": _TAGS, "visible_text": None}
    for raw in (
        {"summary": _SUMMARY, "tags": _TAGS, "brand": "EZA"},
        {"summary": _SUMMARY, "tags": []},
        {"summary": _SUMMARY, "tags": [f"etiket {index}" for index in range(13)]},
        {"summary": "x" * 401, "tags": ["dal"]},
        {"summary": _SUMMARY, "tags": ["x" * 33]},
        {"summary": _SUMMARY, "tags": _TAGS, "visibleText": "y" * 201},
        {"summary": "   ", "tags": _TAGS},
    ):
        with pytest.raises(vision.ObservationFailure) as invalid:
            vision.parse_visual_observation(raw)
        assert invalid.value.code == "observation_output_invalid"
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "9")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_TIMEOUT_SECONDS", "90")
    assert observe.concurrency() == 4 and observe.timeout_seconds() == 60
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "0")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_TIMEOUT_SECONDS", "0")
    assert observe.concurrency() == 1 and observe.timeout_seconds() == 1
    monkeypatch.setenv("BILIGN_BUSINESS_OBSERVATION_PROFILE", "bad profile")
    assert observe.active_profile() == observe.PROFILE
    path = _BACKEND / "migrations/versions/add_observation_usage_v1.py"
    spec = importlib.util.spec_from_file_location("observation_usage_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.revision == "add_observation_usage_v1"
    assert migration.down_revision == "add_media_observations_v1"
    assert len(migration.revision) <= 32


async def test_provider_classifies_timeout_and_refusal_without_keeping_the_image(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_MODEL", "configured-vision")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_TIMEOUT_SECONDS", "7")
    monkeypatch.setattr(
        "backend.config.get_settings",
        lambda: SimpleNamespace(OPENAI_API_KEY="test-key-not-real"),
    )
    recorded = {}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            recorded["timeout"] = kwargs.get("timeout")

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def post(self, url, headers=None, json=None):
            image = json["messages"][1]["content"][1]["image_url"]
            recorded["url"] = url
            recorded["authorized"] = str(headers.get("Authorization", "")).startswith("Bearer ")
            recorded["detail"] = image["detail"]
            recorded["prefix"] = image["url"][:22]
            recorded["status"] = FakeClient.status

            class Response:
                status_code = FakeClient.status

                def json(self):
                    return {"error": {"message": "rejected"}}

            if FakeClient.status == "timeout":
                raise httpx.TimeoutException("slow")
            return Response()

    FakeClient.status = "timeout"
    monkeypatch.setattr(vision.httpx, "AsyncClient", FakeClient)
    prepared, mime = vision.resize_for_vision(_picture(32, 16))
    request = vision.vision_request(prepared, mime, "configured-vision")
    with pytest.raises(vision.ObservationFailure) as timed:
        await vision.default_completer(request)
    assert timed.value.code == "observation_provider_timeout" and timed.value.retryable is True
    assert str(timed.value) == "observation_provider_timeout"
    FakeClient.status = 400
    with pytest.raises(vision.ObservationFailure) as refused:
        await vision.default_completer(request)
    assert refused.value.code == "observation_provider_refused" and refused.value.retryable is False
    FakeClient.status = 429
    with pytest.raises(vision.ObservationFailure) as busy:
        await vision.default_completer(request)
    assert busy.value.code == "observation_provider_unavailable" and busy.value.retryable is True
    assert recorded["url"] == vision.CHAT_URL
    assert recorded["timeout"] == 7
    assert recorded["authorized"] is True
    assert recorded["detail"] == "low" and recorded["prefix"] == "data:image/jpeg;base64"
    assert "test-key-not-real" not in json.dumps({key: value for key, value in recorded.items()})


async def test_successful_analysis_is_turkish_and_reused_for_the_same_bytes(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    calls = []

    async def completer(payload):
        calls.append(payload)
        return _ok()

    image = await _image(sample, "Zeytinyagi hasadi", (30, 80, 20))
    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 2), stop=stop, completer=completer)
    job = await sample.db.scalar(select(Observation).where(Observation.asset_id == image.id))
    assert job.status == "ready"
    assert job.summary == _SUMMARY and job.tags == _TAGS and job.visible_text == "HASAT"
    assert job.provider_model == "configured-vision"
    assert job.input_tokens == 480 and job.output_tokens == 36
    assert job.claim_token is None and job.error_code is None
    assert "brand-assets/" not in _texts(calls[0])
    assert str(sample.business.id) not in _texts(calls[0])
    encoded = calls[0]["messages"][1]["content"][1]["image_url"]["url"].split(",", 1)[1]
    with Image.open(io.BytesIO(__import__("base64").b64decode(encoded))) as sent:
        assert max(sent.size) <= 512
    again = await _image(sample, "Ayni kare", (30, 80, 20))
    assert again.id != image.id
    assert await observe.observation_count(sample.db, sample.business.id) == 1
    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 1), stop=stop, completer=completer)
    assert len(calls) == 1
    await sample.db.refresh(job)
    assert job.status == "ready" and job.summary == _SUMMARY


async def test_same_bytes_in_another_brand_get_their_own_call(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    calls = []

    async def completer(payload):
        calls.append(_texts(payload))
        return _ok()

    picture = _picture(60, 30, color=(12, 40, 70))
    await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Ortak kare", "caption": "", "public_allowed": True,
    }, image_bytes=picture)
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id),
        "slug": "baska-gorsel", "name": "Baska",
    })
    foreign = await library.create_asset(sample.db, other.id, sample.outsider.id, {
        "asset_type": "image", "title": "Ortak kare", "caption": "", "public_allowed": True,
    }, image_bytes=picture)
    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 4), stop=stop, completer=completer)
    assert len(calls) == 2
    assert str(sample.business.id) not in calls[0] and str(other.id) not in calls[1]
    assert await observe.observation_count(sample.db, sample.business.id) == 1
    assert await observe.observation_count(sample.db, other.id) == 1
    stored = (await sample.db.scalars(select(Observation).where(Observation.asset_id == foreign.id))).all()
    assert len(stored) == 1 and stored[0].business_id == other.id and stored[0].status == "ready"


async def test_timeout_retries_refusal_is_terminal_and_cover_work_continues(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    image = await _confirm(sample, knowledge, await _image(sample, "Zeytinyagi hasadi", (4, 80, 20)))
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", _steps(knowledge, "Zeytinyagi hasadi"),
    )
    sample.db.add(BusinessVideoCoverJob(
        id=uuid.uuid4(), business_id=sample.business.id, source_asset_id=image.id,
        idempotency_key="c" * 64, strategy="first_span", start_ticks=0, end_ticks=1000,
        encoder_profile="test", status="queued", attempts=0, max_attempts=3, created_by=sample.editor.id,
    ))
    await sample.db.commit()
    calls = []

    async def timeout(payload):
        calls.append(1)
        raise vision.ObservationFailure("observation_provider_timeout", retryable=True)

    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 6), stop=stop, completer=timeout)
    job = await sample.db.scalar(select(Observation).where(Observation.asset_id == image.id))
    assert len(calls) == 3
    assert job.status == "failed" and job.error_code == "observation_provider_timeout" and job.attempts == 3
    await sample.db.refresh(draft)
    await sample.db.refresh(image)
    assert draft.revision == 1 and draft.media_plan["coverAssetId"] == str(image.id)
    assert image.title == "Zeytinyagi hasadi"
    cover = await cover_jobs.claim_next(sample.db)
    await sample.db.commit()
    assert cover is not None and cover.status == "running" and cover.source_asset_id == image.id

    refused = await _image(sample, "Sessiz orman", (80, 40, 10))
    refused_calls = []

    async def refuse(payload):
        refused_calls.append(1)
        raise vision.ObservationFailure("observation_provider_refused", retryable=False)

    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 2), stop=stop, completer=refuse)
    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 1), stop=stop, completer=refuse)
    failed = await sample.db.scalar(select(Observation).where(Observation.asset_id == refused.id))
    assert len(refused_calls) == 1
    assert failed.status == "failed" and failed.error_code == "observation_provider_refused" and failed.attempts == 1


async def test_invalid_output_missing_file_and_bad_bytes_do_not_invent_a_summary(sample, asset_dir, monkeypatch, caplog):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    invalid = await _image(sample, "Belirsiz", (1, 1, 1))

    async def bad(payload):
        return {"choices": [{"message": {"content": json.dumps({"summary": "Kisa", "tags": [], "extra": 1})}}]}

    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 2), stop=stop, completer=bad)
    job = await sample.db.scalar(select(Observation).where(Observation.asset_id == invalid.id))
    assert job.status == "queued" and job.attempts == 1 and job.summary is None and job.error_code is None
    job.status = "failed"
    job.error_code = "observation_output_invalid"
    await sample.db.commit()

    missing = await _image(sample, "Kayip", (2, 2, 2))
    name = missing.locator.rsplit("/", 1)[-1]
    (Path(os.environ["EZA_BRAND_ASSET_DIR"]) / str(sample.business.id) / name).unlink()
    calls = []

    async def unused(payload):
        calls.append(1)
        return _ok()

    caplog.set_level("INFO")
    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 2), stop=stop, completer=unused)
    lost = await sample.db.scalar(select(Observation).where(Observation.asset_id == missing.id))
    assert lost.status == "failed" and lost.error_code == "observation_source_missing"
    assert calls == [] and missing.locator not in caplog.text

    bad_file = await _image(sample, "Bozuk", (3, 3, 3))
    target = Path(os.environ["EZA_BRAND_ASSET_DIR"]) / str(sample.business.id) / bad_file.locator.rsplit("/", 1)[-1]
    target.write_bytes(_picture(8, 8, fmt="GIF"))
    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 2), stop=stop, completer=unused)
    rejected = await sample.db.scalar(select(Observation).where(Observation.asset_id == bad_file.id))
    assert rejected.status == "failed" and rejected.error_code == "observation_source_stale"
    assert rejected.summary is None and calls == []
    replacement = hashlib.sha256(_picture(8, 8, fmt="GIF")).hexdigest()
    queued = await sample.db.scalar(select(Observation).where(Observation.content_sha256 == replacement))
    assert queued is not None and queued.id != rejected.id and queued.status == "queued"
    assert await sample.db.get(BusinessBrandAsset, bad_file.id) is not None


async def test_disabled_mode_and_video_rows_make_no_vision_call(sample, asset_dir, monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)
    monkeypatch.delenv("BILIGN_BUSINESS_VISION_MODEL", raising=False)
    calls = []

    async def completer(payload):
        calls.append(1)
        return _ok()

    image = await _image(sample, "Kapali", (5, 5, 5))
    assert await observe.observation_count(sample.db, sample.business.id) == 0
    sample.db.add(Observation(
        id=uuid.uuid4(), business_id=sample.business.id, asset_id=image.id,
        content_sha256=image.locator.rsplit("/", 1)[-1].split(".", 1)[0],
        analyzer_profile=observe.PROFILE, idempotency_key="b" * 64,
        status="queued", attempts=0, max_attempts=3, origin="upload", created_by=sample.editor.id,
    ))
    video = BusinessBrandAsset(
        id=uuid.uuid4(), business_id=sample.business.id, asset_type="video", title="Film",
        locator_kind="storage", locator=f"brand-videos/{sample.business.id}/{'c' * 64}.mp4",
        public_allowed=True, status="published", created_by=sample.editor.id, revision=1,
        verified_duration=8000, verified_timescale=1000, verified_size_bytes=200, verified_has_audio=False,
    )
    sample.db.add(video)
    await sample.db.flush()
    assert await observe.ensure_observation(sample.db, video, sample.editor.id) is None
    video_job = Observation(
        id=uuid.uuid4(), business_id=sample.business.id, asset_id=video.id,
        content_sha256="c" * 64, analyzer_profile=observe.PROFILE, idempotency_key="d" * 64,
        status="queued", attempts=0, max_attempts=3, origin="upload", created_by=sample.editor.id,
    )
    sample.db.add(video_job)
    await sample.db.commit()
    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 1), stop=stop, completer=completer)
    assert calls == []
    await sample.db.refresh(video_job)
    assert video_job.status == "queued" and video_job.attempts == 0

    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    video.source_asset_id = image.id
    video_job.created_at = datetime.now(timezone.utc) - timedelta(days=1)
    await sample.db.commit()
    assert await observe.ensure_observation(sample.db, video, sample.editor.id) is None
    opened = await _image(sample, "Acik", (6, 6, 6))
    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 2), stop=stop, completer=completer)
    await sample.db.refresh(video_job)
    ready = await sample.db.scalar(select(Observation).where(Observation.idempotency_key == "b" * 64))
    waiting = await sample.db.scalar(select(Observation).where(Observation.asset_id == opened.id))
    assert len(calls) == 1 and ready.status == "ready"
    assert waiting.status == "queued" and waiting.attempts == 0
    assert video_job.status == "queued" and video_job.attempts == 0


async def test_one_call_at_a_time_when_the_limit_is_one(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    await _image(sample, "Bir", (1, 1, 1))
    await _image(sample, "Iki", (2, 2, 2))
    await sample.db.commit()
    state = {"open": 0, "max": 0}

    async def completer(payload):
        state["open"] += 1
        state["max"] = max(state["max"], state["open"])
        await asyncio.sleep(0.05)
        state["open"] -= 1
        return _ok(usage=False)

    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 4), stop=stop, completer=completer)
    assert state["max"] == 1
    rows = (await sample.db.scalars(select(Observation))).all()
    assert len(rows) == 2 and {row.status for row in rows} == {"ready"}
    assert all(row.input_tokens is None and row.provider_model == "configured-vision" for row in rows)


async def test_analysis_does_not_change_ranking_drafts_or_seals(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    olive = await _confirm(sample, knowledge, await _image(sample, "Zeytinyagi hasadi", (20, 70, 10)))
    forest = await _confirm(sample, knowledge, await _image(sample, "Sessiz orman", (10, 40, 20)))
    steps = _steps(knowledge, "Zeytinyagi hasadi")
    automatic = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    explicit = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
        cover_asset_id=forest.id,
    )
    cover_before = automatic.media_plan["coverAssetId"]
    calls = []

    async def completer(payload):
        calls.append(1)
        return _ok(summary="Zeytinyagi hasadi ozeti", tags=["zeytinyagi", "hasadi"])

    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 4), stop=stop, completer=completer)
    assert len(calls) == 2
    await sample.db.refresh(automatic)
    await sample.db.refresh(explicit)
    await sample.db.refresh(knowledge)
    assert knowledge.content == "Kayit metni secimi icin yeterince aciktir."
    assert automatic.revision == 1 and automatic.media_plan["coverAssetId"] == cover_before == str(olive.id)
    assert explicit.revision == 1 and explicit.media_plan["coverAssetId"] == str(forest.id)
    revised = await svc.revise_draft(
        sample.db, sample.business.id, sample.editor.id, automatic.id, automatic.revision,
        "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert revised.media_plan["coverAssetId"] == str(olive.id) and revised.media_plan["coverMode"] == "automatic"
    later = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert later.media_plan["coverAssetId"] == str(olive.id)
    assert media.media_identity(revised.media_plan) == {"coverAssetId": str(olive.id), "blocks": revised.media_plan["blocks"]}
    for state in ("review", "approved"):
        actor = sample.editor.id if state == "review" else sample.owner.id
        revised = await svc.transition_draft(
            sample.db, sample.business.id, actor, revised.id, state, revised.revision,
        )
    sealed = revised.media_plan["seal"]
    assert sealed == media.media_seal(revised.media_plan)
    assert "coverMode" not in revised.media_plan
    assert _SUMMARY not in json.dumps(revised.media_plan)
    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 1), stop=stop, completer=completer)
    await sample.db.refresh(revised)
    assert len(calls) == 2 and revised.media_plan["seal"] == sealed
    await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, revised.id)
    await sample.db.refresh(revised)
    conversation = await sample.db.get(StandaloneConversation, revised.conversation_id)
    sample.db.add(MirrorNetworkNode(
        slug="zeytin-gorsel", user_id=revised.created_by, conversation_id=conversation.client_conversation_id,
        visibility="private", safety_status="open", card_title="Zeytinyagi", card_date="2026-11-01",
        scene_image_url=None, public_payload={}, private_payload={}, journey_version=1,
    ))
    await sample.db.commit()

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
    await publish_draft(sample.db, sample.business.id, sample.owner.id, revised.id, "zeytin-gorsel", revised.revision)
    published = await sample.db.get(BusinessPublication, ("zeytin-gorsel", 1))
    assert published.media_plan["seal"] == sealed
    assert published.media_plan["coverAssetId"] == str(olive.id)
    assert "tags" not in media.media_identity(published.media_plan)


async def test_stale_worker_cannot_overwrite_a_newer_claim(tmp_path):
    from sqlalchemy import update

    from backend.models.business_media_observations import BusinessMediaObservationFrame as Frame

    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'fence.db').as_posix()}")
    async with engine.begin() as connection:
        await connection.run_sync(
            lambda sync: Base.metadata.create_all(sync, tables=[Observation.__table__, Frame.__table__]),
        )
    maker = async_sessionmaker(engine, expire_on_commit=False)
    job_id = uuid.uuid4()
    business_id = uuid.uuid4()
    creator = uuid.uuid4()
    old_token = "o" + "a" * 32
    new_token = "o" + "b" * 32
    async with maker() as db:
        db.add(Observation(
            id=job_id, business_id=business_id, asset_id=uuid.uuid4(),
            content_sha256="d" * 64, analyzer_profile=observe.PROFILE, idempotency_key="e" * 64,
            status="running", attempts=1, max_attempts=3, origin="upload", created_by=creator,
            claim_token=old_token, deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
        ))
        await db.commit()
    async with maker() as writer:
        renewed = await writer.execute(
            update(Observation).where(Observation.id == job_id).values(
                claim_token=new_token, deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
            )
        )
        assert renewed.rowcount == 1
        await writer.commit()
    async with maker() as stale:
        wrote = await observe.complete_owned(
            stale, (job_id, old_token, business_id),
            summary="Eski isci yazdi", tags=["eski"], visible_text=None,
            provider_model="configured-vision", input_tokens=1, output_tokens=1,
            frames=[{"timestamp_ms": 1, "note": "Eski kare", "tags": ["eski"]}],
        )
        await stale.commit()
        assert wrote is False
    async with maker() as db:
        row = await db.get(Observation, job_id)
        frames = (await db.scalars(select(Frame))).all()
        assert row.status == "running" and row.claim_token == new_token and row.summary is None
        assert frames == []
    async with maker() as recovered, maker() as owner:
        await recovered.execute(
            update(Observation).where(Observation.id == job_id).values(
                deadline_at=datetime.now(timezone.utc) - timedelta(seconds=5),
            )
        )
        await recovered.commit()
        await owner.execute(
            update(Observation).where(Observation.id == job_id, Observation.claim_token == new_token).values(
                claim_token=new_token, deadline_at=datetime.now(timezone.utc) + timedelta(seconds=60),
            )
        )
        await owner.commit()
        assert await observe.recover_stale(recovered) == 0
        await recovered.commit()
    async with maker() as db:
        row = await db.get(Observation, job_id)
        assert row.status == "running" and row.claim_token == new_token
    await engine.dispose()


async def test_changed_bytes_are_not_stored_under_the_old_hash(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    image = await _image(sample, "Ilk", (9, 9, 9))
    job = await sample.db.scalar(select(Observation).where(Observation.asset_id == image.id))
    original = job.content_sha256
    target = Path(os.environ["EZA_BRAND_ASSET_DIR"]) / str(sample.business.id) / image.locator.rsplit("/", 1)[-1]
    replacement = _picture(12, 12, color=(3, 4, 5))
    target.write_bytes(replacement)
    calls = []

    async def completer(payload):
        calls.append(payload)
        return _ok(summary="Yanlis dosya")

    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 2), stop=stop, completer=completer)
    await sample.db.refresh(job)
    queued = await sample.db.scalar(select(Observation).where(Observation.content_sha256 == hashlib.sha256(replacement).hexdigest()))
    assert calls == []
    assert job.status == "failed" and job.error_code == "observation_source_stale" and job.summary is None
    assert job.content_sha256 == original
    assert queued is not None and queued.id != job.id and queued.status == "queued"


async def test_a_decompression_bomb_fails_one_job_and_the_worker_continues(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    bomb = struct_png(20_000, 20_000)
    with pytest.raises(vision.ObservationFailure) as rejected:
        vision.resize_for_vision(bomb)
    assert rejected.value.code == "observation_image_rejected" and rejected.value.retryable is False

    class Exploding:
        size = (32, 32)
        format = "PNG"
        mode = "RGB"

        def load(self):
            raise vision.DecompressionBombError("bomb")

    original_open = vision.Image.open
    monkeypatch.setattr(vision.Image, "open", lambda _data: Exploding())
    with pytest.raises(vision.ObservationFailure) as exploded:
        vision.resize_for_vision(_picture(8, 8))
    assert exploded.value.retryable is False
    monkeypatch.setattr(vision.Image, "open", original_open)

    first = await _image(sample, "Birinci", (7, 7, 7))
    second = await _image(sample, "Ikinci", (8, 8, 8))
    await sample.db.commit()
    from backend.services.business_yansi import video_observe as watched

    original = watched.analyze_media_claim
    state = {"n": 0}

    async def wrapped(db, held, **kwargs):
        state["n"] += 1
        if state["n"] == 1:
            raise RuntimeError("isolated")
        return await original(db, held, **kwargs)

    monkeypatch.setattr(watched, "analyze_media_claim", wrapped)

    async def completer(_payload):
        return _ok()

    stop = asyncio.Event()

    def factory():
        seen = {"n": 0}

        @asynccontextmanager
        async def sessions():
            try:
                yield sample.db
            finally:
                seen["n"] += 1
                if state["n"] >= 2:
                    stop.set()

        return sessions

    await serve(factory(), stop=stop, completer=completer)
    assert state["n"] == 2
    rows = {
        row.asset_id: row
        for row in (await sample.db.scalars(select(Observation).where(Observation.asset_id.in_([first.id, second.id])))).all()
    }
    assert {rows[first.id].status, rows[second.id].status} == {"running", "ready"}


def struct_png(width: int, height: int) -> bytes:
    import struct
    import zlib

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
