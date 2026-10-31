"""Opt-in Cloudflare R2 check for immutable Business video objects.

Reads only EZA_BUSINESS_VIDEO_R2_TEST_*. Missing values skip the module.
A present but unexpected endpoint, region, or bucket fails the run.
Certificate verification stays enabled. This file does not prove LocalStack.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import re
import uuid
from urllib.parse import quote, urlsplit

import httpx
import pytest

from backend.services.business_yansi.video_storage import (
    PART_BYTES,
    S3VideoStore,
    VideoObjectImmutable,
    VideoStorageError,
    s3_result_ok,
    staging_object_key,
    video_object_key,
)

_BUCKET = "bilign-video-r2-verification"
_OWNED = re.compile(
    r"^brand-videos/[0-9a-fA-F-]{36}/"
    r"(?:staging/[0-9a-fA-F-]{36}\.partial|[0-9a-f]{64}\.mp4|[0-9a-f]{64}\.mp4\.missing|put/[0-9a-f]{64}\.bin)$"
)
_ROUNDS = 20


def _settings() -> dict | None:
    endpoint = os.getenv("EZA_BUSINESS_VIDEO_R2_TEST_ENDPOINT", "").strip()
    bucket = os.getenv("EZA_BUSINESS_VIDEO_R2_TEST_BUCKET", "").strip()
    region = os.getenv("EZA_BUSINESS_VIDEO_R2_TEST_REGION", "").strip()
    access_key = os.getenv("EZA_BUSINESS_VIDEO_R2_TEST_ACCESS_KEY_ID", "").strip()
    secret_key = os.getenv("EZA_BUSINESS_VIDEO_R2_TEST_SECRET_ACCESS_KEY", "").strip()
    if not all((endpoint, bucket, region, access_key, secret_key)):
        return None
    parts = urlsplit(endpoint)
    host = (parts.hostname or "").lower()
    labels = host.split(".")
    if parts.username or parts.password:
        pytest.fail("refusing credentials embedded in the R2 endpoint")
    if parts.scheme != "https":
        pytest.fail("refusing a non-HTTPS R2 endpoint")
    if labels[1:] != ["r2", "cloudflarestorage", "com"] or not labels[0]:
        pytest.fail("refusing an unexpected R2 host")
    if bucket != _BUCKET:
        pytest.fail("refusing a bucket other than the disposable R2 verification bucket")
    if region != "auto":
        pytest.fail("refusing a region other than auto")
    return {
        "endpoint": endpoint.rstrip("/"),
        "bucket": bucket,
        "region": region,
        "access_key": access_key,
        "secret_key": secret_key,
    }


pytestmark = pytest.mark.skipif(
    _settings() is None,
    reason="BLOCKED: explicit Cloudflare R2 test configuration is not set",
)


class _Transport:
    def __init__(self):
        self.client = httpx.AsyncClient(verify=True, timeout=httpx.Timeout(60.0, connect=10.0))

    async def request(self, method, url, headers, body):
        response = await self.client.request(method, url, headers=headers, content=b"" if body is None else body)
        upload_id = ""
        if b"<UploadId>" in response.content:
            upload_id = response.content.split(b"<UploadId>", 1)[1].split(b"</UploadId>", 1)[0].decode()
        return type("S3Response", (), {
            "status": response.status_code,
            "body": response.content,
            "etag": response.headers.get("etag", ""),
            "upload_id": upload_id,
            "size": int(response.headers.get("content-length") or 0),
            "sha256": response.headers.get("x-amz-meta-sha256", ""),
            "last_modified": response.headers.get("last-modified", ""),
        })()

    async def aclose(self):
        await self.client.aclose()


class _Gate:
    """Release the watched calls together once two of them are waiting."""

    def __init__(self, method_name: str, marker: str):
        self.method_name = method_name
        self.marker = marker
        self.count = 0
        self.ready = asyncio.Event()

    def wrap(self, inner):
        gate = self

        class _Wrapped:
            async def request(self, method, url, headers, body):
                if method == gate.method_name and gate.marker in url:
                    gate.count += 1
                    if gate.count >= 2:
                        gate.ready.set()
                    await asyncio.wait_for(gate.ready.wait(), 20)
                return await inner.request(method, url, headers, body)

            async def aclose(self):
                return None

        return _Wrapped()


def _digest(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def _xml_code(body: bytes) -> str:
    if b"<Code>" not in body:
        return ""
    return body.split(b"<Code>", 1)[1].split(b"</Code>", 1)[0].decode("ascii", "replace")[:80]


def _note(response) -> str:
    return f"status={response.status} error={_xml_code(response.body)} copy_ok={s3_result_ok(response.body, 'CopyObjectResult')}"


def _destination_copy_headers(store: S3VideoStore, source: str, digest: str) -> dict[str, str]:
    return {
        "cf-copy-destination-if-none-match": "*",
        "x-amz-copy-source": quote(f"/{store.bucket}/{source}", safe="/"),
        "x-amz-metadata-directive": "REPLACE",
        "x-amz-meta-sha256": digest,
    }


def _store(cfg: dict, transport) -> S3VideoStore:
    return S3VideoStore(
        endpoint=cfg["endpoint"],
        bucket=cfg["bucket"],
        region=cfg["region"],
        access_key=cfg["access_key"],
        secret_key=cfg["secret_key"],
        transport=transport,
    )


def _own(owned: list[str], key: str) -> str:
    if _OWNED.fullmatch(key) is None:
        raise AssertionError("refusing to track a key outside the test object layout")
    owned.append(key)
    return key


async def _chunks(body: bytes):
    yield body


async def _download(store: S3VideoStore, key: str) -> tuple[bytes, str]:
    response = await store._send("GET", store._path(key))
    assert response.status == 200, response.status
    return response.body, response.etag


async def _stage(store: S3VideoStore, owned: list[str], business, body: bytes) -> str:
    key = _own(owned, staging_object_key(business, uuid.uuid4()))
    stat = await store.write_stream(key, _chunks(body))
    assert stat.sha256 == _digest(body)
    assert stat.size == len(body)
    return key


@pytest.fixture
async def r2():
    cfg = _settings()
    assert cfg is not None
    transport = _Transport()
    store = _store(cfg, transport)
    probed = await store._send("HEAD", "/" + cfg["bucket"])
    assert probed.status == 200, probed.status
    owned: list[str] = []
    try:
        yield cfg, store, owned
    finally:
        for key in owned:
            if _OWNED.fullmatch(key):
                await store.delete(key)
        await transport.aclose()


async def test_application_copy_does_not_overwrite_an_existing_final(r2):
    _cfg, store, owned = r2
    business = uuid.uuid4()
    body = b"r2-application-copy"
    digest = _digest(body)
    staging = await _stage(store, owned, business, body)
    final = _own(owned, video_object_key(business, digest))
    headers = store.copy_request_headers(staging, digest)
    assert headers.get("cf-copy-destination-if-none-match") == "*"
    assert "if-none-match" not in headers
    assert await store.copy_if_absent(staging, final, digest, size=len(body)) == "created"
    assert await store.copy_if_absent(staging, final, digest, size=len(body)) == "exists"
    before, etag_before = await _download(store, final)
    seen = await store._send("HEAD", store._path(final))
    forced = await store._send("PUT", store._path(final), extra=headers)
    after, etag_after = await _download(store, final)
    seen_after = await store._send("HEAD", store._path(final))
    assert after == before
    assert hashlib.sha256(after).hexdigest() == digest
    assert seen_after.sha256 == digest
    assert seen_after.size == len(body)
    assert etag_after == etag_before
    assert seen_after.last_modified == seen.last_modified
    assert forced.status == 412, _note(forced)


async def test_cf_copy_destination_if_none_match(r2):
    _cfg, store, owned = r2
    business = uuid.uuid4()
    body = b"r2-destination-precondition"
    digest = _digest(body)
    staging = await _stage(store, owned, business, body)
    final = _own(owned, video_object_key(business, digest))
    created = await store._send("PUT", store._path(final), extra=_destination_copy_headers(store, staging, digest))
    assert created.status == 200 and s3_result_ok(created.body, "CopyObjectResult"), _note(created)
    before, etag_before = await _download(store, final)
    seen = await store._send("HEAD", store._path(final))
    forced = await store._send("PUT", store._path(final), extra=_destination_copy_headers(store, staging, digest))
    after, etag_after = await _download(store, final)
    seen_after = await store._send("HEAD", store._path(final))
    assert after == before
    assert hashlib.sha256(after).hexdigest() == digest
    assert seen_after.sha256 == digest
    assert seen_after.size == len(body)
    assert etag_after == etag_before
    assert seen_after.last_modified == seen.last_modified
    assert forced.status == 412, _note(forced)


async def _app_copy_race(cfg, store, owned):
    body = b"r2-race-identical-bytes"
    digest = _digest(body)
    outcomes = []
    for _round in range(_ROUNDS):
        business = uuid.uuid4()
        left = await _stage(store, owned, business, body)
        right = await _stage(store, owned, business, body)
        final = _own(owned, video_object_key(business, digest))
        gate = _Gate("HEAD", final)
        clients = [_Transport(), _Transport()]
        racers = [_store(cfg, gate.wrap(client)) for client in clients]

        async def once(racer, source):
            try:
                return await racer.copy_if_absent(source, final, digest, size=len(body))
            except (VideoStorageError, VideoObjectImmutable) as exc:
                return type(exc).__name__

        try:
            results = await asyncio.gather(once(racers[0], left), once(racers[1], right))
        finally:
            for client in clients:
                await client.aclose()
        downloaded, _etag = await _download(store, final)
        head = await store.head(final)
        assert downloaded == body
        assert hashlib.sha256(downloaded).hexdigest() == digest
        assert head is not None and head.size == len(body) and head.sha256 == digest
        assert results.count("created") == 1, results
        outcomes.append(tuple(sorted(results)))
    return outcomes


async def test_twenty_app_copy_races_create_one_object(r2):
    cfg, store, owned = r2
    outcomes = await _app_copy_race(cfg, store, owned)
    assert len(outcomes) == _ROUNDS


async def test_twenty_destination_header_races(r2):
    cfg, store, owned = r2
    body = b"r2-destination-race"
    digest = _digest(body)
    for _round in range(_ROUNDS):
        business = uuid.uuid4()
        left = await _stage(store, owned, business, body)
        right = await _stage(store, owned, business, body)
        final = _own(owned, video_object_key(business, digest))
        gate = _Gate("PUT", final)
        clients = [_Transport(), _Transport()]
        racers = [_store(cfg, gate.wrap(client)) for client in clients]

        async def once(racer, source):
            response = await racer._send("PUT", racer._path(final), extra=_destination_copy_headers(racer, source, digest))
            return response.status, s3_result_ok(response.body, "CopyObjectResult"), _xml_code(response.body)

        try:
            results = await asyncio.gather(once(racers[0], left), once(racers[1], right))
        finally:
            for client in clients:
                await client.aclose()
        downloaded, _etag = await _download(store, final)
        head = await store._send("HEAD", store._path(final))
        assert downloaded == body
        assert hashlib.sha256(downloaded).hexdigest() == digest
        assert head.sha256 == digest and head.size == len(body)
        assert sorted(item[0] for item in results) == [200, 412], [(item[0], item[2]) for item in results]
        assert sum(1 for item in results if item[0] == 200 and item[1]) == 1


async def test_twenty_put_object_if_none_match_races(r2):
    cfg, store, owned = r2
    body = b"r2-put-if-none-match"
    digest = _digest(body)
    for _round in range(_ROUNDS):
        business = uuid.uuid4()
        key = _own(owned, f"brand-videos/{business}/put/{digest}.bin")
        gate = _Gate("PUT", key)
        clients = [_Transport(), _Transport()]
        racers = [_store(cfg, gate.wrap(client)) for client in clients]

        async def once(racer):
            response = await racer._send(
                "PUT",
                racer._path(key),
                body=body,
                extra={"if-none-match": "*", "x-amz-meta-sha256": digest},
            )
            return response.status, _xml_code(response.body)

        try:
            results = await asyncio.gather(once(racers[0]), once(racers[1]))
        finally:
            for client in clients:
                await client.aclose()
        downloaded, _etag = await _download(store, key)
        head = await store.head(key)
        assert downloaded == body
        assert hashlib.sha256(downloaded).hexdigest() == digest
        assert head is not None and head.size == len(body) and head.sha256 == digest
        assert sorted(item[0] for item in results) == [200, 412], [(item[0], item[1]) for item in results]


async def _expect_staging_bytes(store, key, body):
    downloaded, _etag = await _download(store, key)
    head = await store.head(key)
    assert downloaded == body
    assert hashlib.sha256(downloaded).hexdigest() == _digest(body)
    assert head is not None and head.size == len(body)


async def _expect_final_bytes(store, key, body):
    digest = _digest(body)
    downloaded, _etag = await _download(store, key)
    head = await store.head(key)
    assert key.endswith(f"/{digest}.mp4")
    assert downloaded == body
    assert hashlib.sha256(downloaded).hexdigest() == digest
    assert head is not None and head.size == len(body) and head.sha256 == digest


async def test_single_and_multipart_bytes_match_independent_sha256(r2):
    _cfg, store, owned = r2
    business = uuid.uuid4()
    small = b"r2-single-part-" + os.urandom(32)
    small_key = await _stage(store, owned, business, small)
    await _expect_staging_bytes(store, small_key, small)
    small_final = _own(owned, video_object_key(business, _digest(small)))
    assert await store.copy_if_absent(small_key, small_final, _digest(small), size=len(small)) == "created"
    await _expect_final_bytes(store, small_final, small)
    large = b"m" * (PART_BYTES + 64)
    large_key = await _stage(store, owned, business, large)
    await _expect_staging_bytes(store, large_key, large)
    large_final = _own(owned, video_object_key(business, _digest(large)))
    assert await store.copy_if_absent(large_key, large_final, _digest(large), size=len(large)) == "created"
    await _expect_final_bytes(store, large_final, large)


async def test_failed_multipart_cancel_and_missing_source_keep_final(r2):
    cfg, store, owned = r2
    business = uuid.uuid4()
    body = b"r2-final-must-remain"
    digest = _digest(body)
    staging = await _stage(store, owned, business, body)
    final = _own(owned, video_object_key(business, digest))
    assert await store.copy_if_absent(staging, final, digest, size=len(body)) == "created"
    short = _own(owned, staging_object_key(business, uuid.uuid4()))
    small = _store(cfg, store.transport)
    small.part_bytes = 1024
    with pytest.raises(VideoStorageError, match="multipart_complete_failed"):
        await small.write_stream(short, _chunks(b"b" * 2500))
    assert await store.head(short) is None
    other = _own(owned, staging_object_key(business, uuid.uuid4()))
    started = asyncio.Event()

    async def chunks():
        yield b"p" * 100
        started.set()
        await asyncio.Event().wait()

    task = asyncio.create_task(store.write_stream(other, chunks()))
    await asyncio.wait_for(started.wait(), 20)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert await store.head(other) is None
    missing = _own(owned, final + ".missing")
    with pytest.raises(VideoStorageError):
        await store.copy_if_absent(staging_object_key(business, uuid.uuid4()), missing, digest, size=len(body))
    assert await store.head(missing) is None
    assert (await _download(store, final))[0] == body


async def test_error_xml_and_hidden_success_do_not_drop_the_object(r2):
    cfg, store, owned = r2
    business = uuid.uuid4()
    body = b"r2-hidden-success"
    digest = _digest(body)
    staging = await _stage(store, owned, business, body)
    rejected = await store._send(
        "POST",
        store._path(staging, query="uploadId=not-a-real-upload"),
        body=b"<CompleteMultipartUpload></CompleteMultipartUpload>",
        extra={"content-type": "application/xml"},
    )
    assert s3_result_ok(rejected.body, "CompleteMultipartUploadResult") is False
    assert rejected.status != 200 or b"<Error" in rejected.body, f"status={rejected.status} error={_xml_code(rejected.body)}"
    final = _own(owned, video_object_key(business, digest))

    class _HideSuccess:
        def __init__(self, inner):
            self.inner = inner
            self.hidden = None

        async def request(self, method, url, headers, request_body):
            response = await self.inner.request(method, url, headers, request_body)
            if self.hidden is None and method == "PUT" and "x-amz-copy-source" in {name.lower() for name in headers}:
                self.hidden = (response.status, _xml_code(response.body), s3_result_ok(response.body, "CopyObjectResult"))
                raise TimeoutError("response withheld")
            return response

        async def aclose(self):
            return None

    hidden = _HideSuccess(store.transport)
    blinded = _store(cfg, hidden)
    with pytest.raises(VideoStorageError, match="storage_unavailable"):
        await blinded.copy_if_absent(staging, final, digest, size=len(body))
    downloaded, _etag = await _download(store, final)
    assert downloaded == body
    assert hashlib.sha256(downloaded).hexdigest() == digest
    assert hidden.hidden is not None
    assert hidden.hidden[0] == 200 and hidden.hidden[2], f"status={hidden.hidden[0]} error={hidden.hidden[1]}"
    assert await store.head(final) is not None


async def test_storage_failure_does_not_insert_or_delete_the_final(r2, monkeypatch):
    _cfg, store, owned = r2
    from backend.services.business_yansi import video_ingest as ingest

    business = uuid.uuid4()
    body = b"r2-asset-gate"
    digest = _digest(body)
    staging = await _stage(store, owned, business, body)
    final = _own(owned, video_object_key(business, digest))
    await store.copy_if_absent(staging, final, digest, size=len(body))

    class _DB:
        def add(self, *_args, **_kwargs):
            raise AssertionError("asset insert")

    async def _noop_probe(*_args, **_kwargs):
        return None

    async def _reject_copy(_source, _dest, _sha, *, size):
        raise VideoStorageError("copy_failed")

    monkeypatch.setattr(ingest, "inspect_mp4", _noop_probe)
    monkeypatch.setattr(store, "copy_if_absent", _reject_copy)
    with pytest.raises(Exception) as failed:
        await ingest._ingest(
            _DB(), business, uuid.uuid4(), store=store, chunks=_chunks(body),
            title="Atolye filmi", caption="", public_allowed=False,
            max_bytes=1024, max_seconds=20,
        )
    assert getattr(failed.value, "status_code", None) == 502
    assert (await _download(store, final))[0] == body
