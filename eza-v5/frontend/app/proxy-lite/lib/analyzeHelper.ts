/**
 * Helper functions for analysis processing
 */

import { ProxyLiteAnalysisResponse, ParagraphAnalysis } from '@/api/proxy_lite';
import { getTurkishLabel } from './riskLabels';
import { getRiskLabel } from './scoringUtils';

/**
 * Convert text to paragraphs (simple split by double newlines or sentences)
 */
function splitIntoParagraphs(text: string): string[] {
  // Split by double newlines first
  let paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  // If no double newlines, split by sentences
  if (paragraphs.length === 1) {
    paragraphs = text.split(/[.!?]+\s+/).filter(p => p.trim().length > 20);
  }
  
  // If still only one, split by length
  if (paragraphs.length === 1 && text.length > 200) {
    const chunkSize = Math.ceil(text.length / 3);
    paragraphs = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      paragraphs.push(text.substring(i, i + chunkSize));
    }
  }
  
  return paragraphs.filter(p => p.trim().length > 0);
}

/**
 * Calculate risk score for a paragraph based on flags
 */
function calculateParagraphRisk(flags: string[]): { score: number; level: "Düşük" | "Orta" | "Yüksek" } {
  const highRiskFlags = ['violence', 'self-harm', 'illegal', 'harmful'];
  const mediumRiskFlags = ['manipulation', 'hate', 'harassment', 'misinformation'];
  
  const hasHighRisk = flags.some(f => highRiskFlags.includes(f.toLowerCase()));
  const hasMediumRisk = flags.some(f => mediumRiskFlags.includes(f.toLowerCase()));
  
  if (hasHighRisk || flags.length >= 3) {
    return { score: 70 + Math.random() * 20, level: 'Yüksek' };
  }
  if (hasMediumRisk || flags.length >= 2) {
    return { score: 40 + Math.random() * 20, level: 'Orta' };
  }
  return { score: 20 + Math.random() * 20, level: 'Düşük' };
}

/**
 * Generate rewrite for risky paragraphs
 */
async function generateRewrite(original: string, flags: string[]): Promise<string | null> {
  // In real implementation, this would call backend rewrite endpoint
  // For now, return a simple placeholder
  if (flags.length === 0) return null;
  
  // Placeholder rewrite - in production, call /api/proxy-lite/rewrite
  return `[Güvenli versiyon: ${original.substring(0, 100)}...]`;
}

/**
 * Convert legacy result to new paragraph-based format
 * This is a temporary adapter until backend supports paragraph analysis
 */
export async function convertToParagraphAnalysis(
  text: string,
  legacyResult: any
): Promise<ProxyLiteAnalysisResponse> {
  const paragraphs = splitIntoParagraphs(text);
  const overallScore = legacyResult.risk_score || 0;
  const detectedCategories = (legacyResult.flags || []).map(getTurkishLabel);
  
  const paragraphAnalyses: ParagraphAnalysis[] = paragraphs.map((para) => {
    // Use same flags for all paragraphs for now (in real implementation, backend would analyze each)
    const flags = legacyResult.flags || [];
    const { score } = calculateParagraphRisk(flags);
    const turkishFlags = flags.map(getTurkishLabel);
    
    // Generate suggestion if score < 100
    const suggestion = score < 100 ? generateParagraphSuggestion(para, turkishFlags) : null;
    
    return {
      original: para.trim(),
      ethical_score: score,
      flags: turkishFlags,
      suggestion,
    };
  });
  
  // Generate global rewrite if overall score < 100
  const globalSuggestion = overallScore < 100 ? await generateBulkRewrite(text, detectedCategories) : null;
  
  return {
    success: true,
    input_text: text,
    ethical_score: overallScore,
    paragraphs: paragraphAnalyses,
    global_suggestion: globalSuggestion,
  };
}

/**
 * Generate suggestion for a single paragraph
 */
function generateParagraphSuggestion(original: string, flags: string[]): string {
  // Placeholder - in production, backend would generate this
  return `[Daha Etik Hâle Getirilmiş Öneri: ${original.substring(0, 100)}...]`;
}

/**
 * Generate global rewrite for entire text
 */
async function generateBulkRewrite(text: string, flags: string[]): Promise<string | null> {
  // In real implementation, this would call backend rewrite endpoint
  // For now, return a placeholder
  if (flags.length === 0) return null;
  
  // Placeholder - in production, call /api/proxy-lite/rewrite
  return `[Toplu Güvenli Öneri: Bu içerik daha etik bir şekilde yeniden yazılmıştır. Orijinal mesajınızın anlamını koruyarak, tespit edilen etik sorunları (${flags.join(', ')}) dikkate alarak güvenli bir alternatif sunulmuştur.]`;
}

