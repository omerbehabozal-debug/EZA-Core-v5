# Standalone Observation Layer

Rule-based, optional observation output for **Standalone** mode only.

## Principles

- No LLM calls
- Never raises; pipeline safety and scoring unchanged
- Feature flag: `STANDALONE_OBSERVATION_ENABLED` (default `false`)
- When enabled, responses may include `standalone_observation`
- Event metadata must use `safe_event_metadata()` — never raw message text

## Integration

- `pipeline_runner.py` — non-streaming standalone responses
- `api/streaming.py` — standalone stream completion payload

Frontend aggregation remains the fallback when this field is absent.
