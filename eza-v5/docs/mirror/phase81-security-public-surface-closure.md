# Phase 8.1 — Security & Public Surface Emergency Closure

Internal engineering note. Product language: **biligN**. Code identifiers unchanged.

**Scope:** Close production-facing P0/P1 security and accidental dev/debug surface exposure identified in Phase 8.0. No product redesign, no Phase 7 ranking changes.

---

## Confirmed Phase 8.0 findings (this phase)

| ID | Finding | Status |
|----|---------|--------|
| P0-3 | Unauthenticated `POST /api/auth/reset-password` | **CONFIRMED** — fixed |
| P0-4 | Unauthenticated `/api/auth/debug/*` | **CONFIRMED** — fixed |
| P0-5 | Global 500 `str(exc)` leak in `main.py` | **CONFIRMED** — fixed |
| P0 (internal) | `/internal/create-test-regulator-user` returns plaintext password | **CONFIRMED** — route absent in production |
| P1-11 | `/standalone/mirror-v2-lab` production-reachable | **CONFIRMED** — blocked |
| P1-14 (partial) | `internal_setup` 500 leaked `str(e)` | **CONFIRMED** — fixed |
| P2-16 | Login failure logged user email samples | **PARTIALLY CONFIRMED** — suppressed in production |

## Not reproducible / already safe (unchanged this phase)

| Finding | Verdict |
|---------|---------|
| Token-based reset secret in API response | **NOT REPRODUCIBLE** — no token lifecycle exists; reset was direct email+password |
| `/api/debug/mirror-network` without secret | **ALREADY SAFE** — 404 when secret unset; now also absent in production |
| `/api/debug/openai-health` without secret | **ALREADY SAFE** — same pattern; now also absent in production |
| `POST /api/gateway/test-call` | **ALREADY SAFE** — requires `require_internal()` auth |
| `/api/internal/*` proxy debug | **ALREADY SAFE** — requires API key |

## Root causes

1. **Dev convenience endpoints** shipped on the same router as production auth without environment guard.
2. **No token-based password reset** — forgot-password UI called a dev-only direct reset API.
3. **Global exception handler** appended raw exception text to every unhandled 500.
4. **Frontend lab routes** had `robots: noindex` only — no production fail-closed guard.

## Fixes

### Backend — `backend/security/production_surface.py`

- Canonical helpers: `is_production_runtime()`, `assert_non_production_surface()`, `public_internal_error_content()`.
- Production detection reuses `is_production_settings()` from `backend/config.py` (`ENV` / `EZA_ENV` ∈ `{prod, production}`).

### Password reset — `POST /api/auth/reset-password`

| | Before | After |
|---|--------|-------|
| Production | Anyone with email could set new password | **404 Not Found** (route absent) |
| Dev/CI | Direct reset works | Unchanged |

Forgot-password UI (`app/platform/forgot-password/page.tsx`) fails closed on production surfaces (no API call).

### Auth debug — `/api/auth/debug/check-email`, `/api/auth/debug/test-login`

| | Before | After |
|---|--------|-------|
| Production | Public user directory + password hash preview | **404** |
| Dev | Full debug payloads | Unchanged |

### Internal setup — `POST /internal/create-test-regulator-user`

| | Before | After |
|---|--------|-------|
| Production | Callable with header; returns plaintext password in JSON | **404** |
| Dev + valid key | Returns password in JSON | Unchanged (dev only) |
| 500 body | `str(e)` | `{ "error": "internal_server_error" }` |

### Debug APIs — `/api/debug/openai-health`, `/api/debug/mirror-network/*`

| | Before | After |
|---|--------|-------|
| Production + secret | Accessible with header | **404** (production fail-closed) |
| Non-production + secret | Accessible | Unchanged |
| Non-production, no secret | 404 | Unchanged |

### Global 500 — `backend/main.py`

| | Before | After |
|---|--------|-------|
| Body | `{ "detail": "Internal server error", "error": "<raw exc>" }` | `{ "error": "internal_server_error" }` |
| Logs | Full traceback server-side | Unchanged |

Intentional **4xx** `HTTPException` responses unchanged (`http_exception_handler`).

### Frontend lab/dev surfaces

- `lib/eza/productionSurfaceGuard.ts` — path + host guards.
- `middleware.ts` — returns **404** for lab/dev paths on `*.ezacore.ai` and `VERCEL_ENV=production`.
- `app/standalone/mirror-v2-lab/page.tsx` — `notFound()` on production surfaces.
- Blocked prefixes: `/standalone/mirror-v2-lab`, `/dev/*`.

## Environment guard semantics

Uses **raw process env** (`os.getenv`) for security surfaces — not Pydantic default `ENV=dev`.

See **Phase 8.1.1** (`phase811-security-closure.md`) for fail-closed unknown/missing semantics.

| Source | Precedence | Production values |
|--------|------------|---------------------|
| `EZA_ENV` | Overrides `ENV` when set in process env | `prod`, `production` |
| `ENV` | Explicit process env only for security guard | `prod`, `production` |
| Allowed non-prod | `dev`, `development`, `test`, `ci`, `staging` | |

**Fail-closed rule (8.1.1):** Missing or unrecognized runtime env → dev/debug/test routes return **404**.

## Route inventory (Phase 8.1 scope)

| Route | Class | Production reachability after 8.1 |
|-------|-------|----------------------------------|
| `POST /api/auth/login` | AUTHENTICATED_PRODUCT (public login) | Reachable |
| `POST /api/auth/register` | AUTHENTICATED_PRODUCT | Reachable |
| `POST /api/auth/logout` | AUTHENTICATED_PRODUCT | Reachable |
| `GET /api/auth/me` | AUTHENTICATED_PRODUCT | Reachable (auth required) |
| `POST /api/auth/reset-password` | INTERNAL_NON_PRODUCTION | **404** |
| `GET /api/auth/debug/check-email` | INTERNAL_NON_PRODUCTION | **404** |
| `POST /api/auth/debug/test-login` | INTERNAL_NON_PRODUCTION | **404** |
| `POST /internal/create-test-regulator-user` | INTERNAL_NON_PRODUCTION | **404** |
| `GET /api/debug/openai-health` | INTERNAL_NON_PRODUCTION | **404** |
| `GET/POST /api/debug/mirror-network/*` | INTERNAL_NON_PRODUCTION | **404** |
| `POST /api/gateway/test-call` | AUTHENTICATED_PRODUCT (internal role) | Reachable with auth |
| `GET /api/public/test-safety-benchmarks` | PUBLIC_PRODUCT | Reachable — **deferred** hardening |
| `GET /api/test-results/latest` | PUBLIC_PRODUCT | Reachable — **deferred** hardening |
| Global unhandled 500 | PUBLIC_PRODUCT error envelope | Generic `{ "error": "internal_server_error" }` |
| `/standalone/mirror-v2-lab` | INTERNAL_NON_PRODUCTION | **404** on prod hosts |
| `/dev/*` | INTERNAL_NON_PRODUCTION | **404** on prod hosts |

## Tests

### Backend — `tests_security/test_phase81_production_surface_closure.py`

- Production: reset/debug/internal-setup/debug-openai/debug-mirror-network → 404
- Dev: reset-password business 404 (user missing) proves route exists
- Global exception handler masks arbitrary exception text
- Login 401 semantics preserved; validation 422 preserved

### Frontend — `tests/productionSurfaceGuardPhase81.test.ts`

- Lab/dev path blocking on `standalone.ezacore.ai`
- Localhost not blocked
- `VERCEL_ENV=production` detection

## Intentionally deferred (later Phase 8)

- Profile displayName from email local-part
- Public GET `/{slug}` / Sohbet vs Discover gate alignment
- Report / block / unpublish moderation
- Share-loop / middleware `/m/*` rewrite
- Guest vs Free entitlement inversion
- Discover → frozen Yansı UX
- Guest → auth continuity
- Per-route `str(e)` in proxy/corporate routers (outside global handler)
- Public benchmark endpoints surface reduction
- Full token-based email password reset product flow
- Observability (Sentry/OTEL)
- Compact shell mobile first-paint

## Phase 5 / 6 / 7

No changes to Journey/replay/lineage, metrics/exposure, or Discover ranking modes (Rastlantısal default, En Yeni, Güçlü Merak frozen 7.4.2).

---

*Phase 8.1 — audit-driven security closure. No secrets in this document.*
