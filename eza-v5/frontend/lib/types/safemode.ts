/**
 * Safe Mode / behavioral calibration API types (user-facing).
 */

export interface ReliabilityInfo {
  level?: string;
  quality?: number;
  label?: string;
  factors?: Record<string, unknown>;
}

export interface EmaResult {
  ok?: boolean;
  ema?: number | null;
  ema_series?: number[];
  count?: number;
  reason?: string;
  min_required?: number;
}

export interface TrendMetricResult {
  ok?: boolean;
  slope?: number;
  interpretation?: string | null;
  reason?: string;
  min_required?: number;
  count?: number;
}

export interface SafeModeTrend {
  user_id: string;
  sample_count: number;
  can_trend: boolean;
  reliability: ReliabilityInfo;
  confidence: number;
  disclaimer: string;
  can_interpret: boolean;
  metrics: {
    eza_score?: {
      ema?: EmaResult;
      trend?: TrendMetricResult;
    };
    ai_reliance_trend?: {
      label?: string;
      trend?: TrendMetricResult;
    };
    asymmetry_index?: {
      latest?: number | null;
      series_length?: number;
    };
  };
  event_id?: string | null;
  analysis_id?: string | null;
}

export interface SafeModeInsight {
  ok?: boolean;
  generate?: boolean;
  reason?: string;
  min_required?: number;
  sample_count?: number;
  user_id?: string;
  metric?: string;
  display_name?: string;
  z_score?: number;
  direction?: string;
  percent_change?: number;
  insight_text?: string;
  confidence?: number;
  can_interpret?: boolean;
  reliability?: ReliabilityInfo;
  disclaimer?: string;
  event_id?: string | null;
  analysis_id?: string | null;
}

export interface SafeModeReport {
  user_id: string;
  period: string;
  days: number;
  sample_count: number;
  averages: {
    eza_score?: number | null;
    input_risk?: number | null;
    output_risk?: number | null;
    alignment_score?: number | null;
    ai_reliance_signal?: number | null;
  };
  trend_summary: SafeModeTrend;
  reliability?: ReliabilityInfo;
  confidence?: number;
  disclaimer: string;
  can_interpret: boolean;
  event_id?: string | null;
  analysis_id?: string | null;
}

export type SafeModeReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface SafeModeFeedbackPayload {
  event_id?: string;
  analysis_id?: string;
  feedback_type: string;
  metric_name?: string;
  original_label?: string;
  corrected_label?: string;
  original_score?: number;
  corrected_score?: number;
  notes?: string;
}

export interface SafeModeFeedbackResponse {
  ok: boolean;
  feedback_id?: string;
  event_id?: string;
  analysis_id?: string;
}
