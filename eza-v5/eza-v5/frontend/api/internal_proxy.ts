/**
 * Internal Proxy API Client
 * Full debug pipeline for EZA internal team
 */

import { apiRequest } from "./api_client";

export interface FullPipelineDebugResponse {
  request_id: string;
  timestamp: string;
  input: {
    raw_text: string;
    normalized_text: string;
    language: string | null;
    tokens: number | null;
  };
  models: {
    router_decision: Record<string, any>;
    used_models: string[];
    model_outputs: Record<string, string>;
  };
  analysis: {
    input_analysis: Record<string, any>;
    output_analysis: Record<string, any>;
    alignment_result: Record<string, any>;
    eza_score: Record<string, any>;
    deception?: Record<string, any> | null;
    psychological_pressure?: Record<string, any> | null;
    legal_risk?: Record<string, any> | null;
    context_graph?: Record<string, any> | null;
  };
  timings: {
    total_ms: number;
    model_calls: Record<string, number>;
    analysis_ms: Record<string, number>;
  };
  flags: {
    risk_level: string;
    safety_level: string;
    route: string;
  };
  raw: {
    input_analysis_raw?: Record<string, any> | null;
    output_analysis_raw?: Record<string, any> | null;
    alignment_raw?: Record<string, any> | null;
    eza_score_raw?: Record<string, any> | null;
    all_logs?: Array<Record<string, any>> | null;
  };
}

export interface HistoryItem {
  id: string;
  created_at: string;
  input_text: string;
  risk_level: string;
  eza_score: number;
  summary: string;
}

export interface ProxyInternalRequest {
  text: string;
  mode?: string;
  provider?: string;
  model?: string;
  policy_pack?: string;
}

/**
 * Run full debug pipeline
 */
export async function runInternalProxy(
  request: ProxyInternalRequest
): Promise<FullPipelineDebugResponse> {
  return apiRequest<FullPipelineDebugResponse>(
    "/api/proxy/internal/run",
    "POST",
    {
      text: request.text,
      mode: request.mode || "proxy_internal",
      provider: request.provider || "openai",
      model: request.model,
      policy_pack: request.policy_pack || "eu_ai",
    }
  );
}

/**
 * Get history list
 */
export async function getInternalProxyHistory(
  limit: number = 20
): Promise<HistoryItem[]> {
  return apiRequest<HistoryItem[]>(
    `/api/proxy/internal/history?limit=${limit}`,
    "GET"
  );
}

/**
 * Get specific session
 */
export async function getInternalProxySession(
  sessionId: string
): Promise<FullPipelineDebugResponse> {
  return apiRequest<FullPipelineDebugResponse>(
    `/api/proxy/internal/session/${sessionId}`,
    "GET"
  );
}

