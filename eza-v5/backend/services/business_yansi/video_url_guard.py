"""Fetch one public HTTPS object without trusting DNS twice or following redirects blindly."""
from __future__ import annotations

import asyncio
import ipaddress
import socket
import ssl
from typing import AsyncIterator
from urllib.parse import urlsplit, urljoin

from backend.services.business_yansi.brand_assets import validate_https_url
from backend.services.business_yansi.service import fail


DOWNLOAD_TIMEOUT_SECONDS = 20
READ_TIMEOUT_SECONDS = 5
MAX_REDIRECTS = 3
MAX_HEADER_BYTES = 16 * 1024
_BLOCKED_HOSTS = frozenset({
    "localhost",
    "metadata",
    "metadata.google.internal",
    "metadata.internal",
})
# Explicit even where ipaddress.is_global already rejects them, so a later
# Python classification cannot make carrier-grade NAT or metadata reachable.
_BLOCKED_NETWORKS = (
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("100.100.100.200/32"),
    ipaddress.ip_network("169.254.169.254/32"),
    ipaddress.ip_network("169.254.170.2/32"),
    ipaddress.ip_network("fd00:ec2::254/128"),
)


def ip_is_forbidden(value: str) -> bool:
    """Allow only a globally routable address. Mapped IPv6 is never a target."""
    try:
        address = ipaddress.ip_address(str(value).split("%", 1)[0])
    except ValueError:
        return True
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
        return True
    if any(address in network for network in _BLOCKED_NETWORKS):
        return True
    if (
        address.is_multicast
        or address.is_loopback
        or address.is_link_local
        or address.is_private
        or address.is_reserved
        or address.is_unspecified
        or not address.is_global
    ):
        return True
    return False


async def default_resolver(host: str) -> list[str]:
    loop = asyncio.get_running_loop()
    try:
        infos = await asyncio.wait_for(loop.getaddrinfo(host, 443, type=socket.SOCK_STREAM), READ_TIMEOUT_SECONDS)
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
            _require_framing(headers, max_bytes)
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
    pairs = []
    for line in lines[1:]:
        if ":" not in line:
            fail("video_url_rejected", 422)
        name, value = line.split(":", 1)
        pairs.append((name.strip().lower(), value.strip()))
    headers = {name: value for name, value in pairs}
    headers["_pairs"] = pairs

    async def chunks():
        if headers.get("transfer-encoding", "").lower() == "chunked":
            pending = bytearray(rest)
            async for piece in _chunked(reader, pending, max_bytes):
                yield piece
            return
        try:
            remaining = int(headers["content-length"])
        except (KeyError, ValueError):
            fail("video_url_rejected", 422)
        if remaining <= 0:
            fail("video_url_rejected", 422)
        sent = 0
        if rest:
            if len(rest) > remaining:
                fail("video_too_large", 413)
            sent += len(rest)
            yield rest
        while sent < remaining:
            piece = await asyncio.wait_for(reader.read(min(65536, remaining - sent)), READ_TIMEOUT_SECONDS)
            if not piece:
                fail("video_url_rejected", 422)
            if sent + len(piece) > remaining:
                piece = piece[: remaining - sent]
            sent += len(piece)
            yield piece
        if sent != remaining:
            fail("video_url_rejected", 422)

    return status, headers, chunks()


def _require_framing(headers: dict, max_bytes: int) -> None:
    pairs = headers.get("_pairs") or []
    counts: dict[str, int] = {}
    for name, _value in pairs:
        counts[name] = counts.get(name, 0) + 1
    for name in ("content-length", "transfer-encoding", "content-encoding"):
        if counts.get(name, 0) > 1:
            fail("video_url_rejected", 422)
    if "content-length" in headers and "transfer-encoding" in headers:
        fail("video_url_rejected", 422)
    transfer = headers.get("transfer-encoding")
    if transfer is not None and transfer.lower() != "chunked":
        fail("video_url_rejected", 422)
    if transfer is None and "content-length" not in headers:
        fail("video_url_rejected", 422)
    encoding = headers.get("content-encoding", "identity").strip().lower()
    if encoding != "identity":
        fail("video_encoding_rejected", 422)
    if "content-length" in headers:
        try:
            length = int(headers["content-length"])
        except ValueError:
            fail("video_url_rejected", 422)
        if length < 0 or length > max_bytes:
            fail("video_too_large", 413)


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
