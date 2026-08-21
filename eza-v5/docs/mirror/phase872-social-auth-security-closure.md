# Phase 8.7.2 — Social Auth Security Closure

## Defects closed

1. **Verified-email auto-link removed** — same email as an existing biligN account → `409 account_link_required` (no silent link).
2. **Apple state/nonce server-bound** — `POST /api/auth/social/apple/start` creates single-use DB attempt; complete requires `state`; nonce recovered server-side; replay rejected.
3. **Identity race** — user+identity created in one transaction (`commit=False` + commit); `IntegrityError` → rollback → re-fetch `(provider, sub)` → idempotent login.

## Linking policy (current)

1. Existing `(provider, provider_subject)` → that user (email changes ignored).
2. Else email already belongs to a biligN user → **conflict** (deferred explicit link).
3. Else create social-only user with `public_display_name=NULL`.

## Apple attempt

| Field | Behavior |
|-------|----------|
| `state` | `secrets.token_urlsafe(32)`, unique, single-use |
| `nonce` | raw returned once to client; **hash** stored server-side |
| TTL | 600s |
| `return_path` | allowlisted relative path only (Phase 8.7); never open redirect |
| Cancel | `POST /api/auth/social/apple/cancel` marks consumed |

## Runtime env (actually read)

### Google (current)

- `GOOGLE_OAUTH_CLIENT_ID` — audience + capabilities

### Apple (current id_token + attempt)

- `APPLE_CLIENT_ID` — Services ID / audience
- `APPLE_REDIRECT_URI` — must match Apple Return URL; returned by start/capabilities

### Apple (future code-exchange only — NOT runtime-required today)

- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`

## Privacy

- Provider name is **not** auto-written to `public_display_name`.
- Apple relay / email never public; Phase 8.5 fallback remains.
- Provider tokens never persisted client-side.

## Explicit account linking

Deferred to a later authenticated settings phase. Security over convenience.
