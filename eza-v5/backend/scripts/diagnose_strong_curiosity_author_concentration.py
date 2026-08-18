# -*- coding: utf-8 -*-
"""Internal CLI: Phase 7.4.3c author-concentration diagnosis.

Read-only against the configured non-production database. Does not reseed,
does not activate Güçlü Merak, does not print DATABASE_URL.

    python -m backend.scripts.diagnose_strong_curiosity_author_concentration
"""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select

DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "data" / "internal_shadow_eval"


async def _load_inputs() -> dict[str, Any]:
    from backend.config import get_settings, is_production_settings
    from backend.core.utils.dependencies import AsyncSessionLocal
    from backend.services.mirror_network.yansi_strong_curiosity_staging_seed import (
        SLUG_PREFIX,
        assert_seed_environment,
        build_staging_seed_plan,
    )

    settings = get_settings()
    if is_production_settings(settings):
        raise RuntimeError("production_diagnosis_forbidden")
    env_label = assert_seed_environment(settings)

    async with AsyncSessionLocal() as db:
        report = await _diagnose_session(db)
        await db.rollback()
    report["environment"] = env_label
    report["databaseUrlPrinted"] = False
    report["namespace"] = SLUG_PREFIX
    report["planSize"] = build_staging_seed_plan(size="medium")["rootCount"]
    return report


async def _diagnose_session(db: Any) -> dict[str, Any]:
    from backend.models.mirror_network import MirrorNetworkNode
    from backend.services.mirror_network.discover import load_discover_eligible_roots
    from backend.services.mirror_network.yansi_strong_curiosity_author_concentration_diagnosis import (
        build_plan_roots,
        run_in_memory_diagnosis,
    )
    from backend.services.mirror_network.yansi_strong_curiosity_candidate import (
        evaluate_strong_curiosity_candidates_batch,
    )
    from backend.services.mirror_network.yansi_strong_curiosity_staging_seed import SLUG_PREFIX

    moment = datetime.now(timezone.utc)
    eligible = await load_discover_eligible_roots(db)
    staging = [
        (node, scene)
        for node, scene in eligible
        if str(getattr(node, "slug", "") or "").startswith(SLUG_PREFIX)
    ]
    if len(staging) < 50:
        raise RuntimeError(f"staging_corpus_too_small:{len(staging)}")
    pairs = [
        ((node.slug or "").strip().lower(), int(getattr(node, "journey_version", None) or 1))
        for node, _ in staging
    ]
    author_by_slug = {
        (node.slug or "").strip().lower(): str(getattr(node, "user_id", "") or "")
        for node, _ in staging
        if getattr(node, "user_id", None)
    }
    profiles = await evaluate_strong_curiosity_candidates_batch(
        db,
        pairs,
        discover_eligible=set(pairs),
        evaluated_at=moment,
    )
    parent_slugs = [slug for slug, _ in pairs]
    child_rows = (
        await db.execute(
            select(MirrorNetworkNode.parent_slug, MirrorNetworkNode.user_id, MirrorNetworkNode.slug)
            .where(MirrorNetworkNode.parent_slug.in_(parent_slugs))
            .order_by(MirrorNetworkNode.slug.asc())
        )
    ).all()
    child_authors: dict[str, list[str]] = {slug: [] for slug, _ in pairs}
    for parent, user_id, _child_slug in child_rows:
        key = str(parent or "").strip().lower()
        if key in child_authors and user_id is not None:
            child_authors[key].append(str(user_id))
    roots = build_plan_roots("medium")
    return run_in_memory_diagnosis(
        profiles,
        roots=roots,
        author_by_slug=author_by_slug,
        child_authors_by_slug=child_authors,
        evaluated_at=moment,
        include_full_semantics=True,
    )


def _write(report: dict[str, Any], directory: Path) -> dict[str, str]:
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = directory / f"phase743c-author-concentration-{stamp}.json"
    md_path = directory / f"phase743c-author-concentration-{stamp}.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    md_path.write_text(_markdown(report), encoding="utf-8")
    return {"json": str(json_path), "markdown": str(md_path)}


def _markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Phase 7.4.3c author concentration diagnosis",
        "",
        "Internal only. Do not commit. Policy was not changed. No author quota.",
        "",
        f"- diagnosis: `{report.get('diagnosis')}`",
        f"- limitedLiveExperiment: `{report.get('limitedLiveExperiment')}`",
        f"- pool: `{report.get('poolCount')}`",
        "",
        "## Owner-label mappings",
        "",
    ]
    for row in report.get("ownerLabelOnly") or []:
        top = (row.get("concentration") or {}).get("10") or {}
        lines.append(
            f"- `{row.get('mappingId')}` top10 distinct={top.get('distinctAuthorCount')} "
            f"share={top.get('topAuthorShare')} max={top.get('maxItemsPerAuthor')}"
        )
    lines.append("")
    return "\n".join(lines)


async def _run(*, write: bool, output_dir: Path) -> int:
    report = await _load_inputs()
    baseline = next(
        (row for row in report.get("ownerLabelOnly") or [] if row.get("mappingId") == "baseline"),
        {},
    )
    top10 = (baseline.get("concentration") or {}).get("10") or {}
    summary = {
        "diagnosis": report.get("diagnosis"),
        "limitedLiveExperiment": report.get("limitedLiveExperiment"),
        "baselineTop10": {
            "distinctAuthorCount": top10.get("distinctAuthorCount"),
            "topAuthorShare": top10.get("topAuthorShare"),
            "maxItemsPerAuthor": top10.get("maxItemsPerAuthor"),
        },
        "policyMutated": False,
        "authorQuota": "ABSENT",
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if write:
        paths = _write(report, output_dir)
        print(json.dumps({"artifact": paths, "commit": False}, ensure_ascii=False))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only Phase 7.4.3c author-concentration diagnosis")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--no-write", action="store_true")
    args = parser.parse_args()
    return asyncio.run(_run(write=not args.no_write, output_dir=args.output_dir))


if __name__ == "__main__":
    raise SystemExit(main())
