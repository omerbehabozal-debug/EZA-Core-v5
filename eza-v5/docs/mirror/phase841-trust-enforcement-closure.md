# Phase 8.4.1 — Trust Enforcement Closure

Narrow closure of Phase 8.4 audit defects. Does not redesign 8.4 / 8.5.

## Production safety-remove auth

`require_internal()` remains non-production-only (Phase 8.1.2 unchanged).

New: `backend/auth/yansi_trust_admin.py`

- Header only: `X-Api-Key`
- Prefers `EZA_YANSI_TRUST_ADMIN_API_KEY`, falls back to `EZA_ADMIN_API_KEY`
- Works in production
- Never logs key values/prefixes
- Not used by `/api/internal/*`, gateway, proxy, multimodal

`POST /api/mirror-network/{slug}/safety-remove` uses this dependency.

## Public slug trust cache

- `fetchPublicMirrorBySlug` defaults to `cache: 'no-store'`
- `/m/[slug]` and `/m/[slug]/sohbet` set `dynamic = 'force-dynamic'` + `revalidate = 0`
- Metadata uses trust-authoritative fetch (no 300s ISR)
- Frozen public fetch uses `cache: 'no-store'`

## Cached sohbet revalidation

Before returning `sessionStorage` sohbet cache, client rechecks:

1. public mirror still direct-link eligible
2. frozen replay still available

If either fails → clear cache → attempt create (backend authority) → unavailable.

## Historical sensitive audit

Fixed impossible `open AND review` query.

Classifier + aggregate helpers for fixtures:

- `review_and_public` (risky)
- `restricted_and_public` (risky)
- `restricted_not_private`
- `public_open_discover_visibility`
- `unlisted_review_link_only` (expected sensitive)
- `private_any_safety`

Script remains read-only.
