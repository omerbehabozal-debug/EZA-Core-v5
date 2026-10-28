"""Fetch one public HTTPS object without trusting DNS twice or following redirects blindly."""
from __future__ import annotations

import asyncio
import ipaddress
import ssl
from typing import AsyncIterator
from urllib.parse import urlsplit, urljoin

from backend.services.business_yansi.brand_assets import validate_https_url
from backend.services.business_yansi.service import fail


DOWNLOAD_TIMEOUT_SECONDS = 20
READ_TIMEOUT_SECONDS = 5
MAX_REDIRECTS = 3
MAX_HEADER_BYTES = 16 * 1024
_BLOCKED_HOSTS = frozenset({"localhost", "metadata.google.internal", "metadata"})


def ip_is_forbidden(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return True
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
        address = address.ipv4_mapped
    return bool(
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


async def default_resolver(host: str) -> list[str]:
    loop = asyncio.get_running_loop()
    try:
        infos = await asyncio.wait_for(loop.getaddrinfo(host, 443, type=asyncio.SOCK_STREAM), READ_TIMEOUT_SECONDS)
    except Exception:
        fail("video_url_rejected", 422)
    found = []
    for info in infos:
        address = info[4][0]
        if address not in found:
            found.append(address)
    return found


async def default_exchange(ip: str, host: str, request: bytes):
    context = ssl.create_default_context()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(ip, 443, ssl=context, server_hostname=host),
            READ_TIMEOUT_SECONDS,
        )
    except Exception:
        fail("video_url_rejected", 422)
    try:
        writer.write(request)
        await writer.drain()
    except Exception:
        writer.close()
        fail("video_url_rejected", 422)
    return _PinnedConnection(reader, writer)


class _PinnedConnection:
    def __init__(self, reader, writer):
        self._reader = reader
        self._writer = writer

    async def read(self, count: int) -> bytes:
        return await self._reader.read(count)

    async def close(self) -> None:
        self._writer.close()
        try:
            await self._writer.wait_closed()
        except Exception:
            return


async def _close_reader(reader) -> None:
    close = getattr(reader, "close", None)
    if close is not None:
        await close()


async def iter_https(url: str, *, max_bytes: int, resolver=default_resolver, exchange=default_exchange) -> AsyncIterator[bytes]:
    """Yield the response body. Each redirect is validated again. Bytes stop at max_bytes."""
    try:
        async with asyncio.timeout(DOWNLOAD_TIMEOUT_SECONDS):
            async for chunk in _iter_https(url, max_bytes=max_bytes, resolver=resolver, exchange=exchange):
                yield chunk
    except TimeoutError:
        fail("video_url_rejected", 422)


async def _iter_https(url: str, *, max_bytes: int, resolver, exchange) -> AsyncIterator[bytes]:
    current = url
    for _hop in range(MAX_REDIRECTS + 1):
        validate_https_url(current)
        parts = urlsplit(current)
        host = (parts.hostname or "").rstrip(".").lower()
        if host in _BLOCKED_HOSTS or host.endswith(".localhost") or host.endswith(".local"):
            fail("video_url_rejected", 422)
        addresses = await resolver(host)
        if not addresses or any(ip_is_forbidden(item) for item in addresses):
            fail("video_url_rejected", 422)
        pinned = addresses[0]
        path = parts.path or "/"
        if parts.query:
            path = f"{path}?{parts.query}"
        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}\r\n"
            "User-Agent: bilign-video-import\r\n"
            "Accept-Encoding: identity\r\n"
            "Connection: close\r\n\r\n"
        ).encode("ascii")
        reader = await exchange(pinned, host, request)
        try:
            status, headers, chunks = await _read_message(reader, max_bytes)
            if status in {301, 302, 303, 307, 308}:
                location = headers.get("location")
                if not location:
                    fail("video_url_rejected", 422)
                current = urljoin(current, location)
                continue
            if status != 200:
                fail("video_url_rejected", 422)
            encoding = headers.get("content-encoding", "identity").strip().lower()
            if encoding and encoding != "identity":
                fail("video_encoding_rejected", 422)
            if "content-length" in headers and "transfer-encoding" in headers:
                fail("video_url_rejected", 422)
            declared = headers.get("content-length")
            if declared is not None:
                try:
                    length = int(declared)
                except ValueError:
                    fail("video_url_rejected", 422)
                if length < 0 or length > max_bytes:
                    fail("video_too_large", 413)
            async for chunk in chunks:
                yield chunk
            return
        finally:
            await _close_reader(reader)
    fail("video_url_rejected", 422)


async def _read_message(reader, max_bytes: int):
    header = bytearray()
    while b"\r\n\r\n" not in header:
        piece = await asyncio.wait_for(reader.read(1), READ_TIMEOUT_SECONDS)
        if not piece:
            fail("video_url_rejected", 422)
        header += piece
        if len(header) > MAX_HEADER_BYTES:
            fail("video_url_rejected", 422)
    raw_head, rest = bytes(header).split(b"\r\n\r\n", 1)
    lines = raw_head.decode("latin1").split("\r\n")
    try:
        status = int(lines[0].split(" ", 2)[1])
    except (IndexError, ValueError):
        fail("video_url_rejected", 422)
    headers = {}
    for line in lines[1:]:
        if ":" not in line:
            fail("video_url_rejected", 422)
        name, value = line.split(":", 1)
        headers[name.strip().lower()] = value.strip()

    async def chunks():
        if headers.get("transfer-encoding", "").lower() == "chunked":
            pending = bytearray(rest)
            async for piece in _chunked(reader, pending, max_bytes):
                yield piece
            return
        remaining = max_bytes + 1
        if "content-length" in headers:
            remaining = int(headers["content-length"])
        sent = 0
        if rest:
            if len(rest) > remaining:
                fail("video_too_large", 413)
            sent += len(rest)
            yield rest
        while sent < remaining:
            piece = await asyncio.wait_for(reader.read(min(65536, remaining - sent)), READ_TIMEOUT_SECONDS)
            if not piece:
                break
            sent += len(piece)
            if sent > max_bytes:
                fail("video_too_large", 413)
            yield piece

    return status, headers, chunks()


async def _chunked(reader, pending: bytearray, max_bytes: int):
    total = 0

    async def take(count: int) -> bytes:
        while len(pending) < count:
            piece = await asyncio.wait_for(reader.read(65536), READ_TIMEOUT_SECONDS)
            if not piece:
                fail("video_url_rejected", 422)
            pending.extend(piece)
        found = bytes(pending[:count])
        del pending[:count]
        return found

    while True:
        line = bytearray()
        while not line.endswith(b"\r\n"):
            line += await take(1)
            if len(line) > 64:
                fail("video_url_rejected", 422)
        try:
            size = int(line.strip().split(b";", 1)[0], 16)
        except ValueError:
            fail("video_url_rejected", 422)
        if size == 0:
            return
        if size > max_bytes or total + size > max_bytes:
            fail("video_too_large", 413)
        total += size
        yield await take(size)
        if await take(2) != b"\r\n":
            fail("video_url_rejected", 422)
