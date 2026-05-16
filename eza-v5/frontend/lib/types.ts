/**
 * EZA Proxy UI Types
 */

export interface ProxyLiteResult {
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_category: string;
  violated_rule_count: number;
  summary: string;
  recommendation: string;
  score?: number;
}

export interface CaseItem {
  id: string;
  content_id: string;
  risk_score: number;
  eu_ai_class?: string;
  status: 'pending' | 'reviewed' | 'approved' | 'flagged';
  created_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used?: string;
  status: 'active' | 'revoked';
}

export interface ContentItem {
  id: string;
  content: string;
  score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export interface PolicyConfig {
  high_risk_topics: string[];
  illegal_use_cases: string[];
  custom_rules: string[];
}

export interface WorkflowNode {
  id: string;
  type: 'input' | 'risk_check' | 'human_reviewer' | 'archive';
  position: { x: number; y: number };
  config: Record<string, any>;
}

/** Per-turn behavioral snapshot from pipeline (numeric only, no raw messages). */
export interface BehavioralAsymmetry {
  health_gap: number;
  risk_delta_output_minus_input: number;
  index: number;
}

export interface BehavioralVector {
  input_risk: number;
  output_risk: number;
  input_health: number;
  output_health: number;
  alignment_score: number | null;
  eza_final: number | null;
  intent: string;
  alignment_verdict: string | null;
  redirect: boolean;
  redirect_reason: string | null;
  redirect_benign?: boolean;
  policy_violation_count: number;
  deception_score?: number | null;
  legal_risk_score?: number | null;
  psych_pressure_score?: number | null;
}

export interface BehavioralSnapshot {
  schema_version: number;
  interaction_id: string;
  mode: string;
  vector: BehavioralVector;
  asymmetry: BehavioralAsymmetry;
}

/** Universal event logging visibility from pipeline/stream responses. */
export interface PipelineGovernance {
  event_id?: string | null;
  event_logging_enabled?: boolean;
}

export interface StandaloneFeedbackContext {
  eventId?: string | null;
  originalLabel?: string;
  originalScore?: number;
}

export interface CorporateAudit {
  id: string;
  ai_agent: string;
  risk_score: number;
  flags: string[];
  reviewer: string;
  status: 'pending' | 'approved' | 'flagged';
  timestamp: string;
}

