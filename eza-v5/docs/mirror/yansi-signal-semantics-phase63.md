# Phase 6.3 — Yansı signal semantics (internal)

Internal contract only. Not ranking. Not public UI.

EZA Mirror does not optimize for views, likes, followers, or watch time alone.
It values curiosity initiation, curiosity continuation, and curiosity generation.

## Families

| Family | Question | Current evidence |
|---|---|---|
| **Attraction** | Does this Yansı make people want to begin? | `experienceStartedCount` (AVAILABLE). True attraction rate UNAVAILABLE until a canonical impression denominator exists. Do not reuse landingViews. |
| **Engagement** | Once someone begins, does curiosity hold them? | `completionRate`, `skipRate`, `observedAverageDepth` (AVAILABLE). Completion is positive evidence, not THE quality score. |
| **Generativity** | Does this Yansı cause new curiosity to emerge? | `directChildYansiCount` (AVAILABLE, slug-level). `childGenerationRateCandidate` is DERIVED and unadjusted. |

Do not collapse these into one popularity number. Signals belong to the Yansı, not the author. EZA / Relationship Map / private history are not inputs.

## Immutable meanings (do not casually reinterpret)

- `experienceStartedCount` ≠ quality, popularity, or conversion rate.
- `skipRate` ≠ bad. Current durable skip is destination-backed **navigational branching**, not drop-off / failure / bounce. Skip and complete may coexist.
- `observedAverageDepth` is **milestone-observed**. Not average questions viewed.
- `directChildYansiCount` ≠ popularity. Children are slug-level; experience counts are version-scoped. Do not silently attribute children to a journey version.
- `ownContinuationStarted` is DEFINED BUT UNAVAILABLE (first NEW live question after `/sohbet`, not CTA / page load).
- `lineageDepth` / descendant count: FUTURE. No recursion in this phase.

## Funnel availability

STARTED → AVAILABLE. Own continuation / first live question / 8 live questions / Review → UNAVAILABLE. Child published → AVAILABLE.

## Confidence

`sampleSize = experienceStartedCount`. Categorical buckets (INSUFFICIENT_DATA / EARLY / ESTABLISHED) are **deferred** until product thresholds are agreed. Better no fake confidence than arbitrary confidence.

## What Phase 7 may do later

Normalization, confidence weighting, ranking, exploration/exploitation, freshness, diversity, language/region/topic segmentation, maturity-without-newness-penalty.

Phase 6.3 must not sort Discover, expose Attraction/Engagement/Generativity publicly, or emit a composite score.

Code: `eza-v5/backend/services/mirror_network/yansi_signal_semantics.py`
Read path: `get_yansi_signal_semantics` / `build_yansi_signal_semantics` over Phase 6.1 metrics. No public endpoint.
