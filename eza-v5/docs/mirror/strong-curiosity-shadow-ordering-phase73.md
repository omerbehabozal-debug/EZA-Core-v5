# Phase 7.3 — Strong Curiosity Shadow Ordering

Internal only. Product language: **biligN**. Identifiers stay existing (Yansı / Discover / Saina).

Phase 7.2 answered which Yansılar have enough trustworthy evidence to enter the Güçlü Merak candidate pool.

Phase 7.3 asks: **if** we had to order those candidates, which transparent strategies produce reasonable results?

This is **shadow evaluation**. Users still cannot see a Güçlü Merak ranking.

## Why shadow first

A live Güçlü Merak order would commit one ranking story to the public feed. We do not yet know which evidence story is honest.

Shadow evaluation lets the system produce:

> candidate A before B under strategy X

internally, then compare strategies for popularity bias, self-play leakage, and small-sample pathologies — without replacing the Phase 7.1 placeholder.

Live Discover remains:

| Mode | UI | Behavior |
|---|---|---|
| `random` | Rastlantısal | Unchanged. HMAC seed permutation. |
| `newest` | En Yeni | Unchanged. `published_at DESC`, `slug ASC`. |
| `strong_curiosity` | Güçlü Merak | **Placeholder.** `items=[]`, `strongCuriosityReady=false`. |

`list_discover_mirrors` does **not** import this module.

## No composite score

There is no:

`0.3 * Attraction + 0.3 * Engagement + 0.4 * Generativity`

and no `score` / `rankScore` / `qualityScore` / `weightedScore` / `curiosityScore` / `compositeScore`.

Ordinal position is allowed. Transformed counts (`log1p`) are **internal sort keys only** and are not emitted.

Pareto fronts are **not** used as the order. Scope incompatibility and `UNAVAILABLE` vs `0` make pairwise domination ill-defined. A pairwise popularity-agreement diagnostic exists instead.

## Strategy set (internal names, not product modes)

| Internal id | Role |
|---|---|
| `control_input_order` | Neutral control: eligible pool **input order** (Discover corpus is slug-ASC). Not popularity. |
| `balanced_evidence` | Multi-family structured comparison. Not a weighted average. |
| `generativity_led` | Independent generativity first. Not `children DESC`. |
| `engagement_led` | Sample-aware completion. Rate never leads. Skip is not a penalty. |
| `evidence_stability` | Unique-auth / sample confidence. Not quality. |

Do not expose these names on Discover DTO, metrics DTO, profile DTO, or frozen DTO.

## Comparator contracts

After the semantic keys, every strategy uses **`slug ASC`**. No random tie-break.

### `control_input_order`

1. Preserve eligible candidate input order  
2. `slug ASC` only as the recorded tie-break basis (does not reorder)

Answers: did a proposed strategy materially change who rises?

### `balanced_evidence`

Lexicographic, not a hidden composite:

1. AVAILABLE independent family count (DESC)  
2. HISTORICAL generativity present (DESC) — after available families, not first/last by fiat  
3. `distinctExternalChildAuthorCount` (DESC)  
4. `externalDirectChildYansiCount` (DESC)  
5. engagement family status (DESC)  
    6. `log1p(ranking-eligible completion denominator)` (DESC)  
    7. ranking-eligible completion ratio (DESC, **after** denominator)  
    8. unique authenticated started viewers excluding author self-play (DESC)
9. `log1p(rankingEligibleStartedCount)` (DESC) — **last** semantic key so raw start volume cannot dominate  
10. `slug ASC`

`log1p` damps count magnitude (`100000` vs `2000` is not a 50× key gap). It is not a public score.

### `generativity_led`

1. generativity family status (`AVAILABLE` > `HISTORICAL` > `PARTIAL` > `UNAVAILABLE`)  
2. `distinctExternalChildAuthorCount`  
3. `externalDirectChildYansiCount`  
4. `rankingEligibleContinuationCount` (authenticated author self-play excluded)  
5. child publication rate **only if** the row is scope-compatible (versioned conversion is not invented)  
6. `slug ASC`

Self-authored child spam is not treated as independent generativity.

### `engagement_led`

1. engagement family status  
2. `log1p(ranking-eligible started sample used as completion denominator)`  
3. ranking-eligible completion ratio **after** sample support  
4. `log1p(rankingEligibleCompletedCount)`  
5. `slug ASC`

Skip rate is navigational branching and is **not** subtracted. `selectedCount` (6/7/8) is diagnostic context, not a 6-vs-8 correction formula.

`2/2` complete therefore cannot outrank `7000/10000` solely because `1.0 > 0.7`. The small sample carries `LOW_SAMPLE_CAVEAT`.

### `evidence_stability`

1. unique authenticated viewer evidence present  
2. `log1p(uniqueAuthenticatedStartedViewerCount)`  
3. `log1p(ranking-eligible started sample)`  
4. `slug ASC`

100 sessions from 1 authenticated account do not carry the same independent-evidence meaning as 100 sessions from 80 accounts. Guest uniqueness stays `UNAVAILABLE`. No invented unique guest humans.

## Evidence used

Only Phase 7.2 candidate fields (which themselves consume 6.3 + 6.5):

- Attraction: `rankingEligibleStartedCount`, context exposures, **no attraction rate**  
- Engagement: completion numerator / denominator / rawRate / sample, skip as diagnostic, `selectedCount`  
- Generativity: `directChildYansiCount`, `externalDirectChildYansiCount`, `distinctExternalChildAuthorCount`, ranking-eligible continuations  
- Confidence: unique authenticated viewers, self vs external, historical gap, scope flag  
- Diagnostic metadata only: language, topic, ageDays, region=`UNAVAILABLE`

Rates always carry numerator, denominator, rawRate, and sample size. Missing denominator → rate stays `null` (historical / unavailable). Unavailable ≠ zero quality.

## Forbidden inputs

EZA scores, Relationship Map, followers, profile views, creator popularity, creator total Yansılar, viewer id, past experiences, locale preference, chat history, IP region, freshness boost, age decay.

Changing those values must not change shadow order.

## Attraction handling

Global `STARTED / all exposures` conversion remains unavailable. Strategies do not invent it. Starts and exposures stay separate.

## Historical / scope

`HISTORICAL_ONLY` may participate. Pre-Phase-6 children without starts do not produce fake conversion rates. Caveat: `HISTORICAL_GAP`.

Experience is version-scoped; children are slug-level. `SCOPE_INCOMPATIBLE` blocks version-specific generativity conversion. Raw slug-level children/diversity may still order `generativity_led`.

## Self-play / diversity / age

Ranking-eligible counts exclude authenticated author self-rows where Phase 6.5 already does. Public counts are unchanged. No hard-ban of self-authored content.

Diversity (`distinctExternalChildAuthorCount`) prevents one actor’s many children from looking identical to many independent authors.

Age is inspected in comparison diagnostics. **No** freshness boost or age penalty in default strategies. Tests freeze `evaluated_at`.

## Internal result model

```
StrongCuriosityShadowResult
  strategy
  orderedCandidates[]  # slug, journeyVersion, candidateState, ordinal,
                       # reasonCodes, reasonSummary, evidenceSnapshot, tieBreak
  diagnostics
```

Reason codes (examples): `MULTI_FAMILY_EVIDENCE`, `EXTERNAL_GENERATIVITY`, `HIGHER_ENGAGEMENT_EVIDENCE`, `GREATER_EVIDENCE_VOLUME`, `LOW_SAMPLE_CAVEAT`, `HISTORICAL_GAP`, `SCOPE_INCOMPATIBLE`, `AUTH_CONCENTRATION`.

No `BEST` / `BORING` / `VIRAL` / `HIGH_QUALITY`. No private session/user ids.

## Multi-strategy comparison

Internal only. For strategy pairs:

- top-K overlap (K = 10 / 20 / 50 diagnostic)  
- position deltas  
- only-in-one top-K  

This is **not** a live “Top 50”.

Popularity-correlation diagnostic: pairwise agreement of shadow ordinals vs raw started count, raw `directChildYansiCount`, and optional debug `yansiCount`. High monotonic agreement (`≥ 0.90` of comparable pairs) is flagged `HIGH_MONOTONIC_DEPENDENCE`. Those volume series are **not** strategy inputs.

## Batch / 10k corpus

The shadow runner uses the same Phase 7.1 Discover eligible-root load (`MAX_DISCOVER_ELIGIBLE_LOAD = 10_000`, slug ASC). It does not claim a global rank beyond that corpus.

### N+1 (Phase 6.5 inherited)

**Before:** `get_yansi_normalized_signal_evidence_batch` called `get_public_frozen_journey_artifact` once per pair → extra ~2N queries (node + steps) on top of the already-batched 6.5 loads.

**After:** one `get_public_frozen_journey_artifact_batch` that reuses loaded nodes and one steps query. Public `GET /{slug}/frozen` is unchanged.

No ranking table and no migration. Rankings are computed on demand.

## Privacy / live experiment

No viewer/session identities in shadow output. No public telemetry of shadow rank. No A/B bucket. No 1% traffic. No public route.

## Phase 7.4 evaluation boundary

7.4 may judge which shadow strategy (if any) is honest enough to consider for a **still-unshipped** live Güçlü Merak. 7.3 does not pick a winner and does not flip `strongCuriosityReady`.
