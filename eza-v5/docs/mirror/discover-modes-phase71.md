# Phase 7.1 — Discover modes foundation + Rastlantısal selection

Product language: **biligN**. Internal routes, tables, event names, and identifiers stay existing (EZA Mirror / Saina / Yansı). This phase is not a rebrand.

Discover has exactly three user-selectable modes, one pipeline:

| API `mode` | UI | Phase 7.1 behavior |
|---|---|---|
| `random` | Rastlantısal | **Default.** Stable seeded permutation of eligible root Yansılar. |
| `strong_curiosity` | Güçlü Merak | **Placeholder.** Empty list, `strongCuriosityReady=false`. Not legacy `yansiCount`. Ranking is Phase 7.2. |
| `newest` | En Yeni | `published_at DESC`, then `slug ASC`. |

Missing / blank `mode` → `random`. Invalid `mode` → **422** `invalid_discover_mode`. Garbage is never remapped.

## API

```
GET /api/mirror-network/discover?mode=random&randomSession=<opaque>&limit=&offset=
```

`randomSession` is an opaque permutation seed (`[A-Za-z0-9_-]{8,64}`). Not a ranking weight. Guests work. No IP / EZA / profile / behavioral seed. Not written to a user profile. The client may keep it in **sessionStorage** (`eza_discover_random_session_v1`) for one Discover tab session.

## Rastlantısal algorithm

```
randomKey = HMAC-SHA256(seed, slug.lower())
order = sort by randomKey, then slug
then offset/limit slice
```

Forbidden in this key: `yansiCount`, STARTED/completion, children, exposure, normalization, followers, EZA, recency, author popularity.

Same seed + same eligible corpus → same order. Page 2 cannot reshuffle page 1. A new seed may produce a different permutation.

Do **not** `ORDER BY RANDOM()` per request.

## Eligibility (root Discover pool)

SQL: `parent_slug IS NULL`, `visibility=public`, `safety_status=open`, `published_at IS NOT NULL`, `artifact_kind=journey_v1`, `freeze_status=frozen`.

Then the same Phase 5 helper: `is_replay_ready_from_loaded_child` (GET `…/frozen` / 5.1.1). Do not invent a second replayReady.

**HTTPS scene URL** is a Discover **card presentation** gate (cards need a showable image). It is not Journey eligibility.

Root-only is unchanged. Children stay chain / profile.

## Güçlü Merak placeholder

No candidate model. No DB ranking query. Selecting the mode must not silently alias `yansiCount DESC`.

## Legacy `yansiCount`

Still on the Discover DTO for compatibility. Still used on non-Discover impact/share where the old meaning is valid. It does **not** order Rastlantısal, En Yeni, or Güçlü Merak. Public card copy remains Phase 6.2.1: `N deneyim · N Yansı`.

## Experienced-mirror hide list

Client-only (`eza_discover_experienced_mirror_slugs`).

- **Rastlantısal:** optional repetition reduction (skip locally completed slugs). Not personalization. No private conversation content.
- **En Yeni:** no hide — true newest eligible roots.
- **Güçlü Merak:** deferred with the placeholder (empty).

Canonical server order is independent of this hide list.

## Pagination

Offset pagination on the **already ordered** eligible list. Rastlantısal stability requires the same `randomSession` across pages.

## >250 / overflow

`MAX_DISCOVER_CANDIDATE_SCAN = 250` (newest window) is **removed**.

Load cap: `MAX_DISCOVER_ELIGIBLE_LOAD = 10_000` ordered by **slug ASC** (stable identity, not recency/popularity). If a corpus ever exceeds 10k, document it as a fairness overflow — do not call that global Rastlantısal.

HMAC ordering is **application-side** (SQLite + Postgres portable). Steps are batched with `journey_slug IN (...)`.

## Mode UI / state

Quiet `Rastlantısal · Güçlü Merak · En Yeni` between hero and list.

- Bare `/standalone/discover` → Rastlantısal.
- `?mode=` used for refresh/back. No long-term preference/profile.
- New tab / new sessionStorage → new random seed; mode still Rastlantısal unless the URL says otherwise.

## Fetch races

Request id + AbortController. A slower Rastlantısal response cannot overwrite En Yeni (and the reverse). Mode switch clears cards before applying the new list.

## Phase 6 metrics and exposure

Projection remains **batch / page slice** after ordering. No per-card `GET /metrics`.

Exposure is still ≥50% intersection + ≥750ms on rendered cards (`YansiExposureRoot`). Fetching / prefetching / mode switching does not itself count as exposure. Rastlantısal selection is not an exposure.

## Privacy

No viewer fingerprint, IP identity, EZA/user-profile seed, or private behavioral seed. Seed is not persisted to a ranking/profile table.
