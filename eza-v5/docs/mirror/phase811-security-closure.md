# Phase 8.1.1 — Security Closure

Internal engineering note. Closes remaining Phase 8.1 security gaps before Phase 8.2.

---

## Remaining Phase 8.1 gaps addressed

| Gap | Fix |
|-----|-----|
| Per-route `str(e)` on HTTP 500 | Central `normalize_public_http_error_content()` in `http_exception_handler` — all 5xx → `{ "error": "internal_server_error" }` |
| Public test/benchmark endpoints | `assert_non_production_surface()` on read + publish test routes |
| Unknown/missing env opens debug surfaces | `raw_runtime_env_label()` + explicit allowlist; missing/unknown → 404 |
| Frontend lab guard hostname-only | Fail-closed unless localhost or explicit deploy env label |

## Error envelope behavior

| Status | Public body |
|--------|-------------|
| 4xx intentional | `{ "detail": <domain detail> }` — unchanged |
| 5xx (any source) | `{ "error": "internal_server_error" }` |
| Unhandled exception | Same as 5xx (Phase 8.1 global handler) |

Implementation: `backend/security/production_surface.py`, `backend/main.py` `http_exception_handler`.

Route-level `str(e)` strings may still exist in source for dev logging paths but **cannot reach clients on 5xx** after handler normalization.

## Environment fail-closed semantics (security surfaces only)

Uses **process environment** (`os.getenv`), not Pydantic defaults:

| `EZA_ENV` / `ENV` (raw) | Debug/lab/test routes | Frontend lab/dev pages |
|-------------------------|----------------------|-------------------------|
| `dev`, `development` | Allowed | Allowed on localhost; deploy label required on remote |
| `test`, `ci`, `staging` | Allowed | Allowed when deploy env explicit |
| `prod`, `production` | **404** | **404** on product hosts |
| missing both vars | **404** | **404** (except localhost) |
| unrecognized | **404** | **404** |

Normal product routes (login, mirror, discover) **unchanged**.

Predicate: `is_explicit_non_production_surface_allowed()`.

## Public test surface policy

| Route | Production | CI/dev |
|-------|------------|--------|
| `GET /api/public/test-safety-benchmarks` | **404** | Available |
| `GET /api/test-results/latest` | **404** | Available |
| `GET /api/test-results/comprehensive` | **404** | Available |
| `GET /api/test-results/health` | **404** | Available |
| `POST /api/public/publish` | **404** | Available (key required) |
| `GET /health` (main app) | **200** | **200** |

Infrastructure health: **`GET /health`** retained (minimal `{ "status": "ok" }`).

## Phase 8.1 regressions reverified

- Direct password reset → 404 in production
- Auth debug → 404 in production
- Internal setup → 404 in production
- mirror-v2-lab + `/dev/*` → blocked on production hosts
- Global unhandled 500 → generic envelope

## Tests

- `tests_security/test_phase811_security_closure.py`
- `tests/productionSurfaceGuardPhase811.test.ts`
- Phase 8.1 + Phase 5/6/7 suites preserved in CI

## Intentionally deferred

Share routing, Discover UX, guest/free entitlements, onboarding, profile privacy, visibility gates, moderation, guest→auth continuity, Journey V1, mobile UX, observability platform, per-file removal of dead `str(e)` source strings in non-critical routers.

---

*No secrets in this document.*
