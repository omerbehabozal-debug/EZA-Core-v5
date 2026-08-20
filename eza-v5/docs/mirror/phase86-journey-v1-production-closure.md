# Phase 8.6 — Journey V1 production closure

Sohbetten Ayna oluşturduğumda yaptığım iş kaybolmaz.
Sayfayı yenilesem veya yayınlama sırasında hata olsa bile sistem mevcut Ayna'yı bulur ve kaldığım yerden devam eder.
Aynı Ayna yanlışlıkla iki kez Yansı olarak yayınlanmaz.

## Status

Implemented production closure (2026-08-21). Phase 8.1–8.5 remain frozen. Phase 5/6/7 semantics unchanged.

## State machine (authoritative)

```
conversation (auth + Journey V1 flags)
  → window awaiting_decision
  → Review8 confirm (journeyId allocated once)
  → panel artifact status=generating
  → JOURNEY_AYNA_GENERATE_EVENT → runMirrorWithReveal + scoped scene
  → lineage seal → artifact status=ready
  → explicit Yayınla → POST /api/mirror-network/publish
  → frozen journey_v1 node + steps → status=published + /m/{slug}
```

## Feature flags

| Layer | Env | Enable values |
|-------|-----|---------------|
| Backend | `EZA_MIRROR_JOURNEY_V1` | `true` / `1` (strict; unset→off) |
| Frontend | `NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1` | `true` / `1` |

Parity surface: `GET /api/mirror-network/capabilities` → `{ journeyV1Enabled, artifactKind, clientFlag, serverFlag }`.

Production must set **both** flags together. FE-on/BE-off (or reverse) is unsupported.

## Artifact authority

| State | Authority |
|-------|-----------|
| Review draft / window FSM / generating / ready (unpublished) | Client localStorage (cache) |
| Generation lineage binding (prepare→scene) | Server in-memory `JourneyGenerationRecord` (TTL ~1h) + client seal |
| Published / frozen / share URL | **Server** `MirrorNetworkNode` + `mirror_journey_steps` |
| Owner rehydrate | `GET …/me/conversations/{id}/published-journeys` |

Client may cache. Server is final truth for published/frozen. Phase 8.6 hydrate **upgrades** local generating/ready when server already has frozen publish (lost-response recovery).

## Review → Ayna

- Confirm uses sync `confirmInFlightRef` so double-click cannot mint two `journeyId`s.
- `confirmReview8Draft` reuses an existing `journeyId` on the draft.
- After confirm, `requestJourneyAynaGeneration` kicks scene create even when the Ayna reel hides the legacy create CTA.
- Failed slides expose `onRetry` → same reveal/scene path (no new journeyId).

## Creation / publish idempotency

- **Create (Review):** one journeyId per confirm; generating mark will not wipe ready/published.
- **Publish:** backend upsert by `journeyId` / slug; same-version identical content → `identicalRetry`; content change on frozen version rejected; intentional republish = prepare bumps `journeyVersion` then publish.
- **Client publish:** prior local `shareUrl` is **not** treated as success after a failed publish attempt. On failure, client attempts `recoverPublishedJourneyAfterLostResponse` (server list) before showing failure.

## Scene

- Scene binds to prepare `generationId` / lineage; pre-publish retry rebinds.
- Scene failure does not delete the Journey panel artifact; retry re-runs reveal/scene.
- Post-freeze scene change requires new journey version (immutability).

## External AI / API cost (inferred)

Typical Journey path: prepare-director (≤2 attempts) + generate-scene (1) + publish (1).  
Duplicate browser clicks: scene in-flight ref + publish in-flight ref + Review confirm ref reduce accidental doubles. Generation record is process-local — multi-instance publish without the same record fails closed (`unknown`/`expired` generation), which avoids silent wrong-scene publish but may require user retry.

## Guest / auth

Journey V1 windows + Review + Ayna reel require authenticated owner. Guest→auth conversation claim (Phase 8.3) does **not** transfer Journey panel artifacts (documented deferred). Durable publish always requires auth.

## Lineage

Parent continues via `lineageProofToken` / server proof at publish. Client parent slug is display-only when parent is already published.

## Unpublish / safety

Owner rehydrate lists **published** frozen journeys only. Unpublish / safety-remove does not auto-republish on hydrate. Local generating/ready are never written as public by hydrate.

## Share URL

Only after successful publish (or recovered server published state). Canonical path `/m/{slug}` (Phase 8.2).

## Out of scope

- Discover / ranking / Strong Curiosity
- Phase 8.5 profile redesign
- Phase 8.7 mobile / returning-user dashboard
- Durable server-side draft store for generating/ready (still client-local; published is durable)
- Distributed job system for in-flight prepare

## Remaining conditional notes

1. Pre-publish generation record is in-process TTL memory (multi-worker / restart risk).
2. Unpublished draft reopen across devices is not server-backed (same-device localStorage only).
3. After unpublish, stale local `published` cache may linger until cleared; server will not list it and public `/m` respects trust.
