# Journey Phase 3.5 — Frozen Artifact Readiness

Status: prerequisites for Phase 4 frozen persistence (no replay yet).

## Closed in this phase

1. **Server-authoritative hashes** — `journey_window_hashes.py` + `validate_journey_semantic_scope` recompute `windowHash`, `scopedInputHash`, `selectedStepsHash`, per-step `questionHash`/`answerHash`. Client hashes optional; mismatch → `journey_semantic_scope_invalid` + reason.
2. **Journey version provenance** — `resolve_authoritative_journey_version`: new → 1, existing published → current+1. Flows into prepare scope, cache key, response `journeyVersion`.
3. **Selected-step privacy** — `sanitize_selected_journey_steps` reuses `sensitive_content` detectors; surgical email/phone/token redaction; private markers / material meaning loss → `journey_step_privacy_blocked` at publish.
4. **reuseMappedPrompt safety** — `canReuseMappedPromptForJourney` requires matching journeyId/version/windowHash/scopedInputHash (+ mapper/interpretation when present). Legacy pins without lineage denied.

## FrozenJourneySource

`build_frozen_journey_source(...)` produces the Phase 4 canonical package shape (hashes + sanitization + lineage hash slots). Persistence/replay is Phase 4.

## Out of scope

- Replay UI / progressive reveal
- Persisting FrozenJourneySource as a DB artifact blob (Phase 4)
- New Vision features
