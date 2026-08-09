# Journey Phase 3.7.5 — Multi-artifact panel persistence

## What survives refresh (localStorage)

| Store | Key | Scope | Survives refresh |
|-------|-----|-------|------------------|
| Panel artifacts | `eza_mirror_journey_panel_artifacts_v1` | user + journeyId + version | Yes |
| Generation lineage | `eza_mirror_journey_generation_artifacts_v1` | user + journeyId + version | Yes |
| Journey share links | `eza_mirror_journey_share_link_v1` | user + journeyId + version | Yes |
| Conversation share (legacy) | `eza_mirror_share_link_v2` | user + conversationId | Yes (latest only) |
| Window FSM | `eza_mirror_journey_windows_v1` | user + conversation | Yes |

## What does not

| State | Class |
|-------|--------|
| Server `JourneyGenerationRecord` | TTL in-memory (Phase 3.6b) — not panel authority |
| Live `generatedDailyCard` | Session UI — not authority for older artifacts |
| Phase 4 durable frozen replay | Not implemented |

## Selector for Phase 3.8

`listJourneyArtifactsForConversation(userId, conversationId)`
