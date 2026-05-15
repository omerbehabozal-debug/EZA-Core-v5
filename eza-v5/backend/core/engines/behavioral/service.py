# -*- coding: utf-8 -*-
"""
Safe Mode Faz 1 — behavioral calibration service.

Persists numeric scores only; never stores raw message text in production.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import numpy as np
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core.engines.behavioral.math_engine_v1 import (
    BehavioralMathEngineV1,
    BEHAVIORAL_DISCLAIMER,
)
from backend.models.behavioral import BehavioralLog, BehavioralBaseline, BehavioralFeedback
from backend.services.production_org import check_user_organization_membership

logger = logging.getLogger(__name__)

VALID_FEEDBACK_TYPES = frozenset({
    "CORRECT",
    "FALSE_POSITIVE",
    "FALSE_NEGATIVE",
    "TOO_STRICT",
    "TOO_SOFT",
    "WRONG_CATEGORY",
    "CONTEXT_MISSING",
    "USER_REPORT",
})

_engine = BehavioralMathEngineV1()


def resolve_case_snapshot(snapshot: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Production always NULL; test mode may persist sanitized snapshot."""
    settings = get_settings()
    env = (settings.ENV or "").lower()
    eza_env = (settings.EZA_ENV or "").lower()
    # Production must never persist snapshots, even if TEST_MODE is mis-set.
    if env in ("prod", "production") or eza_env in ("prod", "production"):
        return None
    if not settings.TEST_MODE:
        return None
    if not snapshot:
        return None
    # Strip any text-like keys defensively
    safe = {}
    for k, v in snapshot.items():
        if k in ("vector", "asymmetry", "schema_version", "interaction_id", "mode"):
            safe[k] = v
    return safe or None


async def append_behavioral_log(
    db: AsyncSession,
    *,
    user_id: str,
    session_id: str,
    org_id: Optional[str] = None,
    eza_score: Optional[float] = None,
    input_risk: Optional[float] = None,
    output_risk: Optional[float] = None,
    alignment_score: Optional[float] = None,
    asymmetry_index: Optional[float] = None,
    reliance_signal: Optional[float] = None,
    confidence_score: Optional[float] = None,
    data_quality: Optional[float] = None,
    mode: Optional[str] = None,
    schema_version: int = 1,
    case_snapshot: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    Insert one behavioral log row. Returns log id or None on failure (non-blocking).
    """
    settings = get_settings()
    if not settings.BEHAVIORAL_CALIBRATION_ENABLED:
        return None

    try:
        row = BehavioralLog(
            id=uuid.uuid4(),
            user_id=str(user_id),
            session_id=str(session_id),
            org_id=str(org_id) if org_id else None,
            eza_score=eza_score,
            input_risk=input_risk,
            output_risk=output_risk,
            alignment_score=alignment_score,
            asymmetry_index=asymmetry_index,
            reliance_signal=reliance_signal,
            confidence_score=confidence_score,
            data_quality=data_quality,
            mode=mode,
            schema_version=schema_version,
            case_snapshot=resolve_case_snapshot(case_snapshot),
        )
        db.add(row)
        await db.commit()
        return str(row.id)
    except Exception as exc:
        logger.warning("behavioral log append failed: %s", exc)
        await db.rollback()
        return None


async def record_from_pipeline_snapshot(
    db: AsyncSession,
    *,
    user_id: str,
    session_id: str,
    org_id: Optional[str],
    behavioral_snapshot: Optional[Dict[str, Any]],
) -> Optional[str]:
    """Map pipeline `behavioral` block to a DB log row."""
    if not behavioral_snapshot or not isinstance(behavioral_snapshot, dict):
        return None
    vec = behavioral_snapshot.get("vector") or {}
    asym = behavioral_snapshot.get("asymmetry") or {}

    in_r = vec.get("input_risk")
    out_r = vec.get("output_risk")
    eza = vec.get("eza_final")
    align = vec.get("alignment_score")

    def _pct01(x: Optional[float]) -> Optional[float]:
        if x is None:
            return None
        return float(np.clip(float(x) * 100.0, 0.0, 100.0))

    asym_idx = asym.get("index")
    if asym_idx is not None:
        # Map [0,1] health gap index to signed asymmetry proxy
        asym_idx = float(np.clip(float(asym_idx) * 2.0 - 1.0, -1.0, 1.0))

    psych = vec.get("psych_pressure_score")
    reliance = _pct01(psych) if psych is not None else None

    return await append_behavioral_log(
        db,
        user_id=user_id,
        session_id=session_id,
        org_id=org_id,
        eza_score=float(eza) if eza is not None else None,
        input_risk=_pct01(in_r),
        output_risk=_pct01(out_r),
        alignment_score=float(align) if align is not None else None,
        asymmetry_index=asym_idx,
        reliance_signal=reliance,
        confidence_score=70.0,
        data_quality=80.0,
        mode=behavioral_snapshot.get("mode"),
        schema_version=int(behavioral_snapshot.get("schema_version") or 1),
        case_snapshot=behavioral_snapshot,
    )


async def fetch_user_logs(
    db: AsyncSession,
    user_id: str,
    *,
    limit: int = 200,
    since: Optional[datetime] = None,
) -> List[BehavioralLog]:
    """Recent logs for a user (numeric fields only)."""
    q = select(BehavioralLog).where(BehavioralLog.user_id == str(user_id))
    if since:
        q = q.where(BehavioralLog.timestamp >= since)
    q = q.order_by(desc(BehavioralLog.timestamp)).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


def _series(logs: List[BehavioralLog], attr: str) -> List[float]:
    out: List[float] = []
    for row in reversed(logs):
        v = getattr(row, attr, None)
        if v is not None:
            out.append(float(v))
    return out


def _build_baseline_from_logs(logs: List[BehavioralLog]) -> Dict[str, Dict[str, float]]:
    """In-memory baseline stats per metric."""
    metrics = [
        "eza_score",
        "input_risk",
        "output_risk",
        "alignment_score",
        "asymmetry_index",
        "reliance_signal",
    ]
    baseline: Dict[str, Dict[str, float]] = {}
    for m in metrics:
        vals = _series(logs, m)
        if len(vals) < 2:
            baseline[m] = {"mean": float(np.mean(vals)) if vals else 50.0, "std": 0.0}
        else:
            baseline[m] = {"mean": float(np.mean(vals)), "std": float(np.std(vals))}
    if logs:
        first_ts = logs[-1].timestamp
        last_ts = logs[0].timestamp
        if first_ts and last_ts:
            days_covered = max(1.0, (last_ts - first_ts).total_seconds() / 86400.0)
            days_since = max(0.0, (datetime.now(timezone.utc) - last_ts).total_seconds() / 86400.0)
        else:
            days_covered, days_since = 0.0, 999.0
    else:
        days_covered, days_since = 0.0, 999.0
    baseline["_meta"] = {
        "days_covered": days_covered,
        "total_days": 30.0,
        "days_since_last": days_since,
    }
    return baseline


async def get_user_trend(db: AsyncSession, user_id: str) -> Dict[str, Any]:
    """Trend summary for /me/trend (min 5 points for trend interpretation)."""
    logs = await fetch_user_logs(db, user_id)
    n = len(logs)
    reliability = _engine.calculate_reliability(
        sample_count=n,
        days_covered=baseline_meta_days(logs),
        total_days=30.0,
        days_since_last=days_since_last(logs),
    )

    eza_series = _series(logs, "eza_score")
    reliance_series = _series(logs, "reliance_signal")
    asym_series = _series(logs, "asymmetry_index")

    ema_eza = _engine.calculate_EMA(eza_series) if eza_series else {"ok": False}
    trend_eza = _engine.calculate_trend(eza_series) if eza_series else {"ok": False}
    trend_reliance = _engine.calculate_trend(reliance_series) if reliance_series else {"ok": False}

    can_trend = n >= 5

    return {
        "user_id": user_id,
        "sample_count": n,
        "can_trend": can_trend,
        "reliability": reliability,
        "confidence": float(reliability.get("quality", 0.0)) * 100.0,
        "disclaimer": BEHAVIORAL_DISCLAIMER,
        "can_interpret": can_trend and reliability.get("level") in ("YÜKSEK", "ORTA", "DÜŞÜK"),
        "metrics": {
            "eza_score": {
                "ema": ema_eza,
                "trend": trend_eza if can_trend else {
                    "ok": False,
                    "reason": "insufficient_data",
                    "min_required": 5,
                    "count": n,
                },
            },
            "ai_reliance_trend": {
                "label": "AI Reliance Trend",
                "trend": trend_reliance if can_trend else {
                    "ok": False,
                    "reason": "insufficient_data",
                    "min_required": 5,
                    "count": n,
                },
            },
            "asymmetry_index": {
                "latest": asym_series[-1] if asym_series else None,
                "series_length": len(asym_series),
            },
        },
    }


async def get_user_insight(db: AsyncSession, user_id: str) -> Dict[str, Any]:
    """Insight / anomaly view (min 20 points)."""
    logs = await fetch_user_logs(db, user_id)
    n = len(logs)
    baseline = _build_baseline_from_logs(logs)

    if not logs:
        current = {}
    else:
        last = logs[0]
        current = {
            "eza_score": last.eza_score,
            "input_risk": last.input_risk,
            "output_risk": last.output_risk,
            "alignment_score": last.alignment_score,
            "asymmetry_index": last.asymmetry_index,
            "reliance_signal": last.reliance_signal,
        }
        current = {k: v for k, v in current.items() if v is not None}

    insight = _engine.calculate_vayBe(current, baseline, n)
    insight["sample_count"] = n
    insight["user_id"] = user_id
    return insight


async def get_user_report(
    db: AsyncSession,
    user_id: str,
    period: str = "weekly",
) -> Dict[str, Any]:
    """Aggregated report for daily | weekly | monthly."""
    period = (period or "weekly").lower()
    days = {"daily": 1, "weekly": 7, "monthly": 30}.get(period, 7)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    logs = await fetch_user_logs(db, user_id, since=since)
    trend = await get_user_trend(db, user_id)

    def _avg(attr: str) -> Optional[float]:
        vals = [getattr(r, attr) for r in logs if getattr(r, attr) is not None]
        return float(np.mean(vals)) if vals else None

    return {
        "user_id": user_id,
        "period": period,
        "days": days,
        "sample_count": len(logs),
        "averages": {
            "eza_score": _avg("eza_score"),
            "input_risk": _avg("input_risk"),
            "output_risk": _avg("output_risk"),
            "alignment_score": _avg("alignment_score"),
            "ai_reliance_signal": _avg("reliance_signal"),
        },
        "trend_summary": trend,
        "reliability": trend.get("reliability"),
        "confidence": trend.get("confidence"),
        "disclaimer": BEHAVIORAL_DISCLAIMER,
        "can_interpret": trend.get("can_interpret", False),
    }


async def submit_feedback(
    db: AsyncSession,
    *,
    user_id: str,
    org_id: Optional[str],
    feedback_type: str,
    analysis_id: Optional[str] = None,
    event_id: Optional[str] = None,
    actor_role: Optional[str] = None,
    metric_name: Optional[str] = None,
    original_label: Optional[str] = None,
    corrected_label: Optional[str] = None,
    original_score: Optional[float] = None,
    corrected_score: Optional[float] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Store calibration feedback (observational; does not change safety decisions)."""
    if not event_id and not analysis_id:
        return {
            "ok": False,
            "error": "missing_reference",
            "message": "event_id or analysis_id is required",
            "status": 400,
        }

    ft = feedback_type.upper()
    if ft not in VALID_FEEDBACK_TYPES:
        return {"ok": False, "error": "invalid_feedback_type", "allowed": sorted(VALID_FEEDBACK_TYPES), "status": 400}

    aid = None
    if analysis_id:
        try:
            aid = uuid.UUID(analysis_id)
        except ValueError:
            return {"ok": False, "error": "invalid_analysis_id", "status": 400}

    eid = None
    resolved_org_id = org_id
    if event_id:
        from backend.core.events.event_admin_service import authorize_event_feedback

        _event, err_status, err_code = await authorize_event_feedback(
            db,
            actor_user_id=user_id,
            actor_role=actor_role or "user",
            org_id=org_id,
            event_id=event_id,
        )
        if err_status is not None:
            return {"ok": False, "error": err_code, "status": err_status}
        try:
            eid = uuid.UUID(event_id)
        except ValueError:
            return {"ok": False, "error": "invalid_event_id", "status": 400}
        if _event and _event.org_id and not resolved_org_id:
            resolved_org_id = _event.org_id

    row = BehavioralFeedback(
        id=uuid.uuid4(),
        user_id=str(user_id),
        org_id=str(resolved_org_id) if resolved_org_id else None,
        analysis_id=aid,
        event_id=eid,
        feedback_type=ft,
        metric_name=metric_name,
        original_label=original_label,
        corrected_label=corrected_label,
        original_score=original_score,
        corrected_score=corrected_score,
        notes=notes,
    )
    db.add(row)
    await db.commit()
    out: Dict[str, Any] = {"ok": True, "feedback_id": str(row.id)}
    if eid:
        out["event_id"] = str(eid)
    if aid:
        out["analysis_id"] = str(aid)
    return out


async def verify_admin_can_view_user(
    db: AsyncSession,
    admin_user_id: str,
    target_user_id: str,
    org_id: str,
) -> bool:
    """Admin may only view users in the same organization."""
    if admin_user_id == target_user_id:
        return True
    admin_ok = await check_user_organization_membership(db, admin_user_id, org_id)
    target_ok = await check_user_organization_membership(db, target_user_id, org_id)
    return admin_ok and target_ok


def baseline_meta_days(logs: List[BehavioralLog]) -> float:
    if len(logs) < 2:
        return float(len(logs))
    first, last = logs[-1].timestamp, logs[0].timestamp
    if not first or not last:
        return float(len(logs))
    return max(1.0, (last - first).total_seconds() / 86400.0)


def days_since_last(logs: List[BehavioralLog]) -> float:
    if not logs or not logs[0].timestamp:
        return 999.0
    return max(0.0, (datetime.now(timezone.utc) - logs[0].timestamp).total_seconds() / 86400.0)
