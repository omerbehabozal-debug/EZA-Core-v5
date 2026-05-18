/**
 * EZA Standalone — spatial system (ürün odaklı, chat merkezli)
 */

import type { EzaRiskLevel } from './tokens';
import { ezaRiskColors } from './tokens';

export const STANDALONE_LAYOUT = {
  chatMaxPx: 768,
  sidebarPx: 240,
  assistantMaxPx: 560,
  userMaxPx: 420,
} as const;

export const standaloneSkin = {
  page: 'standalone-canvas flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden safe-area-inset',
  appRow: 'flex min-h-0 w-full flex-1',

  /* Sidebar — okunaklı, ChatGPT-benzeri ölçek */
  sidebar:
    'standalone-sidebar flex h-full w-[240px] max-w-[240px] shrink-0 flex-col border-r border-standalone-border/50',
  sidebarInner:
    'flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3 safe-area-top safe-area-bottom',
  sidebarBrandBlock: 'border-b border-standalone-border/40 px-1 pb-3 pt-0.5',
  sidebarLogo: 'text-lg font-bold tracking-[-0.03em] text-standalone-text',
  sidebarProduct: 'mt-0.5 text-xs font-medium leading-snug text-standalone-text-muted',
  sidebarNav: 'flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden pt-1',
  sidebarNavItem:
    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-standalone-text-secondary transition-colors hover:bg-white/70 hover:text-standalone-text touch-manipulation',
  sidebarSectionLabel:
    'px-2.5 pt-1 text-xs font-semibold uppercase tracking-[0.05em] text-standalone-text-muted/90',
  sidebarArchiveList:
    'flex max-h-[min(12rem,28vh)] min-w-0 flex-col gap-0.5 overflow-x-hidden overflow-y-auto overscroll-contain',
  sidebarArchiveRow:
    'flex min-w-0 items-stretch gap-0.5 overflow-hidden rounded-lg transition-colors hover:bg-white/70',
  sidebarArchiveItem:
    'block min-w-0 flex-1 overflow-hidden px-2.5 py-2 text-left touch-manipulation',
  sidebarArchiveDeleteBtn:
    'flex shrink-0 items-center justify-center self-center rounded-md p-1.5 text-standalone-text-muted/45 transition-all hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60 touch-manipulation',
  sidebarArchiveTitle:
    'block min-w-0 max-w-full truncate text-sm font-medium text-standalone-text',
  sidebarArchiveMeta:
    'mt-0.5 block min-w-0 max-w-full truncate text-xs text-standalone-text-muted',
  sidebarArchiveEmpty: 'px-2.5 py-1 text-sm leading-snug text-standalone-text-muted/80',
  sidebarSaveBtn:
    'flex w-full items-center justify-center gap-1.5 rounded-md border border-standalone-border/60 bg-white/60 px-2 py-1.5 text-[12px] font-medium text-standalone-text-secondary transition-colors hover:border-standalone-primary/30 hover:bg-white hover:text-standalone-text disabled:pointer-events-none disabled:opacity-40 touch-manipulation',
  sidebarNewChatBtn:
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-standalone-text-secondary transition-colors hover:bg-white/70 hover:text-standalone-text touch-manipulation disabled:pointer-events-none disabled:opacity-40',
  sessionDialogBackdrop:
    'fixed inset-0 z-[60] flex items-center justify-center bg-black/25 p-4 backdrop-blur-[2px]',
  sessionDialogPanel:
    'w-full max-w-sm rounded-xl border border-standalone-border/60 bg-[#FDFEFE] p-5 shadow-[0_16px_48px_-12px_rgba(15,23,42,0.18)]',
  sessionDialogTitle: 'text-lg font-semibold tracking-[-0.02em] text-standalone-text',
  sessionDialogBody: 'mt-2 text-base leading-relaxed text-standalone-text-secondary',
  sessionDialogActions: 'mt-5 flex flex-col gap-2',
  sessionDialogPrimary:
    'rounded-lg bg-standalone-primary px-3 py-2.5 text-base font-medium text-white transition-opacity hover:opacity-90 touch-manipulation',
  sessionDialogDanger:
    'rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2.5 text-base font-medium text-red-700 transition-colors hover:bg-red-50 touch-manipulation',
  sessionDialogGhost:
    'rounded-lg px-3 py-2.5 text-base font-medium text-standalone-text-muted transition-colors hover:text-standalone-text-secondary touch-manipulation',
  sidebarFooter: 'mt-auto shrink-0 space-y-2 border-t border-standalone-border/50 pt-3',
  sidebarToggleRow:
    'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-sm text-standalone-text-secondary',
  sidebarHelpDetails: 'px-2.5 pb-0.5',
  sidebarHelpSummary:
    'cursor-pointer list-none text-xs font-medium text-standalone-text-muted/70 hover:text-standalone-text-secondary [&::-webkit-details-marker]:hidden',
  sidebarHelpBody:
    'mt-1.5 text-xs leading-relaxed text-standalone-text-muted/85',

  iconBtn:
    'flex h-9 w-9 items-center justify-center rounded-lg text-standalone-text-muted transition-colors hover:bg-white/80 hover:text-standalone-primary touch-manipulation',

  /* Ana sahne — kaydırma sağ kenarda (tam genişlik), içerik ortada */
  main: 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden standalone-main',
  chatStage:
    'mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col px-4 sm:px-6',
  chatStageFull:
    'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden',
  observationEyebrow:
    'text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-800/70',
  observationTabList:
    'mx-auto flex max-w-3xl gap-1 rounded-full border border-stone-200/60 bg-stone-100/50 p-1',
  observationTab:
    'flex-1 rounded-full px-4 py-2 text-center text-sm font-medium transition-colors',
  observationTabActive: 'bg-white text-stone-900 shadow-sm',
  observationTabIdle: 'text-stone-500 hover:text-stone-700',
  personaChip:
    'mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200/50 bg-violet-50/60 px-3 py-1.5',
  personaChipEmoji: 'text-base leading-none',
  personaChipLabel: 'text-xs font-medium text-violet-900/90',
  relationshipBalanceCard:
    'rounded-2xl border border-stone-200/50 bg-white/80 p-4 shadow-sm',
  relationshipIslandsWrap:
    'rounded-2xl border border-stone-200/50 bg-white/60 p-4 shadow-sm min-h-[12rem]',
  relationshipIslandsGrid:
    'grid grid-cols-2 gap-3 sm:grid-cols-3',
  relationshipIsland:
    'flex flex-col justify-center rounded-2xl border px-3 py-4 transition-transform hover:scale-[1.02]',
  relationshipBarCard:
    'rounded-2xl border border-stone-200/50 bg-white/75 p-5 shadow-sm',
  relationshipBarTrack: 'mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200/50',
  relationshipBarFill: 'h-full rounded-full bg-violet-400/80',
  relationshipBarFillAlt: 'h-full rounded-full bg-teal-400/70',
  relationshipNoteCard:
    'mt-8 rounded-2xl border border-violet-200/40 bg-gradient-to-br from-violet-50/80 to-white p-5',

  mainScroll:
    'standalone-main-scroll min-h-0 min-w-0 flex-1 self-stretch w-full max-w-none overflow-y-auto overflow-x-hidden overscroll-contain',
  chatColumn: 'mx-auto w-full max-w-3xl px-4 pb-2 sm:px-6',
  composerBar: 'w-full shrink-0 bg-transparent',

  list: 'min-h-0 w-full',
  listInner: 'flex flex-col',
  listInnerEmpty: 'flex min-h-0 flex-1 flex-col items-center justify-center py-8',
  listInnerActive: 'flex flex-col gap-0 py-3 sm:py-4',

  composerDock:
    'w-full shrink-0 border-t-0 bg-transparent px-0 pt-0 pb-8 sm:pb-9',
  composerDockEmpty: 'w-full shrink-0 border-t-0 bg-transparent px-0 pb-8 pt-0 sm:pb-9',
  composerStack: 'flex w-full flex-col gap-2 bg-transparent',
  modelBar: 'flex items-baseline justify-center gap-2 px-1 pb-1 text-sm leading-snug',
  modelBarLabel: 'shrink-0 font-normal text-standalone-text-muted/80',
  modelTrigger:
    'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-normal text-standalone-text-secondary transition-colors hover:bg-black/[0.03] hover:text-standalone-text disabled:opacity-50',
  modelMenu:
    'absolute bottom-full left-1/2 z-20 mb-1.5 min-w-[11rem] -translate-x-1/2 overflow-hidden rounded-lg border border-standalone-border/50 bg-white py-1 shadow-[0_4px_16px_-6px_rgba(15,23,42,0.1)]',
  modelMenuItem:
    'flex w-full flex-col items-start gap-0 px-3 py-2 text-left transition-colors hover:bg-[#F4F7FB]',
  modelMenuItemLabel: 'text-sm font-medium text-standalone-text',
  modelMenuItemMeta: 'text-xs text-standalone-text-muted',
  composerCard:
    'flex w-full items-end gap-2.5 rounded-[1.75rem] border border-standalone-border/70 bg-[#FDFEFE] px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]',
  inputRow: 'flex min-w-0 flex-1 items-end gap-2',
  input:
    'hide-scrollbar min-h-[52px] max-h-[200px] w-full flex-1 resize-none border-0 bg-transparent py-2.5 text-base leading-normal text-standalone-text placeholder:text-standalone-text-muted/80 focus:outline-none focus:ring-0 disabled:opacity-50',
  sendBtn:
    'mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#6BA3F5]/30 bg-gradient-to-b from-[#5B9CF5] to-[#4588DC] text-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(255,255,255,0.12)_inset,0_4px_14px_-4px_rgba(37,99,235,0.35)] transition-all hover:from-[#4F94EE] hover:to-[#3D7FD8] hover:shadow-[0_2px_6px_rgba(15,23,42,0.08),0_6px_16px_-4px_rgba(37,99,235,0.4)] active:scale-[0.97] disabled:border-transparent disabled:from-standalone-text-muted/20 disabled:to-standalone-text-muted/25 disabled:text-standalone-text-muted/50 disabled:shadow-none touch-manipulation',
  composerHint: 'mt-2 text-center text-xs text-standalone-text-muted/70',

  /* Konuşma ritmi */
  turnBlock: 'mb-4 last:mb-1',
  turnMeta: 'mt-1 flex flex-col gap-1',
  turnMetaTight: 'mt-1 flex flex-col gap-0.5',

  userTurn: 'ml-auto flex w-fit max-w-[min(100%,25rem)] flex-col items-end',
  assistantTurn: 'mr-auto w-full max-w-full flex flex-col items-start',

  userBubble:
    'w-fit max-w-full rounded-3xl rounded-br-md bg-[#E8F2FF]/90 px-4 py-3 text-standalone-text shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]',
  /** AI yanıtı — baloncuk yok, doğrudan akış */
  assistantBody: 'w-full max-w-full py-0.5',
  typingIndicator: 'flex items-center gap-1 py-1.5',

  messageText:
    'text-base font-normal leading-[1.7] text-standalone-text whitespace-pre-wrap break-words',
  timestamp: 'text-xs tabular-nums text-standalone-text-muted/75',

  insightWrap: 'max-w-full pt-0.5',

  signalPill:
    'inline-flex max-w-full items-center gap-1.5 rounded-full border border-standalone-border/50 bg-stone-50/90 px-2.5 py-0.5 text-[10px] leading-snug text-standalone-text-secondary transition-colors hover:border-standalone-border/70 hover:bg-stone-50 touch-manipulation',
  signalExpand:
    'motion-safe mt-1.5 w-full min-w-[11rem] max-w-[14rem] rounded-lg border border-standalone-border/45 bg-white/75 px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]',

  /* Boş durum — slogan optik merkez, composer altta */
  emptyHero:
    'flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-16 text-center sm:pb-20',
  emptyComposerWrap: 'w-full shrink-0 bg-transparent',
  emptySlogan: 'mx-auto w-full max-w-lg translate-y-3 sm:translate-y-5',
  emptyTitle:
    'text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-standalone-text sm:text-[2rem]',
  emptyBody:
    'mx-auto mt-4 max-w-md text-base leading-relaxed text-standalone-text-secondary sm:text-[1.0625rem] sm:leading-relaxed',
  chatStageWithMessages: 'flex min-h-0 min-w-0 flex-1 flex-col',
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
