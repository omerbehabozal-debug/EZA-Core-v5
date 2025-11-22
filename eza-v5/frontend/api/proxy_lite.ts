/**
 * Proxy-Lite API Client
 */

import { apiRequest } from "./api_client";
import { API_BASE_URL } from "./config";

export interface ProxyLiteAnalyzeRequest {
  message: string;
  output_text: string;
}

export interface ProxyLiteAnalyzeResponse {
  risk_level: string;
  risk_category: string;
  violated_rule_count: number;
  summary: string;
  recommendation: string;
}

export interface ProxyLiteRealResult {
  live: boolean;
  risk_score: number;
  risk_level: string;
  output: string;
  flags: string[];
  raw?: any;
}

export function analyzeProxyLite(
  message: string,
  outputText: string
): Promise<ProxyLiteAnalyzeResponse> {
  return apiRequest<ProxyLiteAnalyzeResponse>(
    "/api/proxy-lite/report",
    "POST",
    {
      message,
      output_text: outputText,
    }
  );
}

/**
 * Analyze Lite - Real Backend Integration
 * Only calls backend, returns null on error (no mock, no fallback)
 */
export async function analyzeLite(text: string): Promise<ProxyLiteRealResult | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/gateway/test-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, provider: "openai" }),
    });

    if (!res.ok) return null;

    const data = await res.json();

    // Only return if we have valid analysis data
    if (!data.analysis && !data.gateway) {
      return null;
    }

    // Extract risk_score from analysis
    const riskScore = data.analysis?.eza_score?.final_score ?? data.analysis?.risk_score;
    if (riskScore === undefined || riskScore === null) {
      return null; // No valid risk score from backend
    }
    
    const riskLevel = data.analysis?.risk_level;
    if (!riskLevel) {
      return null; // No valid risk level from backend
    }

    const output = data.output || data.gateway?.output;
    if (!output) {
      return null; // No valid output from backend
    }

    return {
      live: true,
      risk_score: riskScore,
      risk_level: riskLevel,
      output: output,
      flags: data.analysis?.risk_flags || [],
      raw: data,
    };
  } catch (e) {
    console.info("Proxy-Lite: Backend offline.");
    return null;
  }
}

