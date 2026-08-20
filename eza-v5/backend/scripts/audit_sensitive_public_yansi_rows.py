#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase 8.4 / 8.4.1 — read-only historical sensitive/public Yansı audit.

Does NOT mutate data. No private content / secrets in output.

Risky (contract-violating) historical states:
  1. review_and_public     — safety_status=review AND visibility=public
  2. restricted_and_public — safety_status=restricted AND visibility=public
  3. restricted_not_private — restricted but not fully withdrawn to private

Safe / expected under Phase 8.2+ mapping:
  - public + open          (normal Discover-eligible candidate)
  - unlisted + review      (sensitive publish; link-only)
  - private + review|restricted|open (withdrawn / owner-private)

Discover-eligible under *current* SQL prefilter (visibility/safety only):
  public + open  (freeze/replay not evaluated in this script)

Usage:
  PYTHONPATH=eza-v5 python -m backend.scripts.audit_sensitive_public_yansi_rows
"""

from __future__ import annotations

import asyncio
import os
import sys
from typing import Any, Mapping


# Named counts used by CI fixture tests and the live script.
AUDIT_COUNT_KEYS = (
    "review_and_public",
    "restricted_and_public",
    "restricted_not_private",
    "public_open_discover_visibility",
    "unlisted_review_link_only",
    "private_any_safety",
)


def classify_yansi_visibility_row(
    *,
    visibility: str | None,
    safety_status: str | None,
) -> dict[str, bool]:
    """Pure classifier — one row, boolean flags (for fixtures / unit tests)."""
    vis = (visibility or "").strip().lower()
    safety = (safety_status or "").strip().lower()
    return {
        "review_and_public": safety == "review" and vis == "public",
        "restricted_and_public": safety == "restricted" and vis == "public",
        "restricted_not_private": safety == "restricted" and vis != "private",
        "public_open_discover_visibility": vis == "public" and safety == "open",
        "unlisted_review_link_only": vis == "unlisted" and safety == "review",
        "private_any_safety": vis == "private",
    }


def aggregate_yansi_visibility_audit(
    rows: list[Mapping[str, Any]],
) -> dict[str, int]:
    """Aggregate fixture/live rows into named counts (read-only)."""
    counts = {key: 0 for key in AUDIT_COUNT_KEYS}
    for row in rows:
        flags = classify_yansi_visibility_row(
            visibility=row.get("visibility"),
            safety_status=row.get("safety_status"),
        )
        for key, hit in flags.items():
            if hit:
                counts[key] += 1
    return counts


def risky_historical_total(counts: Mapping[str, int]) -> int:
    """Rows that violate the post-8.2 publish mapping (need ops attention)."""
    return int(counts.get("review_and_public", 0)) + int(
        counts.get("restricted_and_public", 0)
    )


AUDIT_SQL = {
    "review_and_public": """
        SELECT COUNT(*) AS c FROM mirror_network_nodes
        WHERE lower(coalesce(safety_status,'')) = 'review'
          AND lower(coalesce(visibility,'')) = 'public'
    """,
    "restricted_and_public": """
        SELECT COUNT(*) AS c FROM mirror_network_nodes
        WHERE lower(coalesce(safety_status,'')) = 'restricted'
          AND lower(coalesce(visibility,'')) = 'public'
    """,
    "restricted_not_private": """
        SELECT COUNT(*) AS c FROM mirror_network_nodes
        WHERE lower(coalesce(safety_status,'')) = 'restricted'
          AND lower(coalesce(visibility,'')) <> 'private'
    """,
    "public_open_discover_visibility": """
        SELECT COUNT(*) AS c FROM mirror_network_nodes
        WHERE lower(coalesce(visibility,'')) = 'public'
          AND lower(coalesce(safety_status,'')) = 'open'
    """,
    "unlisted_review_link_only": """
        SELECT COUNT(*) AS c FROM mirror_network_nodes
        WHERE lower(coalesce(visibility,'')) = 'unlisted'
          AND lower(coalesce(safety_status,'')) = 'review'
    """,
    "private_any_safety": """
        SELECT COUNT(*) AS c FROM mirror_network_nodes
        WHERE lower(coalesce(visibility,'')) = 'private'
    """,
}


async def _run() -> int:
    from sqlalchemy import text
    from backend.core.utils.dependencies import AsyncSessionLocal

    print("Phase 8.4.1 sensitive/public row audit (read-only)")
    print(f"env hint: EZA_ENV={os.getenv('EZA_ENV')!r}")
    counts: dict[str, int] = {}
    async with AsyncSessionLocal() as session:
        for name, sql in AUDIT_SQL.items():
            result = await session.execute(text(sql))
            count = int(result.scalar() or 0)
            counts[name] = count
            print(f"{name}={count}")
    print(f"risky_historical_total={risky_historical_total(counts)}")
    return 0


def main() -> None:
    try:
        raise SystemExit(asyncio.run(_run()))
    except Exception as exc:  # noqa: BLE001 — operational script
        print(f"AUDIT_UNAVAILABLE reason={exc.__class__.__name__}", file=sys.stderr)
        raise SystemExit(2) from exc


if __name__ == "__main__":
    main()
