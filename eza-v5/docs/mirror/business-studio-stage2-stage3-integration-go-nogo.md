# Business AI Studio — Stage 2+3 integration GO/NO-GO

**Branch:** `feature/bilign-studio-stage2-stage3`  
**Tip:** `1443444`  
**Date:** 2026-10-19  
**Not done:** production migration, push, deploy, feature-flag activation, paid provider calls

## Integration commits

| Hash | Summary |
|------|---------|
| `345456c` | Cherry-pick of Codex `f6913ba` — Stage 2 grounded topic/draft generation |
| `9248927` | Stage 3 Business Studio frontend + docs/screenshots |
| `1443444` | Fix PostgreSQL QA `os` shadowing so Stage 2 concurrency suite runs |

Base remains Stage 1 merge `b940536` (identity/scroll ancestors preserved). Unrelated dirty QA dumps / profile CI fixes were **not** included.

## API / DTO alignment

Frontend `businessStudio.ts` matches Stage 2 `business_studio.py`:

- Requests: `idempotencyKey`, `sourceVersionIds`, `topicHint`, `expectedSnapshotHash`, `topicsGenerationId`, `topicId`
- Response: `status` (`queued`/`completed` aliases), `executionAvailable`, `result`, `errorCode`, `draftId`, budgets
- Result parsers require real `topics[]` / 8 `steps[]` with evidence — no invented success from HTTP 202 alone

## PostgreSQL QA (isolated PG17)

`BUSINESS_STUDIO_TEST_POSTGRES_URL=postgresql+asyncpg://…@127.0.0.1:55434/business_studio_s2qa`

**PASS** `test_business_studio_postgres.py` including:

- `add_business_studio_v1` + `add_business_studio_v2` upgrade / empty downgrade / data guard
- Idempotency + conflict 409
- Daily job / token / USD limits
- Viewer/tenant isolation
- Stage 2 concurrent execute → single provider call
- Source revoke → `studio_snapshot_stale` 409

## AI provider validation

| Check | Result |
|-------|--------|
| Offline strict JSON Schema (enums + `additionalProperties:false` + required props) | **PASS** (`strict_problems_count 0`, dynamic enums present) |
| Recommended release models | `openai/gpt-4o`, `openai/gpt-4.1-mini`, or dated `gpt-4o-2024-08-06` |
| `gpt-4o-mini` | OK for mock QA; Stage 2 docs mark it deprecated for release |
| Paid enum-schema provider smoke | **NOT RUN** — awaiting explicit permission |

## E2E Business flow

| Layer | Result |
|-------|--------|
| Backend generation suite (mock provider) | 84 Studio unit+generation + broader 110 with Business |
| Frontend Studio honesty/flow | 7/7 |
| Live FE↔BE with real OpenAI | **Deferred** (needs paid permission + local flags) |

With flags off, UI correctly shows unavailable / blocked — never fake completed topics.

## Regressions

| Suite | Result |
|-------|--------|
| Business Yansı | pass (in 110) |
| Business/Admin scroll | 6/6 |
| Platform admin / capabilities / sidebar account | 20/20 |
| Guest trial + mobile returning auth | 23/23 |
| Editorial + public honorific | 27/27 |

## Screenshots

- `frontend/data/qa_platform_admin_ui/live/studio_stage3_1366.png`
- `frontend/data/qa_platform_admin_ui/live/studio_stage3_390.png`

## Decision

| Scope | Verdict |
|-------|---------|
| Integrate Stage 2+3 on feature branch / merge to main **code-only** | **GO** |
| Production migration / deploy / flag ON | **NO-GO** |
| Paid provider release smoke | **NO-GO until permission + configured model/prices** |

## Remaining risks

1. Production Alembic still lags (editorial/guest missing; Business schema ahead of stamp) — reconcile before Studio DDL.
2. Release model must be explicitly chosen; do not ship on deprecated mini without re-check.
3. Dynamic enum schema verified offline + mocks; one paid provider probe still recommended before flag ON.
4. No unattended expired-job sweeper (Stage 2 design) — ops follow-up.
