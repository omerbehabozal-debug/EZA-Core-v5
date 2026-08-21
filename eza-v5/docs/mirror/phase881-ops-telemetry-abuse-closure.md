# Phase 8.8.1 — Ops Telemetry Abuse Closure

Closes production-blocking abuse surface on unauthenticated `POST /api/ops/client-event`.

## Controls

| Control | Behavior |
|---------|----------|
| Strict schema | Pydantic `extra="forbid"`; only `event`, `code?`, `outcome` |
| Event | Closed allowlist |
| Code | Closed `CLIENT_OPS_CODES` taxonomy |
| Body size | ≤ 1024 bytes → else 413 |
| Rate limit | 40 req / 60s per hashed network bucket |
| Quiet rejects | 422/413/429 do not ERROR-log payloads or IP |

## Rate-limit scope

- Implementation: `rate_limit_ops_client` (reuses Redis path when Redis is up)
- Bucket key: `ops_client:{sha256(ops_client:{ip})[:16]}` — ephemeral, not a user id
- Never stores email / guest token / fingerprint / full UA
- Never emits IP into logs
- Without Redis: **per-worker** in-memory (documented launch-safe bound)

## Non-goals

No Sentry, marketing analytics, Phase 6/7 changes, or product-flow changes.
