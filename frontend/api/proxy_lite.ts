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
  neutrality_score?: number; // 0-100, neutrality score
  writing_quality_score?: number; // 0-100, writing quality score
  platform_fit_score?: number; // 0-100, platform fit score
}

export interface LiteAnalysisResponse {
  ethics_score: number; // 0-100, overall
  ethics_level: "low" | "medium" | "high";
  neutrality_score: number; // 0-100, overall neutrality
  writing_quality_score: number; // 0-100, overall writing quality
  platform_fit_score: number; // 0-100, overall platform fit
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
  provider?: 'openai' | 'groq' | 'mistral' | null,
  context?: 'social_media' | 'corporate_professional' | 'legal_official' | 'educational_informative' | 'personal_blog' | null,
  targetAudience?: 'general_public' | 'clients_consultants' | 'students' | 'children_youth' | 'colleagues' | 'regulators_public' | null,
  tone?: 'neutral' | 'professional' | 'friendly' | 'funny' | 'persuasive' | 'strict_warning' | null
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
          context: context || null,
          target_audience: targetAudience || null,
          tone: tone || null,
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

// ========== MEDIA ENDPOINTS ==========

export interface MediaTextResponse {
  text_from_audio?: string | null;
  text_from_image?: string | null;
  text_from_video?: string | null;
  error?: string | null;
  provider: string;
}

/**
 * Process audio file: Extract text using STT
 */
export async function processAudio(file: File): Promise<MediaTextResponse | null> {
  try {
    const url = `${API_BASE_URL}/api/proxy-lite/audio`;
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Proxy-Lite] Audio processing failed:', res.status, errorText);
      return null;
    }
    
    const data: MediaTextResponse = await res.json();
    return data;
  } catch (e) {
    console.error('[Proxy-Lite] Audio processing error:', e);
    return null;
  }
}

/**
 * Process image file: Extract text using OCR
 */
export async function processImage(file: File): Promise<MediaTextResponse | null> {
  try {
    const url = `${API_BASE_URL}/api/proxy-lite/image`;
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Proxy-Lite] Image processing failed:', res.status, errorText);
      return null;
    }
    
    const data: MediaTextResponse = await res.json();
    return data;
  } catch (e) {
    console.error('[Proxy-Lite] Image processing error:', e);
    return null;
  }
}

/**
 * Process video file: Extract text using STT + OCR
 */
export async function processVideo(file: File): Promise<MediaTextResponse | null> {
  try {
    const url = `${API_BASE_URL}/api/proxy-lite/video`;
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[Proxy-Lite] Video processing failed:', res.status, errorText);
      return null;
    }
    
    const data: MediaTextResponse = await res.json();
    return data;
  } catch (e) {
    console.error('[Proxy-Lite] Video processing error:', e);
    return null;
  }
}

// Legacy function for backward compatibility
export async function analyzeText(text: string): Promise<LiteAnalysisResponse | null> {
  return analyzeLite(text);
}
