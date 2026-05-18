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

  /** EZA'nın Son Gözlemi — soft premium polish (Aşama 3) */
  observationPolish: {
    section: 'relative px-4 pb-10 pt-6 sm:px-0 sm:pb-14 sm:pt-8',
    ambient:
      'pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_70%_80%_at_50%_-20%,rgba(167,139,250,0.12),transparent_65%)]',
    headerTitle:
      'text-[1.35rem] font-semibold tracking-[-0.03em] text-stone-900 sm:text-[1.5rem]',
    headerSub: 'mt-2 max-w-md text-sm leading-relaxed text-stone-500',
    mainCard:
      'relative mt-8 overflow-hidden rounded-[1.35rem] border border-white/80 bg-white/70 p-5 shadow-[0_8px_40px_-12px_rgba(99,102,241,0.12)] backdrop-blur-sm sm:p-6',
    mainCardInner: 'flex flex-col gap-6 md:flex-row md:items-start md:gap-8',
    personaAside: 'flex shrink-0 flex-row items-center gap-3 md:w-[28%] md:flex-col md:items-center md:pt-1',
    personaOrb:
      'flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-100/80 bg-gradient-to-br from-violet-50/90 to-sky-50/80 text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:h-16 sm:w-16 sm:text-[1.75rem]',
    personaFamily: 'text-[11px] font-medium text-violet-800/70 md:text-center',
    insightCol: 'min-w-0 flex-1',
    mainInsight:
      'border-0 p-0 text-[1.2rem] font-medium leading-[1.4] tracking-[-0.02em] text-stone-900 sm:text-[1.45rem] sm:leading-[1.35]',
    mainInsightSecondary:
      'border-0 p-0 text-lg font-medium leading-snug tracking-[-0.02em] text-stone-700',
    personaChipSmall:
      'mt-4 inline-flex max-w-full items-center gap-1.5 rounded-full border border-stone-200/60 bg-stone-50/80 px-2.5 py-1',
    personaChipSmallEmoji: 'text-sm leading-none opacity-90',
    personaChipSmallLabel: 'text-[11px] font-medium text-stone-600',
    supportLine: 'mt-3 text-sm leading-relaxed text-stone-500',
    priorityBlock:
      'mt-6 rounded-2xl border border-amber-200/60 bg-amber-50/40 px-4 py-4 sm:px-5',
    priorityEyebrow: 'text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800/80',
    priorityHeadline: 'mt-1.5 text-base font-medium leading-snug text-amber-950',
    priorityMeta: 'mt-1 text-xs text-amber-800/75',
    mirrorGrid: 'mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4',
    mirrorCard:
      'rounded-2xl border border-stone-200/50 bg-white/60 px-4 py-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)]',
    mirrorCardLabel:
      'text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400',
    mirrorCardPill:
      'mt-1.5 inline-block rounded-full bg-stone-100/90 px-2 py-0.5 text-[10px] font-medium text-stone-500',
    mirrorCardText: 'mt-3 text-sm leading-relaxed text-stone-700',
    metricsRow: 'mt-8 flex flex-col gap-5 border-t border-stone-200/40 pt-6',
    metricsPills: 'flex flex-wrap gap-2',
    metricPill:
      'rounded-full border border-stone-200/55 bg-stone-50/80 px-3 py-1 text-[11px] font-medium text-stone-600',
    patternCaption: 'text-[10px] font-medium uppercase tracking-[0.1em] text-stone-400',
    patternDots: 'mt-2 flex flex-wrap gap-2',
    patternDot:
      'inline-flex h-7 w-7 items-center justify-center rounded-full border border-stone-200/50 bg-white/80 text-[11px]',
    patternDotLatest: 'ring-1 ring-violet-300/50 ring-offset-1 ring-offset-white',
    contextLine: 'text-xs leading-relaxed text-stone-500',
    whyWrap: 'mt-8 border-t border-stone-200/35 pt-5',
    whyToggle:
      'flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-stone-600 transition-colors hover:text-stone-800',
    whyGrid: 'mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2',
    whyCard:
      'rounded-xl border border-stone-200/45 bg-stone-50/50 px-3.5 py-3',
    whyCardTitle: 'text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400',
    whyCardBody: 'mt-1.5 text-sm leading-relaxed text-stone-600',
    scrollHint:
      'mt-8 inline-flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-stone-700',
  },
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

  /** EZA İlişki Haritası — soft premium (Aşama 4) */
  relationshipMapPolish: {
    section: 'relative px-4 pb-12 pt-6 sm:px-0 sm:pb-16 sm:pt-8',
    ambient:
      'pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_75%_70%_at_50%_-15%,rgba(129,140,248,0.1),transparent_60%)]',
    headerTitle:
      'text-[1.35rem] font-semibold tracking-[-0.03em] text-stone-900 sm:text-[1.5rem]',
    headerSub: 'mt-2 max-w-lg text-sm leading-relaxed text-stone-500',
    periodRow: 'mt-6 flex flex-wrap gap-2',
    periodPill:
      'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-300 motion-reduce:transition-none',
    periodPillActive:
      'border-violet-200/70 bg-white/90 text-violet-900 shadow-[0_2px_12px_-4px_rgba(99,102,241,0.2)]',
    periodPillIdle:
      'border-transparent bg-stone-100/60 text-stone-600 hover:bg-stone-100 hover:text-stone-800',
    contentFade: 'transition-opacity duration-500 motion-reduce:transition-none',
    editorialCard:
      'rounded-2xl border border-violet-100/60 bg-gradient-to-br from-violet-50/50 via-white/80 to-sky-50/40 p-5 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.12)] sm:p-6',
    editorialLabel: 'text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-800/60',
    editorialBody: 'mt-2 text-sm leading-relaxed text-stone-700 sm:text-[15px]',
    islandsSection: 'mt-10',
    islandsHeading: 'text-sm font-medium text-stone-800',
    islandsSub: 'mt-1 text-xs text-stone-500',
    islandsLayout: 'mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10',
    islandsMain: 'min-w-0 flex-1',
    islandsGrid:
      'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2',
    islandBlob:
      'group relative overflow-hidden rounded-[1.75rem] border px-5 py-5 transition-transform duration-300 motion-reduce:transition-none hover:scale-[1.015] motion-reduce:hover:scale-100',
    islandGlow: 'pointer-events-none absolute -inset-4 opacity-40 blur-2xl',
    islandLabel: 'relative text-base font-medium text-stone-900',
    islandDesc: 'relative mt-2 text-sm leading-relaxed text-stone-600',
    islandMeta: 'relative mt-4 flex flex-wrap items-center gap-2',
    islandTrendPill:
      'rounded-full bg-white/50 px-2 py-0.5 text-[10px] font-medium text-stone-500',
    islandPercentMuted: 'text-[10px] tabular-nums text-stone-400',
    emptyIslands:
      'rounded-2xl border border-dashed border-stone-200/60 bg-stone-50/40 px-6 py-12 text-center',
    emptyTitle: 'text-base font-medium text-stone-700',
    emptyBody: 'mt-2 text-sm leading-relaxed text-stone-500',
    sideStack: 'flex w-full flex-col gap-4 lg:w-[min(100%,20rem)] lg:shrink-0',
    aiCard:
      'rounded-2xl border border-stone-200/45 bg-white/65 p-4 backdrop-blur-sm sm:p-5',
    aiTitle: 'text-sm font-medium text-stone-800',
    aiToneRow: 'mt-4 flex flex-col gap-3',
    aiToneItem: 'flex flex-col gap-1.5',
    aiToneLabel: 'text-xs text-stone-600',
    aiToneTrack: 'h-1 overflow-hidden rounded-full bg-stone-200/40',
    aiToneFill: 'h-full rounded-full bg-gradient-to-r from-violet-300/80 to-violet-400/60',
    balanceCard:
      'rounded-2xl border border-stone-200/45 bg-white/65 p-4 backdrop-blur-sm sm:p-5',
    balanceTitle: 'text-sm font-medium text-stone-800',
    balanceSummary: 'mt-3 text-sm leading-relaxed text-stone-600',
    balancePillRow: 'mt-4 flex flex-wrap gap-2',
    balancePill:
      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
    balancePillActive: 'border-teal-200/60 bg-teal-50/80 text-teal-900/90',
    balancePillIdle: 'border-stone-200/50 bg-stone-50/60 text-stone-500',
    rhythmSection: 'mt-10 border-t border-stone-200/35 pt-8',
    rhythmTitle: 'text-sm font-medium text-stone-800',
    rhythmSub: 'mt-1 text-xs text-stone-500',
    rhythmChart: 'mt-5 flex items-end justify-between gap-1 sm:gap-2',
    rhythmDotWrap: 'flex flex-1 flex-col items-center gap-2',
    rhythmDot:
      'w-full max-w-[2rem] rounded-full bg-gradient-to-t from-violet-200/90 to-violet-400/50 transition-all duration-500',
    rhythmLabel: 'text-[10px] text-stone-400',
    footerNote: 'mt-10 text-center text-xs leading-relaxed text-stone-400',
    islandGrowing: 'ring-1 ring-violet-300/40',
    islandFading: 'border-dashed opacity-[0.72]',
    islandGhost: 'opacity-40',
    connectionHint:
      'pointer-events-none absolute inset-0 rounded-[1.75rem] border border-dashed border-violet-200/25',
  },

  motion: {
    personaOrb:
      'flex shrink-0 items-center justify-center rounded-2xl border border-violet-100/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
    personaFloat: 'eza-animate-persona-float',
    fadeIn: 'eza-animate-fade-in',
    fadeIn1: 'eza-animate-fade-in-delay-1',
    fadeIn2: 'eza-animate-fade-in-delay-2',
    fadeIn3: 'eza-animate-fade-in-delay-3',
    fadeIn4: 'eza-animate-fade-in-delay-4',
    islandEnter: 'eza-animate-island-enter',
    contentMorph: 'transition-opacity duration-500 ease-out',
  },

  share: {
    triggerBtn:
      'inline-flex items-center gap-1.5 rounded-full border border-stone-200/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-violet-200/60 hover:text-violet-900',
    backdrop: 'fixed inset-0 z-[70] flex items-end justify-center bg-black/30 p-4 backdrop-blur-[2px] sm:items-center',
    panel:
      'w-full max-w-md rounded-2xl border border-stone-200/60 bg-white p-4 shadow-[0_20px_60px_-12px_rgba(15,23,42,0.2)] sm:p-5',
    header: 'flex items-start justify-between gap-3',
    title: 'text-sm font-semibold text-stone-900',
    closeBtn:
      'rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800',
    previewWrap: 'mt-4 max-h-[min(70vh,28rem)] overflow-y-auto overflow-x-hidden',
    card:
      'rounded-xl border border-stone-200/50 bg-gradient-to-br from-violet-50/40 via-white to-sky-50/30 p-4 text-left sm:p-5',
    cardLogo: 'text-xs font-bold tracking-tight text-violet-900/80',
    cardInsight: 'mt-3 text-sm font-medium leading-relaxed text-stone-900',
    cardRow: 'mt-2 text-xs leading-relaxed text-stone-600',
    cardWatermark: 'mt-4 border-t border-stone-200/40 pt-3 text-[10px] text-stone-400',
    actions: 'mt-4 flex flex-wrap gap-2',
    primaryBtn:
      'rounded-lg bg-violet-900/90 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90',
    secondaryBtn:
      'rounded-lg border border-stone-200/60 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50',
    error: 'mt-2 text-xs text-red-600',
    hint: 'mt-2 text-[11px] leading-relaxed text-stone-400',
  },

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
