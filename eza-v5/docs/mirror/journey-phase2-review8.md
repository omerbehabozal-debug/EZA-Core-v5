# Mirror Journey — Phase 2 (deterministic 8-question windows)

Status: **product model reset — implemented (client)**  
Depends on: Phase 1 identity + PASS closure  
RFC: `rfc-journey-identity-review8.md` (window model supersedes Candidate 8)

## Product invariant

| Limit | Value |
|-------|-------|
| Conversation | max **20** eligible completed Q/A pairs |
| Yansı | exactly **8** chronological eligible Q/A pairs |
| Publishable windows | Q1–Q8, then Q9–Q16 (Q17–Q20 never form a Yansı) |

No best-8 scoring. No topic clustering. No cross-window mixing. No retrospective compression of 20→8.

## Scope

| Deliverable | Location |
|-------------|----------|
| Eligible Q/A pairing | `extractQaPairs.ts` |
| Window state machine | `journeyWindows.ts` + `journeyWindowStore.ts` |
| Decision UI | `JourneyWindowDecisionBanner.tsx` (chat composer area) |
| Review 8 (consent only) | `Review8Screen.tsx` + `buildReview8DraftFromWindow` |
| Draft identity | `userId` + `conversationId` + `windowIndex` / `draftKey` |
| Publish gate | `journeyPublishContract.ts` + backend fail-closed |
| Async status stub | `JourneyGenerationStatus.tsx` (Phase 3 fills pipeline) |

## Not in Phase 2 / not yet

- Scoped D2, Semantic Anchors, Curiosity Builder, image, Narrative Alignment
- Step DB as meaning-pipeline input
- Replay UI

`proposeCandidate8` remains as a **non-authority** utility (tests/legacy only). Journey V1 must not use it.

## Enable

```
EZA_MIRROR_JOURNEY_V1=true
NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1=true
```

Default: both off — legacy chat/publish unchanged.

## Flow

```
eligible Q/A complete
  → every full 8: "8 soruluk bir Yansı hazır."
      [Yansı oluştur ve devam et] → Review 8 (exact window) → journeyId + draft
      [Yansı oluşturmadan devam et] → skip window forever
  → next eligible pairs start the next window
  → at 20 pairs: conversation input closes (no auto-Yansı)
```

Parent chain (owner conversation): first published `parentJourneyId = null`; each later published journey parents to the most recent published journey in that conversation.

## User-facing copy

- `8 soruluk bir Yansı hazır.`
- `Yansı oluştur ve devam et` / `Yansı oluşturmadan devam et`
- `Yansı hazırlanıyor…` / `Yansı hazır`

Do not expose: window, node, lineage, Q1–Q8.
