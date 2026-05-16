/**
 * EZA Standalone — spatial system (ürün odaklı, chat merkezli)
 */

import type { EzaRiskLevel } from './tokens';
import { ezaRiskColors } from './tokens';

export const STANDALONE_LAYOUT = {
  chatMaxPx: 780,
  sidebarPx: 188,
  assistantMaxPx: 560,
  userMaxPx: 400,
} as const;

export const standaloneSkin = {
  page: 'standalone-canvas flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden safe-area-inset',
  appRow: 'flex min-h-0 w-full flex-1',

  /* Sidebar — ince, ikincil */
  sidebar:
    'standalone-sidebar flex h-full w-[188px] max-w-[188px] shrink-0 flex-col border-r border-standalone-border/50',
  sidebarInner:
    'flex h-full min-h-0 flex-col gap-3 p-2.5 safe-area-top safe-area-bottom overflow-y-auto',
  sidebarBrandBlock: 'border-b border-standalone-border/40 px-0.5 pb-3 pt-0.5',
  sidebarLogo: 'text-[15px] font-bold tracking-[-0.03em] text-standalone-text',
  sidebarProduct: 'mt-0.5 text-[10px] font-medium leading-snug text-standalone-text-muted',
  sidebarNav: 'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden pt-1',
  sidebarNavItem:
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-standalone-text-secondary transition-colors hover:bg-white/70 hover:text-standalone-text touch-manipulation',
  sidebarSectionLabel:
    'px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-standalone-text-muted/90',
  sidebarArchiveList:
    'flex max-h-[min(12rem,28vh)] flex-col gap-0.5 overflow-y-auto overscroll-contain',
  sidebarArchiveItem:
    'block rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/70 touch-manipulation',
  sidebarArchiveTitle: 'truncate text-[12px] font-medium text-standalone-text',
  sidebarArchiveMeta: 'mt-0.5 truncate text-[10px] text-standalone-text-muted',
  sidebarArchiveEmpty: 'px-2 py-1 text-[11px] leading-snug text-standalone-text-muted/80',
  sidebarSaveBtn:
    'flex w-full items-center justify-center gap-1.5 rounded-md border border-standalone-border/60 bg-white/60 px-2 py-1.5 text-[12px] font-medium text-standalone-text-secondary transition-colors hover:border-standalone-primary/30 hover:bg-white hover:text-standalone-text disabled:pointer-events-none disabled:opacity-40 touch-manipulation',
  sidebarFooter: 'mt-auto shrink-0 space-y-2 border-t border-standalone-border/50 pt-3',
  sidebarToggleRow:
    'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] text-standalone-text-secondary',
  sidebarHelpDetails: 'px-2 pb-0.5',
  sidebarHelpSummary:
    'cursor-pointer list-none text-[10px] font-medium text-standalone-text-muted/70 hover:text-standalone-text-secondary [&::-webkit-details-marker]:hidden',
  sidebarHelpBody:
    'mt-1.5 text-[10px] leading-relaxed text-standalone-text-muted/85',

  iconBtn:
    'flex h-8 w-8 items-center justify-center rounded-lg text-standalone-text-muted transition-colors hover:bg-white/80 hover:text-standalone-primary touch-manipulation',

  /* Ana sahne — sohbet kolonu optik merkez */
  main: 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden standalone-main',
  chatStage:
    'mx-auto flex h-full min-h-0 w-full max-w-[780px] flex-1 flex-col px-3 sm:px-4',

  list: 'min-h-0 flex-1 overflow-y-auto overscroll-contain',
  listInner: 'flex flex-col',
  listInnerEmpty: 'flex min-h-0 flex-1 flex-col items-center justify-center py-8',
  listInnerActive: 'flex flex-col gap-0 py-3 sm:py-4',

  composerDock:
    'shrink-0 border-t border-standalone-border/40 bg-standalone-surface/60 pt-3 pb-8 sm:pb-9',
  composerDockEmpty: 'w-full shrink-0 border-t-0 bg-transparent px-0 pb-8 pt-0 sm:pb-9',
  composerStack: 'flex w-full flex-col gap-1.5',
  modelBar: 'flex items-baseline justify-center gap-1.5 px-0.5 pb-0.5 text-[11px] leading-tight',
  modelBarLabel: 'shrink-0 font-normal text-standalone-text-muted/75',
  modelTrigger:
    'inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-normal text-standalone-text-secondary transition-colors hover:bg-black/[0.03] hover:text-standalone-text disabled:opacity-50',
  modelMenu:
    'absolute bottom-full left-1/2 z-20 mb-1 min-w-[9.5rem] -translate-x-1/2 overflow-hidden rounded-md border border-standalone-border/50 bg-white py-0.5 shadow-[0_4px_16px_-6px_rgba(15,23,42,0.1)]',
  modelMenuItem:
    'flex w-full flex-col items-start gap-0 px-2 py-1.5 text-left transition-colors hover:bg-[#F4F7FB]',
  modelMenuItemLabel: 'text-[11px] font-medium text-standalone-text',
  modelMenuItemMeta: 'text-[9px] text-standalone-text-muted',
  composerCard:
    'flex w-full items-end gap-2 rounded-[1.25rem] border border-standalone-border/70 bg-[#FDFEFE] px-3 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.04)]',
  inputRow: 'flex min-w-0 flex-1 items-end gap-2',
  input:
    'hide-scrollbar min-h-[40px] max-h-[100px] w-full flex-1 resize-none border-0 bg-transparent py-2 text-[15px] leading-normal text-standalone-text placeholder:text-standalone-text-muted/90 focus:outline-none focus:ring-0 disabled:opacity-50',
  sendBtn:
    'mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#6BA3F5]/30 bg-gradient-to-b from-[#5B9CF5] to-[#4588DC] text-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(255,255,255,0.12)_inset,0_4px_14px_-4px_rgba(37,99,235,0.35)] transition-all hover:from-[#4F94EE] hover:to-[#3D7FD8] hover:shadow-[0_2px_6px_rgba(15,23,42,0.08),0_6px_16px_-4px_rgba(37,99,235,0.4)] active:scale-[0.97] disabled:border-transparent disabled:from-standalone-text-muted/20 disabled:to-standalone-text-muted/25 disabled:text-standalone-text-muted/50 disabled:shadow-none touch-manipulation',
  composerHint: 'mt-1.5 text-center text-[10px] text-standalone-text-muted/70',

  /* Konuşma ritmi */
  turnBlock: 'mb-4 last:mb-1',
  turnMeta: 'mt-1 flex flex-col gap-1',
  turnMetaTight: 'mt-1 flex flex-col gap-0.5',

  userTurn: 'ml-auto flex w-fit max-w-[min(100%,25rem)] flex-col items-end',
  assistantTurn: 'mr-auto flex w-full max-w-[min(100%,35rem)] flex-col items-start',

  userBubble:
    'w-fit max-w-full rounded-3xl rounded-br-md bg-[#E8F2FF]/90 px-4 py-2.5 text-standalone-text shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]',
  assistantBubble:
    'w-fit max-w-full rounded-3xl rounded-bl-md border border-[#E8ECF2]/80 bg-[#FDFEFE] px-4 py-3 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)]',
  typingBubble:
    'w-fit rounded-3xl rounded-bl-md border border-[#E8ECF2]/80 bg-[#FDFEFE] px-4 py-3 shadow-[0_1px_4px_rgba(15,23,42,0.05)]',

  messageText: 'text-[15px] font-normal leading-[1.65] text-standalone-text whitespace-pre-wrap break-words',
  timestamp: 'text-[10px] tabular-nums text-standalone-text-muted/75',

  insightWrap: 'max-w-full pt-0.5',

  /* Boş durum — slogan optik merkez, composer altta */
  emptyHero:
    'flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-16 text-center sm:pb-20',
  emptyComposerWrap: 'w-full shrink-0',
  emptySlogan: 'mx-auto w-full max-w-md translate-y-3 sm:translate-y-5',
  emptyTitle:
    'text-lg font-semibold leading-snug tracking-[-0.02em] text-standalone-text sm:text-xl',
  emptyBody:
    'mx-auto mt-3 max-w-sm text-sm leading-relaxed text-standalone-text-secondary sm:text-[15px]',
  chatStageWithMessages: 'flex min-h-0 flex-1 flex-col',
} as const;

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
