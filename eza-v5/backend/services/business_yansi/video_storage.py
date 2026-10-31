"""S3-compatible store for immutable Business videos.

Objects live in object storage, never on the API disk. A missing configuration
raises; it does not fall back to a local directory. The in-memory store exists
for tests and is never selected by video_store_from_env().
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import os
import uuid
import xml.etree.ElementTree as ElementTree
from dataclasses import dataclass
from typing import AsyncIterator, Protocol
from urllib.parse import quote, urlsplit

from backend.services.business_yansi.service import fail, uid


PART_BYTES = 5 * 1024 * 1024
ABORT_TIMEOUT_SECONDS = 5


@dataclass(frozen=True)
class ObjectStat:
    key: str
    size: int
    sha256: str


class VideoStorageError(RuntimeError):
    pass


class VideoObjectImmutable(RuntimeError):
    pass


class VideoObjectStore(Protocol):
    async def write_stream(self, key: str, chunks: AsyncIterator[bytes]) -> ObjectStat: ...

    async def head(self, key: str) -> ObjectStat | None: ...

    async def get_range(self, key: str, start: int, end_inclusive: int) -> bytes: ...

    async def copy_if_absent(self, source: str, dest: str, sha256: str, *, size: int) -> str: ...

    async def delete(self, key: str) -> None: ...

    async def aclose(self) -> None: ...


def video_object_key(business_id, sha256: str) -> str:
    digest = sha256.lower()
    if len(digest) != 64 or any(ch not in "0123456789abcdef" for ch in digest):
        fail("video_file_rejected", 422)
    return f"brand-videos/{uid(business_id)}/{digest}.mp4"


def staging_object_key(business_id, upload_id) -> str:
    return f"brand-videos/{uid(business_id)}/staging/{uuid.UUID(str(upload_id))}.partial"


def assert_brand_key(business_id, key: str) -> None:
    prefix = f"brand-videos/{uid(business_id)}/"
    if not isinstance(key, str) or not key.startswith(prefix) or ".." in key or "\\" in key:
        fail("video_object_forbidden", 403)


class MemoryVideoStore:
    """Test double. Bytes are committed only after the stream finishes."""

    def __init__(self):
        self.objects: dict[str, tuple[bytes, str]] = {}
        self.writes = 0
        self.fail_writes = 0
        self.chunk_counts: list[int] = []
        self._lock = asyncio.Lock()

    async def write_stream(self, key: str, chunks: AsyncIterator[bytes]) -> ObjectStat:
        if self.fail_writes:
            self.fail_writes -= 1
            raise VideoStorageError("storage_unavailable")
        hasher = hashlib.sha256()
        buf = bytearray()
        count = 0
        async for chunk in chunks:
            if not chunk:
                continue
            count += 1
            hasher.update(chunk)
            buf.extend(chunk)
        self.chunk_counts.append(count)
        digest = hasher.hexdigest()
        body = bytes(buf)
        async with self._lock:
            existing = self.objects.get(key)
            if existing is not None:
                if existing[1] != digest:
                    raise VideoObjectImmutable(key)
                return ObjectStat(key, len(existing[0]), existing[1])
            self.objects[key] = (body, digest)
            self.writes += 1
        return ObjectStat(key, len(body), digest)

    async def head(self, key: str) -> ObjectStat | None:
        row = self.objects.get(key)
        if row is None:
            return None
        return ObjectStat(key, len(row[0]), row[1])

    async def get_range(self, key: str, start: int, end_inclusive: int) -> bytes:
        row = self.objects.get(key)
        if row is None or start < 0 or end_inclusive < start:
            raise VideoStorageError("range_unavailable")
        return row[0][start : end_inclusive + 1]

    async def read_chunks(self, key: str, size: int, chunk: int = 65536):
        offset = 0
        while offset < size:
            end = min(size - 1, offset + chunk - 1)
            data = await self.get_range(key, offset, end)
            if len(data) != end - offset + 1:
                raise VideoStorageError("range_unavailable")
            yield data
            offset += len(data)

    async def copy_if_absent(self, source: str, dest: str, sha256: str, *, size: int) -> str:
        async with self._lock:
            src = self.objects.get(source)
            if src is None or src[1] != sha256 or len(src[0]) != size:
                raise VideoStorageError("source_missing")
            existing = self.objects.get(dest)
            if existing is not None:
                if existing[1] != sha256 or len(existing[0]) != size:
                    raise VideoObjectImmutable(dest)
                return "exists"
            self.objects[dest] = src
            self.writes += 1
            return "created"

    async def delete(self, key: str) -> None:
        self.objects.pop(key, None)

    async def aclose(self) -> None:
        return None


def _sign(key: bytes, message: str) -> bytes:
    return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()


def signing_key(secret: str, date: str, region: str, service: str = "s3") -> bytes:
    stamped = _sign(f"AWS4{secret}".encode("utf-8"), date)
    stamped = hmac.new(stamped, region.encode("utf-8"), hashlib.sha256).digest()
    stamped = hmac.new(stamped, service.encode("utf-8"), hashlib.sha256).digest()
    return hmac.new(stamped, b"aws4_request", hashlib.sha256).digest()


def _encode_path(path: str) -> str:
    return "/".join(quote(part, safe="-_.~") for part in path.split("/"))


def canonical_query(query: str) -> str:
    if not query:
        return ""
    pairs = []
    for piece in query.split("&"):
        if not piece:
            continue
        name, _, value = piece.partition("=")
        pairs.append((quote(name, safe="-_.~"), quote(value, safe="-_.~")))
    pairs.sort()
    return "&".join(f"{name}={value}" for name, value in pairs)


def canonical_request(method: str, path: str, query: str, headers: dict[str, str], payload_hash: str) -> tuple[str, str]:
    normalized = {name.lower(): " ".join(value.strip().split()) for name, value in headers.items()}
    signed = sorted(normalized)
    canonical_headers = "".join(f"{name}:{normalized[name]}\n" for name in signed)
    signed_names = ";".join(signed)
    request = "\n".join((method, _encode_path(path), canonical_query(query), canonical_headers, signed_names, payload_hash))
    return request, signed_names


def authorization_header(*, access_key: str, secret: str, region: str, amz_date: str, method: str, path: str, headers: dict[str, str], payload_hash: str, query: str = "") -> str:
    request, signed_names = canonical_request(method, path, query, headers, payload_hash)
    stamp = amz_date[:8]
    scope = f"{stamp}/{region}/s3/aws4_request"
    string_to_sign = "\n".join(("AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(request.encode("utf-8")).hexdigest()))
    signature = hmac.new(signing_key(secret, stamp, region), string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"AWS4-HMAC-SHA256 Credential={access_key}/{scope}, SignedHeaders={signed_names}, Signature={signature}"


def s3_result_ok(body: bytes, result_name: str) -> bool:
    """HTTP 200 is not success when the body is an S3 error document."""
    if not body or len(body) > 65536 or b"<!DOCTYPE" in body[:80].upper() or b"<Error" in body:
        return False
    try:
        root = ElementTree.fromstring(body)
    except ElementTree.ParseError:
        return False
    return root.tag.rsplit("}", 1)[-1] == result_name


def storage_provider(endpoint: str) -> str:
    """Return the only providers whose destination create-once behavior is explicit.

    ``r2`` is the production provider. Its atomic guard is the beta header
    ``cf-copy-destination-if-none-match``, checked by R2 when the copy commits.
    ``localstack`` is the loopback emulator, which honored ``If-None-Match`` on
    CopyObject. ``video_store_from_env`` never selects ``localstack``. Any other
    endpoint has no known atomic destination precondition and must not copy.
    """
    parts = urlsplit(endpoint)
    host = (parts.hostname or "").lower()
    labels = host.split(".")
    if parts.scheme != "https" or not host:
        return ""
    if labels[1:] == ["r2", "cloudflarestorage", "com"] and labels[0]:
        return "r2"
    if host in {"127.0.0.1", "localhost", "::1"}:
        return "localstack"
    return ""


class S3VideoStore:
    """HTTPS S3-compatible client. Payload hash is UNSIGNED-PAYLOAD so the body can stream."""

    def __init__(self, *, endpoint: str, bucket: str, region: str, access_key: str, secret_key: str, transport, part_bytes: int = PART_BYTES):
        parts = urlsplit(endpoint)
        if parts.scheme != "https" or not parts.netloc or parts.username or parts.password:
            fail("video_storage_unconfigured", 503)
        self.endpoint = endpoint.rstrip("/")
        self.bucket = bucket
        self.region = region
        self.access_key = access_key
        self.secret_key = secret_key
        self.transport = transport
        self.part_bytes = part_bytes
        self._host = parts.netloc
        self.provider = storage_provider(self.endpoint)
        if not self.provider:
            fail("video_storage_unconfigured", 503)

    def _path(self, key: str, *, query: str = "") -> str:
        path = "/" + self.bucket.strip("/") + "/" + key.lstrip("/")
        return path + (("?" + query) if query else "")

    async def _send(self, method: str, path: str, *, query: str = "", extra: dict[str, str] | None = None, body: AsyncIterator[bytes] | bytes | None = None, payload_hash: str = "UNSIGNED-PAYLOAD"):
        from datetime import datetime, timezone

        amz_date = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        headers = {
            "host": self._host,
            "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date,
        }
        if extra:
            headers.update(extra)
        signed_path, _, query = path.partition("?")
        headers["authorization"] = authorization_header(
            access_key=self.access_key,
            secret=self.secret_key,
            region=self.region,
            amz_date=amz_date,
            method=method,
            path=signed_path,
            query=query,
            headers=headers,
            payload_hash=payload_hash,
        )
        url = self.endpoint + path
        try:
            return await self.transport.request(method, url, headers, body)
        except VideoStorageError:
            raise
        except Exception as exc:
            raise VideoStorageError("storage_unavailable") from exc

    async def write_stream(self, key: str, chunks: AsyncIterator[bytes]) -> ObjectStat:
        opened = await self._send("POST", self._path(key, query="uploads"))
        if opened.status != 200 or not opened.upload_id or (opened.body and b"<Error" in opened.body):
            raise VideoStorageError("multipart_open_failed")
        upload_id = opened.upload_id
        parts: list[tuple[int, str]] = []
        number = 1
        buf = bytearray()
        hasher = hashlib.sha256()
        size = 0
        try:
            async for chunk in chunks:
                if not chunk:
                    continue
                hasher.update(chunk)
                size += len(chunk)
                buf.extend(chunk)
                while len(buf) >= self.part_bytes:
                    part = bytes(buf[: self.part_bytes])
                    del buf[: self.part_bytes]
                    etag = await self._put_part(key, upload_id, number, part)
                    parts.append((number, etag))
                    number += 1
            if buf or not parts:
                etag = await self._put_part(key, upload_id, number, bytes(buf))
                parts.append((number, etag))
            completed = await self._send(
                "POST",
                self._path(key, query=f"uploadId={upload_id}"),
                body=_complete_xml(parts).encode("utf-8"),
                extra={"content-type": "application/xml"},
            )
            if completed.status != 200 or not s3_result_ok(completed.body, "CompleteMultipartUploadResult"):
                raise VideoStorageError("multipart_complete_failed")
            stored = await self.head(key)
            if stored is None or stored.size != size:
                raise VideoStorageError("multipart_complete_failed")
        except BaseException as original:
            current = asyncio.current_task()
            if current is not None:
                while current.cancelling():
                    current.uncancel()
            await _abandon_upload(self, key, upload_id)
            raise original
        return ObjectStat(key, size, hasher.hexdigest())

    async def _put_part(self, key: str, upload_id: str, number: int, body: bytes) -> str:
        response = await self._send(
            "PUT",
            self._path(key, query=f"partNumber={number}&uploadId={upload_id}"),
            body=body,
        )
        if response.status != 200 or not response.etag:
            raise VideoStorageError("part_failed")
        return response.etag

    async def head(self, key: str) -> ObjectStat | None:
        response = await self._send("HEAD", self._path(key))
        if response.status == 404:
            return None
        if response.status != 200:
            raise VideoStorageError("head_failed")
        return ObjectStat(key, response.size, response.sha256 or "")

    async def get_range(self, key: str, start: int, end_inclusive: int) -> bytes:
        response = await self._send("GET", self._path(key), extra={"range": f"bytes={start}-{end_inclusive}"})
        if response.status not in {200, 206}:
            raise VideoStorageError("range_unavailable")
        return response.body

    def copy_request_headers(self, source: str, sha256: str) -> dict[str, str]:
        """Headers for one server-side copy. The destination guard is required.

        A prior HEAD is not the atomic guard. R2 ignores ``If-None-Match`` on
        CopyObject, so that header is not sent to R2. The beta header
        ``cf-copy-destination-if-none-match: *`` is sent only to R2 and is not
        retried away. A provider outside ``storage_provider`` never reaches
        this method.
        """
        headers = {
            "x-amz-copy-source": quote(f"/{self.bucket}/{source}", safe="/"),
            "x-amz-metadata-directive": "REPLACE",
            "x-amz-meta-sha256": sha256,
        }
        if self.provider == "r2":
            headers["cf-copy-destination-if-none-match"] = "*"
        elif self.provider == "localstack":
            headers["if-none-match"] = "*"
        else:
            raise VideoStorageError("atomic_copy_unavailable")
        return headers

    async def copy_if_absent(self, source: str, dest: str, sha256: str, *, size: int) -> str:
        current = await self.head(dest)
        if current is not None:
            if current.sha256 != sha256 or current.size != size:
                raise VideoObjectImmutable(dest)
            return "exists"
        response = await self._send("PUT", self._path(dest), extra=self.copy_request_headers(source, sha256))
        if response.status == 412:
            current = await self.head(dest)
            if current is None or current.sha256 != sha256 or current.size != size:
                raise VideoObjectImmutable(dest)
            return "exists"
        if response.status != 200 or not s3_result_ok(response.body, "CopyObjectResult"):
            raise VideoStorageError("copy_failed")
        current = await self.head(dest)
        if current is None or current.sha256 != sha256 or current.size != size:
            raise VideoStorageError("copy_failed")
        return "created"

    async def delete(self, key: str) -> None:
        response = await self._send("DELETE", self._path(key))
        if response.status not in {200, 204, 404}:
            raise VideoStorageError("delete_failed")

    async def aclose(self) -> None:
        close = getattr(self.transport, "aclose", None)
        if close is not None:
            await close()


def _complete_xml(parts: list[tuple[int, str]]) -> str:
    body = "".join(f"<Part><PartNumber>{number}</PartNumber><ETag>{etag}</ETag></Part>" for number, etag in parts)
    return f"<CompleteMultipartUpload>{body}</CompleteMultipartUpload>"


async def _abandon_upload(store: S3VideoStore, key: str, upload_id: str) -> None:
    """Abort this request's multipart upload and its staging object only.

    The content-addressed final key is never deleted here. A failed copy can
    race a successful copy of the same hash, and deleting the destination
    would remove the winner. Orphan finals need a separate reference-checked
    maintenance job; this path does not perform that job.
    """
    try:
        await asyncio.wait_for(
            store._send("DELETE", store._path(key, query=f"uploadId={upload_id}")),
            ABORT_TIMEOUT_SECONDS,
        )
    except BaseException:
        pass
    if "/staging/" in key:
        await _delete_quietly(store, key)


async def _delete_quietly(store: S3VideoStore, key: str) -> None:
    try:
        await asyncio.wait_for(store.delete(key), ABORT_TIMEOUT_SECONDS)
    except BaseException:
        pass


def video_store_from_env() -> S3VideoStore:
    """Build the production store. Only an HTTPS Cloudflare R2 endpoint is accepted."""
    values = {
        "endpoint": (os.getenv("EZA_BUSINESS_VIDEO_S3_ENDPOINT") or "").strip(),
        "bucket": (os.getenv("EZA_BUSINESS_VIDEO_S3_BUCKET") or "").strip(),
        "region": (os.getenv("EZA_BUSINESS_VIDEO_S3_REGION") or "").strip(),
        "access_key": (os.getenv("EZA_BUSINESS_VIDEO_S3_ACCESS_KEY_ID") or "").strip(),
        "secret_key": (os.getenv("EZA_BUSINESS_VIDEO_S3_SECRET_ACCESS_KEY") or "").strip(),
    }
    if not all(values.values()) or storage_provider(values["endpoint"]) != "r2":
        fail("video_storage_unconfigured", 503)
    import httpx

    class _HttpxTransport:
        def __init__(self):
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0))

        async def request(self, method, url, headers, body):
            content = body if body is not None else b""
            response = await self._client.request(method, url, headers=headers, content=content)
            upload_id = ""
            if b"<UploadId>" in response.content:
                upload_id = response.content.split(b"<UploadId>", 1)[1].split(b"</UploadId>", 1)[0].decode()
            sha = response.headers.get("x-amz-meta-sha256", "")
            return type("S3Response", (), {
                "status": response.status_code,
                "body": response.content,
                "etag": response.headers.get("etag", ""),
                "upload_id": upload_id,
                "size": int(response.headers.get("content-length") or 0),
                "sha256": sha,
            })()

        async def aclose(self):
            await self._client.aclose()

    return S3VideoStore(transport=_HttpxTransport(), **values)
