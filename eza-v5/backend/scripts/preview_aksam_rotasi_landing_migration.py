# -*- coding: utf-8 -*-
"""Offline dry-run preview for aksam-rotasi using live public API + operator D2 payload."""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

from migrate_public_landing import (
    FORBIDDEN_LABELS,
    build_public_landing_from_interpretation,
    is_legacy_anti_summary,
)

SLUG = "aksam-rotasi-94113a"
API = f"https://api.ezacore.ai/api/mirror-network/{SLUG}"
INTERP = Path(__file__).with_name("migration_payloads") / f"{SLUG}.interpretation.json"


def main() -> None:
    with urllib.request.urlopen(API, timeout=20) as resp:
        public = json.loads(resp.read().decode("utf-8"))
    interp = json.loads(INTERP.read_text(encoding="utf-8"))
    landing = build_public_landing_from_interpretation(interp)
    current = public.get("curiosityContext") or public.get("landingContext") or ""
    report = {
        "slug": SLUG,
        "sceneImageUrl": public.get("sceneImageUrl"),
        "currentPublicTitle": public.get("cardTitle"),
        "currentPublicSummary": current,
        "migrationSource": "operator_supplied_d2 (stored D2 not exposed on public API; private payload required for stored source)",
        "d2Available": True,
        "safeFallback": False,
        "oldPublicLandingHash": public.get("publicLandingHash"),
        "legacyAntiSummaryDetected": is_legacy_anti_summary(current),
        "architectureLabelsInCurrent": [lab for lab in FORBIDDEN_LABELS if lab in current],
        "proposed": {
            "publicTitle": landing["publicTitle"],
            "publicSummary": landing["publicSummary"],
            "continuationContext": landing["continuationContext"],
            "publicLandingHash": landing["publicLandingHash"],
            "interpretationHash": landing["interpretationHash"],
            "contractVersion": landing["contractVersion"],
            "semanticSource": landing["semanticSource"],
        },
        "valid": not any(lab in landing["publicSummary"] for lab in FORBIDDEN_LABELS),
        "note": "Execute requires production DATABASE_URL. Public API cannot write.",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
