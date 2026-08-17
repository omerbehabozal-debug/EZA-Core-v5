# Phase 7.4.3b — Staging database alignment + real staging shadow run

Internal only. Product language: **biligN**. Identifiers stay existing (Yansı / Discover / Saina).

**This phase aligned the configured non-production database to the frozen Phase 6 schema, persisted the unchanged Phase 7.4.3a fixture corpus, and ran the frozen Phase 7.4.3 evaluator against that populated database.**

It did not redesign ranking, change Phase 7.4.2, change comparators, activate Güçlü Merak, or call paid AI APIs.

Güçlü Merak remains:

`items=[]`, `total=0`, `strongCuriosityReady=false`

UI: *Güçlü Merak henüz hazır değil.*

## Environment (sanitized)

```
environment=development
dialect=postgresql
hostKind=localhost
database=eza_v6
production_guard=PASS
isProductionSettings=false
```

Work was done from `eza-v5/backend` so application `.env` loaded. `DATABASE_URL` was never printed.

## Alembic

Repository chain is linear. Head: `add_yansi_phase64_signals`.

| Item | Value |
|---|---|
| Pre-migration DB revision | `4c2bee92df6f` (init) |
| Observed schema | Phase 4.2 objects already present (`create_all` drift) |
| Multiple heads | NO |
| Phase 6 tables before | missing |

Naive `alembic upgrade head` from init would collide with existing tables. Recovery:

1. Widen `alembic_version.version_num` locally (`VARCHAR(32)` → `VARCHAR(128)`) so long revision IDs fit. No Phase 6 `CREATE TABLE`.
2. `alembic stamp add_mirror_journey_phase42_eza_snapshot`
3. `alembic upgrade head` → `add_yansi_experience_events`, then `add_yansi_phase64_signals`

Post-migration revision: `add_yansi_phase64_signals` (head).

Required unique indexes/constraints for experience STARTED/COMPLETED/skip, exposure session, and continuation session are present.

## Staging corpus

Unchanged 7.4.3a seeder, medium size.

Dry-run: 250 roots, 24 authors, 514 children, 10 grandchildren. Zero writes.

Persisted: eligible 250, pool 240, authors 23, external-generativity 135, historical-only 10, low-sample 22, self-play 11, auth-concentrated 20.

Namespace `p743a-*`. Fixture emails `phase743a+{handle}@fixtures.bilign.test`. Non-fixture users remained 6. Re-seed was idempotent (counts unchanged). Cleanup was **not** executed (would delete the measurement corpus). Cleanup remains prefix-scoped.

## Frozen evaluator (configured database)

```
source=configured_database
realCorpusRun=true
eligible=250 / pool=240
insufficient=10 / historical-only=10
cap=NOT REACHED
queryCount=10
durationMs≈8819
limitedLiveReady=NO-GO
blocker=authorConcentration:FAIL
```

Author concentration: top-10 `topAuthorShare=0.5` (2 authors). This matches the 7.4.3a cycle (`index % 24` maps each archetype to one author). Policy was not retuned.

## Isolation

On the populated development DB:

- Default mode `random` (Rastlantısal); same `random_session` → stable order
- `newest` ordered by `published_at` DESC
- `strong_curiosity` → empty placeholder, `strongCuriosityReady=false`
- `list_discover_mirrors` still does not import 7.4.2 / 7.4.3 / seed modules

No commit or push. No GitHub Actions credentials. No external AI calls.
