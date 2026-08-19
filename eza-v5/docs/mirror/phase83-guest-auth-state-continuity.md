# Phase 8.3 — Guest → Auth & State Continuity

> I started without an account. After registering, I continue where I left off.

---

## User contract

Guest starts something → authentication becomes necessary → register or login → return to the **same meaningful journey** → continue without reconstructing context.

Authentication is a boundary, not a reset.

---

## State classification

| State | Class | Continuity |
|-------|-------|------------|
| Guest token | MUST_SURVIVE until claim | Rotated after successful claim + on logout |
| Conversation groups | MUST_SURVIVE_AUTH | Local merge + `claim-guest` |
| Chat archive (metadata + bodies) | MUST_SURVIVE_AUTH (same device) | Local merge; bodies stay in localStorage |
| Active chat / route return | MUST_SURVIVE_AUTH | `return=` query + safe path resolver |
| Source Yansı slug / treeMetadata | MUST_SURVIVE_AUTH | Preserved in archive |
| `lineageProofToken` | MUST_SURVIVE_AUTH (short-lived) | Copied into `treeMetadata` on merge |
| EZA prefs (guest bucket) | MAY_SURVIVE_AUTH | Copied to user scope if user has none |
| Journey generation artifacts | EPHEMERAL / deferred | Owner-keyed; no guest→user copy in 8.3 |
| Discover hide-list | MAY_SURVIVE (device) | Device-global; not claimed |
| Discover randomSession / mode | EPHEMERAL | Session/browser only |
| Public frozen Journey | ALREADY_SERVER_AUTHORITATIVE | No migrate |
| Behavioral history guest bucket | DEFERRED | Not migrated in 8.3 |
| Chat cross-device sync | DEFERRED | Same-device only |

---

## Register flow (after)

1. `POST /api/auth/register` returns `TokenResponse` (`access_token`, `user_id`, `role`, `email`).
2. Client calls **`setAuth`** immediately (no password replay, no silent `/login`).
3. `setAuth` → `mergeGuestConversationTree` + `claim-guest`.
4. Redirect to safe `return` path (`/m/{slug}`, sohbet, Ayna, etc.).

Manual second-login trap: **removed** for SAINA + platform register when token material is present.

---

## Login flow

Unchanged entry: login → `setAuth` → merge/claim → safe return.

Failed login/register: guest state untouched.

---

## Guest token lifecycle

| Event | Behavior |
|-------|----------|
| First anonymous use | Mint UUID-quality token (≥16 chars) |
| Auth success + claim OK | Rotate token |
| Logout | Rotate token (shared-device isolation) |
| Claim failure | Keep token; retry possible |

---

## claim-guest

- Auth required (`get_current_user`).
- Claims only groups with matching guest fingerprint and `user_id IS NULL`.
- Additive merge by normalized title; clears `guest_token` after assign.
- Idempotent: second claim finds no guest rows.

Authorization: client cannot claim another user's groups — only unassigned rows matching the presented fingerprint.

---

## Lineage / child publish

Merge copies `lineageProofToken` from `mirrorOrigin` into `treeMetadata` before stripping `mirrorOrigin`. Same-device chat bodies retained. Server proof remains authority for parent binding.

---

## Same-device vs cross-device

- **Same device:** required and implemented for chat archive + groups + return path.
- **Cross-device chat sync:** deferred (localStorage archive).

---

## Quota

Guest→Free: Free `dailyMirrorLimit` already ≥ Guest (Phase 8.2). Claim does not mint a second Ayna entitlement; usage events remain server-authoritative. No double-count redesign in 8.3.

---

## Privacy

- No password persistence for auto-login.
- No guest token / lineage proof in public URLs or logs from this phase.
- Shared browser: logout rotates guest identity.

---

## Tests

- Frontend: `tests/phase83GuestAuthContinuity.test.ts`, extended `mergeGuestConversationTree.test.ts`
- Backend: `tests/test_phase83_guest_auth_continuity.py`

---

## Deferred (Phase 8.4+)

- Full Journey artifact guest→user migration
- Behavioral history guest→user migration
- Cross-device chat sync
- Multi-tab live AuthContext broadcast beyond current storage events
