/**
 * Proxy-Lite API Client
 */

import { apiRequest } from "./api_client";

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
 * Analyze Lite - SWR compatible fetcher function
 * Used for hybrid mock + live backend mode
 */
export async function analyzeLite(
  message: string,
  outputText: string
): Promise<ProxyLiteAnalyzeResponse> {
  return analyzeProxyLite(message, outputText);
}

