# Mirror Journey Identity — Phase 1

Status: **PASS closure applied** (legacy partial unique + versioned steps + strict flag)  
RFC: `rfc-journey-identity-review8.md`

## Scope (this phase only)

- DB: `artifact_kind`, `journey_version`, `mirror_journey_steps` (version-aware)
- Drop global unique `(user_id, conversation_id)`
- **Restore** legacy concurrency via partial unique:
  `unique(user_id, conversation_id) WHERE artifact_kind = 'legacy_landing' AND conversation_id IS NOT NULL`
- Flag: `EZA_MIRROR_JOURNEY_V1` (default **false**, strict parse)
- Publish: optional `journeyId` when flag on → identity = slug; `conversationId` provenance only

**Not in Phase 1:** Review 8 UI, scoped D2, replay, step population, frontend `journeyId` emit.

## Guarantees

```
conversation → N journeys (when flag on + distinct journeyIds)
journey publish/update → idempotent by journeyId
legacy publish (no journeyId) → conversation upsert to legacy_landing
legacy parallel publish → DB-level single-node (partial unique + IntegrityError recovery)
legacy rows → artifact_kind=legacy_landing (not journey_v1)
steps foundation → unique(journey_slug, journey_version, step_index)
malformed EZA_MIRROR_JOURNEY_V1 → configuration error (never implicit true)
```

## Version bump (option A)

Updating an existing `journey_v1` node with the same `journeyId` increments `journey_version`.
Frozen steps (later phases) must key off the same version dimension.

## Enable

```
EZA_MIRROR_JOURNEY_V1=true   # or 1
EZA_MIRROR_JOURNEY_V1=false  # or 0 / unset
# any other value → startup/config ValidationError
```

Restart API workers after env change.

## Migrations

1. `add_mirror_journey_identity_v1`
2. `add_mirror_journey_identity_pass_closure`
