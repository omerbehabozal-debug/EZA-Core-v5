# -*- coding: utf-8 -*-
"""Inspect mirror_network_nodes for landing migration readiness."""

from __future__ import annotations

import asyncio
import json
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


async def main(slug: str) -> int:
    url = os.getenv("DATABASE_URL")
    if not url:
        print("NO_DATABASE_URL")
        return 2
    eng = create_async_engine(url)
    async with eng.connect() as conn:
        row = (
            await conn.execute(
                text(
                    "SELECT slug, card_title, public_payload, private_payload, "
                    "scene_image_url, updated_at, published_at "
                    "FROM mirror_network_nodes WHERE slug = :slug"
                ),
                {"slug": slug},
            )
        ).fetchone()
        count = (await conn.execute(text("SELECT count(*) FROM mirror_network_nodes"))).scalar()
    await eng.dispose()

    print(json.dumps({"local_node_count": count, "found": bool(row)}, ensure_ascii=False))
    if not row:
        return 1

    public = row[2] if isinstance(row[2], dict) else json.loads(row[2] or "{}")
    private = row[3] if isinstance(row[3], dict) else json.loads(row[3] or "{}")
    priv_s = json.dumps(private, ensure_ascii=False)
    print(
        json.dumps(
            {
                "slug": row[0],
                "card_title": row[1],
                "scene_image_url": row[4],
                "public_keys": sorted(public.keys()),
                "curiosityContext": (public.get("curiosityContext") or "")[:180],
                "publicSummary": public.get("publicSummary"),
                "contractVersion": public.get("contractVersion"),
                "private_has_finalInterpretation": "finalInterpretation" in priv_s,
                "private_has_interpretation": "interpretation" in priv_s.lower(),
                "private_top_keys": sorted(private.keys()) if isinstance(private, dict) else [],
                "intelligenceBrief_keys": sorted((private.get("intelligenceBrief") or {}).keys())
                if isinstance(private.get("intelligenceBrief"), dict)
                else [],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "aksam-rotasi-94113a")))
