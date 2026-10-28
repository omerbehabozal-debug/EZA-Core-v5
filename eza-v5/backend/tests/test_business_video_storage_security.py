"""Negative controls for Business video ingestion.

In-memory stores and SQLite only. Not evidence about a live S3/R2 bucket
or PostgreSQL.
"""
import asyncio
import os
import socket
import uuid
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import HTTPException

from backend.models.business_yansi import BusinessMember
from backend.security.rate_limit import reset_in_memory_rate_limits_for_tests
from backend.services.business_yansi import video_ingest as ingest
from backend.services.business_yansi import video_mp4
from backend.services.business_yansi import video_storage as storage
from backend.services.business_yansi import video_url_guard as guard
from backend.services.business_yansi.video_storage import s3_result_ok
from backend.tests.test_business_video_storage import (
    FakeS3,
    Reader,
    Upload,
    _asset_count,
    _box,
    _http,
    _mp4,
    _s3_store,
    _save,
)
from backend.tests.test_business_yansi import sample


@pytest.fixture(autouse=True)
def _isolated_budget(monkeypatch):
    import importlib

    async def no_redis():
        return None

    rate_limits = importlib.import_module("backend.security.rate_limit")
    monkeypatch.setattr(rate_limits, "get_redis", no_redis)
    monkeypatch.setattr(ingest, "_redis", no_redis)
    reset_in_memory_rate_limits_for_tests()
    ingest.reset_video_budget_for_tests()


def _accept_probe(monkeypatch):
    async def accept(_path: str) -> None:
        return None

    monkeypatch.setattr(video_mp4, "probe_file", accept)


def _fourcc_only() -> bytes:
    duration = 1000
    ftyp = _box(b"ftyp", b"isom" + b"\x00\x00\x00\x00" + b"isom")
    mvhd = _box(b"mvhd", b"\x00" * 12 + duration.to_bytes(4, "big") + duration.to_bytes(4, "big") + b"\x00" * 80)
    mdhd = _box(b"mdhd", b"\x00" * 12 + duration.to_bytes(4, "big") + duration.to_bytes(4, "big") + b"\x00\x00\x00\x00")
    hdlr = _box(b"hdlr", b"\x00" * 8 + b"vide" + b"\x00" * 13)
    entry = (16).to_bytes(4, "big") + b"avc1" + b"\x00" * 8
    stsd = _box(b"stsd", b"\x00\x00\x00\x00" + (1).to_bytes(4, "big") + entry)
    trak = _box(b"trak", _box(b"mdia", mdhd + hdlr + _box(b"minf", _box(b"stbl", stsd))))
    moov = _box(b"moov", mvhd + trak)
    return ftyp + _box(b"mdat", b"\x00" * 32) + moov


class _SlowAbort(FakeS3):
    async def request(self, method, url, headers, body):
        query = parse_qs(urlsplit(url).query, keep_blank_values=True)
        if method == "DELETE" and "uploadId" in query:
            await asyncio.sleep(30)
        return await super().request(method, url, headers, body)


class _WrongSize(FakeS3):
    async def request(self, method, url, headers, body):
        response = await super().request(method, url, headers, body)
        if method == "HEAD" and response.status == 200 and "/staging/" not in url:
            response.size += 1
        return response


class _FakeRedis:
    def __init__(self, fail_incr=False):
        self.values = {}
        self.fail_incr = fail_incr

    async def incr(self, key):
        if self.fail_incr:
            raise ConnectionError("down")
        self.values[key] = int(self.values.get(key, 0)) + 1
        return self.values[key]

    async def decr(self, key):
        self.values[key] = int(self.values.get(key, 0)) - 1
        return self.values[key]

    async def expire(self, key, ttl):
        return True


def test_s3_success_xml_is_required():
    error = b'<?xml version="1.0"?><Error><Code>InternalError</Code><Message>x</Message></Error>'
    assert s3_result_ok(error, "CompleteMultipartUploadResult") is False
    assert s3_result_ok(error, "CopyObjectResult") is False
    namespaced = (
        b'<CopyObjectResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">'
        b"<LastModified>2020-01-01T00:00:00.000Z</LastModified><ETag>\"a\"</ETag></CopyObjectResult>"
    )
    assert s3_result_ok(namespaced, "CopyObjectResult") is True
    doctype = b'<!DOCTYPE x [<!ENTITY a "b">]><CompleteMultipartUploadResult/>'
    assert s3_result_ok(doctype, "CompleteMultipartUploadResult") is False
    assert s3_result_ok(b"", "CompleteMultipartUploadResult") is False


async def test_complete_error_document_creates_no_asset(sample):
    fake = FakeS3()
    fake.complete_body = b"<Error><Code>InternalError</Code><Message>later</Message></Error>"
    with pytest.raises(HTTPException) as rejected:
        await _save(sample, _s3_store(fake), _mp4())
    assert rejected.value.status_code == 502
    assert rejected.value.detail["code"] == "video_storage_failed"
    assert fake.objects == {}
    assert fake.aborted
    assert await _asset_count(sample.db) == 0


async def test_copy_error_document_and_size_mismatch_create_no_asset(sample, monkeypatch):
    _accept_probe(monkeypatch)
    fake = FakeS3()
    fake.copy_body = b"<Error><Code>InternalError</Code></Error>"
    with pytest.raises(HTTPException) as copied:
        await _save(sample, _s3_store(fake), _mp4())
    assert copied.value.detail["code"] == "video_storage_failed"
    assert fake.objects == {}
    assert await _asset_count(sample.db) == 0

    wrong = _WrongSize()
    with pytest.raises(HTTPException) as sized:
        await _save(sample, _s3_store(wrong), _mp4())
    assert sized.value.detail["code"] == "video_storage_failed"
    assert wrong.objects == {}
    assert await _asset_count(sample.db) == 0


async def test_default_resolver_requests_stream_sockets(monkeypatch):
    seen = {}
    loop = asyncio.get_running_loop()

    async def fake_getaddrinfo(host, port, *, family=0, type=0, proto=0, flags=0):
        seen["type"] = type
        seen["host"] = host
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("1.1.1.1", 443))]

    monkeypatch.setattr(loop, "getaddrinfo", fake_getaddrinfo)

    async def exchange(ip, host, request):
        assert ip == "1.1.1.1" and host == "cdn.example"
        return Reader(_http(200, {"Content-Length": "4"}, b"abcd"))

    received = b""
    async for chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=10, exchange=exchange):
        received += chunk
    assert received == b"abcd"
    assert seen["host"] == "cdn.example"
    assert seen["type"] is socket.SOCK_STREAM


@pytest.mark.parametrize(
    "address",
    [
        "100.64.0.1",
        "100.100.100.200",
        "169.254.169.254",
        "169.254.170.2",
        "::ffff:100.64.0.1",
        "::ffff:127.0.0.1",
        "::ffff:169.254.169.254",
        "::ffff:8.8.8.8",
        "0.0.0.0",
        "224.0.0.1",
        "192.168.0.1",
        "fd00:ec2::254",
        "fe80::1",
        "127.0.0.1%eth0",
    ],
)
def test_non_global_and_mapped_addresses_are_forbidden(address):
    assert guard.ip_is_forbidden(address) is True


@pytest.mark.parametrize("address", ["1.1.1.1", "8.8.8.8", "2001:4860:4860::8888"])
def test_global_unicast_addresses_are_allowed(address):
    assert guard.ip_is_forbidden(address) is False


async def test_cgnat_literal_and_redirect_never_connect():
    calls = []

    async def exchange(ip, host, request):
        calls.append((ip, host))
        return Reader(b"")

    async def resolver(host):
        return [host]

    with pytest.raises(HTTPException) as literal:
        async for _chunk in guard.iter_https("https://100.64.0.1/a.mp4", max_bytes=100, resolver=resolver, exchange=exchange):
            pass
    assert literal.value.detail["code"] == "video_url_rejected"
    assert calls == []

    async def public_then_cgnat(host):
        return ["1.1.1.1"] if host == "cdn.example" else ["100.64.1.5"]

    pages = [
        Reader(_http(302, {"Location": "https://100.64.1.5/a.mp4", "Content-Length": "0"})),
        Reader(_http(200, {"Content-Length": "4"}, b"abcd")),
    ]

    async def exchange_pages(ip, host, request):
        calls.append((ip, host))
        return pages.pop(0)

    with pytest.raises(HTTPException) as redirected:
        async for _chunk in guard.iter_https(
            "https://cdn.example/a.mp4", max_bytes=100, resolver=public_then_cgnat, exchange=exchange_pages,
        ):
            pass
    assert redirected.value.detail["code"] == "video_url_rejected"
    assert calls == [("1.1.1.1", "cdn.example")]


async def test_proxy_environment_does_not_move_the_connection(monkeypatch):
    monkeypatch.setenv("HTTP_PROXY", "http://127.0.0.1:8080")
    monkeypatch.setenv("HTTPS_PROXY", "http://127.0.0.1:8080")
    monkeypatch.setenv("ALL_PROXY", "socks5://127.0.0.1:1080")
    seen = {}

    async def open_connection(host, port, *, ssl=None, server_hostname=None):
        seen["host"] = host
        seen["port"] = port
        seen["hostname"] = server_hostname
        seen["check"] = ssl.check_hostname
        raise ConnectionError("blocked")

    monkeypatch.setattr(asyncio, "open_connection", open_connection)
    with pytest.raises(HTTPException) as rejected:
        await guard.default_exchange("1.1.1.1", "cdn.example", b"GET / HTTP/1.1\r\n\r\n")
    assert rejected.value.detail["code"] == "video_url_rejected"
    assert seen == {"host": "1.1.1.1", "port": 443, "hostname": "cdn.example", "check": True}


async def test_fourcc_and_zero_sample_are_rejected_without_probe(sample, monkeypatch):
    called = []

    async def accept(_path: str) -> None:
        called.append("probe")

    monkeypatch.setattr(video_mp4, "probe_file", accept)
    store = storage.MemoryVideoStore()
    with pytest.raises(HTTPException) as bare:
        await _save(sample, store, _fourcc_only())
    assert bare.value.detail["code"] == "video_file_rejected"
    body = bytearray(_mp4())
    marker = bytes([0x65, 0x88, 0x84, 0x21, 0xA0])
    index = body.find(marker)
    assert index > 0
    body[index] = 0
    with pytest.raises(HTTPException) as zeros:
        await _save(sample, store, bytes(body))
    assert zeros.value.detail["code"] == "video_codec_rejected"
    assert called == []
    assert store.objects == {}
    assert await _asset_count(sample.db) == 0


async def test_missing_ffprobe_fails_closed(sample, monkeypatch):
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFPROBE", "bilign-ffprobe-missing")
    store = storage.MemoryVideoStore()
    with pytest.raises(HTTPException) as missing:
        await _save(sample, store, _mp4())
    assert missing.value.status_code == 503
    assert missing.value.detail["code"] == "video_probe_unavailable"
    assert store.objects == {}
    assert await _asset_count(sample.db) == 0


async def test_probe_requires_h264_frames_and_a_bounded_subprocess(sample, monkeypatch, tmp_path):
    binary = tmp_path / "ffprobe"
    binary.write_bytes(b"")
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFPROBE", str(binary))
    seen = {}

    class Process:
        def __init__(self, stdout):
            self.stdout_bytes = stdout
            self.returncode = 0
            self.killed = False

        async def communicate(self):
            return self.stdout_bytes, b""

        def kill(self):
            self.killed = True

        async def wait(self):
            return 0

    async def fake_exec(*args, **kwargs):
        seen["args"] = args
        seen["shell"] = kwargs.get("shell")
        return Process(b'{"streams":[{"codec_name":"h264","nb_read_frames":"1"}]}')

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_exec)
    store = storage.MemoryVideoStore()
    row = await _save(sample, store, _mp4())
    assert row.locator_kind == "storage"
    assert seen["shell"] is None
    assert seen["args"][0] == str(binary)
    assert "-count_frames" in seen["args"]
    assert seen["args"][-1].endswith(".mp4")
    assert not os.path.exists(seen["args"][-1])

    async def zero_frames(*_args, **_kwargs):
        return Process(b'{"streams":[{"codec_name":"h264","nb_read_frames":"0"}]}')

    monkeypatch.setattr(asyncio, "create_subprocess_exec", zero_frames)
    with pytest.raises(HTTPException) as empty:
        await _save(sample, storage.MemoryVideoStore(), _mp4())
    assert empty.value.detail["code"] == "video_codec_rejected"

    async def slow(*_args, **_kwargs):
        class Hung(Process):
            async def communicate(self):
                await asyncio.sleep(30)
                return b"{}", b""

        return Hung(b"")

    monkeypatch.setattr(video_mp4, "PROBE_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(asyncio, "create_subprocess_exec", slow)
    with pytest.raises(HTTPException) as timed:
        await _save(sample, storage.MemoryVideoStore(), _mp4())
    assert timed.value.detail["code"] == "video_file_rejected"


async def test_cancellation_aborts_multipart_and_is_reraised(monkeypatch):
    async def chunks(started):
        yield b"x" * 64
        started.set()
        await asyncio.Event().wait()

    fake = FakeS3()
    first = asyncio.Event()
    task = asyncio.create_task(_s3_store(fake, part_bytes=64).write_stream("brand-videos/x/staging/a.partial", chunks(first)))
    await asyncio.wait_for(first.wait(), 2)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(task, 2)
    assert fake.aborted
    assert fake.uploads == {}

    slow = _SlowAbort()
    monkeypatch.setattr(storage, "ABORT_TIMEOUT_SECONDS", 0.05)
    second = asyncio.Event()
    again = asyncio.create_task(_s3_store(slow, part_bytes=64).write_stream("brand-videos/x/staging/b.partial", chunks(second)))
    await asyncio.wait_for(second.wait(), 2)
    again.cancel()
    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(again, 2)


async def test_authority_is_rechecked_before_the_asset_row(sample, monkeypatch):
    _accept_probe(monkeypatch)
    original = storage.MemoryVideoStore.copy_if_absent
    member = await sample.db.get(BusinessMember, (sample.business.id, sample.editor.id))
    mode = {"name": "suspend"}

    async def mutate_during_copy(self, source, dest, sha256, *, size):
        if mode["name"] == "suspend":
            sample.business.status = "suspended"
        elif mode["name"] == "inactive":
            sample.editor.is_active = False
        elif mode["name"] == "viewer":
            member.role = "viewer"
        await sample.db.commit()
        return await original(self, source, dest, sha256, size=size)

    monkeypatch.setattr(storage.MemoryVideoStore, "copy_if_absent", mutate_during_copy)
    with pytest.raises(HTTPException) as suspended:
        await _save(sample, storage.MemoryVideoStore(), _mp4())
    assert suspended.value.status_code == 404

    sample.business.status = "active"
    await sample.db.commit()
    mode["name"] = "inactive"
    with pytest.raises(HTTPException) as inactive:
        await _save(sample, storage.MemoryVideoStore(), _mp4())
    assert inactive.value.status_code == 403

    sample.editor.is_active = True
    await sample.db.commit()
    mode["name"] = "viewer"
    with pytest.raises(HTTPException) as demoted:
        await _save(sample, storage.MemoryVideoStore(), _mp4())
    assert demoted.value.status_code == 403
    assert await _asset_count(sample.db) == 0


async def test_download_does_not_hold_the_read_transaction(sample, monkeypatch):
    _accept_probe(monkeypatch)
    seen = {}
    store = storage.MemoryVideoStore()
    original = store.write_stream

    async def wrapped(key, chunks):
        seen["open"] = sample.db.in_transaction()
        return await original(key, chunks)

    store.write_stream = wrapped
    await _save(sample, store, _mp4())
    assert seen["open"] is False


async def test_short_and_conflicting_http_bodies_are_rejected():
    async def resolver(_host):
        return ["1.1.1.1"]

    short = Reader(_http(200, {"Content-Length": "10"}, b"abcd"))
    with pytest.raises(HTTPException) as truncated:
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=100, resolver=resolver, exchange=lambda *_args: _as_reader(short)):
            pass
    assert truncated.value.detail["code"] == "video_url_rejected"

    duplicate = Reader(b"HTTP/1.1 200 TEST\r\nContent-Length: 4\r\nContent-Length: 8\r\n\r\nabcdxxxx")
    with pytest.raises(HTTPException) as repeated:
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=100, resolver=resolver, exchange=lambda *_args: _as_reader(duplicate)):
            pass
    assert repeated.value.detail["code"] == "video_url_rejected"

    bare = Reader(b"HTTP/1.1 200 TEST\r\nContent-Type: video/mp4\r\n\r\nabcd")
    with pytest.raises(HTTPException) as unframed:
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=100, resolver=resolver, exchange=lambda *_args: _as_reader(bare)):
            pass
    assert unframed.value.detail["code"] == "video_url_rejected"

    encoded = Reader(b"HTTP/1.1 200 TEST\r\nTransfer-Encoding: gzip\r\n\r\nabcd")
    with pytest.raises(HTTPException) as transfer:
        async for _chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=100, resolver=resolver, exchange=lambda *_args: _as_reader(encoded)):
            pass
    assert transfer.value.detail["code"] == "video_url_rejected"


async def _as_reader(reader):
    return reader


async def test_user_and_brand_rate_limit_and_deadline(sample, monkeypatch):
    monkeypatch.setattr(ingest, "VIDEO_USER_LIMIT", 2)
    store = storage.MemoryVideoStore()
    for _index in range(2):
        with pytest.raises(HTTPException) as rejected:
            await _save(sample, store, b"not-a-video")
        assert rejected.value.detail["code"] == "video_file_rejected"
    with pytest.raises(HTTPException) as limited:
        await _save(sample, store, b"not-a-video")
    assert limited.value.status_code == 429
    assert limited.value.detail["code"] == "video_rate_limited"
    assert await _asset_count(sample.db) == 0

    reset_in_memory_rate_limits_for_tests()
    ingest.reset_video_budget_for_tests()
    monkeypatch.setattr(ingest, "VIDEO_DEADLINE_SECONDS", 0.05)

    class SlowUpload(Upload):
        async def read(self, count):
            await asyncio.sleep(1)
            return b""

    with pytest.raises(HTTPException) as deadline:
        await ingest.ingest_upload(
            sample.db, sample.business.id, sample.editor.id,
            store=store, upload=SlowUpload(b"x"), title="Atolye filmi", caption="", purpose="cover", public_allowed=False,
        )
    assert deadline.value.status_code == 408
    assert deadline.value.detail["code"] == "video_deadline"
    assert ingest._inflight == {}
    assert await _asset_count(sample.db) == 0


async def test_inflight_limit_uses_redis_and_memory_fallback(monkeypatch):
    monkeypatch.setattr(ingest, "VIDEO_BRAND_INFLIGHT", 1)
    redis = _FakeRedis()

    async def client():
        return redis

    monkeypatch.setattr(ingest, "_redis", client)
    business = uuid.uuid4()
    assert await ingest._acquire_inflight(business) == "redis"
    with pytest.raises(HTTPException) as busy:
        await ingest._acquire_inflight(business)
    assert busy.value.detail["code"] == "video_busy"
    await ingest._release_inflight(business, "redis")
    assert await ingest._acquire_inflight(business) == "redis"
    await ingest._release_inflight(business, "redis")
    assert redis.values

    broken = _FakeRedis(fail_incr=True)

    async def down():
        return broken

    monkeypatch.setattr(ingest, "_redis", down)
    assert await ingest._acquire_inflight(business) == "memory"
    with pytest.raises(HTTPException) as local:
        await ingest._acquire_inflight(business)
    assert local.value.detail["code"] == "video_busy"
    await ingest._release_inflight(business, "memory")


async def test_parser_box_and_range_budgets_reject_the_file(sample, monkeypatch):
    _accept_probe(monkeypatch)
    monkeypatch.setattr(video_mp4, "MAX_BOXES", 2)
    store = storage.MemoryVideoStore()
    with pytest.raises(HTTPException) as boxes:
        await _save(sample, store, _mp4())
    assert boxes.value.detail["code"] == "video_file_rejected"
    assert await _asset_count(sample.db) == 0

    monkeypatch.setattr(video_mp4, "MAX_BOXES", 256)
    monkeypatch.setattr(video_mp4, "MAX_RANGE_READS", 1)
    with pytest.raises(HTTPException) as reads:
        await _save(sample, storage.MemoryVideoStore(), _mp4())
    assert reads.value.detail["code"] == "video_file_rejected"
