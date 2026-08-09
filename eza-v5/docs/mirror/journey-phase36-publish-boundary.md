# Journey Phase 3.6 — Publish Boundary Integrity

**Status:** Implemented (no Phase 4 frozen artifact persistence).

## Invariant

Publish what was generated. Never re-read the live Review 8 draft for an already-generated Mirror card.

## Authoritative lineage

`JourneyGenerationLineage` is stamped at scoped prepare (server hashes/version/window + interpretation/mapped/generationId). The client seals `selectedSteps[8]`, `publicLandingHash`, `anchorsHash`, and `sceneAssetId` onto the card after CB + scene, then persists an immutable artifact snapshot.

## Publish

Frontend sends the sealed lineage. Backend recomputes window/scoped/selected hashes from `selectedSteps`, verifies version publishability, and rejects with `journey_publish_lineage_mismatch` + reason codes. Same-version step replace requires identical `selectedStepsHash`.

## Out of scope

Phase 4 frozen DB artifact, replay, window UX redesign.
