# Phase 7.2 — Strong Curiosity Candidate Contract

Internal only. biligN product language; identifiers stay existing (Yansı / Discover / Saina).

Güçlü Merak means:

> Yansılar for which we have meaningful evidence that curiosity is being initiated, sustained, and/or generated.

It does **not** mean most popular. Candidate ≠ quality. Candidate ≠ rank.

Live Discover **Güçlü Merak** remains the Phase 7.1 placeholder. This module does not order the feed.

## Candidate ≠ ranked

The profile has no `score`, `rankScore`, `qualityScore`, `curiosityScore`, `priorityScore`, `strengthScore`, `weightedScore`, `compositeScore`, or `popularityScore`.

Phase 7.3 owns shadow ordering.

## States

| State | Meaning |
|---|---|
| `NOT_ELIGIBLE` | Fails canonical Phase 7.1 Discover eligibility |
| `INSUFFICIENT_EVIDENCE` | Eligible, no independent/historical family evidence |
| `CANDIDATE` | At least one family has independent (non-self) evidence |
| `HISTORICAL_ONLY` | Only pre-Phase-6 generativity evidence (children, no starts/continuations) |

States describe **ranking readiness**, not goodness.

`inCandidatePool` = `CANDIDATE` or `HISTORICAL_ONLY`.

## Base eligibility

Same pool as Phase 7.1 Discover: root, public, open, published, `journey_v1`, frozen, `replayReady`, HTTPS scene for cards. Not weakened.

## Inputs

Only existing Phase 6 internals:

- 6.3 `YansiSignalSemantics`
- 6.4 exposures / own continuation / sample sizes (via 6.5)
- 6.5 `get_yansi_normalized_signal_evidence_batch` (self vs external, unique auth, age, selectedCount, child diversity, historical gap, locale/topic)

No raw-table re-aggregation in 7.2. No EZA. No Relationship Map. No followers / creator reputation.

## Evidence readiness (not quality)

Candidacy is **availability of evaluable evidence**, not whether a metric looks good.

| Family | Independent evidence | Status notes |
|---|---|---|
| Attraction | `rankingEligibleStartedCount >= 1` | Volume/readiness only. **No global attraction rate.** Exposures stay context-separated. |
| Engagement | ranking-eligible STARTED denominator `>= 1` | Rates keep numerator/denominator. Skip is navigational branching, never a disqualifier. |
| Generativity | `externalDirectChildYansiCount >= 1` **or** ranking-eligible own-continuations `>= 1` | Historical children without Phase 6 starts → `HISTORICAL`, rates stay null. |

A Yansı may be a candidate from **one family**. There is **no all-three requirement**.

Quality cutoffs such as `completionRate >= 0.70` or `children >= 5` are forbidden.

## Small-sample policy

No exclusion threshold.

`LOW_SAMPLE_STARTED_THRESHOLD = 3` is a **reason-code only** flag: ranking-eligible STARTED in `{1, 2}` emits `LOW_SAMPLE`. `2/2` complete is still `CANDIDATE`. 100% is not a ranking claim.

## New Yansı

Zero evidence → `INSUFFICIENT_EVIDENCE`. No freshness boost and no age penalty. Discoverability stays Rastlantısal / En Yeni.

## Historical data

`historicalMeasurementGap`: children exist, Phase 6 starts = 0, continuations = 0. Rates remain `null`. State `HISTORICAL_ONLY`. Not rejected.

## Version / slug scope

Experience/engagement: slug + `journeyVersion`. Children / continuations / diversity: slug. Mixing children with a version's starts is `SCOPE_INCOMPATIBLE`. Children are never attributed to v2 specifically.

## Self vs unique vs guest

Public `experienceStartedCount` is unchanged.

Ranking-eligible starts/completes/continuations exclude authenticated **author** self-rows.

Repeat non-author auth users are **not** auto-deduped in session counts. Unique authenticated viewer count is a separate field. 5 Bob sessions ≠ 5 people.

Guest unique-human evidence is **UNAVAILABLE**. 5 guest sessions are 5 sessions. No IP/UA fingerprint.

## Reason codes

`NOT_DISCOVER_ELIGIBLE`, `NO_PHASE6_EVIDENCE`, `NO_INDEPENDENT_EVIDENCE`, `ATTRACTION_EVIDENCE_AVAILABLE`, `ATTRACTION_RATE_UNAVAILABLE`, `ENGAGEMENT_EVIDENCE_AVAILABLE`, `GENERATIVITY_EVIDENCE_AVAILABLE`, `EXTERNAL_CHILD_DIVERSITY_AVAILABLE`, `LOW_SAMPLE`, `HISTORICAL_MEASUREMENT_GAP`, `SCOPE_INCOMPATIBLE`, `SELF_INTERACTION_PRESENT`, `GUEST_UNIQUE_HUMAN_UNAVAILABLE`, `SKIP_NAVIGATIONAL_BRANCHING`

No `HIGH_QUALITY` / `BORING` / `VIRAL`.

## Pool statistics (internal)

`totalEligible`, `noEvidence`, `partialEvidence`, `candidateCount`, `historicalOnlyCount`, `familyCoverage` (`engagementHeavy` / `generativityHeavy` / `mixed`). Inspection order is input order, **not** rank. Volume does not exclude smaller evaluable items.

## Batch / shadow path

`evaluate_strong_curiosity_candidates_batch` → one 6.5 batch.
`evaluate_discover_strong_curiosity_pool` loads 7.1 eligible roots then evaluates.

Public Discover listing does **not** call these. `strongCuriosityReady` stays `false`.

## Phase 7.3

This phase ends with a trustworthy candidate pool.
7.3 may order **shadow** candidates. Not implemented here.
