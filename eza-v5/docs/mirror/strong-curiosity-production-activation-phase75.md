# Phase 7.5 — Güçlü Merak production activation

Internal and product note. Product language: **biligN**. Existing code identifiers (Yansı / Discover / Saina / EZA Mirror) stay.

This phase turns Güçlü Merak on as a real Discover lens. It does **not** redesign ranking. The frozen Phase 7.4.2 layered policy is the only order function.

## Three lenses

Discover remains three user-selectable modes. None is presented as objectively better.

**Rastlantısal** (default) — keşif / serendipity. Unchanged.

**Güçlü Merak** — kanıt oluştukça, merak üretme veya sürdürme potansiyeli gösteren Yansıları öne çıkaran görünüm. Evidence-informed, not “best content”.

**En Yeni** — zaman. Chronological. Unchanged.

Güçlü Merak is **not**:

- “best content”
- popularity or creator popularity
- EZA judgment
- a personalized feed
- a permanent quality score
- an automatic-learning ranker

The algorithm does not rewrite itself from later behavior. Evidence can change the *order*; it must not change the *rules*.

## Product behavior

- Default remains Rastlantısal. The user chooses Güçlü Merak.
- New or insufficient-evidence Yansıs are not a quality judgment. They stay in Rastlantısal and En Yeni. They simply may not yet appear in Güçlü Merak.
- Historical-only semantics stay intact. Missing rates are not invented.
- Guest unique-human remains UNAVAILABLE. No fingerprinting.

## Kill switch / rollback

Env: `STRONG_CURIOSITY_DISCOVER_ENABLED`

- unset / `true` / `1` → Güçlü Merak ranking on
- `false` / `0` → fail closed
- any other value → configuration error (same strict bool as Journey V1)

Settings are process-cached. Restart/redeploy API workers after changing the flag.

**When disabled:** `mode=strong_curiosity` returns `items=[]`, `total=0`, `strongCuriosityReady=false`. It does **not** return Rastlantısal, En Yeni, or legacy `yansiCount` order under the Güçlü Merak label.

**Operational rollback:** set `STRONG_CURIOSITY_DISCOVER_ENABLED=false` and restart API workers. Rastlantısal and En Yeni are unaffected.

Frontend copy when unavailable: *Güçlü Merak şu anda kullanılamıyor.*

## Failure

Ranking is optional. Exceptions fail closed to the same unavailable payload. The Discover endpoint, Rastlantısal, and En Yeni must keep working. No stack traces, scores, or strategy names in the public response.

## Ranking path vs diagnostic path

Live request (`GET /api/mirror-network/discover?mode=strong_curiosity`):

1. Canonical Discover-eligible roots (Phase 7.1)
2. Phase 7.2 candidate profiles (batch evidence)
3. Frozen `order_final_shadow_candidates` (Phase 7.4.2)
4. `limit` / `offset` slice of that order
5. Page-only public card metrics (`N deneyim · N Yansı`)

Not run on the live request: production-shadow reports, synthetic evaluation, pairwise diagnostics, strategy comparison, author-concentration diagnosis, JSON artifacts, staging seeder.

Pagination is deterministic for a stable evidence snapshot: the full pool is ordered, then sliced. Page 2 must not duplicate page 1. Tie-break remains slug ASC from the frozen policy. A 30-second process-local slug-order cache avoids repeating the evidence batch on nearby page requests. Redis is not used.

## 10k corpus bound

Discover still loads at most 10,000 eligible roots (`slug ASC`). Rastlantısal, En Yeni, and Güçlü Merak share that load bound. Beyond 10k, additional valid roots may be omitted. There is no user-facing “10k” message. Truncation is operational-log only.

## Observability

Privacy-safe logs (counts, duration, cache hit, truncated, outcome). No viewer IDs, session IDs, IP, UA, or slugs in the live ranking log line.

Phase 6 signals (STARTED / COMPLETED / SKIPPED / exposure / own continuation / child Yansı) keep their frozen meaning. No new ranking event type.

## Staging fixtures

`p743a-*` seeders are not imported by Discover or the live ranking module. Production ranking uses real canonical Yansı evidence only. No startup hook seeds fixtures.
