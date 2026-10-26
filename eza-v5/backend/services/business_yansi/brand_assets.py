"""Validate brand assets and decide whether one may appear in public Yansı or chat.

This module does not answer questions, create drafts, or store files.
Public use requires a live asset, an active confirmation, and the knowledge
version that confirmation names. A newer knowledge version stays unmatched
until an editor confirms it. Closing public access or archiving the asset
hides it without deleting the row.
"""
from __future__ import annotations

import ipaddress
import re
import uuid
from decimal import Decimal, InvalidOperation
from urllib.parse import urlsplit

from backend.services.business_yansi.service import fail, public_content


ASSET_TYPES = frozenset({"image", "video", "place", "link"})
IMAGE_EXTENSIONS = frozenset({"png", "jpg", "jpeg", "webp", "gif"})
VIDEO_EXTENSIONS = frozenset({"mp4", "webm"})
_STORAGE = re.compile(
    r"^brand-assets/(?P<business>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/"
    r"[0-9a-f]{64}\.(?P<ext>png|jpe?g|webp|gif|mp4|webm)$"
)
_BLOCKED_HOSTS = frozenset({"localhost", "metadata.google.internal"})


def _uuid(value):
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        fail("invalid_id", 422)


def _extension(path):
    name = path.rsplit("/", 1)[-1]
    if "." not in name:
        return ""
    return name.rsplit(".", 1)[-1].lower()


def validate_https_url(value):
    """Accept one public https URL. Rejects credentials, private hosts, and other schemes."""
    if not isinstance(value, str) or not value or len(value) > 1000 or any(ord(ch) < 33 or ord(ch) == 127 for ch in value):
        fail("asset_url_rejected", 422)
    if "\\" in value or value.lower().startswith(("javascript:", "data:", "blob:", "file:", "http:")):
        fail("asset_url_rejected", 422)
    parts = urlsplit(value)
    host = (parts.hostname or "").rstrip(".").lower()
    if (
        parts.scheme != "https"
        or parts.username
        or parts.password
        or not host
        or parts.fragment
        or (parts.port not in (None, 443))
        or host in _BLOCKED_HOSTS
        or host.endswith(".local")
        or host.endswith(".localhost")
    ):
        fail("asset_url_rejected", 422)
    try:
        host.encode("idna")
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    except UnicodeError:
        fail("asset_url_rejected", 422)
        return value
    if ip is not None and (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    ):
        fail("asset_url_rejected", 422)
    return value


def _storage_locator(business_id, asset_type, locator):
    if not isinstance(locator, str):
        fail("asset_locator_rejected", 422)
    match = _STORAGE.fullmatch(locator)
    if match is None or match.group("business") != str(_uuid(business_id)):
        fail("asset_locator_rejected", 422)
    extension = match.group("ext")
    allowed = IMAGE_EXTENSIONS if asset_type == "image" else VIDEO_EXTENSIONS
    if extension not in allowed:
        fail("asset_locator_rejected", 422)
    return locator


def _remote_locator(asset_type, locator):
    url = validate_https_url(locator)
    extension = _extension(urlsplit(url).path)
    if not extension:
        return url
    allowed = IMAGE_EXTENSIONS if asset_type == "image" else VIDEO_EXTENSIONS
    if asset_type == "link":
        return url
    if extension not in allowed:
        fail("asset_locator_rejected", 422)
    return url


def _coordinate(value, low, high):
    if isinstance(value, bool) or value is None:
        fail("asset_coordinate_rejected", 422)
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        fail("asset_coordinate_rejected", 422)
    if not number.is_finite() or number < low or number > high:
        fail("asset_coordinate_rejected", 422)
    return number.quantize(Decimal("0.000001"))


def normalize_asset(*, business_id, asset_type, title, locator=None, locator_kind=None, latitude=None, longitude=None, caption=None):
    """Return stored fields. Rejects invented or unsafe locators and coordinates."""
    if asset_type not in ASSET_TYPES:
        fail("asset_type_rejected", 422)
    if not isinstance(title, str) or not title.strip() or len(title.strip()) > 160:
        fail("asset_title_rejected", 422)
    if caption is not None and (not isinstance(caption, str) or len(caption) > 500):
        fail("asset_caption_rejected", 422)
    public_content(title, caption or "")
    business = str(_uuid(business_id))
    if asset_type == "place":
        if locator is not None or locator_kind is not None:
            fail("asset_locator_rejected", 422)
        return {
            "business_id": business,
            "asset_type": "place",
            "title": title.strip(),
            "caption": caption,
            "locator_kind": None,
            "locator": None,
            "latitude": _coordinate(latitude, Decimal("-90"), Decimal("90")),
            "longitude": _coordinate(longitude, Decimal("-180"), Decimal("180")),
        }
    if latitude is not None or longitude is not None:
        fail("asset_coordinate_rejected", 422)
    if asset_type == "link":
        if locator_kind not in (None, "https"):
            fail("asset_locator_rejected", 422)
        return {
            "business_id": business,
            "asset_type": "link",
            "title": title.strip(),
            "caption": caption,
            "locator_kind": "https",
            "locator": validate_https_url(locator),
            "latitude": None,
            "longitude": None,
        }
    if locator_kind == "storage":
        stored = _storage_locator(business, asset_type, locator)
    elif locator_kind == "https":
        stored = _remote_locator(asset_type, locator)
    else:
        fail("asset_locator_rejected", 422)
    return {
        "business_id": business,
        "asset_type": asset_type,
        "title": title.strip(),
        "caption": caption,
        "locator_kind": locator_kind,
        "locator": stored,
        "latitude": None,
        "longitude": None,
    }


def _active(row):
    return row is not None and getattr(row, "status", None) == "active"


def _published_public(row):
    return (
        row is not None
        and getattr(row, "status", None) == "published"
        and bool(getattr(row, "public_allowed", False))
        and getattr(row, "approved_by", None) is not None
    )


def public_media_allowed(*, asset, link, knowledge, profile, organization):
    """True only for an approved public asset confirmed on this exact public knowledge version.

    Unlinked assets, other brands, hidden assets, retired links, and a knowledge
    version that is not the confirmed one return False. Callers must pass the
    version they intend to show. A replacement version is not accepted here.
    """
    if asset is None or link is None or knowledge is None or not _active(profile) or not _active(organization):
        return False
    if not _published_public(asset) or not _published_public(knowledge):
        return False
    if getattr(link, "status", None) != "active":
        return False
    same_brand = str(asset.business_id) == str(link.business_id) == str(knowledge.business_id) == str(profile.id) == str(organization.id)
    same_version = str(link.confirmed_version_id) == str(knowledge.id) and str(link.item_id) == str(knowledge.item_id)
    same_asset = str(link.asset_id) == str(asset.id)
    return bool(same_brand and same_version and same_asset)
