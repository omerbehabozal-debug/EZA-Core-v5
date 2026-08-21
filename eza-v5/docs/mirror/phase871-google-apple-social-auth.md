# Phase 8.7.1 — Google + Apple Social Auth (Production Closure)

## Product contract

Guest → auth-required action → **Google ile devam et** / **Apple ile devam et** →
verified provider identity → **existing biligN JWT** → `setAuth` → guest claim /
conversation merge / Journey·Ayna migrate → **safeReturn**.

No profile wizard. No second login. No password after social. No provider token as session.

## Architecture

| Layer | Behavior |
|-------|----------|
| Frontend | GIS One Tap / credential (`id_token`) or Apple JS popup (`id_token` + nonce) |
| Backend | Verify JWT (JWKS, iss, aud, exp, sub); resolve/link user; issue biligN JWT |
| Identity | `user_auth_identities (provider, provider_subject)` unique |
| Continuity | Same `TokenResponse` + `AuthContext.setAuth` as email |

## Account linking policy (Phase 8.7.2)

1. Existing `(provider, sub)` → that user (repeat login; email changes ignored).
2. Else email matches an existing biligN user → **`409 account_link_required`** (no auto-link).
3. Else create social-only user (`password_hash` null, `public_display_name` null).
4. Identity/email insert race → rollback + re-fetch by `(provider, sub)` → idempotent success when possible.
5. Explicit link-while-authenticated UI is **deferred**.
6. Apple Hide My Email / relay: account email only; never public display name.

## CSRF / nonce (Phase 8.7.2)

- **Google GIS**: unchanged credential JWT verification (iss/aud/exp/sub).
- **Apple**: `POST /api/auth/social/apple/start` issues server `state` + raw `nonce`; hash stored in `social_auth_attempts`; complete requires `state`; nonce optional-from-client is **removed**.

## Environment variables

### Runtime (required for live social)

| Variable | Public? | Purpose |
|----------|---------|---------|
| `GOOGLE_OAUTH_CLIENT_ID` | Via capabilities | GIS Web client ID; JWT audience |
| `APPLE_CLIENT_ID` | Via capabilities | Services ID; JWT audience |
| `APPLE_REDIRECT_URI` | Via capabilities | Must match Apple Return URLs |

### Future-only (code exchange — not required for current id_token path)

| Variable | Notes |
|----------|-------|
| `APPLE_TEAM_ID` | Reserved |
| `APPLE_KEY_ID` | Reserved |
| `APPLE_PRIVATE_KEY` | Never frontend |

### Frontend / Vercel

| Variable | Notes |
|----------|-------|
| None required for secrets | Client loads capabilities from `GET /api/auth/social/capabilities` |
| Do **not** put `APPLE_PRIVATE_KEY` or client secrets in `NEXT_PUBLIC_*` | |

Optional: ensure production API base / same-origin `/api` rewrites already used by Standalone.

## Google Cloud Console (manual)

1. Create / select Google Cloud project.
2. APIs & Services → Credentials → Create OAuth client ID → **Web application**.
3. Authorized JavaScript origins: production + staging origins (e.g. `https://standalone.ezacore.ai`).
4. Copy Client ID → `GOOGLE_OAUTH_CLIENT_ID` on Railway (backend).
5. Scopes used: OpenID Connect default (`openid email profile`) via GIS — do not add Drive/Gmail/etc.
6. No client secret required for GIS id_token verification path.

## Apple Developer (manual)

1. Apple Developer → Identifiers → App ID with **Sign In with Apple**.
2. Create **Services ID** for web; enable Sign In with Apple; configure domains + **Return URLs** (HTTPS).
3. Return URL must equal `APPLE_REDIRECT_URI` (e.g. `https://standalone.ezacore.ai/platform/login`).
4. Keys → Create Key → Sign In with Apple → download `.p8` once → `APPLE_PRIVATE_KEY` (PEM, newlines as `\n` in env if needed).
5. Note Team ID, Key ID, Services ID → `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID`.
6. Deploy backend env; never commit the `.p8`.

## Logging

Safe: `social_auth_success provider=google user_id=<uuid>`  
Safe: `social_auth_failure provider=apple reason=invalid_token`  
Never: authorization code, access/refresh/id tokens, private key, nonce, full state, emails beyond existing auth policy.

## Migration

Revision: `add_user_auth_identities_phase871_v1`  
- `production_users.password_hash` nullable  
- table `user_auth_identities`

## Tests

- Backend: `tests/test_phase871_social_auth.py` (mocked JWKS / JWT; no live Google/Apple)
- Frontend: `tests/phase871SocialAuth.test.ts`

## Production readiness

Code path is production-safe and fail-closed. **Live Google/Apple remain CONDITIONAL** until Console/Developer + Railway env are configured and smoke-tested on HTTPS staging/production.
