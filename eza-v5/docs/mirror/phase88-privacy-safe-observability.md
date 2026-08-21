# Phase 8.8 — Privacy-Safe Observability & Production Health

## Principle

Observability describes **system behavior**, not user content.

Phase 6 Yansı experience metrics remain product/behavior analytics and are **isolated**.
Phase 8.8 never feeds ranking or Discover.

## Inventory (before)

- Stdlib logging + `SensitiveDataFilter` (narrow fields; prod/ci only historically)
- Proxy Prometheus `/metrics`
- Phase 6 durable experience events (forbid-list; separate path)
- No request/correlation ID middleware
- No Sentry / PostHog / GA
- Auth logs historically verbose (emails / hash fragments) — mitigated by expanded redaction

## Request ID

- Header: `X-Request-ID`
- Opaque `secrets.token_urlsafe` (or sanitized inbound 8–64 `[A-Za-z0-9_-]`)
- Context var for ops logs; echoed on responses / 500 body as `request_id`
- Never encodes user id, email, guest token, JWT, IP, slug

## Error taxonomy

See `backend/observability/error_codes.py`.

Expected product states (INFO, not incident):

- `EXPECTED_*`, `ACCOUNT_LINK_REQUIRED`, `YANSI_NOT_AVAILABLE`, `FROZEN_ARTIFACT_INVALID`

System failures (ERROR):

- `INTERNAL_ERROR`, `PUBLISH_FAILED`, `PROVIDER_*`, `DISCOVER_LOAD_FAILED`, `SOCIAL_AUTH_FAILED`, …

## Ops events

Allowlisted names in `backend/observability/ops_events.py`.

Forbidden field keys: email, tokens, prompt, conversation, slug, user_id, IP, UA, …

## Client telemetry

`POST /api/ops/client-event` — allowlisted `event` + optional taxonomy `code` only.
Frontend: `lib/eza/opsTelemetry.ts` (`reportOpsFailure`).

### Phase 8.8.1 abuse closure

- Schema: `extra=forbid`; event enum allowlist; code ∈ `CLIENT_OPS_CODES`; outcome ∈ {failure, success}
- Body: max **1024 bytes** (`Content-Length` + measured length) → **413**
- Unknown event / unknown field / unknown code / invalid JSON → **422** (no payload echo, no ERROR log)
- Rate limit: **40 / 60s** per opaque SHA-256(network) bucket via existing Redis-or-memory limiter (`rate_limit_ops_client`, `quiet=True`)
  - Never logs IP/UA/email
  - Redis shared when available; otherwise **per-worker** in-memory (launch-safe, not globally distributed alone)
- Accepted request → at most one `ops_event` line
- Frontend remains best-effort: 413/429/422/5xx/network never block product flows; no retries

## Redaction

`backend/observability/redaction.py` + always-on `SensitiveDataFilter`.

## Health

`GET /health` → `{ "status": "ok" }` only.

## Latency

Duration optional on ops events (`duration_ms`). No high-cardinality labels (no slug/user).

## Provider visibility

OpenAI image failures emit `provider_request_failed` / `provider_timeout` with operation class only.

## Deferred

Sentry/vendor alerting, warehouses, session replay, marketing analytics, distributed tracing platform.

## Production config

None required beyond existing deploy. Optional later: wire log drain alerts on `ops_event` ERROR lines.
