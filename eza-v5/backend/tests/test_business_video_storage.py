"""Immutable Business video storage. No live bucket and no local video disk."""
import asyncio
import hashlib
import uuid
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from sqlalchemy import func, select

from backend.models.business_brand_assets import BusinessBrandAsset
from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.brand_assets import normalize_asset
from backend.services.business_yansi.service import source_hash
from backend.services.business_yansi.video_ingest import (
    CHUNK_BYTES,
    COVER_MAX_BYTES,
    COVER_MAX_SECONDS,
    STEP_MAX_BYTES,
    STEP_MAX_SECONDS,
    ingest_upload,
    ingest_url,
)
from backend.services.business_yansi import video_ingest as ingest_module
from backend.services.business_yansi import video_storage as storage
from backend.services.business_yansi import video_url_guard as guard
from backend.services.business_yansi.video_storage import (
    MemoryVideoStore,
    S3VideoStore,
    VideoObjectImmutable,
    assert_brand_key,
    authorization_header,
    canonical_query,
    staging_object_key,
    video_object_key,
    video_store_from_env,
)
from backend.tests.test_business_yansi import sample


_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
_S3_ENV = (
    "EZA_BUSINESS_VIDEO_S3_ENDPOINT",
    "EZA_BUSINESS_VIDEO_S3_BUCKET",
    "EZA_BUSINESS_VIDEO_S3_REGION",
    "EZA_BUSINESS_VIDEO_S3_ACCESS_KEY_ID",
    "EZA_BUSINESS_VIDEO_S3_SECRET_ACCESS_KEY",
)


@pytest.fixture(autouse=True)
def _no_live_bucket(monkeypatch):
    for name in _S3_ENV:
        monkeypatch.delenv(name, raising=False)


class VideoQuotaRedis:
    """In-process EVAL double shared by test workers. Not a production fallback."""

    def __init__(self, store=None):
        self.sets = store if store is not None else {}

    async def eval(self, script, numkeys, *rest):
        keys = rest[:numkeys]
        argv = rest[numkeys:]
        if script.startswith("-- video-rate"):
            return self._rate(keys[0], int(argv[0]), int(argv[1]), int(argv[2]), str(argv[3]))
        if script.startswith("-- video-lease-acquire"):
            return self._lease(keys[0], int(argv[0]), int(argv[1]), int(argv[2]), str(argv[3]))
        if script.startswith("-- video-lease-release"):
            rows = self.sets.get(keys[0], {})
            return 1 if rows.pop(str(argv[0]), None) is not None else 0
        raise RuntimeError("unknown video quota script")

    def _rows(self, key):
        return self.sets.setdefault(key, {})

    def _rate(self, key, now, window, limit, token):
        rows = self._rows(key)
        for member, score in list(rows.items()):
            if score <= now - window:
                del rows[member]
        if len(rows) >= limit:
            return 0
        rows[token] = now
        return 1

    def _lease(self, key, now, ttl, limit, token):
        rows = self._rows(key)
        for member, score in list(rows.items()):
            if score <= now:
                del rows[member]
        if len(rows) >= limit:
            return 0
        rows[token] = now + ttl
        return 1


@pytest.fixture(autouse=True)
def _isolated_video_budget(monkeypatch):
    quota = VideoQuotaRedis()

    async def client():
        return quota

    monkeypatch.setattr("backend.services.business_yansi.video_ingest._redis", client)
    from backend.services.business_yansi.video_ingest import reset_video_budget_for_tests
    reset_video_budget_for_tests()


@pytest.fixture(autouse=True)
def _accept_structurally_valid_h264(monkeypatch):
    async def accept(_path: str) -> None:
        return None

    monkeypatch.setattr("backend.services.business_yansi.video_mp4.probe_file", accept)


@pytest.fixture
def asset_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("EZA_BRAND_ASSET_DIR", str(tmp_path))
    return tmp_path


def _box(kind: bytes, payload: bytes) -> bytes:
    return (len(payload) + 8).to_bytes(4, "big") + kind + payload


def _box64(kind: bytes, payload: bytes) -> bytes:
    total = 16 + len(payload)
    return b"\x00\x00\x00\x01" + kind + total.to_bytes(8, "big") + payload


_SPS = bytes([0x67, 0x42, 0x00, 0x0A, 0xF8, 0x41, 0xA2])
_PPS = bytes([0x68, 0xCE, 0x38, 0x80])
_IDR = bytes([0x65, 0x88, 0x84, 0x21, 0xA0])
_COMPLETE_XML = (
    b'<?xml version="1.0" encoding="UTF-8"?>'
    b"<CompleteMultipartUploadResult><Location>https://video.example/x</Location>"
    b"<Bucket>bilign-video</Bucket><Key>k</Key><ETag>\"abc\"</ETag></CompleteMultipartUploadResult>"
)
_COPY_XML = b"<CopyObjectResult><LastModified>2020-01-01T00:00:00.000Z</LastModified><ETag>\"abc\"</ETag></CopyObjectResult>"


def _nal(payload: bytes) -> bytes:
    return len(payload).to_bytes(4, "big") + payload


def _avcc() -> bytes:
    return b"".join((
        bytes([1, _SPS[1], 0, _SPS[3], 0xFF, 0xE1]),
        len(_SPS).to_bytes(2, "big"), _SPS,
        bytes([1]),
        len(_PPS).to_bytes(2, "big"), _PPS,
    ))


def _visual(codec: bytes) -> bytes:
    body = bytearray(78)
    body[6:8] = (1).to_bytes(2, "big")
    body[24:26] = (16).to_bytes(2, "big")
    body[26:28] = (16).to_bytes(2, "big")
    body[28:32] = (0x00480000).to_bytes(4, "big")
    body[32:36] = (0x00480000).to_bytes(4, "big")
    body[40:42] = (1).to_bytes(2, "big")
    body[74:76] = (0x0018).to_bytes(2, "big")
    body[76:78] = b"\xff\xff"
    extra = _box(b"avcC", _avcc()) if codec in {b"avc1", b"avc3"} else b""
    return _box(codec, bytes(body) + extra)


def _mp4(*, codec=b"avc1", seconds=1, timescale=1000, handler=b"vide", pad=0, wide_mdat=False, extra_codec=None, with_audio=False) -> bytes:
    duration = seconds * timescale
    ftyp = _box(b"ftyp", b"isom" + b"\x00\x00\x00\x00" + b"isom")
    real = codec in {b"avc1", b"avc3"} and handler == b"vide"
    sample = _nal(_SPS) + _nal(_PPS) + _nal(_IDR) if real else b""
    payload = sample + (b"\x00" * pad)
    mdat = _box64(b"mdat", payload) if wide_mdat else _box(b"mdat", payload)
    offset = len(ftyp) + (16 if wide_mdat else 8)
    mvhd = _box(b"mvhd", b"\x00" * 12 + timescale.to_bytes(4, "big") + duration.to_bytes(4, "big") + b"\x00" * 80)
    mdhd = _box(b"mdhd", b"\x00" * 12 + timescale.to_bytes(4, "big") + duration.to_bytes(4, "big") + b"\x00\x00\x00\x00")
    hdlr = _box(b"hdlr", b"\x00" * 8 + handler + b"\x00" * 13)
    if real:
        stsd = _box(b"stsd", b"\x00\x00\x00\x00" + (1).to_bytes(4, "big") + _visual(codec))
        stsz = _box(b"stsz", b"\x00\x00\x00\x00" + (0).to_bytes(4, "big") + (1).to_bytes(4, "big") + len(sample).to_bytes(4, "big"))
        stco = _box(b"stco", b"\x00\x00\x00\x00" + (1).to_bytes(4, "big") + offset.to_bytes(4, "big"))
        stbl_body = stsd + stsz + stco
    else:
        entry = (16).to_bytes(4, "big") + codec + b"\x00" * 8
        stbl_body = _box(b"stsd", b"\x00\x00\x00\x00" + (1).to_bytes(4, "big") + entry)
    trak = _box(b"trak", _box(b"mdia", mdhd + hdlr + _box(b"minf", _box(b"stbl", stbl_body))))
    second = b""
    if extra_codec is not None:
        entry = (16).to_bytes(4, "big") + extra_codec + b"\x00" * 8
        stsd2 = _box(b"stsd", b"\x00\x00\x00\x00" + (1).to_bytes(4, "big") + entry)
        hdlr2 = _box(b"hdlr", b"\x00" * 8 + b"vide" + b"\x00" * 13)
        second = _box(b"trak", _box(b"mdia", mdhd + hdlr2 + _box(b"minf", _box(b"stbl", stsd2))))
    audio = b""
    if with_audio:
        sound = _box(b"hdlr", b"\x00" * 8 + b"soun" + b"\x00" * 13)
        audio = _box(b"trak", _box(b"mdia", mdhd + sound))
    moov = _box(b"moov", mvhd + trak + second + audio)
    return ftyp + mdat + moov


class Upload:
    def __init__(self, data: bytes):
        self.data = data
        self.offset = 0

    async def read(self, count: int) -> bytes:
        piece = self.data[self.offset : self.offset + count]
        self.offset += len(piece)
        return piece


class BreakingUpload(Upload):
    def __init__(self, data: bytes):
        super().__init__(data)
        self.reads = 0

    async def read(self, count: int) -> bytes:
        self.reads += 1
        if self.reads > 1:
            raise ConnectionError("reset")
        return await super().read(min(count, 10))


class Reader:
    def __init__(self, payload: bytes):
        self.payload = payload
        self.offset = 0

    async def read(self, count: int) -> bytes:
        piece = self.payload[self.offset : self.offset + count]
        self.offset += len(piece)
        return piece


class Exchange:
    def __init__(self, pages: list[bytes]):
        self.pages = list(pages)
        self.calls = []

    async def __call__(self, ip, host, request):
        self.calls.append((ip, host, request))
        return Reader(self.pages.pop(0))


class RangeStore:
    def __init__(self, inner):
        self.inner = inner
        self.ranges = []

    async def get_range(self, key, start, end):
        self.ranges.append((start, end))
        return await self.inner.get_range(key, start, end)

    def __getattr__(self, name):
        return getattr(self.inner, name)


class S3Response:
    def __init__(self, status, body=b"", etag="", upload_id="", size=0, sha256=""):
        self.status = status
        self.body = body
        self.etag = etag
        self.upload_id = upload_id
        self.size = size
        self.sha256 = sha256


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.uploads = {}
        self.aborted = []
        self.part_sizes = []
        self.fail_parts = set()
        self.lock = asyncio.Lock()
        self.seq = 0
        self.complete_body = _COMPLETE_XML
        self.copy_body = _COPY_XML
        self.size_override = {}
        self.destination_guards = []

    async def request(self, method, url, headers, body):
        parsed = urlsplit(url)
        key = parsed.path.split("/", 2)[2]
        query = parse_qs(parsed.query, keep_blank_values=True)
        if method == "POST" and "uploads" in query and "uploadId" not in query:
            self.seq += 1
            upload_id = f"up{self.seq}"
            self.uploads[(key, upload_id)] = {}
            xml = f"<UploadId>{upload_id}</UploadId>".encode()
            return S3Response(200, xml, upload_id=upload_id)
        if method == "PUT" and "partNumber" in query:
            number = int(query["partNumber"][0])
            if number in self.fail_parts:
                raise ConnectionError("part down")
            data = body if isinstance(body, bytes) else b""
            self.uploads[(key, query["uploadId"][0])][number] = data
            self.part_sizes.append(len(data))
            return S3Response(200, etag=f'"p{number}"')
        if method == "POST" and "uploadId" in query:
            upload_id = query["uploadId"][0]
            parts = self.uploads.pop((key, upload_id))
            blob = b"".join(parts[number] for number in sorted(parts))
            async with self.lock:
                self.objects[key] = {"body": blob, "sha": ""}
            return S3Response(200, self.complete_body)
        if method == "DELETE" and "uploadId" in query:
            self.uploads.pop((key, query["uploadId"][0]), None)
            self.aborted.append(key)
            return S3Response(204)
        if method == "HEAD":
            obj = self.objects.get(key)
            if obj is None:
                return S3Response(404)
            return S3Response(200, size=self.size_override.get(key, len(obj["body"])), sha256=obj["sha"])
        if method == "GET":
            obj = self.objects[key]
            span = headers["range"].split("=", 1)[1]
            start, end = (int(part) for part in span.split("-"))
            data = obj["body"][start : end + 1]
            return S3Response(206, data, size=len(data))
        if method == "PUT" and "x-amz-copy-source" in headers:
            async with self.lock:
                if headers.get("cf-copy-destination-if-none-match") == "*":
                    self.destination_guards.append("cf-copy-destination-if-none-match")
                elif headers.get("if-none-match") == "*":
                    self.destination_guards.append("if-none-match")
                else:
                    self.destination_guards.append("")
                if key in self.objects and self.destination_guards[-1]:
                    return S3Response(412)
                source = headers["x-amz-copy-source"].lstrip("/").split("/", 1)[1]
                original = self.objects[source]
                self.objects[key] = {"body": original["body"], "sha": headers.get("x-amz-meta-sha256", "")}
            return S3Response(200, self.copy_body)
        if method == "DELETE":
            self.objects.pop(key, None)
            return S3Response(204)
        return S3Response(500)


def _http(status: int, headers: dict, body: bytes = b"") -> bytes:
    lines = "".join(f"{name}: {value}\r\n" for name, value in headers.items())
    return f"HTTP/1.1 {status} TEST\r\n{lines}\r\n".encode() + body


def _finals(store, business_id):
    prefix = f"brand-videos/{business_id}/"
    return [key for key, _row in _rows(store) if key.startswith(prefix) and key.endswith(".mp4") and "/staging/" not in key]


def _rows(store):
    if isinstance(store, MemoryVideoStore):
        return list(store.objects.items())
    return [(key, (row["body"], row["sha"])) for key, row in store.objects.items()]


async def _asset_count(db):
    return await db.scalar(select(func.count()).select_from(BusinessBrandAsset))


async def _save(sample, store, body, *, purpose="cover", user=None, public_allowed=False):
    return await ingest_upload(
        sample.db,
        sample.business.id,
        (user or sample.editor).id,
        store=store,
        upload=Upload(body),
        title="Atolye filmi",
        caption="",
        purpose=purpose,
        public_allowed=public_allowed,
    )


def _s3_store(fake, part_bytes=1024):
    return S3VideoStore(
        endpoint="https://example.r2.cloudflarestorage.com",
        bucket="bilign-video",
        region="auto",
        access_key="test-key",
        secret_key="test-secret",
        transport=fake,
        part_bytes=part_bytes,
    )


def test_limits_and_signature_and_missing_configuration(monkeypatch):
    assert (COVER_MAX_BYTES, COVER_MAX_SECONDS) == (15 * 1024 * 1024, 20)
    assert (STEP_MAX_BYTES, STEP_MAX_SECONDS) == (40 * 1024 * 1024, 60)
    assert canonical_query("uploads") == "uploads="
    assert canonical_query("uploadId=b&partNumber=1") == "partNumber=1&uploadId=b"
    header = authorization_header(
        access_key="AKIAIOSFODNN7EXAMPLE",
        secret="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region="us-east-1",
        amz_date="20130524T000000Z",
        method="GET",
        path="/test.txt",
        headers={
            "host": "examplebucket.s3.amazonaws.com",
            "range": "bytes=0-9",
            "x-amz-content-sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "x-amz-date": "20130524T000000Z",
        },
        payload_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    )
    assert header.endswith("Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41")
    with pytest.raises(HTTPException) as missing:
        video_store_from_env()
    assert missing.value.status_code == 503 and missing.value.detail["code"] == "video_storage_unconfigured"
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_S3_ENDPOINT", "http://video.example")
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_S3_BUCKET", "bilign-video")
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_S3_REGION", "auto")
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_S3_ACCESS_KEY_ID", "test")
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_S3_SECRET_ACCESS_KEY", "test")
    with pytest.raises(HTTPException) as plain:
        video_store_from_env()
    assert plain.value.status_code == 503
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_S3_ENDPOINT", "https://video.example")
    with pytest.raises(HTTPException) as foreign:
        video_store_from_env()
    assert foreign.value.status_code == 503
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_S3_ENDPOINT", "https://127.0.0.1:9000")
    with pytest.raises(HTTPException) as loopback:
        video_store_from_env()
    assert loopback.value.status_code == 503
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_S3_ENDPOINT", "https://example.r2.cloudflarestorage.com")
    store = video_store_from_env()
    assert isinstance(store, S3VideoStore) and store.provider == "r2"
    assert not isinstance(store, MemoryVideoStore)
    assert store.copy_request_headers("brand-videos/x/staging/y.partial", "a" * 64)["cf-copy-destination-if-none-match"] == "*"
    assert "if-none-match" not in store.copy_request_headers("brand-videos/x/staging/y.partial", "a" * 64)
    asyncio.run(store.aclose())


def test_video_storage_keys_reject_image_disk_layout():
    business = uuid.uuid4()
    digest = "a" * 64
    video = normalize_asset(
        business_id=business,
        asset_type="video",
        title="Atolye filmi",
        locator_kind="storage",
        locator=f"brand-videos/{business}/{digest}.mp4",
    )
    assert video["locator"].endswith(".mp4")
    with pytest.raises(HTTPException) as image_slot:
        normalize_asset(
            business_id=business,
            asset_type="video",
            title="Atolye filmi",
            locator_kind="storage",
            locator=f"brand-assets/{business}/{digest}.mp4",
        )
    assert image_slot.value.detail["code"] == "asset_locator_rejected"
    other = uuid.uuid4()
    with pytest.raises(HTTPException) as foreign:
        assert_brand_key(other, video["locator"])
    assert foreign.value.status_code == 403


def test_media_seal_identity_is_unchanged():
    plan = {"coverAssetId": "cover", "blocks": [[{"type": "video", "assetId": "step"}]], "href": "https://cdn.example/a.mp4", "seal": "old"}
    assert media.media_identity(plan) == {"coverAssetId": "cover", "blocks": plan["blocks"]}
    assert media.media_seal(plan) == source_hash(media.media_identity(plan))
    changed = dict(plan)
    changed["coverAssetId"] = "other"
    assert media.media_seal(changed) != media.media_seal(plan)


@pytest.mark.parametrize(
    ("host_ip", "code"),
    [
        ("127.0.0.1", "video_url_rejected"),
        ("10.1.2.3", "video_url_rejected"),
        ("192.168.1.4", "video_url_rejected"),
        ("169.254.169.254", "video_url_rejected"),
        ("::ffff:127.0.0.1", "video_url_rejected"),
        ("0.0.0.0", "video_url_rejected"),
        ("224.0.0.1", "video_url_rejected"),
    ],
)
async def test_resolved_private_targets_are_rejected(host_ip, code):
    called = []

    async def resolver(_host):
        return [host_ip]

    async def exchange(ip, host, request):
        called.append(ip)
        return Reader(b"")

    with pytest.raises(HTTPException) as rejected:
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=100, resolver=resolver, exchange=exchange):
            pass
    assert rejected.value.detail["code"] == code
    assert called == []


async def test_ssrf_redirect_rebinding_and_body_limits():
    exchange = Exchange([
        _http(302, {"Location": "https://127.0.0.1/secret.mp4", "Content-Length": "0"}),
    ])

    async def resolver(_host):
        return ["1.1.1.1"]

    with pytest.raises(HTTPException):
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=1000, resolver=resolver, exchange=exchange):
            pass
    assert [call[0] for call in exchange.calls] == ["1.1.1.1"]

    calls = []

    async def rebound(_host):
        calls.append("dns")
        return ["1.1.1.1"] if len(calls) == 1 else ["127.0.0.1"]

    body = b"mp4-bytes"
    pinned = Exchange([_http(200, {"Content-Type": "application/octet-stream", "Content-Length": str(len(body))}, body)])
    found = b""
    async for chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=1000, resolver=rebound, exchange=pinned):
        found += chunk
    assert found == body and calls == ["dns"] and pinned.calls[0][0] == "1.1.1.1"
    assert b"Host: cdn.example" in pinned.calls[0][2]

    mixed = Exchange([])

    async def both(_host):
        return ["1.1.1.1", "10.0.0.8"]

    with pytest.raises(HTTPException) as mixed_error:
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=1000, resolver=both, exchange=mixed):
            pass
    assert mixed_error.value.detail["code"] == "video_url_rejected" and mixed.calls == []

    encoded = Exchange([_http(200, {"Content-Encoding": "gzip", "Content-Length": "4"}, b"xxxx")])
    with pytest.raises(HTTPException) as gzip_error:
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=1000, resolver=resolver, exchange=encoded):
            pass
    assert gzip_error.value.detail["code"] == "video_encoding_rejected"

    both_lengths = Exchange([_http(200, {"Content-Length": "4", "Transfer-Encoding": "chunked"}, b"4\r\nxxxx\r\n0\r\n\r\n")])
    with pytest.raises(HTTPException) as both_error:
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=1000, resolver=resolver, exchange=both_lengths):
            pass
    assert both_error.value.detail["code"] == "video_url_rejected"

    huge = Reader(_http(200, {"Content-Length": "99999"}, b""))

    async def one(_ip, _host, _request):
        return huge

    with pytest.raises(HTTPException) as declared:
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=100, resolver=resolver, exchange=one):
            pass
    assert declared.value.detail["code"] == "video_too_large"
    assert huge.offset == len(_http(200, {"Content-Length": "99999"}))

    lied = Reader(_http(200, {"Content-Length": "4"}, b"abcd" + b"Z" * 500))

    async def short(_ip, _host, _request):
        return lied

    received = b""
    async for chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=100, resolver=resolver, exchange=short):
        received += chunk
    assert received == b"abcd"
    assert lied.offset < len(lied.payload)

    bomb = Exchange([_http(200, {"Transfer-Encoding": "chunked"}, b"fffffff\r\n")])
    with pytest.raises(HTTPException) as bomb_error:
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=32, resolver=resolver, exchange=bomb):
            pass
    assert bomb_error.value.detail["code"] == "video_too_large"


async def test_download_timeout_and_credential_urls(monkeypatch):
    monkeypatch.setattr(guard, "DOWNLOAD_TIMEOUT_SECONDS", 0.05)

    async def resolver(_host):
        return ["1.1.1.1"]

    async def slow(_ip, _host, _request):
        await asyncio.sleep(1)
        return Reader(b"")

    with pytest.raises(HTTPException) as timed:
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=100, resolver=resolver, exchange=slow):
            pass
    assert timed.value.detail["code"] == "video_url_rejected"
    for url in ("https://user:pass@cdn.example/a.mp4", "http://cdn.example/a.mp4", "https://169.254.169.254/latest"):
        with pytest.raises(HTTPException):
            async for _chunk in guard.iter_https(url, max_bytes=100, resolver=resolver, exchange=slow):
                pass


async def test_valid_mp4_is_addressed_by_brand_and_hash(sample):
    store = RangeStore(MemoryVideoStore())
    body = _mp4(seconds=20, pad=70_000, wide_mdat=True)
    row = await _save(sample, store, body, public_allowed=True)
    digest = hashlib.sha256(body).hexdigest()
    assert row.locator_kind == "storage"
    assert row.locator == f"brand-videos/{sample.business.id}/{digest}.mp4"
    assert row.status == "published"
    assert _finals(store.inner, sample.business.id) == [row.locator]
    assert store.inner.objects[row.locator][0] == body
    assert store.inner.chunk_counts[0] >= 2
    assert all("/staging/" not in key for key in store.inner.objects)
    fetched = sum(end - start + 1 for start, end in store.ranges)
    assert fetched < len(body) // 2
    listed = await library.listed_assets(sample.db, sample.business.id)
    assert listed[0]["locator"] is None and listed[0]["locator_kind"] == "storage"
    assert "brand-videos/" not in str(listed)
    assert media.public_block(row) is None


@pytest.mark.parametrize(("codec", "purpose", "seconds", "error"), [
    (b"hvc1", "cover", 1, "video_codec_rejected"),
    (b"hev1", "step", 1, "video_codec_rejected"),
    (b"vp09", "cover", 1, "video_codec_rejected"),
    (b"av01", "step", 1, "video_codec_rejected"),
])
async def test_non_h264_is_rejected_without_an_asset(sample, codec, purpose, seconds, error):
    store = MemoryVideoStore()
    with pytest.raises(HTTPException) as rejected:
        await _save(sample, store, _mp4(codec=codec, seconds=seconds), purpose=purpose)
    assert rejected.value.detail["code"] == error
    assert store.objects == {} and await _asset_count(sample.db) == 0


def test_visual_sample_entry_child_boxes_start_at_the_iso_offset():
    visual = _visual(b"avc1")
    payload = visual[8:]
    assert payload[78:82] != b""
    assert payload[82:86] == b"avcC"
    assert int.from_bytes(payload[78:82], "big") == len(payload) - 78


async def test_malformed_visual_sample_entries_are_rejected(sample):
    store = MemoryVideoStore()
    valid = _mp4()
    assert await _save(sample, store, valid)

    short = bytearray(valid)
    avc1 = short.find(b"avc1")
    short[avc1 - 4 : avc1] = (40).to_bytes(4, "big")
    with pytest.raises(HTTPException) as truncated:
        await _save(sample, MemoryVideoStore(), bytes(short))
    assert truncated.value.detail["code"] == "video_file_rejected"

    overrun = bytearray(valid)
    avc1 = overrun.find(b"avc1")
    overrun[avc1 - 4 : avc1] = (8 + 78 + 4).to_bytes(4, "big")
    with pytest.raises(HTTPException) as boundary:
        await _save(sample, MemoryVideoStore(), bytes(overrun))
    assert boundary.value.detail["code"] == "video_file_rejected"

    huge = bytearray(valid)
    avcc = huge.find(b"avcC")
    huge[avcc - 4 : avcc] = (1 << 24).to_bytes(4, "big")
    with pytest.raises(HTTPException) as child:
        await _save(sample, MemoryVideoStore(), bytes(huge))
    assert child.value.detail["code"] == "video_file_rejected"

    broken = bytearray(valid)
    avcc = broken.find(b"avcC")
    broken[avcc + 4] = 0
    with pytest.raises(HTTPException) as config:
        await _save(sample, MemoryVideoStore(), bytes(broken))
    assert config.value.detail["code"] == "video_file_rejected"


async def test_corrupt_duration_and_size_limits(sample, monkeypatch):
    store = MemoryVideoStore()
    with pytest.raises(HTTPException) as corrupt:
        await _save(sample, store, b"\x00\x00\x00\x08junk")
    assert corrupt.value.detail["code"] == "video_file_rejected" and store.objects == {}
    with pytest.raises(HTTPException) as audio:
        await _save(sample, store, _mp4(handler=b"soun"))
    assert audio.value.detail["code"] == "video_codec_rejected"
    stored_cover = await _save(sample, store, _mp4(seconds=21), purpose="cover")
    assert stored_cover.verified_duration == 21 * 1000
    assert stored_cover.verified_has_audio is False
    with pytest.raises(HTTPException) as step_long:
        await _save(sample, store, _mp4(seconds=61), purpose="step")
    assert step_long.value.detail["code"] == "video_too_long"
    assert await _save(sample, MemoryVideoStore(), _mp4(seconds=60), purpose="step")
    monkeypatch.setattr(ingest_module, "STEP_MAX_BYTES", 10)
    monkeypatch.setattr(ingest_module, "CHUNK_BYTES", 8)
    upload = Upload(b"x" * 40)
    limited = MemoryVideoStore()
    with pytest.raises(HTTPException) as oversized:
        await ingest_upload(
            sample.db, sample.business.id, sample.editor.id,
            store=limited, upload=upload, title="Atolye filmi", caption="", purpose="cover", public_allowed=False,
        )
    assert oversized.value.detail["code"] == "video_too_large"
    assert upload.offset <= 16 and limited.objects == {}
    assert CHUNK_BYTES == 64 * 1024


async def test_import_uses_bytes_not_mime_and_blocks_redirects(sample):
    body = _mp4(seconds=1)
    exchange = Exchange([
        _http(200, {"Content-Type": "text/plain", "Content-Length": str(len(body))}, body),
    ])

    async def resolver(_host):
        return ["1.1.1.1"]

    store = MemoryVideoStore()
    row = await ingest_url(
        sample.db, sample.business.id, sample.editor.id,
        store=store, url="https://cdn.example/film.bin", title="Atolye filmi", caption="",
        purpose="cover", public_allowed=False, resolver=resolver, exchange=exchange,
    )
    assert row.locator.endswith(hashlib.sha256(body).hexdigest() + ".mp4")
    spoofed = Exchange([_http(200, {"Content-Type": "video/mp4", "Content-Length": "8"}, b"not-mp4!")])
    with pytest.raises(HTTPException) as rejected:
        await ingest_url(
            sample.db, sample.business.id, sample.editor.id,
            store=MemoryVideoStore(), url="https://cdn.example/film.mp4", title="Atolye filmi", caption="",
            purpose="cover", public_allowed=False, resolver=resolver, exchange=spoofed,
        )
    assert rejected.value.detail["code"] == "video_file_rejected"
    redirected = Exchange([_http(302, {"Location": "https://10.0.0.5/a.mp4", "Content-Length": "0"})])
    with pytest.raises(HTTPException):
        await ingest_url(
            sample.db, sample.business.id, sample.editor.id,
            store=MemoryVideoStore(), url="https://cdn.example/a.mp4", title="Atolye filmi", caption="",
            purpose="step", public_allowed=False, resolver=resolver, exchange=redirected,
        )
    assert redirected.calls[0][0] == "1.1.1.1"
    assert await _asset_count(sample.db) == 1


async def test_same_hash_is_not_written_twice_and_conflict_is_kept(sample):
    body = _mp4(seconds=2, pad=70_000)
    store = MemoryVideoStore()
    first = await _save(sample, store, body)
    writes_after_first = store.writes
    second = await _save(sample, store, body, purpose="step")
    assert first.locator == second.locator
    assert store.writes == writes_after_first + 1
    assert len(_finals(store, sample.business.id)) == 1
    assert store.objects[first.locator][0] == body
    digest = hashlib.sha256(body).hexdigest()
    poisoned = video_object_key(sample.business.id, digest)
    hostile = MemoryVideoStore()
    hostile.objects[poisoned] = (b"different-bytes", "b" * 64)
    staging = staging_object_key(sample.business.id, uuid.uuid4())
    await hostile.write_stream(staging, _chunks(body))
    with pytest.raises(VideoObjectImmutable):
        await hostile.copy_if_absent(staging, poisoned, digest, size=len(body))
    assert hostile.objects[poisoned][0] == b"different-bytes"


async def _chunks(body: bytes):
    yield body


async def test_service_refuses_to_replace_different_bytes(sample):
    body = _mp4(seconds=2)
    digest = hashlib.sha256(body).hexdigest()
    store = MemoryVideoStore()
    store.objects[video_object_key(sample.business.id, digest)] = (b"different-bytes", "b" * 64)
    with pytest.raises(HTTPException) as rejected:
        await _save(sample, store, body)
    assert rejected.value.detail["code"] == "video_object_immutable"
    assert store.objects[video_object_key(sample.business.id, digest)][0] == b"different-bytes"
    assert await _asset_count(sample.db) == 0
    assert all(not key.endswith(".partial") for key in store.objects)


async def test_concurrent_copies_keep_one_object_and_do_not_overwrite():
    body = _mp4(seconds=1, pad=1024)
    digest = hashlib.sha256(body).hexdigest()
    business = uuid.uuid4()
    store = MemoryVideoStore()
    sources = []
    for _index in range(8):
        key = staging_object_key(business, uuid.uuid4())
        await store.write_stream(key, _chunks(body))
        sources.append(key)
    final = video_object_key(business, digest)
    results = await asyncio.gather(*(store.copy_if_absent(key, final, digest, size=len(body)) for key in sources))
    assert results.count("created") == 1 and results.count("exists") == 7
    assert store.objects[final] == (body, digest)
    fake = FakeS3()
    s3 = _s3_store(fake, part_bytes=512)
    staged = []
    for _index in range(4):
        key = staging_object_key(business, uuid.uuid4())
        await s3.write_stream(key, _chunks(body))
        staged.append(key)
    copied = await asyncio.gather(*(s3.copy_if_absent(key, final, digest, size=len(body)) for key in staged))
    assert copied.count("created") == 1
    assert fake.destination_guards and set(fake.destination_guards) == {"cf-copy-destination-if-none-match"}
    assert fake.objects[final]["body"] == body and fake.objects[final]["sha"] == digest
    fake.objects[final] = {"body": b"other", "sha": "c" * 64}
    with pytest.raises(VideoObjectImmutable):
        await s3.copy_if_absent(staged[0], final, digest, size=len(body))
    assert fake.objects[final]["body"] == b"other"


async def test_storage_outage_partial_upload_and_database_failure_leave_no_usable_asset(sample, monkeypatch):
    outage = MemoryVideoStore()
    outage.fail_writes = 1
    with pytest.raises(HTTPException) as failed:
        await _save(sample, outage, _mp4())
    assert failed.value.status_code == 502 and outage.objects == {} and await _asset_count(sample.db) == 0
    partial = MemoryVideoStore()
    with pytest.raises(ConnectionError):
        await ingest_upload(
            sample.db, sample.business.id, sample.editor.id,
            store=partial, upload=BreakingUpload(_mp4()), title="Atolye filmi", caption="",
            purpose="cover", public_allowed=False,
        )
    assert partial.objects == {} and await _asset_count(sample.db) == 0
    fake = FakeS3()
    fake.fail_parts.add(2)
    s3 = _s3_store(fake, part_bytes=64)
    with pytest.raises(HTTPException) as aborted:
        await _save(sample, s3, _mp4(pad=200))
    assert aborted.value.status_code == 502
    assert fake.objects == {} and fake.uploads == {} and fake.aborted
    assert await _asset_count(sample.db) == 0

    async def boom(*_args, **_kwargs):
        raise RuntimeError("database down")

    monkeypatch.setattr(ingest_module, "_insert_asset", boom)
    kept = MemoryVideoStore()
    body = _mp4(seconds=3)
    with pytest.raises(RuntimeError):
        await _save(sample, kept, body)
    digest = hashlib.sha256(body).hexdigest()
    assert list(kept.objects) == [f"brand-videos/{sample.business.id}/{digest}.mp4"]
    assert await _asset_count(sample.db) == 0


async def test_tenant_isolation_and_existing_media_remain(sample, asset_dir):
    body = _mp4(seconds=4)
    store = MemoryVideoStore()
    stored = await _save(sample, store, body, public_allowed=True)
    other = await svc.create_business(sample.db, sample.admin, {
        "organizationId": str(sample.other.id),
        "ownerId": str(sample.owner.id),
        "slug": "other-brand",
        "name": "Other",
    })
    with pytest.raises(HTTPException) as foreign:
        assert_brand_key(other.id, stored.locator)
    assert foreign.value.status_code == 403
    assert await library.list_assets(sample.db, other.id, sample.owner.id) == []
    with pytest.raises(HTTPException) as viewer:
        await _save(sample, store, body, user=sample.viewer)
    assert viewer.value.status_code == 403
    remote = await library.create_asset(sample.db, sample.business.id, sample.editor.id, {
        "asset_type": "video",
        "title": "Eski video",
        "caption": "",
        "locator": "https://cdn.example/old.mp4",
        "public_allowed": True,
    })
    assert remote.locator_kind == "https" and remote.locator == "https://cdn.example/old.mp4"
    assert media.public_block(remote)["href"] == "https://cdn.example/old.mp4"
    image = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Atolye gorseli", "caption": "", "public_allowed": True},
        image_bytes=_PNG,
    )
    assert image.locator.startswith(f"brand-assets/{sample.business.id}/")
    assert image.locator.endswith(".png")
    await sample.db.refresh(remote)
    assert remote.locator == "https://cdn.example/old.mp4"
    assert all(not path.name.endswith(".mp4") for path in asset_dir.rglob("*"))


async def test_stored_video_is_not_public_and_archive_keeps_the_object(sample):
    body = _mp4(seconds=1)
    store = MemoryVideoStore()
    row = await _save(sample, store, body, public_allowed=True)
    assert media.public_block(row) is None
    listed = await library.listed_assets(sample.db, sample.business.id)
    shown = next(item for item in listed if item["id"] == str(row.id))
    assert shown["locator"] is None and shown["locator_kind"] == "storage"
    with pytest.raises(HTTPException) as preview:
        await library.stored_preview(sample.db, sample.business.id, sample.editor.id, row.id)
    assert preview.value.status_code == 422
    assert preview.value.detail["code"] == "asset_locator_rejected"
    foreign = f"brand-videos/{uuid.uuid4()}/{'ab' * 32}.mp4"
    with pytest.raises(HTTPException) as crossed:
        normalize_asset(
            business_id=sample.business.id,
            asset_type="video",
            title="Baska marka",
            locator_kind="storage",
            locator=foreign,
        )
    assert crossed.value.detail["code"] == "asset_locator_rejected"
    key = row.locator
    archived = await library.archive_asset(sample.db, sample.business.id, sample.editor.id, row.id, row.revision)
    assert archived.status == "archived" and archived.public_allowed is False
    assert store.objects[key][0] == body


async def test_s3_ingest_streams_parts_and_routes_do_not_open_playback(sample, asset_dir, monkeypatch):
    fake = FakeS3()
    s3 = _s3_store(fake, part_bytes=1024)
    body = _mp4(seconds=1, pad=2500)
    row = await _save(sample, s3, body)
    assert fake.part_sizes and max(fake.part_sizes) <= 1024
    assert fake.objects[row.locator]["body"] == body
    assert fake.objects[row.locator]["sha"] == hashlib.sha256(body).hexdigest()
    assert all("/staging/" not in key for key in fake.objects)
    real_factory = storage.video_store_from_env
    monkeypatch.setattr(storage, "video_store_from_env", lambda: MemoryVideoStore())
    from backend.routers import business_yansi as routes

    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[routes.get_db] = lambda: sample.db
    app.dependency_overrides[routes.get_current_user] = lambda: {"user_id": str(sample.editor.id)}
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        uploaded = await client.post(
            f"/api/business-yansi/{sample.business.id}/assets/video",
            data={"title": "Atolye filmi", "caption": "", "purpose": "cover", "publicAllowed": "false"},
            files={"file": ("clip.bin", _mp4(seconds=2), "application/octet-stream")},
        )
        image = await client.post(
            f"/api/business-yansi/{sample.business.id}/assets/image",
            data={"title": "Atolye gorseli", "caption": "", "publicAllowed": "false"},
            files={"file": ("cover.png", _PNG, "image/png")},
        )
    assert uploaded.status_code == 200
    assert uploaded.json()["locator"] is None and uploaded.json()["locator_kind"] == "storage"
    assert "brand-videos/" not in uploaded.text
    assert image.status_code == 200 and image.json()["locator"] is None
    assert any(path.name.endswith(".png") for path in asset_dir.rglob("*"))
    assert not any(path.name.endswith(".mp4") for path in asset_dir.rglob("*"))
    monkeypatch.setattr(storage, "video_store_from_env", real_factory)
    app.dependency_overrides[routes.get_current_user] = lambda: {"user_id": str(sample.editor.id)}
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        unconfigured = await client.post(
            f"/api/business-yansi/{sample.business.id}/assets/video-import",
            json={"url": "https://cdn.example/a.mp4", "title": "Atolye filmi", "purpose": "step"},
        )
    assert unconfigured.status_code == 503
    assert unconfigured.json()["detail"]["code"] == "video_storage_unconfigured"
