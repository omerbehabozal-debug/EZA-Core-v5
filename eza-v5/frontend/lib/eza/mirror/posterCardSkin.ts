/**
 * Daily Mirror poster — composition tokens (Sprint 11L).
 * Driven by posterCompositionSystem zones & typography scale.
 */

import { POSTER_DESIGN_WIDTH_PX } from '@/lib/eza/mirror/posterCompositionSystem';

export const POSTER_CARD_WIDTH_PX = POSTER_DESIGN_WIDTH_PX;

export const POSTER_ASPECT_RATIO = '9 / 16' as const;

/** @deprecated use POSTER_AREA_SCENE from posterCompositionSystem */
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
    'pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#0a0614]/48 via-transparent via-32% to-transparent',
  globalOverlayBottom:
    'pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[32%] bg-gradient-to-t from-[#0a0614]/55 via-[#120a24]/12 to-transparent',
  grain:
    'pointer-events-none absolute inset-0 z-[2] opacity-[0.028] mix-blend-overlay [background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")]',
  vignette:
    'pointer-events-none absolute inset-0 z-[2] shadow-[inset_0_0_100px_rgba(4,2,12,0.18)]',
  contentStack: 'relative z-10 grid h-full min-h-0',
  /** Top safe zone — logo + date only */
  topSafeZone: 'flex shrink-0 items-start justify-between gap-3 px-5 pb-0.5 pt-4',
  logoMark: 'flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/90',
  logoText: 'text-[9px] font-medium tracking-[0.12em] text-white/72 uppercase',
  datePill: 'text-[8px] font-medium tracking-wide text-white/55',
  /** Main title safe zone — headline + story */
  titleSafeZone: [
    'relative shrink-0 px-5 pb-1 pt-0',
    'before:pointer-events-none before:absolute before:inset-0 before:-inset-x-2',
    'before:bg-gradient-to-b before:from-[#0a0614]/62 before:via-[#0a0614]/28 before:to-transparent',
    'before:backdrop-blur-[3px]',
  ].join(' '),
  heroTitle: [
    'relative z-[1] max-w-[16.5rem] line-clamp-2 text-[32px] font-semibold leading-[0.94] tracking-[-0.04em] text-white',
    'drop-shadow-[0_2px_24px_rgba(0,0,0,0.75)]',
    'max-[380px]:max-w-[14.5rem] max-[380px]:text-[30px]',
  ].join(' '),
  story: [
    'relative z-[1] mt-2 line-clamp-2 text-[13px] font-normal leading-[1.42] text-white/90',
    'drop-shadow-[0_1px_12px_rgba(0,0,0,0.55)]',
  ].join(' '),
  /** Scene flex — highlight anchors to bottom of visual field */
  sceneAnchor: 'relative min-h-0 px-5',
  highlightAnchor:
    'pointer-events-none absolute inset-x-5 bottom-2 z-[1] flex flex-col justify-end',
  /** Whisper — calm / general editorial label */
  highlightWhisper: [
    'inline-flex max-w-full flex-wrap items-center gap-1.5 self-start rounded-full',
    'border border-white/10 bg-[#0a0614]/35 px-2.5 py-1',
    'backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.25)]',
  ].join(' '),
  highlightWhisperTitle:
    'text-[6px] font-medium uppercase tracking-[0.2em] text-white/45',
  highlightWhisperTag:
    'text-[6px] font-medium uppercase tracking-wide text-white/58',
  /** Ribbon — medium emphasis */
  highlightRibbon: [
    'w-full rounded-xl border border-white/12',
    'bg-[#0a0614]/40 px-2.5 py-1.5',
    'backdrop-blur-lg shadow-[0_4px_24px_rgba(0,0,0,0.28)]',
  ].join(' '),
  highlightRibbonTitle:
    'mb-1 text-[6px] font-medium uppercase tracking-[0.18em] text-white/50',
  highlightRibbonTags: 'flex flex-wrap gap-1',
  highlightRibbonTag:
    'rounded-full bg-white/[0.08] px-1.5 py-px text-[6px] font-medium uppercase tracking-wide text-white/62',
  /** Prominent — comparison / VS */
  highlightProminent: [
    'w-full rounded-xl border border-white/16',
    'bg-gradient-to-r from-violet-950/48 via-fuchsia-950/38 to-violet-950/48',
    'px-2.5 py-2 backdrop-blur-md shadow-[0_6px_28px_rgba(0,0,0,0.32)]',
  ].join(' '),
  highlightProminentTitle:
    'mb-1.5 text-center text-[7px] font-semibold uppercase tracking-[0.2em] text-white/62',
  highlightDual: 'grid grid-cols-[1fr_auto_1fr] items-center gap-1.5',
  highlightSide: 'min-w-0',
  highlightSideLabel: 'text-[8px] font-semibold leading-tight text-white/92',
  highlightSideHint: 'mt-0.5 line-clamp-1 text-[7px] leading-snug text-white/55',
  highlightVs:
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/12 text-[7px] font-bold text-white/88 ring-1 ring-white/18',
  highlightTags: 'mt-1.5 flex flex-wrap justify-center gap-1',
  highlightTag:
    'rounded-full bg-white/[0.08] px-1.5 py-px text-[6px] font-medium uppercase tracking-wide text-white/58',
  /** Bottom support safe zone */
  bottomSafeZone: [
    'flex shrink-0 flex-col gap-2 px-5 pt-2 pb-2',
    'bg-gradient-to-b from-[#0a0614]/50 via-[#0a0614]/78 to-[#0a0614]/92',
    'backdrop-blur-sm',
  ].join(' '),
  quoteText: [
    'line-clamp-2 text-center text-[12px] font-normal italic leading-[1.48] text-white/78',
    'drop-shadow-[0_1px_10px_rgba(0,0,0,0.45)]',
  ].join(' '),
  quoteMark: 'text-[9px] not-italic text-white/35',
  metricsRow: 'grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-2',
  relationCell: 'min-w-0 text-center',
  relationLabel:
    'text-[7px] font-medium uppercase tracking-[0.1em] text-white/48',
  relationLine: 'mt-0.5 line-clamp-2 text-[8.5px] leading-[1.35] text-white/72',
  footer:
    'flex shrink-0 items-center justify-between gap-2 px-5 pb-3 pt-1 text-[7px] font-medium tracking-[0.1em] text-white/42 uppercase',
} as const;
