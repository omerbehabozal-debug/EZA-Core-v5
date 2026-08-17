# -*- coding: utf-8 -*-
"""Internal CLI: Phase 7.4.3 production corpus shadow evaluation.

Read-only. Uses the process DATABASE_URL / configured session. Does not
hard-code credentials. Does not activate Güçlü Merak.

Run from eza-v5 with PYTHONPATH set so `backend` is importable:

    python -m backend.scripts.evaluate_strong_curiosity_production_shadow

Writes gitignored artifacts under backend/data/internal_shadow_eval/.
Do not commit the output.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "data" / "internal_shadow_eval"


async def _run(output_dir: Path, *, write: bool) -> int:
    from backend.core.utils.dependencies import DATABASE_URL, AsyncSessionLocal
    from backend.services.mirror_network.yansi_strong_curiosity_production_shadow import (
        run_production_corpus_shadow_evaluation,
        write_internal_artifact,
    )

    if not DATABASE_URL:
        print(json.dumps({"realCorpusRun": False, "reason": "NO_DATABASE_URL"}))
        return 2

    async with AsyncSessionLocal() as db:
        report = await run_production_corpus_shadow_evaluation(
            db,
            evaluated_at=datetime.now(timezone.utc),
            source="configured_database",
        )
        # Read-only: never commit ranking or corpus mutations.
        await db.rollback()

    summary = {
        "realCorpusRun": report["realCorpusRun"],
        "evaluatedAt": report["evaluatedAt"],
        "eligible": report["corpus"]["evaluatedEligibleCount"],
        "pool": report["corpus"]["candidatePoolCount"],
        "capStatus": report["corpus"]["capStatus"],
        "limitedLiveReady": report["limitedLiveReady"],
        "areas": report["areas"],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if write:
        paths = write_internal_artifact(report, directory=output_dir)
        print(json.dumps({"artifact": paths, "commit": False}, ensure_ascii=False))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read-only Phase 7.4.3 production corpus shadow evaluation"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Gitignored directory for JSON/markdown artifacts",
    )
    parser.add_argument(
        "--no-write",
        action="store_true",
        help="Evaluate and print summary only; do not write artifacts",
    )
    args = parser.parse_args()
    return asyncio.run(_run(args.output_dir, write=not args.no_write))


if __name__ == "__main__":
    sys.exit(main())
