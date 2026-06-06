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
  /* Arama kutusu */
  sidebarSearchWrap: 'relative px-0.5',
  sidebarSearchIcon:
    'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-standalone-text-muted/50',
  sidebarSearchInput:
    'w-full rounded-lg border border-standalone-border/60 bg-white/60 py-1.5 pl-7 pr-2 text-[13px] text-standalone-text placeholder:text-standalone-text-muted/60 transition-colors focus:border-standalone-primary/40 focus:bg-white focus:outline-none touch-manipulation',
  /* Tarih grup başlığı */
  sidebarGroupLabel:
    'px-2.5 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-standalone-text-muted/70',
  /* Satır hover aksiyonları (rename / pin) — delete ile aynı görünüm ailesi */
  sidebarArchiveActionBtn:
    'flex shrink-0 items-center justify-center self-center rounded-md p-1.5 text-standalone-text-muted/45 transition-all hover:bg-white hover:text-standalone-text sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-standalone-primary/30 touch-manipulation',
  /* Sabitlenmiş sohbet için kalıcı görünür pin */
  sidebarArchiveActionActive:
    'flex shrink-0 items-center justify-center self-center rounded-md p-1.5 text-standalone-primary/80 transition-all hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-standalone-primary/30 touch-manipulation',
  /* Inline yeniden adlandırma input'u */
  sidebarRenameInput:
    'min-w-0 flex-1 rounded-md border border-standalone-primary/40 bg-white px-2 py-1.5 text-sm text-standalone-text focus:outline-none focus:ring-2 focus:ring-standalone-primary/30',
  /* Boş durum (henüz sohbet yok) */
  sidebarEmptyState:
    'flex flex-col items-center gap-2 rounded-lg px-3 py-5 text-center',
  sidebarEmptyIcon: 'text-standalone-text-muted/40',
  sidebarEmptyTitle: 'text-sm font-medium text-standalone-text-secondary',
  sidebarEmptyBody: 'text-xs leading-snug text-standalone-text-muted/80',
  sidebarEmptyCta:
    'mt-1 rounded-lg bg-standalone-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 touch-manipulation',
  /* Hesap placeholder (gelecek auth) */
  sidebarAccountRow:
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-standalone-text-muted/70 cursor-default',
  sidebarAccountBadge:
    'ml-auto rounded-full bg-standalone-border/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-standalone-text-muted/70',
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
    'mx-auto flex h-[3.25rem] w-full max-w-full items-stretch gap-1 rounded-full border border-violet-200/25 bg-white/[0.58] p-1 shadow-[0_4px_40px_-10px_rgba(139,92,246,0.2)] backdrop-blur-md touch-manipulation sm:h-[3.75rem] sm:max-w-[600px] sm:p-1.5',
  observationTab:
    'flex min-h-[44px] flex-1 items-center justify-center rounded-full px-2.5 text-center text-[13px] font-medium transition-[color,background-color,box-shadow] duration-[260ms] ease-out motion-reduce:transition-none sm:min-h-0 sm:px-5 sm:text-[15px]',
  observationTabActive:
    'bg-white text-violet-900 shadow-[0_0_32px_-8px_rgba(139,92,246,0.55),inset_0_1px_0_rgba(255,255,255,0.92)] ring-1 ring-violet-200/40',
  observationTabIdle:
    'text-stone-500 hover:bg-white/40 hover:text-stone-700 active:scale-[0.99] motion-reduce:active:scale-100',

  /** EZA Mirror — premium daily surface (Sprint 11D) */
  mirrorSurface: {
    tabList:
      'mx-auto flex h-10 w-full max-w-[22rem] items-stretch gap-0.5 rounded-full border border-stone-200/35 bg-white/75 p-0.5 shadow-[0_2px_16px_-6px_rgba(99,102,241,0.06)] backdrop-blur-sm sm:max-w-[26rem]',
    tab: 'flex min-h-[36px] flex-1 items-center justify-center rounded-full px-3 text-center text-[12px] font-medium tracking-tight transition-colors duration-200 ease-out sm:text-[13px]',
    tabActive: 'bg-white text-stone-800 shadow-[0_1px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-stone-200/45',
    tabIdle: 'text-stone-500 hover:text-stone-700',
    dailyStage:
      'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-5 px-3 py-3 sm:gap-6 sm:px-4 sm:py-5',
    /** Ready poster — optically centered; minimal action row keeps stack within viewport. */
    dailyStageReady:
      'justify-center py-2 sm:py-3',
    dailyReadyStack:
      'flex w-full min-h-0 flex-1 flex-col items-center justify-start gap-3 sm:gap-4',
    dailyReadyStackPoster:
      'flex-1 justify-center gap-2',
    dailyReadyStackLoading:
      'flex-1 justify-center',
    dailyReadyColumn:
      'flex w-full min-h-0 max-w-[min(100%,clamp(22rem,48vw,36rem))] flex-col items-center justify-start gap-4 sm:gap-5',
    /** 9:16 in-app poster — larger focus card; 13rem reserves nav + minimal icon actions. */
    dailyPosterFrame:
      'w-full shrink-0 mx-auto max-h-[calc(100dvh-13rem)] [width:min(100%,clamp(22rem,48vw,36rem),calc((100dvh-13rem)*9/16))]',
    mirrorLoadingRoot:
      'flex min-h-[min(58vh,460px)] w-full max-w-[min(100%,26rem)] flex-col items-center justify-center px-8 py-12 text-center sm:min-h-[min(62vh,500px)]',
    mirrorLoadingRing: [
      'relative mb-6 flex h-16 w-16 items-center justify-center rounded-full',
      'border border-violet-200/30 bg-white/70 shadow-[0_0_48px_rgba(139,92,246,0.16)]',
      'before:absolute before:inset-0 before:rounded-full before:border before:border-amber-200/25',
      'before:animate-ping before:opacity-25 motion-reduce:before:animate-none',
    ].join(' '),
    mirrorLoadingTitle:
      'text-[clamp(1.125rem,3.5vw,1.375rem)] font-semibold tracking-[0.05em] text-stone-800',
    mirrorLoadingSubtitle:
      'mt-3 max-w-[20rem] text-[13px] font-medium leading-relaxed text-stone-500 sm:text-sm',
    mirrorLoadingSteps:
      'mt-8 flex w-full max-w-[18rem] flex-col gap-3 text-left',
    mirrorLoadingStep:
      'flex items-center gap-2.5 text-[12px] font-medium tracking-wide text-stone-400 transition-colors duration-500 sm:text-[13px]',
    mirrorLoadingStepActive: 'text-violet-800/90',
    mirrorLoadingStepDone: 'text-stone-500/80',
    mirrorLoadingStepDot:
      'h-2 w-2 shrink-0 rounded-full bg-stone-300 transition-colors duration-500',
    mirrorActionRow:
      'flex w-full max-w-xs items-center justify-center gap-1.5 pt-1 opacity-55 transition-opacity duration-300 hover:opacity-100 sm:gap-2',
    mirrorIconBtn: [
      'inline-flex h-9 w-9 items-center justify-center rounded-full',
      'border border-stone-200/35 bg-white/55 text-stone-500',
      'transition-colors hover:border-violet-200/45 hover:bg-white/90 hover:text-violet-800',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/50',
      'disabled:cursor-not-allowed disabled:opacity-40',
    ].join(' '),
    idleRoot:
      'flex min-h-[min(48vh,380px)] w-full flex-col items-center justify-center px-6 py-14 text-center sm:min-h-[min(52vh,420px)]',
    shareAction:
      'inline-flex items-center justify-center gap-1.5 rounded-full border border-stone-200/55 bg-white/92 px-4 py-2 text-xs font-medium tracking-tight text-stone-700 shadow-[0_2px_14px_-4px_rgba(99,102,241,0.1)] transition-colors hover:border-violet-200/45 hover:text-violet-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/60',
    sceneWrap: 'flex w-full max-w-sm flex-col items-center',
  },

  /**
   * /standalone/reports — premium design foundation (Aşama 1+).
   * Bileşenler bu token’ları observationPolish / relationshipMapPolish üzerinden tüketir.
   */
  reportsPremium: {
    canvas:
      'min-h-full w-full bg-[radial-gradient(ellipse_120%_80%_at_8%_-8%,rgba(199,210,254,0.38),transparent_52%),radial-gradient(ellipse_75%_55%_at_92%_5%,rgba(186,230,253,0.3),transparent_48%),radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(221,214,254,0.12),transparent_55%),linear-gradient(180deg,#f8f9ff_0%,#f6f8fc_42%,#f4f7fb_100%)]',
    container:
      'mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-10 sm:py-12 lg:px-14 lg:py-14',
    sectionStack: 'relative space-y-8 sm:space-y-10 lg:space-y-12',
    panelStage: 'w-full min-w-0 space-y-10 sm:space-y-12',
    ambientLayer:
      'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
    ambientOrbA:
      'absolute -left-24 top-20 h-72 w-72 rounded-full bg-violet-300/18 blur-3xl',
    ambientOrbB:
      'absolute -right-20 top-[28%] h-80 w-80 rounded-full bg-indigo-200/16 blur-3xl',
    ambientOrbC:
      'absolute bottom-8 left-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-200/12 blur-3xl',
    pageHeader:
      'flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between',
    pageTitleRow: 'flex items-center gap-2.5',
    pageTitleIcon: 'h-7 w-7 text-violet-500 sm:h-8 sm:w-8',
    disclaimerBar:
      'mt-10 flex items-start gap-3 rounded-2xl border border-violet-200/25 bg-violet-50/50 px-5 py-4 text-sm leading-relaxed text-violet-950/75 backdrop-blur-sm sm:items-center sm:px-6',
    disclaimerIcon: 'mt-0.5 h-5 w-5 shrink-0 text-violet-500/80 sm:mt-0',
    glassCard:
      'rounded-3xl border border-white/70 bg-white/[0.72] shadow-[0_10px_48px_-16px_rgba(99,102,241,0.12)] backdrop-blur-md',
    glassCardPad: 'p-6 sm:p-7 lg:p-8',
    type: {
      pageTitle:
        'text-[2rem] font-semibold leading-[1.15] tracking-[-0.04em] text-stone-900 sm:text-[2.25rem] lg:text-[2.5rem]',
      heroInsight:
        'text-[1.75rem] font-semibold leading-[1.28] tracking-[-0.035em] text-stone-900 sm:text-[2rem] lg:text-[2.25rem]',
      heroInsightSecondary:
        'text-xl font-medium leading-snug tracking-[-0.025em] text-stone-800 sm:text-2xl',
      sectionHeading:
        'text-lg font-medium tracking-[-0.02em] text-stone-800 sm:text-xl',
      body: 'text-sm leading-relaxed text-stone-600 sm:text-[15px] sm:leading-relaxed',
      bodyMuted: 'text-sm leading-relaxed text-stone-500/90 sm:text-[15px]',
      eyebrow:
        'text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700/75',
      labelCaps:
        'text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400',
    },
    spacing: {
      sectionGap: 'mt-10 sm:mt-12',
      cardGap: 'gap-5 sm:gap-6',
    },
  },
  personaChip:
    'mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200/50 bg-violet-50/60 px-3 py-1.5',
  personaChipEmoji: 'text-base leading-none',
  personaChipLabel: 'text-xs font-medium text-violet-900/90',

  /** EZA'nın Son Gözlemi — premium editorial (Aşama 1 foundation) */
  observationPolish: {
    section: 'relative pb-10 pt-1 sm:pb-16 sm:pt-4',
    ambient:
      'pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_85%_65%_at_50%_-12%,rgba(167,139,250,0.16),transparent_72%)]',
    headerRow: 'flex flex-wrap items-start justify-between gap-5',
    headerTitle:
      'text-[1.65rem] font-semibold leading-[1.18] tracking-[-0.04em] text-stone-900 sm:text-[2.25rem] lg:text-[2.5rem]',
    headerSub:
      'mt-3 max-w-lg text-sm leading-relaxed text-stone-500/90 sm:text-[15px] sm:leading-relaxed',
    priorityBand:
      'mb-6 rounded-2xl border border-amber-200/30 bg-amber-50/40 px-4 py-3 backdrop-blur-sm sm:px-5',
    priorityEyebrow: 'text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800/65',
    priorityHeadline: 'text-sm font-medium leading-snug text-amber-950/90 sm:text-[15px]',
    priorityMeta: 'mt-1 text-xs leading-relaxed text-amber-800/60',
    mainCard:
      'relative overflow-hidden rounded-[1.5rem] border border-violet-200/40 bg-gradient-to-br from-white/92 via-white/82 to-violet-100/35 p-4 shadow-[0_24px_70px_-28px_rgba(99,102,241,0.22)] ring-1 ring-violet-100/50 backdrop-blur-md sm:rounded-3xl sm:p-7 lg:p-8',
    mainCardSheen:
      'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_0%,rgba(255,255,255,0.55),transparent_55%)]',
    mainCardInner:
      'relative grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-6 xl:gap-8',
    heroPersonaCol:
      'flex min-w-0 flex-col items-center gap-0 text-center lg:items-start lg:text-left',
    heroMirrorCol: 'flex min-w-0 w-full flex-col gap-3 sm:max-w-md sm:mx-auto lg:max-w-none lg:mx-0 lg:gap-3',
    energyBadge:
      'mb-5 inline-flex rounded-full border border-violet-200/35 bg-violet-50/70 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-800/75',
    personaStage: 'relative mx-auto w-full max-w-[11.5rem] lg:mx-0',
    personaAside: 'flex w-full flex-col items-center lg:items-start',
    personaGlowOuter:
      'pointer-events-none absolute -inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.28)_0%,rgba(199,210,254,0.1)_42%,transparent_68%)] blur-md',
    personaGlow:
      'relative flex aspect-square w-[6.5rem] items-center justify-center sm:w-[7.75rem] md:w-[9rem] lg:w-[10rem] xl:w-[11.25rem]',
    personaGlowRing:
      'pointer-events-none absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.2)_0%,rgba(255,255,255,0.05)_50%,transparent_72%)] ring-1 ring-violet-200/25',
    personaChip:
      'mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200/40 bg-white/95 px-4 py-2 shadow-[0_4px_16px_-6px_rgba(139,92,246,0.22)]',
    personaChipEmoji: 'text-lg leading-none',
    personaChipLabel: 'text-sm font-semibold text-violet-900/85',
    personaFamily: 'hidden',
    insightCol: 'mt-5 w-full min-w-0 lg:mt-6',
    insightEyebrow:
      'mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700/70 lg:sr-only',
    mainInsight:
      'border-0 p-0 text-[1.35rem] font-semibold leading-[1.38] tracking-[-0.03em] text-stone-800 sm:text-[1.5rem] lg:text-[1.65rem] xl:text-[1.85rem] xl:leading-[1.32]',
    insightAccent: 'font-semibold text-violet-600 underline decoration-violet-300/50 decoration-2 underline-offset-[5px]',
    mainInsightSecondary:
      'mt-3 border-0 p-0 text-xl font-medium leading-snug tracking-[-0.025em] text-stone-800 sm:text-2xl',
    supportLine: 'mt-5 text-sm leading-relaxed text-stone-500/90 sm:text-[15px]',
    mirrorGrid: 'mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5',
    mirrorCard:
      'flex flex-col rounded-2xl border border-violet-100/50 bg-white/85 p-4 shadow-[0_4px_20px_-10px_rgba(99,102,241,0.08)] backdrop-blur-sm',
    mirrorCardCompact:
      'flex min-h-[7.5rem] flex-col rounded-2xl border border-white/90 p-4 shadow-[0_8px_32px_-14px_rgba(99,102,241,0.14)] backdrop-blur-md transition-[box-shadow,transform] duration-300 motion-reduce:transition-none sm:min-h-[7.75rem] sm:p-[1.125rem]',
    mirrorCardCompactSen:
      'border-l-[4px] border-l-violet-400/70 bg-gradient-to-br from-violet-50/80 via-white/95 to-white/90',
    mirrorCardCompactAi:
      'border-l-[4px] border-l-sky-400/70 bg-gradient-to-br from-sky-50/75 via-white/95 to-white/90',
    mirrorCardCompactBalance:
      'border-l-[4px] border-l-emerald-400/70 bg-gradient-to-br from-emerald-50/70 via-white/95 to-white/90',
    mirrorCardHeader: 'flex items-center gap-2.5',
    mirrorIconWrap:
      'flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-violet-50 text-violet-700',
    mirrorIconWrapAi:
      'flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-cyan-50 text-sky-700',
    mirrorIconWrapBalance:
      'flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700',
    mirrorCardLabel:
      'mt-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400',
    mirrorPillRow: 'mt-2 flex flex-wrap gap-1.5',
    mirrorCardPill:
      'rounded-full border border-stone-200/35 bg-white/90 px-2.5 py-0.5 text-[10px] font-medium text-stone-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
    mirrorCardText: 'mt-2.5 flex-1 text-[13px] leading-[1.45] text-stone-600 sm:text-[13.5px]',
    mirrorFooter: 'mt-auto flex items-center gap-1.5 pt-2 text-[11px] text-stone-500/95',
    mirrorFooterDot: 'h-1.5 w-1.5 rounded-full bg-emerald-400/80',
    metricsSection:
      'relative z-10 mt-6 border-t border-violet-200/30 pt-6 sm:mt-7 sm:pt-7',
    metricsSectionLabel:
      'mb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700/75',
    metricsGrid: 'grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4',
    insightsBand: 'mt-6 sm:mt-8',
    insightsBandLabel:
      'mb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700/75',
    metricCard:
      'rounded-2xl border border-white/75 bg-gradient-to-b from-white/90 to-violet-50/15 px-5 py-4 shadow-[0_8px_32px_-12px_rgba(99,102,241,0.1)] backdrop-blur-md',
    metricCardIcon: 'text-violet-500/80',
    metricCardLabel: 'text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-400',
    metricCardValue: 'mt-1.5 text-sm font-medium text-stone-800',
    metricProgressTrack: 'mt-3 h-1.5 overflow-hidden rounded-full bg-stone-200/35',
    metricProgressFill:
      'h-full rounded-full bg-gradient-to-r from-violet-300/90 via-violet-400/85 to-violet-500/75 transition-[width] duration-500 ease-out motion-reduce:transition-none',
    metricProgressFillTrust:
      'h-full rounded-full bg-gradient-to-r from-emerald-300/90 via-teal-400/80 to-teal-500/75 transition-[width] duration-500 ease-out motion-reduce:transition-none',
    patternDots: 'mt-3 flex flex-wrap gap-1.5',
    patternDot:
      'inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-400/85',
    patternDotInactive: 'bg-stone-200/80',
    patternDotLatest: 'ring-2 ring-violet-300/60 ring-offset-2 ring-offset-white',
    contextLine: 'mt-6 text-center text-xs leading-relaxed text-stone-500 lg:text-left',
    lowerGrid:
      'mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-6 lg:grid-cols-[1fr_280px] lg:items-stretch lg:gap-6 xl:grid-cols-[1fr_300px]',
    whyWrap:
      'min-w-0 rounded-2xl border border-white/75 bg-gradient-to-b from-white/80 to-violet-50/10 p-4 backdrop-blur-md sm:p-5',
    whyToggle:
      'flex w-full items-center justify-between gap-2 rounded-xl px-1 py-0.5 text-left text-sm font-semibold text-stone-800 transition-colors hover:text-violet-900/90',
    whyGrid: 'mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2',
    whyCard:
      'rounded-2xl border border-white/70 bg-white/[0.82] p-5 shadow-[0_8px_28px_-12px_rgba(99,102,241,0.1)] backdrop-blur-md sm:p-6',
    whyIconWrap:
      'flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100/80 to-indigo-50/60 text-violet-700',
    whyCardTitle: 'mt-3 text-sm font-medium text-stone-800',
    whyCardBody: 'mt-1.5 text-sm leading-relaxed text-stone-600',
    inspirationCard:
      'relative flex min-h-[14rem] flex-col overflow-hidden rounded-3xl border border-violet-200/40 bg-gradient-to-br from-violet-200/55 via-violet-100/75 to-indigo-100/65 p-6 shadow-[0_12px_40px_-14px_rgba(139,92,246,0.28)] sm:min-h-[16rem] sm:p-7',
    inspirationQuote:
      'relative z-10 text-base font-semibold leading-[1.55] tracking-[-0.01em] text-violet-950/88 sm:text-[17px] sm:leading-[1.5]',
    inspirationDecor:
      'pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/35 blur-2xl',
    inspirationHills:
      'pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-violet-300/35 via-violet-200/15 to-transparent',
    inspirationHillShape:
      'absolute bottom-0 left-[8%] h-14 w-[38%] rounded-t-[100%] bg-violet-300/30',
    inspirationHillShape2:
      'absolute bottom-0 right-[5%] h-16 w-[42%] rounded-t-[100%] bg-indigo-300/25',
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

  /** EZA İlişki Haritası — premium map (Aşama 1 foundation) */
  relationshipMapPolish: {
    section: 'relative pb-10 pt-1 sm:pb-16 sm:pt-4',
    ambient:
      'pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_85%_65%_at_50%_-8%,rgba(129,140,248,0.14),transparent_68%)]',
    headerRow:
      'flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-5',
    headerTitle:
      'text-[1.65rem] font-semibold leading-[1.18] tracking-[-0.04em] text-stone-900 sm:text-[2.25rem] lg:text-[2.5rem]',
    headerSub:
      'mt-2 max-w-xl text-sm leading-relaxed text-stone-500/90 sm:mt-3 sm:text-[15px] sm:leading-relaxed',
    topBar: 'mt-6 flex flex-col gap-4 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-5',
    periodRow:
      'flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden',
    periodPill:
      'shrink-0 snap-center rounded-full border px-4 py-2.5 text-xs font-medium transition-all duration-300 touch-manipulation motion-reduce:transition-none sm:py-2',
    periodPillActive:
      'border-violet-200/70 bg-white/90 text-violet-900 shadow-[0_0_20px_-6px_rgba(139,92,246,0.35)] ring-1 ring-violet-200/50',
    periodPillIdle:
      'border-transparent bg-white/50 text-stone-600 hover:bg-white/80 hover:text-stone-800',
    balanceMiniCard:
      'w-full rounded-2xl border border-teal-200/30 bg-gradient-to-br from-teal-50/70 to-white/80 px-4 py-3 shadow-[0_4px_20px_-8px_rgba(20,184,166,0.15)] backdrop-blur-sm sm:w-auto sm:min-w-[14rem]',
    balanceMiniLabel: 'text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-800/60',
    balanceMiniValue: 'mt-1 text-sm font-medium text-stone-800',
    contentFade: 'transition-opacity duration-500 motion-reduce:transition-none',
    editorialCard:
      'mt-6 rounded-2xl border border-violet-200/25 bg-gradient-to-br from-violet-50/55 via-white/[0.72] to-sky-50/45 p-5 shadow-[0_10px_40px_-12px_rgba(99,102,241,0.12)] backdrop-blur-md sm:mt-8 sm:rounded-3xl sm:p-7 lg:p-8',
    editorialLabel: 'text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-800/60',
    editorialBody: 'mt-2 text-sm leading-relaxed text-stone-700 sm:text-[15px]',
    islandsSection: 'mt-8 sm:mt-10 lg:mt-12',
    islandsHeading: 'text-base font-medium tracking-[-0.02em] text-stone-800 sm:text-xl',
    islandsSub: 'mt-1.5 text-sm leading-relaxed text-stone-500/90 sm:mt-2 sm:text-[15px]',
    islandsCanvas:
      'relative mt-4 min-h-0 overflow-hidden rounded-2xl border border-indigo-500/10 bg-gradient-to-br from-violet-50/30 via-white/40 to-sky-50/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-sm sm:mt-5 sm:min-h-[26rem] sm:rounded-3xl sm:p-4',
    islandsCanvasMesh:
      'pointer-events-none absolute inset-0 opacity-[0.45] [background-image:radial-gradient(circle_at_1px_1px,rgba(139,92,246,0.12)_1px,transparent_0)] [background-size:20px_20px]',
    islandsCluster:
      'relative mx-auto grid w-full grid-cols-1 gap-3 max-sm:min-h-0 sm:min-h-[24rem] sm:grid-cols-none sm:gap-0',
    islandsClusterGlow:
      'pointer-events-none absolute left-1/2 top-1/2 hidden h-[85%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.2),rgba(129,140,248,0.06)_45%,transparent_72%)] blur-2xl sm:block',
    islandBlobCluster:
      'overflow-hidden rounded-[1.65rem] border px-4 py-3.5 transition-transform duration-300 motion-reduce:transition-none sm:absolute sm:rounded-[2rem] sm:px-5 sm:py-5 sm:hover:scale-[1.02] motion-reduce:sm:hover:scale-100',
    islandBlobResponsive:
      'max-sm:!relative max-sm:!left-auto max-sm:!top-auto max-sm:!z-auto max-sm:!w-full max-sm:!min-h-[5.75rem]',
    islandsGrid:
      'relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 lg:gap-5',
    islandBlob:
      'group relative min-h-[7.5rem] overflow-hidden rounded-[1.85rem] border px-5 py-5 transition-transform duration-300 motion-reduce:transition-none hover:scale-[1.012] motion-reduce:hover:scale-100 sm:min-h-[8.5rem]',
    islandGlow: 'pointer-events-none absolute -inset-6 opacity-50 blur-3xl',
    islandLabel: 'relative text-sm font-medium text-stone-900 sm:text-[15px]',
    islandDesc: 'relative mt-1.5 text-[13px] leading-relaxed text-stone-600/95 sm:mt-2 sm:text-sm',
    islandMeta: 'relative mt-4 flex flex-wrap items-center gap-2',
    islandTrendPill:
      'rounded-full bg-white/60 px-2.5 py-0.5 text-[10px] font-medium text-stone-500 backdrop-blur-sm',
    islandPercentMuted: 'text-[10px] tabular-nums text-stone-400/90',
    emptyIslands:
      'flex min-h-[16rem] flex-col items-center justify-center rounded-3xl border border-dashed border-stone-200/50 bg-white/40 px-6 py-12 text-center',
    emptyTitle: 'text-base font-medium text-stone-700',
    emptyBody: 'mt-2 max-w-sm text-sm leading-relaxed text-stone-500',
    chartsGrid: 'mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:gap-6 lg:grid-cols-3',
    chartCard:
      'rounded-2xl border border-white/70 bg-white/[0.72] p-5 shadow-[0_8px_36px_-12px_rgba(99,102,241,0.1)] backdrop-blur-md sm:rounded-3xl sm:p-7',
    aiTitle: 'text-sm font-medium text-stone-800',
    aiToneRow: 'mt-4 flex flex-col gap-3.5',
    aiToneItem: 'flex flex-col gap-1.5',
    aiToneLabel: 'text-xs text-stone-600',
    aiToneTrack: 'h-1.5 overflow-hidden rounded-full bg-stone-200/35',
    aiToneFill:
      'h-full rounded-full bg-gradient-to-r from-violet-300/85 to-indigo-400/65 transition-[width] duration-500 ease-out motion-reduce:transition-none',
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
    footerNote: 'mt-8 px-2 text-center text-xs leading-relaxed text-stone-400 sm:mt-10',
    islandGrowing: 'ring-1 ring-violet-300/45 shadow-[0_8px_36px_-8px_rgba(139,92,246,0.2)]',
    islandFading: 'border-dashed border-stone-300/40 opacity-[0.78]',
    islandGhost: 'opacity-45',
    connectionHint:
      'pointer-events-none absolute inset-0 rounded-[1.85rem] border border-dashed border-violet-200/20',
    mapConnectors:
      'pointer-events-none absolute inset-0 z-[1] hidden opacity-[0.4] sm:block',
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
      'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-indigo-500/15 bg-white/85 px-4 py-2 text-xs font-medium text-stone-600 shadow-[0_4px_16px_-6px_rgba(99,102,241,0.12)] backdrop-blur-sm transition-all touch-manipulation hover:border-violet-200/50 hover:text-violet-900 hover:shadow-[0_6px_20px_-6px_rgba(139,92,246,0.2)] sm:min-h-0 sm:w-auto',
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
