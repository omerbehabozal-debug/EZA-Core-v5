# Phase 8.7 — Mobile, returning user & frictionless auth

Bir şey yaparken kayıt olmam gerekirse, hesabımı oluşturduktan sonra kaldığım yere dönerim.
Profil doldurmak zorunda kalmam.
Tarayıcıyı kapatmak çıkış yapmak değildir.
Telefonda klavye açıldığında veya bağlantı kesildiğinde yaptığım iş kaybolmaz.

## Status

Implemented (2026-08-21). Phase 8.1–8.6 remain frozen.

## Auth interruption principle

Authentication is an interruption, not an onboarding ceremony.

1. User is in a meaningful context (`/m/...`, sohbet, Discover, Ayna).
2. Auth becomes necessary (publish, account-only action, etc.).
3. Email login/register (Google/Apple not production-wired).
4. Auth succeeds → return to the **same internal** `?return=` path.
5. Profile is **never** forced.

## Provider status

| Provider | Status |
|----------|--------|
| Email | **PROVEN** — `POST /api/auth/login` + `/register` |
| Google | **PARTIAL** — UI stub only (`SainaAuthGoogleButton`); not on login/register |
| Apple | **ABSENT** |

Do not claim Google/Apple as live until OAuth + callbacks exist.

## Return-to

- Capture: `useSainaAuthReturnUrl` / `buildSainaAuthHref`
- Validate: `resolveSafeAuthReturnPath` — relative only; product allowlist (`/standalone`, `/m/`, `/platform`, `/dev/`)
- Apply: `router.push(safeReturn)` after login/register
- Cancel/dismiss IdentityModal: guest context kept
- Platform login → register link preserves `return`

## Guest Journey / Ayna (same-device)

Guests may draft Journey under `guest:{token}` (windows, Review, panel artifacts).

On auth, `migrateGuestJourneyStateToUser` rebinds into `userId` (idempotent), called from `mergeGuestConversationTree` **before** guest token rotate.

Publish remains auth-gated. No cross-device draft sync. Another user cannot claim a foreign guest bucket without that token.

## Browser restart

`AuthContext` persists JWT in localStorage; reopen auto-continues while valid. Explicit logout clears + rotates guest token. Expired JWT → clean logged-out.

## Second visit / onboarding

No mandatory post-register profile setup. Ordinary revisit uses Discover/home; interrupted auth uses `return`.

## Mobile

- `useSainaVisualViewportInset` → `--saina-keyboard-inset` on composer padding
- IdentityModal: bottom-sheet on small screens + `safe-area` + `92dvh`
- Auth pages: `100dvh` + safe-area
- Discover: `randomSession` in sessionStorage; scroll position restored after `/m` back

## Entitlement / metrics

Guest→Free claim unchanged (Phase 8.3). Auth return does not emit Phase 6 STARTED/COMPLETED.

## Deferred

- Full Google/Apple OAuth + callbacks
- Cross-device unpublished draft sync
- Complex multi-tab auth broadcast
- Phase 8.8 observability
