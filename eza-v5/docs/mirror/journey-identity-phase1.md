# Mirror Journey Identity — Phase 1

Status: **implemented (schema + flag + publish identity)**  
RFC: `rfc-journey-identity-review8.md`

## Scope (this phase only)

- DB: `artifact_kind`, `journey_version`, `mirror_journey_steps` table
- Drop unique `(user_id, conversation_id)`
- Flag: `EZA_MIRROR_JOURNEY_V1` (default **false**)
- Publish: optional `journeyId` when flag on → identity = slug; `conversationId` provenance only

**Not in Phase 1:** Review 8 UI, scoped D2, replay, step population.

## Guarantees

```
conversation → N journeys (when flag on + distinct journeyIds)
journey publish/update → idempotent by journeyId
legacy publish (no journeyId) → unchanged conversation upsert to legacy_landing
legacy rows → artifact_kind=legacy_landing (not journey_v1)
```

## Version bump (option A)

Updating an existing `journey_v1` node with the same `journeyId` increments `journey_version`.

## Enable

```
EZA_MIRROR_JOURNEY_V1=true
```

Restart API workers after env change.
