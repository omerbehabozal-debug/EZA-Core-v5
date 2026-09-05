# -*- coding: utf-8 -*-
"""Authenticated unpublished Yansı preparations — Phase 8.8G-4."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse
from uuid import UUID
import asyncio
import logging

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.schemas.standalone_conversations import (
    YansiPreparationDTO,
    YansiPreparationPublicationLink,
    YansiPreparationUpsert,
)
from backend.models.standalone_conversations import (
    YANSI_PREPARATION_STATUS_READY,
    StandaloneConversation,
    StandaloneYansiPreparation,
)
from backend.services.standalone.metadata_security import reject_forbidden_metadata
from backend.services.standalone.persistence_limits import (
    MAX_YANSI_LANDING_JSON_BYTES,
    MAX_YANSI_LINEAGE_JSON_BYTES,
    MAX_YANSI_QA_ITEMS,
    MAX_YANSI_QA_TEXT_LENGTH,
    MIN_YANSI_QA_ITEMS,
    validate_bounded_json,
)


class YansiPreparationNotFoundError(Exception):
    """Raised when a preparation is absent or not owned by the caller."""


async def _require_owned_conversation(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: UUID,
) -> StandaloneConversation:
    result = await db.execute(
        select(StandaloneConversation).where(
            StandaloneConversation.id == conversation_id,
            StandaloneConversation.user_id == user_id,
            StandaloneConversation.deleted_at.is_(None),
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise YansiPreparationNotFoundError()
    return row


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat()


def build_source_identity(journey_id: str, journey_version: int) -> str:
    return f"{journey_id.strip().lower()}::v{int(journey_version)}"


def validate_canonical_scene_url(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        raise HTTPException(status_code=422, detail="scene_url_required")
    lower = value.lower()
    if lower.startswith(("blob:", "data:", "file:")):
        raise HTTPException(status_code=422, detail="scene_url_transient_rejected")
    if value.startswith("/api/public/mirror-scene-assets/"):
        if len(value) > 2048:
            raise HTTPException(status_code=422, detail="scene_url_too_long")
        return value
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=422, detail="scene_url_invalid")
    return value


def _validate_focal(value: Optional[float], field: str) -> Optional[float]:
    if value is None:
        return None
    if not isinstance(value, (int, float)) or value < 0 or value > 1:
        raise HTTPException(status_code=422, detail=f"invalid_{field}")
    return float(value)


def _validate_lineage(lineage: dict[str, Any]) -> dict[str, Any]:
    reject_forbidden_metadata(lineage, field_name="sealed_lineage")
    validate_bounded_json(
        lineage,
        field_name="sealed_lineage",
        max_bytes=MAX_YANSI_LINEAGE_JSON_BYTES,
    )
    steps = lineage.get("selectedSteps")
    if not isinstance(steps, list):
        raise HTTPException(status_code=422, detail="sealed_lineage_steps_required")
    if len(steps) < MIN_YANSI_QA_ITEMS or len(steps) > MAX_YANSI_QA_ITEMS:
        raise HTTPException(status_code=422, detail="sealed_lineage_steps_count")
    for step in steps:
        if not isinstance(step, dict):
            raise HTTPException(status_code=422, detail="sealed_lineage_step_invalid")
        reject_forbidden_metadata(step, field_name="sealed_lineage_step")
        for key in ("publicQuestion", "publicAnswer"):
            text = step.get(key)
            if not isinstance(text, str) or not text.strip():
                raise HTTPException(status_code=422, detail="sealed_lineage_qa_required")
            if len(text) > MAX_YANSI_QA_TEXT_LENGTH:
                raise HTTPException(status_code=422, detail="sealed_lineage_qa_too_long")
    return lineage


def _row_to_dto(row: StandaloneYansiPreparation) -> YansiPreparationDTO:
    return YansiPreparationDTO(
        id=str(row.id),
        conversationId=str(row.conversation_id),
        sourceIdentity=row.source_identity,
        journeyId=row.journey_id,
        journeyVersion=int(row.journey_version),
        windowIndex=int(row.window_index),
        windowHash=row.window_hash,
        selectedStepsHash=row.selected_steps_hash,
        sourceBlockHash=row.source_block_hash,
        generationId=row.generation_id,
        status="ready",
        publicTitle=row.public_title,
        publicSummary=row.public_summary,
        continuationContext=row.continuation_context,
        sceneImageUrl=row.scene_image_url,
        sceneAssetId=row.scene_asset_id,
        sceneFocalX=row.scene_focal_x,
        sceneFocalY=row.scene_focal_y,
        sealedLineage=row.sealed_lineage if isinstance(row.sealed_lineage, dict) else {},
        sealedPublicLanding=(
            row.sealed_public_landing if isinstance(row.sealed_public_landing, dict) else None
        ),
        publishedSlug=row.published_slug,
        createdAt=_iso(row.created_at) or _utcnow().isoformat(),
        updatedAt=_iso(row.updated_at),
    )


logger = logging.getLogger(__name__)


async def preparation_flags_for_conversations(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_ids: list[UUID],
) -> dict[UUID, tuple[bool, Optional[str]]]:
    """Return (has_unpublished_ready, published_slug) per conversation.

    Phase 8.8G-3.2.2 — optional decoration. Failures (missing table, etc.)
    must not destroy base conversation list availability. Conservative:
    has_ready=False, published=None.
    """
    flags: dict[UUID, tuple[bool, Optional[str]]] = {
        cid: (False, None) for cid in conversation_ids
    }
    if not conversation_ids:
        return flags
    try:
        result = await db.execute(
            select(StandaloneYansiPreparation).where(
                StandaloneYansiPreparation.user_id == user_id,
                StandaloneYansiPreparation.conversation_id.in_(conversation_ids),
                StandaloneYansiPreparation.deleted_at.is_(None),
                StandaloneYansiPreparation.status == YANSI_PREPARATION_STATUS_READY,
            )
        )
    except (ProgrammingError, OperationalError) as exc:
        logger.warning(
            "yansi_preparation_flags_unavailable count=%s err=%s",
            len(conversation_ids),
            type(exc).__name__,
        )
        return flags
    except Exception as exc:  # noqa: BLE001 — keep conversation list available
        logger.warning(
            "yansi_preparation_flags_failed count=%s err=%s",
            len(conversation_ids),
            type(exc).__name__,
        )
        return flags
    for row in result.scalars().all():
        cid = row.conversation_id
        has_ready, published = flags.get(cid, (False, None))
        slug = (row.published_slug or "").strip() or None
        if slug:
            published = slug
        else:
            has_ready = True
        flags[cid] = (has_ready, published)
    return flags


async def soft_delete_preparations_for_conversation(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: UUID,
    deleted_at: datetime,
) -> None:
    await db.execute(
        update(StandaloneYansiPreparation)
        .where(
            StandaloneYansiPreparation.user_id == user_id,
            StandaloneYansiPreparation.conversation_id == conversation_id,
            StandaloneYansiPreparation.deleted_at.is_(None),
        )
        .values(deleted_at=deleted_at, updated_at=deleted_at)
    )


async def list_owned_preparations(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: UUID,
) -> list[YansiPreparationDTO]:
    await _require_owned_conversation(db, user_id=user_id, conversation_id=conversation_id)

    result = await db.execute(
        select(StandaloneYansiPreparation)
        .where(
            StandaloneYansiPreparation.user_id == user_id,
            StandaloneYansiPreparation.conversation_id == conversation_id,
            StandaloneYansiPreparation.deleted_at.is_(None),
        )
        .order_by(StandaloneYansiPreparation.created_at.asc())
    )
    return [_row_to_dto(row) for row in result.scalars().all()]


async def upsert_ready_preparation(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: UUID,
    body: YansiPreparationUpsert,
) -> YansiPreparationDTO:
    conv = await _require_owned_conversation(
        db, user_id=user_id, conversation_id=conversation_id
    )

    if conv.user_id != user_id:
        raise YansiPreparationNotFoundError()

    journey_id = body.journeyId.strip().lower()
    source_identity = (body.sourceIdentity or "").strip() or build_source_identity(
        journey_id, body.journeyVersion
    )
    expected = build_source_identity(journey_id, body.journeyVersion)
    if source_identity != expected:
        raise HTTPException(status_code=422, detail="source_identity_mismatch")

    scene_url = validate_canonical_scene_url(body.sceneImageUrl)
    lineage = _validate_lineage(body.sealedLineage)
    landing = body.sealedPublicLanding
    if landing is not None:
        reject_forbidden_metadata(landing, field_name="sealed_public_landing")
        validate_bounded_json(
            landing,
            field_name="sealed_public_landing",
            max_bytes=MAX_YANSI_LANDING_JSON_BYTES,
        )

    existing = await db.execute(
        select(StandaloneYansiPreparation).where(
            StandaloneYansiPreparation.user_id == user_id,
            StandaloneYansiPreparation.conversation_id == conversation_id,
            StandaloneYansiPreparation.source_identity == source_identity,
            StandaloneYansiPreparation.deleted_at.is_(None),
        )
    )
    found = existing.scalar_one_or_none()
    if found is not None:
        return _row_to_dto(found)

    now = _utcnow()
    row = StandaloneYansiPreparation(
        user_id=user_id,
        conversation_id=conversation_id,
        source_identity=source_identity,
        journey_id=journey_id,
        journey_version=body.journeyVersion,
        window_index=body.windowIndex,
        window_hash=body.windowHash.strip(),
        selected_steps_hash=body.selectedStepsHash.strip(),
        source_block_hash=(body.sourceBlockHash or "").strip() or None,
        generation_id=body.generationId.strip(),
        status=YANSI_PREPARATION_STATUS_READY,
        public_title=body.publicTitle.strip(),
        public_summary=body.publicSummary.strip(),
        continuation_context=(body.continuationContext or "").strip() or None,
        scene_image_url=scene_url,
        scene_asset_id=(body.sceneAssetId or "").strip() or None,
        scene_focal_x=_validate_focal(body.sceneFocalX, "scene_focal_x"),
        scene_focal_y=_validate_focal(body.sceneFocalY, "scene_focal_y"),
        sealed_lineage=lineage,
        sealed_public_landing=landing,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        winner = None
        for _attempt in range(5):
            retry = await db.execute(
                select(StandaloneYansiPreparation).where(
                    StandaloneYansiPreparation.user_id == user_id,
                    StandaloneYansiPreparation.conversation_id == conversation_id,
                    StandaloneYansiPreparation.source_identity == source_identity,
                    StandaloneYansiPreparation.deleted_at.is_(None),
                )
            )
            winner = retry.scalar_one_or_none()
            if winner is not None:
                break
            await asyncio.sleep(0.05)
        if winner is None:
            raise HTTPException(status_code=409, detail="yansi_preparation_conflict")
        return _row_to_dto(winner)

    loaded = await db.execute(
        select(StandaloneYansiPreparation).where(
            StandaloneYansiPreparation.user_id == user_id,
            StandaloneYansiPreparation.conversation_id == conversation_id,
            StandaloneYansiPreparation.source_identity == source_identity,
            StandaloneYansiPreparation.deleted_at.is_(None),
        )
    )
    persisted = loaded.scalar_one_or_none()
    if persisted is None:
        raise HTTPException(status_code=409, detail="yansi_preparation_conflict")
    return _row_to_dto(persisted)


async def link_preparation_publication(
    db: AsyncSession,
    *,
    user_id: UUID,
    conversation_id: UUID,
    body: YansiPreparationPublicationLink,
) -> YansiPreparationDTO:
    await _require_owned_conversation(db, user_id=user_id, conversation_id=conversation_id)

    slug = body.slug.strip().lower()
    from backend.models.mirror_network import MirrorNetworkNode

    try:
        node_result = await db.execute(
            select(MirrorNetworkNode).where(
                MirrorNetworkNode.slug == slug,
                MirrorNetworkNode.user_id == user_id,
            )
        )
        node = node_result.scalar_one_or_none()
    except OperationalError as exc:
        raise HTTPException(status_code=404, detail="publication_not_found") from exc
    if node is None:
        raise HTTPException(status_code=404, detail="publication_not_found")

    query = select(StandaloneYansiPreparation).where(
        StandaloneYansiPreparation.user_id == user_id,
        StandaloneYansiPreparation.conversation_id == conversation_id,
        StandaloneYansiPreparation.deleted_at.is_(None),
    )
    if body.journeyId:
        query = query.where(
            StandaloneYansiPreparation.journey_id == body.journeyId.strip().lower()
        )
    if body.journeyVersion is not None:
        query = query.where(StandaloneYansiPreparation.journey_version == body.journeyVersion)

    result = await db.execute(query.order_by(StandaloneYansiPreparation.updated_at.desc().nullslast()))
    rows = list(result.scalars().all())
    if not rows:
        raise YansiPreparationNotFoundError()

    target = rows[0]
    if target.published_slug and target.published_slug != slug:
        raise HTTPException(status_code=409, detail="publication_link_conflict")
    target.published_slug = slug
    target.updated_at = _utcnow()
    try:
        await db.commit()
        await db.refresh(target)
    except IntegrityError:
        await db.rollback()
        retry = await db.execute(
            select(StandaloneYansiPreparation).where(
                StandaloneYansiPreparation.user_id == user_id,
                StandaloneYansiPreparation.conversation_id == conversation_id,
                StandaloneYansiPreparation.published_slug == slug,
                StandaloneYansiPreparation.deleted_at.is_(None),
            )
        )
        winner = retry.scalar_one_or_none()
        if winner is None:
            raise HTTPException(status_code=409, detail="publication_link_conflict")
        return _row_to_dto(winner)
    return _row_to_dto(target)
