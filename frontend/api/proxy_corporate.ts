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
 * Get auth headers (JWT + API Key)
 */
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token'); // JWT token
  const apiKey = localStorage.getItem('proxy_api_key'); // API Key
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  }
  
  return headers;
}

/**
 * Analyze content with deep analysis
 */
export async function analyzeProxy(
  request: ProxyAnalyzeRequest
): Promise<ProxyAnalyzeResponse | null> {
  try {
    const url = `${API_BASE_URL}/api/proxy/analyze`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Proxy] Analysis failed:', res.status, errorText);
      return null;
    }
    
    const data: ProxyAnalyzeResponse = await res.json();
    return data;
  } catch (e) {
    console.error('[Proxy] Analysis error:', e);
    return null;
  }
}

/**
 * Rewrite content with specified mode
 */
export async function rewriteProxy(
  request: ProxyRewriteRequest
): Promise<ProxyRewriteResponse | null> {
  try {
    const url = `${API_BASE_URL}/api/proxy/rewrite`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
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
export async function getTelemetry(hours: number = 24): Promise<any> {
  try {
    const url = `${API_BASE_URL}/api/proxy/telemetry?hours=${hours}`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
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

