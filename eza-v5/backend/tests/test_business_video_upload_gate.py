"""Pre-auth video uploads must not spool multipart bodies."""
import asyncio
import json
import time
import uuid

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from starlette.datastructures import UploadFile

from backend.core.utils.dependencies import get_db
from backend.routers import business_yansi as routes
from backend.services.business_yansi import video_storage as storage
from backend.services.business_yansi import video_upload_gate as gate
from backend.services.business_yansi.video_storage import MemoryVideoStore
from backend.tests.test_business_video_storage import VideoQuotaRedis, _mp4
from backend.tests.test_business_yansi import sample


_TWO_MIB = 2 * 1024 * 1024


@pytest.fixture(autouse=True)
def _business_on(monkeypatch):
    monkeypatch.setenv("BILIGN_BUSINESS_ENABLED", "true")
    gate.admission.limit = gate.VIDEO_UPLOAD_ADMISSION
    gate.admission.active = 0


@pytest.fixture(autouse=True)
def _quiet_probe_and_quota(monkeypatch):
    quota = VideoQuotaRedis()

    async def client():
        return quota

    monkeypatch.setattr("backend.services.business_yansi.video_ingest._redis", client)

    async def accept(_path: str) -> None:
        return None

    monkeypatch.setattr("backend.services.business_yansi.video_mp4.probe_file", accept)


def _app():
    app = FastAPI()
    app.include_router(routes.router)

    async def db():
        yield None

    app.dependency_overrides[get_db] = db
    return app


def _multipart(payload: bytes, boundary: str = "bound") -> bytes:
    return (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="title"\r\n\r\n'
        "Atolye filmi\r\n"
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="purpose"\r\n\r\n'
        "cover\r\n"
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="file"; filename="clip.bin"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + payload + f"\r\n--{boundary}--\r\n".encode()


async def _raw(app, path, headers, chunks):
    pulled = {"n": 0, "bytes": 0}
    sent = []

    async def receive():
        if pulled["n"] >= len(chunks):
            return {"type": "http.disconnect"}
        chunk = chunks[pulled["n"]]
        pulled["n"] += 1
        pulled["bytes"] += len(chunk)
        return {"type": "http.request", "body": chunk, "more_body": pulled["n"] < len(chunks)}

    async def send(message):
        sent.append(message)

    raw_headers = [(name.encode(), value.encode()) for name, value in headers]
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": raw_headers,
        "client": ("127.0.0.1", 50000),
        "server": ("test", 80),
        "root_path": "",
    }
    await app(scope, receive, send)
    status = next(item["status"] for item in sent if item["type"] == "http.response.start")
    body = b"".join(item.get("body", b"") for item in sent if item["type"] == "http.response.body")
    return status, body, pulled


def _writes(monkeypatch):
    seen = []
    original = UploadFile.write

    async def spy(self, data):
        seen.append(len(data))
        return await original(self, data)

    monkeypatch.setattr("starlette.formparsers.UploadFile.write", spy)
    return seen


async def test_missing_and_invalid_auth_do_not_spool(monkeypatch):
    writes = _writes(monkeypatch)
    app = _app()
    path = f"/api/business-yansi/{uuid.uuid4()}/assets/video"
    body = _multipart(b"x" * _TWO_MIB)
    missing = await _raw(app, path, [("content-type", "multipart/form-data; boundary=bound")], [body])
    assert missing[0] == 401
    assert missing[2]["n"] == 0
    assert writes == []
    invalid = await _raw(
        app, path,
        [
            ("content-type", "multipart/form-data; boundary=bound"),
            ("authorization", "Bearer not-a-token"),
        ],
        [body],
    )
    assert invalid[0] == 401
    assert invalid[2]["n"] == 0
    assert writes == []
    assert gate.admission.active == 0


async def test_oversized_declared_and_lying_lengths_stop(monkeypatch):
    writes = _writes(monkeypatch)
    monkeypatch.setattr(gate, "receive_limit", lambda: 2048)
    app = _app()
    path = f"/api/business-yansi/{uuid.uuid4()}/assets/video"
    attack = _multipart(b"y" * 80_000)
    declared = await _raw(
        app, path,
        [
            ("content-type", "multipart/form-data; boundary=bound"),
            ("content-length", str(len(attack) + 50_000)),
        ],
        [attack],
    )
    assert declared[0] == 413
    assert json.loads(declared[1])["detail"]["code"] == "video_too_large"
    assert declared[2]["n"] == 0
    assert writes == []

    chunks = [attack[index:index + 1000] for index in range(0, len(attack), 1000)]
    lied = await _raw(
        app, path,
        [
            ("content-type", "multipart/form-data; boundary=bound"),
            ("authorization", "Bearer not-a-token"),
            ("content-length", "10"),
        ],
        chunks,
    )
    assert lied[0] == 401
    assert lied[2]["n"] == 0
    assert writes == []


async def test_authorized_chunked_body_cannot_pass_the_byte_counter(monkeypatch, sample):
    from tempfile import SpooledTemporaryFile

    writes = _writes(monkeypatch)
    closed = []
    real_close = SpooledTemporaryFile.close

    def track_close(self):
        closed.append(True)
        return real_close(self)

    monkeypatch.setattr(SpooledTemporaryFile, "close", track_close)
    monkeypatch.setattr(gate, "receive_limit", lambda: 4096)
    app = _app()
    app.dependency_overrides[routes.get_current_user] = lambda: {"user_id": str(sample.editor.id)}
    app.dependency_overrides[routes.get_db] = lambda: sample.db
    attack = _multipart(b"z" * 80_000)
    chunks = [attack[index:index + 1000] for index in range(0, len(attack), 1000)]
    path = f"/api/business-yansi/{sample.business.id}/assets/video"
    status, body, pulled = await _raw(
        app, path,
        [("content-type", "multipart/form-data; boundary=bound")],
        chunks,
    )
    assert status == 413
    assert json.loads(body)["detail"]["code"] == "video_too_large"
    assert pulled["bytes"] < len(attack)
    assert sum(writes) <= 4096
    assert closed
    assert gate.admission.active == 0
    writes.clear()
    closed.clear()
    lied = await _raw(
        app, path,
        [
            ("content-type", "multipart/form-data; boundary=bound"),
            ("content-length", "10"),
        ],
        chunks,
    )
    assert lied[0] == 413
    assert lied[2]["bytes"] < len(attack)
    assert sum(writes) <= 4096
    assert closed
    assert gate.admission.active == 0


async def test_unauthenticated_concurrency_releases_admission(monkeypatch):
    writes = _writes(monkeypatch)
    gate.admission.limit = 2
    app = _app()
    started = []
    release = __import__("asyncio").Event()

    async def hold():
        started.append(1)
        await release.wait()
        raise HTTPException(status_code=401, detail="Authentication required")

    app.dependency_overrides[routes.get_current_user] = hold
    path = f"/api/business-yansi/{uuid.uuid4()}/assets/video"
    headers = [("content-type", "multipart/form-data; boundary=bound")]
    body = _multipart(b"q" * 3000)

    import asyncio
    tasks = [asyncio.create_task(_raw(app, path, headers, [body])) for _ in range(2)]
    for _ in range(50):
        if len(started) >= 2 and gate.admission.active == 2:
            break
        await asyncio.sleep(0.01)
    assert len(started) == 2
    assert gate.admission.active == 2
    overflows = await asyncio.gather(*[_raw(app, path, headers, [body]) for _ in range(4)])
    assert all(item[0] == 429 and item[2]["n"] == 0 for item in overflows)
    assert json.loads(overflows[0][1])["detail"]["code"] == "video_upload_busy"
    assert writes == []
    release.set()
    done = await asyncio.gather(*tasks)
    assert all(item[0] == 401 and item[2]["n"] == 0 for item in done)
    assert writes == []
    assert gate.admission.active == 0
    again = await _raw(app, path, [("authorization", "Bearer not-a-token"), ("content-type", "multipart/form-data; boundary=bound")], [body])
    assert again[0] == 401
    assert again[2]["n"] == 0


async def test_authorized_upload_still_stores_and_parser_errors_leave_nothing(monkeypatch, sample):
    monkeypatch.setattr(storage, "video_store_from_env", lambda: MemoryVideoStore())
    app = _app()
    app.dependency_overrides[routes.get_current_user] = lambda: {"user_id": str(sample.editor.id)}
    app.dependency_overrides[routes.get_db] = lambda: sample.db
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        uploaded = await client.post(
            f"/api/business-yansi/{sample.business.id}/assets/video",
            data={"title": "Atolye filmi", "caption": "", "purpose": "cover", "publicAllowed": "false"},
            files={"file": ("clip.bin", _mp4(seconds=1), "application/octet-stream")},
        )
        broken = await client.post(
            f"/api/business-yansi/{sample.business.id}/assets/video",
            content=b"not-multipart",
            headers={"content-type": "multipart/form-data; boundary=bound"},
        )
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json()["locator_kind"] == "storage"
    assert uploaded.json()["locator"] is None
    assert broken.status_code == 400
    assert broken.json()["detail"]["code"] == "video_file_rejected"
    assert gate.admission.active == 0


async def test_cancel_during_parse_closes_the_spool_and_releases_admission(monkeypatch, sample):
    import asyncio
    from tempfile import SpooledTemporaryFile

    closed = []
    real_close = SpooledTemporaryFile.close

    def track_close(self):
        closed.append(True)
        return real_close(self)

    monkeypatch.setattr(SpooledTemporaryFile, "close", track_close)
    original = UploadFile.write
    started_write = __import__("asyncio").Event()

    async def block_write(self, data):
        await original(self, data)
        started_write.set()
        await __import__("asyncio").Event().wait()

    monkeypatch.setattr("starlette.formparsers.UploadFile.write", block_write)
    app = _app()
    app.dependency_overrides[routes.get_current_user] = lambda: {"user_id": str(sample.editor.id)}
    app.dependency_overrides[routes.get_db] = lambda: sample.db
    path = f"/api/business-yansi/{sample.business.id}/assets/video"
    body = _multipart(b"m" * 8000)
    task = asyncio.create_task(_raw(
        app, path,
        [("content-type", "multipart/form-data; boundary=bound")],
        [body],
    ))
    for _ in range(50):
        if started_write.is_set():
            break
        await asyncio.sleep(0.01)
    assert started_write.is_set()
    assert gate.admission.active == 1
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert gate.admission.active == 0
    assert closed


def _auth_app():
    app = _app()
    app.dependency_overrides[routes.get_current_user] = lambda: {"user_id": str(uuid.uuid4())}
    return app


def _file_prefix(payload: bytes = b"m" * 2000) -> tuple[bytes, bytes]:
    body = _multipart(payload)
    marker = body.index(b'filename="clip.bin"')
    split = body.index(b"\r\n\r\n", marker) + 4
    return body[:split + 64], body[split + 64:]


async def _invoke(app, path, headers, receive):
    sent = []

    async def send(message):
        sent.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "headers": [(name.encode(), value.encode()) for name, value in headers],
        "client": ("127.0.0.1", 50000),
        "server": ("test", 80),
        "root_path": "",
    }
    caught = None
    try:
        await app(scope, receive, send)
    except Exception as exc:
        caught = exc
    status = next((item["status"] for item in sent if item["type"] == "http.response.start"), None)
    body = b"".join(item.get("body", b"") for item in sent if item["type"] == "http.response.body")
    return status, body, caught


def _forbid_store():
    raise AssertionError("storage opened during receive timeout")


async def test_receive_deadlines_stay_separate_from_ingest():
    from backend.services.business_yansi import video_ingest

    assert gate.RECEIVE_ABSOLUTE_SECONDS == 120
    assert gate.RECEIVE_IDLE_SECONDS == 15
    assert gate.receive_absolute_seconds() == 120
    assert gate.receive_idle_seconds() == 15
    assert video_ingest.VIDEO_DEADLINE_SECONDS == 90


async def test_stalled_authenticated_upload_times_out(monkeypatch):
    from tempfile import SpooledTemporaryFile

    monkeypatch.setattr(gate, "receive_idle_seconds", lambda: 0.2)
    monkeypatch.setattr(gate, "receive_absolute_seconds", lambda: 30)
    monkeypatch.setattr(storage, "video_store_from_env", _forbid_store)
    gate.admission.limit = 1
    closed = []
    real_close = SpooledTemporaryFile.close

    def track_close(self):
        closed.append(True)
        return real_close(self)

    monkeypatch.setattr(SpooledTemporaryFile, "close", track_close)
    app = _auth_app()
    path = f"/api/business-yansi/{uuid.uuid4()}/assets/video"
    first, _rest = _file_prefix()
    entered = {"n": 0}

    async def receive():
        entered["n"] += 1
        if entered["n"] == 1:
            return {"type": "http.request", "body": first, "more_body": True}
        await asyncio.Event().wait()

    started = time.monotonic()
    status, body, caught = await asyncio.wait_for(
        _invoke(app, path, [("content-type", "multipart/form-data; boundary=bound")], receive),
        timeout=2,
    )
    elapsed = time.monotonic() - started
    assert caught is None
    assert status == 408
    assert json.loads(body)["detail"]["code"] == "video_receive_timeout"
    assert elapsed < 1.5
    assert closed
    assert gate.admission.active == 0
    follow = await _raw(
        _app(), path,
        [("content-type", "multipart/form-data; boundary=bound")],
        [_multipart(b"x" * 100)],
    )
    assert follow[0] == 401
    assert follow[2]["n"] == 0
    assert gate.admission.active == 0


async def test_trickle_cannot_extend_the_absolute_deadline(monkeypatch):
    from tempfile import SpooledTemporaryFile

    monkeypatch.setattr(gate, "receive_idle_seconds", lambda: 5)
    monkeypatch.setattr(gate, "receive_absolute_seconds", lambda: 0.45)
    monkeypatch.setattr(storage, "video_store_from_env", _forbid_store)
    gate.admission.limit = 1
    closed = []
    real_close = SpooledTemporaryFile.close

    def track_close(self):
        closed.append(True)
        return real_close(self)

    monkeypatch.setattr(SpooledTemporaryFile, "close", track_close)
    app = _auth_app()
    path = f"/api/business-yansi/{uuid.uuid4()}/assets/video"
    body = _multipart(b"z" * 8000)
    chunks = [body[index:index + 500] for index in range(0, len(body), 500)]
    returned = {"n": 0}

    async def receive():
        if returned["n"] >= len(chunks):
            return {"type": "http.disconnect"}
        await asyncio.sleep(0.12)
        chunk = chunks[returned["n"]]
        returned["n"] += 1
        return {"type": "http.request", "body": chunk, "more_body": returned["n"] < len(chunks)}

    started = time.monotonic()
    status, payload, caught = await asyncio.wait_for(
        _invoke(app, path, [("content-type", "multipart/form-data; boundary=bound")], receive),
        timeout=2.5,
    )
    elapsed = time.monotonic() - started
    assert caught is None
    assert status == 408
    assert json.loads(payload)["detail"]["code"] == "video_receive_timeout"
    assert 2 <= returned["n"] < len(chunks)
    assert elapsed < 2.5
    assert closed
    assert gate.admission.active == 0
    follow = await _raw(
        _app(), path,
        [("authorization", "Bearer not-a-token"), ("content-type", "multipart/form-data; boundary=bound")],
        [_multipart(b"x" * 100)],
    )
    assert follow[0] == 401
    assert follow[2]["n"] == 0


async def test_upload_within_receive_deadlines_succeeds(monkeypatch, sample):
    monkeypatch.setattr(gate, "receive_idle_seconds", lambda: 3)
    monkeypatch.setattr(gate, "receive_absolute_seconds", lambda: 3)
    monkeypatch.setattr(storage, "video_store_from_env", lambda: MemoryVideoStore())
    app = _app()
    app.dependency_overrides[routes.get_current_user] = lambda: {"user_id": str(sample.editor.id)}
    app.dependency_overrides[routes.get_db] = lambda: sample.db
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        uploaded = await client.post(
            f"/api/business-yansi/{sample.business.id}/assets/video",
            data={"title": "Atolye filmi", "caption": "", "purpose": "cover", "publicAllowed": "false"},
            files={"file": ("clip.bin", _mp4(seconds=1), "application/octet-stream")},
        )
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json()["locator_kind"] == "storage"
    assert gate.admission.active == 0


async def test_cancel_during_receive_timeout_releases_the_slot(monkeypatch):
    from tempfile import SpooledTemporaryFile

    monkeypatch.setattr(gate, "receive_idle_seconds", lambda: 0.2)
    monkeypatch.setattr(gate, "receive_absolute_seconds", lambda: 30)
    monkeypatch.setattr(storage, "video_store_from_env", _forbid_store)
    gate.admission.limit = 1
    closed = []
    real_close = SpooledTemporaryFile.close
    cancelled_close = {"done": False}
    request_task = {}

    def track_close(self):
        closed.append(True)
        real_close(self)
        if not cancelled_close["done"]:
            cancelled_close["done"] = True
            request_task["task"].cancel()

    monkeypatch.setattr(SpooledTemporaryFile, "close", track_close)
    app = _auth_app()
    path = f"/api/business-yansi/{uuid.uuid4()}/assets/video"
    first, _rest = _file_prefix()
    entered = {"n": 0}

    async def receive():
        entered["n"] += 1
        if entered["n"] == 1:
            return {"type": "http.request", "body": first, "more_body": True}
        await asyncio.Event().wait()

    request_task["task"] = asyncio.create_task(
        _invoke(app, path, [("content-type", "multipart/form-data; boundary=bound")], receive),
    )
    with pytest.raises(asyncio.CancelledError):
        await request_task["task"]
    assert closed
    assert gate.admission.active == 0
    follow = await _raw(
        _app(), path,
        [("content-type", "multipart/form-data; boundary=bound")],
        [_multipart(b"q" * 50)],
    )
    assert follow[0] == 401
    assert follow[2]["n"] == 0
    assert gate.admission.active == 0


async def test_disconnect_during_parse_cleans_up_without_the_timeout_code(monkeypatch):
    from tempfile import SpooledTemporaryFile

    monkeypatch.setattr(storage, "video_store_from_env", _forbid_store)
    closed = []
    real_close = SpooledTemporaryFile.close

    def track_close(self):
        closed.append(True)
        return real_close(self)

    monkeypatch.setattr(SpooledTemporaryFile, "close", track_close)
    app = _auth_app()
    path = f"/api/business-yansi/{uuid.uuid4()}/assets/video"
    first, _rest = _file_prefix()
    entered = {"n": 0}

    async def receive():
        entered["n"] += 1
        if entered["n"] == 1:
            return {"type": "http.request", "body": first, "more_body": True}
        return {"type": "http.disconnect"}

    status, body, caught = await _invoke(
        app, path, [("content-type", "multipart/form-data; boundary=bound")], receive,
    )
    assert gate.admission.active == 0
    assert closed
    assert b"video_receive_timeout" not in body
    assert status != 408
    assert caught is None or caught.__class__.__name__ == "ClientDisconnect"
