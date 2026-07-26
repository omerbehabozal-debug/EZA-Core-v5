# -*- coding: utf-8 -*-
"""
Migrate Mirror Network public landing to mirror-public-landing-v1.

Usage:
  python -m backend.scripts.migrate_public_landing --slug aksam-rotasi-94113a --dry-run
  python -m backend.scripts.migrate_public_landing --slug aksam-rotasi-94113a --execute
  python -m backend.scripts.migrate_public_landing --slug aksam-rotasi-94113a --rollback --migration-id <id>

Requires DATABASE_URL. Never regenerates scene images or changes slug/parent lineage.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.models.mirror_network import MirrorNetworkNode
from backend.services.mirror_network.public_payload import build_public_payload_from_curiosity

CONTRACT_VERSION = "mirror-public-landing-v1"
SAFE_SUMMARY = "Bu Ayna, paylaşılan bir deneyim ve onun uyandırdığı meraktan doğdu."
SAFE_TITLE = "Paylaşılan Merak"
SAFE_CONTINUATION = "Bu Ayna’daki merak alanını kendi sorularınla sürdürmek istiyorsun."

FORBIDDEN_LABELS = (
    "Cephe malzemesi",
    "Malzeme seçimi",
    "Işık ve gölge",
    "Mimari eskiz",
    "Cephe kararı",
)
FORBIDDEN_PHRASES = (
    "güvenli bir giriş kapısıdır",
    "konuşmayı yeniden anlatmaz",
    "sohbeti yeniden anlatmaz",
    "bu merak alanı",
)

ROLLBACK_DIR = Path(__file__).resolve().parent / "_landing_migration_rollbacks"


def _clean(text: str, max_len: int = 280) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())[:max_len]


def _first_sentence(text: str, max_len: int = 160) -> str:
    normalized = _clean(text, 500)
    match = re.match(r"^(.+?[.!?…])(\s|$)", normalized)
    return _clean(match.group(1) if match else normalized, max_len)


def _sha256(payload: Any) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _djb2(text: str) -> str:
    h = 5381
    for ch in text:
        h = ((h * 33) ^ ord(ch)) & 0xFFFFFFFF
    return f"{h:08x}"


def interpretation_hash_sync(interp: Dict[str, Any]) -> str:
    joined = "|".join(
        [
            str(interp.get("title") or ""),
            str(interp.get("imageIntent") or ""),
            str(interp.get("visualNarrative") or ""),
            str(interp.get("interpretationSummary") or ""),
        ]
    )
    return _djb2(joined)


def is_legacy_anti_summary(text: str) -> bool:
    lower = (text or "").lower()
    if "güvenli bir giriş kapısıdır" in lower:
        return True
    if "konuşmayı yeniden anlatmaz" in lower:
        return True
    if "sohbeti yeniden anlatmaz" in lower:
        return True
    if "bu merak alanı," in lower and "üzerine doğmuş" in lower:
        return True
    return False


def contains_forbidden(text: str) -> bool:
    lower = (text or "").lower()
    for phrase in FORBIDDEN_PHRASES:
        if phrase in lower:
            return True
    for label in FORBIDDEN_LABELS:
        if label in (text or ""):
            return True
    return False


def build_public_landing_from_interpretation(
    interp: Dict[str, Any],
    *,
    generation_id: Optional[str] = None,
) -> Dict[str, Any]:
    title = _clean(str(interp.get("title") or SAFE_TITLE), 64) or SAFE_TITLE
    scene = _first_sentence(str(interp.get("visualNarrative") or ""), 170)
    curiosity_raw = _clean(str(interp.get("interpretationSummary") or ""), 180) or _clean(
        str(interp.get("imageIntent") or ""), 160
    )
    curiosity = _first_sentence(curiosity_raw, 150)
    if scene and curiosity and scene.lower() != curiosity.lower():
        c2 = curiosity if curiosity.endswith(".") else f"{curiosity.rstrip('.')}."
        if not re.match(r"^(bu ayna|this mirror)\b", c2, flags=re.I):
            c2 = f"Bu Ayna, {c2[0].lower()}{c2[1:]}"
        summary = f"{scene if scene.endswith('.') else scene + '.'} {c2}"
    elif scene:
        summary = scene if scene.endswith(".") else f"{scene}."
    elif curiosity:
        summary = curiosity if curiosity.endswith(".") else f"{curiosity}."
    else:
        summary = SAFE_SUMMARY

    summary = _clean(summary, 320)
    if contains_forbidden(summary) or not summary:
        summary = SAFE_SUMMARY

    intent = _clean(str(interp.get("imageIntent") or ""), 200)
    base = intent or _clean(str(interp.get("interpretationSummary") or ""), 180)
    if base:
        if "konuşmayı sürdür" in base.lower() or "konusmayi surdur" in base.lower():
            continuation = _clean(base, 280)
        else:
            line = base[:-1] if base.endswith(".") else base
            continuation = _clean(
                f"{line} üzerine konuşmayı sürdür; turistik klişelerden uzak, yerel ve kişisel bir merakla devam et.",
                280,
            )
    else:
        continuation = SAFE_CONTINUATION

    landing = {
        "publicTitle": title,
        "publicSummary": summary,
        "continuationContext": continuation,
        "topicCategory": _clean(str(interp.get("topicCategory") or "general_curiosity"), 48),
        "semanticSource": "d2_interpretation",
        "interpretationHash": interpretation_hash_sync(interp),
        "generationId": generation_id,
        "contractVersion": CONTRACT_VERSION,
        "isFallback": False,
    }
    landing["publicLandingHash"] = _sha256(
        {
            "publicTitle": landing["publicTitle"],
            "publicSummary": landing["publicSummary"],
            "continuationContext": landing["continuationContext"],
            "contractVersion": CONTRACT_VERSION,
        }
    )
    return landing


def build_safe_landing(*, title: Optional[str] = None) -> Dict[str, Any]:
    landing = {
        "publicTitle": _clean(title or SAFE_TITLE, 64) or SAFE_TITLE,
        "publicSummary": SAFE_SUMMARY,
        "continuationContext": SAFE_CONTINUATION,
        "topicCategory": "general_curiosity",
        "semanticSource": "safe_fallback",
        "interpretationHash": "none",
        "contractVersion": CONTRACT_VERSION,
        "isFallback": True,
    }
    landing["publicLandingHash"] = _sha256(
        {
            "publicTitle": landing["publicTitle"],
            "publicSummary": landing["publicSummary"],
            "continuationContext": landing["continuationContext"],
            "contractVersion": CONTRACT_VERSION,
        }
    )
    return landing


def extract_interpretation(private_payload: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], str]:
    """Return (interpretation, source_label)."""
    if not isinstance(private_payload, dict):
        return None, "missing"

    candidates: list[Tuple[str, Any]] = [
        ("private.finalInterpretation", private_payload.get("finalInterpretation")),
        ("private.mirrorFinalInterpretation", private_payload.get("mirrorFinalInterpretation")),
        (
            "private.intelligenceBrief.finalInterpretation",
            (private_payload.get("intelligenceBrief") or {}).get("finalInterpretation")
            if isinstance(private_payload.get("intelligenceBrief"), dict)
            else None,
        ),
        (
            "private.curiosityPipeline.finalInterpretation",
            (private_payload.get("curiosityPipeline") or {}).get("finalInterpretation")
            if isinstance(private_payload.get("curiosityPipeline"), dict)
            else None,
        ),
    ]
    for label, value in candidates:
        if isinstance(value, dict) and str(value.get("title") or "").strip() and str(
            value.get("visualNarrative") or ""
        ).strip():
            return value, label
    return None, "unavailable"


def propose_migration(
    *,
    node: MirrorNetworkNode,
    interpretation_override: Optional[Dict[str, Any]] = None,
    require_d2: bool = True,
) -> Dict[str, Any]:
    public = dict(node.public_payload or {})
    private = dict(node.private_payload or {})
    current_summary = (
        str(public.get("publicSummary") or public.get("curiosityContext") or public.get("landingContext") or "")
        .strip()
    )
    current_title = str(public.get("publicTitle") or node.card_title or "").strip()
    old_hash = public.get("publicLandingHash")

    interp = interpretation_override
    source = "operator_supplied_d2"
    if interp is None:
        interp, source = extract_interpretation(private)

    if interp is not None:
        landing = build_public_landing_from_interpretation(interp)
        fallback_used = False
    else:
        if require_d2:
            landing = None
            fallback_used = False
        else:
            landing = build_safe_landing(title=current_title)
            fallback_used = True
            source = "safe_fallback"

    report = {
        "slug": node.slug,
        "sceneImageUrl": node.scene_image_url,
        "currentPublicTitle": current_title,
        "currentPublicSummary": current_summary,
        "currentCuriosityContext": public.get("curiosityContext"),
        "migrationSource": source,
        "d2Available": interp is not None,
        "safeFallback": fallback_used,
        "oldPublicLandingHash": old_hash,
        "legacyAntiSummaryDetected": is_legacy_anti_summary(current_summary),
        "architectureLabelsInCurrent": [lab for lab in FORBIDDEN_LABELS if lab in current_summary],
        "proposed": None,
        "valid": False,
        "blockReason": None,
    }

    if landing is None:
        report["blockReason"] = "d2_interpretation_unavailable"
        return report

    if contains_forbidden(landing["publicSummary"]) or contains_forbidden(landing["publicTitle"]):
        report["blockReason"] = "proposed_copy_contains_forbidden_content"
        report["proposed"] = landing
        return report

    if require_d2 and fallback_used:
        report["blockReason"] = "require_d2_but_fallback"
        report["proposed"] = landing
        return report

    report["proposed"] = {
        "publicTitle": landing["publicTitle"],
        "publicSummary": landing["publicSummary"],
        "continuationContext": landing["continuationContext"],
        "publicLandingHash": landing["publicLandingHash"],
        "interpretationHash": landing["interpretationHash"],
        "contractVersion": landing["contractVersion"],
        "semanticSource": landing["semanticSource"],
    }
    report["valid"] = True
    return report


def apply_landing_to_node(node: MirrorNetworkNode, landing: Dict[str, Any], audit: Dict[str, Any]) -> None:
    public = dict(node.public_payload or {})
    private = dict(node.private_payload or {})
    pipeline = dict(private.get("curiosityPipeline") or {})

    pipeline["cardTitle"] = landing["publicTitle"]
    pipeline["curiosityContext"] = {"text": landing["publicSummary"]}
    pipeline["landingContext"] = landing["publicSummary"]
    pipeline["coreCuriosity"] = landing["continuationContext"][:140]
    pipeline["semanticSource"] = landing["semanticSource"]
    pipeline["publicLanding"] = landing

    curiosity_public = {
        "coreCuriosity": pipeline.get("coreCuriosity"),
        "curiosityContext": pipeline.get("curiosityContext"),
        "landingContext": pipeline.get("landingContext"),
        "hooks": pipeline.get("hooks") or public.get("hooks") or [],
        "seedQuestions": pipeline.get("seedQuestions") or public.get("seedQuestions") or [],
        "discoverySignals": pipeline.get("discoverySignals") or public.get("discoverySignals") or [],
        "collectionTags": pipeline.get("collectionTags") or public.get("collectionTags") or [],
        "seed": pipeline.get("seed") or public.get("seed") or {"topicCategory": "general_curiosity", "mood": "discovery"},
        "shareVoice": pipeline.get("shareVoice") or public.get("shareVoice"),
        "publicLanding": landing,
        "semanticSource": landing["semanticSource"],
    }

    rebuilt = build_public_payload_from_curiosity(
        slug=node.slug,
        card_title=landing["publicTitle"],
        card_date=node.card_date,
        scene_image_url=node.scene_image_url,
        curiosity_public=curiosity_public,
        parent_slug=node.parent_slug,
    )
    public_dict = rebuilt.model_dump()
    public_dict["migrationAudit"] = audit

    node.card_title = landing["publicTitle"]
    node.public_payload = public_dict
    private["curiosityPipeline"] = pipeline
    private["landingMigrationAudit"] = audit
    node.private_payload = private


async def run(args: argparse.Namespace) -> int:
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print(json.dumps({"ok": False, "error": "DATABASE_URL missing"}))
        return 2

    interpretation_override = None
    if args.interpretation_file:
        interpretation_override = json.loads(Path(args.interpretation_file).read_text(encoding="utf-8"))

    engine = create_async_engine(db_url)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        if args.rollback:
            return await rollback(session, args)

        result = await session.execute(select(MirrorNetworkNode).where(MirrorNetworkNode.slug == args.slug))
        node = result.scalar_one_or_none()
        if not node:
            print(json.dumps({"ok": False, "error": "slug_not_found", "slug": args.slug}, ensure_ascii=False))
            await engine.dispose()
            return 1

        report = propose_migration(
            node=node,
            interpretation_override=interpretation_override,
            require_d2=not args.allow_safe_fallback,
        )
        report["mode"] = "dry-run" if args.dry_run or not args.execute else "execute"
        print(json.dumps(report, ensure_ascii=False, indent=2))

        if not report["valid"]:
            await engine.dispose()
            return 3

        if args.dry_run or not args.execute:
            await engine.dispose()
            return 0

        migration_id = str(uuid.uuid4())
        ROLLBACK_DIR.mkdir(parents=True, exist_ok=True)
        snapshot = {
            "migrationId": migration_id,
            "slug": node.slug,
            "savedAt": datetime.now(timezone.utc).isoformat(),
            "card_title": node.card_title,
            "scene_image_url": node.scene_image_url,
            "public_payload": node.public_payload,
            "private_payload": node.private_payload,
            "updated_at": node.updated_at.isoformat() if node.updated_at else None,
            "published_at": node.published_at.isoformat() if node.published_at else None,
        }
        snap_path = ROLLBACK_DIR / f"{args.slug}-{migration_id}.json"
        snap_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")

        audit = {
            "migrationId": migration_id,
            "migratedAt": datetime.now(timezone.utc).isoformat(),
            "contractVersion": CONTRACT_VERSION,
            "migrationSource": report["migrationSource"],
            "previousHadAntiSummaryTemplate": report["legacyAntiSummaryDetected"],
            "previousTitle": report["currentPublicTitle"],
            "previousSummary": report["currentPublicSummary"],
            "rollbackSnapshot": str(snap_path),
            "requireD2": not args.allow_safe_fallback,
        }
        landing_full = {
            "publicTitle": report["proposed"]["publicTitle"],
            "publicSummary": report["proposed"]["publicSummary"],
            "continuationContext": report["proposed"]["continuationContext"],
            "topicCategory": (interpretation_override or {}).get("topicCategory")
            or "travel",
            "semanticSource": report["proposed"]["semanticSource"],
            "interpretationHash": report["proposed"]["interpretationHash"],
            "contractVersion": CONTRACT_VERSION,
            "publicLandingHash": report["proposed"]["publicLandingHash"],
            "isFallback": bool(report["safeFallback"]),
        }
        apply_landing_to_node(node, landing_full, audit)
        await session.commit()
        print(
            json.dumps(
                {
                    "ok": True,
                    "executed": True,
                    "migrationId": migration_id,
                    "rollbackSnapshot": str(snap_path),
                    "publicTitle": landing_full["publicTitle"],
                    "publicSummary": landing_full["publicSummary"],
                    "rollbackCommand": (
                        f"python -m backend.scripts.migrate_public_landing "
                        f"--slug {args.slug} --rollback --migration-id {migration_id}"
                    ),
                },
                ensure_ascii=False,
                indent=2,
            )
        )

    await engine.dispose()
    return 0


async def rollback(session: AsyncSession, args: argparse.Namespace) -> int:
    if not args.migration_id:
        print(json.dumps({"ok": False, "error": "migration_id_required"}))
        return 2
    snap_path = ROLLBACK_DIR / f"{args.slug}-{args.migration_id}.json"
    if not snap_path.exists():
        print(json.dumps({"ok": False, "error": "snapshot_not_found", "path": str(snap_path)}))
        return 1
    snapshot = json.loads(snap_path.read_text(encoding="utf-8"))
    result = await session.execute(select(MirrorNetworkNode).where(MirrorNetworkNode.slug == args.slug))
    node = result.scalar_one_or_none()
    if not node:
        print(json.dumps({"ok": False, "error": "slug_not_found"}))
        return 1
    node.card_title = snapshot["card_title"]
    node.public_payload = snapshot["public_payload"]
    node.private_payload = snapshot["private_payload"]
    await session.commit()
    print(json.dumps({"ok": True, "rolledBack": True, "slug": args.slug, "migrationId": args.migration_id}))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Migrate Mirror public landing to v1")
    p.add_argument("--slug", required=True)
    p.add_argument("--dry-run", action="store_true", default=False)
    p.add_argument("--execute", action="store_true", default=False)
    p.add_argument("--allow-safe-fallback", action="store_true", default=False)
    p.add_argument("--interpretation-file", default=None)
    p.add_argument("--rollback", action="store_true", default=False)
    p.add_argument("--migration-id", default=None)
    return p


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run(build_parser().parse_args())))
