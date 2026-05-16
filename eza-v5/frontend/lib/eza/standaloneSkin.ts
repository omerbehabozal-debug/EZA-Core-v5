/**
 * EZA Standalone — light chat skin
 * Shared Tailwind class strings; layout/UX unchanged from original chat design.
 */

import type { EzaRiskLevel } from './tokens';
import { ezaRiskColors } from './tokens';

export const standaloneSkin = {
  page: 'bg-eza-surface-muted',
  list: 'flex-1 overflow-y-auto bg-eza-surface-muted overscroll-contain min-h-0',
  chromeTop:
    'sticky top-0 z-[100] backdrop-blur-xl bg-eza-surface/95 border-b border-eza-border safe-area-top shadow-eza-sm',
  chromeBottom:
    'sticky bottom-0 z-[100] bg-eza-surface/95 backdrop-blur-xl border-t border-eza-border safe-area-bottom shadow-eza-md',
  logoMark:
    'rounded-lg bg-eza-accent flex items-center justify-center shadow-eza-sm text-white text-[10px] sm:text-xs font-semibold leading-none',
  iconBtn:
    'flex items-center justify-center rounded-lg hover:bg-eza-surface-muted active:bg-eza-border/40 transition-colors touch-manipulation',
  title: 'text-sm sm:text-base font-semibold text-eza-text truncate',
  userBubble:
    'bg-eza-accent-muted border border-eza-border rounded-[16px] sm:rounded-[18px] md:rounded-[20px] rounded-tr-[4px] px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 shadow-eza-sm relative inline-block pr-8 sm:pr-10 md:pr-12',
  assistantBubble:
    'bg-eza-surface border border-eza-border rounded-[16px] sm:rounded-[18px] md:rounded-[20px] rounded-tl-[4px] px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 shadow-eza-sm relative inline-block pr-8 sm:pr-10 md:pr-12',
  typingBubble:
    'bg-eza-surface border border-eza-border rounded-[18px] sm:rounded-[20px] rounded-tl-[4px] px-3 py-2.5 sm:px-4 sm:py-3 shadow-eza-sm',
  messageText:
    'text-eza-text text-xs sm:text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap break-words',
  timestamp: 'text-[9px] sm:text-[10px] md:text-xs text-eza-text-muted',
  scorePlaceholder:
    'rounded-full bg-eza-surface-muted border-2 border-eza-border flex items-center justify-center shadow-eza-sm',
  input:
    'w-full px-3 py-2.5 sm:px-4 sm:py-3 pr-10 sm:pr-12 rounded-full bg-eza-surface border border-eza-border focus:outline-none focus:ring-2 focus:ring-eza-accent/20 focus:border-eza-accent resize-none text-sm sm:text-[15px] text-eza-text placeholder:text-eza-text-muted shadow-eza-sm transition-all overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation hide-scrollbar',
  sendBtn:
    'flex-shrink-0 h-[44px] w-[44px] sm:h-[48px] sm:w-[48px] rounded-xl bg-eza-accent hover:bg-eza-accent-hover disabled:bg-eza-border-strong disabled:cursor-not-allowed flex items-center justify-center shadow-eza-md text-white transition-all transform active:scale-95 touch-manipulation',
  welcomeCard:
    'backdrop-blur-xl bg-eza-surface/80 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-eza-lg border border-eza-border',
} as const;

/** Map 0–100 safety score to governance risk palette */
export function scoreToEzaRiskLevel(score: number): EzaRiskLevel {
  if (score >= 81) return 'low';
  if (score >= 51) return 'medium';
  if (score >= 21) return 'high';
  return 'critical';
}

export function scoreBadgeStyles(score: number): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const level = scoreToEzaRiskLevel(score);
  const c = ezaRiskColors[level];
  return {
    backgroundColor: c.bg,
    color: c.text,
    borderColor: c.border,
  };
}
