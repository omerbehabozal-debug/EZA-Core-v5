/**
 * EZA Proxy Corporate API Client
 * Corporate deep analysis and rewrite endpoints
 */

import { API_BASE_URL } from "./config";

// ========== TYPES ==========

export interface ProxyAnalyzeRequest {
  content: string;
  input_type?: 'text' | 'image' | 'audio' | 'video';
  policies?: ('TRT' | 'FINTECH' | 'HEALTH')[];
  provider?: 'openai' | 'groq' | 'mistral';
  domain?: 'finance' | 'health' | 'retail' | 'media' | 'autonomous';
  return_report?: boolean;
}

export interface RiskLocation {
  start: number;
  end: number;
  type: 'ethical' | 'compliance' | 'manipulation' | 'bias' | 'legal';
  severity: 'low' | 'medium' | 'high';
}

export interface ParagraphAnalysis {
  paragraph_index: number;
  text: string;
  ethical_index: number;
  compliance_score: number;
  manipulation_score: number;
  bias_score: number;
  legal_risk_score: number;
  flags: string[];
  risk_locations: RiskLocation[];
}

export interface RiskFlagSeverityResponse {
  flag: string;
  severity: number;
  policy: string;
  evidence?: string;
}

export interface DecisionJustificationResponse {
  violation: string;
  policy: string;
  evidence: string;
  severity: number;
}

export interface ProxyAnalyzeResponse {
  ok: boolean;
  overall_scores: {
    ethical_index: number;
    compliance_score: number;
    manipulation_score: number;
    bias_score: number;
    legal_risk_score: number;
  };
  paragraphs: ParagraphAnalysis[];
  flags: string[];
  risk_locations: RiskLocation[];
  report?: string;
  provider: string;
  analysis_id?: string;
  risk_flags_severity?: RiskFlagSeverityResponse[];
  justification?: DecisionJustificationResponse[];
}

export interface ProxyRewriteRequest {
  content: string;
  mode: 'strict_compliance' | 'neutral_rewrite' | 'policy_bound' | 'autonomous_safety' | 'corporate_voice';
  policies?: ('TRT' | 'FINTECH' | 'HEALTH')[];
  domain?: 'finance' | 'health' | 'retail' | 'media' | 'autonomous';
  provider?: 'openai' | 'groq' | 'mistral';
  auto_reanalyze?: boolean;
}

export interface ProxyRewriteResponse {
  ok: boolean;
  original_content: string;
  rewritten_content: string;
  original_scores: {
    ethical_index: number;
    compliance_score: number;
    manipulation_score: number;
    bias_score: number;
    legal_risk_score: number;
  };
  new_scores?: {
    ethical_index: number;
    compliance_score: number;
    manipulation_score: number;
    bias_score: number;
    legal_risk_score: number;
  };
  improvement?: {
    ethical_index: number;
    compliance_score: number;
    manipulation_score: number;
    bias_score: number;
    legal_risk_score: number;
  };
  provider: string;
}

// ========== API FUNCTIONS ==========

/**
 * Get auth headers (JWT + Organization ID only)
 * Frontend NEVER handles API keys - backend resolves them internally
 */
function getAuthHeaders(orgId?: string | null): HeadersInit {
  // Get token from production storage (eza_token)
  const token = localStorage.getItem('eza_token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // JWT token is mandatory
  if (!token) {
    throw new Error('Not authenticated. Please login first.');
  }
  
  headers['Authorization'] = `Bearer ${token}`;
  
  // Organization ID is mandatory for Proxy operations
  if (!orgId) {
    throw new Error('Organization context required. Please select an organization.');
  }
  
  headers['x-org-id'] = orgId;
  
  // NEVER send API key from frontend - backend resolves it internally
  return headers;
}

/**
 * Analyze content with deep analysis
 */
export async function analyzeProxy(
  request: ProxyAnalyzeRequest,
  orgId?: string | null
): Promise<ProxyAnalyzeResponse | null> {
  try {
    if (!API_BASE_URL || API_BASE_URL.trim() === '') {
      throw new Error('NEXT_PUBLIC_EZA_API_URL environment variable is not configured. Please set it in Vercel project settings.');
    }
    
    const url = `${API_BASE_URL}/api/proxy/analyze`;
    
    console.log('[Proxy] API_BASE_URL:', API_BASE_URL);
    console.log('[Proxy] Full URL:', url);
    console.log('[Proxy] Request:', { content: request.content.substring(0, 50) + '...', policies: request.policies, domain: request.domain, orgId });
    
    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(orgId),
      body: JSON.stringify(request),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText.substring(0, 200);
      }
      console.error('[Proxy] Analysis failed:', res.status, errorMessage);
      throw new Error(errorMessage);
    }
    
    const data: ProxyAnalyzeResponse = await res.json();
    return data;
  } catch (e: any) {
    console.error('[Proxy] Analysis error:', e);
    if (e.message) {
      throw e;
    }
    throw new Error(`Backend bağlantı hatası: ${e.message || 'Bilinmeyen hata'}`);
  }
}

/**
 * Rewrite content with specified mode
 */
export async function rewriteProxy(
  request: ProxyRewriteRequest,
  orgId?: string | null
): Promise<ProxyRewriteResponse | null> {
  try {
    const url = `${API_BASE_URL}/api/proxy/rewrite`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(orgId),
      body: JSON.stringify(request),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Proxy] Rewrite failed:', res.status, errorText);
      return null;
    }
    
    const data: ProxyRewriteResponse = await res.json();
    return data;
  } catch (e) {
    console.error('[Proxy] Rewrite error:', e);
    return null;
  }
}

/**
 * Get telemetry metrics
 */
export async function getTelemetry(hours: number = 24, orgId?: string | null): Promise<any> {
  try {
    const url = `${API_BASE_URL}/api/proxy/telemetry?hours=${hours}`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(orgId),
    });
    
    if (!res.ok) {
      return null;
    }
    
    return await res.json();
  } catch (e) {
    console.error('[Proxy] Telemetry error:', e);
    return null;
  }
}

// ========== INTENT LOG & IMPACT EVENT MANAGEMENT ==========

export interface CreateIntentLogRequest {
  analysis_result: ProxyAnalyzeResponse & {
    input_text?: string;
    content?: string;
  };
  trigger_action: 'save' | 'rewrite' | 'version' | 'approval_request';
  sector?: string | null;
  policies?: string[] | null;
}

export interface IntentLog {
  id: string;
  organization_id: string;
  user_id: string;
  input_content_hash: string;
  sector: string | null;
  policy_set: any;
  risk_scores: any;
  flags: any;
  trigger_action: string;
  immutable: boolean;
  created_at: string;
  impact_events: Array<{
    id: string;
    impact_type: string;
    occurred_at: string;
    source_system: string;
  }>;
}

export interface ImpactEvent {
  id: string;
  intent_log_id: string | null;
  impact_type: string;
  risk_scores_locked: any;
  content_hash_locked: string;
  occurred_at: string;
  source_system: string;
  immutable: boolean;
}

export interface HistoryResponse {
  intent_logs: IntentLog[];
  impact_events: ImpactEvent[];
  total_intents: number;
  total_impacts: number;
  page: number;
  page_size: number;
}

/**
 * Create an Intent Log (publication readiness intent)
 */
export async function createIntentLog(
  request: CreateIntentLogRequest,
  orgId?: string | null
): Promise<IntentLog | null> {
  try {
    if (!API_BASE_URL || API_BASE_URL.trim() === '') {
      throw new Error('NEXT_PUBLIC_EZA_API_URL environment variable is not configured.');
    }
    
    const url = `${API_BASE_URL}/api/proxy/analysis/intent`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(orgId),
      body: JSON.stringify(request),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText.substring(0, 200);
      }
      throw new Error(errorMessage);
    }
    
    const data: IntentLog = await res.json();
    return data;
  } catch (e: any) {
    console.error('[Proxy] Create Intent Log error:', e);
    throw e;
  }
}

/**
 * Get history (Intent Logs and Impact Events)
 */
export async function getAnalysisHistory(
  orgId?: string | null,
  page: number = 1,
  pageSize: number = 20
): Promise<HistoryResponse | null> {
  try {
    if (!API_BASE_URL || API_BASE_URL.trim() === '') {
      throw new Error('NEXT_PUBLIC_EZA_API_URL environment variable is not configured.');
    }
    
    const url = `${API_BASE_URL}/api/proxy/analysis/history?page=${page}&page_size=${pageSize}`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(orgId),
    });
    
    if (!res.ok) {
      return null;
    }
    
    return await res.json();
  } catch (e) {
    console.error('[Proxy] Get analysis history error:', e);
    return null;
  }
}

// Legacy function name for backward compatibility
export async function saveAnalysis(
  request: CreateIntentLogRequest,
  orgId?: string | null
): Promise<IntentLog | null> {
  return createIntentLog(request, orgId);
}

