# -*- coding: utf-8 -*-
"""Internal CLI: Phase 7.4.3a staging Strong Curiosity corpus seed.

Non-production only. Uses configured DATABASE_URL. Does not print secrets.

    python -m backend.scripts.seed_strong_curiosity_staging_corpus --size medium --dry-run
    python -m backend.scripts.seed_strong_curiosity_staging_corpus --size small
    python -m backend.scripts.seed_strong_curiosity_staging_corpus --cleanup
    python -m backend.scripts.seed_strong_curiosity_staging_corpus --size small --evaluate
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from backend.config import get_settings
from backend.services.mirror_network.yansi_strong_curiosity_staging_seed import (
    StagingSeedError,
    assert_seed_environment,
    build_staging_seed_plan,
    cleanup_staging_corpus,
    persist_staging_corpus,
)


def _summary(plan: dict) -> dict:
    return {
        "seed": plan["seed"],
        "size": plan["size"],
        "roots": plan["rootCount"],
        "archetypes": plan["archetypeCounts"],
        "intended": plan["intended"],
        "namespace": plan["namespace"],
        "users": len(plan["authorHandles"]),
    }


async def _amain(args: argparse.Namespace) -> int:
    settings = get_settings()
    try:
        env_label = assert_seed_environment(settings)
    except StagingSeedError as exc:
        print(json.dumps({"ok": False, "reason": exc.reason, "databaseUrlPrinted": False}))
        return 2

    if args.dry_run:
        plan = build_staging_seed_plan(size=args.size, seed=args.seed)
        payload = {
            "ok": True,
            "dryRun": True,
            "environment": env_label,
            "cleanup": bool(args.cleanup),
            "wouldRemovePrefix": plan["namespace"] if args.cleanup else None,
            **_summary(plan),
            "databaseUrlPrinted": False,
        }
        print(json.dumps(payload, indent=2, default=str))
        return 0

    from backend.core.utils.dependencies import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            if args.cleanup:
                removed = await cleanup_staging_corpus(db)
                print(json.dumps({"ok": True, "cleanup": removed, "environment": env_label}, indent=2))
                return 0
            result = await persist_staging_corpus(
                db, size=args.size, seed=args.seed, settings=settings
            )
            payload = {
                "ok": True,
                "environment": env_label,
                "plan": result["plan"],
                "validation": result["validation"],
                "databaseUrlPrinted": False,
            }
            print(json.dumps(payload, indent=2, default=str))
            if args.evaluate:
                from backend.services.mirror_network.yansi_strong_curiosity_production_shadow import (
                    run_production_corpus_shadow_evaluation,
                    write_internal_artifact,
                )

                report = await run_production_corpus_shadow_evaluation(
                    db,
                    evaluated_at=datetime.now(timezone.utc),
                    source="configured_database",
                )
                await db.rollback()
                out_dir = Path(__file__).resolve().parents[1] / "data" / "internal_shadow_eval"
                paths = write_internal_artifact(report, directory=out_dir)
                print(json.dumps({
                    "evaluator": {
                        "eligible": report["corpus"]["evaluatedEligibleCount"],
                        "pool": report["corpus"]["candidatePoolCount"],
                        "areas": report["areas"],
                        "limitedLiveReady": report["limitedLiveReady"],
                        "artifact": paths,
                    }
                }, indent=2, default=str))
            return 0
        except StagingSeedError as exc:
            await db.rollback()
            print(json.dumps({"ok": False, "reason": exc.reason, "environment": env_label}))
            return 2
        except Exception as exc:
            await db.rollback()
            orig = str(getattr(exc, "orig", None) or exc)
            detail = orig.split("\n")[0][:240]
            lowered = detail.lower()
            if "://" in lowered and any(token in lowered for token in ("postgres", "password", "railway")):
                detail = type(exc).__name__
            print(json.dumps({
                "ok": False,
                "reason": "seed_failed",
                "errorType": type(exc).__name__,
                "detail": detail,
                "databaseUrlPrinted": False,
            }))
            return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 7.4.3a staging corpus seed (non-production)")
    parser.add_argument("--size", choices=("small", "medium", "large"), default="medium")
    parser.add_argument("--seed", default="phase743a-v1")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--cleanup", action="store_true")
    parser.add_argument("--evaluate", action="store_true", help="Run frozen 7.4.3 evaluator after seed")
    return asyncio.run(_amain(parser.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
