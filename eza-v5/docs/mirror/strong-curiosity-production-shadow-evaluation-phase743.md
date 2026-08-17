# Phase 7.4.3 — Production Corpus Shadow Evaluation

Internal only. Product language: **biligN**. Identifiers stay existing (Yansı / Discover / Saina).

**This phase inspects the frozen Phase 7.4.2 layered policy on a real Discover-eligible corpus. It does not activate ranking and must not change the policy.**

Güçlü Merak remains:

`items=[]`, `total=0`, `strongCuriosityReady=false`

UI: *Güçlü Merak henüz hazır değil.*

## Purpose

Phase 7.4.2 proved the layered policy on synthetic/reference cohorts. 7.4.3 asks what that **same** policy would do on the actual corpus.

If a bad pattern appears: **report it**. Do not edit 7.4.2, 7.3, or live Discover in this phase.

## Read-only

The evaluator:

- uses existing server-side **read** paths (`load_discover_eligible_roots`, Phase 6.5/7.2 batch evidence)
- never inserts events
- never writes a ranking table
- never mutates nodes/children
- never re-freezes or re-publishes
- rolls back the session in the CLI

No public endpoint. Discover listing must not import this module.

## How to run safely

From `eza-v5` with `backend` importable (typical: `PYTHONPATH` = `eza-v5`):

```bash
python -m backend.scripts.evaluate_strong_curiosity_production_shadow
```

Options:

- `--output-dir DIR` — JSON + markdown artifacts (default: `eza-v5/backend/data/internal_shadow_eval/`)
- `--no-write` — print summary only

Database access uses the process environment (`DATABASE_URL` via existing settings). **Do not hard-code secrets.** Staging is the same path with a staging URL in env.

CI does **not** run this command and does **not** receive production credentials.

## What is collected

- eligible / pool / historical / insufficient counts
- cap vs 10,000 structural-root SQL count
- age / version / locale / topic mixes when Phase 6.5 metadata exists
- start / child / continuation distributions
- internal top 10 / 20 / 50 / 100 with explanation codes
- foundation movement vs `balanced_evidence`
- overlap vs raw-start, raw-child, and newest diagnostic lists
- author **aggregates** (distinct count, max share) — not author lists
- guest unique-human remains `UNAVAILABLE`

## What is NOT collected

Viewer/session/event IDs, IP, UA, guest tokens, conversation IDs, Q/A, prompts, EZA scores, Relationship Map, follower/reputation/personalization inputs.

Public slugs may appear in internal artifacts because they are already public Discover identifiers.

## Diagnostic definitions

Dependence agreement is the same engineering pairwise used in 7.4 (higher volume with better ordinal). Threshold 0.90 is a **warning**, not a quality score.

Raw-start / raw-child / newest lists are **diagnostic only**. They are not ranking inputs and must not be exposed publicly.

Corpus cap: Discover loads at most 10,000 structural roots ordered by `slug ASC`. If the SQL structural count is ≥ 10,000, mark `CORPUS_TRUNCATED`. Do not claim a global ranking.

## Live readiness

`LIMITED_LIVE_READY = YES` only when a **real** configured-database run exists **and** the documented production-corpus criteria pass. Fixture/CI snapshots cannot return YES. When evidence is missing, return **NO-GO**.

## Do not commit output

Artifacts under `eza-v5/backend/data/internal_shadow_eval/` are gitignored. They are operational traces of a living corpus, not source.

## Do not mutate ranking policy here

Phase 7.4.4 (or later) may propose policy changes. 7.4.3 only files blockers/findings.
