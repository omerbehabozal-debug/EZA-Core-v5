# Phase 7.4.2 — Strong Curiosity Final Layered Shadow Policy

Internal only. Product language: **biligN**. Identifiers stay existing (Yansı / Discover / Saina).

**This phase evaluates the layered policy. It does not activate live ranking.**

Güçlü Merak remains:

`items=[]`, `total=0`, `strongCuriosityReady=false`

UI: *Güçlü Merak henüz hazır değil.*

Phase 7.5 limited live experiment remains **NO-GO**.

> Güçlü Merak bir popülerlik listesi değildir.
> Bir Yansı'nın insanlarda merakı sürdürdüğüne ve yeni meraklar
> üretebildiğine dair güvenilir kanıtları görünür kılmayı amaçlar.

## Frozen input audit

Phase 7.3 comparators were **not rewritten**.

| Strategy | Frozen role (7.4.1) | Audit |
|---|---|---|
| `balanced_evidence` | FOUNDATION | Semantic keys unchanged; used as Layer B |
| `generativity_led` | REPRESENTATION | Unchanged; **not** applied as global sort (that would be always-first) |
| `evidence_stability` | CONFIDENCE | Unchanged; last-resort before slug |
| `engagement_led` | DIAGNOSTIC_ONLY | Unchanged; disagreement flags only |
| `control_input_order` | CONTROL_ONLY | Unchanged; comparison reference |

Docstring vs tuple note on `_balanced_key` (family count, historical flag, **distinct external authors**, **external children**, engagement status, log1p den, rate, unique auth, log1p starts, slug) remains the 7.3 implementation. 7.4.2 does not “fix” that tuple.

## Exact layered policy (not five scores)

```
A. Phase 7.2 candidate pool (CANDIDATE + HISTORICAL_ONLY)
B. balanced_evidence foundation keys
C. representation_band replaces only the family-count axis
D. evidence_stability ordinal after all semantic keys except slug
E. engagement_led computed for diagnostics; cannot reorder
```

No weighted composite. No `curiosityScore` / `rankScore` / 0–100 quality score.

Tie-break: `slug ASC`. Deterministic for the same candidate snapshot.

## Layer C — generativity representation (not a quota)

`representation_band(row)`:

- if generativity status is **AVAILABLE** and at least one of
  `distinctExternalChildAuthorCount`, `externalDirectChildYansiCount`,
  `rankingEligibleContinuationCount` is ≥ 1
  **and** the row is not `HISTORICAL_ONLY` / historical-gap:
  `band = max(available_family_count, 2)`
- else: `band = available_family_count`

`2` is the count of non-generativity independent families (attraction + engagement),
not a 20/30/50% quota and not “at least N generative rows”.

Effects:

- three-family mixed evidence still leads
- one-family AVAILABLE external generativity competes with two-family volume/engagement,
  then existing diversity keys (authors, external children) decide
- HISTORICAL rows do **not** receive the floor
- not `children DESC`
- not “always rank generative #1”

Applying frozen `generativity_led` as a full sort would put AVAILABLE/HISTORICAL generativity first globally (`alwaysFirstForbidden` in 7.4.1). Representation therefore uses that strategy’s **signals**, not its global order.

## Confidence / engagement / historical / new

- Confidence: unique-auth (author self-play excluded) already in foundation keys; `evidence_stability` only after semantic keys. Guest unique-human remains `UNAVAILABLE`. No IP/UA/fingerprint.
- Engagement-led: diagnostic disagreement only. Skip is not a penalty. `selectedCount` is not a key.
- Historical: `HISTORICAL_ONLY`, gap codes, no fake 0%/100%/∞ conversion, no band floor.
- New / evidence-poor: `INSUFFICIENT_EVIDENCE`, not in pool, not labelled weak. Rastlantısal / En Yeni remain the discovery path. No freshness boost or age decay.

## Isolation

`list_discover_mirrors` must not import this module. Rastlantısal and En Yeni are unchanged. No public DTO fields.

## Phase 7.5

**NO-GO.** Combined shadow policy is evaluable, but live ranking is not justified while guest uniqueness, the 10k corpus bound, and production-corpus behaviour remain unresolved, and while Güçlü Merak is still a public placeholder.
