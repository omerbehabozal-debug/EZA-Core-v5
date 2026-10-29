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
from backend.services.business_yansi import video_ingest as ingest
from backend.services.business_yansi import video_mp4
from backend.services.business_yansi import video_storage as storage
from backend.services.business_yansi import video_url_guard as guard
from backend.services.business_yansi.video_storage import s3_result_ok
from backend.tests.test_business_video_storage import (
    FakeS3,
    Reader,
    S3Response,
    Upload,
    VideoQuotaRedis,
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
    quota = VideoQuotaRedis()

    async def client():
        return quota

    monkeypatch.setattr(ingest, "_redis", client)
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
    assert all("/staging/" not in key for key in fake.objects)
    assert await _asset_count(sample.db) == 0

    wrong = _WrongSize()
    with pytest.raises(HTTPException) as sized:
        await _save(sample, _s3_store(wrong), _mp4())
    assert sized.value.detail["code"] == "video_storage_failed"
    assert all("/staging/" not in key for key in wrong.objects)
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


class _ProbeStream:
    def __init__(self, data: bytes):
        self.data = data
        self.offset = 0

    async def read(self, count: int) -> bytes:
        piece = self.data[self.offset : self.offset + count]
        self.offset += len(piece)
        return piece


class _ProbeProcess:
    def __init__(self, stdout: bytes = b"", stderr: bytes = b"", code: int = 0):
        self.stdout = _ProbeStream(stdout)
        self.stderr = _ProbeStream(stderr)
        self.returncode = None
        self.code = code
        self.killed = False

    def kill(self):
        self.killed = True
        self.returncode = -9

    async def wait(self):
        if self.returncode is None:
            self.returncode = self.code
        return self.returncode


def _point_at_probe_binaries(monkeypatch, path: str) -> None:
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFPROBE", path)
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFMPEG", path)


async def test_probe_requires_h264_frames_and_a_bounded_subprocess(sample, monkeypatch, tmp_path):
    binary = tmp_path / "ffprobe"
    binary.write_bytes(b"")
    _point_at_probe_binaries(monkeypatch, str(binary))
    calls = []

    async def fake_exec(*args, **kwargs):
        calls.append((args, kwargs))
        if "-f" in args:
            return _ProbeProcess()
        return _ProbeProcess(b'{"streams":[{"codec_name":"h264","nb_read_frames":"1"}]}')

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_exec)
    store = storage.MemoryVideoStore()
    row = await _save(sample, store, _mp4())
    assert row.locator_kind == "storage"
    assert calls and all(item[1].get("shell") is None for item in calls)
    ffprobe_args = calls[0][0]
    ffmpeg_args = calls[1][0]
    assert ffprobe_args[0] == str(binary)
    assert "-count_frames" in ffprobe_args
    assert "v:0" not in ffprobe_args
    assert ffmpeg_args[0] == str(binary)
    assert "-f" in ffmpeg_args and "null" in ffmpeg_args
    assert not os.path.exists(ffprobe_args[-1])

    async def zero_frames(*args, **_kwargs):
        if "-f" in args:
            return _ProbeProcess()
        return _ProbeProcess(b'{"streams":[{"codec_name":"h264","nb_read_frames":"0"}]}')

    monkeypatch.setattr(asyncio, "create_subprocess_exec", zero_frames)
    with pytest.raises(HTTPException) as empty:
        await _save(sample, storage.MemoryVideoStore(), _mp4())
    assert empty.value.detail["code"] == "video_codec_rejected"

    async def slow(*_args, **_kwargs):
        class Hung(_ProbeProcess):
            def __init__(self):
                super().__init__()

            async def read_wait(self, _count):
                await asyncio.sleep(30)
                return b""

        process = Hung()
        process.stdout.read = process.read_wait
        return process

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

    monkeypatch.setattr(ingest, "VIDEO_USER_LIMIT", 100)
    monkeypatch.setattr(ingest, "VIDEO_DEADLINE_SECONDS", 0.05)
    monkeypatch.setattr(ingest, "VIDEO_LEASE_SECONDS", 3600)
    monkeypatch.setattr(ingest, "VIDEO_BRAND_INFLIGHT", 1)

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
    released = await ingest._acquire_lease(sample.business.id)
    await ingest._release_lease(sample.business.id, released)
    assert await _asset_count(sample.db) == 0


async def test_redis_leases_are_shared_unique_and_fail_closed(sample, monkeypatch):
    assert "PEXPIRE" in ingest._RATE_SCRIPT
    assert "ARGV[4]" in ingest._RATE_SCRIPT
    assert "PEXPIRE" in ingest._LEASE_ACQUIRE_SCRIPT
    assert "ZREM" in ingest._LEASE_RELEASE_SCRIPT
    monkeypatch.setattr(ingest, "VIDEO_BRAND_INFLIGHT", 1)
    clock = {"now": 1_000_000}
    monkeypatch.setattr(ingest, "_now_ms", lambda: clock["now"])
    shared = {}
    first = VideoQuotaRedis(shared)
    second = VideoQuotaRedis(shared)

    async def client():
        return first

    monkeypatch.setattr(ingest, "_redis", client)
    business = uuid.uuid4()
    token_a = await ingest._acquire_lease(business)
    with pytest.raises(HTTPException) as busy:
        await ingest._acquire_lease(business)
    assert busy.value.detail["code"] == "video_busy"
    clock["now"] += int(ingest.VIDEO_DEADLINE_SECONDS * 1000) + 1
    token_b = await ingest._acquire_lease(business)
    assert token_b != token_a
    await ingest._release_lease(business, token_a)
    with pytest.raises(HTTPException):
        await ingest._acquire_lease(business)
    await ingest._release_lease(business, token_b)

    monkeypatch.setattr(ingest, "VIDEO_USER_LIMIT", 2)
    monkeypatch.setattr(ingest, "_now_ms", lambda: 50_000)
    one = await ingest._consume_window("user:same", 2, 3600)
    assert one is None
    await ingest._consume_window("user:same", 2, 3600)
    with pytest.raises(HTTPException) as limited:
        await ingest._consume_window("user:same", 2, 3600)
    assert limited.value.detail["code"] == "video_rate_limited"

    async def other_worker():
        return second

    monkeypatch.setattr(ingest, "_redis", other_worker)
    monkeypatch.setattr(ingest, "VIDEO_BRAND_INFLIGHT", 1)
    held = await ingest._acquire_lease(business)
    monkeypatch.setattr(ingest, "_redis", client)
    with pytest.raises(HTTPException) as across:
        await ingest._acquire_lease(business)
    assert across.value.detail["code"] == "video_busy"
    await ingest._release_lease(business, held)

    async def offline():
        return None

    monkeypatch.setattr(ingest, "_redis", offline)
    with pytest.raises(HTTPException) as closed:
        await _save(sample, storage.MemoryVideoStore(), b"not-a-video")
    assert closed.value.status_code == 503
    assert closed.value.detail["code"] == "video_quota_unavailable"
    assert await _asset_count(sample.db) == 0


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


async def test_failed_copy_does_not_delete_the_winner(monkeypatch):
    from backend.services.business_yansi.video_storage import VideoStorageError, video_object_key

    body = _mp4()
    digest = __import__("hashlib").sha256(body).hexdigest()
    business = uuid.uuid4()
    final = video_object_key(business, digest)
    kept = _KeepWinner(final, body, digest)
    store = _s3_store(kept)
    with pytest.raises(VideoStorageError):
        await store.copy_if_absent(f"brand-videos/{business}/staging/one.partial", final, digest, size=len(body))
    assert kept.deletes == []
    assert kept.objects[final]["body"] == body

    race = _RacingCopies(final, digest, body)
    racing = _s3_store(race)
    stage_a = f"brand-videos/{business}/staging/a.partial"
    stage_b = f"brand-videos/{business}/staging/b.partial"
    results = await asyncio.gather(
        racing.copy_if_absent(stage_a, final, digest, size=len(body)),
        racing.copy_if_absent(stage_b, final, digest, size=len(body)),
        return_exceptions=True,
    )
    assert any(item == "created" for item in results)
    assert any(isinstance(item, VideoStorageError) for item in results)
    assert race.deletes == []
    assert race.objects[final]["body"] == body


class _KeepWinner:
    def __init__(self, final, body, digest):
        self.final = final
        self.body = body
        self.digest = digest
        self.objects = {final: {"body": body, "sha": digest}}
        self.deletes = []
        self.heads = 0

    async def request(self, method, url, headers, body):
        from urllib.parse import urlsplit
        key = urlsplit(url).path.split("/", 2)[2]
        if method == "HEAD":
            self.heads += 1
            if key == self.final and self.heads == 1:
                return S3Response(404)
            obj = self.objects.get(key)
            if obj is None:
                return S3Response(404)
            return S3Response(200, size=len(obj["body"]), sha256=obj["sha"])
        if method == "PUT" and "x-amz-copy-source" in headers:
            return S3Response(200, b"<Error><Code>InternalError</Code></Error>")
        if method == "DELETE":
            self.deletes.append(key)
            self.objects.pop(key, None)
            return S3Response(204)
        return S3Response(500)


class _RacingCopies:
    def __init__(self, final, digest, body):
        self.final = final
        self.digest = digest
        self.body = body
        self.objects = {}
        self.deletes = []
        self.heads = 0
        self.opened = False
        self.both_headed = asyncio.Event()
        self.lock = asyncio.Lock()

    async def request(self, method, url, headers, body):
        from urllib.parse import urlsplit
        key = urlsplit(url).path.split("/", 2)[2]
        if method == "HEAD" and not self.opened:
            async with self.lock:
                self.heads += 1
                count = self.heads
            if count < 2:
                await self.both_headed.wait()
            else:
                self.opened = True
                self.both_headed.set()
            return S3Response(404)
        if method == "HEAD":
            obj = self.objects.get(key)
            if obj is None:
                return S3Response(404)
            return S3Response(200, size=len(obj["body"]), sha256=obj["sha"])
        if method == "PUT" and "x-amz-copy-source" in headers:
            async with self.lock:
                if key in self.objects:
                    return S3Response(200, b"<Error><Code>InternalError</Code></Error>")
                self.objects[key] = {"body": self.body, "sha": self.digest}
                return S3Response(200, b"<CopyObjectResult><ETag>\"a\"</ETag></CopyObjectResult>")
        if method == "DELETE":
            self.deletes.append(key)
            self.objects.pop(key, None)
            return S3Response(204)
        return S3Response(500)


async def test_recheck_reads_a_second_sqlite_session(tmp_path):
    """Identity-map refresh on SQLite. SQLite ignores FOR UPDATE, so this is not a lock-race proof."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from backend.core.utils.dependencies import Base
    from backend.models.business_yansi import BusinessMember, BusinessProfile
    from backend.models.production import Organization, User
    from backend.services.business_yansi import service as svc

    engine = create_async_engine(f"sqlite+aiosqlite:///{(tmp_path / 'auth.db').as_posix()}")
    tables = [User.__table__, Organization.__table__, BusinessProfile.__table__, BusinessMember.__table__]
    async with engine.begin() as connection:
        await connection.run_sync(lambda sync: Base.metadata.create_all(sync, tables=tables))
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as setup:
        owner = User(id=uuid.uuid4(), email="owner-auth@example.test", role="user", is_active=True)
        editor = User(id=uuid.uuid4(), email="editor-auth@example.test", role="user", is_active=True)
        org = Organization(id=uuid.uuid4(), name="Auth", status="active")
        setup.add_all([owner, editor, org])
        await setup.commit()
        business = await svc.create_business(setup, owner, {
            "organizationId": str(org.id),
            "ownerId": str(owner.id),
            "slug": "auth-brand",
            "name": "Auth",
        })
        setup.add(BusinessMember(business_id=business.id, user_id=editor.id, role="editor"))
        await setup.commit()
        editor_id = editor.id
        business_id = business.id
    async with maker() as stale, maker() as other:
        cached = await stale.get(User, editor_id)
        assert cached.is_active is True
        row = await other.get(User, editor_id)
        row.is_active = False
        await other.commit()
        assert cached.is_active is True
        with pytest.raises(HTTPException) as denied:
            await ingest._recheck_editor(stale, business_id, editor_id)
        assert denied.value.status_code == 403
    await engine.dispose()


async def test_probe_cancel_exception_and_output_cap(sample, monkeypatch, tmp_path):
    binary = tmp_path / "tools"
    binary.write_bytes(b"")
    _point_at_probe_binaries(monkeypatch, str(binary))
    store = storage.MemoryVideoStore()
    body = _mp4()

    async def chunks():
        yield body

    key = f"brand-videos/{uuid.uuid4()}/staging/{uuid.uuid4()}.partial"
    await store.write_stream(key, chunks())
    started = asyncio.Event()
    processes = []
    spilled = []

    async def hanging(*args, **_kwargs):
        spilled.append(args[-1])
        process = _ProbeProcess()

        async def hang(_count):
            started.set()
            await asyncio.Event().wait()
            return b""

        process.stdout.read = hang
        processes.append(process)
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", hanging)
    task = asyncio.create_task(video_mp4.inspect_mp4(video_mp4.Mp4Source(store, key, len(body)), max_seconds=20))
    await asyncio.wait_for(started.wait(), 2)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(task, 2)
    assert processes and processes[0].killed
    assert spilled and not os.path.exists(spilled[0])

    async def decode_error(*args, **_kwargs):
        if "-f" in args:
            return _ProbeProcess(stderr=b"error while decoding MB\n", code=0)
        return _ProbeProcess(b'{"streams":[{"codec_name":"h264","nb_read_frames":"1"}]}')

    monkeypatch.setattr(asyncio, "create_subprocess_exec", decode_error)
    with pytest.raises(HTTPException) as broken:
        await video_mp4.inspect_mp4(video_mp4.Mp4Source(store, key, len(body)), max_seconds=20)
    assert broken.value.detail["code"] == "video_codec_rejected"

    async def truncated(*args, **_kwargs):
        if "-f" in args:
            return _ProbeProcess(code=1)
        return _ProbeProcess(b'{"streams":[{"codec_name":"h264","nb_read_frames":"1"}]}')

    monkeypatch.setattr(asyncio, "create_subprocess_exec", truncated)
    with pytest.raises(HTTPException) as short:
        await video_mp4.inspect_mp4(video_mp4.Mp4Source(store, key, len(body)), max_seconds=20)
    assert short.value.detail["code"] == "video_codec_rejected"

    async def flood(*_args, **_kwargs):
        process = _ProbeProcess()

        async def huge(_count):
            return b"x" * (80 * 1024)

        process.stdout.read = huge
        processes.append(process)
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", flood)
    with pytest.raises(HTTPException) as capped:
        await video_mp4.inspect_mp4(video_mp4.Mp4Source(store, key, len(body)), max_seconds=20)
    assert capped.value.detail["code"] == "video_codec_rejected"
    assert processes[-1].killed


async def test_multitrack_and_missing_ffmpeg_fail_closed(sample, monkeypatch, tmp_path):
    store = storage.MemoryVideoStore()
    with pytest.raises(HTTPException) as extra:
        await _save(sample, store, _mp4(extra_codec=b"hvc1"))
    assert extra.value.detail["code"] == "video_codec_rejected"
    assert await _asset_count(sample.db) == 0

    binary = tmp_path / "ffprobe"
    binary.write_bytes(b"")
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFPROBE", str(binary))
    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFMPEG", "bilign-ffmpeg-missing")

    async def unused(*_args, **_kwargs):
        raise AssertionError("subprocess should not start")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", unused)
    with pytest.raises(HTTPException) as missing:
        await video_mp4.probe_file(str(binary))
    assert missing.value.status_code == 503
    assert missing.value.detail["code"] == "video_probe_unavailable"

    monkeypatch.setenv("EZA_BUSINESS_VIDEO_FFMPEG", str(binary))

    async def second_track(*args, **_kwargs):
        if "-f" in args:
            return _ProbeProcess()
        payload = b'{"streams":[{"codec_name":"h264","nb_read_frames":"1"},{"codec_name":"hevc","nb_read_frames":"1"}]}'
        return _ProbeProcess(payload)

    monkeypatch.setattr(asyncio, "create_subprocess_exec", second_track)
    with pytest.raises(HTTPException) as mixed:
        await video_mp4.probe_file(str(binary))
    assert mixed.value.detail["code"] == "video_codec_rejected"


async def test_chunked_trailer_is_required():
    async def resolver(_host):
        return ["1.1.1.1"]

    async def read(payload: bytes) -> bytes:
        async def exchange(_ip, _host, _request):
            return Reader(payload)

        found = b""
        async for chunk in guard.iter_https("https://cdn.example/a.mp4", max_bytes=100, resolver=resolver, exchange=exchange):
            found += chunk
        return found

    assert await read(b"HTTP/1.1 200 TEST\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nabcd\r\n0\r\n\r\n") == b"abcd"
    for payload in (
        b"HTTP/1.1 200 TEST\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nabcd\r\n0\r\n",
        b"HTTP/1.1 200 TEST\r\nTransfer-Encoding: chunked\r\n\r\nzz\r\n",
        b"HTTP/1.1 200 TEST\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nab",
        b"HTTP/1.1 200 TEST\r\nTransfer-Encoding: chunked\r\n\r\n-1\r\n",
        b"HTTP/1.1 200 TEST\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n" + b"X: " + (b"a" * 5000) + b"\r\n\r\n",
    ):
        with pytest.raises(HTTPException) as rejected:
            await read(payload)
        assert rejected.value.detail["code"] == "video_url_rejected"
