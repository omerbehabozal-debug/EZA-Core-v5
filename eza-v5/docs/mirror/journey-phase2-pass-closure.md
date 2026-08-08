# Mirror Journey — Phase 2 PASS Closure (window model)

Status: **production closure PASS — see `journey-phase2-production-closure.md`**  
Depends on: Phase 1 identity  
RFC: `rfc-journey-identity-review8.md`  
Product reset: supersedes Candidate 8 / best-8 as Journey V1 authority

## Guarantees (PASS)

1. First 8 eligible Q/A → decision UI (chat continues)
2. Skip → no journey; window never reused or mixed later
3. Create → Review 8 on **exact** chronological 8 → draft + `journeyId`
4. Next eligible pairs start a fresh window counter
5. Second full 8 can produce Journey B with `parentJourneyId = Journey A`
6. Same conversation supports multiple journeys (draft keyed by window/`draftKey`)
7. Q20 completion closes conversation input; no auto-Yansı; no 20→8 compression
8. Q21 blocked once the 20th eligible **user question** is accepted (even if A20 streams)
9. Refresh does not re-prompt skipped/confirmed windows
10. Generation status for window A does not contaminate window B
11. system/tool/noise/incomplete do not advance the eligible counter
12. Feature flags off → legacy behavior unchanged
13. Publish requires confirmed exact 8 + `journeyId` + window identity; no legacy fallback when Journey V1 on
14. Same-owner same-conversation parent chain without lineageProofToken; cross-user still requires proof
15. Multi-tab CAS on `stateVersion` prevents silent overwrite of window decisions

## Explicitly removed from Journey V1 authority

- best-8 scoring / Candidate 8 selection UI
- 20-question clustering into journeys
- topic-drift grouping as publish requirement
- one draft / one Review 8 per conversation

## Phase 3 boundary (do **not** implement yet)

- Scoped D2
- Semantic Anchors / Curiosity Builder / image / Narrative Alignment wiring from window
- Replay progressive reveal
- Vision changes

Confirmed 8 does **not** yet scope D1/D2 inputs.
