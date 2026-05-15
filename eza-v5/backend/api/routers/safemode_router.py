# -*- coding: utf-8 -*-
"""
Safe Mode Faz 1 — Behavioral Calibration API.

Observational endpoints only; does not alter pipeline safety decisions.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import get_current_user, require_admin
from backend.core.utils.dependencies import get_db
from backend.core.engines.behavioral import service as behavioral_service

router = APIRouter(prefix="/api/safemode", tags=["Safe Mode — Behavioral Calibration"])


class FeedbackRequest(BaseModel):
    event_id: Optional[str] = None
    analysis_id: Optional[str] = None
    feedback_type: str = Field(
        ...,
        description=(
            "CORRECT | FALSE_POSITIVE | FALSE_NEGATIVE | TOO_STRICT | TOO_SOFT | "
            "WRONG_CATEGORY | CONTEXT_MISSING | USER_REPORT"
        ),
    )
    metric_name: Optional[str] = None
    original_label: Optional[str] = None
    corrected_label: Optional[str] = None
    original_score: Optional[float] = None
    corrected_score: Optional[float] = None
    notes: Optional[str] = None


@router.get("/me/trend")
async def me_trend(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Current user's behavioral trend (JWT)."""
    user_id = current_user["user_id"]
    return await behavioral_service.get_user_trend(db, user_id)


@router.get("/me/insight")
async def me_insight(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Current user's behavioral insight / anomaly view."""
    user_id = current_user["user_id"]
    return await behavioral_service.get_user_insight(db, user_id)


@router.get("/me/report")
async def me_report(
    period: str = Query("weekly", pattern="^(daily|weekly|monthly)$"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Current user's behavioral report."""
    user_id = current_user["user_id"]
    return await behavioral_service.get_user_report(db, user_id, period=period)


@router.post("/feedback")
async def post_feedback(
    body: FeedbackRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
):
    """Submit calibration feedback for a prior analysis or universal event."""
    if not body.event_id and not body.analysis_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "missing_reference", "message": "event_id or analysis_id is required"},
        )

    result = await behavioral_service.submit_feedback(
        db,
        user_id=current_user["user_id"],
        org_id=x_org_id,
        feedback_type=body.feedback_type,
        analysis_id=body.analysis_id,
        event_id=body.event_id,
        actor_role=current_user.get("role"),
        metric_name=body.metric_name,
        original_label=body.original_label,
        corrected_label=body.corrected_label,
        original_score=body.original_score,
        corrected_score=body.corrected_score,
        notes=body.notes,
    )
    if not result.get("ok"):
        err_status = int(result.get("status") or 400)
        raise HTTPException(status_code=err_status, detail=result)
    return result


@router.get("/admin/users/{user_id}/trend")
async def admin_user_trend(
    user_id: str,
    current_user: Dict[str, Any] = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
):
    """Admin: trend for a user in the same organization."""
    if not x_org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="x-org-id header required",
        )
    allowed = await behavioral_service.verify_admin_can_view_user(
        db, current_user["user_id"], user_id, x_org_id
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-org access denied")
    return await behavioral_service.get_user_trend(db, user_id)


@router.get("/admin/users/{user_id}/report")
async def admin_user_report(
    user_id: str,
    period: str = Query("weekly", pattern="^(daily|weekly|monthly)$"),
    current_user: Dict[str, Any] = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
):
    """Admin: report for a user in the same organization."""
    if not x_org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="x-org-id header required",
        )
    allowed = await behavioral_service.verify_admin_can_view_user(
        db, current_user["user_id"], user_id, x_org_id
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-org access denied")
    return await behavioral_service.get_user_report(db, user_id, period=period)
