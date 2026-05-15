# -*- coding: utf-8 -*-
"""
Admin Universal Events API — Stage 2.

Read-only event inspection for organization-scoped admins.
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import require_admin
from backend.core.utils.dependencies import get_db
from backend.core.events import event_admin_service
from backend.services.production_org import check_user_organization_membership

router = APIRouter(prefix="/api/admin/events", tags=["Admin — Universal Events"])


@router.get("")
async def list_events(
    source_mode: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
):
    """List universal events for the admin's organization."""
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

    rows = await event_admin_service.list_events_for_org(
        db,
        x_org_id,
        source_mode=source_mode,
        entity_type=entity_type,
        event_type=event_type,
        user_id=user_id,
        days=days,
        limit=limit,
    )
    return {
        "org_id": x_org_id,
        "count": len(rows),
        "events": [event_admin_service._event_to_summary(r) for r in rows],
    }


@router.get("/{event_id}")
async def get_event_detail(
    event_id: str,
    current_user: Dict[str, Any] = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="x-org-id"),
):
    """Event detail with feedback history (org-scoped)."""
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

    detail, err_status = await event_admin_service.get_event_detail_for_org(
        db, x_org_id, event_id
    )
    if err_status == 404:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if err_status == 403:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-org access denied")
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    return detail
