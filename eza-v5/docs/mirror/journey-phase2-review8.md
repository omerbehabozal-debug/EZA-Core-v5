# Mirror Journey — Phase 2 (Review 8 draft)

Status: **implemented (client)**  
Depends on: Phase 1 identity + PASS closure  
RFC: `rfc-journey-identity-review8.md` §4–9

## Scope

| Deliverable | Location |
|-------------|----------|
| Deterministic Q/A pairing (RFC §4.2) | `frontend/lib/eza/mirror/journey/extractQaPairs.ts` |
| Candidate 8 proposer (lexical) | `frontend/lib/eza/mirror/journey/proposeCandidate8.ts` |
| Review 8 draft + journeyId on confirm | `review8Draft.ts` + `review8DraftStore.ts` (localStorage) |
| Review8 UI | `frontend/components/mirror/Review8Screen.tsx` |
| Soft gate before share publish | `StandaloneObservationExperience` when `NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1=true` |
| Publish sends `journeyId` | `publishMirrorToNetwork` when confirmed draft exists |

## Not in Phase 2

- Scoped D2 from draft steps only
- Persist steps to `mirror_journey_steps`
- Replay API / UI
- Backend `/journey/candidates` or `/journey/draft` (client draft sufficient per RFC §13)

## Enable

```
# backend
EZA_MIRROR_JOURNEY_V1=true

# frontend (Review 8 gate + journeyId on publish)
NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1=true
```

Default: both off — legacy share/publish unchanged.

## Flow

```
messages → extractQaPairs → proposeCandidate8
  → Review8Screen → confirm (freeze Q/A + allocate journeyId)
  → localStorage draft
  → publishMirrorToNetwork({ journeyId })  // when both flags on
```
