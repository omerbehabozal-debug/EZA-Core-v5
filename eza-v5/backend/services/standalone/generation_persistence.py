# -*- coding: utf-8 -*-
"""Phase 8.8G-2 — persist authenticated generation turns server-side."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from backend.auth.jwt import get_user_from_token
from backend.core.schemas.pipeline import StandaloneRequest
from backend.core.schemas.standalone_conversations import (
    StandaloneConversationMessageCreate,
    StandaloneConversationMessageDTO,
)
from backend.services.standalone.conversations import (
    StandaloneConversationNotFoundError,
    append_standalone_message,
    update_standalone_message_evaluation,
)
from backend.services.standalone.message_evaluation import (
    build_assistant_evaluation_metadata,
    build_user_evaluation_metadata,
    try_prepare_persisted_metadata,
)
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class GenerationPersistenceContext:
    user_id: UUID
    conversation_id: UUID
    client_user_message_id: str
    client_assistant_message_id: str


def try_resolve_generation_persistence(
    request: StandaloneRequest,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> Optional[GenerationPersistenceContext]:
    """
    Resolve authenticated generation persistence context.

    All persistence fields must be present together; partial payloads are ignored
    so guests and legacy clients remain unchanged.
    """
    if credentials is None or not credentials.credentials:
        return None
    user = get_user_from_token(credentials.credentials)
    if not user or not user.get("user_id"):
        return None

    server_id = (request.serverConversationId or "").strip()
    user_msg_id = (request.clientUserMessageId or "").strip()
    assistant_msg_id = (request.clientAssistantMessageId or "").strip()
    if not server_id or not user_msg_id or not assistant_msg_id:
        return None

    try:
        conversation_id = UUID(server_id)
        user_id = UUID(str(user["user_id"]))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="invalid_persistence_context") from exc

    return GenerationPersistenceContext(
        user_id=user_id,
        conversation_id=conversation_id,
        client_user_message_id=user_msg_id,
        client_assistant_message_id=assistant_msg_id,
    )


def build_completion_persistence_status(
    *,
    user_persisted: bool,
    assistant_persisted: bool,
) -> dict[str, bool]:
    return {
        "conversationPersisted": user_persisted,
        "assistantPersisted": assistant_persisted,
    }


async def persist_user_turn_before_generation(
    db: AsyncSession,
    ctx: GenerationPersistenceContext,
    *,
    content: str,
) -> StandaloneConversationMessageDTO:
    try:
        return await append_standalone_message(
            db,
            user_id=ctx.user_id,
            conversation_id=ctx.conversation_id,
            body=StandaloneConversationMessageCreate(
                clientMessageId=ctx.client_user_message_id,
                role="user",
                content=content,
            ),
        )
    except StandaloneConversationNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail={"code": "conversation_not_found"},
        ) from exc


async def update_user_turn_evaluation(
    db: AsyncSession,
    ctx: GenerationPersistenceContext,
    *,
    user_score: Any,
) -> Optional[StandaloneConversationMessageDTO]:
    """
    Attach userScore to the EXACT persisted user message
    (conversation_id + client_user_message_id). Fail-soft.
    """
    patch = build_user_evaluation_metadata(user_score=user_score)
    if not patch:
        return None
    try:
        return await update_standalone_message_evaluation(
            db,
            user_id=ctx.user_id,
            conversation_id=ctx.conversation_id,
            client_message_id=ctx.client_user_message_id,
            evaluation=patch,
        )
    except Exception:
        return None


async def persist_assistant_turn_after_generation(
    db: AsyncSession,
    ctx: GenerationPersistenceContext,
    *,
    content: str,
    assistant_score: Any = None,
    behavioral: Any = None,
    safety: Any = None,
) -> Optional[StandaloneConversationMessageDTO]:
    """Persist final assistant output once with evaluation metadata when available."""
    text = (content or "").strip()
    if not text:
        return None

    eval_meta = build_assistant_evaluation_metadata(
        assistant_score=assistant_score,
        behavioral=behavioral,
        safety=safety,
    )
    prepared = try_prepare_persisted_metadata(eval_meta)

    try:
        dto = await append_standalone_message(
            db,
            user_id=ctx.user_id,
            conversation_id=ctx.conversation_id,
            body=StandaloneConversationMessageCreate(
                clientMessageId=ctx.client_assistant_message_id,
                role="assistant",
                content=text,
                metadata=prepared,
            ),
        )
    except StandaloneConversationNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail={"code": "conversation_not_found"},
        ) from exc

    # Idempotent retry: append returns existing without applying new metadata —
    # merge evaluation onto the exact assistant row when we have a patch.
    if prepared:
        updated = await update_standalone_message_evaluation(
            db,
            user_id=ctx.user_id,
            conversation_id=ctx.conversation_id,
            client_message_id=ctx.client_assistant_message_id,
            evaluation=prepared,
        )
        if updated is not None:
            return updated
    return dto
