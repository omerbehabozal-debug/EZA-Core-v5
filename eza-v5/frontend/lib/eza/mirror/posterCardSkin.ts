/**
 * Daily Mirror poster — presentation tokens (Sprint 11E).
 * Layout/export only; content from posterCardContent + card model.
 */

/** Design width (px); export scales to 1080 via shareExport. */
export const POSTER_CARD_WIDTH_PX = 432;

export const POSTER_ASPECT_RATIO = '9 / 16' as const;

export const posterCardSkin = {
  root: [
    'relative mx-auto w-full overflow-hidden',
    'rounded-[1.65rem] border border-white/60',
    'bg-[#f8f6fc]',
    'shadow-[0_28px_72px_-24px_rgba(91,33,182,0.28)]',
    'ring-1 ring-violet-200/30',
  ].join(' '),
  grain:
    'pointer-events-none absolute inset-0 z-[1] opacity-[0.04] mix-blend-multiply [background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")]',
  vignette:
    'pointer-events-none absolute inset-0 z-[2] shadow-[inset_0_0_80px_rgba(26,16,53,0.12)]',
  sceneZone: 'relative h-[48%] min-h-[11.5rem] shrink-0',
  header: 'relative z-20 flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5',
  logoMark:
    'flex h-8 w-8 items-center justify-center rounded-full bg-white/18 text-white backdrop-blur-md',
  logoText: 'text-[13px] font-semibold tracking-tight text-white drop-shadow-sm',
  logoSub: 'text-[9px] font-medium uppercase tracking-[0.16em] text-white/88',
  datePill:
    'flex max-w-[9rem] items-center gap-1 rounded-full bg-white/14 px-2 py-1 text-[9px] font-medium text-white/95 backdrop-blur-md',
  heroBlock: 'relative z-20 mt-auto px-4 pb-3 sm:px-5 sm:pb-4',
  heroEyebrow: 'text-[9px] font-semibold uppercase tracking-[0.18em] text-white/80',
  heroTitle:
    'mt-1 line-clamp-2 text-[1.5rem] font-bold leading-[1.12] tracking-[-0.03em] drop-shadow-md sm:text-[1.65rem]',
  bodyPanel:
    'relative z-20 flex min-h-0 flex-1 flex-col gap-2.5 bg-gradient-to-b from-[#faf7ff]/97 via-[#faf7ff] to-[#f3ecff] px-3.5 pb-3.5 pt-2.5 sm:px-4 sm:pb-4',
  story:
    'line-clamp-2 text-[11px] leading-[1.45] text-stone-600/95 sm:text-xs',
  themeBox:
    'rounded-xl border border-violet-200/35 bg-white/55 px-3 py-2 backdrop-blur-sm',
  themeLabel: 'text-[8px] font-semibold uppercase tracking-[0.14em] text-violet-600/90',
  themeTitle: 'mt-0.5 text-[10px] font-bold text-violet-950',
  themeDesc: 'mt-0.5 line-clamp-2 text-[10px] leading-snug text-violet-800/75',
  quoteBand:
    'rounded-xl border border-violet-100/50 bg-white/70 px-3 py-2.5 text-center shadow-[0_4px_20px_-8px_rgba(99,102,241,0.12)] backdrop-blur-md',
  quoteText:
    'line-clamp-2 text-[11px] font-medium leading-[1.4] tracking-tight text-violet-950/88 italic',
  relationGrid: 'grid grid-cols-3 gap-2',
  relationCell:
    'flex flex-col gap-1.5 rounded-xl border border-violet-100/55 bg-white/75 px-2 py-2 shadow-sm',
  relationLabel:
    'flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.12em] text-violet-700/90',
  relationLine: 'line-clamp-2 text-[9px] leading-snug text-stone-600/90',
  relationBar: 'h-1 overflow-hidden rounded-full bg-violet-100/90',
  relationBarFill: 'h-full rounded-full bg-gradient-to-r from-violet-400/90 to-fuchsia-400/80',
  footer:
    'mt-auto flex items-center justify-between gap-2 border-t border-violet-100/50 pt-2.5 text-[8px] font-medium tracking-wide text-violet-500/90',
} as const;
