"""Studio library for brand assets. Does not answer questions or publish a Yansı."""
from __future__ import annotations

import hashlib
import os
import uuid
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from backend.models.business_brand_assets import BusinessBrandAsset as Asset, BusinessKnowledgeAssetLink as Link
from backend.models.business_yansi import BusinessKnowledgeVersion as Knowledge
from backend.services.business_yansi.brand_assets import normalize_asset, public_media_allowed
from backend.services.business_yansi.service import access, fail, uid
from backend.services.profile_avatar_store import detect_image_mime


# Content-library upload ceiling (raw bytes before normalize). Profile avatars stay on
# MAX_PROFILE_AVATAR_BYTES and must not import this constant.
MAX_BRAND_LIBRARY_IMAGE_BYTES = 15 * 1024 * 1024
_MAX_LIBRARY_EDGE = 4096
_MAX_LIBRARY_PIXELS = 36_000_000
_LIBRARY_JPEG_QUALITY = 85

_MIME_EXT = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}


def asset_root() -> Path:
    configured = (os.getenv("EZA_BRAND_ASSET_DIR") or "").strip()
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[2] / "data" / "brand_assets"


def _locator_for(business_id, digest: str, extension: str) -> str:
    return f"brand-assets/{business_id}/{digest}.{extension}"


def prepare_brand_library_image(image_bytes: bytes) -> bytes:
    """Validate, strip EXIF, bound dimensions, and re-encode for durable library storage.

    Accepts up to ``MAX_BRAND_LIBRARY_IMAGE_BYTES`` of raw input. Returned bytes are
    what content-addressed storage hashes; the original upload is not retained.
    Does not touch the profile-avatar pipeline.
    """
    from io import BytesIO

    from PIL import Image, ImageOps, UnidentifiedImageError
    from PIL.Image import DecompressionBombError

    if not image_bytes:
        fail("asset_file_empty", 400)
    if len(image_bytes) > MAX_BRAND_LIBRARY_IMAGE_BYTES:
        fail("asset_file_too_large", 400)
    mime = detect_image_mime(image_bytes)
    if mime not in _MIME_EXT:
        fail("asset_file_rejected", 400)
    try:
        with Image.open(BytesIO(image_bytes)) as raw:
            width, height = raw.size
            if width < 1 or height < 1 or width * height > _MAX_LIBRARY_PIXELS:
                fail("asset_file_rejected", 400)
            raw.load()
            image = ImageOps.exif_transpose(raw)
            if image.mode not in ("RGB", "RGBA"):
                has_alpha = image.mode in ("RGBA", "LA") or (
                    image.mode == "P" and "transparency" in image.info
                )
                image = image.convert("RGBA" if has_alpha else "RGB")
            if max(image.size) > _MAX_LIBRARY_EDGE:
                image.thumbnail((_MAX_LIBRARY_EDGE, _MAX_LIBRARY_EDGE), Image.Resampling.LANCZOS)
            out = BytesIO()
            if image.mode == "RGBA":
                image.save(out, format="PNG", optimize=True)
            else:
                if image.mode != "RGB":
                    image = image.convert("RGB")
                image.save(out, format="JPEG", quality=_LIBRARY_JPEG_QUALITY, optimize=True)
            prepared = out.getvalue()
    except (UnidentifiedImageError, DecompressionBombError, OSError, ValueError):
        fail("asset_file_rejected", 400)
    if not prepared or len(prepared) > MAX_BRAND_LIBRARY_IMAGE_BYTES:
        fail("asset_file_too_large", 400)
    if detect_image_mime(prepared) not in _MIME_EXT:
        fail("asset_file_rejected", 400)
    return prepared


def image_locator(business_id, image_bytes: bytes) -> str:
    """Validate image bytes and return the storage key. Does not write the file."""
    if not image_bytes:
        fail("asset_file_empty", 400)
    if len(image_bytes) > MAX_BRAND_LIBRARY_IMAGE_BYTES:
        fail("asset_file_too_large", 400)
    mime = detect_image_mime(image_bytes)
    if mime not in _MIME_EXT:
        fail("asset_file_rejected", 400)
    business = str(uid(business_id))
    digest = hashlib.sha256(image_bytes).hexdigest()
    return _locator_for(business, digest, _MIME_EXT[mime])


def _content_digest(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()


def _normalize_fs_path_key(path: Path | str) -> str:
    """Normalize a filesystem path for containment checks.

    Recognizes equivalent ordinary and extended-length Win32 paths:
    ``C:\\...`` ↔ ``\\\\?\\C:\\...`` and ``\\\\server\\share`` ↔ ``\\\\?\\UNC\\server\\share``.
    Device paths under ``\\\\.\\`` / non-drive ``\\\\?\\`` namespaces are left intact so
    they do not silently coerce into ordinary filesystem roots.
    """
    key = os.path.normcase(os.path.abspath(os.fspath(path)))
    if key.startswith("\\\\?\\unc\\"):
        return "\\\\" + key[8:]
    if key.startswith("\\\\?\\"):
        rest = key[4:]
        # Drive-letter absolute path: \\?\C:\...
        if len(rest) >= 2 and rest[1] == ":":
            return rest
        # \\?\Volume{...}\, \\?\HarddiskVolume*, etc. — not ordinary FS roots.
        return key
    # \\.\ device namespace must not be rewritten into ordinary paths.
    return key


def _path_is_within(root: Path, candidate: Path) -> bool:
    """True when ``candidate`` is ``root`` or a descendant on the same volume/share."""
    root_key = _normalize_fs_path_key(root)
    candidate_key = _normalize_fs_path_key(candidate)
    try:
        return os.path.commonpath([root_key, candidate_key]) == root_key
    except ValueError:
        return False


def _verify_hash_file(target: Path, expected_digest: str) -> bytes:
    """Read an existing content-addressed object and require an intact SHA-256 match.

    Existence alone is not integrity. A corrupt or truncated object fails closed
    without repair, replacement, or deletion.
    """
    try:
        payload = target.read_bytes()
    except OSError:
        fail("asset_file_unavailable", 404)
    if not payload or len(payload) > MAX_BRAND_LIBRARY_IMAGE_BYTES:
        fail("asset_file_corrupt", 409)
    if _content_digest(payload) != expected_digest:
        fail("asset_file_corrupt", 409)
    mime = detect_image_mime(payload)
    if mime not in _MIME_EXT:
        fail("asset_file_corrupt", 409)
    return payload


def _stage_image_bytes(directory: Path, digest: str, image_bytes: bytes) -> Path:
    """Write and fsync complete bytes to a unique temp file in ``directory``."""
    staged = directory / f".{digest}.{uuid.uuid4().hex}.tmp"
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_BINARY"):
        flags |= os.O_BINARY
    fd = os.open(staged, flags, 0o644)
    try:
        view = memoryview(image_bytes)
        while view:
            written = os.write(fd, view)
            view = view[written:]
        os.fsync(fd)
    except Exception:
        try:
            os.close(fd)
        finally:
            staged.unlink(missing_ok=True)
        raise
    else:
        os.close(fd)
    try:
        verified = _verify_hash_file(staged, digest)
        if verified != image_bytes:
            fail("asset_file_corrupt", 409)
    except Exception:
        staged.unlink(missing_ok=True)
        raise
    return staged


def _publish_via_windows_rename(staged: Path, target: Path, expected_digest: str) -> str:
    """Windows-only no-clobber publish when ``os.link`` cannot create a new name.

    On Windows, ``os.rename(src, dst)`` raises ``FileExistsError`` when ``dst``
    already exists and leaves the destination bytes intact (verified on NTFS).
    ``os.replace`` overwrites and must not be used. POSIX ``os.rename`` can
    clobber and is never used here.
    """
    try:
        os.rename(staged, target)
        return "renamed"
    except FileExistsError:
        _verify_hash_file(target, expected_digest)
        try:
            staged.unlink(missing_ok=True)
        except OSError:
            pass
        return "reused"
    except OSError:
        if target.is_file():
            _verify_hash_file(target, expected_digest)
            try:
                staged.unlink(missing_ok=True)
            except OSError:
                pass
            return "reused"
        fail("asset_storage_unavailable", 500)


def _publish_staged_image(staged: Path, target: Path, expected_digest: str) -> None:
    """Atomically publish a staged object with no-clobber semantics.

    Primary path: ``os.link`` (POSIX and Windows when permitted). An existing
    destination is never replaced. When ``os.link`` fails on Windows because the
    destination is absent (for example WinError 5 in a restricted sandbox), a
    Windows-only ``os.rename`` fallback is used — it fails closed if the
    destination already exists. POSIX keeps link-only fail-closed behavior.

    Durability notes: staged content is fsync'd before publish. Directory entry
    durability after publish is filesystem/platform dependent and is not claimed
    beyond process-local visibility of the new name.
    """
    outcome = "linked"
    try:
        try:
            os.link(staged, target)
        except FileExistsError:
            _verify_hash_file(target, expected_digest)
            outcome = "reused"
        except OSError:
            # Another writer may have published first; never overwrite.
            if target.is_file():
                _verify_hash_file(target, expected_digest)
                outcome = "reused"
            elif os.name == "nt":
                outcome = _publish_via_windows_rename(staged, target, expected_digest)
            else:
                fail("asset_storage_unavailable", 500)
    finally:
        # After a successful rename the staged path is already the target name.
        if outcome != "renamed":
            try:
                staged.unlink(missing_ok=True)
            except OSError:
                pass


def store_image(business_id, image_bytes: bytes) -> str:
    """Persist original image bytes under a content-addressed SHA-256 key.

    Existing valid objects are reused without opening them for writing.
    New objects stage to a temp file, verify, then publish via atomic no-clobber
    ``os.link`` (Windows may fall back to no-clobber ``os.rename`` when link is
    denied and the destination is absent). Shared / sealed content is never
    truncated, overwritten, or deleted.
    """
    locator = image_locator(business_id, image_bytes)
    business = str(uid(business_id))
    name = locator.rsplit("/", 1)[-1]
    digest = _content_digest(image_bytes)
    if not name.startswith(f"{digest}."):
        fail("asset_file_rejected", 400)
    root = asset_root().resolve()
    target = (root / business / name)
    # Create the tenant directory before resolving so concurrent Windows resolves
    # agree on the same absolute path shape.
    target.parent.mkdir(parents=True, exist_ok=True)
    target = target.resolve()
    if not _path_is_within(root, target):
        fail("asset_file_rejected", 400)
    if target.is_file():
        _verify_hash_file(target, digest)
        return locator
    staged = _stage_image_bytes(target.parent, digest, image_bytes)
    _publish_staged_image(staged, target, digest)
    return locator


def read_stored_image(business_id, locator: str) -> tuple[bytes, str]:
    """Read one stored image for an authenticated Studio preview. The locator is not a public URL."""
    business = str(uid(business_id))
    normalized = normalize_asset(
        business_id=business,
        asset_type="image",
        title="Önizleme",
        locator_kind="storage",
        locator=locator,
    )
    name = normalized["locator"].rsplit("/", 1)[-1]
    root = asset_root().resolve()
    target = (root / business / name).resolve()
    if root != target and root not in target.parents:
        fail("asset_file_unavailable", 404)
    if not target.is_file():
        fail("asset_file_unavailable", 404)
    ext = name.rsplit(".", 1)[-1]
    mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}.get(ext)
    if mime is None:
        fail("asset_file_unavailable", 404)
    return target.read_bytes(), mime


def _decimal(value):
    if value is None:
        return None
    return format(Decimal(value), "f")


def present_asset(asset, links):
    """Management view. Storage keys stay on the server."""
    remote = asset.locator if asset.locator_kind == "https" else None
    return {
        "id": str(asset.id),
        "business_id": str(asset.business_id),
        "asset_type": asset.asset_type,
        "title": asset.title,
        "caption": asset.caption or "",
        "locator_kind": asset.locator_kind,
        "locator": remote,
        "latitude": _decimal(asset.latitude),
        "longitude": _decimal(asset.longitude),
        "public_allowed": bool(asset.public_allowed),
        "status": asset.status,
        "revision": asset.revision,
        "approved_by": str(asset.approved_by) if asset.approved_by else None,
        "links": links,
    }


@dataclass(frozen=True, slots=True)
class AssetDecisionSnapshot:
    """Authoritative Asset columns for writer decisions.

    Built from a projected SELECT under ``no_autoflush``. Never written back onto
    identity-map instances via ``populate_existing`` / ``set_committed_value``.
    """

    id: object
    business_id: object
    status: str
    revision: int
    public_allowed: bool
    approved_by: object
    asset_type: str
    source_asset_id: object
    locator: object
    locator_kind: object
    verified_duration: object
    verified_timescale: object
    verified_size_bytes: object
    verified_has_audio: object
    title: str
    caption: object
    latitude: object
    longitude: object


@dataclass(frozen=True, slots=True)
class KnowledgeDecisionSnapshot:
    """Authoritative Knowledge columns for ``set_links`` eligibility."""

    id: object
    business_id: object
    item_id: object
    status: str
    public_allowed: bool


async def _asset_decision(db, business_id, asset_id, *, lock: bool = False) -> AssetDecisionSnapshot:
    """Read Asset decision columns from the database without mutating the identity map."""
    criteria = (Asset.id == uid(asset_id), Asset.business_id == uid(business_id))
    query = select(
        Asset.id,
        Asset.business_id,
        Asset.status,
        Asset.revision,
        Asset.public_allowed,
        Asset.approved_by,
        Asset.asset_type,
        Asset.source_asset_id,
        Asset.locator,
        Asset.locator_kind,
        Asset.verified_duration,
        Asset.verified_timescale,
        Asset.verified_size_bytes,
        Asset.verified_has_audio,
        Asset.title,
        Asset.caption,
        Asset.latitude,
        Asset.longitude,
    ).where(*criteria)
    if lock:
        query = query.with_for_update()
    with db.no_autoflush:
        current = await db.execute(query)
        locked = current.one_or_none()
    if locked is None:
        fail("asset_not_found", 404)
    return AssetDecisionSnapshot(
        id=locked.id,
        business_id=locked.business_id,
        status=str(locked.status),
        revision=int(locked.revision),
        public_allowed=bool(locked.public_allowed),
        approved_by=locked.approved_by,
        asset_type=str(locked.asset_type),
        source_asset_id=locked.source_asset_id,
        locator=locked.locator,
        locator_kind=locked.locator_kind,
        verified_duration=locked.verified_duration,
        verified_timescale=locked.verified_timescale,
        verified_size_bytes=locked.verified_size_bytes,
        verified_has_audio=locked.verified_has_audio,
        title=str(locked.title),
        caption=locked.caption,
        latitude=locked.latitude,
        longitude=locked.longitude,
    )


async def _asset_row(db, business_id, asset_id, lock=False):
    """Return the Asset ORM instance. Locked path uses a decision snapshot, not refresh."""
    if not lock:
        row = await db.scalar(
            select(Asset).where(Asset.id == uid(asset_id), Asset.business_id == uid(business_id))
        )
        if not row:
            fail("asset_not_found", 404)
        return row
    snap = await _asset_decision(db, business_id, asset_id, lock=True)
    row = await db.get(Asset, snap.id)
    if row is None:
        fail("asset_not_found", 404)
    return row


async def _knowledge_decision_for_link(db, business_id, version_id) -> KnowledgeDecisionSnapshot:
    """Authoritative Knowledge eligibility for set_links. Does not trust the identity map."""
    with db.no_autoflush:
        current = await db.execute(
            select(
                Knowledge.id,
                Knowledge.business_id,
                Knowledge.item_id,
                Knowledge.status,
                Knowledge.public_allowed,
            ).where(
                Knowledge.id == uid(version_id),
                Knowledge.business_id == uid(business_id),
            )
        )
        locked = current.one_or_none()
    if (
        locked is None
        or str(locked.status) != "published"
        or not bool(locked.public_allowed)
    ):
        fail("published_knowledge_required", 422)
    return KnowledgeDecisionSnapshot(
        id=locked.id,
        business_id=locked.business_id,
        item_id=locked.item_id,
        status=str(locked.status),
        public_allowed=bool(locked.public_allowed),
    )


def _same_coord(left, right) -> bool:
    if left is None or right is None:
        return left is None and right is None
    return Decimal(str(left)).quantize(Decimal("0.000001")) == Decimal(str(right)).quantize(Decimal("0.000001"))


def content_fields_changed(row, fields) -> bool:
    """True when the published bytes, URL, or map position would change.

    Title and caption stay editable. A new file, URL, or coordinate needs a new asset id
    once a sealed draft or publication still shows this one.
    """
    if row.asset_type == "place":
        return not _same_coord(row.latitude, fields.get("latitude")) or not _same_coord(row.longitude, fields.get("longitude"))
    return (fields.get("locator") or None) != (row.locator or None)


def _apply_fields(row, fields, user_id, public_allowed):
    row.asset_type = fields["asset_type"]
    row.title = fields["title"]
    row.caption = fields["caption"]
    row.locator_kind = fields["locator_kind"]
    row.locator = fields["locator"]
    row.latitude = fields["latitude"]
    row.longitude = fields["longitude"]
    row.public_allowed = bool(public_allowed)
    row.status = "published"
    row.approved_by = uid(user_id)


async def list_assets(db, business_id, user_id):
    await access(db, business_id, user_id, "viewer")
    return await listed_assets(db, business_id)


async def listed_assets(db, business_id):
    business = uid(business_id)
    assets = list((await db.scalars(select(Asset).where(Asset.business_id == business).order_by(Asset.created_at.desc()))).all())
    links = list((await db.scalars(select(Link).where(Link.business_id == business))).all())
    item_ids = {row.item_id for row in links}
    versions = []
    if item_ids:
        versions = list((await db.scalars(select(Knowledge).where(Knowledge.business_id == business, Knowledge.item_id.in_(item_ids)))).all())
    by_id = {row.id: row for row in versions}
    current = {}
    for row in versions:
        if row.status != "published":
            continue
        previous = current.get(row.item_id)
        if previous is None or row.version > previous.version:
            current[row.item_id] = row
    grouped = {asset.id: [] for asset in assets}
    for link in links:
        confirmed = by_id.get(link.confirmed_version_id)
        live = current.get(link.item_id)
        grouped.setdefault(link.asset_id, []).append({
            "id": str(link.id),
            "item_id": str(link.item_id),
            "confirmed_version_id": str(link.confirmed_version_id),
            "status": link.status,
            "knowledge_title": confirmed.title if confirmed else (live.title if live else ""),
            "knowledge_status": confirmed.status if confirmed else None,
            "current_published_version_id": str(live.id) if live else None,
            "confirmation_current": bool(
                link.status == "active" and live is not None and live.id == link.confirmed_version_id
            ),
        })
    return [present_asset(asset, grouped.get(asset.id, [])) for asset in assets]


async def create_asset(db, business_id, user_id, data, *, image_bytes=None):
    await access(db, business_id, user_id, "editor")
    asset_type = data["asset_type"]
    pending_image = None
    if asset_type == "image":
        # Normalize before hashing so durable keys match served bytes.
        pending_image = prepare_brand_library_image(image_bytes or b"")
        locator = image_locator(business_id, pending_image)
        fields = normalize_asset(
            business_id=business_id,
            asset_type="image",
            title=data["title"],
            caption=data.get("caption") or None,
            locator_kind="storage",
            locator=locator,
        )
    elif asset_type == "video":
        fields = normalize_asset(
            business_id=business_id,
            asset_type="video",
            title=data["title"],
            caption=data.get("caption") or None,
            locator_kind="https",
            locator=data.get("locator"),
        )
    else:
        fields = normalize_asset(
            business_id=business_id,
            asset_type=asset_type,
            title=data["title"],
            caption=data.get("caption") or None,
            locator=data.get("locator"),
            locator_kind=data.get("locator_kind"),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
        )
    from backend.services.business_yansi.studio_media import business_media_lock
    from backend.services.business_yansi.video_authority import require_locked_actor

    # Business → require_locked_actor → durable image write (if any) → insert.
    # Content-addressed store is idempotent; auth failure never writes a new file.
    async with business_media_lock(db, business_id):
        await require_locked_actor(db, business_id, user_id, "editor")
        if pending_image is not None:
            store_image(business_id, pending_image)
        row = Asset(business_id=uid(business_id), created_by=uid(user_id), revision=1)
        _apply_fields(row, fields, user_id, data.get("public_allowed", False))
        db.add(row)
        await db.flush()
        from sqlalchemy.exc import OperationalError, ProgrammingError
        try:
            from backend.services.business_yansi.media_observations import ensure_observation
            await ensure_observation(db, row, user_id)
        except (OperationalError, ProgrammingError):
            pass
        await db.commit()
        await db.refresh(row)
        return row


async def update_asset(db, business_id, user_id, asset_id, data, *, image_bytes=None):
    await access(db, business_id, user_id, "editor")
    from backend.services.business_yansi.studio_media import business_media_lock, sealed_content_uses_asset
    from backend.services.business_yansi.video_authority import require_locked_actor

    # Business → actor reauth → Asset decision snapshot → mutate. Approval/publish share first lock.
    async with business_media_lock(db, business_id):
        await require_locked_actor(db, business_id, user_id, "editor")
        snap = await _asset_decision(db, business_id, asset_id, lock=True)
        if snap.revision != data["revision"]:
            fail("revision_conflict", 409)
        if snap.status == "archived":
            fail("archived_asset", 409)
        row = await db.get(Asset, snap.id)
        if row is None:
            fail("asset_not_found", 404)
        locator = snap.locator
        kind = snap.locator_kind
        pending_image = None
        if snap.asset_type == "image" and image_bytes:
            pending_image = prepare_brand_library_image(image_bytes)
            locator = image_locator(business_id, pending_image)
            kind = "storage"
        elif snap.asset_type in {"video", "link"} and data.get("locator"):
            locator = data["locator"]
            kind = "https"
        fields = normalize_asset(
            business_id=business_id,
            asset_type=snap.asset_type,
            title=data["title"],
            caption=data.get("caption") or None,
            locator=locator,
            locator_kind=kind,
            latitude=data.get("latitude", snap.latitude),
            longitude=data.get("longitude", snap.longitude),
        )
        measurements_stale = snap.asset_type == "video" and (
            (fields.get("locator") or None) != (snap.locator or None)
            or fields.get("locator_kind") != snap.locator_kind
        )
        if content_fields_changed(snap, fields):
            if await sealed_content_uses_asset(db, business_id, snap.id):
                fail("sealed_media_immutable", 409)
            if pending_image is not None:
                store_image(business_id, pending_image)
        _apply_fields(row, fields, user_id, data.get("public_allowed", False))
        if measurements_stale:
            row.verified_duration = None
            row.verified_timescale = None
            row.verified_size_bytes = None
            row.verified_has_audio = None
        row.revision = snap.revision + 1
        await db.commit()
        await db.refresh(row)
        return row


async def archive_asset(db, business_id, user_id, asset_id, revision):
    await access(db, business_id, user_id, "editor")
    from backend.services.business_yansi.studio_media import business_media_lock
    from backend.services.business_yansi.video_authority import require_locked_actor

    # Business → actor reauth → Asset decision snapshot → mutate.
    async with business_media_lock(db, business_id):
        await require_locked_actor(db, business_id, user_id, "editor")
        snap = await _asset_decision(db, business_id, asset_id, lock=True)
        if snap.revision != revision:
            fail("revision_conflict", 409)
        row = await db.get(Asset, snap.id)
        if row is None:
            fail("asset_not_found", 404)
        row.status = "archived"
        row.public_allowed = False
        row.revision = snap.revision + 1
        await db.commit()
        await db.refresh(row)
        return row


async def set_links(db, business_id, user_id, asset_id, version_ids, revision):
    """Replace this asset's confirmations with the versions the editor named.

    A new knowledge version is not added here unless its id is in version_ids.
    """
    await access(db, business_id, user_id, "editor")
    from backend.services.business_yansi.studio_media import business_media_lock
    from backend.services.business_yansi.video_authority import require_locked_actor

    # Business → actor reauth → Asset decision → authoritative Knowledge → Links.
    async with business_media_lock(db, business_id):
        await require_locked_actor(db, business_id, user_id, "editor")
        snap = await _asset_decision(db, business_id, asset_id, lock=True)
        if snap.revision != revision:
            fail("revision_conflict", 409)
        if snap.status == "archived":
            fail("archived_asset", 409)
        asset = await db.get(Asset, snap.id)
        if asset is None:
            fail("asset_not_found", 404)
        wanted = []
        seen_items = set()
        for version_id in version_ids:
            knowledge = await _knowledge_decision_for_link(db, snap.business_id, version_id)
            if knowledge.item_id in seen_items:
                fail("duplicate_knowledge_item", 422)
            seen_items.add(knowledge.item_id)
            wanted.append(knowledge)
        with db.no_autoflush:
            existing = list(
                (
                    await db.scalars(
                        select(Link)
                        .where(Link.asset_id == snap.id, Link.business_id == snap.business_id)
                        .with_for_update()
                    )
                ).all()
            )
        by_item = {row.item_id: row for row in existing}
        for knowledge in wanted:
            link = by_item.get(knowledge.item_id)
            if link is None:
                db.add(Link(
                    business_id=snap.business_id,
                    asset_id=snap.id,
                    item_id=knowledge.item_id,
                    confirmed_version_id=knowledge.id,
                    status="active",
                ))
            else:
                link.confirmed_version_id = knowledge.id
                link.status = "active"
                link.item_id = knowledge.item_id
        wanted_items = {row.item_id for row in wanted}
        for link in existing:
            if link.item_id not in wanted_items:
                link.status = "retired"
        asset.revision = snap.revision + 1
        await db.commit()
        await db.refresh(asset)
        return asset


async def stored_preview(db, business_id, user_id, asset_id):
    await access(db, business_id, user_id, "viewer")
    row = await _asset_row(db, business_id, asset_id)
    if row.locator_kind != "storage" or not row.locator:
        fail("asset_file_unavailable", 404)
    return read_stored_image(row.business_id, row.locator)


def asset_is_public(asset, link, knowledge, profile, organization):
    """Live gate for a later Yansı or chat. Studio storage does not bypass it."""
    return public_media_allowed(asset=asset, link=link, knowledge=knowledge, profile=profile, organization=organization)
