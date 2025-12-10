/**
 * Proxy-Lite API Client
 * Final architecture: EZA-Core ethical scoring
 */

import { API_BASE_URL } from "./config";

// ========== TYPES ==========

export interface ParagraphAnalysis {
  original: string;
  score: number; // 0-100, ethical score
  issues: string[]; // Turkish issue labels
  rewrite: string | null; // Rewritten version if available
}

export interface LiteAnalysisResponse {
  ethics_score: number; // 0-100, overall
  ethics_level: "low" | "medium" | "high";
  paragraphs: ParagraphAnalysis[];
  unique_issues: string[]; // Unique issue labels (no duplicates)
  provider: string; // "EZA-Core"
}

export interface RewriteRequest {
  text: string;
  risk_labels?: string[];
  language?: 'tr' | 'en';
  provider?: 'openai' | 'groq' | 'mistral' | null;
}

export interface RewriteResponse {
  original_text: string;
  rewritten_text: string;
  original_ethical_score: number;
  new_ethical_score: number;
  risk_level_before: 'low' | 'medium' | 'high';
  risk_level_after: 'low' | 'medium' | 'high';
  improved: boolean; // True if new_score > original_score
}

// ========== API FUNCTIONS ==========

/**
 * Analyze text using Proxy-Lite
 */
export async function analyzeLite(
  text: string,
  locale: 'tr' | 'en' = 'tr',
  provider?: 'openai' | 'groq' | 'mistral' | null
): Promise<LiteAnalysisResponse | null> {
  try {
    const defaultProvider = process.env.NEXT_PUBLIC_LITE_DEFAULT_PROVIDER || 'openai';
    const url = `${API_BASE_URL}/api/proxy-lite/analyze`;
    
    console.log('[Proxy-Lite] Sending request to:', url);
    console.log('[Proxy-Lite] Request body:', { text: text.trim().substring(0, 50) + '...', locale, provider: provider || defaultProvider });
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          locale,
          provider: provider || defaultProvider,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[Proxy-Lite] Analysis failed:', res.status, res.statusText, errorText);
        return null;
      }

      const data: LiteAnalysisResponse = await res.json();
      console.log('[Proxy-Lite] Analysis success:', data);
      return data;
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        console.error('[Proxy-Lite] Request timeout (60s)');
      } else {
        console.error('[Proxy-Lite] Analysis error:', e);
      }
      return null;
    }
  } catch (e) {
    console.error('[Proxy-Lite] Analysis error:', e);
    return null;
  }
}

/**
 * Rewrite paragraph to be more ethical
 */
export async function rewriteLite(
  text: string,
  risk_labels?: string[],
  language: 'tr' | 'en' = 'tr',
  provider?: 'openai' | 'groq' | 'mistral' | null
): Promise<RewriteResponse | null> {
  try {
    const defaultProvider = process.env.NEXT_PUBLIC_LITE_DEFAULT_PROVIDER || 'openai';
    const url = `${API_BASE_URL}/api/proxy-lite/rewrite`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        risk_labels,
        language,
        provider: provider || defaultProvider,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Proxy-Lite] Rewrite failed:', res.status, errorText);
      return null;
    }

    const data: RewriteResponse = await res.json();
    return data;
  } catch (e) {
    console.error('[Proxy-Lite] Rewrite error:', e);
    return null;
  }
}

// Legacy function for backward compatibility
export async function analyzeText(text: string): Promise<LiteAnalysisResponse | null> {
  return analyzeLite(text);
}
