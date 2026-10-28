"""Read an MP4 container without loading the media payload.

mdat is skipped. moov is capped. Codec and duration come from the video track.
"""
from __future__ import annotations

from dataclasses import dataclass

from backend.services.business_yansi.service import fail


MAX_MOOV_BYTES = 2 * 1024 * 1024


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

    async def read(self, count: int) -> bytes:
        if count < 0 or self.pos + count > self.size:
            fail("video_file_rejected", 422)
        if count == 0:
            return b""
        data = await self.store.get_range(self.key, self.pos, self.pos + count - 1)
        if len(data) != count:
            fail("video_file_rejected", 422)
        self.pos += count
        return data

    async def skip(self, count: int) -> None:
        if count < 0 or self.pos + count > self.size:
            fail("video_file_rejected", 422)
        self.pos += count


async def inspect_mp4(source: Mp4Source, *, max_seconds: int) -> Mp4Info:
    size, kind, header = await _header(source)
    if kind != b"ftyp":
        fail("video_file_rejected", 422)
    if not _ftyp_ok(await source.read(size - header)):
        fail("video_file_rejected", 422)
    info = None
    while source.pos + 8 <= source.size:
        size, kind, header = await _header(source)
        payload = size - header
        if kind == b"moov":
            if payload > MAX_MOOV_BYTES:
                fail("video_file_rejected", 422)
            info = _parse_moov(await source.read(payload), max_seconds)
        else:
            await source.skip(payload)
    if info is None:
        fail("video_file_rejected", 422)
    return info


async def _header(source: Mp4Source) -> tuple[int, bytes, int]:
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


def _parse_moov(payload: bytes, max_seconds: int) -> Mp4Info:
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
    for _handler, codec, scale, duration in videos:
        if scale <= 0:
            scale, duration = movie_scale, movie_duration
        if scale <= 0:
            fail("video_file_rejected", 422)
        if duration > max_seconds * scale:
            fail("video_too_long", 422)
        longest = max(longest, duration / scale)
    return Mp4Info(duration_seconds=longest, codec=sorted(codecs)[0])


def _track(payload: bytes) -> tuple[str, str, int, int]:
    handler = ""
    codec = ""
    scale = 0
    duration = 0
    for kind, body in _children(payload):
        if kind == b"mdia":
            handler, codec, scale, duration = _mdia(body)
    return handler, codec, scale, duration


def _mdia(payload: bytes) -> tuple[str, str, int, int]:
    handler = ""
    codec = ""
    scale = 0
    duration = 0
    for kind, body in _children(payload):
        if kind == b"mdhd":
            scale, duration = _media_time(body)
        elif kind == b"hdlr" and len(body) >= 12:
            handler = body[8:12].decode("latin1")
        elif kind == b"minf":
            codec = _codec(body)
    return handler, codec, scale, duration


def _codec(payload: bytes) -> str:
    for kind, body in _children(payload):
        if kind == b"stbl":
            for child, sample in _children(body):
                if child == b"stsd" and len(sample) >= 16:
                    return sample[12:16].decode("latin1")
    return ""


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
    while pos + 8 <= len(payload):
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
