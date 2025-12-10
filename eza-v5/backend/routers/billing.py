# -*- coding: utf-8 -*-
"""
EZA Proxy - Billing & Subscription
Plan management, invoice generation, usage-based billing with multi-currency support
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.utils.dependencies import get_db
from backend.auth.proxy_auth import require_proxy_auth
from backend.auth.rbac import require_role
from backend.routers.proxy_audit import audit_store

router = APIRouter()
logger = logging.getLogger(__name__)

# Exchange rate (1 USD = 20 TRY)
EXCHANGE_RATE_TRY_PER_USD = 20.0

# Billing plans with multi-currency support
BILLING_PLANS = {
    "free": {
        "TRY": {
            "name": "Free",
            "base_quota": 5000,
            "overage_price": 0.03,
            "monthly_price": 0.0,
        },
        "USD": {
            "name": "Free",
            "base_quota": 5000,
            "overage_price": 0.002,
            "monthly_price": 0.0,
        },
    },
    "pro": {
        "TRY": {
            "name": "Pro",
            "base_quota": 100000,
            "overage_price": 0.02,
            "monthly_price": 2500.0,
        },
        "USD": {
            "name": "Pro",
            "base_quota": 100000,
            "overage_price": 0.0015,
            "monthly_price": 149.0,
        },
    },
    "enterprise": {
        "TRY": {
            "name": "Enterprise",
            "base_quota": 500000,
            "overage_price": 0.015,
            "monthly_price": 0.0,  # Custom pricing
        },
        "USD": {
            "name": "Enterprise",
            "base_quota": 500000,
            "overage_price": 0.0012,
            "monthly_price": 0.0,  # Custom pricing
        },
    },
}

# Organization billing store (in production, use database)
org_billing: Dict[str, Dict[str, Any]] = {}


def convert_try_to_usd(amount_try: float) -> float:
    """Convert TRY amount to USD"""
    return amount_try / EXCHANGE_RATE_TRY_PER_USD


def convert_usd_to_try(amount_usd: float) -> float:
    """Convert USD amount to TRY"""
    return amount_usd * EXCHANGE_RATE_TRY_PER_USD


def get_org_base_currency(org_id: str) -> Literal["TRY", "USD"]:
    """
    Determine base currency for organization
    TODO: Connect to real org metadata (org.country, org.region)
    For now: dummy logic based on org_id
    """
    # Dummy logic: if org_id contains "tr" or ends with even number -> TRY
    org_id_lower = org_id.lower()
    if "tr" in org_id_lower or "turkey" in org_id_lower or "turkiye" in org_id_lower:
        return "TRY"
    
    # Check if org_id ends with even number
    try:
        last_char = org_id[-1]
        if last_char.isdigit() and int(last_char) % 2 == 0:
            return "TRY"
    except:
        pass
    
    return "USD"


class OrganizationBilling(BaseModel):
    org_id: str
    plan: str  # free | pro | enterprise
    base_currency: str  # TRY | USD
    base_quota: int
    overage_price: float
    monthly_price: float
    next_invoice_date: str


class BillingResponse(BaseModel):
    ok: bool
    plan: str
    base_currency: str
    quota: int
    request_count: int
    overage_count: int
    remaining_quota: int
    monthly_cost: Dict[str, float]  # {"TRY": 0.0, "USD": 0.0}
    price_table: Dict[str, Dict[str, float]]  # {"TRY": {"plan_price": 0, "overage_price": 0.03}, ...}


class PlanUpdateRequest(BaseModel):
    plan: str  # free | pro | enterprise
    base_currency: Optional[str] = None  # TRY | USD (optional, uses org default if not provided)


class CostBreakdownResponse(BaseModel):
    ok: bool
    base_currency: str
    monthly_cost: Dict[str, float]
    breakdown: Dict[str, Dict[str, float]]  # plan_price, overage_cost, overage_count


class InvoiceResponse(BaseModel):
    ok: bool
    invoice_id: str
    org_id: str
    period: str
    currency: str
    amount: float
    download_url: str
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


def calculate_monthly_cost(org_id: str, plan: str, base_currency: str) -> Dict[str, Any]:
    """Calculate monthly cost for organization in both currencies"""
    plan_data_try = BILLING_PLANS.get(plan, BILLING_PLANS["free"])["TRY"]
    plan_data_usd = BILLING_PLANS.get(plan, BILLING_PLANS["free"])["USD"]
    
    request_count = get_monthly_request_count(org_id)
    
    # Calculate in base currency
    base_plan_data = BILLING_PLANS.get(plan, BILLING_PLANS["free"])[base_currency]
    base_cost = base_plan_data["monthly_price"]
    overage = max(0, request_count - base_plan_data["base_quota"])
    overage_cost_base = overage * base_plan_data["overage_price"]
    total_cost_base = base_cost + overage_cost_base
    
    # Calculate in other currency
    if base_currency == "TRY":
        # Convert to USD
        cost_usd = convert_try_to_usd(total_cost_base)
        cost_try = total_cost_base
        plan_price_usd = convert_try_to_usd(base_cost)
        plan_price_try = base_cost
        overage_cost_usd = convert_try_to_usd(overage_cost_base)
        overage_cost_try = overage_cost_base
    else:
        # Convert to TRY
        cost_try = convert_usd_to_try(total_cost_base)
        cost_usd = total_cost_base
        plan_price_try = convert_usd_to_try(base_cost)
        plan_price_usd = base_cost
        overage_cost_try = convert_usd_to_try(overage_cost_base)
        overage_cost_usd = overage_cost_base
    
    return {
        "base_cost": base_cost,
        "overage_cost": overage_cost_base,
        "total_cost_base": total_cost_base,
        "monthly_cost": {
            "TRY": round(cost_try, 2),
            "USD": round(cost_usd, 2),
        },
        "request_count": request_count,
        "overage_count": overage,
        "breakdown": {
            "plan_price": {
                "TRY": round(plan_price_try, 2),
                "USD": round(plan_price_usd, 2),
            },
            "overage_cost": {
                "TRY": round(overage_cost_try, 2),
                "USD": round(overage_cost_usd, 2),
            },
            "overage_count": overage,
        }
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
        base_currency = get_org_base_currency(org_id)
        org_billing[org_id] = {
            "org_id": org_id,
            "plan": "free",
            "base_currency": base_currency,
            "next_invoice_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
        }
    
    billing_data = org_billing[org_id]
    plan = billing_data.get("plan", "free")
    base_currency = billing_data.get("base_currency", get_org_base_currency(org_id))
    
    plan_info_try = BILLING_PLANS[plan]["TRY"]
    plan_info_usd = BILLING_PLANS[plan]["USD"]
    
    # Calculate usage and cost
    cost_data = calculate_monthly_cost(org_id, plan, base_currency)
    request_count = cost_data["request_count"]
    overage_count = cost_data["overage_count"]
    quota = BILLING_PLANS[plan][base_currency]["base_quota"]
    
    return BillingResponse(
        ok=True,
        plan=plan,
        base_currency=base_currency,
        quota=quota,
        request_count=request_count,
        overage_count=overage_count,
        remaining_quota=max(0, quota - request_count),
        monthly_cost=cost_data["monthly_cost"],
        price_table={
            "TRY": {
                "plan_price": plan_info_try["monthly_price"],
                "overage_price": plan_info_try["overage_price"],
            },
            "USD": {
                "plan_price": plan_info_usd["monthly_price"],
                "overage_price": plan_info_usd["overage_price"],
            },
        }
    )


@router.post("/{org_id}/billing/plan/update")
async def update_billing_plan(
    org_id: str,
    request: PlanUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    """
    Update billing plan for organization
    Only admins can update plans
    """
    if request.plan not in BILLING_PLANS:
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
        base_currency = get_org_base_currency(org_id)
        org_billing[org_id] = {
            "org_id": org_id,
            "base_currency": base_currency,
        }
    
    # Get old plan for audit
    old_plan = org_billing[org_id].get("plan", "free")
    old_currency = org_billing[org_id].get("base_currency", get_org_base_currency(org_id))
    
    # Update plan
    org_billing[org_id]["plan"] = request.plan
    
    # Update currency if provided
    if request.base_currency:
        if request.base_currency not in ["TRY", "USD"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid currency. Must be TRY or USD"
            )
        org_billing[org_id]["base_currency"] = request.base_currency
    
    org_billing[org_id]["updated_at"] = datetime.utcnow().isoformat()
    org_billing[org_id]["updated_by"] = current_user.get("user_id") or current_user.get("email", "unknown")
    
    # Log to audit (in production, use proper audit system)
    logger.info(
        f"[Billing] Plan updated for org {org_id}: "
        f"{old_plan} -> {request.plan}, "
        f"currency: {old_currency} -> {org_billing[org_id]['base_currency']}, "
        f"by {current_user.get('user_id') or current_user.get('email')}"
    )
    
    return {
        "ok": True,
        "message": f"Plan updated to {request.plan}",
        "plan": request.plan,
        "base_currency": org_billing[org_id]["base_currency"]
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
    billing_data = org_billing.get(org_id, {"plan": "free", "base_currency": get_org_base_currency(org_id)})
    plan = billing_data.get("plan", "free")
    base_currency = billing_data.get("base_currency", get_org_base_currency(org_id))
    
    # Calculate cost
    cost_data = calculate_monthly_cost(org_id, plan, base_currency)
    
    # Generate invoice ID
    import uuid
    invoice_id = f"INV-{datetime.utcnow().strftime('%Y')}-{uuid.uuid4().hex[:6].upper()}"
    
    # Determine period
    if not month:
        now = datetime.utcnow()
        month = now.strftime("%Y-%m")
    
    amount = cost_data["monthly_cost"][base_currency]
    
    # Generate download URL (dummy for now, in production use real PDF generation)
    download_url = f"https://api.ezacore.ai/static/invoices/{invoice_id}.pdf"
    
    # Log invoice generation
    logger.info(
        f"[Billing] Invoice generated for org {org_id}: "
        f"{invoice_id}, period: {month}, amount: {amount} {base_currency}"
    )
    
    return InvoiceResponse(
        ok=True,
        invoice_id=invoice_id,
        org_id=org_id,
        period=month,
        currency=base_currency,
        amount=amount,
        download_url=download_url,
        generated_at=datetime.utcnow().isoformat()
    )


@router.get("/{org_id}/billing/usage/cost", response_model=CostBreakdownResponse)
async def get_usage_cost(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["admin"]))
):
    """
    Get current usage cost breakdown in both currencies
    """
    # Verify org access
    user_org_id = current_user.get("org_id") or current_user.get("company_id")
    if user_org_id != org_id and current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    billing_data = org_billing.get(org_id, {"plan": "free", "base_currency": get_org_base_currency(org_id)})
    plan = billing_data.get("plan", "free")
    base_currency = billing_data.get("base_currency", get_org_base_currency(org_id))
    cost_data = calculate_monthly_cost(org_id, plan, base_currency)
    
    return CostBreakdownResponse(
        ok=True,
        base_currency=base_currency,
        monthly_cost=cost_data["monthly_cost"],
        breakdown=cost_data["breakdown"]
    )
