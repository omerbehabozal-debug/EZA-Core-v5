# Journey Phase 3.6b — Server Payload Binding Closure

**Status:** Implemented (no Phase 3.7 / Phase 4).

## Invariant

Before Journey V1 DB write, backend proves the **actual** submitted landing, scene URL, steps, and `generationId` resolve to one server-owned `JourneyGenerationRecord`.

## Storage

In-memory TTL store (`journey_generation_record.py`, 1h): written at scoped prepare (interp/mapped/window hashes) and generate-scene (sceneAssetId). Landing hash sealed on first verified publish if absent.

## Checks

1. Recompute `publicLandingHash` from curiosityBundle.publicLanding (frontend-compatible SHA-256)
2. Resolve `sceneAssetId` from sceneImageUrl; require Match lineage + record
3. `mappedPromptHash` / `interpretationHash` authority = generation record
4. Narrative Alignment must match actual scene + landing
5. Step writer requires `selectedStepsHash` for Journey V1
