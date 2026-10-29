"""Read an MP4 container, then require a decoded H.264 sample.

mdat is not treated as proof. moov is capped. ffprobe must report H.264 on
every video stream and at least one frame, with an empty error log. ffmpeg
then decodes every video stream to the null muxer. That is a decode check,
not a transcode, and it writes no output file. Production hosts need both
ffprobe and ffmpeg on PATH. Windows has no rlimit; the timeout, output cap,
and process kill are the bounds there. POSIX also sets CPU and file-size
rlimits. Address-space rlimits are not set, because they stop ffprobe itself.
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass

from backend.services.business_yansi.service import fail


MAX_MOOV_BYTES = 2 * 1024 * 1024
MAX_BOXES = 256
MAX_RANGE_READS = 48
MAX_RANGE_BYTES = MAX_MOOV_BYTES + 256 * 1024
PROBE_TIMEOUT_SECONDS = 20
PROBE_REAP_SECONDS = 2
MAX_PROBE_OUTPUT = 64 * 1024
_VISUAL_PREFIX = 66
_SPILL_CHUNK = 64 * 1024


@dataclass(frozen=True)
class Mp4Info:
    duration_seconds: float
    codec: str


class Mp4Source:
    def __init__(self, store, key: str, size: int):
        self.store = store
        self.key = key
        self.size = size
        self.pos = 0
        self.boxes = 0
        self.reads = 0
        self.read_bytes = 0

    def charge_box(self) -> None:
        self.boxes += 1
        if self.boxes > MAX_BOXES:
            fail("video_file_rejected", 422)

    async def read(self, count: int) -> bytes:
        if count < 0 or self.pos + count > self.size:
            fail("video_file_rejected", 422)
        if count == 0:
            return b""
        data = await self._fetch(self.pos, count)
        self.pos += count
        return data

    async def skip(self, count: int) -> None:
        if count < 0 or self.pos + count > self.size:
            fail("video_file_rejected", 422)
        self.pos += count

    async def _fetch(self, start: int, count: int) -> bytes:
        self.reads += 1
        self.read_bytes += count
        if self.reads > MAX_RANGE_READS or self.read_bytes > MAX_RANGE_BYTES:
            fail("video_file_rejected", 422)
        data = await self.store.get_range(self.key, start, start + count - 1)
        if len(data) != count:
            fail("video_file_rejected", 422)
        return data


async def inspect_mp4(source: Mp4Source, *, max_seconds: int) -> Mp4Info:
    size, kind, header = await _header(source)
    if kind != b"ftyp":
        fail("video_file_rejected", 422)
    if not _ftyp_ok(await source.read(size - header)):
        fail("video_file_rejected", 422)
    info = None
    sample = None
    while source.pos + 8 <= source.size:
        size, kind, header = await _header(source)
        payload = size - header
        if kind == b"moov":
            if payload > MAX_MOOV_BYTES:
                fail("video_file_rejected", 422)
            info, sample = _parse_moov(await source.read(payload), max_seconds, source.size)
        else:
            await source.skip(payload)
    if info is None or sample is None:
        fail("video_file_rejected", 422)
    await _require_vcl(source, sample)
    await _probe_h264(source)
    return info


async def _header(source: Mp4Source) -> tuple[int, bytes, int]:
    source.charge_box()
    raw = await source.read(8)
    size = int.from_bytes(raw[:4], "big")
    kind = raw[4:8]
    header = 8
    if size == 1:
        size = int.from_bytes(await source.read(8), "big")
        header = 16
    elif size == 0:
        size = source.size - (source.pos - 8)
    if size < header or kind == b"":
        fail("video_file_rejected", 422)
    return size, kind, header


def _ftyp_ok(payload: bytes) -> bool:
    return len(payload) >= 8 and payload[:4].isalnum()


def _parse_moov(payload: bytes, max_seconds: int, file_size: int) -> tuple[Mp4Info, tuple[int, int, int]]:
    movie_scale = 0
    movie_duration = 0
    tracks = []
    for kind, body in _children(payload):
        if kind == b"mvhd":
            movie_scale, movie_duration = _media_time(body)
        elif kind == b"trak":
            tracks.append(_track(body))
    videos = [track for track in tracks if track[0] == "vide"]
    if not videos:
        fail("video_codec_rejected", 422)
    codecs = {track[1] for track in videos}
    if codecs - {"avc1", "avc3"}:
        fail("video_codec_rejected", 422)
    longest = 0.0
    sample = None
    for _handler, codec, scale, duration, located in videos:
        if scale <= 0:
            scale, duration = movie_scale, movie_duration
        if scale <= 0:
            fail("video_file_rejected", 422)
        if duration > max_seconds * scale:
            fail("video_too_long", 422)
        if located is None:
            fail("video_file_rejected", 422)
        offset, sample_size, length_size = located
        if sample_size <= 0 or offset < 0 or offset + sample_size > file_size:
            fail("video_file_rejected", 422)
        longest = max(longest, duration / scale)
        sample = (offset, sample_size, length_size)
    if sample is None:
        fail("video_file_rejected", 422)
    return Mp4Info(duration_seconds=longest, codec=sorted(codecs)[0]), sample


def _track(payload: bytes):
    handler = ""
    codec = ""
    scale = 0
    duration = 0
    located = None
    for kind, body in _children(payload):
        if kind == b"mdia":
            handler, codec, scale, duration, located = _mdia(body)
    return handler, codec, scale, duration, located


def _mdia(payload: bytes):
    handler = ""
    codec = ""
    scale = 0
    duration = 0
    located = None
    for kind, body in _children(payload):
        if kind == b"mdhd":
            scale, duration = _media_time(body)
        elif kind == b"hdlr" and len(body) >= 12:
            handler = body[8:12].decode("latin1")
        elif kind == b"minf":
            codec, located = _sample_table(body)
    return handler, codec, scale, duration, located


def _sample_table(payload: bytes):
    codec = ""
    located = None
    for kind, body in _children(payload):
        if kind != b"stbl":
            continue
        boxes = dict(_children(body))
        stsd = boxes.get(b"stsd", b"")
        if len(stsd) >= 16:
            codec = stsd[12:16].decode("latin1")
        if codec in {"avc1", "avc3"}:
            located = _located_sample(stsd, boxes.get(b"stsz", b""), boxes.get(b"stco"), boxes.get(b"co64"))
    return codec, located


def _located_sample(stsd: bytes, stsz: bytes, stco: bytes | None, co64: bytes | None):
    if len(stsd) < 8:
        return None
    entry_size = int.from_bytes(stsd[8:12], "big")
    entry = stsd[16 : 8 + entry_size]
    if len(entry) < _VISUAL_PREFIX:
        return None
    avcc = b""
    for kind, body in _children(entry[_VISUAL_PREFIX :]):
        if kind == b"avcC":
            avcc = body
    length_size = _avcc_length_size(avcc)
    if length_size is None or len(stsz) < 12:
        return None
    sample_size = int.from_bytes(stsz[4:8], "big")
    sample_count = int.from_bytes(stsz[8:12], "big")
    if sample_count < 1:
        return None
    if sample_size == 0:
        if len(stsz) < 16:
            return None
        sample_size = int.from_bytes(stsz[12:16], "big")
    offset = _chunk_offset(stco, co64)
    if offset is None:
        return None
    return offset, sample_size, length_size


def _avcc_length_size(payload: bytes) -> int | None:
    if len(payload) < 7 or payload[0] != 1:
        return None
    length_size = (payload[4] & 3) + 1
    if length_size < 1 or length_size > 4:
        return None
    pos = 5
    sps_count = payload[pos] & 31
    pos += 1
    saw_sps = False
    for _index in range(sps_count):
        if pos + 2 > len(payload):
            return None
        size = int.from_bytes(payload[pos : pos + 2], "big")
        pos += 2
        if size < 1 or pos + size > len(payload):
            return None
        if (payload[pos] & 31) == 7:
            saw_sps = True
        pos += size
    if pos >= len(payload):
        return None
    pps_count = payload[pos]
    pos += 1
    saw_pps = False
    for _index in range(pps_count):
        if pos + 2 > len(payload):
            return None
        size = int.from_bytes(payload[pos : pos + 2], "big")
        pos += 2
        if size < 1 or pos + size > len(payload):
            return None
        if (payload[pos] & 31) == 8:
            saw_pps = True
        pos += size
    if not saw_sps or not saw_pps:
        return None
    return length_size


def _chunk_offset(stco: bytes | None, co64: bytes | None) -> int | None:
    if stco is not None and len(stco) >= 12 and int.from_bytes(stco[4:8], "big") >= 1:
        return int.from_bytes(stco[8:12], "big")
    if co64 is not None and len(co64) >= 16 and int.from_bytes(co64[4:8], "big") >= 1:
        return int.from_bytes(co64[8:16], "big")
    return None


async def _require_vcl(source: Mp4Source, sample: tuple[int, int, int]) -> None:
    offset, sample_size, length_size = sample
    window = min(sample_size, 64 * 1024)
    data = await source._fetch(offset, window)
    pos = 0
    found = False
    while pos + length_size + 1 <= len(data):
        nal_size = int.from_bytes(data[pos : pos + length_size], "big")
        if nal_size <= 0 or pos + length_size + nal_size > sample_size:
            fail("video_file_rejected", 422)
        nal_type = data[pos + length_size] & 31
        if 1 <= nal_type <= 5:
            found = True
            break
        if pos + length_size + nal_size > len(data):
            break
        pos += length_size + nal_size
    if not found:
        fail("video_codec_rejected", 422)


async def _probe_h264(source: Mp4Source) -> None:
    fd, path = tempfile.mkstemp(prefix="bilign-video-", suffix=".mp4")
    os.close(fd)
    try:
        with open(path, "wb") as handle:
            reader = getattr(source.store, "read_chunks", None)
            if reader is None:
                offset = 0
                while offset < source.size:
                    end = min(source.size - 1, offset + _SPILL_CHUNK - 1)
                    piece = await source.store.get_range(source.key, offset, end)
                    if len(piece) != end - offset + 1:
                        fail("video_file_rejected", 422)
                    handle.write(piece)
                    offset += len(piece)
            else:
                async for piece in reader(source.key, source.size, _SPILL_CHUNK):
                    handle.write(piece)
        await probe_file(path)
    finally:
        await _unlink_probe(path)


class _ProbeOutputLimit(Exception):
    pass


async def _unlink_probe(path: str) -> None:
    """Retry while Windows still has the file open, then restore cancellation."""
    current = asyncio.current_task()
    paused = 0
    if current is not None:
        while current.cancelling():
            current.uncancel()
            paused += 1
    try:
        for _attempt in range(8):
            try:
                os.remove(path)
                return
            except FileNotFoundError:
                return
            except OSError:
                await asyncio.sleep(0.05)
    finally:
        if paused:
            raise asyncio.CancelledError()


def _tool_path(env_name: str, default: str) -> str:
    configured = os.getenv(env_name, default)
    if os.path.basename(configured) != configured and not os.path.isabs(configured):
        fail("video_probe_unavailable", 503)
    binary = configured if os.path.isabs(configured) else shutil.which(configured)
    if not binary or not os.path.isfile(binary):
        fail("video_probe_unavailable", 503)
    return binary


async def probe_file(path: str) -> None:
    """Decode the file. Missing ffprobe or ffmpeg is a hard failure."""
    ffprobe = _tool_path("EZA_BUSINESS_VIDEO_FFPROBE", "ffprobe")
    ffmpeg = _tool_path("EZA_BUSINESS_VIDEO_FFMPEG", "ffmpeg")
    listed = await _run_bounded(
        ffprobe,
        [
            "-v", "error",
            "-hide_banner",
            "-select_streams", "v",
            "-show_entries", "stream=codec_name,nb_read_frames",
            "-count_frames",
            "-of", "json",
            path,
        ],
    )
    _require_decoded_h264(listed)
    await _run_bounded(
        ffmpeg,
        ["-v", "error", "-hide_banner", "-i", path, "-map", "0:v", "-f", "null", "-"],
    )


def _require_decoded_h264(stdout: bytes) -> None:
    try:
        parsed = json.loads(stdout.decode("utf-8"))
        streams = parsed.get("streams") or []
    except (UnicodeError, json.JSONDecodeError, AttributeError):
        fail("video_codec_rejected", 422)
    if not streams:
        fail("video_codec_rejected", 422)
    for stream in streams:
        try:
            frames = int(stream.get("nb_read_frames") or 0)
        except (TypeError, ValueError):
            fail("video_codec_rejected", 422)
        if stream.get("codec_name") != "h264" or frames < 1:
            fail("video_codec_rejected", 422)


async def _run_bounded(binary: str, args: list[str]) -> bytes:
    process = await asyncio.create_subprocess_exec(
        binary,
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        stdin=asyncio.subprocess.DEVNULL,
        **_probe_limits(),
    )
    try:
        return await _finish_process(process)
    except asyncio.CancelledError:
        await _reap_cancelled(process)
        raise


async def _finish_process(process) -> bytes:
    try:
        stdout, stderr = await asyncio.wait_for(
            asyncio.gather(_read_capped(process.stdout), _read_capped(process.stderr)),
            PROBE_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        await _kill_and_reap(process)
        fail("video_file_rejected", 422)
    except _ProbeOutputLimit:
        await _kill_and_reap(process)
        fail("video_codec_rejected", 422)
    await _wait_bounded(process)
    if process.returncode != 0 or stderr:
        fail("video_codec_rejected", 422)
    return stdout


async def _read_capped(stream) -> bytes:
    buf = bytearray()
    while True:
        piece = await stream.read(4096)
        if not piece:
            return bytes(buf)
        if len(buf) + len(piece) > MAX_PROBE_OUTPUT:
            raise _ProbeOutputLimit()
        buf.extend(piece)


async def _wait_bounded(process) -> None:
    try:
        await asyncio.wait_for(process.wait(), PROBE_REAP_SECONDS)
    except TimeoutError:
        await _kill_and_reap(process)
        fail("video_file_rejected", 422)


async def _kill_and_reap(process) -> None:
    if process.returncode is None:
        try:
            process.kill()
        except ProcessLookupError:
            pass
    try:
        await asyncio.wait_for(process.wait(), PROBE_REAP_SECONDS)
    except (TimeoutError, ProcessLookupError):
        return


async def _reap_cancelled(process) -> None:
    current = asyncio.current_task()
    if current is not None:
        while current.cancelling():
            current.uncancel()
    await _kill_and_reap(process)


def _probe_limits() -> dict:
    if sys.platform == "win32":
        return {}

    def _limit():
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (PROBE_TIMEOUT_SECONDS, PROBE_TIMEOUT_SECONDS))
        resource.setrlimit(resource.RLIMIT_FSIZE, (1024 * 1024, 1024 * 1024))

    return {"preexec_fn": _limit}


def _media_time(payload: bytes) -> tuple[int, int]:
    if len(payload) < 20:
        fail("video_file_rejected", 422)
    version = payload[0]
    if version == 0:
        scale = int.from_bytes(payload[12:16], "big")
        duration = int.from_bytes(payload[16:20], "big")
    elif version == 1 and len(payload) >= 32:
        scale = int.from_bytes(payload[20:24], "big")
        duration = int.from_bytes(payload[24:32], "big")
    else:
        fail("video_file_rejected", 422)
    return scale, duration


def _children(payload: bytes):
    pos = 0
    seen = 0
    while pos + 8 <= len(payload):
        seen += 1
        if seen > MAX_BOXES:
            fail("video_file_rejected", 422)
        size = int.from_bytes(payload[pos : pos + 4], "big")
        kind = payload[pos + 4 : pos + 8]
        header = 8
        if size == 1:
            if pos + 16 > len(payload):
                fail("video_file_rejected", 422)
            size = int.from_bytes(payload[pos + 8 : pos + 16], "big")
            header = 16
        if size < header or pos + size > len(payload):
            fail("video_file_rejected", 422)
        yield kind, payload[pos + header : pos + size]
        pos += size
    if pos != len(payload):
        fail("video_file_rejected", 422)
