/**
 * Governance & Universal Events API types (admin console).
 */

export interface PipelineGovernance {
  event_id?: string | null;
  event_logging_enabled?: boolean;
}

export interface EventCounts {
  last_24h: number;
  last_7d: number;
  last_30d: number;
}

export interface GovernanceOverview {
  org_id: string;
  tables_ready: boolean;
  event_counts: EventCounts;
  source_mode_distribution: Record<string, number>;
  risk_label_distribution: Record<string, number>;
  average_confidence: number | null;
  average_reliability: number | null;
  feedback_count: number;
  false_positive_count: number;
  false_negative_count: number;
}

export interface EventSummary {
  id: string;
  source_mode: string;
  entity_type: string;
  entity_id?: string | null;
  event_type: string;
  calibration_scope?: string | null;
  regulation_scope?: string | null;
  user_id?: string | null;
  org_id?: string | null;
  session_id?: string | null;
  timestamp: string | null;
  risk_label?: string | null;
  risk_score?: number | null;
  confidence_score?: number | null;
  reliability_score?: number | null;
  can_interpret?: boolean | null;
  schema_version?: string | null;
}

export interface EventsListResponse {
  org_id: string;
  count: number;
  events: EventSummary[];
}

export interface FeedbackHistoryItem {
  id: string;
  user_id?: string | null;
  org_id?: string | null;
  timestamp: string | null;
  event_id?: string | null;
  analysis_id?: string | null;
  feedback_type: string;
  metric_name?: string | null;
  original_label?: string | null;
  corrected_label?: string | null;
  original_score?: number | null;
  corrected_score?: number | null;
  notes?: string | null;
  is_reviewed?: boolean | null;
}

export interface EventDetail extends EventSummary {
  score_vector?: Record<string, unknown> | null;
  engine_votes?: Record<string, unknown> | null;
  decision_trace?: unknown[] | Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  feedback_history: FeedbackHistoryItem[];
}

export interface EngineReliabilityReport {
  org_id: string;
  tables_ready: boolean;
  engine_average_scores: Record<string, number>;
  disagreement_rate: number;
  low_confidence_event_count: number;
  top_misreported_metrics: Array<{ metric_name?: string; count?: number }>;
  sample_size: number;
}

export interface CalibrationSummary {
  org_id: string;
  tables_ready: { behavioral_feedback: boolean; eza_events: boolean };
  total_feedback: number;
  feedback_type_distribution: Record<string, number>;
  most_corrected_risk_labels: Array<{ risk_label: string; count: number }>;
  too_strict_ratio: number | null;
  too_soft_ratio: number | null;
  weekly_calibration_raw: Array<{
    week_start: string | null;
    feedback_type: string;
    count: number;
  }>;
}

export interface CalibrationSuggestion {
  type: string;
  severity?: string;
  status?: string;
  message: string;
  metric?: string;
  rate?: number;
}

export interface WeeklyCalibrationReport {
  org_id: string;
  period: { weeks: number; start: string; end: string };
  total_events: number;
  total_feedback: number;
  confidence: 'low' | 'medium' | 'high' | string;
  feedback_quality: {
    correct_rate?: number;
    false_positive_rate?: number;
    false_negative_rate?: number;
    too_strict_rate?: number;
    too_soft_rate?: number;
  };
  top_problem_metrics: Array<{ metric_name?: string; count?: number }>;
  top_problem_labels: Array<{ risk_label?: string; count?: number }>;
  engine_reliability_findings: unknown[];
  calibration_suggestions: CalibrationSuggestion[];
  do_not_auto_apply: boolean;
  disclaimer: string;
}

export interface ListEventsParams {
  days?: number;
  limit?: number;
  source_mode?: string;
  entity_type?: string;
  event_type?: string;
  user_id?: string;
}
