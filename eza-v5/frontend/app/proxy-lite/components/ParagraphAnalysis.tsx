/**
 * Paragraph Analysis Component
 * Shows paragraph-by-paragraph analysis with ethical score and suggestions
 */

'use client';

import { useState } from 'react';
import { ParagraphAnalysis as ParagraphAnalysisType, rewriteParagraph } from '@/api/proxy_lite';
import { cn } from '@/lib/utils';
import { getColorFromLevel, getRiskLabelFromLevel } from '../lib/scoringUtils';
import FlagsPills from './FlagsPills';

interface ParagraphAnalysisProps {
  paragraph: ParagraphAnalysisType;
  index: number;
}

export default function ParagraphAnalysis({ paragraph, index }: ParagraphAnalysisProps) {
  const [showRewrite, setShowRewrite] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<{
    text: string;
    score: number;
    improved: boolean;
  } | null>(null);
  
  const color = getColorFromLevel(paragraph.risk_level);
  const label = getRiskLabelFromLevel(paragraph.risk_level);
  const needsRewrite = paragraph.ethic_score < 70;

  // Highlight risky parts based on backend highlights
  const highlightText = (text: string) => {
    if (!paragraph.highlights || paragraph.highlights.length === 0) {
      return <span className="text-white">{text}</span>;
    }

    // Sort highlights by start position
    const sortedHighlights = [...paragraph.highlights].sort((a, b) => a[0] - b[0]);
    
    const parts: JSX.Element[] = [];
    let lastIndex = 0;

    sortedHighlights.forEach(([start, end], idx) => {
      // Add text before highlight
      if (start > lastIndex) {
        parts.push(
          <span key={`text-${idx}`} className="text-white">
            {text.substring(lastIndex, start)}
          </span>
        );
      }

      // Add highlighted text
      parts.push(
        <span
          key={`highlight-${idx}`}
          className="px-1 rounded bg-[#FF3B3B]/30 text-[#FF3B3B]"
        >
          {text.substring(start, Math.min(end, text.length))}
        </span>
      );

      lastIndex = Math.max(lastIndex, end);
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key="text-end" className="text-white">
          {text.substring(lastIndex)}
        </span>
      );
    }

    return <>{parts}</>;
  };

  const handleRewrite = async () => {
    if (isRewriting) return;
    
    setIsRewriting(true);
    try {
      const result = await rewriteParagraph(paragraph.original, 'tr', 80);
      if (result) {
        setRewriteResult({
          text: result.new_text,
          score: result.new_score,
          improved: result.improved,
        });
        setShowRewrite(true);
      }
    } catch (error) {
      console.error('Rewrite failed:', error);
    } finally {
      setIsRewriting(false);
    }
  };

  return (
    <div 
      className="rounded-xl p-6 mb-4"
      style={{ backgroundColor: '#1A1F2E', borderRadius: '12px' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium text-gray-400">Paragraf {paragraph.index}</span>
            <span 
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: `${color}20`,
                color: color,
              }}
            >
              Etik Skor: {paragraph.ethic_score} ({label})
            </span>
          </div>
          
          {paragraph.flags && paragraph.flags.length > 0 && (
            <div className="mb-3">
              <FlagsPills flags={paragraph.flags} />
            </div>
          )}
        </div>
      </div>

      {/* Original Text */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">Orijinal Metin</p>
        <div 
          className="rounded-lg p-4"
          style={{ backgroundColor: '#111726', borderRadius: '12px' }}
        >
          <p className="text-white text-sm leading-relaxed">
            {highlightText(paragraph.original)}
          </p>
        </div>
      </div>

      {/* Rewrite Section */}
      {needsRewrite && (
        <div>
          {!showRewrite ? (
            <button
              type="button"
              onClick={handleRewrite}
              disabled={isRewriting}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: '#0066FF',
                boxShadow: '0 4px 12px rgba(0, 102, 255, 0.3)',
                borderRadius: '12px'
              }}
            >
              {isRewriting ? 'Yeniden yazılıyor...' : 'Daha Etik Hâle Getir →'}
            </button>
          ) : rewriteResult ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold" style={{ color: rewriteResult.improved ? '#39FF88' : '#FFC93C' }}>
                    Daha Etik Hâle Getirilmiş Öneri
                  </p>
                  {rewriteResult.improved && (
                    <p className="text-xs text-gray-400 mt-1">
                      Yeni Etik Skor: {rewriteResult.score} ({getRiskLabelFromLevel(getRiskLevel(rewriteResult.score))})
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowRewrite(false);
                    setRewriteResult(null);
                  }}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
              <div 
                className="rounded-lg p-4 border"
                style={{ 
                  backgroundColor: '#111726',
                  borderColor: rewriteResult.improved ? '#39FF88' : '#FFC93C',
                  borderRadius: '12px'
                }}
              >
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                  {rewriteResult.text}
                </p>
                {!rewriteResult.improved && (
                  <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#FFC93C20' }}>
                    <p className="text-xs text-[#FFC93C]">
                      ⚠️ Bu metin hâlâ tam güvenli değil. Ayrıntılı düzeltme için Proxy moduna geç.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Helper function to get risk level from score
function getRiskLevel(score: number): 'dusuk' | 'orta' | 'yuksek' {
  if (score >= 70) return 'dusuk';
  if (score >= 40) return 'orta';
  return 'yuksek';
}
