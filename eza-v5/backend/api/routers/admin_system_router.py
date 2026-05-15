# -*- coding: utf-8 -*-
"""
Admin system endpoints — governance and production readiness probes.
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import require_admin
from backend.core.utils.dependencies import get_db
from backend.core.governance.status import build_governance_status

router = APIRouter(prefix="/api/admin/system", tags=["Admin — System"])


@router.get("/governance-status")
async def governance_status(
    _: Dict[str, Any] = Depends(require_admin()),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Safe Mode + Universal Event production readiness snapshot (admin only).

    Never raises — suitable for health/governance dashboards.
    """
    return await build_governance_status(db)
