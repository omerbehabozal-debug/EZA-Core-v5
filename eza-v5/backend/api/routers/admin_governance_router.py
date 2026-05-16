# -*- coding: utf-8 -*-
"""
Admin governance report APIs (Stage 5) — aggregates only, org-scoped.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import require_admin
from backend.core.utils.dependencies import get_db
from backend.core.governance.reports import (
    build_governance_overview,
    build_engine_reliability,
    build_calibration_summary,
    build_weekly_calibration_report,
)
from backend.services.production_org import check_user_organization_membership

router = APIRouter(prefix="/api/admin/governance", tags=["Admin — Governance Reports"])


async def _require_org_admin(
    db: AsyncSession,
    current_user: Dict[str, Any],
    x_org_id: Optional[str],
) -> str:
    if not x_org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="x-org-id header required",
        )
    admin_ok = await check_user_organization_membership(
        db, current_user["user_id"], x_org_id
    )
    if not admin_ok:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-org access denied",
        )
    return str(x_org_id)


@router.get("/overview")
async def governance_overview(
    current_user: Dict[str, Any] = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
) -> Dict[str, Any]:
    """
    Governance overview: event volumes, distributions, feedback counts (30d window).
    """
    org_id = await _require_org_admin(db, current_user, x_org_id)
    return await build_governance_overview(db, org_id)


@router.get("/engine-reliability")
async def governance_engine_reliability(
    days: int = Query(30, ge=1, le=365),
    current_user: Dict[str, Any] = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
) -> Dict[str, Any]:
    """Engine vote aggregates, disagreement rate, low-confidence counts."""
    org_id = await _require_org_admin(db, current_user, x_org_id)
    return await build_engine_reliability(db, org_id, days=days)


@router.get("/calibration-summary")
async def governance_calibration_summary(
    weeks: int = Query(8, ge=1, le=52),
    current_user: Dict[str, Any] = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
) -> Dict[str, Any]:
    """Calibration feedback summary and weekly raw series for suggestions."""
    org_id = await _require_org_admin(db, current_user, x_org_id)
    return await build_calibration_summary(db, org_id, weeks=weeks)


@router.get("/weekly-calibration-report")
async def governance_weekly_calibration_report(
    weeks: int = Query(1, ge=1, le=12),
    current_user: Dict[str, Any] = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
) -> Dict[str, Any]:
    """
    Weekly calibration advisory report for admin review only.

    Does not modify production safety rules or thresholds.
    """
    org_id = await _require_org_admin(db, current_user, x_org_id)
    return await build_weekly_calibration_report(db, org_id, weeks=weeks)
