# -*- coding: utf-8 -*-
"""Phase 8.8G-3 — safe legacy localStorage conversation migration."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.schemas.standalone_conversations import (
    MAX_LEGACY_MESSAGES_PER_CONVERSATION,
    LegacyMigrationConversation,
    LegacyMigrationConversationResult,
    LegacyMigrationRequest,
    LegacyMigrationResponse,
)
from backend.models.standalone_conversations import (
    CONVERSATION_TYPES,
    MESSAGE_ROLES,
    StandaloneConversation,
    StandaloneConversationMessage,
)
from backend.services.standalone.conversations import (
    DEFAULT_UNINITIALIZED_TITLE,
    _utcnow,
)
from backend.services.standalone.group_id import parse_optional_group_uuid
from backend.services.standalone.metadata_security import (
    find_forbidden_metadata_key,
    reject_forbidden_metadata,
)
from backend.services.standalone.persistence_limits import (
    MAX_CLIENT_ID_LENGTH,
    MAX_MESSAGE_CONTENT_LENGTH,
    MAX_PREVIEW_LENGTH,
    MAX_TITLE_LENGTH,
    validate_bounded_json,
)

logger = logging.getLogger(__name__)

MIGRATION_PROVENANCE = {"provenance": "legacy_migration_v1"}

_TYPE_MAP = {
    "direct": "direct",
    "mirror": "mirror",
    "mirror_branch": "mirror_branch",
    "continuation": "continuation",
}


def deterministic_legacy_message_id(
    client_conversation_id: str,
    ordinal: int,
    role: str,
    content: str,
) -> str:
    digest = hashlib.sha256(
        f"{client_conversation_id}|{ordinal}|{role}|{content}".encode("utf-8")
    ).hexdigest()
    return f"mig-{digest[:40]}"


def _normalize_client_message_id(
    raw: Optional[str],
    *,
    client_conversation_id: str,
    ordinal: int,
    role: str,
    content: str,
) -> str:
    candidate = (raw or "").strip()
    if 1 <= len(candidate) <= MAX_CLIENT_ID_LENGTH:
        return candidate
    return deterministic_legacy_message_id(client_conversation_id, ordinal, role, content)


def _map_conversation_type(raw: Optional[str]) -> Optional[str]:
    if raw is None or not str(raw).strip():
        return "direct"
    key = str(raw).strip().lower()
    mapped = _TYPE_MAP.get(key)
    if mapped in CONVERSATION_TYPES:
        return mapped
    return None


def _safe_scene_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    trimmed = url.strip()
    if not trimmed:
        return None
    lower = trimmed.lower()
    if lower.startswith("data:") or lower.startswith("blob:"):
        return None
    try:
        parsed = urlparse(trimmed)
    except Exception:
        return None
    if parsed.scheme not in ("http", "https"):
        return None
    if not parsed.netloc:
        return None
    return trimmed[:2048]


def _parse_optional_created_at(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    text = raw.strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = _utcnow()
        if abs((dt - now).days) > 365 * 50:
            return None
        return dt
    except ValueError:
        return None


def _sanitize_title(title: Optional[str], *, title_pinned: bool) -> tuple[Optional[str], bool]:
    cleaned = (title or "").strip()
    if not cleaned or cleaned == DEFAULT_UNINITIALIZED_TITLE:
        return None, False
    return cleaned[:MAX_TITLE_LENGTH], bool(title_pinned)


async def _find_any_owned_by_client_id(
    db: AsyncSession,
    *,
    user_id: UUID,
    client_conversation_id: str,
) -> Optional[StandaloneConversation]:
    result = await db.execute(
        select(StandaloneConversation).where(
            StandaloneConversation.user_id == user_id,
            StandaloneConversation.client_conversation_id == client_conversation_id,
        )
    )
    return result.scalar_one_or_none()


def _result(
    client_id: str,
    status: str,
    *,
    server_id: Optional[str] = None,
    reason: Optional[str] = None,
    message_count: Optional[int] = None,
) -> LegacyMigrationConversationResult:
    return LegacyMigrationConversationResult(
        clientConversationId=client_id,
        status=status,  # type: ignore[arg-type]
        serverConversationId=server_id,
        reason=reason,
        messageCount=message_count,
    )


def _build_normalized_messages(
    client_id: str,
    body: LegacyMigrationConversation,
) -> tuple[
    Optional[list[tuple[str, str, str, Optional[datetime]]]],
    Optional[str],
]:
    """
    Returns (normalized_messages, error_reason).

    Empty usable transcript returns ([], None) — caller maps to empty_transcript.
    Duplicate explicit / resolved clientMessageId → error (never silent drop).
    """
    if len(body.messages) > MAX_LEGACY_MESSAGES_PER_CONVERSATION:
        return None, "message_count_exceeded"

    seen_ordinals: set[int] = set()
    seen_explicit_ids: set[str] = set()
    for msg in body.messages:
        if msg.role not in MESSAGE_ROLES:
            return None, "invalid_message_role"
        if msg.ordinal in seen_ordinals:
            return None, "duplicate_message_ordinal"
        seen_ordinals.add(msg.ordinal)
        content = (msg.content or "").strip()
        if content and len(content) > MAX_MESSAGE_CONTENT_LENGTH:
            return None, "message_content_exceeded"
        explicit = (msg.clientMessageId or "").strip()
        if explicit:
            if explicit in seen_explicit_ids:
                return None, "duplicate_client_message_id"
            seen_explicit_ids.add(explicit)

    ordered = sorted(body.messages, key=lambda m: m.ordinal)
    normalized: list[tuple[str, str, str, Optional[datetime]]] = []
    seen_ids: set[str] = set()
    for msg in ordered:
        content = (msg.content or "").strip()
        if not content:
            continue
        mid = _normalize_client_message_id(
            msg.clientMessageId,
            client_conversation_id=client_id,
            ordinal=msg.ordinal,
            role=msg.role,
            content=content,
        )
        if mid in seen_ids:
            # Collision after deterministic fallback, or residual ID clash.
            return None, "duplicate_client_message_id"
        seen_ids.add(mid)
        normalized.append(
            (mid, msg.role, content, _parse_optional_created_at(msg.createdAt))
        )
    return normalized, None


async def _migrate_one_conversation(
    db: AsyncSession,
    *,
    user_id: UUID,
    body: LegacyMigrationConversation,
) -> LegacyMigrationConversationResult:
    client_id = body.clientConversationId.strip()
    if not client_id:
        return _result(
            body.clientConversationId, "rejected_invalid", reason="client_conversation_id_required"
        )

    mapped_type = _map_conversation_type(body.conversationType)
    if mapped_type is None:
        return _result(client_id, "rejected_invalid", reason="unknown_conversation_type")

    try:
        reject_forbidden_metadata(body.treeMetadata, field_name="tree_metadata")
        validate_bounded_json(body.treeMetadata, field_name="tree_metadata")
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else "invalid_tree_metadata"
        return _result(client_id, "rejected_invalid", reason=detail)

    if body.treeMetadata is not None and find_forbidden_metadata_key(body.treeMetadata):
        return _result(client_id, "rejected_invalid", reason="forbidden_tree_metadata_key")

    existing = await _find_any_owned_by_client_id(
        db, user_id=user_id, client_conversation_id=client_id
    )
    if existing is not None:
        if existing.deleted_at is not None:
            return _result(
                client_id,
                "tombstoned",
                server_id=str(existing.id),
                reason="server_deleted",
            )
        return _result(
            client_id,
            "already_server_authoritative",
            server_id=str(existing.id),
            message_count=int(existing.message_count or 0),
        )

    normalized, err = _build_normalized_messages(client_id, body)
    if err is not None:
        return _result(client_id, "rejected_invalid", reason=err)
    assert normalized is not None
    if len(normalized) == 0:
        return _result(client_id, "empty_transcript", reason="empty_transcript")

    title, title_pinned = _sanitize_title(body.title, title_pinned=body.titlePinned)
    scene_url = _safe_scene_url(body.conversationSceneUrl)
    scene_source = (body.conversationSceneSource or "").strip() or None
    scene_slug = (body.conversationSceneSlug or "").strip().lower() or None
    if scene_url is None:
        scene_source = None
        scene_slug = None

    # Phase 8.8G-5 / 2.2 — optional group metadata: drop invalid ids; never
    # reject an otherwise-valid conversation solely for legacy local group-*.
    group_uuid, group_id_sanitized = parse_optional_group_uuid(body.groupId)

    parent_client = (body.parentClientConversationId or "").strip() or None
    source_slug = (body.sourceYansiSlug or "").strip().lower() or None

    preview: Optional[str] = None
    if normalized:
        preview = normalized[0][2][:MAX_PREVIEW_LENGTH]

    now = _utcnow()
    last_message_at = None
    for _mid, _role, _content, created in normalized:
        if created is not None:
            last_message_at = created if last_message_at is None else max(last_message_at, created)
    if normalized and last_message_at is None:
        last_message_at = now

    row = StandaloneConversation(
        user_id=user_id,
        client_conversation_id=client_id,
        title=title,
        title_pinned=title_pinned,
        pinned=bool(body.pinned),
        preview=preview,
        conversation_type=mapped_type,
        parent_client_conversation_id=parent_client,
        source_yansi_slug=source_slug,
        group_id=group_uuid,
        tree_metadata=body.treeMetadata,
        conversation_scene_url=scene_url,
        conversation_scene_source=scene_source,
        conversation_scene_slug=scene_slug,
        message_count=len(normalized),
        created_at=now,
        updated_at=now,
        last_message_at=last_message_at,
    )
    db.add(row)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raced = await _find_any_owned_by_client_id(
            db, user_id=user_id, client_conversation_id=client_id
        )
        if raced is None:
            return _result(client_id, "failed_retryable", reason="create_conflict")
        if raced.deleted_at is not None:
            return _result(
                client_id,
                "tombstoned",
                server_id=str(raced.id),
                reason="server_deleted",
            )
        return _result(
            client_id,
            "already_server_authoritative",
            server_id=str(raced.id),
            message_count=int(raced.message_count or 0),
        )

    for index, (mid, role, content, created) in enumerate(normalized, start=1):
        db.add(
            StandaloneConversationMessage(
                conversation_id=row.id,
                client_message_id=mid,
                role=role,
                content=content,
                sequence=index,
                message_metadata=dict(MIGRATION_PROVENANCE),
                created_at=created or now,
            )
        )

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raced = await _find_any_owned_by_client_id(
            db, user_id=user_id, client_conversation_id=client_id
        )
        if raced is not None and raced.deleted_at is not None:
            return _result(
                client_id,
                "tombstoned",
                server_id=str(raced.id),
                reason="server_deleted",
            )
        if raced is not None:
            return _result(
                client_id,
                "already_server_authoritative",
                server_id=str(raced.id),
                message_count=int(raced.message_count or 0),
            )
        return _result(client_id, "failed_retryable", reason="commit_conflict")

    await db.refresh(row)
    return _result(
        client_id,
        "migrated",
        server_id=str(row.id),
        message_count=int(row.message_count or 0),
        reason="group_id_sanitized" if group_id_sanitized else None,
    )


async def migrate_legacy_conversations(
    db: AsyncSession,
    *,
    user_id: UUID,
    request: LegacyMigrationRequest,
) -> LegacyMigrationResponse:
    results: list[LegacyMigrationConversationResult] = []
    for conversation in request.conversations:
        try:
            result = await _migrate_one_conversation(db, user_id=user_id, body=conversation)
        except Exception:
            logger.exception(
                "legacy migration failed for %s",
                conversation.clientConversationId,
            )
            try:
                await db.rollback()
            except Exception:
                pass
            result = _result(
                conversation.clientConversationId.strip() or conversation.clientConversationId,
                "failed_retryable",
                reason="internal_error",
            )
        results.append(result)
    return LegacyMigrationResponse(results=results)
