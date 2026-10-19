"""Authorized paid OpenAI enum-schema smoke for Studio Stage 2.

Synthetic sources only. No production DB/API. Hard USD cap enforced.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
os.chdir(ROOT / "backend")

# Load backend/.env without printing secrets
env_path = Path("backend/.env") if Path("backend/.env").exists() else Path(".env")
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        key, value = s.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value

from backend.core.llm.providers.openai_client import OpenAIClient
from backend.services.business_yansi import studio_generation as generation
from backend.services.business_yansi.studio_validation import canonical_hash, digest

MODEL = "gpt-4.1-mini"
INPUT_PER_M = Decimal("0.40")
OUTPUT_PER_M = Decimal("1.60")
CAP = Decimal("0.02")
SAFETY = Decimal("0.004")  # leave headroom before starting another call

# Synthetic, non-secret workshop copy — enough eligible answer paragraphs + short titles.
SYNTHETIC_CONTENT = "\n\n".join(
    [
        "Workshop design choices",
        "Workshop product care and repairs",
        "The workshop describes each design choice with verified material notes for every product family.",
        "Materials used for products include certified wood, recycled metal fittings, and vegetable-tanned leather accents.",
        "The design team checks each product against a written quality checklist before it leaves the bench.",
        "The repair service accepts stools, shelves, and small tables that share the workshop hardware standard.",
        "Customers can request a product repair by submitting the purchase reference and a short damage note.",
        "Packaging is designed for repeated use with reusable crates and removable protective pads.",
        "Care instructions accompany each product and explain seasonal oiling without harsh chemical cleaners.",
        "The workshop publishes product care details on the public handbook page for each collection.",
        "Verified workshop identity emphasizes durable joinery and transparent material sourcing for guests.",
        "Service hours for repairs are listed separately from retail browsing so customers know when staff are available.",
    ]
)


def cost(tokens_in: int, tokens_out: int) -> Decimal:
    return (Decimal(tokens_in) * INPUT_PER_M + Decimal(tokens_out) * OUTPUT_PER_M) / Decimal(1_000_000)


def build_snapshot():
    business_id = str(uuid.uuid4())
    version_id = str(uuid.uuid4())
    content = SYNTHETIC_CONTENT
    source = {
        "versionId": version_id,
        "version": 1,
        "title": "Synthetic workshop handbook",
        "category": "qa",
        "content": content,
        "source": "studio-paid-smoke-synthetic",
        "approvedBy": str(uuid.uuid4()),
        "contentHash": digest(content),
    }
    snapshot = {"businessId": business_id, "sources": [source]}
    return snapshot, canonical_hash(snapshot), business_id


async def call_provider(client: OpenAIClient, prompt: str, schema: dict, spent: Decimal, kind: str):
    remaining = CAP - spent
    if remaining <= SAFETY:
        return {
            "ok": False,
            "stopped": True,
            "error": f"cap_guard_remaining={remaining}",
            "kind": kind,
        }
    result = await client.generate(
        prompt=prompt,
        model=MODEL,
        temperature=0.1,
        max_tokens=1800,
        timeout=90.0,
        json_schema=schema,
    )
    usage = (result or {}).get("usage") or {}
    tin = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
    tout = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
    charge = cost(tin, tout)
    entry = {
        "kind": kind,
        "ok": bool(result.get("ok")),
        "error": result.get("error"),
        "finish_reason": result.get("finish_reason"),
        "input_tokens": tin,
        "output_tokens": tout,
        "cost_usd": str(charge),
        "provider_error_prefix": (result.get("error") or "")[:180],
    }
    if spent + charge > CAP:
        entry["ok"] = False
        entry["stopped"] = True
        entry["error"] = f"cap_exceeded_after_call spent_would={spent + charge}"
    return result, entry, charge


async def main() -> int:
    if not os.getenv("OPENAI_API_KEY"):
        print(json.dumps({"pass": False, "reason": "OPENAI_API_KEY missing"}))
        return 2

    snapshot, snapshot_hash, business_id = build_snapshot()
    passages = generation.catalog(snapshot)
    spent = Decimal("0")
    calls = []
    summary = {
        "authorized_cap_usd": str(CAP),
        "model": f"openai/{MODEL}",
        "rates": {"inputPerMillion": str(INPUT_PER_M), "outputPerMillion": str(OUTPUT_PER_M)},
        "scope": "synthetic_only_no_prod_db_or_api",
        "calls": calls,
        "pass": False,
    }

    client = OpenAIClient()
    topics_schema = generation.output_schema("topics", passages)
    topics_prompt = generation.prompt("topics", passages, "durable workshop care", None)

    # Preflight estimate: refuse if schema+prompt look huge vs remaining budget
    est_in = max(800, len(topics_prompt.encode("utf-8")) // 3)
    est_out = 500
    if cost(est_in, est_out) + SAFETY > CAP:
        summary["reason"] = "estimated_topics_call_exceeds_cap"
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 3

    raw, entry, charge = await call_provider(client, topics_prompt, topics_schema, spent, "topics-strict-enum")
    calls.append(entry)
    spent += charge
    if entry.get("stopped") or not entry["ok"]:
        summary.update({"total_cost_usd": str(spent), "reason": entry.get("error") or "topics_provider_failed"})
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 4

    try:
        payload = json.loads(raw["output"])
        unwrapped = generation.unwrap("topics", payload)
        topics_result = generation.validate_topics(unwrapped, passages)
        entry["validation"] = f"{len(topics_result['topics'])}_topics"
        entry["topic_ids"] = [t["id"] for t in topics_result["topics"]]
    except Exception as exc:
        entry["validation"] = f"rejected:{type(exc).__name__}:{str(exc)[:160]}"
        summary.update({"total_cost_usd": str(spent), "reason": entry["validation"], "pass": False})
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 5

    topic = topics_result["topics"][0]
    draft_schema = generation.output_schema("draft", passages, topic)
    # Confirm enums are dynamic and bound to topic
    entry["enum_checks"] = {
        "title_enum": draft_schema["$defs"]["DraftOutput"]["properties"]["titlePassageId"].get("enum"),
        "passage_enum_len": len(
            draft_schema["$defs"]["Question"]["properties"]["passageId"].get("enum") or []
        ),
    }
    draft_prompt = generation.prompt("draft", passages, "durable workshop care", topic)

    est_in = max(1000, len(draft_prompt.encode("utf-8")) // 3)
    if spent + cost(est_in, 500) + Decimal("0.001") > CAP:
        summary.update(
            {
                "total_cost_usd": str(spent),
                "reason": "would_exceed_cap_before_draft_call",
                "topics_ok": True,
                "pass": False,
            }
        )
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 6

    raw2, entry2, charge2 = await call_provider(client, draft_prompt, draft_schema, spent, "draft-strict-enum")
    calls.append(entry2)
    spent += charge2
    if entry2.get("stopped") or not entry2["ok"]:
        summary.update(
            {
                "total_cost_usd": str(spent),
                "reason": entry2.get("error") or "draft_provider_failed",
                "topics_ok": True,
                "pass": False,
            }
        )
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 7

    try:
        payload2 = json.loads(raw2["output"])
        unwrapped2 = generation.unwrap("draft", payload2)
        fake_job = type(
            "J",
            (),
            {
                "source_snapshot": snapshot,
                "snapshot_hash": snapshot_hash,
                "business_id": uuid.UUID(business_id),
            },
        )()
        candidate, _ = generation.validate_draft(unwrapped2, passages, topic, fake_job)
        # Exact passage match
        matches = []
        for step in candidate["steps"]:
            ev = step["evidence"]
            exact = snapshot["sources"][0]["content"][ev["start"] : ev["end"]]
            matches.append(exact == step["answer"] and exact == ev["text"])
        if len(candidate["steps"]) != 8 or not all(matches):
            raise RuntimeError("answer_passage_mismatch")
        if len({s["evidence"]["passageHash"] for s in candidate["steps"]}) != 8:
            raise RuntimeError("repeated_passage_hash")
        entry2["validation"] = "8_steps_exact_passages"
        entry2["title"] = candidate["title"][:80]
    except Exception as exc:
        entry2["validation"] = f"rejected:{type(exc).__name__}:{str(exc)[:200]}"
        summary.update(
            {
                "total_cost_usd": str(spent),
                "reason": entry2["validation"],
                "topics_ok": True,
                "pass": False,
            }
        )
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 8

    summary.update(
        {
            "total_cost_usd": str(spent),
            "total_input_tokens": sum(c.get("input_tokens", 0) for c in calls),
            "total_output_tokens": sum(c.get("output_tokens", 0) for c in calls),
            "provider_calls": len(calls),
            "topics_ok": True,
            "draft_ok": True,
            "pass": True,
            "selected_topic_id": topic["id"],
        }
    )
    out = Path("data") / "studio_paid_enum_schema_smoke_summary.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    # Also write under eza-v5/backend/data if cwd is backend
    try:
        out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        summary["summary_path"] = str(out.resolve())
    except Exception:
        pass
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
