/**
 * HighlightText Component
 * Highlights risky parts of text based on backend spans
 */

'use client';

import { cn } from '@/lib/utils';

interface HighlightTextProps {
  text: string;
  spans?: Array<{ start: number; end: number; reason?: string }>;
  riskLevel: 'dusuk' | 'orta' | 'yuksek';
}

export default function HighlightText({ text, spans, riskLevel }: HighlightTextProps) {
  // If no spans provided, color entire paragraph based on risk level
  if (!spans || spans.length === 0) {
    const bgColor = 
      riskLevel === 'yuksek' ? 'bg-[#FF3B3B]/20' :
      riskLevel === 'orta' ? 'bg-[#FFC93C]/20' :
      'bg-transparent';
    
    return (
      <span className={cn('text-white', bgColor)}>
        {text}
      </span>
    );
  }

  // Sort spans by start position
  const sortedSpans = [...spans].sort((a, b) => a.start - b.start);
  
  const parts: JSX.Element[] = [];
  let lastIndex = 0;

  sortedSpans.forEach((span, idx) => {
    const { start, end, reason } = span;
    
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
      <mark
        key={`highlight-${idx}`}
        className="px-1 rounded bg-[#FF3B3B]/30 text-[#FF3B3B]"
        title={reason || 'Riskli ifade'}
      >
        {text.substring(start, Math.min(end, text.length))}
      </mark>
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
}

