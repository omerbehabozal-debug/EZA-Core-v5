"""Admit a Business video upload before any multipart parse.

FastAPI 0.104 reads request.form() before dependencies when a route declares
File() or Form(). This gate runs first, counts the bytes ASGI actually
delivers, and only then lets the route authenticate and parse.
"""
from __future__ import annotations

import asyncio
import time

from starlette.formparsers import MultiPartException, MultiPartParser
from starlette.requests import Request

from backend.services.business_yansi.service import fail
from backend.services.business_yansi.video_ingest import STEP_MAX_BYTES


VIDEO_UPLOAD_ADMISSION = 8
RECEIVE_FRAMING_BYTES = 64 * 1024
RECEIVE_ABSOLUTE_SECONDS = 120
RECEIVE_IDLE_SECONDS = 15


class UploadBodyTooLarge(MultiPartException):
    def __init__(self) -> None:
        super().__init__("upload body exceeds the receive limit")


class UploadReceiveTimeout(MultiPartException):
    def __init__(self) -> None:
        super().__init__("upload receive timed out")


def receive_absolute_seconds() -> float:
    """Wall clock for the whole body receive. Later chunks do not extend it."""
    return RECEIVE_ABSOLUTE_SECONDS


def receive_idle_seconds() -> float:
    """Max wait for the next ASGI body message."""
    return RECEIVE_IDLE_SECONDS


def monotonic() -> float:
    return time.monotonic()


def receive_limit() -> int:
    """Ceiling for the raw HTTP body, including multipart framing.

    The file itself is still capped by the cover and step limits inside ingest.
    """
    return STEP_MAX_BYTES + RECEIVE_FRAMING_BYTES


class UploadAdmission:
    """Per-process in-flight cap. The protected resource is this worker."""

    def __init__(self) -> None:
        self.limit = VIDEO_UPLOAD_ADMISSION
        self.active = 0
        self._lock = asyncio.Lock()

    async def try_acquire(self) -> bool:
        async with self._lock:
            if self.active >= self.limit:
                return False
            self.active += 1
            return True

    async def release(self) -> None:
        async with self._lock:
            if self.active:
                self.active -= 1


admission = UploadAdmission()


class BoundedReceive:
    """Count delivered body bytes and bound how long the receive may wait.

    The absolute deadline is fixed at the first receive wait. A declared
    Content-Length is not the size limit, and a new chunk does not move the deadline.
    """

    def __init__(self, receive, limit: int):
        self._receive = receive
        self._limit = limit
        self.seen = 0
        self._closed = False
        self._deadline_at: float | None = None

    async def __call__(self):
        if self._closed:
            return {"type": "http.request", "body": b"", "more_body": False}
        if self._deadline_at is None:
            self._deadline_at = monotonic() + receive_absolute_seconds()
        remaining = self._deadline_at - monotonic()
        if remaining <= 0:
            self._closed = True
            raise UploadReceiveTimeout()
        try:
            message = await asyncio.wait_for(
                self._receive(),
                timeout=min(receive_idle_seconds(), remaining),
            )
        except TimeoutError:
            self._closed = True
            raise UploadReceiveTimeout()
        if message.get("type") != "http.request":
            return message
        body = message.get("body") or b""
        self.seen += len(body)
        if self.seen > self._limit:
            self._closed = True
            raise UploadBodyTooLarge()
        return message


class _ClosingParser(MultiPartParser):
    async def parse(self):
        try:
            return await super().parse()
        except BaseException:
            for handle in self._files_to_close_on_error:
                try:
                    handle.close()
                except Exception:
                    pass
            raise


async def admit_video_upload(request: Request):
    """Hold an upload slot and bound the raw body before get_current_user.

    FastAPI copies route.app when the router is included, so this has to be a
    dependency on the endpoint. It does not read the body.
    """
    declared = _declared_length(request.scope)
    if declared is not None and declared > receive_limit():
        fail("video_too_large", 413)
    if not await admission.try_acquire():
        fail("video_upload_busy", 429)
    request._receive = BoundedReceive(request._receive, receive_limit())
    try:
        yield
    finally:
        paused = _pause_cancellation()
        try:
            await admission.release()
        finally:
            if paused:
                raise asyncio.CancelledError()


def _declared_length(scope) -> int | None:
    found = None
    for name, value in scope.get("headers") or []:
        if name.lower() != b"content-length":
            continue
        try:
            found = int(value)
        except (TypeError, ValueError):
            continue
    return found


def _pause_cancellation() -> int:
    task = asyncio.current_task()
    paused = 0
    if task is None:
        return 0
    while task.cancelling():
        task.uncancel()
        paused += 1
    return paused


async def read_upload_form(request: Request):
    """Parse multipart only after the caller has already authenticated."""
    parser = _ClosingParser(request.headers, request.stream(), max_files=1, max_fields=8)
    try:
        return await parser.parse()
    except UploadReceiveTimeout:
        fail("video_receive_timeout", 408)
    except UploadBodyTooLarge:
        fail("video_too_large", 413)
    except (MultiPartException, KeyError, ValueError):
        fail("video_file_rejected", 400)
