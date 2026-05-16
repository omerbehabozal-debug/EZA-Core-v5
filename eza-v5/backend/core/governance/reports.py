# -*- coding: utf-8 -*-
"""
Governance report aggregations (admin console) — numeric aggregates only.
"""

from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.governance.status import _table_exists

logger = logging.getLogger(__name__)

FORBIDDEN_RESPONSE_KEYS = frozenset({
    "message",
    "content",
    "text",
    "raw_output",
    "query",
    "user_input",
    "assistant_answer",
    "body",
    "prompt",
    "transcript",
})

LOW_CONFIDENCE_THRESHOLD = 50.0
DISAGREEMENT_SPREAD_THRESHOLD = 15.0


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _empty_overview(org_id: str, tables_ready: bool) -> Dict[str, Any]:
    return {
        "org_id": org_id,
        "tables_ready": tables_ready,
        "event_counts": {"last_24h": 0, "last_7d": 0, "last_30d": 0},
        "source_mode_distribution": {},
        "risk_label_distribution": {},
        "average_confidence": None,
        "average_reliability": None,
        "feedback_count": 0,
        "false_positive_count": 0,
        "false_negative_count": 0,
    }


def _sanitize_distribution(data: Dict[str, Any]) -> Dict[str, int]:
    """Keep only string keys with integer counts."""
    out: Dict[str, int] = {}
    for k, v in (data or {}).items():
        if k in FORBIDDEN_RESPONSE_KEYS:
            continue
        kl = k.lower()
        if any(kl == t or kl.startswith(f"{t}_") or kl.endswith(f"_{t}") for t in FORBIDDEN_RESPONSE_KEYS):
            continue
        if isinstance(k, str):
            try:
                out[k] = int(v)
            except (TypeError, ValueError):
                continue
    return out


async def _feedback_table_ready(db: AsyncSession) -> bool:
    return await _table_exists(db, "behavioral_feedback")


async def _events_table_ready(db: AsyncSession) -> bool:
    return await _table_exists(db, "eza_events")


async def _count_events_since(
    db: AsyncSession, org_id: str, since: datetime
) -> int:
    result = await db.execute(
        text(
            """
            SELECT COUNT(*)::int
            FROM eza_events
            WHERE org_id = :org_id AND timestamp >= :since
            """
        ),
        {"org_id": org_id, "since": since},
    )
    val = result.scalar()
    return int(val or 0)


async def _distribution(
    db: AsyncSession,
    org_id: str,
    column: str,
    since: datetime,
) -> Dict[str, int]:
    if column not in ("source_mode", "risk_label", "event_type"):
        return {}
    sql = text(
        f"""
        SELECT {column} AS label, COUNT(*)::int AS cnt
        FROM eza_events
        WHERE org_id = :org_id
          AND timestamp >= :since
          AND {column} IS NOT NULL
        GROUP BY {column}
        """
    )
    result = await db.execute(sql, {"org_id": org_id, "since": since})
    return _sanitize_distribution({str(row[0]): row[1] for row in result.fetchall()})


async def _avg_scores(
    db: AsyncSession, org_id: str, since: datetime
) -> Tuple[Optional[float], Optional[float]]:
    result = await db.execute(
        text(
            """
            SELECT
                AVG(confidence_score)::float,
                AVG(reliability_score)::float
            FROM eza_events
            WHERE org_id = :org_id
              AND timestamp >= :since
            """
        ),
        {"org_id": org_id, "since": since},
    )
    row = result.fetchone()
    if not row:
        return None, None
    conf, rel = row[0], row[1]
    return (
        round(float(conf), 2) if conf is not None else None,
        round(float(rel), 2) if rel is not None else None,
    )


async def _feedback_stats(
    db: AsyncSession, org_id: str, since: datetime
) -> Dict[str, int]:
    if not await _feedback_table_ready(db):
        return {
            "feedback_count": 0,
            "false_positive_count": 0,
            "false_negative_count": 0,
        }
    result = await db.execute(
        text(
            """
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE feedback_type = 'FALSE_POSITIVE')::int AS fp,
                COUNT(*) FILTER (WHERE feedback_type = 'FALSE_NEGATIVE')::int AS fn
            FROM behavioral_feedback
            WHERE org_id = :org_id AND timestamp >= :since
            """
        ),
        {"org_id": org_id, "since": since},
    )
    row = result.fetchone()
    if not row:
        return {"feedback_count": 0, "false_positive_count": 0, "false_negative_count": 0}
    return {
        "feedback_count": int(row[0] or 0),
        "false_positive_count": int(row[1] or 0),
        "false_negative_count": int(row[2] or 0),
    }


async def build_governance_overview(
    db: AsyncSession, org_id: str
) -> Dict[str, Any]:
    """Overview metrics for admin governance console."""
    tables_ready = await _events_table_ready(db)
    if not tables_ready:
        fb = await _feedback_stats(db, org_id, _utc_now() - timedelta(days=30))
        out = _empty_overview(org_id, False)
        out["feedback_count"] = fb["feedback_count"]
        out["false_positive_count"] = fb["false_positive_count"]
        out["false_negative_count"] = fb["false_negative_count"]
        return out

    now = _utc_now()
    since_30 = now - timedelta(days=30)
    since_7 = now - timedelta(days=7)
    since_24 = now - timedelta(hours=24)

    try:
        fb = await _feedback_stats(db, org_id, since_30)
        avg_conf, avg_rel = await _avg_scores(db, org_id, since_30)
        return {
            "org_id": org_id,
            "tables_ready": True,
            "event_counts": {
                "last_24h": await _count_events_since(db, org_id, since_24),
                "last_7d": await _count_events_since(db, org_id, since_7),
                "last_30d": await _count_events_since(db, org_id, since_30),
            },
            "source_mode_distribution": await _distribution(
                db, org_id, "source_mode", since_30
            ),
            "risk_label_distribution": await _distribution(
                db, org_id, "risk_label", since_30
            ),
            "average_confidence": avg_conf,
            "average_reliability": avg_rel,
            "feedback_count": fb["feedback_count"],
            "false_positive_count": fb["false_positive_count"],
            "false_negative_count": fb["false_negative_count"],
        }
    except Exception as exc:
        logger.warning("governance overview failed: %s", exc)
        return _empty_overview(org_id, False)


def _parse_engine_votes(votes: Any) -> Dict[str, float]:
    """Extract numeric engine scores from engine_votes JSON."""
    if not votes or not isinstance(votes, dict):
        return {}
    scores: Dict[str, float] = {}
    for engine, payload in votes.items():
        if engine in FORBIDDEN_RESPONSE_KEYS:
            continue
        if isinstance(payload, dict):
            for key in ("score", "value", "confidence", "weight"):
                if key in payload and payload[key] is not None:
                    try:
                        scores[str(engine)] = float(payload[key])
                        break
                    except (TypeError, ValueError):
                        pass
        elif isinstance(payload, (int, float)):
            scores[str(engine)] = float(payload)
    return scores


def _compute_disagreement_rate(votes_list: List[Dict[str, float]]) -> float:
    if not votes_list:
        return 0.0
    disagreements = 0
    for scores in votes_list:
        if len(scores) < 2:
            continue
        vals = list(scores.values())
        if max(vals) - min(vals) >= DISAGREEMENT_SPREAD_THRESHOLD:
            disagreements += 1
    return round(disagreements / len(votes_list), 4)


async def build_engine_reliability(
    db: AsyncSession, org_id: str, days: int = 30
) -> Dict[str, Any]:
    """Engine-level reliability aggregates from engine_votes."""
    tables_ready = await _events_table_ready(db)
    empty = {
        "org_id": org_id,
        "tables_ready": tables_ready,
        "engine_average_scores": {},
        "disagreement_rate": 0.0,
        "low_confidence_event_count": 0,
        "top_misreported_metrics": [],
        "sample_size": 0,
    }
    if not tables_ready:
        return empty

    since = _utc_now() - timedelta(days=days)
    try:
        result = await db.execute(
            text(
                """
                SELECT engine_votes, confidence_score
                FROM eza_events
                WHERE org_id = :org_id
                  AND timestamp >= :since
                  AND engine_votes IS NOT NULL
                """
            ),
            {"org_id": org_id, "since": since},
        )
        rows = result.fetchall()

        engine_sums: Dict[str, List[float]] = defaultdict(list)
        parsed_votes: List[Dict[str, float]] = []
        low_confidence = 0
        total_with_votes = 0

        for evotes, conf in rows:
            scores = _parse_engine_votes(evotes)
            if scores:
                total_with_votes += 1
                parsed_votes.append(scores)
                for eng, val in scores.items():
                    engine_sums[eng].append(val)
            if conf is not None and float(conf) < LOW_CONFIDENCE_THRESHOLD:
                low_confidence += 1

        engine_avg = {
            eng: round(sum(vals) / len(vals), 2)
            for eng, vals in engine_sums.items()
            if vals
        }

        misreported: List[Dict[str, Any]] = []
        if await _feedback_table_ready(db):
            fb = await db.execute(
                text(
                    """
                    SELECT metric_name, COUNT(*)::int AS cnt
                    FROM behavioral_feedback
                    WHERE org_id = :org_id
                      AND timestamp >= :since
                      AND metric_name IS NOT NULL
                      AND feedback_type IN (
                        'FALSE_POSITIVE', 'FALSE_NEGATIVE',
                        'WRONG_CATEGORY', 'CONTEXT_MISSING'
                      )
                    GROUP BY metric_name
                    ORDER BY cnt DESC
                    LIMIT 10
                    """
                ),
                {"org_id": org_id, "since": since},
            )
            misreported = [
                {"metric_name": str(r[0]), "count": int(r[1])}
                for r in fb.fetchall()
                if r[0] and str(r[0]) not in FORBIDDEN_RESPONSE_KEYS
            ]

        return {
            "org_id": org_id,
            "tables_ready": True,
            "engine_average_scores": engine_avg,
            "disagreement_rate": _compute_disagreement_rate(parsed_votes),
            "low_confidence_event_count": low_confidence,
            "top_misreported_metrics": misreported,
            "sample_size": total_with_votes,
        }
    except Exception as exc:
        logger.warning("engine reliability report failed: %s", exc)
        empty["tables_ready"] = False
        return empty


async def build_calibration_summary(
    db: AsyncSession, org_id: str, weeks: int = 8
) -> Dict[str, Any]:
    """Calibration feedback summary for tuning suggestions."""
    feedback_ready = await _feedback_table_ready(db)
    events_ready = await _events_table_ready(db)

    empty = {
        "org_id": org_id,
        "tables_ready": {"behavioral_feedback": feedback_ready, "eza_events": events_ready},
        "total_feedback": 0,
        "feedback_type_distribution": {},
        "most_corrected_risk_labels": [],
        "too_strict_ratio": None,
        "too_soft_ratio": None,
        "weekly_calibration_raw": [],
    }
    if not feedback_ready:
        return empty

    since = _utc_now() - timedelta(weeks=weeks)
    try:
        type_dist_result = await db.execute(
            text(
                """
                SELECT feedback_type, COUNT(*)::int
                FROM behavioral_feedback
                WHERE org_id = :org_id AND timestamp >= :since
                GROUP BY feedback_type
                """
            ),
            {"org_id": org_id, "since": since},
        )
        type_dist = _sanitize_distribution(
            {str(r[0]): r[1] for r in type_dist_result.fetchall()}
        )
        total = sum(type_dist.values())

        strict_count = type_dist.get("TOO_STRICT", 0)
        soft_count = type_dist.get("TOO_SOFT", 0)
        denom = strict_count + soft_count
        strict_ratio = round(strict_count / denom, 4) if denom else None
        soft_ratio = round(soft_count / denom, 4) if denom else None

        risk_labels: List[Dict[str, Any]] = []
        if events_ready:
            risk_result = await db.execute(
                text(
                    """
                    SELECT e.risk_label, COUNT(*)::int
                    FROM behavioral_feedback f
                    JOIN eza_events e ON e.id = f.event_id
                    WHERE f.org_id = :org_id
                      AND f.timestamp >= :since
                      AND e.risk_label IS NOT NULL
                      AND f.feedback_type IN (
                        'FALSE_POSITIVE', 'FALSE_NEGATIVE',
                        'WRONG_CATEGORY', 'TOO_STRICT', 'TOO_SOFT'
                      )
                    GROUP BY e.risk_label
                    ORDER BY COUNT(*) DESC
                    LIMIT 10
                    """
                ),
                {"org_id": org_id, "since": since},
            )
            risk_labels = [
                {"risk_label": str(r[0]), "count": int(r[1])}
                for r in risk_result.fetchall()
            ]

        weekly_result = await db.execute(
            text(
                """
                SELECT
                    date_trunc('week', timestamp) AS week_start,
                    feedback_type,
                    COUNT(*)::int AS cnt
                FROM behavioral_feedback
                WHERE org_id = :org_id AND timestamp >= :since
                GROUP BY week_start, feedback_type
                ORDER BY week_start ASC
                """
            ),
            {"org_id": org_id, "since": since},
        )
        weekly_raw: List[Dict[str, Any]] = []
        for week_start, fb_type, cnt in weekly_result.fetchall():
            weekly_raw.append({
                "week_start": week_start.isoformat() if week_start else None,
                "feedback_type": str(fb_type),
                "count": int(cnt),
            })

        return {
            "org_id": org_id,
            "tables_ready": {
                "behavioral_feedback": feedback_ready,
                "eza_events": events_ready,
            },
            "total_feedback": total,
            "feedback_type_distribution": type_dist,
            "most_corrected_risk_labels": risk_labels,
            "too_strict_ratio": strict_ratio,
            "too_soft_ratio": soft_ratio,
            "weekly_calibration_raw": weekly_raw,
        }
    except Exception as exc:
        logger.warning("calibration summary failed: %s", exc)
        return empty
