# -*- coding: utf-8 -*-
"""
EZA Proxy - Billing & Subscription
Plan management, invoice generation, usage-based billing
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth import require_proxy_auth
from backend.auth.rbac import require_role
from backend.routers.proxy_audit import audit_store

router = APIRouter()
logger = logging.getLogger(__name__)

# Billing plans
BILLING_PLANS = {
    "free": {
        "name": "Free",
        "base_quota": 100,  # requests per month
        "overage_price": 0.0,
        "monthly_price": 0.0,
    },
    "pro": {
        "name": "Pro",
        "base_quota": 10000,
        "overage_price": 0.01,  # $0.01 per request over quota
        "monthly_price": 99.0,
    },
    "enterprise": {
        "name": "Enterprise",
        "base_quota": 100000,
        "overage_price": 0.005,
        "monthly_price": 999.0,
    },
}

# Organization billing store (in production, use database)
org_billing: Dict[str, Dict[str, Any]] = {}


class OrganizationBilling(BaseModel):
    org_id: str
    plan: str  # free | pro | enterprise
    base_quota: int
    overage_price: float
    monthly_price: float
    next_invoice_date: str


class BillingResponse(BaseModel):
    ok: bool
    billing: OrganizationBilling
    current_usage: int
    remaining_quota: int
    estimated_cost: float


class InvoiceResponse(BaseModel):
    ok: bool
    invoice_id: str
    org_id: str
    period: str
    base_cost: float
    overage_cost: float
    total_cost: float
    request_count: int
    generated_at: str


def get_monthly_request_count(org_id: str) -> int:
    """Get request count for current month"""
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    from_date = month_start.isoformat()
    
    count = 0
    for entry in audit_store.values():
        raw_data = entry.get("raw_data", {})
        if raw_data.get("org_id") == org_id:
            entry_date = entry.get("timestamp", "")
            if entry_date >= from_date:
                count += 1
    
    return count


def calculate_monthly_cost(org_id: str, plan: str) -> Dict[str, float]:
    """Calculate monthly cost for organization"""
    plan_data = BILLING_PLANS.get(plan, BILLING_PLANS["free"])
    request_count = get_monthly_request_count(org_id)
    
    base_cost = plan_data["monthly_price"]
    overage = max(0, request_count - plan_data["base_quota"])
    overage_cost = overage * plan_data["overage_price"]
    total_cost = base_cost + overage_cost
    
    return {
        "base_cost": base_cost,
        "overage_cost": overage_cost,
        "total_cost": total_cost,
        "request_count": request_count,
    }


@router.get("/{org_id}/billing", response_model=BillingResponse)
async def get_billing(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    """
    Get billing information for organization
    Only admins can access billing
    """
    # Verify org access
    user_org_id = current_user.get("org_id") or current_user.get("company_id")
    if user_org_id != org_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    # Get or create billing
    if org_id not in org_billing:
        org_billing[org_id] = {
            "org_id": org_id,
            "plan": "free",
            "next_invoice_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
        }
    
    billing_data = org_billing[org_id]
    plan = billing_data.get("plan", "free")
    plan_info = BILLING_PLANS[plan]
    
    # Calculate usage and cost
    request_count = get_monthly_request_count(org_id)
    cost_data = calculate_monthly_cost(org_id, plan)
    
    billing = OrganizationBilling(
        org_id=org_id,
        plan=plan,
        base_quota=plan_info["base_quota"],
        overage_price=plan_info["overage_price"],
        monthly_price=plan_info["monthly_price"],
        next_invoice_date=billing_data.get("next_invoice_date", "")
    )
    
    return BillingResponse(
        ok=True,
        billing=billing,
        current_usage=request_count,
        remaining_quota=max(0, plan_info["base_quota"] - request_count),
        estimated_cost=cost_data["total_cost"]
    )


@router.post("/{org_id}/billing/plan/update")
async def update_billing_plan(
    org_id: str,
    plan: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    """
    Update billing plan for organization
    Only admins can update plans
    """
    if plan not in BILLING_PLANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plan. Must be one of: {', '.join(BILLING_PLANS.keys())}"
        )
    
    # Verify org access
    user_org_id = current_user.get("org_id") or current_user.get("company_id")
    if user_org_id != org_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    if org_id not in org_billing:
        org_billing[org_id] = {"org_id": org_id}
    
    org_billing[org_id]["plan"] = plan
    org_billing[org_id]["updated_at"] = datetime.utcnow().isoformat()
    
    logger.info(f"[Billing] Updated plan for org {org_id} to {plan}")
    
    return {
        "ok": True,
        "message": f"Plan updated to {plan}",
        "plan": plan
    }


@router.get("/{org_id}/billing/invoice/generate", response_model=InvoiceResponse)
async def generate_invoice(
    org_id: str,
    month: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    """
    Generate invoice for organization
    """
    # Verify org access
    user_org_id = current_user.get("org_id") or current_user.get("company_id")
    if user_org_id != org_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    # Get billing plan
    billing_data = org_billing.get(org_id, {"plan": "free"})
    plan = billing_data.get("plan", "free")
    
    # Calculate cost
    cost_data = calculate_monthly_cost(org_id, plan)
    
    # Generate invoice ID
    import uuid
    invoice_id = f"INV-{org_id[:8]}-{uuid.uuid4().hex[:8].upper()}"
    
    # Determine period
    if not month:
        now = datetime.utcnow()
        month = now.strftime("%Y-%m")
    
    return InvoiceResponse(
        ok=True,
        invoice_id=invoice_id,
        org_id=org_id,
        period=month,
        base_cost=cost_data["base_cost"],
        overage_cost=cost_data["overage_cost"],
        total_cost=cost_data["total_cost"],
        request_count=cost_data["request_count"],
        generated_at=datetime.utcnow().isoformat()
    )


@router.get("/{org_id}/billing/usage/cost")
async def get_usage_cost(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    """
    Get current usage cost breakdown
    """
    # Verify org access
    user_org_id = current_user.get("org_id") or current_user.get("company_id")
    if user_org_id != org_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    billing_data = org_billing.get(org_id, {"plan": "free"})
    plan = billing_data.get("plan", "free")
    cost_data = calculate_monthly_cost(org_id, plan)
    
    return {
        "ok": True,
        "org_id": org_id,
        "plan": plan,
        "request_count": cost_data["request_count"],
        "base_cost": cost_data["base_cost"],
        "overage_cost": cost_data["overage_cost"],
        "total_cost": cost_data["total_cost"],
        "breakdown": {
            "base_quota": BILLING_PLANS[plan]["base_quota"],
            "overage_requests": max(0, cost_data["request_count"] - BILLING_PLANS[plan]["base_quota"]),
            "overage_rate": BILLING_PLANS[plan]["overage_price"],
        }
    }

