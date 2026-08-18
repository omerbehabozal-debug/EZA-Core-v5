# Phase 7.4.3d — Pre-live technical closure

Internal only. Product language: **biligN**. Identifiers stay existing (Yansı / Discover / Saina).

This phase closes two engineering blockers before Phase 7.5. It does **not** change Phase 7.4.2 policy, 7.3 comparators, candidate semantics, Discover ordering, or live Güçlü Merak.

Güçlü Merak remains:

`items=[]`, `total=0`, `strongCuriosityReady=false`

UI: *Güçlü Merak henüz hazır değil.*

## Blocker A — 10k pairwise diagnostics

`combinations(slugs, 2)` in volume-agreement diagnostics is **diagnostic only**. Ranking remains `sorted` / O(N log N).

At N=10,000, C(N,2) = 49,995,000. Production-shadow series multiplied that cost.

### Contract

| Corpus size | Mode | Pair evaluations |
|---|---|---|
| N ≤ 400 | `EXACT` | C(N,2) |
| N > 400 | `BOUNDED_SAMPLE` | ≤ 12,000 |

100 stays exact. 1,000 and 10,000 use the bounded sample.

Bounded sample identity:

- diagnostic version `pairwise_diag_v743d`
- series key (strategy + volume series)
- canonical `sorted(slugs)` — input order does not change the pair set
- adjacent window on sorted slugs, hash-addressed partners, evenly spaced leaps, hash fill
- SHA-256 only. No `random`, time, or process salt

Internal metadata (not public): `diagnosticMode`, `corpusSize`, `pairPopulationSize`, `evaluatedPairCount`, `deterministicSampleVersion`, `dependencePrecision` (`EXACT` | `SAMPLED`).

The 0.90 engineering warning is unchanged. Bounded mode applies it to the sample and labels `BOUNDED_SAMPLE` / `SAMPLED`. It does not claim exact corpus-wide precision.

Strategy-pair top-K overlap / ordinal deltas stay O(strategies² × N). They were not rewritten.

## Blocker B — alembic_version.version_num

Alembic **1.12.1** creates `alembic_version.version_num` as **VARCHAR(32)** by default. This repository was not customizing that.

Committed revision IDs:

| | Value |
|---|---|
| Max length | **40** (`add_mirror_journey_identity_pass_closure`; Phase 4.2 snapshot id is 39) |
| Head | `add_yansi_phase64_signals` (**25**) |
| VARCHAR(32) | insufficient for the 40-character historical IDs |

Phase 7.4.3b needed a **local** `ALTER … VARCHAR(128)` before stamping the 40-character Phase 4.2 revision. That ALTER was not in the repo.

`env.py` now calls `ensure_alembic_version_capacity(..., apply=True)` **before** `run_migrations()`, so a long revision is never persisted into VARCHAR(32).

Helper rules:

- only `alembic_version.version_num` length
- idempotent
- no stamp, no history rewrite, no application-table changes
- inspect CLI defaults to dry-run: `python -m backend.scripts.inspect_alembic_version_capacity`
- `--apply` widens/creates that column only
- never prints `DATABASE_URL` or passwords
- production is labeled, not auto-destroyed

### Clean empty database

`alembic upgrade head` from a **fully empty** database still fails at `add_deleted_by_user` because `4c2bee92df6f` is empty (`pass`) and later revisions ALTER tables created historically via `create_all`. That is **pre-existing schema bootstrap drift**, not the version_num bug.

The version_num bug appears when a long revision must be stored (stamp Phase 4.2, or walk those revisions on a DB that already has earlier tables).

Proven path for Phase 6 tables on an empty disposable Postgres:

1. Capacity hook / VARCHAR(128)
2. `alembic stamp add_mirror_journey_phase42_eza_snapshot` (40 characters stored)
3. `alembic upgrade head` → `yansi_experience_events`, `yansi_exposure_events`, `yansi_own_continuation_events`

This is **not** a stamp-to-head shortcut. Head is reached by running the Phase 6 migrations.

## Isolation

Discover listing must not import the pairwise diagnostic helper, this Alembic helper, 7.4.2, 7.4.3, or the inspect script.

Zero paid AI/API cost.
