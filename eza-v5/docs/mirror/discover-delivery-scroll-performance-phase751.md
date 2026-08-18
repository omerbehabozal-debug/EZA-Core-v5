# Phase 7.5.1 — Discover delivery and scroll performance

Internal and product note. Product language: **biligN**. Code identifiers (Yansı / Discover / Saina / EZA Mirror) stay.

The next Yansıs should be ready before the user needs them.

Discover is three lenses. None is ranked “better.” Default remains Rastlantısal.

**Rastlantısal** — keşif / serendipity.

**Güçlü Merak** — evidence-informed curiosity, frozen Phase 7.4.2 policy.

**En Yeni** — time.

This phase does not change ranking, metrics, or those meanings. It changes how cards are *delivered* as the user scrolls.

## What the user should feel

Open Keşfet. First cards appear quickly.

Keep scrolling: 1 → 10 → 20 → 40 → 60 → 100.

New cards should continue appearing. There should not be a repeated empty wait at the bottom of a 24-card wall. Prefetched cards are not “seen.” They are only waiting below.

## First page vs scroll page

**First page** (enter Discover or change mode): existing skeleton, then the first 24 cards. Rastlantısal may fetch a few extra pages only if the local hide-list emptied that first page.

**Scroll page:** after the first page succeeds, the next page is requested quietly in the background. Further pages are requested when the list sentinel approaches the viewport (about 14 card-heights of buffer). The global skeleton is not shown again.

If a later page fails, already-loaded cards stay. A quiet retry is offered at the bottom.

## Prefetch is not exposure

Downloading JSON, putting cards in React state, or rendering them off-screen does **not** increment canonical exposure.

Exposure remains:

- meaningful visibility
- ≥50% intersection
- ≥750ms
- document visible

`YansiExposureRoot` is still the authority. Card images already use `loading="lazy"`.

## Pagination

Page size stays **24**. Backend offset cap stays **500** (about 504 cards). Frontend will not request an offset above 500.

Same corpus snapshot:

- Rastlantısal: same `randomSession` → same HMAC order; page 1 ∩ page 2 ∩ page 3 = empty
- En Yeni: `published_at` DESC, slug ASC
- Güçlü Merak: frozen 7.4.2 order from the live cache/snapshot

Offset pagination is **not** snapshot-isolated if new Yansıs are published *during* a scroll. A newly published root can shift En Yeni. Güçlü Merak / Rastlantısal can also change if the eligible set changes. The client appends by slug and skips duplicates. This is accepted launch behavior, not cursor pagination.

## Güçlü Merak cache

The 30-second in-process rank cache remains for first-page freshness.

Scroll pages (`offset > 0`) reuse the same-fingerprint ordered slug snapshot even after that TTL, so page 2 is not sliced from a newly recomputed order. A later first page (`offset = 0`) after expiry recomputes.

Each API worker has its own cache. Redis is not used. Viewer identity is not a cache key.

If the eligible-slug fingerprint changes (a root enters or leaves Discover), the snapshot is discarded. Mid-scroll duplicates are still guarded by client slug-dedupe.

## Three-mode performance (measured vs not)

**MEASURED (CPU, mocked I/O):** HMAC permutation and newest in-memory sort at 100 / 1,000 / 10,000 are cheap relative to loading the eligible corpus. Rastlantısal does not need an extra session-order cache at these sizes.

**MEASURED (Phase 7.5, mocked evidence batch):** Güçlü Merak ranking compute grows with pool size; page 2/3 reuse the cache/snapshot and skip the evidence batch.

**INFERRED from code:** every mode still loads up to 10,000 eligible roots, then orders, then projects only the page. En Yeni is not a SQL `ORDER BY published_at LIMIT 24` over the live corpus — replayReady still requires the canonical load. There is no dedicated `published_at` index.

**NOT MEASURED:** production Postgres wall-clock at 10k, real CDN image time, real mobile scroll FPS.

## 10k limitation

`MAX_DISCOVER_ELIGIBLE_LOAD = 10_000` still applies to all three live modes (stable `slug ASC` window).

| Eligible roots | Delivery |
|---|---|
| 9,000 | All three modes can list them (subject to offset 500). |
| 10,000 | Cap reached. |
| 10,001 / 20,000 | Additional valid roots may be omitted. No user-facing “10k” message. |

This is an **acceptable launch bound** and **scaling debt**, not a ranking correctness defect. Offset 500 is a separate delivery bound: a user cannot scroll the whole 10k window in this phase.

## Images and DOM

Cards use existing lazy-loaded `<img>`. Scene assets far below the viewport should not all download at once.

At launch scale (tens to low hundreds of cards in the tab), list virtualization is not required. Mode change aborts in-flight requests and replaces the list.

## Remaining scaling debt

- Full eligible corpus is loaded for every first page (and cache-miss Güçlü Merak).
- En Yeni cannot yet page in SQL without weakening replayReady.
- In-process GM cache is per worker.
- Offset pagination is not a publication snapshot.
- 10k + offset 500 bounds.

Ranking, kill switch, fail-closed, Phase 6 metrics, and Phase 5 Journey are unchanged.
