"""Short-lived HMAC tickets for Content Library media streaming.

Browsers cannot attach Authorization headers to native <video> Range requests.
Tickets are scoped to one user + business + asset and expire quickly. They are
not permanent public R2 URLs and do not bypass tenant membership checks on use.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any
from uuid import UUID

from backend.config import get_settings, resolve_jwt_secret
from backend.services.business_yansi.service import fail

# Long enough for a 60s library clip plus pause/seek, still not a permanent URL.
_TICKET_TTL_SECONDS = 600
_TICKET_TTL_MAX_SECONDS = 900
_PURPOSE_VIDEO = "library_video"


def _secret() -> bytes:
    return resolve_jwt_secret(get_settings()).encode("utf-8")


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + pad)


def mint_library_video_ticket(
    *,
    user_id: UUID | str,
    business_id: UUID | str,
    asset_id: UUID | str,
    ttl_seconds: int = _TICKET_TTL_SECONDS,
) -> dict[str, Any]:
    """Return a ticket payload for one authorized video stream URL."""
    ttl = max(15, min(int(ttl_seconds), _TICKET_TTL_MAX_SECONDS))
    expires_at = int(time.time()) + ttl
    body = {
        "v": 1,
        "purpose": _PURPOSE_VIDEO,
        "userId": str(user_id),
        "businessId": str(business_id),
        "assetId": str(asset_id),
        "exp": expires_at,
    }
    payload = _b64url(json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = _b64url(hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).digest())
    return {
        "ticket": f"{payload}.{signature}",
        "expiresAt": expires_at,
        "expiresIn": ttl,
    }


def parse_library_video_ticket(ticket: str) -> dict[str, str]:
    """Validate signature and expiry. Membership is still checked by preview_video."""
    raw = (ticket or "").strip()
    if not raw or raw.count(".") != 1 or len(raw) > 800:
        fail("media_ticket_rejected", 401)
    payload_text, signature_text = raw.split(".", 1)
    expected = hmac.new(_secret(), payload_text.encode("ascii"), hashlib.sha256).digest()
    try:
        provided = _b64url_decode(signature_text)
    except Exception:
        fail("media_ticket_rejected", 401)
    if not hmac.compare_digest(expected, provided):
        fail("media_ticket_rejected", 401)
    try:
        body = json.loads(_b64url_decode(payload_text).decode("utf-8"))
    except Exception:
        fail("media_ticket_rejected", 401)
    if not isinstance(body, dict):
        fail("media_ticket_rejected", 401)
    if body.get("v") != 1 or body.get("purpose") != _PURPOSE_VIDEO:
        fail("media_ticket_rejected", 401)
    try:
        expires_at = int(body.get("exp"))
    except (TypeError, ValueError):
        fail("media_ticket_rejected", 401)
    if expires_at < int(time.time()):
        fail("media_ticket_expired", 401)
    user_id = str(body.get("userId") or "").strip()
    business_id = str(body.get("businessId") or "").strip()
    asset_id = str(body.get("assetId") or "").strip()
    if not user_id or not business_id or not asset_id:
        fail("media_ticket_rejected", 401)
    return {
        "user_id": user_id,
        "business_id": business_id,
        "asset_id": asset_id,
    }
