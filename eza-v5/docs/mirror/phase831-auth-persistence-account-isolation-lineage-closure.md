# Phase 8.3.1 — Auth Persistence, Account Isolation & Lineage Closure

Tarayıcıyı kapatmak çıkış yapmak değildir.
Geçerli oturumum varsa biligN'e döndüğümde kaldığım hesabımla devam ederim.
Çıkış yaparsam aynı cihazdaki başka kişi benim sohbetlerimi göremez.

## Persistent auth

- Valid `eza_token` + `eza_user` survive browser close/reopen.
- On startup, AuthContext keeps `isAuthReady=false` until validation finishes (avoids logged-out flash → sudden login).
- Validation order: JWT `exp` (when decodable) → `GET /api/auth/me` via `validateAuthSession`.
- Explicit logout clears auth storage and rotates guest identity. Next reopen does **not** restore that account.

## Expired / invalid token

- Expired JWT → clear auth locally, guest surface.
- Invalid/401 session from `/api/auth/me` → clear auth locally, guest surface.
- Network / 5xx during `/me` validation → keep optimistic local session (do not force logout on reopen blips).
- No refresh-token architecture in 8.3.1.
- Account-scoped local history remains on device under `user:{userId}` but is not visible while logged out.

## Account-scoped local storage

Identity namespaces (never email):

| Scope | Key form |
|-------|----------|
| Authenticated | `user:{userId}` |
| Guest | `guest:{guestToken}` |

Scoped stores:

- Chat archive → `eza_standalone_chat_archive_scoped_v1`
- Conversation groups → `eza_standalone_conversation_groups_scoped_v1`
- Active chat id → `eza_standalone_active_chat_id_scoped_v1`

Legacy flat keys migrate into the current identity bucket on first read.

## Guest → user rebind

`mergeGuestConversationTree`:

- Moves guest-scope chats/groups into user-scope (additive, idempotent, no duplicates by chat id / group title).
- Preserves lineage proof into `treeMetadata.lineageProofToken`.
- Remaps active chat when safe.
- Clears guest-scope buckets after rebind.
- Server `claim-guest` only when pending guest work **or** `eza_pending_guest_claim_v1` marker exists (stops empty reopen churn).
- Rotates guest token only after successful claim.
- Claim failure: user stays authenticated, local rebind kept, pending marker set, guest token not rotated.

## Logout

- Clears `eza_token` / `eza_user`.
- Rotates guest token (fresh empty guest scope).
- Dispatches archive/group update events so sidebar drops prior user chats.
- Does **not** require deleting `user:{id}` history.

## Lineage proof fallback

Canonical helper: `resolveLineageProofToken(chat)`

Precedence:

1. `mirrorOrigin.lineageProofToken`
2. `treeMetadata.lineageProofToken`

Used by:

- StandaloneChatInner stream / non-stream send body
- `resolveMirrorPublishLineage` (child publish)

Proof must not appear in URLs, logs, or public DTOs.

## Claim lifecycle

| Event | Claim? | Rotate guest? |
|-------|--------|----------------|
| Login with guest chats/groups | yes | on success |
| Reopen with empty new guest | no | no |
| Claim failed previously (pending marker) | yes | on success |
| Auth login/register failure | no merge | guest preserved |

## Same-device vs cross-device

- Same-device account continuity: **in scope** (this phase).
- Cross-device chat sync: **deferred** (not Phase 8.3.1 / not 8.4 yet).

## Journey / Ayna drafts

`review8DraftStore` is already keyed by `ownerUserId` — no private draft leak across users on shared device for that store.
Experienced Discover slug hide-list remains device-local (non-private content). No Journey redesign in this phase.

## Storage inventory

| STATE | STORAGE | IDENTITY SCOPE | SURVIVES REFRESH | SURVIVES BROWSER CLOSE | VISIBLE AFTER LOGOUT? | RESTORED WHEN SAME USER RETURNS? |
|-------|---------|----------------|------------------|------------------------|-----------------------|----------------------------------|
| auth token | `eza_token` | auth session | yes | yes (if valid) | no (cleared) | only if not logged out + still valid |
| user profile | `eza_user` | auth session | yes | yes (if valid) | no (cleared) | yes with valid token |
| guest token | mirror guest key | guest | yes | yes | yes (rotated on logout/claim) | n/a (new guest after rotate) |
| chat archive | scoped v1 buckets | `user:` / `guest:` | yes | yes | no (hidden) | yes (same `user:{id}`) |
| conversation groups | scoped v1 buckets | `user:` / `guest:` | yes | yes | no (hidden) | yes |
| active chat id | scoped active map | `user:` / `guest:` | yes | yes | no (other scope) | yes within same scope |
| lineage proof | inside chat archive | chat owner scope | yes | yes | no with chat | yes with chat |
| Ayna/Journey Review8 draft | review8 draft key | `ownerUserId` | yes | yes | no (other userId) | yes |
| Discover randomSession | in-memory ref | session | no | no | n/a | no |
| experienced Yansı slugs | discover experienced key | device | yes | yes | yes (device hide-list) | yes (device) |
| pending guest claim | `eza_pending_guest_claim_v1` | guestToken+userId | yes | yes | cleared on claim ok | retries claim |

## Phase 6 metrics

Auth hydrate/reopen must not emit STARTED / COMPLETED / SKIPPED / exposure / continuation events.

## Cross-device status

Deferred.
