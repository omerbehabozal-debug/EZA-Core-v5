/**
 * Paragraph Analysis Component
 * Shows paragraph-by-paragraph analysis with ethical score and suggestions
 */

'use client';

import { useState } from 'react';
import { ParagraphAnalysis as ParagraphAnalysisType } from '@/api/proxy_lite';
import { cn } from '@/lib/utils';
import { getScoreColor } from '../lib/scoringUtils';
import FlagsPills from './FlagsPills';

interface ParagraphAnalysisProps {
  paragraph: ParagraphAnalysisType;
  index: number;
}

export default function ParagraphAnalysis({ paragraph, index }: ParagraphAnalysisProps) {
  const [showSuggestion, setShowSuggestion] = useState(false);
  const color = getScoreColor(paragraph.ethical_score);
  const hasSuggestion = paragraph.suggestion !== null;

  // Simple highlight: find risk words (this is a placeholder - real implementation would use backend data)
  const highlightText = (text: string) => {
    // In real implementation, backend would provide risk word positions
    const isRisky = paragraph.ethical_score < 100;
    return text.split(' ').map((word, i) => (
      <span
        key={i}
        className={cn(
          isRisky && 'px-1 rounded',
          isRisky && paragraph.ethical_score < 70 && 'bg-[#FF3B3B]/20 text-[#FF3B3B]',
          isRisky && paragraph.ethical_score >= 70 && paragraph.ethical_score < 100 && 'bg-[#FFC93C]/20 text-[#FFC93C]'
        )}
      >
        {word}{' '}
      </span>
    ));
  };

  return (
    <div 
      className="rounded-xl p-6 mb-4"
      style={{ backgroundColor: '#1A1F2E', borderRadius: '12px' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium text-gray-400">Paragraf {index + 1}</span>
            <span 
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: `${color}20`,
                color: color,
              }}
            >
              Etik Skor: {Math.round(paragraph.ethical_score)}
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

      {/* Suggestion Section */}
      {hasSuggestion && (
        <div>
          {!showSuggestion ? (
            <button
              type="button"
              onClick={() => setShowSuggestion(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg"
              style={{ 
                backgroundColor: '#0066FF',
                boxShadow: '0 4px 12px rgba(0, 102, 255, 0.3)',
                borderRadius: '12px'
              }}
            >
              Daha Etik Hâle Getirilmiş Öneri →
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[#39FF88]">Daha Etik Hâle Getirilmiş Öneri</p>
                <button
                  type="button"
                  onClick={() => setShowSuggestion(false)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
              <div 
                className="rounded-lg p-4 border"
                style={{ 
                  backgroundColor: '#111726',
                  borderColor: '#39FF88',
                  borderRadius: '12px'
                }}
              >
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                  {paragraph.suggestion}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
