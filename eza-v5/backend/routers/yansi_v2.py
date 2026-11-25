"""Yansı V2 HTTP — image publish, conversation drafts, public read, continuation.

Does not modify V1 draft publish (`POST .../drafts/{id}/publish`).
Conversation endpoints wrap Stage 01 services; they do not reimplement seal logic.
"""
from __future__ import annotations

import os
import uuid
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.auth.deps import get_current_user
from backend.core.schemas.business_studio import TopicsRequest
from backend.core.utils.dependencies import get_db
from backend.security.rate_limit import rate_limit_standalone
from backend.services.business_yansi import service as svc
from backend.services.business_yansi import studio, studio_execution
from backend.services.business_yansi.grounded_answers import _default_provider
from backend.services.business_yansi.publication import enabled
from backend.services.yansi import conversation_draft_v2 as conv_drafts
from backend.services.yansi.ai_conversation_proposal_v2 import (
    KIND as V2_PROP_KIND,
    apply_conversation_proposal_v2,
    proposal_public_dto,
)
from backend.services.yansi.continuation_v2 import (
    ContinuationV2Error,
    answer_yansi_v2_continuation,
    bind_yansi_v2_history,
    reject_client_overrides,
)
from backend.services.yansi.http_errors import raise_draft_http, raise_publish_http, raise_read_http
from backend.services.yansi.public_read import PublicReadError, read_public_v2_publication
from backend.services.yansi.publish_conversation_v2 import (
    ConversationPublishV2Error,
    publish_approved_conversation_v2,
)
from backend.services.yansi.publish_image_v2 import ImagePublishV2Error, publish_single_image_grounded_v2

# Public continuation history cap (Stage 04E) — prevents unbounded abuse payloads.
_V2_PUBLIC_ANSWER_HISTORY_MAX = 24
_V2_PUBLIC_ANSWER_HISTORY_CONTENT_MAX = 4000


async def _available():
    if not enabled():
        raise HTTPException(404, "not_found")


def _studio_admission_open() -> None:
    if os.getenv("BILIGN_STUDIO_ADMISSION_ENABLED", "false").lower() != "true":
        raise HTTPException(503, detail={"code": "studio_admission_disabled"})


router = APIRouter(
    prefix="/api/business-yansi",
    tags=["Yansı V2"],
    dependencies=[Depends(_available)],
)


class Body(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class KnowledgeSourcePin(Body):
    knowledgeVersionId: uuid.UUID
    expectedRevision: int = Field(..., ge=0)


class TurnMediaPin(Body):
    type: Literal["image", "video"]
    assetId: uuid.UUID
    assetRevision: int = Field(..., ge=0)
    title: str = Field(..., min_length=1, max_length=200)


class ConversationTurnBody(Body):
    stepIndex: int = Field(..., ge=1, le=8)
    question: str = Field(..., min_length=1, max_length=8000)
    answer: str = Field(..., min_length=1, max_length=8000)
    media: Optional[list[TurnMediaPin]] = Field(None, max_length=4)


class ImagePublishV2Body(Body):
    assetId: uuid.UUID
    expectedAssetRevision: int = Field(..., ge=0)
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=8000)
    knowledgeNotes: Optional[list[str]] = Field(None, max_length=8)
    knowledgeSources: Optional[list[KnowledgeSourcePin]] = Field(None, max_length=32)
    slug: Optional[str] = Field(None, max_length=80)
    nodeId: Optional[uuid.UUID] = None
    expectedCurrentVersion: Optional[int] = Field(None, ge=0)
    idempotencyKey: Optional[str] = Field(None, min_length=1, max_length=128)
    approvalNote: Optional[str] = Field(None, max_length=500)

    @field_validator("knowledgeNotes")
    @classmethod
    def _notes_bounded(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return None
        cleaned: list[str] = []
        for item in value:
            if not isinstance(item, str):
                raise ValueError("knowledge_note_invalid")
            text = item.strip()
            if not text:
                continue
            if len(text) > 8000:
                raise ValueError("knowledge_note_too_long")
            cleaned.append(text)
        if len(cleaned) > 8:
            raise ValueError("too_many_knowledge_notes")
        return cleaned or None

    @field_validator("knowledgeSources")
    @classmethod
    def _sources_unique(cls, value: Optional[list[KnowledgeSourcePin]]) -> Optional[list[KnowledgeSourcePin]]:
        if not value:
            return None
        seen: set[str] = set()
        for pin in value:
            key = str(pin.knowledgeVersionId).lower()
            if key in seen:
                raise ValueError("duplicate_knowledge_source")
            seen.add(key)
        return value


def _pins_payload(pins: Optional[list[KnowledgeSourcePin]]) -> list[dict[str, Any]] | None:
    if not pins:
        return None
    return [
        {
            "knowledgeVersionId": str(pin.knowledgeVersionId),
            "expectedRevision": pin.expectedRevision,
        }
        for pin in pins
    ]


def _turns_payload(turns: list[ConversationTurnBody]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for turn in turns:
        item: dict[str, Any] = {
            "stepIndex": turn.stepIndex,
            "question": turn.question,
            "answer": turn.answer,
        }
        if turn.media:
            item["media"] = [
                {
                    "type": m.type,
                    "assetId": str(m.assetId),
                    "assetRevision": m.assetRevision,
                    "title": m.title,
                }
                for m in turn.media
            ]
        out.append(item)
    return out


class ConversationDraftCreateBody(Body):
    title: str = Field(..., min_length=1, max_length=200)
    summary: Optional[str] = Field(None, max_length=500)
    turns: list[ConversationTurnBody] = Field(..., min_length=1, max_length=8)
    knowledgeNotes: Optional[list[str]] = Field(None, max_length=8)
    knowledgeSources: Optional[list[KnowledgeSourcePin]] = Field(None, max_length=32)
    coverAssetId: Optional[uuid.UUID] = None
    coverAssetRevision: Optional[int] = Field(None, ge=0)

    @field_validator("knowledgeSources")
    @classmethod
    def _sources_unique(cls, value: Optional[list[KnowledgeSourcePin]]) -> Optional[list[KnowledgeSourcePin]]:
        return ImagePublishV2Body._sources_unique(value)


class ConversationDraftReviseBody(ConversationDraftCreateBody):
    expectedRevision: int = Field(..., ge=1)


class ConversationDraftTransitionBody(Body):
    target: Literal["draft", "review", "approved"]
    expectedRevision: int = Field(..., ge=1)
    approvalNote: Optional[str] = Field(None, max_length=500)


class ConversationPublishBody(Body):
    expectedDraftRevision: int = Field(..., ge=1)
    slug: Optional[str] = Field(None, max_length=80)
    nodeId: Optional[uuid.UUID] = None
    expectedCurrentVersion: Optional[int] = Field(None, ge=0)
    idempotencyKey: Optional[str] = Field(None, min_length=1, max_length=128)


class PublicAnswerV2Body(Body):
    question: str = Field(..., min_length=1, max_length=4000)
    # Stage 04E: required — omitting must not silently bind current publication.
    publicationVersion: int = Field(..., ge=1)
    history: Optional[list[dict[str, Any]]] = Field(
        None, max_length=_V2_PUBLIC_ANSWER_HISTORY_MAX
    )

    @field_validator("history")
    @classmethod
    def _cap_history_content(cls, value: Optional[list[dict[str, Any]]]):
        if value is None:
            return value
        cleaned: list[dict[str, Any]] = []
        for item in value:
            if not isinstance(item, dict):
                continue
            role = item.get("role")
            content = item.get("content")
            if role not in {"user", "assistant"}:
                continue
            if not isinstance(content, str):
                continue
            text = content.strip()
            if not text:
                continue
            cleaned.append({
                "role": role,
                "content": text[:_V2_PUBLIC_ANSWER_HISTORY_CONTENT_MAX],
            })
        return cleaned


def _map_extra_errors(exc: BaseException) -> None:
    if isinstance(exc, PublicReadError):
        raise_read_http(exc)
    if isinstance(exc, ContinuationV2Error):
        code = exc.code
        status = {
            "client_override_forbidden": 422,
            "contract_hash_mismatch": 409,
            "not_public": 404,
            "draft_not_readable": 404,
            "publication_not_found": 404,
            "bundle_not_sealed": 404,
            "bundle_not_found": 404,
            "node_not_found": 404,
        }.get(code, 400)
        raise HTTPException(status, detail={"code": code}) from exc
    if isinstance(exc, (ImagePublishV2Error, ConversationPublishV2Error)):
        raise_publish_http(exc)
    if isinstance(exc, conv_drafts.ConversationDraftV2Error):
        raise_draft_http(exc)
    raise exc


@router.post("/{business_id}/v2/publications/image")
async def publish_image_v2(
    business_id: uuid.UUID,
    body: ImagePublishV2Body,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    """Owner-only single-image grounded publish (zero conversation turns)."""
    user = await svc.actor(db, claims)
    try:
        return await publish_single_image_grounded_v2(
            db,
            business_id=str(business_id),
            actor_user_id=str(user.id),
            asset_id=str(body.assetId),
            expected_asset_revision=body.expectedAssetRevision,
            title=body.title,
            description=body.description,
            knowledge_notes=body.knowledgeNotes,
            knowledge_sources=_pins_payload(body.knowledgeSources),
            slug=body.slug,
            node_id=str(body.nodeId) if body.nodeId else None,
            expected_current_version=body.expectedCurrentVersion,
            idempotency_key=body.idempotencyKey,
            approval_note=body.approvalNote,
        )
    except ImagePublishV2Error as exc:
        raise_publish_http(exc)


@router.post("/{business_id}/v2/conversation-drafts")
async def create_conversation_draft(
    business_id: uuid.UUID,
    body: ConversationDraftCreateBody,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    """Editor+ create of a 1–8 turn V2 frozen conversation draft."""
    user = await svc.actor(db, claims)
    try:
        return await conv_drafts.create_conversation_draft_v2(
            db,
            business_id=str(business_id),
            actor_user_id=str(user.id),
            title=body.title,
            summary=body.summary,
            turns=_turns_payload(body.turns),
            knowledge_notes=body.knowledgeNotes,
            knowledge_sources=_pins_payload(body.knowledgeSources),
            cover_asset_id=str(body.coverAssetId) if body.coverAssetId else None,
            cover_asset_revision=body.coverAssetRevision,
        )
    except conv_drafts.ConversationDraftV2Error as exc:
        raise_draft_http(exc)


@router.get("/{business_id}/v2/conversation-drafts")
async def list_conversation_drafts(
    business_id: uuid.UUID,
    db=Depends(get_db),
    claims=Depends(get_current_user),
    status: Optional[str] = Query(None, description="Optional status filter"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Member list of V2 conversation drafts for this Business (summary rows only)."""
    user = await svc.actor(db, claims)
    try:
        return await conv_drafts.list_conversation_drafts_v2(
            db,
            business_id=str(business_id),
            actor_user_id=str(user.id),
            status=status,
            limit=limit,
            offset=offset,
        )
    except conv_drafts.ConversationDraftV2Error as exc:
        raise_draft_http(exc)


@router.get("/{business_id}/v2/conversation-drafts/{draft_id}")
async def get_conversation_draft(
    business_id: uuid.UUID,
    draft_id: uuid.UUID,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    user = await svc.actor(db, claims)
    try:
        return await conv_drafts.get_conversation_draft_v2(
            db,
            business_id=str(business_id),
            actor_user_id=str(user.id),
            draft_id=str(draft_id),
        )
    except conv_drafts.ConversationDraftV2Error as exc:
        raise_draft_http(exc)


@router.patch("/{business_id}/v2/conversation-drafts/{draft_id}")
async def revise_conversation_draft(
    business_id: uuid.UUID,
    draft_id: uuid.UUID,
    body: ConversationDraftReviseBody,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    """Revise draft content; invalidates prior approval."""
    user = await svc.actor(db, claims)
    try:
        return await conv_drafts.revise_conversation_draft_v2(
            db,
            business_id=str(business_id),
            actor_user_id=str(user.id),
            draft_id=str(draft_id),
            expected_revision=body.expectedRevision,
            title=body.title,
            summary=body.summary,
            turns=_turns_payload(body.turns),
            knowledge_notes=body.knowledgeNotes,
            knowledge_sources=_pins_payload(body.knowledgeSources),
            cover_asset_id=str(body.coverAssetId) if body.coverAssetId else None,
            cover_asset_revision=body.coverAssetRevision,
        )
    except conv_drafts.ConversationDraftV2Error as exc:
        raise_draft_http(exc)


@router.post("/{business_id}/v2/conversation-drafts/{draft_id}/transition")
async def transition_conversation_draft(
    business_id: uuid.UUID,
    draft_id: uuid.UUID,
    body: ConversationDraftTransitionBody,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    """Lifecycle: draft ↔ review → approved (owner for approved)."""
    user = await svc.actor(db, claims)
    try:
        return await conv_drafts.transition_conversation_draft_v2(
            db,
            business_id=str(business_id),
            actor_user_id=str(user.id),
            draft_id=str(draft_id),
            target=body.target,
            expected_revision=body.expectedRevision,
            approval_note=body.approvalNote,
        )
    except conv_drafts.ConversationDraftV2Error as exc:
        raise_draft_http(exc)


@router.post("/{business_id}/v2/conversation-drafts/{draft_id}/publish")
async def publish_conversation_draft(
    business_id: uuid.UUID,
    draft_id: uuid.UUID,
    body: ConversationPublishBody,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    """Owner publish of an approved conversation draft → sealed V2 version."""
    user = await svc.actor(db, claims)
    try:
        return await publish_approved_conversation_v2(
            db,
            business_id=str(business_id),
            actor_user_id=str(user.id),
            draft_id=str(draft_id),
            expected_draft_revision=body.expectedDraftRevision,
            slug=body.slug,
            node_id=str(body.nodeId) if body.nodeId else None,
            expected_current_version=body.expectedCurrentVersion,
            idempotency_key=body.idempotencyKey,
        )
    except (ConversationPublishV2Error, conv_drafts.ConversationDraftV2Error) as exc:
        raise_publish_http(exc)


class ConversationProposalApplyBody(Body):
    draftId: Optional[uuid.UUID] = None
    expectedRevision: Optional[int] = Field(None, ge=1)


@router.post("/{business_id}/v2/ai/conversation-proposals")
async def create_conversation_proposal(
    business_id: uuid.UUID,
    body: TopicsRequest,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    """Admit + execute a V2 AI conversation proposal (not a publish, not a V1 draft).

    Reuses Studio snapshot/budget/execution. Requires Studio admission + execution flags.
    Tests inject ModelRouter via ``studio_execution.execute``; this route does not open
    paid clients by itself when execution is disabled.
    """
    _studio_admission_open()
    user = await svc.actor(db, claims)
    try:
        job = await studio.create_job(db, business_id, user.id, body, V2_PROP_KIND)
        job = await studio_execution.execute(db, job)
        return proposal_public_dto(job)
    except Exception:
        await db.rollback()
        raise


@router.get("/{business_id}/v2/ai/conversation-proposals/{generation_id}")
async def get_conversation_proposal(
    business_id: uuid.UUID,
    generation_id: uuid.UUID,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    _studio_admission_open()
    user = await svc.actor(db, claims)
    try:
        job = await studio.read_job(db, business_id, user.id, generation_id)
        if job.kind != V2_PROP_KIND:
            raise HTTPException(404, detail={"code": "studio_generation_not_found"})
        job = await studio_execution.recover(db, job)
        return proposal_public_dto(job)
    except Exception:
        await db.rollback()
        raise


@router.post("/{business_id}/v2/ai/conversation-proposals/{generation_id}/apply")
async def apply_conversation_proposal(
    business_id: uuid.UUID,
    generation_id: uuid.UUID,
    body: ConversationProposalApplyBody,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    """Explicitly apply a succeeded proposal into a V2 conversation draft (create or revise)."""
    _studio_admission_open()
    user = await svc.actor(db, claims)
    try:
        return await apply_conversation_proposal_v2(
            db,
            business_id=str(business_id),
            actor_user_id=str(user.id),
            generation_id=str(generation_id),
            draft_id=str(body.draftId) if body.draftId else None,
            expected_revision=body.expectedRevision,
        )
    except conv_drafts.ConversationDraftV2Error as exc:
        raise_draft_http(exc)


class V2CoverImageSuggestionBody(Body):
    idempotencyKey: str = Field(..., min_length=8, max_length=128)
    visualDirection: Optional[str] = Field(None, max_length=400)


class V2CoverImageConfirmBody(Body):
    publicAllowed: bool = False
    knowledgeVersionIds: Optional[list[uuid.UUID]] = Field(None, max_length=32)
    expectedRevision: Optional[int] = Field(None, ge=1)
    bindCover: bool = True


@router.post("/{business_id}/v2/conversation-drafts/{draft_id}/cover-image-suggestions")
async def create_v2_cover_image_suggestion(
    business_id: uuid.UUID,
    draft_id: uuid.UUID,
    body: V2CoverImageSuggestionBody,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    """Paid Cover AI image proposal for a V2 conversation draft. Explicit confirm required."""
    from backend.services.business_yansi.cover_image_suggestions import present_image_suggestion
    from backend.services.yansi.cover_image_suggestions_v2 import (
        current_v2_draft_matches,
        suggest_image_cover_v2,
    )

    user = await svc.actor(db, claims)
    row = await suggest_image_cover_v2(
        db,
        business_id,
        user.id,
        draft_id,
        body.idempotencyKey,
        visual_direction=body.visualDirection,
    )
    current = await current_v2_draft_matches(db, row, business_id, draft_id)
    return present_image_suggestion(row, draft_id, source_current=current)


@router.get("/{business_id}/v2/conversation-drafts/{draft_id}/cover-image-suggestions/{proposal_id}")
async def get_v2_cover_image_suggestion(
    business_id: uuid.UUID,
    draft_id: uuid.UUID,
    proposal_id: uuid.UUID,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    from backend.services.yansi.cover_image_suggestions_v2 import read_image_suggestion_v2

    user = await svc.actor(db, claims)
    return await read_image_suggestion_v2(db, business_id, user.id, draft_id, proposal_id)


@router.get(
    "/{business_id}/v2/conversation-drafts/{draft_id}/cover-image-suggestions/{proposal_id}/preview"
)
async def get_v2_cover_image_suggestion_preview(
    business_id: uuid.UUID,
    draft_id: uuid.UUID,
    proposal_id: uuid.UUID,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    from backend.services.yansi.cover_image_suggestions_v2 import read_image_preview_v2

    user = await svc.actor(db, claims)
    blob, mime = await read_image_preview_v2(db, business_id, user.id, draft_id, proposal_id)
    return Response(content=blob, media_type=mime, headers={"Cache-Control": "private, no-store"})


@router.post(
    "/{business_id}/v2/conversation-drafts/{draft_id}/cover-image-suggestions/{proposal_id}/confirm"
)
async def confirm_v2_cover_image_suggestion(
    business_id: uuid.UUID,
    draft_id: uuid.UUID,
    proposal_id: uuid.UUID,
    body: V2CoverImageConfirmBody,
    db=Depends(get_db),
    claims=Depends(get_current_user),
):
    """Promote private preview → brand asset and optionally bind V2 draft cover."""
    from backend.services.business_yansi import brand_asset_library as assets
    from backend.services.yansi.cover_image_suggestions_v2 import confirm_image_suggestion_v2

    user = await svc.actor(db, claims)
    try:
        result = await confirm_image_suggestion_v2(
            db,
            business_id,
            user.id,
            draft_id,
            proposal_id,
            public_allowed=body.publicAllowed,
            link_version_ids=body.knowledgeVersionIds or None,
            expected_revision=body.expectedRevision,
            bind_cover=body.bindCover,
        )
    except conv_drafts.ConversationDraftV2Error as exc:
        raise_draft_http(exc)
    asset_view = await assets.present_asset_by_id(db, business_id, result["asset"].id)
    return {
        "asset": asset_view,
        "draft": result.get("draft"),
    }


@router.get("/v2/public/{slug}")
async def public_current_v2(slug: str, db=Depends(get_db)):
    """Public read of the current sealed V2 publication (image or frozen conversation)."""
    try:
        return await read_public_v2_publication(db, slug=slug)
    except PublicReadError as exc:
        raise_read_http(exc)


@router.get("/v2/public/{slug}/versions/{publication_version}")
async def public_version_v2(
    slug: str,
    publication_version: int,
    db=Depends(get_db),
):
    """Public read of a specific sealed V2 publication version (incl. older)."""
    try:
        return await read_public_v2_publication(
            db, slug=slug, publication_version=publication_version,
        )
    except PublicReadError as exc:
        raise_read_http(exc)


@router.post("/v2/public/{slug}/answer")
async def public_answer_v2(
    slug: str,
    body: PublicAnswerV2Body,
    db=Depends(get_db),
    _: None = Depends(rate_limit_standalone),
):
    """Grounded continuation for a public V2 publication.

    Server resolves bundle + policy from sealed rows. Client overrides rejected.
    ``publicationVersion`` is required so sessions cannot silently float to
    ``current_v2_publication_version``. Provider follows V1 grounded-answer
    injection (``_default_provider``) and remains flag-gated inside the engine.
    """
    raw = body.model_dump()
    try:
        reject_client_overrides(raw)
    except ContinuationV2Error as exc:
        _map_extra_errors(exc)

    bound = await bind_yansi_v2_history(
        db, slug, body.publicationVersion, body.history or [],
    )
    if bound is None:
        raise HTTPException(404, detail={"code": "publication_not_found"})
    # Fail closed if bind resolved a different version than the client pin.
    if bound.publication_version != int(body.publicationVersion):
        raise HTTPException(409, detail={"code": "publication_version_mismatch"})

    try:
        result = await answer_yansi_v2_continuation(
            db,
            body.question,
            bound,
            client_payload=raw,
            lexical_only=True,
            provider=_default_provider,
            embedder=None,
        )
    except ContinuationV2Error as exc:
        _map_extra_errors(exc)

    return {
        "status": result.get("status"),
        "assistant_answer": result.get("assistant_answer"),
        "sources": result.get("display_sources") or result.get("sources") or [],
        "yansi_v2_grounded": True,
        "publicationVersion": bound.publication_version,
        "slug": bound.slug,
        "reason": result.get("reason"),
    }
