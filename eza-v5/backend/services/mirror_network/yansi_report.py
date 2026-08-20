# -*- coding: utf-8 -*-
"""Phase 8.4 — minimal Yansı report ingest (not a moderation platform)."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.mirror_network import MirrorNetworkNode, YansiReport
from backend.services.mirror_network.repository import get_mirror_network_node_by_slug
from backend.services.mirror_network.visibility_access import is_direct_link_accessible

logger = logging.getLogger(__name__)

ReportReason = Literal["inappropriate", "misleading", "privacy", "other"]
ALLOWED_REASONS: frozenset[str] = frozenset(
    {"inappropriate", "misleading", "privacy", "other"}
)

ReportStatus = Literal["created", "already_reported"]


@dataclass(frozen=True)
class ReportResult:
    status: ReportStatus
    report_id: str
    slug: str
    reason: str


class YansiReportTargetError(Exception):
    """Target not reportable (missing / not publicly accessible)."""


async def create_yansi_report(
    db: AsyncSession,
    *,
    slug: str,
    reporter_user_id: UUID,
    reason: str,
) -> ReportResult:
    normalized_reason = (reason or "").strip().lower()
    if normalized_reason not in ALLOWED_REASONS:
        raise ValueError("invalid_reason")

    node = await get_mirror_network_node_by_slug(db, slug)
    if node is None or not is_direct_link_accessible(node):
        # Do not confirm existence of private/restricted targets.
        raise YansiReportTargetError(slug)

    existing = await db.execute(
        select(YansiReport).where(
            YansiReport.mirror_slug == node.slug,
            YansiReport.reporter_user_id == reporter_user_id,
        )
    )
    prior = existing.scalar_one_or_none()
    if prior is not None:
        return ReportResult(
            status="already_reported",
            report_id=str(prior.id),
            slug=node.slug,
            reason=prior.reason,
        )

    row = YansiReport(
        id=uuid.uuid4(),
        mirror_slug=node.slug,
        mirror_node_id=node.id,
        reporter_user_id=reporter_user_id,
        reason=normalized_reason,
        status="open",
        created_at=datetime.now(timezone.utc),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    logger.info(
        "yansi_report_created slug=%s reason=%s",
        node.slug,
        normalized_reason,
    )
    return ReportResult(
        status="created",
        report_id=str(row.id),
        slug=node.slug,
        reason=normalized_reason,
    )
