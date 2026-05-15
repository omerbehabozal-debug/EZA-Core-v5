-- EZA Universal Event Backbone — Stage 1
-- Parallel to behavioral_logs; numeric / structured fields only in production.

CREATE TABLE IF NOT EXISTS eza_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source_mode VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    calibration_scope VARCHAR(64) NOT NULL,
    regulation_scope VARCHAR(64) NOT NULL DEFAULT 'none',

    user_id VARCHAR(255),
    org_id VARCHAR(255),
    session_id VARCHAR(255),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    score_vector JSONB,
    engine_votes JSONB,
    decision_trace JSONB,
    metadata JSONB,

    risk_label VARCHAR(64),
    risk_score FLOAT CHECK (risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)),
    confidence_score FLOAT CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)),
    reliability_score FLOAT CHECK (reliability_score IS NULL OR (reliability_score >= 0 AND reliability_score <= 100)),
    can_interpret BOOLEAN DEFAULT FALSE,

    case_snapshot JSONB DEFAULT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_eza_events_source_time
    ON eza_events(source_mode, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_eza_events_entity_time
    ON eza_events(entity_type, entity_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_eza_events_user_time
    ON eza_events(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_eza_events_org_time
    ON eza_events(org_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_eza_events_type_time
    ON eza_events(event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_eza_events_regulation_time
    ON eza_events(regulation_scope, timestamp DESC);
