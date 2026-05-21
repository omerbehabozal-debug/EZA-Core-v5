/**
 * Daily Mirror poster — presentation standard (Sprint 11K).
 * ~70% scene story zone · localized text scrims · contextual highlight band.
 */

/** Design width (px); export scales to 1080 via shareExport. */
export const POSTER_CARD_WIDTH_PX = 432;

export const POSTER_ASPECT_RATIO = '9 / 16' as const;

/** Target: 65–75% visual story, 15–25% copy, 10–15% support */
export const POSTER_SCENE_DOMINANCE_RATIO = 0.7;

export const posterCardSkin = {
  root: [
    'relative mx-auto flex w-full flex-col overflow-hidden',
    'aspect-[9/16]',
    'rounded-[1.65rem] border border-white/35',
    'bg-[#0a0614]',
    'shadow-[0_32px_80px_-28px_rgba(26,12,52,0.45)]',
  ].join(' '),
  sceneBackdrop: 'pointer-events-none absolute inset-0 z-0',
  globalOverlay:
    'pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#0a0614]/55 via-transparent via-35% to-[#0a0614]/25',
  globalOverlayBottom:
    'pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[38%] bg-gradient-to-t from-[#0a0614]/65 via-[#120a24]/18 to-transparent',
  grain:
    'pointer-events-none absolute inset-0 z-[2] opacity-[0.028] mix-blend-overlay [background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")]',
  vignette:
    'pointer-events-none absolute inset-0 z-[2] shadow-[inset_0_0_100px_rgba(4,2,12,0.2)]',
  contentStack: 'relative z-10 flex h-full min-h-0 flex-col',
  header: 'flex shrink-0 items-start justify-between gap-3 px-5 pb-1 pt-4',
  logoMark: 'flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/90',
  logoText: 'text-[9px] font-medium tracking-[0.12em] text-white/75 uppercase',
  logoSub: 'sr-only',
  datePill: 'text-[8px] font-medium tracking-wide text-white/55',
  /** Headline — local scrim, not a box */
  headlineZone:
    'relative shrink-0 px-5 pb-2 pt-1 before:pointer-events-none before:absolute before:inset-0 before:-inset-x-1 before:bg-gradient-to-b before:from-[#0a0614]/50 before:via-[#0a0614]/25 before:to-transparent before:backdrop-blur-[2px]',
  heroTitle: [
    'relative z-[1] max-w-[15rem] line-clamp-2',
    'text-[1.75rem] font-semibold leading-[0.92] tracking-[-0.045em] text-white',
    'drop-shadow-[0_4px_28px_rgba(0,0,0,0.65)]',
    'max-[380px]:max-w-[13.5rem] max-[380px]:text-[1.6rem]',
  ].join(' '),
  /** Scene story anchor — highlight sits on scene */
  posterStage: 'relative flex min-h-[48%] flex-1 flex-col justify-end px-5 pb-1',
  /** VS / topic band — part of scene, not dashboard card */
  highlightBand: [
    'relative z-[1] w-full rounded-2xl border border-white/18',
    'bg-gradient-to-r from-violet-950/55 via-fuchsia-950/45 to-violet-950/55',
    'px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
    'backdrop-blur-md',
  ].join(' '),
  highlightBandTitle:
    'mb-2 text-center text-[7px] font-semibold uppercase tracking-[0.22em] text-white/70',
  highlightDual: 'grid grid-cols-[1fr_auto_1fr] items-center gap-2',
  highlightSide: 'min-w-0',
  highlightSideLabel: 'text-[8px] font-semibold leading-tight text-white/92',
  highlightSideHint: 'mt-0.5 line-clamp-2 text-[7px] leading-snug text-white/58',
  highlightVs:
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/14 text-[8px] font-bold text-white/90 ring-1 ring-white/20',
  highlightTags: 'mt-2 flex flex-wrap justify-center gap-1',
  highlightTag:
    'rounded-full bg-white/10 px-2 py-0.5 text-[6px] font-medium uppercase tracking-wide text-white/65',
  /** Lower copy — unified scrim panel */
  copyPanel: [
    'shrink-0 space-y-2.5 px-5 py-3',
    'bg-gradient-to-b from-[#0a0614]/72 via-[#0a0614]/82 to-[#0a0614]/88',
    'backdrop-blur-sm',
  ].join(' '),
  story: 'line-clamp-2 text-[10px] leading-[1.45] text-white/88',
  quoteWrap: 'relative px-1 py-0.5',
  quoteText:
    'line-clamp-2 text-center text-[9px] font-normal italic leading-[1.5] text-white/70',
  quoteMark: 'text-[8px] not-italic text-white/40',
  metricsRow: [
    'grid shrink-0 grid-cols-3 gap-2 px-5 py-2',
    'border-t border-white/[0.08]',
    'bg-[#0a0614]/75 backdrop-blur-md',
  ].join(' '),
  relationCell: 'min-w-0 rounded-lg bg-white/[0.06] px-1.5 py-1',
  relationLabel: 'text-[5px] font-medium uppercase tracking-[0.12em] text-white/42',
  relationLine: 'line-clamp-2 text-[6.5px] leading-[1.3] text-white/58',
  footer:
    'flex shrink-0 items-center justify-between gap-2 px-5 pb-3.5 pt-2 text-[5.5px] font-medium tracking-[0.12em] text-white/30 uppercase',
} as const;
