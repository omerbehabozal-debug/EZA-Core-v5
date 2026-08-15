# -*- coding: utf-8 -*-
"""
Phase 6.4 — ownContinuationStarted.

Fires only after a genuine first live user question is accepted, with origin
from server-verified continuation proof (never a client-claimed parent slug).

Best-effort: chat must proceed if measurement fails.
Signal is slug-level: proof stores source_mirror_slug only.
origin_journey_version is an advisory lookup of the published node, not
proof-pinned authority.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.jwt import get_user_from_token
from backend.models.yansi_own_continuation_event import YansiOwnContinuationEvent
from backend.services.mirror_network.continuation_proof import (
    _actor_matches,
    _proof_expired,
    get_continuation_proof_by_id,
)
from backend.services.mirror_network.repository import get_mirror_network_node_by_slug


def _optional_user_id(
    credentials: HTTPAuthorizationCredentials | None,
) -> tuple[Optional[UUID], Optional[str]]:
    if credentials is None:
        return None, None
    try:
        user = get_user_from_token(credentials.credentials)
    except Exception:
        return None, None
    if not user:
        return None, None
    raw = user.get("user_id") or user.get("sub")
    text = str(raw).strip() if raw else ""
    uid: Optional[UUID] = None
    if text:
        try:
            uid = UUID(text)
        except ValueError:
            uid = None
    return uid, text or None


def _prior_user_turns(history: Any) -> int:
    if not history:
        return 0
    n = 0
    for item in history:
        role = getattr(item, "role", None)
        if role is None and isinstance(item, dict):
            role = item.get("role")
        if str(role or "").strip().lower() == "user":
            n += 1
    return n


async def record_own_continuation_started_best_effort(
    db: AsyncSession,
    *,
    lineage_proof_token: str | None,
    history: Any,
    guest_token: str | None,
    credentials: HTTPAuthorizationCredentials | None,
) -> None:
    """Never raises into the chat path."""
    try:
        await _record_own_continuation_started(
            db,
            lineage_proof_token=lineage_proof_token,
            history=history,
            guest_token=guest_token,
            credentials=credentials,
        )
    except Exception:
        try:
            await db.rollback()
        except Exception:
            pass


async def _record_own_continuation_started(
    db: AsyncSession,
    *,
    lineage_proof_token: str | None,
    history: Any,
    guest_token: str | None,
    credentials: HTTPAuthorizationCredentials | None,
) -> None:
    token = (lineage_proof_token or "").strip()
    if not token:
        return
    if _prior_user_turns(history) > 0:
        return
    try:
        proof_id = UUID(token)
    except ValueError:
        return

    proof = await get_continuation_proof_by_id(db, proof_id)
    if proof is None:
        return
    now = datetime.now(timezone.utc)
    if _proof_expired(proof, now=now):
        return

    user_uuid, viewer_user_id = _optional_user_id(credentials)
    actor_user = user_uuid or UUID(int=0)
    if not _actor_matches(proof, user_id=actor_user, guest_token=guest_token):
        return

    origin = (proof.source_mirror_slug or "").strip().lower()
    if not origin:
        return
    session_id = (proof.session_id or "").strip()
    if not session_id:
        return

    version: int | None = None
    try:
        node = await get_mirror_network_node_by_slug(db, origin)
        raw = getattr(node, "journey_version", None) if node is not None else None
        if raw is not None and int(raw) >= 1:
            version = int(raw)
    except Exception:
        version = None

    row = YansiOwnContinuationEvent(
        event_id=str(uuid.uuid4()),
        continuation_session_id=session_id,
        origin_mirror_slug=origin,
        origin_journey_version=version,
        viewer_user_id=viewer_user_id,
        occurred_at=now,
    )
    try:
        db.add(row)
        await db.commit()
    except IntegrityError:
        await db.rollback()


async def count_own_continuation_started(
    db: AsyncSession, *, origin_slug: str
) -> int:
    slug_n = (origin_slug or "").strip().lower()
    if not slug_n:
        return 0
    result = await db.execute(
        select(func.count(func.distinct(YansiOwnContinuationEvent.continuation_session_id))).where(
            YansiOwnContinuationEvent.origin_mirror_slug == slug_n
        )
    )
    return int(result.scalar() or 0)
