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

## Account linking policy

1. Existing `(provider, sub)` → that user (repeat login).
2. Else provider **verified** email matches an existing biligN email → **link** identity (no duplicate).
3. Else create social-only user (`password_hash` null).
4. Race / conflict → **409** fail closed (no silent merge of two established accounts).
5. Unverified provider email → **do not** link by email.
6. Google + Apple on same biligN user only via step 2 (same verified email) or separate links already on that user — never merge two biligN accounts by display name.
7. Apple Hide My Email / relay: stored as account email only; **never** `public_display_name` (Phase 8.5 fallback: `biligN kullanıcısı`).
8. Apple name hint applied **only on create** when `validate_public_display_name` passes; never overwrites an existing explicit public name.

## CSRF / nonce

- **Google GIS**: credential bound to configured Web Client ID + authorized origins (Google-side). Backend verifies signature/aud/iss/exp/sub.
- **Apple**: client generates nonce; Apple returns SHA-256(hex) in id_token; backend requires match when nonce is sent. Popup `usePopup: true`; redirect URI from `APPLE_REDIRECT_URI`.

## Return-to

User return path uses existing `resolveSafeAuthReturnPath` allowlist (Phase 8.7). OAuth `state` is **not** used as an open redirect. Provider callback URI is config-controlled.

## Environment variables

### Backend / Railway (secrets + config)

| Variable | Public? | Purpose |
|----------|---------|---------|
| `GOOGLE_OAUTH_CLIENT_ID` | Returned to client via capabilities only | GIS Web client ID; JWT audience |
| `APPLE_CLIENT_ID` | Returned via capabilities | Services ID; JWT audience |
| `APPLE_TEAM_ID` | **Secret / server** | Reserved for future code-exchange client secret JWT |
| `APPLE_KEY_ID` | **Secret / server** | Same |
| `APPLE_PRIVATE_KEY` | **Secret / server — never frontend** | PEM for Sign in with Apple key |
| `APPLE_REDIRECT_URI` | Returned via capabilities (HTTPS URL only) | Must match Apple Services ID Return URLs |

Fail closed: missing Google client ID → Google unavailable; missing Apple client ID → Apple unavailable. Email auth unaffected.

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
