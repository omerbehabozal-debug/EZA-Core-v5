#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase 8.4 — read-only pre-existing sensitive/public eligibility audit.

Counts mirror_network_nodes that would be inconsistent with Phase 8.2 publish mapping:
  - safety_status == 'review' AND visibility == 'public'  (should not be Discover/public-listable)
  - safety_status == 'restricted' AND visibility == 'public'
  - historically "sensitive-like" rows still Discover-eligible (public+open is fine)

Does NOT mutate data. Safe for staging/CI database URLs only.

Usage:
  PYTHONPATH=eza-v5 python -m backend.scripts.audit_sensitive_public_yansi_rows
  # or with DATABASE_URL / app settings already configured for local/staging
"""

from __future__ import annotations

import asyncio
import os
import sys


async def _run() -> int:
    from sqlalchemy import text
    from backend.core.utils.dependencies import AsyncSessionLocal

    queries = {
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
        "discover_eligible_with_review": """
            SELECT COUNT(*) AS c FROM mirror_network_nodes
            WHERE lower(coalesce(visibility,'')) = 'public'
              AND lower(coalesce(safety_status,'')) = 'open'
              AND lower(coalesce(safety_status,'')) = 'review'
        """,
    }

    print("Phase 8.4 sensitive/public row audit (read-only)")
    print(f"env hint: EZA_ENV={os.getenv('EZA_ENV')!r}")
    async with AsyncSessionLocal() as session:
        for name, sql in queries.items():
            result = await session.execute(text(sql))
            count = int(result.scalar() or 0)
            print(f"{name}={count}")
    return 0


def main() -> None:
    try:
        raise SystemExit(asyncio.run(_run()))
    except Exception as exc:  # noqa: BLE001 — operational script
        print(f"AUDIT_UNAVAILABLE reason={exc.__class__.__name__}", file=sys.stderr)
        # Not a hard failure for CI without DB — callers may treat as NOT PROVEN.
        raise SystemExit(2) from exc


if __name__ == "__main__":
    main()
