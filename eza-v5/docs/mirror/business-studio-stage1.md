# Business AI Yansı Studio — Stage 1 contracts

Scope: admission, persistence, source integrity, deterministic validation and budget
contracts only. No AI calls, topics, generated drafts, worker, queue, visual generation,
approval, or publication are implemented by these endpoints. Existing manual workflows
and Cursor's frontend/layout files are unchanged.

## Isolation and activation

Worktree: `feature/bilign-business-ai-studio`, forked from `1fa2113ddfc5be0973e628173669e804c7e71f96`.

Both the existing `BILIGN_BUSINESS_ENABLED` gate and the new
`BILIGN_STUDIO_ADMISSION_ENABLED=true` gate are required. The Studio gate defaults OFF
and returns 503 without querying Studio tables. Enable admission only in isolated QA
after migration. An optional server-side `BILIGN_STUDIO_MODEL` records a model identifier;
null means unconfigured. No provider is instantiated/called by admission.

## HTTP contracts

All paths are under `/api/business-yansi/{business_id}/studio`.

| Endpoint | Role | Response |
| --- | --- | --- |
| POST `/topics` | owner/editor | 202 persisted admission record; no topics |
| POST `/generations` | owner/editor | 202 persisted admission record; no draft |
| GET `/generations/{generation_id}` | owner/editor/viewer of the same Business | 200 record after source revalidation |

Topics request:

```json
{
  "idempotencyKey": "client-generated-operation-uuid",
  "sourceVersionIds": ["<knowledge-version-uuid>"],
  "topicHint": "optional editorial direction"
}
```

Generation request additionally REQUIRES `expectedSnapshotHash`, obtained from the
topics/admission snapshot. `sourceVersionIds` is a sorted unique list of 1–16 UUIDs;
extra fields, client-selected roles/models/Business IDs, and empty sources are rejected.
Changing source selection requires a fresh snapshot and operation key.

Response includes generation/business IDs, kind, `status=blocked`,
`executionAvailable=false`, `errorCode=studio_execution_not_implemented`, snapshot hash,
source version IDs/hashes, model/prompt version, attempts, reserved/actual token and USD
budgets, dates, and `draftId=null`. Source text, approver identity, request hint, auth tokens,
and private customer/EZA metadata are NOT returned in the response.

Repeated identical requests return the same ID (202); this is admission idempotency,
not a claim that AI generation succeeded. Authentication and current role checks run
again on retries. Keys are unique for the whole Business, across actors and operation
kinds. Request hashing includes actor, kind and normalized request; another actor or
different body with the same key gets 409 and never receives the original result.

## Status machine

Stage 1 HTTP creates only `blocked`; no endpoint promotes it to executable work.
`studio_execution_not_implemented` is an explicit blocker, not a transient queue status.

Future worker contract helpers (unit-tested with synthetic states, never exposed as
execution routes) permit:

```
pending -> running -> validated | failed | expired
failed | expired -> pending  (remaining attempts and fresh sources required)
```

`validated` means an extractive candidate passed deterministic validation; it does NOT
mean a draft was created, owner approved it, or a Yansı was published. `succeeded` and
`cancelled` are reserved model states with no Stage 1 transition implementation.
No fake processing/completion timers or in-process background tasks exist.

## Sources and validator

Snapshots are built server-side from the current Business only, using the existing
`published_knowledge` filter: published, public_allowed, approved_by present. Source
payload includes version ID/number, title/category/content/source, approver identity
(internal only), and SHA-256 content hash. Canonical JSON is UTF-8, sorted keys and
compact separators. Aggregate source content is capped at 64,000 UTF-8 bytes.

Revalidation is mandatory for idempotent reads, GET, attempt admission, successful
candidate validation and retry. Archived, unpublished, revoked, mutated or foreign
sources cannot produce an accepted result. Versions are pinned; a new version never
silently substitutes for a snapshot version. No private conversation is read or added.

`validate_candidate(value, snapshot, snapshot_hash, business_id)` validates:

- exactly eight steps, bounded non-empty strings, Unicode/punctuation/case-normalized
  distinct questions (including Turkish dotted/dotless I);
- approved snapshot structure, tenant identity, content and snapshot hashes;
- each evidence's version ID/number, content hash, exact passage and passage hash;
- explicit `unicode-codepoint` half-open offsets, with whole line/paragraph boundaries;
- exact answer equality to the validated source passage (existing manual draft compatible);
- title and summary equal to validated metadata passages in extractive v1;
- existing PII/secret public-content checks and local input-analyzer risk threshold .7.

It returns the existing `create_draft` input shape; it does not save it. No fallback
invented answers are accepted. The validator establishes extractive provenance, not
universal semantic entailment or the truth of brand-provided sources. An unsupported
answer/title is rejected; question premise/answer relevance, source selection quality,
and full semantic assessment remain Stage 2 and owner-review responsibilities. Multiple
source synthesis/paraphrase is NOT silently allowed in this version.

## Limits and usage

Server policy (`Limits`, not client-overridable): 10 admissions/Business/UTC day;
260,000 reserved total tokens/day; USD 1.00 reserved/day; each job reserves 20,000
input + 6,000 output tokens and USD .10 across at most TWO attempts. Hint length <=500.

Blocked records consume admission reservations to bound repeated intake/storage;
their actual usage/charge stays zero. No personal chat quota is consumed. Reservations
are deliberately not reclaimed in Stage 1 (no cancellation executor).

BusinessProfile FOR UPDATE serializes key and daily reservation checks on PostgreSQL;
the database unique constraint is a second guard. SQLite tests do not validate this lock.
No network work happens inside these transactions. `begin_attempt` commits and returns
a detached snapshot so it holds neither a row lock nor a session transaction during a
future provider call. Deadline is 60 seconds from attempt admission. No timeout reaper
or execution exists yet; expired completion is rejected and future executor must settle
an expired attempt explicitly.

`BusinessStudioUsage` has a unique generation/attempt settlement, canonical settlement
hash, measured tokens, USD and outcome. Identical settlement is idempotent; different
settlement conflicts. Counters cannot exceed cumulative reservations. Decimal precision
is eight places; invalid/non-finite/negative usage is rejected. In Stage 2 the provider
adapter must enforce remaining input/output limits *before* sending, capture real usage,
and separately account for unexpected provider billing overruns rather than discard it.
Current Stage 1 checks validate supplied measurements; they do not meter a live provider.

ModelRouter now honors explicit `retries=0`; omitted/default `retries=2` remains three
maximum provider attempts. Future Studio execution must pass zero and control its own
two-attempt job budget to avoid nested retry multiplication. No current chat caller was
changed. Invalid negative/non-integer retry counts fail before a provider call.

## Errors

| HTTP | code / condition |
| --- | --- |
| 401 | existing missing/invalid/inactive authenticated account |
| 403 | existing business_access_denied; platform capability/EZA role does not substitute for membership |
| 404 | business_not_found, studio_generation_not_found; Business feature gate off |
| 409 | studio_idempotency_conflict, studio_snapshot_stale, studio_invalid_transition, studio_usage_conflict, studio_deadline_exceeded, studio_retry_exhausted |
| 422 | DTO validation; studio_source_unavailable, studio_invalid_snapshot, studio_invalid_evidence, studio_incomplete_passage, studio_invalid_candidate, studio_duplicate_question, studio_unsupported_answer, studio_unsupported_metadata, studio_unsafe_content, studio_invalid_usage; existing public_content_review_required |
| 429 | studio_business_budget_exceeded, studio_attempt_budget_exceeded, studio_usage_budget_exceeded |
| 503 | studio_admission_disabled (safe default) |

## Migration and production drift boundary

`add_business_studio_v1` follows the *local worktree* head `add_user_capabilities_v1`.
It adds only `business_studio_generations` and `business_studio_usage`; it does not alter
existing tables or seed data. Downgrade refuses non-empty Studio tables. QA covers
offline PostgreSQL DDL and an actual isolated SQLite upgrade/empty downgrade/refusal.
An opt-in real PostgreSQL test covers additive upgrade/downgrade, parallel duplicate
requests and daily budget serialization. It requires an explicitly provisioned empty
loopback database named `business_studio_*`, uses a random isolated schema and never
uses the app's DATABASE_URL.

No production revision is assumed. Before any production change, a separate approved
plan must inventory Alembic current/history plus actual schema read-only, reconcile
missing/divergent historical revisions and concurrent migration heads, and test a
forward migration against a restored isolated copy. No automatic stamp, history rewrite,
DDL, capability grants, or production upgrade is part of this task. Admission stays off
until that plan succeeds. Do not rewrite existing revisions to conceal drift.

## Deferred open/private publication bridge

No publishing code changed. Current general publish maps normal -> open/public,
whereas Business publish expects open/private. Stages 4–5 must introduce a server-owned
private frozen preparation using existing seal/proof checks, protect Business editorial
sources from generic public publish before owner approval, and atomically bind Business
publication + public visibility. Never publish publicly and then hide it, and never fake
a restricted safety level merely to obtain private visibility. Bind all future output to
the approved draft revision, source snapshot and sealed Q/A identity.

## QA execution

Run targeted tests with a local-only app DATABASE_URL (engine initialized, never used for
these in-memory fixtures), PYTHONDONTWRITEBYTECODE=1 and pytest cache disabled:

```
python -m pytest eza-v5/backend/tests/test_business_studio.py eza-v5/backend/tests/test_business_studio_postgres.py -q -p no:cacheprovider
```

The PostgreSQL test skips unless BUSINESS_STUDIO_TEST_POSTGRES_URL is explicitly set;
a skip is not PostgreSQL verification. No provider keys are required. Existing Business,
Guest Trial, public privacy, continuation, publish and editorial suites remain regression
targets. No frontend/CSS/layout or CI selection/config files are changed.
