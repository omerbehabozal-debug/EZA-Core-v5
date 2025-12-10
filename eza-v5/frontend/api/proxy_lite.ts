/**
 * Proxy-Lite API Client
 * New architecture: ethical scoring, paragraph-based analysis
 */

import { API_BASE_URL } from "./config";

// ========== TYPES ==========

export interface ParagraphAnalysis {
  index: number;
  original_text: string;
  ethical_score: number; // 0-100, higher = safer
  risk_level: 'dusuk' | 'orta' | 'yuksek';
  risk_labels: string[]; // Turkish labels
  highlighted_spans: Array<{ start: number; end: number; reason?: string }>;
  suggested_rewrite?: string | null;
}

export interface LiteAnalysisResponse {
  ok: boolean;
  provider: 'openai' | 'groq' | 'mistral';
  overall_ethical_score: number; // 0-100
  overall_risk_level: 'dusuk' | 'orta' | 'yuksek';
  overall_message: string; // Short Turkish summary
  paragraph_analyses: ParagraphAnalysis[];
  raw?: any;
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
  risk_level_before: 'dusuk' | 'orta' | 'yuksek';
  risk_level_after: 'dusuk' | 'orta' | 'yuksek';
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
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        locale,
        provider: provider || defaultProvider,
      }),
    });

    if (!res.ok) {
      console.error('[Proxy-Lite] Analysis failed:', res.status, res.statusText);
      return null;
    }

    const data: LiteAnalysisResponse = await res.json();
    return data;
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
