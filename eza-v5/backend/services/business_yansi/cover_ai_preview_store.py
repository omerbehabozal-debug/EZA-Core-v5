"""Private, tenant-scoped storage for Cover AI image proposals.

A preview is not a brand asset and never receives a public URL. Bytes live on
disk under a business-scoped key; only the metadata locator is stored on the
proposal result payload.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from backend.services.profile_avatar_store import MAX_PROFILE_AVATAR_BYTES, detect_image_mime

PREVIEW_DIR_ENV = "BILIGN_COVER_AI_PREVIEW_DIR"
PREVIEW_TTL_ENV = "BILIGN_COVER_AI_PREVIEW_TTL_SECONDS"
_DEFAULT_TTL = 86_400
_MAX_TTL = 7 * 86_400
_META_NAME = "meta.json"
_BYTES_NAME = "image.bin"
_UUID = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def preview_root() -> Path:
    configured = (os.getenv(PREVIEW_DIR_ENV) or "").strip()
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[2] / "data" / "cover_ai_previews"


def preview_ttl_seconds() -> int:
    raw = (os.getenv(PREVIEW_TTL_ENV) or "").strip()
    try:
        value = int(raw) if raw else _DEFAULT_TTL
    except ValueError:
        value = _DEFAULT_TTL
    if value < 60:
        return 60
    if value > _MAX_TTL:
        return _MAX_TTL
    return value


def _now() -> datetime:
    return datetime.now(timezone.utc)


def preview_key(business_id, proposal_id) -> str:
    return f"cover-ai-preview/{business_id}/{proposal_id}"


def _directory(business_id, proposal_id) -> Path:
    return preview_root() / str(business_id) / str(proposal_id)


def _parse_expires(raw) -> datetime | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        stamp = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp


def _is_uuid_name(name: str) -> bool:
    return bool(isinstance(name, str) and _UUID.fullmatch(name))


def _contained_under(root: Path, candidate: Path) -> bool:
    """True when candidate resolves inside root without leaving via symlink."""
    try:
        root_real = root.resolve(strict=False)
        # Do not follow the candidate itself if it is a symlink escape; resolve parents.
        if candidate.is_symlink():
            return False
        cand_real = candidate.resolve(strict=False)
        return os.path.commonpath([os.fspath(root_real), os.fspath(cand_real)]) == os.fspath(root_real)
    except (OSError, ValueError):
        return False


def validate_generated_image(image_bytes: bytes, *, expected_size: str | None = None) -> dict:
    """Validate MIME, size, and optional dimensions. Reject remote URLs entirely."""
    from backend.services.business_yansi.service import fail

    if not isinstance(image_bytes, (bytes, bytearray)) or not image_bytes:
        fail("cover_ai_preview_rejected", 422)
    blob = bytes(image_bytes)
    if len(blob) > MAX_PROFILE_AVATAR_BYTES:
        fail("cover_ai_preview_rejected", 422)
    mime = detect_image_mime(blob)
    if mime not in {"image/png", "image/jpeg", "image/webp"}:
        fail("cover_ai_preview_rejected", 422)
    width = height = None
    try:
        from PIL import Image, UnidentifiedImageError
        from PIL.Image import DecompressionBombError

        with Image.open(__import__("io").BytesIO(blob)) as image:
            image.load()
            width, height = image.size
    except (UnidentifiedImageError, DecompressionBombError, OSError, ValueError):
        fail("cover_ai_preview_rejected", 422)
    if type(width) is not int or type(height) is not int or width < 64 or height < 64:
        fail("cover_ai_preview_rejected", 422)
    if width > 4096 or height > 4096:
        fail("cover_ai_preview_rejected", 422)
    if isinstance(expected_size, str) and expected_size and "x" not in expected_size.lower():
        fail("cover_ai_preview_rejected", 422)
    return {
        "mimeType": mime,
        "byteLength": len(blob),
        "width": width,
        "height": height,
        "sha256": hashlib.sha256(blob).hexdigest(),
    }


def store_preview(business_id, proposal_id, image_bytes: bytes, *, expected_size: str | None = None) -> dict:
    """Persist private preview bytes. Returns JSON-safe metadata for the proposal."""
    from backend.services.business_yansi.service import fail, uid

    business = str(uid(business_id))
    proposal = str(uid(proposal_id))
    meta = validate_generated_image(image_bytes, expected_size=expected_size)
    expires = _now() + timedelta(seconds=preview_ttl_seconds())
    directory = _directory(business, proposal)
    try:
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / _BYTES_NAME
        staged = directory / f".{uuid.uuid4().hex}.tmp"
        staged.write_bytes(bytes(image_bytes))
        os.replace(staged, target)
        payload = {
            "previewKey": preview_key(business, proposal),
            "sha256": meta["sha256"],
            "mimeType": meta["mimeType"],
            "byteLength": meta["byteLength"],
            "width": meta["width"],
            "height": meta["height"],
            "expiresAt": expires.isoformat().replace("+00:00", "Z"),
        }
        (directory / _META_NAME).write_text(json.dumps(payload, sort_keys=True), encoding="utf-8")
        return payload
    except OSError:
        fail("cover_ai_preview_store_failed", 500)


def read_preview_meta(business_id, proposal_id) -> dict | None:
    from backend.services.business_yansi.service import uid

    path = _directory(str(uid(business_id)), str(uid(proposal_id))) / _META_NAME
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeError):
        return None
    return data if isinstance(data, dict) else None


def preview_expired(meta: dict | None) -> bool:
    if not isinstance(meta, dict):
        return True
    expires = _parse_expires(meta.get("expiresAt"))
    if expires is None:
        return True
    return expires <= _now()


def read_preview_bytes(business_id, proposal_id, *, expected_sha256: str | None = None) -> tuple[bytes, dict]:
    """Load private bytes for the owning business. Never follows remote URLs."""
    from backend.services.business_yansi.service import fail, uid

    business = str(uid(business_id))
    proposal = str(uid(proposal_id))
    directory = _directory(business, proposal)
    meta = read_preview_meta(business, proposal)
    if meta is None or preview_expired(meta):
        fail("cover_ai_preview_expired", 410)
    path = directory / _BYTES_NAME
    try:
        blob = path.read_bytes()
    except OSError:
        fail("cover_ai_preview_missing", 404)
    checked = validate_generated_image(blob)
    if checked["sha256"] != meta.get("sha256"):
        fail("cover_ai_preview_corrupt", 409)
    if expected_sha256 and checked["sha256"] != expected_sha256:
        fail("cover_ai_preview_corrupt", 409)
    return blob, meta


def delete_preview(business_id, proposal_id) -> None:
    from backend.services.business_yansi.service import uid

    root = preview_root()
    directory = _directory(str(uid(business_id)), str(uid(proposal_id)))
    if not directory.is_dir() or directory.is_symlink():
        return
    if not _contained_under(root, directory):
        return
    if not _is_uuid_name(directory.name) or not _is_uuid_name(directory.parent.name):
        return
    shutil.rmtree(directory, ignore_errors=True)


def _store_owned_meta(business_id: str, proposal_id: str, proposal_dir: Path) -> dict | None:
    """Return meta only when files match the store layout this module writes.

    UUID path shape and an expiresAt field alone are not ownership proof.
    """
    if proposal_dir.is_symlink() or not proposal_dir.is_dir():
        return None
    if not _is_uuid_name(business_id) or not _is_uuid_name(proposal_id):
        return None
    meta_path = proposal_dir / _META_NAME
    bytes_path = proposal_dir / _BYTES_NAME
    if meta_path.is_symlink() or bytes_path.is_symlink():
        return None
    if not meta_path.is_file() or not bytes_path.is_file():
        return None
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        blob = bytes_path.read_bytes()
    except (OSError, json.JSONDecodeError, UnicodeError):
        return None
    if not isinstance(meta, dict):
        return None
    expected_key = preview_key(business_id, proposal_id)
    if meta.get("previewKey") != expected_key:
        return None
    sha = meta.get("sha256")
    mime = meta.get("mimeType")
    if not isinstance(sha, str) or len(sha) != 64:
        return None
    if mime not in {"image/png", "image/jpeg", "image/webp"}:
        return None
    if type(meta.get("byteLength")) is not int or meta.get("byteLength") != len(blob):
        return None
    if hashlib.sha256(blob).hexdigest() != sha:
        return None
    if detect_image_mime(blob) != mime:
        return None
    if _parse_expires(meta.get("expiresAt")) is None:
        return None
    return meta


async def _proposal_owns_preview(db, business_id: str, proposal_id: str, meta: dict) -> bool:
    """True only when a Cover AI proposal row claims this exact preview object."""
    from backend.models.business_cover_ai import BusinessCoverAiProposal as Proposal
    from backend.services.business_yansi.service import uid

    try:
        business_key = uid(business_id)
        proposal_key = uid(proposal_id)
    except Exception:
        return False
    row = await db.get(Proposal, proposal_key)
    if row is None or row.business_id != business_key or row.kind != "image_cover":
        return False
    result = row.result_payload if isinstance(row.result_payload, dict) else {}
    if result.get("previewKey") != meta.get("previewKey"):
        return False
    if result.get("sha256") != meta.get("sha256"):
        return False
    return True


async def cleanup_expired_previews(db, *, limit: int = 200) -> int:
    """Remove expired previews only when store files and proposal ownership agree.

    Foreign UUID-shaped directories, orphaned/corrupt layouts, and unrelated
    sentinel files are left untouched. Symlinks never escape the preview root.
    """
    root = preview_root()
    if not root.is_dir() or root.is_symlink():
        return 0
    removed = 0
    now = _now()
    try:
        businesses = list(root.iterdir())
    except OSError:
        return 0
    for business_dir in businesses:
        if removed >= limit:
            break
        if business_dir.is_symlink() or not business_dir.is_dir():
            continue
        if not _is_uuid_name(business_dir.name):
            continue
        if not _contained_under(root, business_dir):
            continue
        try:
            proposals = list(business_dir.iterdir())
        except OSError:
            continue
        for proposal_dir in proposals:
            if removed >= limit:
                break
            if proposal_dir.is_symlink() or not proposal_dir.is_dir():
                continue
            if not _contained_under(root, proposal_dir):
                continue
            meta = _store_owned_meta(business_dir.name, proposal_dir.name, proposal_dir)
            if meta is None:
                continue
            stamp = _parse_expires(meta.get("expiresAt"))
            if stamp is None or stamp > now:
                continue
            if not await _proposal_owns_preview(db, business_dir.name, proposal_dir.name, meta):
                continue
            shutil.rmtree(proposal_dir, ignore_errors=True)
            removed += 1
    return removed
