/**
 * Daily Mirror poster — premium editorial mathematics (Sprint 12A).
 */

import {
  POSTER_PREVIEW_WIDTH_PX,
  POSTER_SHADOWS,
  POSTER_COLORS,
  POSTER_RADIUS_PREVIEW,
  POSTER_TYPE_PREVIEW,
  POSTER_INSIGHT_PREVIEW,
  POSTER_QUOTE_PREVIEW,
} from '@/lib/eza/mirror/posterEditorialMathematics';

export const POSTER_CARD_WIDTH_PX = POSTER_PREVIEW_WIDTH_PX;
export const POSTER_CARD_HEIGHT_PX = 768;
export const POSTER_ASPECT_RATIO = '9 / 16' as const;
export const POSTER_SCENE_DOMINANCE_RATIO = 0.58;

export const posterCardSkin = {
  root: [
    'relative mx-auto w-full overflow-hidden font-sans',
    'aspect-[9/16]',
    `rounded-[${POSTER_RADIUS_PREVIEW.card}px]`,
    'border border-white/50',
    `shadow-[${POSTER_SHADOWS.mainCard}]`,
    `bg-[linear-gradient(180deg,${POSTER_COLORS.baseTop}_0%,${POSTER_COLORS.baseBottom}_100%)]`,
    'eza-mirror-poster-reveal',
  ].join(' '),
  /** Layer 1–2: scene */
  sceneBackdrop: 'pointer-events-none absolute inset-0 z-[1]',
  sceneBreathing: 'eza-mirror-scene-breathe',
  /** Layer 3: cinematic gradients */
  globalOverlay:
    'pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-[rgba(14,6,22,0.52)] via-transparent via-[26%] to-[rgba(14,6,22,0.38)]',
  globalOverlayBottom:
    'pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[38%] bg-gradient-to-t from-[rgba(14,6,22,0.72)] via-[rgba(14,6,22,0.28)] to-transparent',
  grain:
    'pointer-events-none absolute inset-0 z-[2] opacity-[0.018] mix-blend-multiply [background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")]',
  accentGlow:
    'pointer-events-none absolute left-[var(--poster-safe-left)] top-[calc(var(--poster-safe-top)+2.5rem)] z-[2] h-24 w-40 rounded-full blur-3xl [background:var(--poster-accent-glow)]',
  /** Layer 4–6: editorial content */
  contentStack: [
    'relative z-[4] grid h-full min-h-0 w-full',
    'pt-[var(--poster-safe-top)] pb-[var(--poster-safe-bottom)]',
    'pl-[var(--poster-safe-left)] pr-[var(--poster-safe-right)]',
  ].join(' '),
  editorialGrid: 'col-span-12 grid grid-cols-12 gap-[var(--poster-grid-gap)]',
  topSafeZone: 'col-span-12 flex items-start justify-between',
  logoMark:
    'flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm',
  logoText:
    'text-[9px] font-semibold uppercase tracking-[0.14em] text-white/90 drop-shadow-sm',
  datePill: 'text-[8px] font-medium text-white/75',
  titleSafeZone: [
    'relative col-span-12',
    'before:pointer-events-none before:absolute before:inset-0 before:-inset-x-2 before:-top-1 before:z-0',
    'before:rounded-xl before:bg-[linear-gradient(180deg,rgba(14,6,22,0.62)_0%,rgba(14,6,22,0.28)_70%,transparent_100%)]',
  ].join(' '),
  heroTitle: [
    'relative z-[1] col-span-10 line-clamp-2 font-extrabold text-white',
    `text-[${POSTER_TYPE_PREVIEW.headline.size}px] leading-[${POSTER_TYPE_PREVIEW.headline.lineHeight}] tracking-[-0.04em]`,
    `max-[380px]:text-[32px]`,
  ].join(' '),
  storyWrap: [
    'relative z-[1] mt-2 rounded-lg',
    'before:pointer-events-none before:absolute before:-inset-x-1 before:-inset-y-0.5 before:rounded-lg',
    'before:bg-[linear-gradient(180deg,rgba(14,6,22,0.48)_0%,rgba(14,6,22,0.22)_100%)]',
  ].join(' '),
  story: [
    'relative line-clamp-2 font-medium text-white/95',
    `text-[${POSTER_TYPE_PREVIEW.story.size}px] leading-[${POSTER_TYPE_PREVIEW.story.lineHeight}]`,
  ].join(' '),
  sceneSpacer: 'relative col-span-12 min-h-0',
  highlightAnchor:
    'pointer-events-none absolute inset-x-0 bottom-1 z-[1] flex justify-start',
  quoteZone: [
    'relative col-span-12 flex min-h-[88px] flex-col justify-center rounded-[20px] px-1 py-2',
    'bg-[linear-gradient(180deg,rgba(14,6,22,0.32)_0%,rgba(14,6,22,0.48)_100%)]',
  ].join(' '),
  quoteText: [
    'line-clamp-2 text-center font-medium italic text-white/92',
    `text-[${POSTER_TYPE_PREVIEW.quote.size}px] leading-[${POSTER_TYPE_PREVIEW.quote.lineHeight}]`,
  ].join(' '),
  quoteMark: 'text-[11px] not-italic text-white/45',
  highlightWhisper: [
    'mb-2 inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full px-2.5 py-1',
    'border border-white/16 bg-[rgba(18,8,28,0.42)] shadow-sm backdrop-blur-[12px]',
  ].join(' '),
  highlightWhisperTitle:
    'text-[8px] font-semibold uppercase tracking-[0.16em] text-white/75',
  highlightWhisperTag: 'text-[8px] font-medium uppercase tracking-wide text-white/80',
  highlightRibbon: [
    'mb-2 w-full rounded-[18px] border border-white/14 px-2.5 py-1.5',
    'bg-[rgba(18,8,28,0.44)] backdrop-blur-[12px]',
    `shadow-[${POSTER_SHADOWS.glassCard}]`,
  ].join(' '),
  highlightRibbonTitle:
    'mb-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-white/72',
  highlightRibbonTags: 'flex flex-wrap gap-1',
  highlightRibbonTag:
    'rounded-full bg-white/10 px-1.5 py-px text-[7px] font-medium uppercase text-white/78',
  highlightProminent: [
    'mb-2 w-full rounded-[18px] border border-white/18 px-2.5 py-2',
    'bg-[linear-gradient(135deg,rgba(36,14,58,0.75)_0%,rgba(18,8,28,0.7)_100%)]',
    'backdrop-blur-[14px]',
    `shadow-[${POSTER_SHADOWS.glassCard}]`,
  ].join(' '),
  highlightProminentTitle:
    'mb-1.5 text-center text-[8px] font-bold uppercase tracking-[0.16em] text-white/80',
  highlightDual: 'grid grid-cols-[1fr_auto_1fr] items-center gap-1.5',
  highlightSide: 'min-w-0',
  highlightSideLabel: 'text-[8px] font-bold leading-tight text-white',
  highlightSideHint: 'mt-0.5 line-clamp-1 text-[7px] text-white/70',
  highlightVs:
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/14 text-[7px] font-bold text-white ring-1 ring-white/20',
  highlightTags: 'mt-1 flex flex-wrap justify-center gap-1',
  highlightTag:
    'rounded-full bg-white/10 px-1.5 py-px text-[6px] font-semibold uppercase text-white/72',
  insightsRow: [
    'col-span-12 grid grid-cols-3 gap-2',
    `min-h-[${POSTER_INSIGHT_PREVIEW.minHeight}px]`,
  ].join(' '),
  insightCard: [
    'flex min-h-[96px] flex-col rounded-[18px] border border-white/22 px-2 py-2',
    'bg-[rgba(255,255,255,0.22)] backdrop-blur-[14px]',
    `shadow-[${POSTER_SHADOWS.glassCard}]`,
  ].join(' '),
  insightIcon: 'mb-1 flex h-5 w-5 items-center justify-center rounded-md bg-white/18 text-white/90',
  insightLabel:
    'text-[8px] font-semibold uppercase tracking-[0.12em] text-white/88',
  insightLine: 'mt-0.5 line-clamp-3 text-[10px] font-medium leading-[1.35] text-white/92',
  footer: [
    'relative z-[6] col-span-12 flex items-center justify-between gap-2 pt-1',
    'text-[9px] font-semibold uppercase tracking-[0.12em] text-white/58',
  ].join(' '),
} as const;

export const posterTextShadowStyle = {
  heroTitle: { textShadow: POSTER_SHADOWS.headline },
  story: { textShadow: POSTER_SHADOWS.story },
  quoteText: { textShadow: POSTER_SHADOWS.story },
  insightLine: { textShadow: '0 1px 8px rgba(0,0,0,0.35)' },
  insightLabel: { textShadow: '0 1px 6px rgba(0,0,0,0.3)' },
} as const;
