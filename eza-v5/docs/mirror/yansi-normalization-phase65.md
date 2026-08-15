# Phase 6.5 — Normalization & anti-gaming (internal)

Prepares trustworthy **comparison context** for a future Phase 7.
Does **not** rank, score, or reorder.

“Normalized” here means: comparison context is prepared.
It does **not** mean a 0–1 score, Wilson interval, Bayesian average, or rank.

## Public metric vs ranking evidence

| Layer | Role |
|---|---|
| Canonical public | `experienceStartedCount` sessions + `directChildYansiCount`. UI: `N deneyim · N Yansı`. |
| Ranking-eligible | Internal counts that can exclude authenticated **author self-interactions**. |
| Unique authenticated viewer | Distinct `viewer_user_id` values. Different from session counts. |

Public counters stay on current product semantics. This module does not rewrite them.

Future ranking **must not** sort by raw `experienceStartedCount`, `directChildYansiCount`, `ownContinuationStartedCount`, or `exposureCount` without this context.

## Session vs unique user

- **Session signal:** how many replay attempts occurred?
- **Authenticated unique viewer signal:** how many distinct logged-in accounts participated?
- Do not merge them. Future ranking may use both.

## Self-interaction

Authors may experience their own Yansı. That is valid product behavior.

- Public STARTED sessions still include author self-play.
- Ranking-eligible starts/completes/continuations **exclude** rows whose `viewer_user_id` equals the Yansı author.
- Repeat **non-author** authenticated users are **not** auto-deduplicated in ranking-eligible session counts.
- `isAuthorSelfInteraction` is computed query-time. Author/viewer ids are never serialized.

Residual: logged-out author traffic looks like a guest session and cannot be excluded.

## Guest limitation

No IP+UA identity. No device fingerprint.

Guest unique-human evidence is **UNAVAILABLE**. Five guest sessions are five sessions, not five people.

Rate limits may bucket guests by IP as **abuse protection only**, not as identity.

## Age bias

Older Yansılar accumulate more starts/children/continuations. Raw lifetime volume is therefore unfair as a quality proxy.

`publishedAt` + evaluation-time `ageSeconds` / `ageHours` / `ageDays` are context. Age is **not persisted**, not a freshness boost, and not a penalty.

Completion **rate** is not age-normalized (age affects volume, not within-session completion). Replay length (`selectedCount` 6/7/8) is preserved separately.

## Topic / language / region

| Context | Availability |
|---|---|
| Language | `public_payload.seed.locale` if present; else UNAVAILABLE. No AI inference. |
| Topic | `public_payload.seed.topicCategory` if present; else UNAVAILABLE. No new classifier. Completion may differ by topic — Phase 7 must not use naive universal thresholds. |
| Region | UNAVAILABLE. No IP/geo fingerprinting. |

## Historical measurement gaps

Pre-Phase-6 content may have children without exposures, starts, or own-continuations.

`historicalMeasurementGap = true` when children exist and Phase 6 starts = 0 and own-continuations = 0.
Rates stay **null** (never children/0 → infinite).

## Version vs slug

| Signal | Scope |
|---|---|
| Experience / exposure / completion | slug + journeyVersion |
| Direct children / own-continuations / child diversity | slug |

Do not assign slug-level children to a specific version.

`childGenerationRateCandidate` (children / version-starts) is **scope-incompatible**. Numerator/denominator are preserved; it is not ranking-ready.

## Generativity diversity

Internal only:

- `selfAuthoredChildCount` / `externalDirectChildYansiCount`
- `distinctChildAuthorCount` / `distinctExternalChildAuthorCount`

Self-authored children are allowed. Canonical `directChildYansiCount` is unchanged. No public author list. No creator score.

## Time authority

Ranking temporal logic uses server `received_at`.
Client `occurredAt` is informational.
Future windows (24h / 7d / 30d / lifetime) are **ready to aggregate** by `received_at`; they are **not implemented** here. No cron / materialized ranking tables.

## Rate evidence

Every rate candidate keeps `numerator`, `denominator`, `rawRate`, `sampleSize`.
Small-sample quality labels are **deferred** (no invented threshold). Carry the denominator.

Skip remains navigational branching — not a ranking penalty.

Attraction rate remains **unavailable**. Exposure contexts stay separate. Discover exposure ↛ STARTED conversion without attribution proof.

## Forbidden ranking inputs

EZA / Relationship Map / behavioral profile / followers / raw user identity / guest fingerprint / IP geo / public popularity alone / client-only timestamps / composite quality scores / skip-as-negative / global attraction rate.

No weights (no 20/30/50). No rank formula.

## Rate limits (abuse, not fraud ML)

| Surface | Existing | Phase 6.5 hardening |
|---|---|---|
| Experience ingest | 60/min per IP+user+session-prefix | **+ 60/min per actor** (auth user or guest IP) so new session UUIDs cannot bypass |
| Exposure ingest | same 60/min session-prefix helper | **+ 180/min per actor** (Discover scroll headroom) |
| Own continuation | server-side after accepted chat; standalone ~10/min per IP + quota | no extra client limiter |

No CAPTCHA in this phase. Residual: distributed guests, logged-out self-play, slow drip below caps.

Suspicious burst **flags** are deferred (no invented thresholds). Raw evidence is preserved. No public fraud mark. No content suppression.

## Code

`eza-v5/backend/services/mirror_network/yansi_normalization.py`

- `get_yansi_normalized_signal_evidence` / `_batch` — internal, query-time
- Must **not** be imported by Discover sort
- Must **not** appear on public metrics DTOs or UI

Phase 7 ranking status: **NO-GO**.
