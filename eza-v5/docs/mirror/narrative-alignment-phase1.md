# Mirror V6 — Narrative Alignment Phase 1 (Production Closure)

Status: **production-ready gate** (not full Vision Verify).

## Runtime flow

```
Publish / share prepare (D2 + scene URL)
        ↓
extract hard claims (Anchors + D2 + Landing)
        ↓
detect image claims (vision API)
        ↓
match → verificationState
        ├── verified_pass  → publish (persist lineage)
        ├── verified_fail  → regenerate scene once (same meaning hashes)
        │                      → re-detect + match
        │                      ├── verified_pass → publish new sceneAssetId
        │                      └── verified_fail → block (no POST)
        └── verification_unavailable
               → short re-detect once
               → still unavailable → block (fail-safe D2)
                  (opt-in allowDegradedPublishWhenUnavailable only)
```

UI (`StandaloneObservationExperience.prepareMirrorShareLink`) passes
`createAlignmentSceneRegenerator` so FAIL → real `generateMirrorScene` retry
with pinned mapped prompt + seed variation.

## Unavailable policy

| State | Meaning | D2 publish default |
|-------|---------|-------------------|
| `verified_pass` | Vision ran; required claims matched | Allow |
| `verified_fail` | Vision ran; required missing | Block (after ≤1 regen) |
| `verification_unavailable` | Vision could not run | **Block** (fail-safe) |

Degraded publish only if `allowDegradedPublishWhenUnavailable: true` (explicit).
Never collapse unavailable into ordinary PASS.

## Persistence

Stored under private payload:

`intelligencePrivate.intelligenceBrief.mirrorLineage.narrativeAlignment`

Fields: `alignmentVersion`, `alignmentStatus`, `verificationState`,
`requiredClaimsHash`, `detectedClaimsHash`, `missingClaims`, `retryAttempt`,
`anchorsHash` — plus sibling lineage `generationId`, `interpretationHash`,
`publicLandingHash`, `sceneAssetId`.

Backend sanitize allowlists the nested object (no conversation text).

## Tests

- `narrativeAlignmentPhase1.test.ts`
- `narrativeAlignmentProductionClosure.test.ts` (E2E publish)

## Limits before full Vision Verify

- Detector is lightweight claim JSON (no composition/aesthetics)
- Alias table is curated, not embedding-based
- Supporting claims are diagnostic-only
- No DB table beyond private_payload lineage blob
