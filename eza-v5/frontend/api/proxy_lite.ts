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

// New paragraph-based analysis types
export interface ParagraphAnalysis {
  text: string;
  ethical_score: number;
  risk_label: "Düşük Risk" | "Orta Risk" | "Yüksek Risk";
  flags?: string[];
}

export interface ProxyLiteAnalysisResponse {
  ethical_score: number; // 0-100
  risk_label: string; // Turkish: "Düşük Risk", "Orta Risk", "Yüksek Risk"
  paragraphs: ParagraphAnalysis[];
  rewrite_suggestion: string | null;
  flags: string[]; // Turkish risk flags
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
 * Analyze Lite - Text endpoint
 */
export async function analyzeText(text: string): Promise<ProxyLiteAnalysisResponse | null> {
  try {
    const url = `${API_BASE_URL}/api/proxy-lite/text`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("Proxy-Lite: Text analysis failed", e);
    return null;
  }
}

/**
 * Analyze Lite - Image endpoint
 */
export async function analyzeImage(imageFile: File): Promise<{ text: string; analysis: ProxyLiteAnalysisResponse | null }> {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    const url = `${API_BASE_URL}/api/proxy-lite/image`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) return { text: '', analysis: null };
    const data = await res.json();
    return { text: data.text || '', analysis: data.analysis || null };
  } catch (e) {
    console.error("Proxy-Lite: Image analysis failed", e);
    return { text: '', analysis: null };
  }
}

/**
 * Analyze Lite - Audio endpoint
 */
export async function analyzeAudio(audioFile: File): Promise<{ text: string; analysis: ProxyLiteAnalysisResponse | null }> {
  try {
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    const url = `${API_BASE_URL}/api/proxy-lite/audio`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) return { text: '', analysis: null };
    const data = await res.json();
    return { text: data.text || '', analysis: data.analysis || null };
  } catch (e) {
    console.error("Proxy-Lite: Audio analysis failed", e);
    return { text: '', analysis: null };
  }
}


/**
 * Analyze Lite - Real Backend Integration (Legacy - kept for compatibility)
 * Only calls backend, returns null on error (no mock, no fallback)
 */
export async function analyzeLite(text: string): Promise<ProxyLiteRealResult | null> {
  try {
    const url = `${API_BASE_URL}/api/gateway/test-call`;
    console.log('[Proxy-Lite] API URL:', url);
    console.log('[Proxy-Lite] API_BASE_URL:', API_BASE_URL);
    
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text, provider: "openai" }),
    });

    console.log('[Proxy-Lite] Response status:', res.status);
    if (!res.ok) {
      // Clone response to read body without consuming it
      const clonedRes = res.clone();
      try {
        const errorText = await clonedRes.text();
        console.error('[Proxy-Lite] Response not OK:', res.status, res.statusText);
        console.error('[Proxy-Lite] Error details:', errorText);
        // Try to parse as JSON for better formatting
        try {
          const errorJson = JSON.parse(errorText);
          console.error('[Proxy-Lite] Error JSON:', errorJson);
        } catch {
          // Not JSON, that's okay
        }
      } catch (e) {
        console.error('[Proxy-Lite] Could not read error response:', e);
      }
      return null;
    }

    const data = await res.json();
    console.log('[Proxy-Lite] Response data:', data);
    console.log('[Proxy-Lite] Analysis structure:', {
      hasAnalysis: !!data.analysis,
      analysisKeys: data.analysis ? Object.keys(data.analysis) : [],
      ezaScore: data.analysis?.eza_score,
      inputAnalysis: data.analysis?.input,
      outputAnalysis: data.analysis?.output,
    });

    // Only return if we have valid analysis data
    if (!data.analysis) {
      console.warn('[Proxy-Lite] No analysis data in response');
      return null;
    }

    // Extract risk_score from eza_score or input_analysis
    // Backend returns: analysis.eza_score.final_score or analysis.input.risk_score
    const riskScore = data.analysis?.eza_score?.final_score 
      ?? data.analysis?.input?.risk_score 
      ?? data.analysis?.risk_score;
    
    console.log('[Proxy-Lite] Extracted risk_score:', riskScore);
    
    if (riskScore === undefined || riskScore === null) {
      console.warn('[Proxy-Lite] No valid risk score found');
      return null;
    }
    
    // Extract risk_level from input_analysis or eza_score
    const riskLevel = data.analysis?.input?.risk_level 
      ?? data.analysis?.eza_score?.risk_level
      ?? data.analysis?.risk_level;
    
    console.log('[Proxy-Lite] Extracted risk_level:', riskLevel);
    
    if (!riskLevel) {
      console.warn('[Proxy-Lite] No valid risk level found');
      return null;
    }

    const output = data.output;
    if (!output) {
      console.warn('[Proxy-Lite] No output found');
      return null;
    }

    // Extract risk flags from input_analysis
    const flags = data.analysis?.input?.risk_flags 
      ?? data.analysis?.risk_flags 
      ?? [];

    console.log('[Proxy-Lite] Final result:', {
      risk_score: riskScore,
      risk_level: riskLevel,
      output_length: output.length,
      flags_count: flags.length,
    });

    return {
      live: true,
      risk_score: riskScore,
      risk_level: riskLevel,
      output: output,
      flags: flags,
      raw: data,
    };
  } catch (e) {
    console.error("Proxy-Lite: Backend offline. Error:", e);
    return null;
  }
}

