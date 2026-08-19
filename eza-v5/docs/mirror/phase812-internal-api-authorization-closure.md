# Phase 8.1.2 — Internal API Authorization Closure

Internal engineering note. Closes P0 `require_internal()` no-auth bypass.

---

## Root cause

`backend/core/utils/dependencies.py` `require_internal()` returned an async `no_auth()` function that always passed, making routes depending on it **effectively public**.

Same pattern existed for `require_institution_auditor()`.

`/api/internal/*` used `require_api_key()` which allowed unauthenticated access in dev when `EZA_ADMIN_API_KEY` was unset.

---

## Fix

New module: `backend/auth/internal_access.py`

Contract for internal tooling routes:

1. `assert_non_production_surface()` — 404 unless runtime env is explicitly `dev`, `development`, `test`, `ci`, or `staging` (raw `os.getenv`, fail-closed on missing/unknown).
2. `EZA_ADMIN_API_KEY` required via **`X-Api-Key` header** (401 if missing/invalid/unconfigured).
3. No query-param keys, no `dev-key` placeholder, no JWT substitution.

`require_internal()` and `require_institution_auditor()` now delegate to this guard.

`/api/internal/*` routes use `Depends(validate_internal_api_key)` instead of loose `require_api_key()`.

---

## Affected route inventory

| Method | Path | File | Classification | External cost |
|--------|------|------|----------------|---------------|
| POST | `/api/gateway/test-call` | gateway.py | NON_PRODUCTION_ONLY | LLM provider |
| POST | `/api/gateway/evaluate` | gateway.py | NON_PRODUCTION_ONLY | Analysis only |
| POST | `/api/proxy/eval` | proxy.py | NON_PRODUCTION_ONLY | LLM via route_model |
| POST | `/api/internal/run` | internal_proxy.py | NON_PRODUCTION_ONLY | LLM + engines |
| GET | `/api/internal/history` | internal_proxy.py | NON_PRODUCTION_ONLY | No |
| GET | `/api/internal/session/{id}` | internal_proxy.py | NON_PRODUCTION_ONLY | No |
| POST | `/api/multimodal/video/run` | multimodal.py | NON_PRODUCTION_ONLY | Multimodal pipeline |
| POST | `/api/multimodal/audio/run` | multimodal.py | NON_PRODUCTION_ONLY | Multimodal pipeline |
| POST | `/api/multimodal/image/run` | multimodal.py | NON_PRODUCTION_ONLY | Multimodal pipeline |
| POST | `/api/proxy-lite/audio` | proxy_lite_media.py | NON_PRODUCTION_ONLY | Whisper/Groq STT |
| POST | `/api/proxy-lite/video` | proxy_lite_media.py | NON_PRODUCTION_ONLY | OCR/STT |
| POST | `/api/proxy-lite/image` | proxy_lite_media.py | NON_PRODUCTION_ONLY | OCR |
| GET/POST | `/api/institution/*` | institution.py | NON_PRODUCTION_ONLY | DB mutate |
| POST | `/api/proxy-lite/report` | proxy_lite.py | NON_PRODUCTION_ONLY | Internal report |

**Not affected (real product):**

- `POST /api/proxy-lite/analyze` — public proxy-lite product (separate auth/quota)
- `POST /api/standalone/stream` — chat
- `POST /api/standalone/mirror/*` — Ayna scene generation
- Discover / mirror-network routes

---

## Frontend

- `/docs/test-suite` gated via `productionSurfaceGuard` + server `notFound()` on consumer production surfaces.
- Internal proxy/gateway clients under `/proxy` UI are corporate/regulator tooling — not SAINA standalone consumer path.

---

## Tests

- `tests_security/test_phase812_internal_api_authorization.py`
- `tests/productionSurfaceGuardPhase812.test.ts`

Provider-call proof: gateway/internal/multimodal tests mock external calls and assert **not called** on 401/404.

---

## Deferred

Share loop, Discover UX, guest entitlements, moderation, observability platform — Phase 8.2+.

*No secrets in this document.*
