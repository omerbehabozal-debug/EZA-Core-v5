# Phase 8.2 — Share + Discover → Frozen Yansı Loop

Product note: closes the public acquisition loop from Keşfet and shared links through frozen replay to continuation and child Yansı.

---

## User journey (canonical)

```
Keşfet card  OR  shared link
        ↓
   /m/{slug}          ← public landing (title, summary, poster)
        ↓
 frozen Journey replay ← "Bu merakı deneyimle" → first question tap = STARTED
        ↓
 completion / skip
        ↓
 "Kendi merakımla devam et" → /m/{slug}/sohbet
        ↓
 live conversation + lineageProofToken
        ↓
 child Yansı publish (server proof)
```

No silent bypass to live sohbet from Keşfet.

---

## Engineering

### Discover card

- **Before:** `startDiscoverGuestChatFromSlug` → immediate sohbet session + `/standalone?chat=…`
- **After:** `router.push(/m/{slug})` via `buildMirrorPublicPath`
- CTA: **Bu merakı deneyimle**
- Exposure/STARTED unchanged: navigation alone does not START

### Share URL SSOT

| Layer | Source |
|-------|--------|
| Backend | `build_mirror_share_url()` in `services/mirror_network/slug.py` |
| Frontend path | `buildMirrorPublicPath()` in `lib/eza/mirror-network/mirrorPublicUrl.ts` |
| Frontend absolute | `buildMirrorPublicShareUrl()` |

**Production default host:** `https://standalone.ezacore.ai`  
Override: `EZA_MIRROR_PUBLIC_BASE_URL` (backend) / `NEXT_PUBLIC_EZA_MIRROR_PUBLIC_BASE_URL` (frontend)

Legacy `saina.app` default removed from active builder path.

### Middleware

`/m/*` routes use `isPublicMirrorNetworkPath()` and **pass through** before `standalone.ezacore.ai` domain rewrite. Deep-link refresh on `/m/{slug}` works.

### Frozen replay authority

- Public landing loads `GET /api/mirror-network/{slug}/frozen`
- Missing/unready frozen → unavailable UI (**no** live sohbet fallback)
- Sohbet session creation requires frozen replay-ready artifact (aligned gate)

### Safety mapping

| Client `safetyLevel` | `safety_status` | `visibility` | Discover |
|---------------------|-----------------|--------------|----------|
| `normal` | `open` | `public` | eligible |
| `sensitive` | `review` | `unlisted` | **not** eligible |
| `elevated`/`review`/`caution` | `review` | `unlisted` | not eligible |
| `restricted`/`block` | `restricted` | `private` | not eligible |

### Free vs Guest Ayna

| Tier | `dailyMirrorLimit` (before → after) |
|------|-------------------------------------|
| guest | 1 → 1 |
| free | 0 → **1** |

Signup no longer reduces first Ayna capability below guest.

### Phase 6 metric invariants (preserved)

- Landing / Keşfet navigation: no STARTED
- First frozen question tap: STARTED
- Prefetch: no exposure inflation
- `directChildYansiCount` semantics unchanged

### Tests

- Backend: `tests/test_phase82_share_discover_loop.py`
- Frontend: `tests/phase82ShareDiscoverLoop.test.ts`, updated `discoverCard.test.tsx`

---

## Deferred (Phase 8.3+)

- Full biligN rebrand (SAINA remains in most live chrome)
- Lineage proof TTL UX
- Full moderation platform
- Phase 9 lineage UI

*No secrets in this document.*
