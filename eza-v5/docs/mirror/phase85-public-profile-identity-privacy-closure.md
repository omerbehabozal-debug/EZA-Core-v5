# Phase 8.5 — Public Profile & Identity Privacy Closure

Profilimde başkalarının ne gördüğünü ben kontrol ederim.
E-posta adresim hiçbir zaman ismim olarak yayınlanmaz.
Yalnızca açıkça public yaptığım Yansılar profilimde görünür.

---

## Public identity contract

A public biligN identity may expose only deliberate public fields:

| Field | Public? | Notes |
|-------|---------|--------|
| `displayName` | Yes | Explicit `public_display_name` or neutral fallback |
| `userId` (UUID) | Yes | Opaque profile routing id (`/standalone/u/{uuid}`) |
| Public Yansı list | Yes | `is_profile_listable` only (Phase 8.4) |
| Public metrics on listable items | Yes | Existing Phase 6.2 social-proof counts |
| Email | **No** | Never |
| Email local-part | **No** | Never used as display name |
| Role / tier / plan | **No** | Auth `/me` only |
| Guest token / session / event ids | **No** | |
| Lineage proof / ranking evidence / EZA score | **No** | |
| Handle / avatar / bio | Not introduced | UUID URLs remain |

## Display-name source

**Before (defect):** `author_profile._public_display_name_from_email` → email local-part (e.g. `omerbozal@gmail.com` → `omerbozal`).

**After:** `resolve_public_display_name(user)`:

1. Explicit `production_users.public_display_name` if set
2. Else `PUBLIC_DISPLAY_NAME_FALLBACK` = `"biligN kullanıcısı"`

No migration copies email local-parts into the new column.

## Fallback behavior

Missing / empty / whitespace-only public name → `"biligN kullanıcısı"`.

Owner chrome (private menu) uses the same explicit name when set; otherwise `"Hesabım"` (not email local-part). Email may still appear as a private account line in the menu.

## Owner vs public profile

| | Public `GET /authors/{uuid}/published` | Owner `GET /me/profile-yansilar` |
|--|--|--|
| Auth | None (rate-limited) | Authenticated owner |
| Yansıs | `is_profile_listable` only | Owner inventory + visibility labels |
| `displayName` | Safe public resolver | Same resolver |
| Cache | `Cache-Control: no-store` | `no-store` |

Frontend: `/standalone/u/{uuid}` uses public fetch for visitors; owner viewing self uses owner inventory.

## Profile URL

`/standalone/u/{uuid}` — opaque UUID. No email/username URLs.

## Profile editing

`PATCH /api/auth/me/public-identity` `{ "public_display_name": "…" }`

- Authenticated owner only
- Validation: trim, length 2–48, no control/angle chars, no `@`, reserved names
- Register `full_name` (when valid) may seed `public_display_name` as an **explicit** choice
- UI: profile menu “Herkese açık ad”

## Handles

**Deferred.** Product uses UUID profile URLs; no public handle system in 8.5.

## Creator identity in Discover / Yansı

- Discover cards: no creator email; no creator popularity in ranking
- Public frozen artifact: `authorUserId` only; display resolved via public profile contract
- `/m/{slug}` OG metadata: title/summary/scene only — no creator email

## Cache behavior

Public author profile + owner inventory: `no-store` so visibility / display-name changes are not stuck behind CDN caches. Display-name client cache in `resolvePublicAuthorDisplayName` is in-memory only (cleared on navigation refresh).

## Email privacy

Email remains on auth `/me` (PRIVATE_ACCOUNT_ONLY). Public serializers must not include it.

## Legacy naming

User-visible Discover/explainer already uses biligN language in places; `/m/[slug]` metadata still says “SAINA” (pre-existing). No mass internal SAINA/UKARRA rename in this phase. Fallback string uses **biligN**.

## Logging

`public_profile_updated user_id=…` — no old/new name, no email in that log line.

## Tests / CI

- Backend: `tests/test_phase85_public_profile_identity_privacy.py`
- Frontend: `tests/phase85PublicProfileIdentityPrivacy.test.ts`
- Wired into backend-ci + frontend-ci Phase 8 suites

## Migration

`add_user_public_display_name_phase85` — nullable `production_users.public_display_name` (no backfill from email).
