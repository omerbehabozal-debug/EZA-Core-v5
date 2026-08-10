# -*- coding: utf-8 -*-
"""Mirror Network service — public read path + debug validation."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.schemas.mirror_network import (
    MirrorNetworkDebugReport,
    MirrorNetworkPublicPayload,
)
from backend.services.mirror_network.types import MirrorNetworkNodeRecord
from backend.services.mirror_network.public_payload import audit_public_payload
from backend.services.mirror_network.repository import get_mirror_network_node_by_slug
from backend.services.mirror_network.safety_gate import evaluate_mirror_network_safety
from backend.services.mirror_network.slug import build_mirror_share_url


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "mirror_not_found", "message": "Mirror not found"},
    )


def node_to_public_payload(node: MirrorNetworkNodeRecord) -> MirrorNetworkPublicPayload:
    payload = MirrorNetworkPublicPayload.model_validate(node.public_payload)
    payload.slug = node.slug
    payload.shareUrl = build_mirror_share_url(node.slug)
    payload.cardTitle = node.card_title
    payload.cardDate = node.card_date
    payload.sceneImageUrl = node.scene_image_url
    if node.parent_slug:
        payload.lineage = node.parent_slug

    # Phase 4: prefer durable freeze seal for landing/scene when present.
    try:
        from backend.services.mirror_network.frozen_journey_artifact import (
            read_frozen_journey_artifact_from_private,
        )

        frozen = read_frozen_journey_artifact_from_private(
            node.private_payload if isinstance(node.private_payload, dict) else None
        )
        if frozen:
            landing = frozen.get("publicLanding") if isinstance(frozen.get("publicLanding"), dict) else {}
            if landing.get("publicTitle"):
                payload.publicTitle = str(landing["publicTitle"])
            if landing.get("publicSummary"):
                payload.publicSummary = str(landing["publicSummary"])
            if landing.get("continuationContext") is not None:
                payload.continuationContext = str(landing.get("continuationContext") or "") or None
            if landing.get("contractVersion"):
                payload.contractVersion = str(landing["contractVersion"])
            if frozen.get("publicLandingHash"):
                payload.publicLandingHash = str(frozen["publicLandingHash"])
            if frozen.get("sceneImageUrl"):
                payload.sceneImageUrl = str(frozen["sceneImageUrl"])
    except Exception:
        pass
    return payload


async def fetch_public_mirror_by_slug(
    db: AsyncSession,
    slug: str,
) -> MirrorNetworkPublicPayload:
    node = await get_mirror_network_node_by_slug(db, slug)
    if not node:
        raise _not_found()

    record = MirrorNetworkNodeRecord.from_orm(node)
    safety = evaluate_mirror_network_safety(record)
    if not safety.passed:
        raise _not_found()

    public_payload = node_to_public_payload(record)
    audit = audit_public_payload(public_payload)
    if not audit.passed:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "public_payload_invalid",
                "message": "Mirror public payload failed safety audit",
            },
        )

    return public_payload


def build_debug_report(node: MirrorNetworkNodeRecord) -> MirrorNetworkDebugReport:
    safety = evaluate_mirror_network_safety(node)
    public_payload = node_to_public_payload(node)
    audit = audit_public_payload(public_payload)
    private_data = node.private_payload if isinstance(node.private_payload, dict) else {}

    philosophy = "\n".join(
        [
            "Mirror Philosophy Check (Stage 1)",
            f"✓ Public payload audit passed: {audit.passed}",
            f"✓ Safety gate passed: {safety.passed}",
            "✓ Private payload stored separately (not returned)",
            "✓ Card = artwork metadata only on public path",
        ]
    )

    return MirrorNetworkDebugReport(
        slug=node.slug,
        shareUrl=public_payload.shareUrl,
        safety=safety,
        publicAudit=audit,
        publicPayload=public_payload,
        privatePayloadPresent=bool(private_data),
        privateFieldCount=len(private_data.keys()) if isinstance(private_data, dict) else 0,
        philosophyCheck=philosophy,
    )


async def fetch_debug_mirror_by_slug(
    db: AsyncSession,
    slug: str,
) -> MirrorNetworkDebugReport:
    node = await get_mirror_network_node_by_slug(db, slug)
    if not node:
        raise _not_found()
    return build_debug_report(MirrorNetworkNodeRecord.from_orm(node))
