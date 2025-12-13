# -*- coding: utf-8 -*-
"""
EZA Proxy - Alerting Router
Alert rules, webhook configuration, and alert events management
"""

import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth import require_proxy_auth
from backend.auth.rbac import require_role
from backend.services.alerting_service import (
    get_alert_rules,
    update_alert_rules,
    get_webhook_config,
    set_webhook_config,
    test_webhook,
    get_recent_alerts,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class AlertRuleUpdate(BaseModel):
    name: str
    enabled: Optional[bool] = None
    send_webhook: Optional[bool] = None


class UpdateRulesRequest(BaseModel):
    rules: List[AlertRuleUpdate]


class WebhookConfigRequest(BaseModel):
    type: str  # "slack"
    url: str


@router.get("/{org_id}/alerts/rules")
async def get_alert_rules_endpoint(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["admin", "ops"]))
):
    """
    Get alert rules for organization
    Only admin and ops can access
    """
    # Verify org access
    user_org_id = current_user.get("org_id") or current_user.get("company_id")
    if user_org_id != org_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    rules = get_alert_rules(org_id)
    webhook_config = get_webhook_config(org_id)
    
    return {
        "ok": True,
        "rules": rules,
        "webhook": {
            "type": webhook_config.get("type", "slack"),
            "url_configured": webhook_config.get("url_configured", False),
        }
    }


@router.post("/{org_id}/alerts/rules/update")
async def update_alert_rules_endpoint(
    org_id: str,
    request: UpdateRulesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["admin", "ops"]))
):
    """
    Update alert rules for organization
    Only admin and ops can update
    """
    # Verify org access
    user_org_id = current_user.get("org_id") or current_user.get("company_id")
    if user_org_id != org_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    update_alert_rules(org_id, [r.dict() for r in request.rules])
    
    logger.info(f"[Alerting] Rules updated for org {org_id} by {current_user.get('user_id')}")
    
    return {
        "ok": True,
        "message": "Alert rules updated successfully"
    }


@router.post("/{org_id}/alerts/webhook")
async def set_webhook_endpoint(
    org_id: str,
    request: WebhookConfigRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["admin", "ops"]))
):
    """
    Set webhook configuration for organization
    Only admin and ops can configure
    """
    # Verify org access
    user_org_id = current_user.get("org_id") or current_user.get("company_id")
    if user_org_id != org_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    if request.type != "slack":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Slack webhooks are supported"
        )
    
    set_webhook_config(org_id, request.type, request.url)
    
    logger.info(f"[Alerting] Webhook configured for org {org_id} by {current_user.get('user_id')}")
    
    return {
        "ok": True,
        "message": "Webhook configuration saved"
    }


@router.post("/{org_id}/alerts/webhook/test")
async def test_webhook_endpoint(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["admin", "ops"]))
):
    """
    Test webhook configuration
    Only admin and ops can test
    """
    # Verify org access
    user_org_id = current_user.get("org_id") or current_user.get("company_id")
    if user_org_id != org_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    result = await test_webhook(org_id)
    
    return {
        "ok": result["success"],
        "success": result["success"],
        "error": result.get("error"),
    }


@router.get("/{org_id}/alerts/recent")
async def get_recent_alerts_endpoint(
    org_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["admin", "ops"]))
):
    """
    Get recent alert events for organization
    Only admin and ops can access
    """
    # Verify org access
    user_org_id = current_user.get("org_id") or current_user.get("company_id")
    if user_org_id != org_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    alerts = get_recent_alerts(org_id, limit)
    
    return {
        "ok": True,
        "alerts": alerts,
        "count": len(alerts),
    }

