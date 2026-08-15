# Phase 6.4 — Signal completion (internal)

Closes Phase 6.3 gaps without ranking.

EZA Mirror still does not answer “which Yansı ranks first.”

## Audit summary

| Candidate | Class | Why |
|---|---|---|
| `landingViews` / `landing_viewed` | C | Page mount, no version, TTL observation |
| Discover / profile / landing IO | C | Did not exist as measurement |
| Chain IntersectionObserver | C | UX active-section only |
| `continuationStarts` / `guest_conversation_started` | C | Proof/session/page-load stage |
| `CHAT_MESSAGE` quota | B | Right accept locus, no lineage/first-only |
| `yansi_experience_events` | A as pattern, C as table | Experience-only; do not overload STARTED |
| Page Visibility API (MirrorEntries) | C | History refresh |

## Canonical exposure

Meaningful visibility: **≥50% intersection for ≥750ms** while `document` is visible.

Contexts (never mixed as one global denominator): `discover` | `public_profile` | `landing` | `chain`.

Dedupe: one row per `exposureSessionId` (tab `sessionStorage`) + slug + journeyVersion + context.

Unknown version → no exposure (do not fake a versioned rate).

## Attraction rate

**DEFERRED / UNAVAILABLE.** Numerator is experienceSessionId STARTED; denominator would be exposureSessionId visibility units, possibly multi-context. Attribution without fingerprinting is not safe yet. Context counts stay internal.

## Own continuation

**First NEW live user question** after `assert_can_send_message` on `/api/standalone` and `/api/standalone/stream`, when `lineageProofToken` validates.

Origin = `proof.source_mirror_slug`. Never client parent slug.

Not: CTA, `/sohbet` load, session/proof create, frozen replay, opening assistant, Q2+.

Slug-level (proof has no journeyVersion). `origin_journey_version` is advisory node lookup only.

Unique per `continuation_session_id` (`proof.session_id`). Best-effort: chat proceeds if insert fails.

`childPublicationRateCandidate` = children / continuations when both slug-level and continuations > 0.

## Confidence

Numeric evidence sizes only. No INSUFFICIENT/EARLY/ESTABLISHED categories. No quality thresholds. Rates keep numerator + denominator.

## Public / ranking

Unchanged: `N deneyim · N Yansı`. Discover sort unchanged. No public events.
