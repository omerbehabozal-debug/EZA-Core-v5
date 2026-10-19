# Business AI Studio — Stage 2

Date: 2026-10-19. Backend-only Stage 2 implementation; final handoff commit is recorded in the delivery response.

## Git boundary

- Stage 1 was already committed as `b2a932b1bfe7bc2e90a01ac24879f9b9fe92354f` when this task began; no duplicate/empty commit was created.
- Created `feature/bilign-business-ai-studio-stage2` from that checkpoint.
- During this task another tool added `7bb3a08389390ef88d19c40d6b8928eecd031957` (Stage 1 Alembic transition-plan documentation only). Preserved it without rewriting history.
- Preserved unrelated untracked `backend/scripts/_studio_prod_alembic_readonly_probe.py`; did not run it or use production DB credentials.
- No changes to Cursor's main source tree, frontend, publication, Discover, Ayna/seal, auth configuration or deployment.

## API / model flow

Existing routes are retained under `/api/business-yansi/{business_id}/studio`:

1. POST `/topics` admits an idempotent, source-pinned job, executes synchronously when explicitly enabled, and returns 2–5 extractive supported topics with full version/passage evidence.
2. POST `/generations` takes the existing request plus `topicsGenerationId` and `topicId`, bound to the same Business and `expectedSnapshotHash`. It generates exactly eight distinct questions and eight distinct exact-source answers.
3. GET `/generations/{id}` returns the persisted result only after rechecking viewer access and current source eligibility. It also lazily recovers deadline-expired jobs.

The AI never returns authoritative source identity/offset/hash fields. Server catalog IDs resolve to version, Unicode-codepoint half-open offsets, content hash and passage hash. Only approved, published, public_allowed tenant sources reach the catalog. Metadata and answers still pass the unmodified Stage 1 extractive validator. Titles/summaries cannot be freely paraphrased under that contract. Evidence DTO strings now preserve original whitespace rather than stripping it before exact offset/hash checks; catalog parsing supports LF/CRLF without rewriting immutable source content.

Eight distinct substantive whole paragraphs ending in sentence punctuation are required; bare headings cannot be answer passages. Long/insufficient catalogs fail before provider I/O rather than silently dropping evidence. Topic duplicates and malformed/foreign passage references fail closed. Semantic usefulness/entailment of a question is not formally proven by lexical provenance: owner review remains necessary.

Success calls existing `create_draft(..., commit=False)` inside the settlement transaction. Draft, evidence result and usage commit together. Draft stays `draft`, without approver/conversation/publication. Its knowledge snapshot includes metadata-only selected sources as well as answer sources, so existing owner-review checks reject revoked metadata sources too. Existing service callers retain automatic commit by default.

## Configuration and provider

Both flags default false:

- `BILIGN_STUDIO_ADMISSION_ENABLED=true`
- `BILIGN_STUDIO_EXECUTION_ENABLED=true`

Execution also requires a server-set `BILIGN_STUDIO_MODEL` such as `openai/<configured-model>` and `BILIGN_STUDIO_PRICES_JSON` mapping the exact model ID to positive `inputPerMillion` / `outputPerMillion` USD decimal rates. There is no silent model fallback or automatically selected default. Missing model/rates block before paid I/O. The first adapter supports OpenAI structured output; other providers fail closed.

Prompt version `business-studio-extractive-v2`: system instruction separates untrusted source/hint data from instructions; JSON schema is generated on the server. Strict provider JSON schema and local Pydantic validation are both applied. Topic schema enumerates valid catalog IDs; draft schema restricts IDs to the persisted selected topic. The prompt sends selected-topic passages and excludes bulky evidence metadata. General chat calls retain their old request shape unless JSON options are explicitly requested. Provider usage/finish_reason are now preserved.

Official references used:
- https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat
- https://developers.openai.com/api/docs/models/gpt-4o-mini

The QA model `gpt-4o-mini` is marked deprecated in current docs; release configuration must explicitly select and verify a supported compatible model. Prices are deployment configuration, not inferred model defaults.

## Lifecycle, idempotency and accounting

Public states map legacy DB names `pending` -> `queued`, `succeeded` -> `completed`; running/failed/blocked remain explicit. The existing DB status constraint is unchanged. Queued admission is persisted before an atomic claim; requests do not imply a background worker. Duplicate requests never reclaim running/completed/failed/previously blocked execution attempts.

Business -> generation lock order is consistent. Authorization and source rows are refreshed rather than trusted from SQLAlchemy's identity map, including between repair attempts. Every transaction ends before LLM I/O. Default whole-job deadline is 60 seconds, maximum two paid attempts; ModelRouter retries are explicitly zero to prevent multiplied retries. Known-usage invalid output can get one bounded retry; provider ambiguity/timeout/cancellation does not trigger another paid request.

Original daily limits/reservations remain: 10 jobs, 260,000 tokens and USD 1 per Business/day; per job 20,000 input, 6,000 output and USD 0.10 across at most two attempts. Preflight conservatively bounds prompt + provider-schema UTF-8 bytes/framing and output tokens, including retry capacity, against token/dollar reservations.

Actual provider tokens and a configured-rate cost calculation are recorded per attempt. Cached-token discounts/invoice reconciliation are not implemented; configured full input rates are conservative. Missing/out-of-contract usage records the bounded reservation as estimated, marked on both usage ledger and response; it is never presented as measured usage or a free call. A skipped call with no credential records zero measured usage. Unknown charges require later operational reconciliation.

GET and duplicate admissions settle expired running jobs once as failed/estimated; expired queued jobs fail with zero usage. Recovery occurs on access, including before rejecting a revoked snapshot, and works with execution disabled. There is no sweeper: an untouched expired database row remains physically pending/running until accessed, although it cannot resume a paid attempt. Long-term unattended cleanup/monitoring is an operational follow-up, not a fictional worker.

## Additive migration

`add_business_studio_v2` follows `add_business_studio_v1`: nullable generation execution/provenance JSON and a default-false usage `estimated` flag. Downgrade refuses to discard any Stage 2 execution provenance. Apply the additive migration before deploying ORM code that selects these columns, even if execution is disabled. No production migration was run.

## QA

Tests cover successful topic/draft generation, exactly eight grounded answers, duplicate/idempotent requests, malformed JSON/foreign IDs/duplicates/truncation, bounded retry, budgets, insufficient sources, cancellation/timeouts, crash recovery, stale sources, refreshed account/membership/source revocation, metadata-only source revocation blocking owner approval, draft-only persistence, API viewer/editor isolation, provider schema transport/default chat compatibility, offline PostgreSQL DDL and actual SQLite upgrade/empty downgrade/guard checks. Existing Business, public privacy and editorial regressions are included.

Real PostgreSQL opt-in QA was extended for v2 upgrade/empty downgrade and overlapping execution requests. It requires `BUSINESS_STUDIO_TEST_POSTGRES_URL` pointing to a disposable loopback database named `business_studio_*`. It was NOT executed in this task because no such connection was supplied. SQLite/offline DDL is not PostgreSQL evidence; Stage 1's earlier Cursor QA does not establish Stage 2 concurrency safety.

Paid synthetic-only provider QA (explicitly authorized, no application DB/API): five calls, total calculated USD `0.00211305` within the cumulative USD 0.02 cap. Initial JSON-mode output was rejected for schema shape; intermediate draft was rejected for outside-topic evidence. Final two calls produced two validated topics and eight validated draft steps. Final paid probe passed the base strict schema; dynamic enum schema transport is covered by mocks, not a real paid enum-schema probe. Draft persistence/authorization/idempotency were tested with mock providers and SQL separately, not claimed as end-to-end PostgreSQL/provider production QA.

Local paid-call summary: `C:/Users/MONSTER/Documents/Codex/studio-stage2-provider-smoke-summary.json` (outside repo; contains no credentials).

Final regression command: `python -m pytest` with the Studio generation, Stage 1 Studio, Business Yansi, opt-in PostgreSQL, public Yansi privacy and Yansi editorial modules, `-q -p no:cacheprovider --tb=short`. Final result: **137 passed, 1 skipped, 12 warnings** (34 new generation tests, 50 Stage 1 Studio, 26 Business, 12 privacy, 15 editorial; PostgreSQL opt-in skipped). `git diff --check` and new-file whitespace checks passed. No test failure remains in the executed set.

## Stage 2 source manifest

All paths below are relative to `eza-v5/`:

1. backend/core/llm/providers/openai_client.py
2. backend/core/schemas/business_studio.py
3. backend/core/utils/model_router.py
4. backend/models/business_studio.py
5. backend/routers/business_studio.py
6. backend/services/business_yansi/service.py
7. backend/services/business_yansi/studio.py
8. backend/services/business_yansi/studio_execution.py (new)
9. backend/services/business_yansi/studio_generation.py (new)
10. backend/migrations/versions/add_business_studio_v2.py (new)
11. backend/tests/test_business_studio_generation.py (new)
12. backend/tests/test_business_studio_postgres.py
13. docs/mirror/business-studio-stage2.md (new)

## Decision

GO for Stage 3 UI integration planning against this backend contract, after explicit user authorization; no Stage 3 work performed. Production NO-GO until v2 actual PostgreSQL migration/concurrency QA and a configured release-model/enum-schema end-to-end smoke pass. Preserve feature flags disabled until those checks and deployment migration ordering are approved.

## Cursor handoff — Stage 3 API contract

Base: `/api/business-yansi/{businessId}/studio`. Reuse existing authenticated Business API client; do not call these as anonymous/public replay APIs. Owner/editor can create; viewer can read within the same Business. Existing Business feature flag is also required.

POST `/topics` (synthetic request example):

```json
{
  "idempotencyKey": "studio-topics-ui-0001",
  "sourceVersionIds": ["11111111-1111-4111-8111-111111111111"],
  "topicHint": "Kaynaklarla desteklenen ürün bakımı konuları"
}
```

- `idempotencyKey`: 8–128 characters; letters, numbers, `_ . : -` only. Keep one key per logical action, including network retry.
- `sourceVersionIds`: 1–16 distinct UUIDs from approved/published/public_allowed Business knowledge. Server sorts and revalidates them. Same selection must be used for the subsequent draft.
- `topicHint`: optional, max 500; treated as untrusted data.
- POST returns HTTP 202 even when synchronous work has already completed. HTTP success is not generation success.

HTTP 202 response shape below is a **field projection**, not a complete response or a real production record. The live response contains 2–5 topics; the example shows one topic's structure. Read remaining counters/timestamps from `GenerationResponse` in `core/schemas/business_studio.py`.

```json
{
  "generationId": "22222222-2222-4222-8222-222222222222",
  "businessId": "33333333-3333-4333-8333-333333333333",
  "kind": "topics",
  "status": "completed",
  "executionAvailable": true,
  "snapshotHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "usageEstimated": false,
  "errorCode": null,
  "draftId": null,
  "result": {
    "topics": [{
      "id": "topic-1",
      "title": "Doğrulanmış ürün bakımı",
      "description": "Doğrulanmış kaynağın kısa paragrafı.",
      "titlePassageId": "catalog-title-id",
      "descriptionPassageId": "catalog-description-id",
      "answerPassageIds": ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
      "evidence": []
    }]
  }
}
```

In actual results `evidence` is populated with exact source evidence for metadata and answers. Each evidence object has:

```json
{
  "versionId": "11111111-1111-4111-8111-111111111111",
  "version": 1,
  "contentHash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "start": 0,
  "end": 42,
  "text": "Original exact source text including spacing",
  "passageHash": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "offsetEncoding": "unicode-codepoint"
}
```

Those values are illustrative placeholders, not a cryptographically valid passage. UI displays server-provided evidence; never construct offsets/hashes or infer JavaScript UTF-16 offsets from the Unicode-codepoint values.

POST `/generations` after a user selects an actual returned topic:

```json
{
  "idempotencyKey": "studio-draft-ui-0001",
  "sourceVersionIds": ["11111111-1111-4111-8111-111111111111"],
  "topicHint": "Kaynaklarla desteklenen ürün bakımı konuları",
  "expectedSnapshotHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "topicsGenerationId": "22222222-2222-4222-8222-222222222222",
  "topicId": "topic-1"
}
```

Use the actual topics response hash/ID/topic ID, never the illustrative values. `topicsGenerationId` and `topicId` are nullable for legacy admission compatibility but REQUIRED by execution. Their absence yields a blocked generation, not a draft. A foreign Business job, stale hash or missing topic is rejected.

Completed draft response projection:

```json
{
  "kind": "draft",
  "status": "completed",
  "draftId": "44444444-4444-4444-8444-444444444444",
  "errorCode": null,
  "result": {
    "title": "Exact metadata source passage",
    "summary": "Exact summary source passage",
    "metadataEvidence": [],
    "steps": [{"question": "Generated grounded question?", "answer": "Exact source answer.", "evidence": {}}]
  }
}
```

Projection shows one step only: the real `steps` array has exactly eight, every evidence object is populated, and metadataEvidence is populated. UI must use `draftId` to enter the existing draft review flow. Do not approve, export, seal or publish automatically. Generated answers are quotes; do not replace them with model-supplied free text.

GET `/generations/{generationId}` returns HTTP 200 with the same envelope. Poll only queued/running results with backoff and an overall UI timeout exceeding the backend 60-second bound. There is no worker/SSE guarantee. Repeat POST with the SAME key after a network error to retrieve the same job. A failed or blocked attempt does not start again with the same key; any explicit new user attempt needs a new key and consumes the original Business admission budget.

### UI state and errors

- `queued`/`running`: disable duplicate submit, preserve the user's selection, poll GET. `executionAvailable` alone is not a success signal.
- `completed`: require non-null result; draft completions also require draftId.
- `blocked`: result is null. Show errorCode; do not poll indefinitely. Execution disabled still uses the legacy `studio_execution_not_implemented` admission error.
- `failed`: result is null. Show errorCode, preserve the request/topic/source selection. Never silently create a fresh idempotency key or loop paid retries.
- `usageEstimated=true`: counts/cost include conservative reservations for ambiguous provider usage; do not label them as measured/billed values.
- Decimal cost fields serialize as decimal strings. Currency is USD. Additional legacy state literals remain in the response schema for Stage 1 compatibility; unknown states should fail closed rather than imply completion.

Transport errors have `{"detail":{"code":"..."}}`, except FastAPI schema validation uses its normal detail array:

| HTTP | Examples | UI handling |
| --- | --- | --- |
| 401 | inactive_account / authentication failure | Existing login/session flow |
| 403 | business_access_denied | No editor privilege; do not retry |
| 404 | business_not_found, studio_generation_not_found / disabled Business feature | Missing/unauthorized scope; no cross-tenant fallback |
| 409 | studio_idempotency_conflict, studio_snapshot_stale | Preserve input; refresh topics/sources or use a new logical request after explicit action |
| 422 | request shape, studio_source_unavailable, unsafe public content | Explain source/input requirements; no paid retry |
| 429 | studio_business_budget_exceeded | Stop generation; no automatic bypass/new key |
| 503 | studio_admission_disabled | Studio unavailable; retain selection |

Execution errors are usually in the HTTP 202/200 envelope, **not** transport errors:

| state | errorCode examples |
| --- | --- |
| blocked | studio_model_or_pricing_not_configured, studio_selected_topic_required, studio_topic_unavailable, studio_attempt_budget_exceeded, studio_insufficient_sources, studio_insufficient_metadata |
| failed | studio_invalid_model_output, studio_insufficient_sources, studio_provider_failed, studio_provider_timeout, studio_deadline_exceeded, studio_usage_unknown, studio_snapshot_stale, studio_execution_interrupted, studio_request_cancelled, studio_queue_expired |

Source revocation during execution can return failed; a later GET rechecks the same snapshot and may instead return HTTP 409. Do not display cached content as still valid after this error.

### Final handoff QA (2026-10-19)

Regressions rerun: **137 passed, 1 skipped, 12 warnings**. The skipped test is the explicit disposable PostgreSQL test, not a passed check. PostgreSQL 17 QA URL and production model selection were requested separately. At environment inspection, only PostgreSQL 15 tool installation was visible, loopback 5432 was listening without a verified QA identity, Docker engine access was denied, and Service Control Manager/CIM inspection was unavailable. No connection was attempted to that unidentified listener and no service was started.

No new paid provider calls were made in this handoff without fresh permission. Previous paid QA does not prove the production-selected model supports the current dynamic enum schema. Keep release NO-GO until a specific model and safe PostgreSQL 17 test connection are supplied and those tests pass.
