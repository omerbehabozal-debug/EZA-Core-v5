-- EZA Safe Mode Faz 1 — Behavioral Calibration Layer
-- Apply via migration or init; numeric-only storage (no message text).

CREATE TABLE IF NOT EXISTS behavioral_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    org_id VARCHAR(255),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    eza_score FLOAT CHECK (eza_score BETWEEN 0 AND 100),
    input_risk FLOAT CHECK (input_risk BETWEEN 0 AND 100),
    output_risk FLOAT CHECK (output_risk BETWEEN 0 AND 100),
    alignment_score FLOAT CHECK (alignment_score BETWEEN 0 AND 100),
    asymmetry_index FLOAT CHECK (asymmetry_index BETWEEN -1 AND 1),
    reliance_signal FLOAT CHECK (reliance_signal BETWEEN 0 AND 100),

    confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 100),
    data_quality FLOAT CHECK (data_quality BETWEEN 0 AND 100),

    mode VARCHAR(50),
    schema_version INTEGER DEFAULT 1,

    case_snapshot JSONB DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_behavioral_user_time
ON behavioral_logs(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_behavioral_org_time
ON behavioral_logs(org_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_behavioral_session
ON behavioral_logs(session_id);

CREATE TABLE IF NOT EXISTS behavioral_baselines (
    user_id VARCHAR(255) PRIMARY KEY,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    sample_count INTEGER DEFAULT 0,

    eza_mean FLOAT,
    eza_std FLOAT,
    eza_slope_7d FLOAT,
    eza_slope_30d FLOAT,

    asymmetry_mean FLOAT,
    asymmetry_std FLOAT,

    reliance_mean FLOAT,
    reliance_std FLOAT,

    baseline_quality FLOAT CHECK (baseline_quality BETWEEN 0 AND 1),
    is_stable BOOLEAN DEFAULT FALSE,
    last_calibrated TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS behavioral_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    org_id VARCHAR(255),
    timestamp TIMESTAMPTZ DEFAULT NOW(),

    analysis_id UUID,
    event_id UUID,

    feedback_type VARCHAR(50) NOT NULL CHECK (
        feedback_type IN (
            'CORRECT',
            'FALSE_POSITIVE',
            'FALSE_NEGATIVE',
            'TOO_STRICT',
            'TOO_SOFT',
            'WRONG_CATEGORY',
            'CONTEXT_MISSING',
            'USER_REPORT'
        )
    ),

    metric_name VARCHAR(100),
    original_label VARCHAR(100),
    corrected_label VARCHAR(100),
    original_score FLOAT,
    corrected_score FLOAT,
    notes TEXT,

    reviewed_by VARCHAR(255),
    is_reviewed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_feedback_user
ON behavioral_feedback(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_analysis
ON behavioral_feedback(analysis_id);

CREATE INDEX IF NOT EXISTS idx_feedback_event
ON behavioral_feedback(event_id);
