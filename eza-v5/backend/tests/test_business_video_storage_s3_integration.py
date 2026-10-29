"""Preliminary S3-compatible check for immutable Business video objects.

This file talks only to an explicit local test endpoint. It is not evidence
about AWS S3 or Cloudflare R2. AWS and R2 need their own disposable buckets.

The production key layout is brand-videos/{business}/{sha256}.mp4. There is
no separate test prefix. Isolation is a disposable bucket whose name starts
with bilign-video-s3-test, plus deletion of only the keys this file created.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
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

_FORBIDDEN = ("amazonaws", "r2.cloudflarestorage", "cloudflare", "ezacore")


def _settings() -> dict | None:
    endpoint = os.getenv("EZA_BUSINESS_VIDEO_S3_TEST_ENDPOINT", "").strip()
    bucket = os.getenv("EZA_BUSINESS_VIDEO_S3_TEST_BUCKET", "").strip()
    region = os.getenv("EZA_BUSINESS_VIDEO_S3_TEST_REGION", "").strip()
    access_key = os.getenv("EZA_BUSINESS_VIDEO_S3_TEST_ACCESS_KEY_ID", "").strip()
    secret_key = os.getenv("EZA_BUSINESS_VIDEO_S3_TEST_SECRET_ACCESS_KEY", "").strip()
    ca_file = os.getenv("EZA_BUSINESS_VIDEO_S3_TEST_CA", "").strip()
    if not all((endpoint, bucket, region, access_key, secret_key, ca_file)):
        return None
    parts = urlsplit(endpoint)
    host = (parts.hostname or "").lower()
    blob = f"{endpoint} {bucket}".lower()
    if parts.scheme != "https" or host not in {"127.0.0.1", "localhost", "::1"}:
        pytest.fail("refusing a non-local S3 test endpoint")
    if any(marker in blob for marker in _FORBIDDEN):
        pytest.fail("refusing a production-looking S3 configuration")
    if not bucket.startswith("bilign-video-s3-test"):
        pytest.fail("refusing a bucket outside the disposable test name")
    return {
        "endpoint": endpoint,
        "bucket": bucket,
        "region": region,
        "access_key": access_key,
        "secret_key": secret_key,
        "ca_file": ca_file,
    }


pytestmark = pytest.mark.skipif(
    _settings() is None,
    reason="BLOCKED: explicit local S3 test endpoint is not configured",
)


class _Transport:
    def __init__(self, ca_file: str):
        self.client = httpx.AsyncClient(verify=ca_file, timeout=httpx.Timeout(30.0, connect=5.0))

    async def request(self, method, url, headers, body):
        content = body if body is not None else b""
        response = await self.client.request(method, url, headers=headers, content=content)
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


def _digest(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


async def _download(store: S3VideoStore, key: str) -> tuple[bytes, str]:
    response = await store._send("GET", store._path(key))
    assert response.status == 200, response.status
    return response.body, response.etag


async def _chunks(body: bytes):
    yield body


@pytest.fixture
async def bucket():
    cfg = _settings()
    transport = _Transport(cfg["ca_file"])
    store = S3VideoStore(transport=transport, part_bytes=PART_BYTES, **{k: cfg[k] for k in ("endpoint", "bucket", "region", "access_key", "secret_key")})
    small = S3VideoStore(transport=transport, part_bytes=1024, **{k: cfg[k] for k in ("endpoint", "bucket", "region", "access_key", "secret_key")})
    created = await store._send("PUT", "/" + cfg["bucket"])
    assert created.status in {200, 409}, created.status
    owned: list[str] = []
    try:
        yield store, small, owned
    finally:
        for key in owned:
            if key.startswith("brand-videos/"):
                await store.delete(key)
        await transport.aclose()


async def test_multipart_bytes_match_independent_sha256(bucket):
    store, small, owned = bucket
    business = uuid.uuid4()
    body = b"bilign-video-bytes-" + os.urandom(48)
    digest = _digest(body)
    staging = staging_object_key(business, uuid.uuid4())
    owned.append(staging)
    stat = await store.write_stream(staging, _chunks(body))
    assert stat.size == len(body)
    assert stat.sha256 == digest
    final = video_object_key(business, digest)
    owned.append(final)
    assert await store.copy_if_absent(staging, final, digest, size=len(body)) == "created"
    downloaded, etag = await _download(store, final)
    assert hashlib.sha256(downloaded).hexdigest() == digest
    assert downloaded == body
    assert len(downloaded) == len(body)
    head = await store.head(final)
    assert head is not None
    assert head.size == len(body)
    assert head.sha256 == digest
    assert etag
    again = await store.copy_if_absent(staging, final, digest, size=len(body))
    assert again == "exists"
    reread, etag_after = await _download(store, final)
    assert reread == body
    assert etag_after == etag


async def test_two_part_upload_completes_and_error_xml_is_rejected(bucket):
    store, small, owned = bucket
    business = uuid.uuid4()
    body = b"a" * (PART_BYTES + 64)
    staging = staging_object_key(business, uuid.uuid4())
    owned.append(staging)
    stat = await store.write_stream(staging, _chunks(body))
    assert stat.size == len(body)
    assert stat.sha256 == _digest(body)
    downloaded, _etag = await _download(store, staging)
    assert downloaded == body
    rejected = await store._send(
        "POST",
        store._path(staging, query="uploadId=not-a-real-upload"),
        body=b"<CompleteMultipartUpload></CompleteMultipartUpload>",
        extra={"content-type": "application/xml"},
    )
    assert rejected.status != 200 or b"<Error" in rejected.body
    assert s3_result_ok(rejected.body, "CompleteMultipartUploadResult") is False
    short = staging_object_key(business, uuid.uuid4())
    owned.append(short)
    with pytest.raises(VideoStorageError, match="multipart_complete_failed"):
        await small.write_stream(short, _chunks(b"b" * 2500))
    assert await store.head(short) is None


async def test_conditional_copy_does_not_replace_an_existing_object(bucket):
    store, _small, owned = bucket
    business = uuid.uuid4()
    body = b"same-hash-body"
    digest = _digest(body)
    staging = staging_object_key(business, uuid.uuid4())
    final = video_object_key(business, digest)
    owned.extend([staging, final])
    await store.write_stream(staging, _chunks(body))
    assert await store.copy_if_absent(staging, final, digest, size=len(body)) == "created"
    before, etag_before = await _download(store, final)
    seen = await store._send("HEAD", store._path(final))
    forced = await store._send(
        "PUT",
        store._path(final),
        extra={
            "if-none-match": "*",
            "x-amz-copy-source": quote(f"/{store.bucket}/{staging}", safe="/"),
            "x-amz-metadata-directive": "REPLACE",
            "x-amz-meta-sha256": digest,
        },
    )
    after, etag_after = await _download(store, final)
    seen_after = await store._send("HEAD", store._path(final))
    assert after == before
    assert hashlib.sha256(after).hexdigest() == digest
    assert etag_after == etag_before
    assert seen_after.last_modified == seen.last_modified
    assert forced.status == 412


async def test_concurrent_same_hash_cannot_delete_or_corrupt_the_winner(bucket):
    store, _small, owned = bucket
    body = b"concurrent-identical-video"
    digest = _digest(body)

    class _Gate:
        def __init__(self, inner, marker: str):
            self.inner = inner
            self.marker = marker
            self.heads = 0
            self.ready = asyncio.Event()

        async def request(self, method, url, headers, body):
            if method == "HEAD" and self.marker in url:
                self.heads += 1
                if self.heads >= 2:
                    self.ready.set()
                await asyncio.wait_for(self.ready.wait(), 5)
            return await self.inner.request(method, url, headers, body)

        async def aclose(self):
            return None

    for _ in range(5):
        business = uuid.uuid4()
        left = staging_object_key(business, uuid.uuid4())
        right = staging_object_key(business, uuid.uuid4())
        final = video_object_key(business, digest)
        owned.extend([left, right, final])
        await store.write_stream(left, _chunks(body))
        await store.write_stream(right, _chunks(body))
        gate = _Gate(store.transport, final)
        racing = S3VideoStore(
            endpoint=store.endpoint,
            bucket=store.bucket,
            region=store.region,
            access_key=store.access_key,
            secret_key=store.secret_key,
            transport=gate,
        )
        async def once(source: str):
            try:
                return await racing.copy_if_absent(source, final, digest, size=len(body))
            except (VideoStorageError, VideoObjectImmutable) as exc:
                return type(exc).__name__

        results = await asyncio.gather(once(left), once(right))
        downloaded, _etag = await _download(store, final)
        assert downloaded == body
        assert hashlib.sha256(downloaded).hexdigest() == digest
        assert await store.head(final) is not None
        assert "VideoStorageError" not in results or await store.head(final) is not None
        assert results.count("created") == 1


async def test_failed_copy_keeps_existing_bytes_and_does_not_insert(bucket, monkeypatch):
    store, _small, owned = bucket
    from backend.services.business_yansi import video_ingest as ingest

    business = uuid.uuid4()
    body = b"winner-must-remain"
    digest = _digest(body)
    staging = staging_object_key(business, uuid.uuid4())
    final = video_object_key(business, digest)
    owned.extend([staging, final])
    await store.write_stream(staging, _chunks(body))
    await store.copy_if_absent(staging, final, digest, size=len(body))
    missing = final + ".missing"
    owned.append(missing)
    with pytest.raises(VideoStorageError):
        await store.copy_if_absent(staging_object_key(business, uuid.uuid4()), missing, digest, size=len(body))
    assert await store.head(missing) is None
    assert (await _download(store, final))[0] == body

    class _DB:
        def add(self, *_args, **_kwargs):
            raise AssertionError("asset insert")

    async def _noop_probe(*_args, **_kwargs):
        return None

    monkeypatch.setattr(ingest, "inspect_mp4", _noop_probe)
    async def _reject_copy(_source, _dest, _sha, *, size):
        raise VideoStorageError("copy_failed")

    monkeypatch.setattr(store, "copy_if_absent", _reject_copy)
    with pytest.raises(Exception) as failed:
        await ingest._ingest(
            _DB(), business, uuid.uuid4(), store=store, chunks=_chunks(body),
            title="Atolye filmi", caption="", public_allowed=False,
            max_bytes=1024, max_seconds=20,
        )
    assert getattr(failed.value, "status_code", None) == 502
    assert (await _download(store, final))[0] == body


async def test_cancel_removes_staging_and_leaves_the_final_object(bucket):
    store, _small, owned = bucket
    business = uuid.uuid4()
    body = b"permanent-final"
    digest = _digest(body)
    staging = staging_object_key(business, uuid.uuid4())
    final = video_object_key(business, digest)
    owned.extend([staging, final])
    await store.write_stream(staging, _chunks(body))
    await store.copy_if_absent(staging, final, digest, size=len(body))
    other = staging_object_key(business, uuid.uuid4())
    owned.append(other)
    started = asyncio.Event()

    async def chunks():
        yield b"p" * 100
        started.set()
        await asyncio.Event().wait()

    task = asyncio.create_task(store.write_stream(other, chunks()))
    await asyncio.wait_for(started.wait(), 5)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert await store.head(other) is None
    assert (await _download(store, final))[0] == body
