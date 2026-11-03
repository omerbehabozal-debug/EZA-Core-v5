"""Video frames stay local. A cover window cannot borrow the whole-video summary."""
import asyncio
import hashlib
import io
import json
import os
import tempfile
import uuid
from pathlib import Path

import pytest
from PIL import Image
from fastapi import HTTPException
from sqlalchemy import func, select
from unittest.mock import AsyncMock

from backend.models.business_brand_assets import BusinessBrandAsset
from backend.models.business_media_observations import BusinessMediaObservation as Observation
from backend.models.business_media_observations import BusinessMediaObservationFrame as Frame
from backend.models.business_video_cover_jobs import BusinessVideoCoverJob
from backend.models.business_yansi import BusinessPublication
from backend.models.mirror_network import MirrorNetworkNode
from backend.models.standalone_conversations import StandaloneConversation
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import cover_jobs
from backend.services.business_yansi import media_observations as observe
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi import video_observe as video
from backend.services.business_yansi.publication import export_editorial_conversation, publish_draft
from backend.services.business_yansi.video_mp4 import _tool_path
from backend.services.business_yansi.video_storage import MemoryVideoStore
from backend.tests.test_business_image_observations import _picture, _sessions
from backend.tests.test_business_video_cover_policy import _confirm, asset_dir, sample
from backend.tests.test_business_yansi import source
from backend.worker.media_observe import serve

_SUMMARY = "Zeytin dalı rüzgarda hareket ediyor."


def _jpeg() -> bytes:
    image = Image.new("RGB", (40, 20), (20, 90, 40))
    out = io.BytesIO()
    image.save(out, format="JPEG")
    return out.getvalue()


_FILES: dict[str, bytes] = {}


def _file(label: str) -> bytes:
    return f"bilign-video-{label}".encode()


def _sha(label: str) -> str:
    data = _file(label)
    digest = hashlib.sha256(data).hexdigest()
    _FILES[digest] = data
    return digest


def _response(stamps, summary=_SUMMARY):
    body = {
        "summary": summary,
        "tags": ["zeytin dalı", "rüzgar"],
        "visibleText": "HASAT",
        "frames": [
            {"timestampMs": stamp, "note": f"Kare {stamp} zeytin", "tags": ["zeytin"]}
            for stamp in stamps
        ],
    }
    return {
        "model": "configured-vision",
        "usage": {"prompt_tokens": 900, "completion_tokens": 80},
        "choices": [{"message": {"content": json.dumps(body, ensure_ascii=False)}}],
    }


def _texts(payload):
    return [part["text"] for part in payload["messages"][1]["content"] if part.get("type") == "text"]


def _images(payload):
    return [
        part["image_url"]["url"]
        for part in payload["messages"][1]["content"]
        if part.get("type") == "image_url"
    ]


def _steps(knowledge, phrase):
    return [
        {"question": f"{phrase} nedir?", "answer": knowledge.content, "sources": [str(knowledge.id)]}
        for _index in range(8)
    ]


async def _asset(sample, digest, duration, *, title="Film", source_id=None, audio=True):
    row = BusinessBrandAsset(
        id=uuid.uuid4(), business_id=sample.business.id, asset_type="video", title=title,
        locator_kind="storage", locator=f"brand-videos/{sample.business.id}/{digest}.mp4",
        public_allowed=True, status="published", created_by=sample.editor.id, revision=1,
        verified_duration=duration, verified_timescale=1000, verified_size_bytes=len(_FILES[digest]),
        verified_has_audio=audio, source_asset_id=source_id,
    )
    sample.db.add(row)
    await sample.db.flush()
    return row


def _tools(sample):
    paths = []

    async def materialize(_business, locator, dest, size):
        paths.append(dest)
        assert "://" not in locator and not str(locator).lower().startswith("http")
        stem = str(locator).rsplit("/", 1)[-1].removesuffix(".mp4")
        data = _FILES[stem]
        assert size == len(data)
        Path(dest).write_bytes(data)

    def extract(path, stamps):
        assert os.path.isfile(path)
        return [(stamp, _jpeg()) for stamp in stamps]

    return materialize, extract, paths


def test_duration_buckets_keep_four_frames_and_reject_loose_output():
    assert video.frame_timestamps(3_000) == [1_500]
    assert video.frame_timestamps(3_999) == [1_999]
    assert video.frame_timestamps(4_000) == [1_200, 2_800]
    assert video.frame_timestamps(8_000) == [2_400, 5_600]
    assert video.frame_timestamps(11_999) == [3_599, 8_399]
    assert video.frame_timestamps(12_000) == [1_440, 4_440, 7_440, 10_440]
    assert video.frame_timestamps(60_000) == [7_200, 22_200, 37_200, 52_200]
    assert len(video.frame_timestamps(120_000)) == 4
    with pytest.raises(video.ObservationFailure) as rejected:
        video.frame_timestamps(0)
    assert rejected.value.code == "observation_video_rejected"
    stamps = video.frame_timestamps(8_000)
    parsed = video.parse_video_observation(_response(stamps)["choices"][0]["message"]["content"], stamps)
    assert parsed["summary"] == _SUMMARY and parsed["visible_text"] == "HASAT"
    assert [item["timestamp_ms"] for item in parsed["frames"]] == stamps
    for raw in (
        {"summary": _SUMMARY, "tags": ["dal"], "frames": []},
        {"summary": _SUMMARY, "tags": ["dal"], "frames": [{"timestampMs": stamps[0], "note": "x" * 161}]},
        {"summary": _SUMMARY, "tags": ["dal"], "brand": "EZA", "frames": []},
        {"summary": "y" * 401, "tags": ["dal"], "frames": [
            {"timestampMs": stamp, "note": "Kare", "tags": []} for stamp in stamps
        ]},
    ):
        with pytest.raises(video.ObservationFailure) as invalid:
            video.parse_video_observation(raw, stamps)
        assert invalid.value.code == "observation_output_invalid"


def _ffmpeg():
    try:
        return _tool_path("EZA_BUSINESS_VIDEO_FFMPEG", "ffmpeg")
    except HTTPException:
        pytest.skip("ffmpeg is not available")


async def _render(binary, path, seconds, size):
    process = await asyncio.create_subprocess_exec(
        binary, "-hide_banner", "-nostdin", "-y",
        "-f", "lavfi", "-i", f"testsrc=size={size}:rate=8",
        "-t", str(seconds),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-an",
        str(path),
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
    )
    assert await process.wait() == 0
    return path


async def test_ffmpeg_extracts_each_bucket_and_deletes_the_frames(tmp_path):
    binary = _ffmpeg()
    made = []
    original = tempfile.mkdtemp

    def tracking(*args, **kwargs):
        kwargs["dir"] = str(tmp_path)
        path = original(*args, **kwargs)
        prefix = kwargs.get("prefix", args[0] if args else "")
        if prefix == "bilign-frames-":
            made.append(path)
            assert str(tmp_path) in path
        return path

    video.tempfile.mkdtemp = tracking
    try:
        clips = {
            2: await _render(binary, tmp_path / "two.mp4", 2, "64x48"),
            6: await _render(binary, tmp_path / "six.mp4", 6, "64x48"),
            12: await _render(binary, tmp_path / "twelve.mp4", 12, "64x48"),
        }
        wide = await _render(binary, tmp_path / "wide.mp4", 2, "800x600")
        expected = {2: [1_000], 6: [1_800, 4_200], 12: [1_440, 4_440, 7_440, 10_440]}
        previous = None
        for seconds, path in clips.items():
            frames = await video.extract_frames(str(path), expected[seconds])
            assert [stamp for stamp, _image in frames] == expected[seconds]
            assert all(image.startswith(b"\xff\xd8") and max(Image.open(io.BytesIO(image)).size) <= 512 for _stamp, image in frames)
            if previous is not None and seconds == 6:
                assert frames[0][1] != frames[1][1]
            previous = frames
            request = video.video_request(frames, "configured-vision")
            assert all(url.startswith("data:image/jpeg;base64,") for url in _images(request))
            assert "mp4" not in " ".join(_texts(request))
            assert path.name not in json.dumps(_texts(request))
        wide_frames = await video.extract_frames(str(wide), [1_000])
        with Image.open(io.BytesIO(wide_frames[0][1])) as image:
            assert max(image.size) == 512
        assert made and all(not os.path.exists(path) for path in made)
    finally:
        video.tempfile.mkdtemp = original


async def test_one_video_call_stores_frames_and_skips_the_derivative(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    original = await _asset(sample, _sha("a"), 60_000, title="Zeytinyagi filmi")
    job = await observe.ensure_observation(sample.db, original, sample.editor.id)
    derivative = await _asset(sample, _sha("b"), 20_000, title="Sessiz kapak", source_id=original.id, audio=False)
    assert await observe.ensure_observation(sample.db, derivative, sample.editor.id) is None
    repeat = await _asset(sample, _sha("a"), 60_000, title="Ayni film")
    assert (await observe.ensure_observation(sample.db, repeat, sample.editor.id)).id == job.id
    await sample.db.commit()
    calls = []
    materialize, extract, paths = _tools(sample)

    async def completer(payload):
        calls.append(payload)
        stamps = [int(item) for item in _texts(payload)[0].split(": ", 1)[1].split(", ")]
        return _response(stamps)

    stop = asyncio.Event()
    await serve(
        _sessions(sample.db, stop, 2), stop=stop, completer=completer, materialize=materialize, extract=extract,
    )
    await sample.db.refresh(job)
    frames = (await sample.db.scalars(select(Frame).where(Frame.observation_id == job.id).order_by(Frame.timestamp_ms))).all()
    assert len(calls) == 1
    assert _images(calls[0]) and all(url.startswith("data:image/jpeg;base64,") for url in _images(calls[0]))
    assert len(_images(calls[0])) == 4
    assert "mp4" not in " ".join(_texts(calls[0]))
    assert original.locator not in " ".join(_texts(calls[0]))
    assert job.status == "ready" and job.summary == _SUMMARY and job.visible_text == "HASAT"
    assert job.input_tokens == 900 and job.output_tokens == 80 and job.provider_model == "configured-vision"
    assert [frame.timestamp_ms for frame in frames] == [7_200, 22_200, 37_200, 52_200]
    assert frames[0].note == "Kare 7200 zeytin"
    assert await observe.observation_count(sample.db, sample.business.id) == 1
    assert paths and all(not os.path.exists(path) for path in paths)
    stop = asyncio.Event()
    await serve(
        _sessions(sample.db, stop, 1), stop=stop, completer=completer, materialize=materialize, extract=extract,
    )
    assert len(calls) == 1


async def test_cover_window_keeps_only_the_frames_it_actually_contains(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    original = await _asset(sample, _sha("c"), 60_000, title="Uzun film")
    await observe.ensure_observation(sample.db, original, sample.editor.id)
    await sample.db.commit()
    materialize, extract, _paths = _tools(sample)
    whole = "Tüm film boyunca zeytin görünüyor."

    async def completer(payload):
        stamps = [int(item) for item in _texts(payload)[0].split(": ", 1)[1].split(", ")]
        return _response(stamps, summary=whole)

    stop = asyncio.Event()
    await serve(
        _sessions(sample.db, stop, 2), stop=stop, completer=completer, materialize=materialize, extract=extract,
    )
    frames = (await sample.db.scalars(select(Frame))).all()
    opening = video.span_evidence(frames, 0, 20_000)
    middle = video.span_evidence(frames, 20_000, 45_000)
    entire = video.span_evidence(frames, 0, 60_000)
    assert opening["sufficient"] is False and opening["summary"] is None and opening["frames"] == []
    assert opening["timestamps"] == [7_200] and opening["required"] == 4
    assert middle["timestamps"] == [22_200, 37_200] and middle["sufficient"] is False and middle["frames"] == []
    assert 7_200 not in middle["timestamps"] and 52_200 not in middle["timestamps"]
    assert entire["sufficient"] is True and entire["summary"] is None
    assert [item["timestamp_ms"] for item in entire["frames"]] == [7_200, 22_200, 37_200, 52_200]
    assert whole not in json.dumps(opening) and whole not in json.dumps(middle) and whole not in json.dumps(entire)
    short = video.span_evidence(
        [{"timestamp_ms": 1_500, "note": "Tek kare", "tags": ["dal"]}], 0, 3_000,
    )
    assert short["sufficient"] is True and short["summary"] is None and short["frames"][0]["note"] == "Tek kare"


async def test_same_video_in_another_brand_is_a_separate_call(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    digest = _sha("d")
    home = await _asset(sample, digest, 3_000, title="Kisa film")
    first = await observe.ensure_observation(sample.db, home, sample.editor.id)
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id), "ownerId": str(sample.outsider.id),
        "slug": "baska-film", "name": "Baska",
    })
    foreign = BusinessBrandAsset(
        id=uuid.uuid4(), business_id=other.id, asset_type="video", title="Kisa film",
        locator_kind="storage", locator=f"brand-videos/{other.id}/{digest}.mp4",
        public_allowed=True, status="published", created_by=sample.outsider.id, revision=1,
        verified_duration=3_000, verified_timescale=1000,
        verified_size_bytes=len(_FILES[digest]), verified_has_audio=True,
    )
    sample.db.add(foreign)
    await sample.db.flush()
    second = await observe.ensure_observation(sample.db, foreign, sample.outsider.id)
    await sample.db.commit()
    assert first.id != second.id and first.business_id != second.business_id
    calls = []
    materialize, extract, _paths = _tools(sample)

    async def completer(payload):
        calls.append(" ".join(_texts(payload)))
        stamps = [int(item) for item in calls[-1].split(": ", 1)[1].split(", ")]
        return _response(stamps)

    stop = asyncio.Event()
    await serve(
        _sessions(sample.db, stop, 4), stop=stop, completer=completer, materialize=materialize, extract=extract,
    )
    assert len(calls) == 2
    assert str(sample.business.id) not in calls[0] and str(other.id) not in calls[1]
    assert await observe.observation_count(sample.db, sample.business.id) == 1
    assert await observe.observation_count(sample.db, other.id) == 1


async def test_timeout_retries_a_crash_recovers_and_cover_work_continues(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    original = await _asset(sample, _sha("e"), 8_000, title="Deneme filmi")
    job = await observe.ensure_observation(sample.db, original, sample.editor.id)
    sample.db.add(BusinessVideoCoverJob(
        id=uuid.uuid4(), business_id=sample.business.id, source_asset_id=original.id,
        idempotency_key="e" * 64, strategy="first_span", start_ticks=0, end_ticks=8_000,
        encoder_profile="test", status="queued", attempts=0, max_attempts=3, created_by=sample.editor.id,
    ))
    await sample.db.commit()
    calls = []
    materialize, extract, _paths = _tools(sample)

    async def timeout(_payload):
        calls.append(1)
        raise video.ObservationFailure("observation_provider_timeout", retryable=True)

    stop = asyncio.Event()
    await serve(
        _sessions(sample.db, stop, 6), stop=stop, completer=timeout, materialize=materialize, extract=extract,
    )
    await sample.db.refresh(job)
    assert len(calls) == 3 and job.status == "failed" and job.error_code == "observation_provider_timeout"
    assert job.attempts == 3
    cover = await cover_jobs.claim_next(sample.db)
    await sample.db.commit()
    assert cover.status == "running" and cover.source_asset_id == original.id

    crashed_asset = await _asset(sample, _sha("f"), 3_000, title="Yarim film")
    crashed = await observe.ensure_observation(sample.db, crashed_asset, sample.editor.id)
    await sample.db.commit()
    claimed = await observe.claim_next_visual(sample.db)
    await sample.db.commit()
    assert claimed.id == crashed.id and claimed.attempts == 1
    from datetime import datetime, timedelta, timezone
    claimed.deadline_at = datetime.now(timezone.utc) - timedelta(seconds=5)
    await sample.db.commit()
    assert await observe.recover_stale(sample.db) == 1
    await sample.db.commit()
    await sample.db.refresh(crashed)
    assert crashed.status == "queued" and crashed.claim_token is None and crashed.attempts == 1
    finished = []

    async def completer(payload):
        finished.append(1)
        stamps = [int(item) for item in _texts(payload)[0].split(": ", 1)[1].split(", ")]
        return _response(stamps)

    stop = asyncio.Event()
    await serve(
        _sessions(sample.db, stop, 2), stop=stop, completer=completer, materialize=materialize, extract=extract,
    )
    await sample.db.refresh(crashed)
    assert finished == [1] and crashed.status == "ready" and crashed.attempts == 2
    assert (await sample.db.scalar(select(func.count()).select_from(Frame).where(Frame.observation_id == crashed.id))) == 1


async def test_missing_video_and_a_remote_locator_do_not_call_the_provider(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    missing = await _asset(sample, _sha("9"), 3_000, title="Kayip film")
    await observe.ensure_observation(sample.db, missing, sample.editor.id)
    remote = await _asset(sample, _sha("8"), 3_000, title="Uzak film")
    remote.locator = "https://cdn.example/film.mp4"
    await sample.db.flush()
    remote_job = await observe.ensure_observation(
        sample.db, remote, sample.editor.id, content_sha256=_sha("8"),
    )
    await sample.db.commit()
    calls = []

    async def materialize(_business, _locator, _dest, _size):
        raise video.ObservationFailure("observation_source_missing", retryable=False)

    async def completer(_payload):
        calls.append(1)
        return _response([0])

    stop = asyncio.Event()
    await serve(_sessions(sample.db, stop, 2), stop=stop, completer=completer, materialize=materialize)
    lost = await sample.db.scalar(select(Observation).where(Observation.asset_id == missing.id))
    assert calls == [] and lost.status == "failed" and lost.error_code == "observation_source_missing"
    assert remote_job is None
    store = MemoryVideoStore()
    owner = uuid.uuid4()
    digest = _sha("7")
    key = f"brand-videos/{owner}/{digest}.mp4"
    store.objects[key] = (b"abcdef", digest)
    dest = asset_dir / "spilled.bin"
    await video.spill_video(store, owner, key, str(dest), 6)
    assert dest.read_bytes() == b"abcdef"
    with pytest.raises(video.ObservationFailure) as remote_copy:
        await video.spill_video(store, owner, "https://cdn.example/film.mp4", str(dest), 6)
    assert remote_copy.value.code == "observation_not_stored"


async def test_ready_video_observation_does_not_change_selection_or_seals(sample, asset_dir, monkeypatch):
    monkeypatch.delenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", raising=False)
    knowledge = await source(sample, content="Kayit metni secimi icin yeterince aciktir.")
    olive = await _confirm(sample, knowledge, await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Zeytinyagi hasadi", "caption": "", "public_allowed": True,
    }, image_bytes=_picture(40, 20, color=(20, 80, 10))))
    forest = await _confirm(sample, knowledge, await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "image", "title": "Sessiz orman", "caption": "", "public_allowed": True,
    }, image_bytes=_picture(40, 20, color=(10, 40, 20))))
    steps = _steps(knowledge, "Zeytinyagi hasadi")
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    explicit = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
        cover_asset_id=forest.id,
    )
    film = await _asset(sample, _sha("1"), 8_000, title="Baska film")
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    await observe.ensure_observation(sample.db, film, sample.editor.id)
    await sample.db.commit()
    materialize, extract, _paths = _tools(sample)

    async def completer(payload):
        stamps = [int(item) for item in _texts(payload)[0].split(": ", 1)[1].split(", ")]
        return _response(stamps, summary="Zeytinyagi hasadi ozeti")

    stop = asyncio.Event()
    await serve(
        _sessions(sample.db, stop, 2), stop=stop, completer=completer, materialize=materialize, extract=extract,
    )
    await sample.db.refresh(draft)
    await sample.db.refresh(explicit)
    await sample.db.refresh(knowledge)
    assert knowledge.content == "Kayit metni secimi icin yeterince aciktir."
    assert draft.revision == 1 and draft.media_plan["coverAssetId"] == str(olive.id)
    assert explicit.revision == 1 and explicit.media_plan["coverAssetId"] == str(forest.id)
    later = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Zeytinyagi hasadi", "Zeytinyagi hasadi ozeti", steps,
    )
    assert later.media_plan["coverAssetId"] == str(olive.id) and later.media_plan["coverMode"] == "automatic"
    for state in ("review", "approved"):
        actor = sample.editor.id if state == "review" else sample.owner.id
        draft = await svc.transition_draft(sample.db, sample.business.id, actor, draft.id, state, draft.revision)
    sealed = draft.media_plan["seal"]
    assert sealed == media.media_seal(draft.media_plan)
    assert "coverMode" not in draft.media_plan
    assert _SUMMARY not in json.dumps(draft.media_plan)
    await export_editorial_conversation(sample.db, sample.business.id, sample.editor.id, draft.id)
    await sample.db.refresh(draft)
    conversation = await sample.db.get(StandaloneConversation, draft.conversation_id)
    sample.db.add(MirrorNetworkNode(
        slug="zeytin-film", user_id=draft.created_by, conversation_id=conversation.client_conversation_id,
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
    await publish_draft(sample.db, sample.business.id, sample.owner.id, draft.id, "zeytin-film", draft.revision)
    published = await sample.db.get(BusinessPublication, ("zeytin-film", 1))
    assert published.media_plan["seal"] == sealed
    assert published.media_plan["coverAssetId"] == str(olive.id)
    assert media.media_identity(published.media_plan) == {"coverAssetId": str(olive.id), "blocks": published.media_plan["blocks"]}


async def test_changed_video_bytes_do_not_reuse_the_old_hash(sample, asset_dir, monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_MEDIA_OBSERVATIONS_ENABLED", "true")
    monkeypatch.setenv("BILIGN_BUSINESS_VISION_CONCURRENCY", "1")
    original = await _asset(sample, _sha("kept"), 8_000, title="Eski film")
    job = await observe.ensure_observation(sample.db, original, sample.editor.id)
    await sample.db.commit()
    calls = []
    other = b"bilign-video-replaced"

    async def materialize(_business, locator, dest, size):
        assert "://" not in locator
        Path(dest).write_bytes(other)

    def extract(path, stamps):
        raise AssertionError("frames are not extracted for a different file")

    async def completer(payload):
        calls.append(payload)
        return _response([0])

    stop = asyncio.Event()
    await serve(
        _sessions(sample.db, stop, 2), stop=stop, completer=completer, materialize=materialize, extract=extract,
    )
    await sample.db.refresh(job)
    queued = await sample.db.scalar(
        select(Observation).where(Observation.content_sha256 == hashlib.sha256(other).hexdigest())
    )
    assert calls == []
    assert job.status == "failed" and job.error_code == "observation_source_stale" and job.summary is None
    assert queued is not None and queued.id != job.id and queued.status == "queued"


async def test_cancelled_frame_extract_reaps_the_process_and_deletes_the_directory(tmp_path, monkeypatch):
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    killed = {}

    class Proc:
        def __init__(self):
            self.returncode = None

        def kill(self):
            killed["yes"] = True
            self.returncode = -9

        async def wait(self):
            if self.returncode is None:
                await asyncio.sleep(30)
            return self.returncode

    async def fake_exec(*_args, **_kwargs):
        return Proc()

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_exec)
    monkeypatch.setattr("backend.services.business_yansi.video_mp4._tool_path", lambda *_args, **_kwargs: "ffmpeg")
    source = tmp_path / "clip.mp4"
    source.write_bytes(b"not-a-real-video")
    task = asyncio.create_task(video.extract_frames(str(source), [1000]))
    await asyncio.sleep(0.05)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert killed.get("yes") is True
    assert list(tmp_path.glob("bilign-frames-*")) == []
