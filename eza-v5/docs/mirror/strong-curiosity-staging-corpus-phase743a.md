# Phase 7.4.3a — Staging corpus for Strong Curiosity evaluation

Internal only. Product language: **biligN**. Identifiers stay existing (Yansı / Discover / Saina).

**This phase prepares a synthetic, non-production Discover-eligible corpus so the frozen Phase 7.4.3 evaluator can inspect Phase 7.4.2. It does not rank, personalize, or activate Güçlü Merak.**

Güçlü Merak remains:

`items=[]`, `total=0`, `strongCuriosityReady=false`

UI: *Güçlü Merak henüz hazır değil.*

## Why

Phase 7.4.3 ran against a configured database whose Discover-eligible frozen public root set was empty. Ranking questions stayed **NOT PROVEN**. This seed is the missing input, not a policy change.

## Environment guard

The seeder aborts unless `ENV` / `EZA_ENV` resolves to one of:

`staging`, `test`, `ci`, `development`, `dev`

`prod` / `production` abort. There is no `--force-production`.

## How to run

From `eza-v5` with `backend` importable:

```bash
python -m backend.scripts.seed_strong_curiosity_staging_corpus --size medium --dry-run
python -m backend.scripts.seed_strong_curiosity_staging_corpus --size small
python -m backend.scripts.seed_strong_curiosity_staging_corpus --size medium
python -m backend.scripts.seed_strong_curiosity_staging_corpus --cleanup
python -m backend.scripts.seed_strong_curiosity_staging_corpus --size small --evaluate
```

Default size is **medium** (~250 roots). `small` ≈ 56, `large` ≈ 1000.

`--dry-run` prints intended users / roots / children / events / archetypes and does not open a write session.

Database access uses process settings (`DATABASE_URL`). **Do not hard-code secrets.** The CLI never prints `DATABASE_URL`.

After a successful seed, run the **unchanged** 7.4.3 evaluator:

```bash
python -m backend.scripts.evaluate_strong_curiosity_production_shadow
```

Or pass `--evaluate` on the seed command.

## Namespace

| Object | Marker |
|---|---|
| Root / child slugs | `p743a-…` |
| Fixture emails | `phase743a+{handle}@fixtures.bilign.test` |
| Seed batch | `phase743a-v1` in `public_payload.seed.seedBatchId` |

Cleanup is scoped to those prefixes only. It never truncates `mirror_network_nodes`.

## What is created

Valid persisted states matching Phase 5/6/7.1 invariants:

- public, open, published, `journey_v1`, frozen, replayReady (6–8 steps)
- HTTPS scene URL (card gate)
- eligible direct children for generativity
- STARTED / COMPLETED / SKIPPED experience rows
- optional exposure and own-continuation rows
- synthetic authors only

Fixture helpers write canonical tables. They do not call the interactive chat/Journey publish HTTP pipeline.

Event volume is **capped** so pathologies stay distinguishable without 100k physical start rows.

## What is not collected / created

Real user emails, production conversation text, IP, UA, guest fingerprints, EZA scores, Relationship Map, follower graphs, live ranking tables.

Guest sessions use `viewer_user_id=None`. Unique-human stays **UNAVAILABLE**.

## Isolation

`list_discover_mirrors` must not import this seed module. Live Güçlü Merak stays a placeholder even when the staging corpus is present. Rastlantısal and En Yeni are unchanged.

Phase 7.4.2 policy and 7.4.3 evaluator code must not be edited in this phase. If staging evaluation looks bad, report it.

## Do not commit output

Evaluator artifacts under `eza-v5/backend/data/internal_shadow_eval/` are gitignored. Do not commit staging dumps, `.env`, or credentials.

CI runs only the sqlite/in-memory seed tests. CI does not receive a staging database.
