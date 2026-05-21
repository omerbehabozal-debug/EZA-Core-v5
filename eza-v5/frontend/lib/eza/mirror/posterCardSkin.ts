/**
 * Daily Mirror poster — layered visual-dominant 9:16 (Sprint 11G-rebuild).
 * Presentation only; content from posterCardContent + card model.
 */

/** Design width (px); export scales to 1080 via shareExport. */
export const POSTER_CARD_WIDTH_PX = 432;

export const POSTER_ASPECT_RATIO = '9 / 16' as const;

/** Target visual footprint — scene as full-card atmosphere. */
export const POSTER_SCENE_DOMINANCE_RATIO = 0.72;

export const posterCardSkin = {
  root: [
    'relative mx-auto flex w-full flex-col overflow-hidden',
    'aspect-[9/16]',
    'rounded-[1.65rem] border border-white/50',
    'bg-[#120a24]',
    'shadow-[0_28px_72px_-24px_rgba(91,33,182,0.32)]',
    'ring-1 ring-violet-200/25',
  ].join(' '),
  /** Full-card scene — z-0 */
  sceneBackdrop: 'pointer-events-none absolute inset-0 z-0',
  /** Card-level readability — does not wash out the scene */
  globalOverlay:
    'pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-[#120a24]/78 via-[#1a1035]/28 to-transparent',
  globalOverlayBottom:
    'pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[52%] bg-gradient-to-t from-[#0a0614]/72 via-[#120a24]/28 to-transparent',
  grain:
    'pointer-events-none absolute inset-0 z-[2] opacity-[0.035] mix-blend-overlay [background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")]',
  vignette:
    'pointer-events-none absolute inset-0 z-[2] shadow-[inset_0_0_100px_rgba(8,4,18,0.22)]',
  /** All copy sits above scene */
  contentStack: 'relative z-10 flex min-h-0 flex-1 flex-col',
  header:
    'flex shrink-0 items-start justify-between gap-2 px-3.5 pb-1 pt-3.5',
  logoMark:
    'flex h-6 w-6 items-center justify-center rounded-full bg-white/16 text-white backdrop-blur-md',
  logoText: 'text-[11px] font-semibold tracking-tight text-white drop-shadow-sm',
  logoSub: 'text-[7px] font-medium uppercase tracking-[0.16em] text-white/85',
  datePill:
    'flex max-w-[8.5rem] items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[7px] font-medium text-white/92 backdrop-blur-md ring-1 ring-white/12',
  headlineZone:
    'flex min-h-0 flex-1 flex-col justify-center px-3.5 pb-1 pt-0',
  heroTitle:
    'line-clamp-2 text-[1.32rem] font-bold leading-[1.1] tracking-[-0.03em] text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)] max-[380px]:text-[1.2rem]',
  bottomStack: 'flex shrink-0 flex-col gap-1 px-3 pb-2.5 pt-0',
  glass:
    'rounded-xl border border-white/14 bg-white/10 px-2 py-1 backdrop-blur-md',
  glassTheme:
    'rounded-xl border border-white/14 bg-white/10 px-2 py-1 backdrop-blur-md',
  story:
    'line-clamp-2 text-[9px] leading-[1.35] text-white/88',
  themeLabel:
    'text-[6px] font-semibold uppercase tracking-[0.14em] text-white/70',
  themeDesc: 'line-clamp-2 text-[8px] leading-snug text-white/82',
  quoteWrap: 'px-1 py-0.5 text-center',
  quoteText:
    'line-clamp-2 text-[9px] font-normal italic leading-[1.4] tracking-tight text-white/78',
  quoteMark: 'text-[8px] not-italic text-white/45',
  metricsGlass:
    'grid grid-cols-3 gap-1 rounded-xl border border-white/14 bg-black/18 p-1 backdrop-blur-lg',
  relationCell: 'flex min-h-0 flex-col gap-0.5 px-1 py-0.5',
  relationLabel:
    'flex shrink-0 items-center gap-0.5 text-[6px] font-bold uppercase tracking-[0.1em] text-white/75',
  relationLine: 'line-clamp-2 min-h-0 text-[7px] leading-[1.28] text-white/82',
  relationBar: 'mt-0.5 h-px shrink-0 overflow-hidden rounded-full bg-white/15',
  relationBarFill: 'h-full rounded-full bg-gradient-to-r from-violet-300/80 to-fuchsia-300/70',
  footer:
    'flex shrink-0 items-center justify-between gap-1 px-1 pt-1 text-[6px] font-medium tracking-wide text-white/55',
} as const;
