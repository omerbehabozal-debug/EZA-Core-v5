/**
 * Paragraph Analysis Component
 * Shows paragraph-by-paragraph analysis with highlight and rewrite
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
  const color = getScoreColor(paragraph.ethical_score);

  // Simple highlight: find risk words (this is a placeholder - real implementation would use backend data)
  const highlightText = (text: string) => {
    // In real implementation, backend would provide risk word positions
    const isRisky = paragraph.risk_label !== 'Düşük Risk';
    return text.split(' ').map((word, i) => (
      <span
        key={i}
        className={cn(
          isRisky && 'px-1 rounded',
          isRisky && paragraph.risk_label === 'Yüksek Risk' && 'bg-[#FF3B3B]/20 text-[#FF3B3B]',
          isRisky && paragraph.risk_label === 'Orta Risk' && 'bg-[#FFC93C]/20 text-[#FFC93C]'
        )}
      >
        {word}{' '}
      </span>
    ));
  };

  return (
    <div 
      className="rounded-xl p-6 mb-4"
      style={{ backgroundColor: '#1A1F2E' }}
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
              {paragraph.risk_label}
            </span>
            <span 
              className="text-sm font-semibold"
              style={{ color: color }}
            >
              Skor: {Math.round(paragraph.ethical_score)}
            </span>
          </div>
          
          {paragraph.flags && paragraph.flags.length > 0 && (
            <div className="mb-3">
              <FlagsPills flags={paragraph.flags} />
            </div>
          )}
        </div>
      </div>

      {/* Original Text with Highlight */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Paragraf Metni</p>
        <div 
          className="rounded-lg p-4"
          style={{ backgroundColor: '#111726', borderRadius: '12px' }}
        >
          <p className="text-white text-sm leading-relaxed">
            {highlightText(paragraph.text)}
          </p>
        </div>
      </div>
    </div>
  );
}

