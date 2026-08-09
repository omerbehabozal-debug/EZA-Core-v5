# Journey Phase 3.7 — Persistence decision

## Decision

**No new durable DB columns in Phase 3.7.**

Source-block provenance (`blockIndex`, `blockStart`, `blockEnd`, `sourceBlockHash`,
`selectedCount`, `selectedStepsHash`, `sourceOrder`) lives in:

1. Server `JourneyGenerationRecord` (TTL in-memory, Phase 3.6b) at prepare/scene time
2. Client `JourneyGenerationLineage` + `journeyGenerationArtifactStore` (multi-artifact)
3. Existing `mirror_journey_steps` rows for **selected** 6–8 steps only (`stepIndex` 1..N)

Deselected Q/A are **not** copied to public tables. They remain only in the private
source conversation.

## Why

- `mirror_journey_steps` already supports 6–8 rows when `stepIndex` is contiguous 1..N
- Public Discover must not receive unselected content
- Durable Phase 4 frozen replay store is explicitly out of scope

## Migration

None required for Phase 3.7 go-live. If durable queryability of `sourceBlockHash`
is needed later, add nullable columns on the private journey lineage payload /
node metadata — not public step bodies.
