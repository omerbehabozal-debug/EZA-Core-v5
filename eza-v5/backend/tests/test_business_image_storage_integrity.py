"""Content-addressed brand image storage: no-clobber publish and sealed-media safety.

Filesystem concurrency / fault-injection on local disk — not PostgreSQL lock proofs.
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
from backend.tests.test_business_studio_media import _approve, _steps
from backend.tests.test_business_video_cover_policy import asset_dir, sample
from backend.tests.test_business_yansi import source

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24


def _path_for(business_id, payload: bytes) -> Path:
    digest = hashlib.sha256(payload).hexdigest()
    return library.asset_root() / str(business_id) / f"{digest}.png"


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
        # Existing target must never be opened for writing.
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
    target.write_bytes(b"\x00" * 32)  # wrong bytes under the digest name
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
            Path(dst).write_bytes(payload)  # another writer published first
        return real_link(src, dst)

    monkeypatch.setattr(os, "link", win_then_link)
    locator = library.store_image(business_id, payload)
    assert locator.endswith(".png")
    assert target.read_bytes() == payload


def test_concurrent_same_hash_uploads_keep_one_intact_object(asset_dir):
    """Filesystem race: overlapping same-hash publishes must leave one intact object.

    This exercises local ``os.link`` no-clobber behavior, not PostgreSQL transactions.
    """
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
        except BaseException as exc:  # noqa: BLE001 — collect any worker failure
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for thread in threads:
        thread.start()
    # Both threads pass the barrier first, then race store_image together.
    ready.set()
    for thread in threads:
        thread.join(timeout=10)
    assert errors == [], errors
    assert target.is_file()
    assert target.read_bytes() == payload
    assert hashlib.sha256(target.read_bytes()).hexdigest() == hashlib.sha256(payload).hexdigest()
    # A follow-up store must reuse without rewriting.
    library.store_image(business_id, payload)
    assert target.read_bytes() == payload


@pytest.mark.asyncio
async def test_sealed_draft_image_survives_repeated_upload_and_injected_write_failure(
    sample, asset_dir, monkeypatch,
):
    """HIGH counterexample: sealed media must not be truncated by a rewrite attempt."""
    knowledge = await source(sample, content="Atolye gorseli kaydi burada durur.")
    payload = _PNG + b"sealed-intact"
    image = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Atolye gorseli", "caption": "", "public_allowed": True},
        image_bytes=payload,
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
    target = _path_for(sample.business.id, payload)
    original = target.read_bytes()
    assert original == payload

    real_open = os.open

    def forbid_target_write(path, flags, *args, **kwargs):
        resolved = Path(path).resolve()
        writing = bool(flags & os.O_WRONLY) or bool(flags & os.O_RDWR) or bool(flags & os.O_TRUNC)
        if resolved == target.resolve() and writing:
            raise OSError("injected rewrite failure against sealed object")
        return real_open(path, flags, *args, **kwargs)

    monkeypatch.setattr(os, "open", forbid_target_write)

    # Same-hash store must reuse without opening the sealed object for write.
    again = library.store_image(sample.business.id, payload)
    assert again == image.locator
    assert target.read_bytes() == original

    # Another Asset with the same bytes must also reuse the sealed object.
    twin = await library.create_asset(
        sample.db, sample.business.id, sample.editor.id,
        {"asset_type": "image", "title": "Kopya", "caption": "", "public_allowed": True},
        image_bytes=payload,
    )
    assert twin.locator == image.locator
    assert target.read_bytes() == original

    await sample.db.refresh(draft)
    assert draft.media_plan["coverAssetId"] == str(image.id)
    assert draft.media_plan["seal"] == sealed
    assert sealed == media.media_seal(draft.media_plan)
    preview, mime = library.read_stored_image(sample.business.id, image.locator)
    assert mime == "image/png"
    assert preview == original


@pytest.mark.asyncio
async def test_db_rollback_after_store_does_not_delete_shared_hash(sample, asset_dir, monkeypatch):
    payload = _PNG + b"rollback-keep"
    first = await library.create_asset(
        sample.db, sample.business.id, sample.owner.id,
        {"asset_type": "image", "title": "Ilk", "caption": "", "public_allowed": True},
        image_bytes=payload,
    )
    target = _path_for(sample.business.id, payload)
    assert target.is_file()

    real_commit = sample.db.commit

    async def boom_commit():
        raise RuntimeError("db failed after storage")

    # Force create_asset past auth/store then fail commit.
    monkeypatch.setattr(sample.db, "commit", boom_commit)
    with pytest.raises(RuntimeError):
        await library.create_asset(
            sample.db, sample.business.id, sample.editor.id,
            {"asset_type": "image", "title": "Ikinci", "caption": "", "public_allowed": True},
            image_bytes=payload,
        )
    monkeypatch.setattr(sample.db, "commit", real_commit)
    await sample.db.rollback()
    assert target.is_file()
    assert target.read_bytes() == payload
    await sample.db.refresh(first)
    assert first.locator.endswith(".png")
