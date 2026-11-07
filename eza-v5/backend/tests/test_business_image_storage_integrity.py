"""Content-addressed brand image storage: no-clobber publish and sealed-media safety.

Actual local-filesystem tests (plus targeted os.link/os.rename fault injection).
Not PostgreSQL overlapping-transaction proofs.
"""
from __future__ import annotations

import hashlib
import os
import threading
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException

from backend.services.business_yansi import brand_asset_library as library
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio_media as media
from backend.services.business_yansi.video_authority import assign_member_role
from backend.tests.test_business_studio_media import _approve, _steps
from backend.tests.test_business_video_cover_policy import asset_dir, sample
from backend.tests.test_business_yansi import source

from io import BytesIO
from PIL import Image

from backend.services.profile_avatar_store import detect_image_mime


def _png_color(rgb: tuple[int, int, int]) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (8, 8), color=rgb).save(buf, format="PNG")
    return buf.getvalue()


_PNG = _png_color((40, 120, 80))


def _path_for(business_id, payload: bytes) -> Path:
    """Path for bytes passed straight to store_image (no prepare)."""
    digest = hashlib.sha256(payload).hexdigest()
    mime = detect_image_mime(payload) or "image/png"
    ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}.get(mime, "png")
    return library.asset_root() / str(business_id) / f"{digest}.{ext}"


def _path_for_prepared(business_id, raw: bytes) -> Path:
    """Path for bytes that flow through create_asset prepare_brand_library_image."""
    stored = library.prepare_brand_library_image(raw)
    return _path_for(business_id, stored)


# --- Path equivalence (unit; no disk I/O beyond Path construction) ---


def test_path_equivalence_ordinary_and_extended_drive():
    root = Path(r"C:\Users\MONSTER\AppData\Local\Temp\bilign-root")
    ordinary = root / "tenant" / "a.png"
    extended = Path(r"\\?\C:\Users\MONSTER\AppData\Local\Temp\bilign-root\tenant\a.png")
    assert library._path_is_within(root, ordinary) is True
    assert library._path_is_within(root, extended) is True
    assert library._path_is_within(Path(r"\\?\C:\Users\MONSTER\AppData\Local\Temp\bilign-root"), ordinary) is True


def test_path_equivalence_unc_ordinary_and_extended():
    root = Path(r"\\fileserver\share\brand")
    ordinary = root / "tenant" / "a.png"
    extended = Path(r"\\?\UNC\fileserver\share\brand\tenant\a.png")
    assert library._path_is_within(root, ordinary) is True
    assert library._path_is_within(root, extended) is True
    assert library._path_is_within(Path(r"\\?\UNC\fileserver\share\brand"), ordinary) is True


def test_path_rejects_traversal_and_foreign_roots():
    root = Path(r"C:\Users\MONSTER\AppData\Local\Temp\bilign-root")
    assert library._path_is_within(root, Path(r"C:\Windows\System32\x.png")) is False
    assert library._path_is_within(root, Path(r"\\?\C:\Windows\System32\x.png")) is False
    assert library._path_is_within(root, Path(r"C:\Users\MONSTER\AppData\Local\Temp\bilign-root\..\..\Windows\x.png")) is False
    # Different volume / share
    assert library._path_is_within(root, Path(r"D:\other\a.png")) is False
    assert library._path_is_within(root, Path(r"\\other\share\a.png")) is False


def test_path_rejects_device_namespace_without_coercion():
    root = Path(r"C:\Users\MONSTER\AppData\Local\Temp\bilign-root")
    device = Path(r"\\.\C:\Users\MONSTER\AppData\Local\Temp\bilign-root\tenant\a.png")
    volume = Path(r"\\?\Volume{00000000-0000-0000-0000-000000000000}\tenant\a.png")
    assert library._path_is_within(root, device) is False
    assert library._path_is_within(root, volume) is False


# --- Actual filesystem publish / integrity ---


def test_repeated_upload_reuses_valid_hash_without_rewrite(asset_dir, monkeypatch):
    business_id = uuid.uuid4()
    payload = _PNG + b"reuse-valid"
    target = _path_for(business_id, payload)
    first = library.store_image(business_id, payload)
    assert target.is_file() and target.read_bytes() == payload

    opens: list[str] = []
    real_open = os.open

    def spy_open(path, flags, *args, **kwargs):
        opens.append(str(path))
        if Path(path).resolve() == target.resolve() and (flags & os.O_WRONLY or flags & os.O_RDWR):
            raise AssertionError("existing hash opened for write")
        return real_open(path, flags, *args, **kwargs)

    monkeypatch.setattr(os, "open", spy_open)
    second = library.store_image(business_id, payload)
    assert second == first
    assert target.read_bytes() == payload
    assert not any(str(target) == path for path in opens)


def test_corrupted_existing_hash_fails_closed_without_delete(asset_dir):
    business_id = uuid.uuid4()
    payload = _PNG + b"corrupt-hash"
    target = _path_for(business_id, payload)
    library.store_image(business_id, payload)
    target.write_bytes(b"\x00" * 32)
    before = target.read_bytes()
    with pytest.raises(HTTPException) as raised:
        library.store_image(business_id, payload)
    assert raised.value.detail["code"] == "asset_file_corrupt"
    assert target.is_file()
    assert target.read_bytes() == before


def test_partial_stage_failure_leaves_no_target_or_temp(asset_dir, monkeypatch):
    business_id = uuid.uuid4()
    payload = _PNG + b"partial-stage"
    target = _path_for(business_id, payload)
    real_write = os.write
    calls = {"n": 0}

    def boom_write(fd, data):
        calls["n"] += 1
        if calls["n"] == 1:
            raise OSError("simulated partial write")
        return real_write(fd, data)

    monkeypatch.setattr(os, "write", boom_write)
    with pytest.raises(OSError):
        library.store_image(business_id, payload)
    assert not target.exists()
    leftovers = list(target.parent.glob(".*.tmp")) if target.parent.exists() else []
    assert leftovers == []


def test_publish_race_reuses_winner_without_overwrite(asset_dir, monkeypatch):
    business_id = uuid.uuid4()
    payload = _PNG + b"race-winner"
    target = _path_for(business_id, payload)
    real_link = os.link

    def win_then_link(src, dst):
        Path(dst).parent.mkdir(parents=True, exist_ok=True)
        if not Path(dst).exists():
            Path(dst).write_bytes(payload)
        return real_link(src, dst)

    monkeypatch.setattr(os, "link", win_then_link)
    locator = library.store_image(business_id, payload)
    assert locator.endswith(".png")
    assert target.read_bytes() == payload


@pytest.mark.skipif(os.name != "nt", reason="Windows WinError 5 fallback only")
def test_windows_link_access_denied_absent_destination_uses_rename(asset_dir, monkeypatch):
    business_id = uuid.uuid4()
    payload = _PNG + b"winerr5-absent"
    target = _path_for(business_id, payload)
    renames: list[tuple[str, str]] = []

    def deny_link(src, dst):
        raise OSError(5, "Access is denied", str(dst), 5)

    real_rename = os.rename

    def spy_rename(src, dst):
        renames.append((str(src), str(dst)))
        return real_rename(src, dst)

    monkeypatch.setattr(os, "link", deny_link)
    monkeypatch.setattr(os, "rename", spy_rename)
    locator = library.store_image(business_id, payload)
    assert locator.endswith(".png")
    assert target.is_file()
    assert target.read_bytes() == payload
    assert renames and Path(renames[0][1]).resolve() == target.resolve()
    assert list(target.parent.glob(".*.tmp")) == []


@pytest.mark.skipif(os.name != "nt", reason="Windows WinError 5 fallback only")
def test_windows_link_access_denied_existing_destination_reuses_without_rename(asset_dir, monkeypatch):
    business_id = uuid.uuid4()
    payload = _PNG + b"winerr5-exists"
    target = _path_for(business_id, payload)
    library.store_image(business_id, payload)
    before = target.read_bytes()
    renames: list[tuple[str, str]] = []

    def deny_link(src, dst):
        raise OSError(5, "Access is denied", str(dst), 5)

    def forbid_rename(src, dst):
        renames.append((str(src), str(dst)))
        raise AssertionError("rename must not run when destination already exists")

    monkeypatch.setattr(os, "link", deny_link)
    monkeypatch.setattr(os, "rename", forbid_rename)
    # Bypass early reuse so publish path sees an existing destination after link denial.
    # store_image short-circuits on is_file(); call publish helpers via a fresh name race:
    # recreate by deleting is_file check — instead inject at publish with existing file:
    staged = library._stage_image_bytes(target.parent, hashlib.sha256(payload).hexdigest(), payload)
    library._publish_staged_image(staged, target, hashlib.sha256(payload).hexdigest())
    assert renames == []
    assert target.read_bytes() == before


@pytest.mark.skipif(os.name != "nt", reason="Windows rename no-clobber contract")
def test_windows_rename_fallback_existing_destination_keeps_bytes(asset_dir):
    business_id = uuid.uuid4()
    payload = _PNG + b"rename-exists"
    target = _path_for(business_id, payload)
    library.store_image(business_id, payload)
    before = target.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    staged = library._stage_image_bytes(target.parent, digest, payload)
    outcome = library._publish_via_windows_rename(staged, target, digest)
    assert outcome == "reused"
    assert target.read_bytes() == before
    assert list(target.parent.glob(".*.tmp")) == []


def test_windows_rename_no_clobber_leaves_destination_intact(asset_dir):
    """Direct NTFS evidence: os.rename does not overwrite an existing destination."""
    if os.name != "nt":
        pytest.skip("Windows rename semantics")
    business_id = uuid.uuid4()
    payload = _PNG + b"rename-contract"
    target = _path_for(business_id, payload)
    library.store_image(business_id, payload)
    before = target.read_bytes()
    staged = target.parent / f".probe.{uuid.uuid4().hex}.tmp"
    staged.write_bytes(b"not-the-original")
    with pytest.raises(FileExistsError):
        os.rename(staged, target)
    assert target.read_bytes() == before
    staged.unlink(missing_ok=True)


def test_concurrent_same_hash_uploads_keep_one_intact_object(asset_dir):
    business_id = uuid.uuid4()
    payload = _PNG + b"concurrent-hash"
    target = _path_for(business_id, payload)
    errors: list[BaseException] = []
    barrier = threading.Barrier(2)
    ready = threading.Event()

    def worker():
        try:
            barrier.wait(timeout=5)
            ready.wait(timeout=5)
            library.store_image(business_id, payload)
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for thread in threads:
        thread.start()
    ready.set()
    for thread in threads:
        thread.join(timeout=10)
    assert errors == [], errors
    assert target.is_file()
    assert target.read_bytes() == payload
    library.store_image(business_id, payload)
    assert target.read_bytes() == payload


@pytest.mark.asyncio
async def test_sealed_draft_image_survives_repeated_upload_and_injected_write_failure(
    sample, asset_dir, monkeypatch,
):
    knowledge = await source(sample, content="Atolye gorseli kaydi burada durur.")
    raw = _PNG
    stored = library.prepare_brand_library_image(raw)
    image = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Atolye gorseli", "caption": "", "public_allowed": True},
        image_bytes=raw,
    )
    image = await library.set_links(
        sample.db, sample.business.id, sample.editor.id, image.id, [knowledge.id], image.revision,
    )
    draft = await svc.create_draft(
        sample.db, sample.business.id, sample.editor.id, "Atolye gorseli", "Atolye gorseli", _steps(knowledge),
        media_choices=[[{"type": "image", "assetId": str(image.id)}]] + [[] for _ in range(7)],
        cover_asset_id=image.id,
    )
    draft = await _approve(sample, draft)
    sealed = draft.media_plan["seal"]
    target = _path_for(sample.business.id, stored)
    original = target.read_bytes()

    real_open = os.open

    def forbid_target_write(path, flags, *args, **kwargs):
        resolved = Path(path).resolve()
        writing = bool(flags & os.O_WRONLY) or bool(flags & os.O_RDWR) or bool(flags & os.O_TRUNC)
        if resolved == target.resolve() and writing:
            raise OSError("injected rewrite failure against sealed object")
        return real_open(path, flags, *args, **kwargs)

    monkeypatch.setattr(os, "open", forbid_target_write)
    again = library.store_image(sample.business.id, stored)
    assert again == image.locator
    assert target.read_bytes() == original
    twin = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Kopya", "caption": "", "public_allowed": True},
        image_bytes=raw,
    )
    assert twin.locator == image.locator
    assert target.read_bytes() == original
    await sample.db.refresh(draft)
    assert draft.media_plan["coverAssetId"] == str(image.id)
    assert draft.media_plan["seal"] == sealed
    assert sealed == media.media_seal(draft.media_plan)


@pytest.mark.asyncio
async def test_authorization_rejection_before_storage(sample, asset_dir, monkeypatch):
    from contextlib import asynccontextmanager

    raw = _png_color((10, 10, 200))
    stored = library.prepare_brand_library_image(raw)
    target = _path_for(sample.business.id, stored)
    stores: list[bytes] = []
    real_store = library.store_image

    def spy(business_id, image_bytes):
        stores.append(image_bytes)
        return real_store(business_id, image_bytes)

    monkeypatch.setattr(library, "store_image", spy)
    real_lock = media.business_media_lock

    @asynccontextmanager
    async def demote_then_lock(db, business_id):
        await assign_member_role(db, sample.business.id, sample.owner.id, sample.editor.id, "viewer")
        async with real_lock(db, business_id) as snap:
            yield snap

    import backend.services.business_yansi.studio_media as studio_mod

    monkeypatch.setattr(studio_mod, "business_media_lock", demote_then_lock)
    with pytest.raises(HTTPException) as raised:
        await library.create_asset(
            sample.db, sample.business.id, sample.editor.id,
            {"asset_type": "image", "title": "Red", "caption": "", "public_allowed": True},
            image_bytes=raw,
        )
    assert raised.value.status_code == 403
    assert stores == []
    assert not target.exists()


@pytest.mark.asyncio
async def test_db_rollback_after_store_does_not_delete_shared_hash(sample, asset_dir, monkeypatch):
    raw = _PNG
    stored = library.prepare_brand_library_image(raw)
    first = await library.create_asset(
        sample.db, sample.business.id, sample.owner.id,
        {"asset_type": "image", "title": "Ilk", "caption": "", "public_allowed": True},
        image_bytes=raw,
    )
    target = _path_for(sample.business.id, stored)
    assert target.is_file()
    real_commit = sample.db.commit

    async def boom_commit():
        raise RuntimeError("db failed after storage")

    monkeypatch.setattr(sample.db, "commit", boom_commit)
    with pytest.raises(RuntimeError):
        await library.create_asset(
            sample.db, sample.business.id, sample.editor.id,
            {"asset_type": "image", "title": "Ikinci", "caption": "", "public_allowed": True},
            image_bytes=raw,
        )
    monkeypatch.setattr(sample.db, "commit", real_commit)
    await sample.db.rollback()
    assert target.is_file()
    assert target.read_bytes() == stored
    await sample.db.refresh(first)
    assert first.locator.rsplit(".", 1)[-1] in {"png", "jpg", "webp"}
