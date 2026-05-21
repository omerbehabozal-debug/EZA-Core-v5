/**
 * Daily Mirror poster — editorial contrast tokens (Sprint 11M).
 * Gradient scrims · confident typography · minimal blur.
 */

import { POSTER_DESIGN_WIDTH_PX } from '@/lib/eza/mirror/posterCompositionSystem';
import {
  HEADLINE_TEXT_SHADOW,
  METRIC_TEXT_SHADOW,
  QUOTE_TEXT_SHADOW,
  STORY_TEXT_SHADOW,
} from '@/lib/eza/mirror/posterReadabilitySystem';

export const POSTER_CARD_WIDTH_PX = POSTER_DESIGN_WIDTH_PX;

export const POSTER_ASPECT_RATIO = '9 / 16' as const;

export const POSTER_SCENE_DOMINANCE_RATIO = 0.7;

export const posterCardSkin = {
  root: [
    'relative mx-auto flex w-full flex-col overflow-hidden',
    'aspect-[9/16]',
    'rounded-[1.65rem] border border-white/40',
    'bg-[#0a0614]',
    'shadow-[0_36px_90px_-24px_rgba(18,8,36,0.55)]',
  ].join(' '),
  sceneBackdrop: 'pointer-events-none absolute inset-0 z-0',
  globalOverlay:
    'pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#12081c]/65 via-transparent via-28% to-transparent',
  globalOverlayBottom:
    'pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[36%]',
  grain:
    'pointer-events-none absolute inset-0 z-[2] opacity-[0.022] mix-blend-overlay [background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")]',
  vignette:
    'pointer-events-none absolute inset-0 z-[2] shadow-[inset_0_0_120px_rgba(4,2,14,0.28)]',
  contentStack: 'relative z-10 grid h-full min-h-0',
  topSafeZone: 'flex shrink-0 items-start justify-between gap-3 px-5 pb-0.5 pt-4',
  logoMark: 'flex h-5 w-5 items-center justify-center rounded-full bg-white/14 text-white',
  logoText: 'text-[9px] font-semibold tracking-[0.12em] text-white/82 uppercase',
  datePill: 'text-[8px] font-medium tracking-wide text-white/68',
  /** Title safe — warm dark gradient scrim, no blur */
  titleSafeZone: [
    'relative shrink-0 px-5 pb-2 pt-0',
    'before:pointer-events-none before:absolute before:inset-0 before:-inset-x-3 before:-top-1',
    'before:bg-[linear-gradient(180deg,rgba(18,8,28,var(--poster-title-scrim,0.82))_0%,rgba(18,8,28,0.45)_55%,transparent_100%)]',
  ].join(' '),
  heroTitle: [
    'relative z-[1] max-w-[17rem] line-clamp-2 text-[34px] font-bold leading-[0.92] tracking-[-0.045em] text-white',
    'max-[380px]:max-w-[15rem] max-[380px]:text-[31px]',
  ].join(' '),
  storyWrap: [
    'relative z-[1] mt-2.5 rounded-lg px-0.5 py-1',
    'before:pointer-events-none before:absolute before:-inset-x-2 before:-inset-y-0.5 before:rounded-lg',
    'before:bg-[linear-gradient(180deg,rgba(14,6,22,0.55)_0%,rgba(14,6,22,0.35)_100%)]',
  ].join(' '),
  story: [
    'relative line-clamp-2 text-[14px] font-medium leading-[1.44] text-white',
    'opacity-[var(--poster-story-opacity,0.96)]',
  ].join(' '),
  sceneAnchor: 'relative min-h-0 px-5',
  highlightAnchor:
    'pointer-events-none absolute inset-x-5 bottom-2 z-[1] flex flex-col justify-end',
  highlightWhisper: [
    'inline-flex max-w-full flex-wrap items-center gap-1.5 self-start rounded-full',
    'border border-white/14 px-2.5 py-1',
    'bg-[linear-gradient(135deg,rgba(22,10,34,0.72)_0%,rgba(14,6,22,0.65)_100%)]',
    'shadow-[0_4px_20px_rgba(0,0,0,0.35)]',
  ].join(' '),
  highlightWhisperTitle:
    'text-[7px] font-semibold uppercase tracking-[0.18em] text-white/72',
  highlightWhisperTag:
    'text-[7px] font-medium uppercase tracking-wide text-white/78',
  highlightRibbon: [
    'w-full rounded-xl border border-white/14 px-2.5 py-1.5',
    'bg-[linear-gradient(135deg,rgba(28,12,42,0.78)_0%,rgba(16,8,28,0.72)_100%)]',
    'shadow-[0_6px_24px_rgba(0,0,0,0.38)]',
  ].join(' '),
  highlightRibbonTitle:
    'mb-1 text-[7px] font-semibold uppercase tracking-[0.16em] text-white/68',
  highlightRibbonTags: 'flex flex-wrap gap-1',
  highlightRibbonTag:
    'rounded-full bg-white/[0.1] px-1.5 py-px text-[7px] font-medium uppercase tracking-wide text-white/78',
  highlightProminent: [
    'w-full rounded-xl border border-white/18 px-2.5 py-2',
    'bg-[linear-gradient(135deg,rgba(36,14,58,0.82)_0%,rgba(20,8,36,0.78)_50%,rgba(36,14,58,0.82)_100%)]',
    'shadow-[0_8px_32px_rgba(0,0,0,0.42)]',
  ].join(' '),
  highlightProminentTitle:
    'mb-1.5 text-center text-[7px] font-bold uppercase tracking-[0.18em] text-white/78',
  highlightDual: 'grid grid-cols-[1fr_auto_1fr] items-center gap-1.5',
  highlightSide: 'min-w-0',
  highlightSideLabel: 'text-[8px] font-bold leading-tight text-white',
  highlightSideHint: 'mt-0.5 line-clamp-1 text-[7px] leading-snug text-white/72',
  highlightVs:
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/16 text-[7px] font-bold text-white ring-1 ring-white/22',
  highlightTags: 'mt-1.5 flex flex-wrap justify-center gap-1',
  highlightTag:
    'rounded-full bg-white/[0.1] px-1.5 py-px text-[6px] font-semibold uppercase tracking-wide text-white/72',
  /** Bottom — cinematic warm fade, gradient only */
  bottomSafeZone: [
    'flex shrink-0 flex-col gap-2.5 px-5 pt-3 pb-2.5',
    'bg-[linear-gradient(180deg,rgba(14,6,22,0.35)_0%,rgba(10,4,18,0.88)_45%,rgba(8,4,16,0.96)_100%)]',
  ].join(' '),
  quoteText: [
    'line-clamp-2 text-center text-[13px] font-medium italic leading-[1.5] text-white',
    'opacity-[var(--poster-quote-opacity,0.88)]',
  ].join(' '),
  quoteMark: 'text-[10px] font-normal not-italic text-white/50',
  metricsRow: [
    'grid grid-cols-3 gap-2 border-t border-white/[0.1] pt-2.5',
    'bg-[linear-gradient(180deg,rgba(12,6,20,0.4)_0%,rgba(10,4,18,0.55)_100%)]',
  ].join(' '),
  relationCell: 'min-w-0 rounded-md px-1 py-0.5 text-center',
  relationLabel:
    'text-[8px] font-semibold uppercase tracking-[0.1em] text-white/62',
  relationLine: [
    'mt-0.5 line-clamp-2 text-[10.5px] font-medium leading-[1.38] text-white',
    'opacity-[var(--poster-metric-opacity,0.84)]',
  ].join(' '),
  footer:
    'flex shrink-0 items-center justify-between gap-2 px-0 pb-0 pt-1 text-[7.5px] font-semibold tracking-[0.1em] text-white/52 uppercase',
} as const;

export const posterTextShadowStyle = {
  heroTitle: { textShadow: HEADLINE_TEXT_SHADOW },
  story: { textShadow: STORY_TEXT_SHADOW },
  quoteText: { textShadow: QUOTE_TEXT_SHADOW },
  relationLine: { textShadow: METRIC_TEXT_SHADOW },
  relationLabel: { textShadow: METRIC_TEXT_SHADOW },
} as const;
