# -*- coding: utf-8 -*-
"""Mirror Network — public read API (Stage 1)."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core.schemas.mirror_network import (
    MirrorNetworkDebugReport,
    MirrorNetworkPublicPayload,
)
from backend.core.schemas.mirror_sohbet import (
    MirrorSohbetSessionRequest,
    MirrorSohbetSessionResponse,
)
from backend.security.rate_limit import rate_limit_standalone
from backend.models.mirror_network import MirrorNetworkNode
from backend.services.mirror_network.fixtures import build_fixture_mirror_node
from backend.services.mirror_network.repository import create_mirror_network_node
from backend.core.utils.dependencies import get_db
from backend.services.mirror_network.service import fetch_debug_mirror_by_slug, fetch_public_mirror_by_slug
from backend.services.mirror_network.sohbet_session import create_sohbet_session

router = APIRouter(prefix="/api/mirror-network", tags=["Mirror Network"])
debug_router = APIRouter(prefix="/api/debug/mirror-network", tags=["Debug — Mirror Network"])


def _configured_debug_secret() -> str | None:
    settings = get_settings()
    return (
        (settings.EZA_DEBUG_SECRET or "").strip()
        or (os.getenv("DEBUG_SECRET") or "").strip()
        or None
    )


def _verify_debug_access(
    x_debug_secret: str | None = Header(default=None, alias="X-Debug-Secret"),
    debug_secret: str | None = Header(default=None, alias="DEBUG_SECRET"),
) -> None:
    expected = _configured_debug_secret()
    if not expected:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    provided = (x_debug_secret or debug_secret or "").strip()
    if not provided or provided != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"ok": False, "error": "debug_secret_required", "message": "Unauthorized"},
        )


@router.get("/{slug}", response_model=MirrorNetworkPublicPayload)
async def get_public_mirror(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> MirrorNetworkPublicPayload:
    """
    Public Mirror Network payload — curiosity seed only.

    Never returns raw conversation, user identity, behavioral analysis,
    full intelligence, or private metadata.
    """
    return await fetch_public_mirror_by_slug(db, slug)


@router.post(
    "/{slug}/sohbet/session",
    response_model=MirrorSohbetSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_mirror_sohbet_session(
    slug: str,
    body: MirrorSohbetSessionRequest | None = None,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(rate_limit_standalone),
) -> MirrorSohbetSessionResponse:
    """
    Start a guest sohbet from public mirror curiosity only.

    Never uses private payload, raw conversation, or user identity.
    """
    guest = body.guestToken if body else None
    return await create_sohbet_session(db, slug, guest)


@debug_router.get("/{slug}", response_model=MirrorNetworkDebugReport)
async def debug_mirror_network_node(
    slug: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_debug_access),
) -> MirrorNetworkDebugReport:
    """Dev-only validation — public/private separation audit (no private payload body)."""
    return await fetch_debug_mirror_by_slug(db, slug)


@debug_router.post("/seed-fixture", response_model=MirrorNetworkPublicPayload)
async def seed_mirror_network_fixture(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_verify_debug_access),
) -> MirrorNetworkPublicPayload:
    """Insert a QA fixture node when debug secret is configured."""
    record = build_fixture_mirror_node(slug_suffix="seed01")
    node = MirrorNetworkNode(
        id=record.id,
        slug=record.slug,
        user_id=record.user_id,
        conversation_id=record.conversation_id,
        visibility=record.visibility,
        safety_status=record.safety_status,
        card_title=record.card_title,
        card_date=record.card_date,
        scene_image_url=record.scene_image_url,
        public_payload=record.public_payload,
        private_payload=record.private_payload,
        parent_slug=record.parent_slug,
        created_at=record.created_at,
        published_at=record.published_at,
    )
    created = await create_mirror_network_node(db, node)
    return await fetch_public_mirror_by_slug(db, created.slug)
