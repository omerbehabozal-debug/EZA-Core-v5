# Phase 8.5B — Profile Experience & Design

Profil, kişinin kendisini anlattığı bir sosyal medya vitrini değildir.
Profil, kişinin oluşturduğu Yansıları gösterir.

---

## Profile principle

Identity is quiet and secondary. Yansıs are the main content.

Curiosity-first, not popularity-first.

## Avatar (V1)

- **DEFAULT circular avatar** — no upload
- 56–64px mobile, 64–72px desktop
- First grapheme of resolved **public** display name
- Soft deterministic tint from public UUID
- Never email / email local-part
- Generic fallback name → glyph `b`

Deferred: object storage, moderation, EXIF, CDN lifecycle for user photos.

## No bio / interests / social graph

Absent in V1:

- bio / free-text description
- automatic curiosity sentence
- selectable interests
- followers / following / Follow
- reputation / badges / links

## Public header

```
[default avatar]
Public display name
Yansılar
[cards…]
```

## Owner header

Same composition + **Profili düzenle** (sheet/modal).

No dual-list dashboard. No raw profile URL dump.

## Yansı card contract

Same visual family as Discover/`MirrorPublicCard`:

1. Scene visual  
2. Title  
3. Conversation-derived summary (≈2–3 lines)

**Not** Instagram image tiles.

Profile V1 **omits** Phase 6.2 social-proof metrics (Discover unchanged).

Whole card → `/m/{slug}` (Phase 8.2 frozen authority). No direct sohbet bypass.

## Layout

| | |
|--|--|
| Mobile | 1 column |
| ≥720px | 2 columns |
| Content width | ~840px max |

## Owner controls

Quiet visibility chip + ⋯ menu → Phase 8.4 `visibility` / `unpublish` APIs.

Public visitors never see chips/menus.

## Edit

Sheet (mobile) / centered modal (desktop):

- Görünen ad only  
- `PATCH /api/auth/me/public-identity`

## Auth-ready

Ownership UI waits for `isAuthReady`. Skeleton until resolved — closes visitor/owner flash.

## Empty states

| | |
|--|--|
| Public zero | “Henüz herkese açık Yansı yok.” — no private inference |
| Owner zero | Guide to create first Yansı |

## Load more

Page size 24. If `total > loaded` → **Daha fazla göster**. No virtualization.

## Privacy / frozen phases

8.5A identity, 8.4 visibility, 8.3 continuity, 5/6/7 — unchanged.

## Deferred

Photo upload, curiosity bio experiments, infinite scroll, 1000+ virtualization, SAINA→biligN shell rebrand.
