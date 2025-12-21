/**
 * Expandable Text Block Component
 * Shows collapsed preview with "Devamını Göster" button
 * Expands to full content on click
 */

'use client';

import { useState, useRef, useEffect } from 'react';

interface ExpandableTextBlockProps {
  content: string | null | undefined;
  maxCollapsedLines?: number;
  className?: string;
  showFadeGradient?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
}

export default function ExpandableTextBlock({
  content,
  maxCollapsedLines = 4,
  className = '',
  showFadeGradient = true,
  onExpand,
  onCollapse,
}: ExpandableTextBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // Check if content exceeds collapsed height
  useEffect(() => {
    if (!content || !measureRef.current) {
      setNeedsExpansion(false);
      return;
    }

    // Measure actual content height
    const lineHeight = 24; // Approximate line height in pixels (1.5rem = 24px for text-sm)
    const collapsedHeight = lineHeight * maxCollapsedLines;
    const actualHeight = measureRef.current.scrollHeight;

    setNeedsExpansion(actualHeight > collapsedHeight);
  }, [content, maxCollapsedLines]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded && onExpand) {
      onExpand();
    } else if (isExpanded && onCollapse) {
      onCollapse();
    }
  };

  if (!content) {
    return (
      <p className={`text-sm ${className}`} style={{ color: 'var(--proxy-text-muted)' }}>
        İçerik mevcut değil
      </p>
    );
  }

  const lineHeight = 24;
  const collapsedHeight = lineHeight * maxCollapsedLines;

  return (
    <div className="relative">
      {/* Hidden measurement div */}
      <div
        ref={measureRef}
        className="absolute invisible -z-10 w-full"
        style={{
          visibility: 'hidden',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <div className={`text-sm leading-relaxed whitespace-pre-wrap ${className}`}>
          {content}
        </div>
      </div>

      {/* Content Container */}
      <div
        ref={contentRef}
        className={`text-sm leading-relaxed whitespace-pre-wrap ${className}`}
        style={{
          color: 'var(--proxy-text-secondary)',
          maxHeight: isExpanded ? 'none' : `${collapsedHeight}px`,
          overflow: isExpanded ? 'visible' : 'hidden',
          transition: 'max-height 0.3s ease-out',
        }}
      >
        {content}
      </div>

      {/* Fade Gradient (only when collapsed and needs expansion) */}
      {!isExpanded && needsExpansion && showFadeGradient && (
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: '40px',
            background: 'linear-gradient(to bottom, transparent, var(--proxy-surface))',
          }}
        />
      )}

      {/* Expand/Collapse Button */}
      {needsExpansion && (
        <button
          onClick={handleToggle}
          className="mt-2 text-xs font-medium transition-all hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded px-2 py-1"
          style={{
            color: 'var(--proxy-action-primary)',
            backgroundColor: 'transparent',
          }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Metni daralt' : 'Devamını göster'}
        >
          {isExpanded ? 'Daralt' : 'Devamını Göster'}
        </button>
      )}
    </div>
  );
}

