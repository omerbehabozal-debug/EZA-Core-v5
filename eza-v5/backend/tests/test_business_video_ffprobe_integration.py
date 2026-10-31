"""Real FFmpeg and FFprobe checks for Business video validation.

Skipped unless EZA_BUSINESS_VIDEO_FFPROBE and EZA_BUSINESS_VIDEO_FFMPEG are
absolute paths to the real binaries. Nothing here stubs probe_file or
inspect_mp4. Temporary fixtures are created in pytest's temp directory.
"""
from __future__ import annotations

import asyncio
import ctypes
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException

from backend.services.business_yansi import video_mp4
from backend.services.business_yansi.video_mp4 import Mp4Source, inspect_mp4, probe_file
from backend.services.business_yansi.video_storage import MemoryVideoStore
from backend.tests.test_business_video_storage import _mp4

_PROBE_LIMIT_SECONDS = 20
_PROBE_OUTPUT_CAP = 64 * 1024


def _settings() -> tuple[str, str] | None:
    ffprobe = os.getenv("EZA_BUSINESS_VIDEO_FFPROBE", "").strip()
    ffmpeg = os.getenv("EZA_BUSINESS_VIDEO_FFMPEG", "").strip()
    if not ffprobe and not ffmpeg:
        return None
    if not ffprobe or not ffmpeg:
        pytest.fail("both FFmpeg and FFprobe paths are required")
    if not os.path.isabs(ffprobe) or not os.path.isabs(ffmpeg):
        pytest.fail("FFmpeg and FFprobe paths must be absolute")
    if not os.path.isfile(ffprobe) or not os.path.isfile(ffmpeg):
        pytest.fail("FFmpeg or FFprobe path does not exist")
    return ffprobe, ffmpeg


def _process_running(pid: int) -> bool:
    """True only while the OS still reports the process as executing."""
    if pid <= 0:
        return False
    if sys.platform == "win32":
        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        code = ctypes.c_ulong()
        ok = ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(code))
        ctypes.windll.kernel32.CloseHandle(handle)
        return bool(ok) and code.value == 259
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _encode(ffmpeg: str, dest: Path, args: list[str]) -> bool:
    completed = subprocess.run(
        [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", *args, str(dest)],
        check=False,
        capture_output=True,
        timeout=120,
    )
    return completed.returncode == 0 and dest.is_file() and dest.stat().st_size > 32


def _probe_document(ffprobe: str, path: Path) -> dict:
    completed = subprocess.run(
        [
            ffprobe, "-v", "error", "-count_frames", "-show_entries",
            "stream=codec_type,codec_name,nb_read_frames:format=duration", "-of", "json", str(path),
        ],
        check=False,
        capture_output=True,
        timeout=40,
    )
    assert completed.returncode == 0, completed.returncode
    return json.loads(completed.stdout.decode("utf-8"))


def _mdat_bounds(data: bytes) -> tuple[int, int]:
    pos = 0
    while pos + 8 <= len(data):
        size = int.from_bytes(data[pos : pos + 4], "big")
        kind = data[pos + 4 : pos + 8]
        header = 8
        if size == 1 and pos + 16 <= len(data):
            size = int.from_bytes(data[pos + 8 : pos + 16], "big")
            header = 16
        if size < header or pos + size > len(data):
            break
        if kind == b"mdat":
            return pos + header, pos + size
        pos += size
    raise AssertionError("mdat box not found")


def _video_streams(document: dict) -> list[dict]:
    return [stream for stream in document.get("streams") or [] if stream.get("codec_type") == "video"]


async def _inspect(payload: bytes, *, max_seconds: int):
    store = MemoryVideoStore()
    business = uuid.uuid4()
    key = f"brand-videos/{business}/staging/{uuid.uuid4()}.partial"
    store.objects[key] = (payload, hashlib.sha256(payload).hexdigest())
    return await inspect_mp4(Mp4Source(store, key, len(payload)), max_seconds=max_seconds)


def _detail(exc: HTTPException) -> str:
    detail = exc.detail
    if isinstance(detail, dict):
        return str(detail.get("code") or "")
    return ""


@pytest.fixture(scope="module")
def clips(tmp_path_factory):
    configured = _settings()
    if configured is None:
        pytest.skip("BLOCKED: absolute FFmpeg and FFprobe paths are not configured")
    ffprobe, ffmpeg = configured
    folder = tmp_path_factory.mktemp("bilign-ffprobe")
    made: dict[str, Path | None] = {}

    def one(name: str, args: list[str]) -> None:
        dest = folder / name
        made[name] = dest if _encode(ffmpeg, dest, args) else None

    one("h264.mp4", ["-f", "lavfi", "-i", "testsrc=size=128x128:rate=15:d=2", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-movflags", "+faststart"])
    one("hevc.mp4", ["-f", "lavfi", "-i", "color=c=black:s=64x64:r=8:d=1", "-c:v", "libx265", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-tag:v", "hvc1"])
    one("mpeg4.mp4", ["-f", "lavfi", "-i", "color=c=black:s=64x64:r=8:d=1", "-c:v", "mpeg4", "-q:v", "8"])
    one("audio.mp4", ["-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "aac"])
    one("cover-long.mp4", ["-f", "lavfi", "-i", "color=c=black:s=64x64:r=8:d=21", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"])
    one("step-long.mp4", ["-f", "lavfi", "-i", "color=c=black:s=64x64:r=4:d=61", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"])
    left = folder / "left.mp4"
    right = folder / "right.mp4"
    if _encode(ffmpeg, left, ["-f", "lavfi", "-i", "color=c=black:s=64x64:r=10:d=1", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"]) and _encode(
        ffmpeg, right, ["-f", "lavfi", "-i", "color=c=white:s=48x48:r=10:d=1", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"]
    ):
        one("dual.mp4", ["-i", str(left), "-i", str(right), "-map", "0:v:0", "-map", "1:v:0", "-c", "copy"])
    else:
        made["dual.mp4"] = None
    made["ffprobe"] = Path(ffprobe)
    made["ffmpeg"] = Path(ffmpeg)
    return made


def _require(clips, name: str) -> Path:
    path = clips.get(name)
    if not isinstance(path, Path) or not path.is_file():
        pytest.skip(f"LIMITATION: this FFmpeg build did not produce {name}")
    return path


def test_configured_binaries_are_real_ffmpeg_and_ffprobe(clips):
    from backend.services.business_yansi import video_mp4

    assert video_mp4.PROBE_TIMEOUT_SECONDS == _PROBE_LIMIT_SECONDS
    assert video_mp4.MAX_PROBE_OUTPUT == _PROBE_OUTPUT_CAP
    for key, marker in (("ffmpeg", b"ffmpeg version"), ("ffprobe", b"ffprobe version")):
        binary = clips[key]
        completed = subprocess.run([str(binary), "-version"], check=False, capture_output=True, timeout=20)
        assert completed.returncode == 0
        assert marker in completed.stdout


async def test_valid_h264_matches_independent_probe_and_leaves_no_output(clips, monkeypatch):
    path = _require(clips, "h264.mp4")
    document = _probe_document(str(clips["ffprobe"]), path)
    streams = _video_streams(document)
    assert len(streams) == 1
    assert streams[0]["codec_name"] == "h264"
    assert int(streams[0]["nb_read_frames"]) >= 1
    duration = float(document["format"]["duration"])
    spills: list[str] = []
    real_mkstemp = tempfile.mkstemp

    def spy(*args, **kwargs):
        fd, name = real_mkstemp(*args, **kwargs)
        if "bilign-video-" in name:
            spills.append(name)
        return fd, name

    monkeypatch.setattr(tempfile, "mkstemp", spy)
    info = await _inspect(path.read_bytes(), max_seconds=20)
    assert info.codec == "avc1"
    assert abs(info.duration_seconds - duration) < 0.35
    assert spills and all(not os.path.exists(name) for name in spills)
    assert not list(Path(tempfile.gettempdir()).glob("bilign-video-*.mp4"))


async def test_hevc_and_mpeg4_are_rejected(clips):
    hevc = _require(clips, "hevc.mp4")
    hevc_doc = _probe_document(str(clips["ffprobe"]), hevc)
    assert _video_streams(hevc_doc)[0]["codec_name"] == "hevc"
    with pytest.raises(HTTPException) as hevc_rejected:
        await _inspect(hevc.read_bytes(), max_seconds=20)
    assert _detail(hevc_rejected.value) == "video_codec_rejected"
    mpeg4 = _require(clips, "mpeg4.mp4")
    mpeg4_doc = _probe_document(str(clips["ffprobe"]), mpeg4)
    assert _video_streams(mpeg4_doc)[0]["codec_name"] == "mpeg4"
    with pytest.raises(HTTPException) as mpeg4_rejected:
        await _inspect(mpeg4.read_bytes(), max_seconds=20)
    assert _detail(mpeg4_rejected.value) == "video_codec_rejected"


async def test_audio_only_mp4_is_rejected(clips):
    path = _require(clips, "audio.mp4")
    document = _probe_document(str(clips["ffprobe"]), path)
    assert _video_streams(document) == []
    assert any(stream.get("codec_type") == "audio" for stream in document.get("streams") or [])
    with pytest.raises(HTTPException) as rejected:
        await _inspect(path.read_bytes(), max_seconds=20)
    assert _detail(rejected.value) == "video_codec_rejected"


async def test_truncated_and_corrupted_mp4_are_rejected(clips, monkeypatch):
    path = _require(clips, "h264.mp4")
    original = path.read_bytes()
    with pytest.raises(HTTPException) as truncated:
        await _inspect(original[: max(16, len(original) // 5)], max_seconds=20)
    assert _detail(truncated.value) in {"video_file_rejected", "video_codec_rejected"}
    damaged = bytearray(original)
    media_start, media_end = _mdat_bounds(original)
    # Leave the first sample intact so the container parser can reach the decoder.
    corrupt_at = min(media_end, media_start + 2048)
    assert corrupt_at < media_end
    for index in range(corrupt_at, media_end):
        damaged[index] ^= 0x5A
    spills: list[str] = []
    real_mkstemp = tempfile.mkstemp

    def spy(*args, **kwargs):
        fd, name = real_mkstemp(*args, **kwargs)
        if "bilign-video-" in name:
            spills.append(name)
        return fd, name

    monkeypatch.setattr(tempfile, "mkstemp", spy)
    with pytest.raises(HTTPException) as corrupted:
        await _inspect(bytes(damaged), max_seconds=20)
    assert _detail(corrupted.value) in {"video_file_rejected", "video_codec_rejected"}
    if not spills:
        pytest.fail("LIMITATION: corruption was rejected before FFprobe ran, so a decoder error was not observed")
    assert all(not os.path.exists(name) for name in spills)


async def test_cover_over_20_seconds_and_step_over_60_seconds_are_rejected(clips):
    cover = _require(clips, "cover-long.mp4")
    step = _require(clips, "step-long.mp4")
    cover_duration = float(_probe_document(str(clips["ffprobe"]), cover)["format"]["duration"])
    step_duration = float(_probe_document(str(clips["ffprobe"]), step)["format"]["duration"])
    assert cover_duration > 20
    assert step_duration > 60
    with pytest.raises(HTTPException) as cover_rejected:
        await _inspect(cover.read_bytes(), max_seconds=20)
    assert _detail(cover_rejected.value) == "video_too_long"
    with pytest.raises(HTTPException) as step_rejected:
        await _inspect(step.read_bytes(), max_seconds=60)
    assert _detail(step_rejected.value) == "video_too_long"


async def test_every_video_stream_is_decoded(clips):
    path = _require(clips, "dual.mp4")
    streams = _video_streams(_probe_document(str(clips["ffprobe"]), path))
    assert len(streams) >= 2
    assert {stream["codec_name"] for stream in streams} == {"h264"}
    assert all(int(stream["nb_read_frames"]) >= 1 for stream in streams)
    info = await _inspect(path.read_bytes(), max_seconds=20)
    assert info.codec == "avc1"


async def test_missing_binary_fails_closed_before_decode(clips, monkeypatch):
    path = _require(clips, "h264.mp4")
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFPROBE", "bilign-ffprobe-missing")
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFMPEG", str(clips["ffmpeg"]))
    with pytest.raises(HTTPException) as missing_probe:
        await _inspect(path.read_bytes(), max_seconds=20)
    assert missing_probe.value.status_code == 503
    assert _detail(missing_probe.value) == "video_probe_unavailable"
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFPROBE", str(clips["ffprobe"]))
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFMPEG", "bilign-ffmpeg-missing")
    with pytest.raises(HTTPException) as missing_ffmpeg:
        await _inspect(path.read_bytes(), max_seconds=20)
    assert missing_ffmpeg.value.status_code == 503
    assert _detail(missing_ffmpeg.value) == "video_probe_unavailable"


async def test_cancellation_removes_the_probe_spill(clips, monkeypatch):
    path = _require(clips, "cover-long.mp4")
    created = asyncio.Event()
    spills: list[str] = []
    real_mkstemp = tempfile.mkstemp

    def spy(*args, **kwargs):
        fd, name = real_mkstemp(*args, **kwargs)
        if "bilign-video-" in name:
            spills.append(name)
            created.set()
        return fd, name

    monkeypatch.setattr(tempfile, "mkstemp", spy)
    task = asyncio.create_task(_inspect(path.read_bytes(), max_seconds=60))
    await asyncio.wait_for(created.wait(), 30)
    await asyncio.sleep(0.05)
    if task.done():
        pytest.fail("LIMITATION: probe finished before cancellation, so cleanup during decode was not observed")
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert spills and all(not os.path.exists(name) for name in spills)


async def test_probe_timeout_kills_the_subprocess_and_deletes_the_spill(monkeypatch, tmp_path):
    """The production deadline is 20s. A sleeper proves that deadline kills the process."""
    assert video_mp4.PROBE_TIMEOUT_SECONDS == _PROBE_LIMIT_SECONDS
    assert video_mp4.MAX_PROBE_OUTPUT == _PROBE_OUTPUT_CAP
    stand_in = tmp_path / "probe-stand-in"
    stand_in.write_bytes(b"")
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFPROBE", str(stand_in.resolve()))
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFMPEG", str(stand_in.resolve()))

    launched: list[asyncio.subprocess.Process] = []
    real_exec = asyncio.create_subprocess_exec

    async def hang_exec(*_args, **_kwargs):
        process = await real_exec(
            sys.executable,
            "-c",
            "import time; time.sleep(3600)",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            stdin=asyncio.subprocess.DEVNULL,
        )
        launched.append(process)
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", hang_exec)
    real_wait = asyncio.wait_for
    requested: list[float] = []

    async def observe_deadline(awaitable, timeout):
        requested.append(timeout)
        if timeout == video_mp4.PROBE_TIMEOUT_SECONDS:
            return await real_wait(awaitable, 0.4)
        return await real_wait(awaitable, timeout)

    monkeypatch.setattr(asyncio, "wait_for", observe_deadline)
    spills: list[str] = []
    real_mkstemp = tempfile.mkstemp

    def spy_spill(*args, **kwargs):
        fd, name = real_mkstemp(*args, **kwargs)
        if "bilign-video-" in name:
            spills.append(name)
        return fd, name

    monkeypatch.setattr(tempfile, "mkstemp", spy_spill)
    try:
        with pytest.raises(HTTPException) as rejected:
            await _inspect(_mp4(seconds=1), max_seconds=20)
        assert _detail(rejected.value) == "video_file_rejected"
        assert requested.count(video_mp4.PROBE_TIMEOUT_SECONDS) == 1
        assert video_mp4.PROBE_TIMEOUT_SECONDS == 20
        assert len(launched) == 1
        process = launched[0]
        assert process.returncode is not None
        assert not _process_running(process.pid)
        assert spills and all(not os.path.exists(name) for name in spills)
    finally:
        for process in launched:
            if process.returncode is None:
                process.kill()
                await process.wait()


async def test_probe_file_rejects_a_non_h264_file_and_a_truncated_file(clips):
    """Reach probe_file itself for a real decoder rejection and a real decode error."""
    hevc = _require(clips, "hevc.mp4")
    with pytest.raises(HTTPException) as codec:
        await probe_file(str(hevc))
    assert _detail(codec.value) == "video_codec_rejected"
    truncated = clips["h264.mp4"].parent / "truncated-for-probe.mp4"
    original = _require(clips, "h264.mp4").read_bytes()
    truncated.write_bytes(original[: max(64, len(original) // 3)])
    with pytest.raises(HTTPException) as broken:
        await probe_file(str(truncated))
    assert _detail(broken.value) in {"video_codec_rejected", "video_file_rejected"}
    truncated.unlink(missing_ok=True)
