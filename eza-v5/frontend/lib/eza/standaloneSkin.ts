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
    'mx-auto flex w-full max-w-xl gap-1 rounded-full border border-indigo-200/25 bg-white/55 p-1.5 shadow-[0_4px_28px_-8px_rgba(99,102,241,0.14)] backdrop-blur-md',
  observationTab:
    'flex-1 rounded-full px-4 py-2.5 text-center text-sm font-medium transition-all duration-300 motion-reduce:transition-none',
  observationTabActive:
    'bg-white text-violet-900 shadow-[0_0_24px_-6px_rgba(139,92,246,0.4)] ring-1 ring-violet-200/60',
  observationTabIdle: 'text-stone-500 hover:bg-white/40 hover:text-stone-700',

  /** Aşama 6 — /standalone/reports premium canvas */
  reportsPremium: {
    canvas:
      'min-h-full w-full bg-[radial-gradient(ellipse_120%_80%_at_10%_-5%,rgba(199,210,254,0.35),transparent_50%),radial-gradient(ellipse_90%_60%_at_95%_10%,rgba(186,230,253,0.28),transparent_45%),linear-gradient(180deg,#f8f9ff_0%,#f4f7fb_55%,#f2f6fa_100%)]',
    container: 'mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-8 sm:py-10 lg:px-12',
    splitGrid: 'hidden xl:grid xl:grid-cols-12 xl:items-start xl:gap-8 2xl:gap-10',
    splitColObservation: 'xl:col-span-7 min-w-0',
    splitColMap: 'xl:col-span-5 min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto xl:overscroll-contain',
    mobileOnly: 'xl:hidden',
    glassCard:
      'rounded-3xl border border-indigo-500/10 bg-white/75 shadow-[0_8px_40px_-12px_rgba(99,102,241,0.1)] backdrop-blur-md',
  },
  personaChip:
    'mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200/50 bg-violet-50/60 px-3 py-1.5',
  personaChipEmoji: 'text-base leading-none',
  personaChipLabel: 'text-xs font-medium text-violet-900/90',

  /** EZA'nın Son Gözlemi — Aşama 6 premium editorial */
  observationPolish: {
    section: 'relative pb-12 pt-4 sm:pb-16 sm:pt-6',
    ambient:
      'pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(167,139,250,0.14),transparent_70%)]',
    headerRow: 'flex flex-wrap items-start justify-between gap-4',
    headerTitle:
      'text-[1.5rem] font-semibold tracking-[-0.035em] text-stone-900 sm:text-[1.75rem]',
    headerSub: 'mt-2 max-w-lg text-sm leading-relaxed text-stone-500 sm:text-[15px]',
    priorityBand:
      'mb-4 rounded-2xl border border-amber-200/40 bg-gradient-to-r from-amber-50/70 to-orange-50/40 px-4 py-3 backdrop-blur-sm sm:px-5',
    priorityEyebrow: 'text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800/70',
    priorityHeadline: 'text-sm font-medium leading-snug text-amber-950 sm:text-[15px]',
    priorityMeta: 'mt-1 text-xs leading-relaxed text-amber-800/65',
    mainCard:
      'relative overflow-hidden rounded-3xl border border-indigo-500/10 bg-white/75 p-5 shadow-[0_12px_48px_-16px_rgba(99,102,241,0.14)] backdrop-blur-md sm:p-7 lg:p-8',
    mainCardInner:
      'flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-10',
    personaAside:
      'flex shrink-0 flex-col items-center gap-3 lg:w-[min(220px,32%)]',
    personaGlow:
      'relative flex h-[9.5rem] w-[9.5rem] items-center justify-center sm:h-[11rem] sm:w-[11rem] md:h-[12.5rem] md:w-[12.5rem]',
    personaGlowRing:
      'pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.22)_0%,rgba(199,210,254,0.08)_45%,transparent_70%)]',
    personaChip:
      'inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200/50 bg-violet-50/80 px-3 py-1.5 shadow-sm',
    personaChipEmoji: 'text-base leading-none',
    personaChipLabel: 'text-xs font-medium text-violet-900/90',
    personaFamily: 'text-center text-[11px] font-medium text-violet-800/65',
    insightCol: 'min-w-0 flex-1 text-center lg:text-left',
    insightEyebrow:
      'text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700/70',
    mainInsight:
      'mt-2 border-0 p-0 text-[1.35rem] font-semibold leading-[1.35] tracking-[-0.03em] text-stone-900 sm:text-[1.65rem] lg:text-[1.85rem]',
    mainInsightSecondary:
      'mt-2 border-0 p-0 text-lg font-medium leading-snug tracking-[-0.02em] text-stone-700 sm:text-xl',
    supportLine: 'mt-4 text-sm leading-relaxed text-stone-500 sm:text-[15px]',
    mirrorGrid: 'mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3',
    mirrorCard:
      'flex h-full min-h-[11rem] flex-col rounded-3xl border border-indigo-500/10 bg-white/75 p-5 shadow-[0_6px_32px_-10px_rgba(99,102,241,0.1)] backdrop-blur-md',
    mirrorIconWrap:
      'flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-100/90 to-indigo-50/80 text-violet-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
    mirrorIconWrapAi:
      'flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-100/90 to-cyan-50/80 text-sky-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
    mirrorIconWrapBalance:
      'flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-100/90 to-emerald-50/80 text-teal-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
    mirrorCardLabel:
      'mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400',
    mirrorPillRow: 'mt-3 flex flex-wrap gap-1.5',
    mirrorCardPill:
      'rounded-full border border-stone-200/50 bg-stone-50/90 px-2.5 py-0.5 text-[10px] font-medium text-stone-600',
    mirrorCardText: 'mt-3 flex-1 text-sm leading-relaxed text-stone-700',
    mirrorFooter: 'mt-4 flex items-center gap-1.5 border-t border-stone-200/35 pt-3 text-[11px] text-stone-500',
    mirrorFooterDot: 'h-1.5 w-1.5 rounded-full bg-emerald-400/80',
    metricsGrid: 'mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3',
    metricCard:
      'rounded-2xl border border-indigo-500/10 bg-white/70 px-4 py-4 shadow-[0_4px_20px_-8px_rgba(99,102,241,0.08)] backdrop-blur-sm',
    metricCardIcon: 'text-violet-500/80',
    metricCardLabel: 'text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400',
    metricCardValue: 'mt-1.5 text-sm font-medium text-stone-800',
    metricProgressTrack: 'mt-3 h-1 overflow-hidden rounded-full bg-stone-200/40',
    metricProgressFill: 'h-full rounded-full bg-gradient-to-r from-violet-300/90 to-violet-500/70',
    patternDots: 'mt-3 flex flex-wrap gap-1.5',
    patternDot:
      'inline-flex h-6 w-6 items-center justify-center rounded-full border border-violet-200/40 bg-violet-50/60 text-[10px]',
    patternDotLatest: 'ring-1 ring-violet-400/50 ring-offset-1 ring-offset-white',
    contextLine: 'mt-6 text-center text-xs leading-relaxed text-stone-500 lg:text-left',
    lowerGrid: 'mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_min(17rem,28%)] lg:items-start',
    whyWrap: 'min-w-0',
    whyToggle:
      'flex w-full items-center justify-between gap-2 rounded-2xl border border-indigo-500/10 bg-white/60 px-4 py-3.5 text-left text-sm font-medium text-stone-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/80',
    whyGrid: 'mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2',
    whyCard:
      'rounded-2xl border border-indigo-500/10 bg-white/70 p-4 shadow-[0_4px_20px_-8px_rgba(99,102,241,0.08)] backdrop-blur-sm',
    whyIconWrap:
      'flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100/80 to-indigo-50/60 text-violet-700',
    whyCardTitle: 'mt-3 text-sm font-medium text-stone-800',
    whyCardBody: 'mt-1.5 text-sm leading-relaxed text-stone-600',
    inspirationCard:
      'relative overflow-hidden rounded-3xl border border-violet-200/30 bg-gradient-to-br from-violet-100/80 via-indigo-50/60 to-sky-100/50 p-5 shadow-[0_8px_32px_-10px_rgba(139,92,246,0.2)] backdrop-blur-sm lg:min-h-[12rem]',
    inspirationQuote: 'text-sm font-medium leading-relaxed text-violet-950/85',
    inspirationDecor:
      'pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/30 blur-2xl',
    scrollHint:
      'mt-10 inline-flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-violet-800',
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

  /** EZA İlişki Haritası — Aşama 6 premium map */
  relationshipMapPolish: {
    section: 'relative pb-14 pt-4 sm:pb-16 sm:pt-6',
    ambient:
      'pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_85%_65%_at_50%_-5%,rgba(129,140,248,0.12),transparent_68%)]',
    headerRow: 'flex flex-wrap items-start justify-between gap-4',
    headerTitle:
      'text-[1.5rem] font-semibold tracking-[-0.035em] text-stone-900 sm:text-[1.75rem]',
    headerSub: 'mt-2 max-w-xl text-sm leading-relaxed text-stone-500 sm:text-[15px]',
    topBar: 'mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between',
    periodRow: 'flex flex-wrap gap-2',
    periodPill:
      'rounded-full border px-4 py-2 text-xs font-medium transition-all duration-300 motion-reduce:transition-none',
    periodPillActive:
      'border-violet-200/70 bg-white/90 text-violet-900 shadow-[0_0_20px_-6px_rgba(139,92,246,0.35)] ring-1 ring-violet-200/50',
    periodPillIdle:
      'border-transparent bg-white/50 text-stone-600 hover:bg-white/80 hover:text-stone-800',
    balanceMiniCard:
      'rounded-2xl border border-teal-200/30 bg-gradient-to-br from-teal-50/70 to-white/80 px-4 py-3 shadow-[0_4px_20px_-8px_rgba(20,184,166,0.15)] backdrop-blur-sm sm:min-w-[14rem]',
    balanceMiniLabel: 'text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-800/60',
    balanceMiniValue: 'mt-1 text-sm font-medium text-stone-800',
    contentFade: 'transition-opacity duration-500 motion-reduce:transition-none',
    editorialCard:
      'mt-6 rounded-3xl border border-violet-200/25 bg-gradient-to-br from-violet-50/60 via-white/75 to-sky-50/50 p-5 shadow-[0_8px_32px_-10px_rgba(99,102,241,0.12)] backdrop-blur-md sm:p-6',
    editorialLabel: 'text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-800/60',
    editorialBody: 'mt-2 text-sm leading-relaxed text-stone-700 sm:text-[15px]',
    islandsSection: 'mt-8',
    islandsHeading: 'text-base font-medium text-stone-800',
    islandsSub: 'mt-1 text-sm text-stone-500',
    islandsCanvas:
      'relative mt-5 min-h-[22rem] overflow-hidden rounded-3xl border border-indigo-500/10 bg-gradient-to-br from-violet-50/30 via-white/40 to-sky-50/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-sm sm:min-h-[26rem] sm:p-4',
    islandsCluster:
      'relative mx-auto min-h-[20rem] w-full max-w-full sm:min-h-[24rem]',
    islandsClusterGlow:
      'pointer-events-none absolute left-1/2 top-1/2 h-[85%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.2),rgba(129,140,248,0.06)_45%,transparent_72%)] blur-2xl',
    islandBlobCluster:
      'absolute overflow-hidden rounded-[2rem] border px-4 py-4 transition-transform duration-300 motion-reduce:transition-none hover:scale-[1.02] motion-reduce:hover:scale-100 sm:px-5 sm:py-5',
    islandsGrid:
      'relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 lg:gap-5',
    islandBlob:
      'group relative min-h-[7.5rem] overflow-hidden rounded-[1.85rem] border px-5 py-5 transition-transform duration-300 motion-reduce:transition-none hover:scale-[1.012] motion-reduce:hover:scale-100 sm:min-h-[8.5rem]',
    islandGlow: 'pointer-events-none absolute -inset-6 opacity-50 blur-3xl',
    islandLabel: 'relative text-[15px] font-medium text-stone-900',
    islandDesc: 'relative mt-2 text-sm leading-relaxed text-stone-600/95',
    islandMeta: 'relative mt-4 flex flex-wrap items-center gap-2',
    islandTrendPill:
      'rounded-full bg-white/60 px-2.5 py-0.5 text-[10px] font-medium text-stone-500 backdrop-blur-sm',
    islandPercentMuted: 'text-[10px] tabular-nums text-stone-400/90',
    emptyIslands:
      'flex min-h-[16rem] flex-col items-center justify-center rounded-3xl border border-dashed border-stone-200/50 bg-white/40 px-6 py-12 text-center',
    emptyTitle: 'text-base font-medium text-stone-700',
    emptyBody: 'mt-2 max-w-sm text-sm leading-relaxed text-stone-500',
    chartsGrid: 'mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3',
    chartCard:
      'rounded-3xl border border-indigo-500/10 bg-white/75 p-5 shadow-[0_6px_32px_-10px_rgba(99,102,241,0.1)] backdrop-blur-md',
    aiTitle: 'text-sm font-medium text-stone-800',
    aiToneRow: 'mt-4 flex flex-col gap-3.5',
    aiToneItem: 'flex flex-col gap-1.5',
    aiToneLabel: 'text-xs text-stone-600',
    aiToneTrack: 'h-1.5 overflow-hidden rounded-full bg-stone-200/35',
    aiToneFill: 'h-full rounded-full bg-gradient-to-r from-violet-300/85 to-indigo-400/65',
    balanceTitle: 'text-sm font-medium text-stone-800',
    balanceSummary: 'mt-3 text-sm leading-relaxed text-stone-600',
    balancePillRow: 'mt-4 flex flex-wrap gap-2',
    balancePill:
      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
    balancePillActive: 'border-teal-200/60 bg-teal-50/85 text-teal-900/90',
    balancePillIdle: 'border-stone-200/50 bg-stone-50/70 text-stone-500',
    rhythmTitle: 'text-sm font-medium text-stone-800',
    rhythmSub: 'mt-1 text-xs text-stone-500',
    rhythmChart: 'mt-5 flex items-end justify-between gap-1 sm:gap-2',
    rhythmDotWrap: 'flex flex-1 flex-col items-center gap-2',
    rhythmDot:
      'w-full max-w-[2.25rem] rounded-full bg-gradient-to-t from-violet-200/90 to-violet-500/55 transition-all duration-500',
    rhythmLabel: 'text-[10px] text-stone-400',
    footerNote: 'mt-10 text-center text-xs leading-relaxed text-stone-400',
    islandGrowing: 'ring-1 ring-violet-300/45 shadow-[0_8px_36px_-8px_rgba(139,92,246,0.2)]',
    islandFading: 'border-dashed border-stone-300/40 opacity-[0.78]',
    islandGhost: 'opacity-45',
    connectionHint:
      'pointer-events-none absolute inset-0 rounded-[1.85rem] border border-dashed border-violet-200/20',
    mapConnectors:
      'pointer-events-none absolute inset-0 opacity-[0.35]',
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
      'inline-flex items-center gap-2 rounded-full border border-indigo-500/15 bg-white/85 px-4 py-2 text-xs font-medium text-stone-600 shadow-[0_4px_16px_-6px_rgba(99,102,241,0.12)] backdrop-blur-sm transition-all hover:border-violet-200/50 hover:text-violet-900 hover:shadow-[0_6px_20px_-6px_rgba(139,92,246,0.2)]',
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
