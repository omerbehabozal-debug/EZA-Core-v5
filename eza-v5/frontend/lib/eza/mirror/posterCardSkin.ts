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
/** Legacy full-bleed scene layout (pre-P2). */
export const POSTER_SCENE_DOMINANCE_RATIO = 0.58;
/** P2 rev — scene window ~45% card height (dominant hero). */
export const POSTER_SCENE_WINDOW_RATIO = 0.45;

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
    `min-h-[${POSTER_INSIGHT_PREVIEW.minHeight}px] max-h-[${POSTER_INSIGHT_PREVIEW.maxHeight}px]`,
    '[grid-template-columns:repeat(3,minmax(100px,1fr))]',
  ].join(' '),
  insightCard: [
    'flex min-w-[100px] min-h-[92px] max-h-[120px] flex-col rounded-[18px] border border-white/22 px-2 py-2',
    'bg-[rgba(255,255,255,0.22)] backdrop-blur-[14px]',
    `shadow-[${POSTER_SHADOWS.glassCard}]`,
    '[writing-mode:horizontal-tb]',
  ].join(' '),
  insightIcon: 'mb-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-white/18 text-white/90',
  insightLabel: [
    'whitespace-nowrap text-[8px] font-semibold uppercase tracking-[0.12em] text-white/88',
    '[writing-mode:horizontal-tb]',
  ].join(' '),
  insightLine: [
    'mt-0.5 line-clamp-2 text-[10px] font-medium leading-[1.3] text-white/92',
    '[writing-mode:horizontal-tb] [text-orientation:mixed]',
  ].join(' '),
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

/** Sprint 12C — warm beige/violet editorial (vehicle comparison). */
export const posterCardSkinPremium = {
  ...posterCardSkin,
  globalOverlay:
    'pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-[rgba(248,246,241,0.72)] via-transparent via-[22%] to-[rgba(243,241,236,0.35)]',
  globalOverlayBottom:
    'pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[34%] bg-gradient-to-t from-[rgba(243,241,236,0.65)] via-[rgba(248,246,241,0.28)] to-transparent',
  logoMark:
    'flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(123,97,255,0.12)] text-[#7B61FF]',
  logoText:
    'text-[10px] font-semibold uppercase tracking-[0.14em] text-[#172033]/88',
  datePill: 'text-[9px] font-medium text-[#172033]/65',
  titleSafeZone: [
    'relative col-span-12',
    'before:pointer-events-none before:absolute before:inset-0 before:-inset-x-2 before:-top-1 before:z-0',
    'before:rounded-xl before:bg-[rgba(255,255,255,0.68)]',
  ].join(' '),
  heroTitle: [
    'relative z-[1] col-span-10 line-clamp-2 font-extrabold text-[#172033]',
    `text-[${POSTER_TYPE_PREVIEW.headline.size}px] leading-[${POSTER_TYPE_PREVIEW.headline.lineHeight}] tracking-[-0.04em]`,
    'max-[380px]:text-[32px]',
  ].join(' '),
  storyWrap: [
    'relative z-[1] mt-2 rounded-lg',
    'before:pointer-events-none before:absolute before:-inset-x-1 before:-inset-y-0.5 before:rounded-lg',
    'before:bg-[rgba(255,255,255,0.55)]',
  ].join(' '),
  story: [
    'relative line-clamp-2 font-medium text-[#172033]/90',
    `text-[${POSTER_TYPE_PREVIEW.story.size}px] leading-[${POSTER_TYPE_PREVIEW.story.lineHeight}]`,
  ].join(' '),
  quoteZone: [
    'relative col-span-12 flex min-h-[88px] flex-col justify-center rounded-[20px] px-2 py-2',
    'bg-[rgba(255,255,255,0.62)] border border-[rgba(123,97,255,0.12)]',
  ].join(' '),
  quoteText: [
    'line-clamp-2 text-center font-medium italic text-[#172033]/88',
    `text-[${POSTER_TYPE_PREVIEW.quote.size}px] leading-[${POSTER_TYPE_PREVIEW.quote.lineHeight}]`,
  ].join(' '),
  quoteMark: 'text-[11px] not-italic text-[#7B61FF]/45',
  highlightProminent: [
    'mb-2 w-full rounded-[18px] border border-[rgba(123,97,255,0.28)] px-2.5 py-2',
    'bg-[rgba(255,255,255,0.68)] backdrop-blur-[12px]',
    `shadow-[${POSTER_SHADOWS.glassCard}]`,
  ].join(' '),
  highlightProminentTitle:
    'mb-1.5 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-[#172033]/75',
  highlightSideLabel: 'text-[9px] font-bold leading-tight text-[#172033]',
  highlightSideHint: 'mt-0.5 line-clamp-1 text-[8px] text-[#172033]/70',
  highlightVs:
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(123,97,255,0.14)] text-[8px] font-bold text-[#7B61FF] ring-1 ring-[rgba(123,97,255,0.22)]',
  highlightTag:
    'rounded-full bg-[rgba(123,97,255,0.08)] px-1.5 py-px text-[7px] font-semibold uppercase text-[#172033]/72',
  insightCard: [
    'flex min-w-[100px] min-h-[92px] max-h-[120px] flex-col rounded-[18px] border border-[rgba(123,97,255,0.12)] px-2.5 py-2',
    'bg-[rgba(255,255,255,0.68)] backdrop-blur-[12px]',
    `shadow-[${POSTER_SHADOWS.glassCard}]`,
    '[writing-mode:horizontal-tb]',
  ].join(' '),
  insightLabel: [
    'whitespace-nowrap text-[8px] font-semibold uppercase tracking-[0.12em] text-[#172033]/78',
    '[writing-mode:horizontal-tb]',
  ].join(' '),
  insightLine: [
    'mt-0.5 line-clamp-2 text-[10px] font-medium leading-[1.35] text-[#172033]/88',
    '[writing-mode:horizontal-tb]',
  ].join(' '),
  footer: [
    'relative z-[6] col-span-12 flex items-center justify-between gap-2 pt-1',
    'text-[9px] font-semibold uppercase tracking-[0.12em] text-[#172033]/52',
  ].join(' '),
} as const;

export const posterTextShadowPremium = {
  heroTitle: { textShadow: '0 1px 10px rgba(255,255,255,0.6)' },
  story: { textShadow: '0 1px 6px rgba(255,255,255,0.45)' },
  quoteText: { textShadow: '0 1px 6px rgba(255,255,255,0.4)' },
  insightLine: { textShadow: 'none' },
  insightLabel: { textShadow: 'none' },
} as const;

export type PosterSkinTokens = {
  readonly [key: string]: string;
};

/** P2 — warm pastel identity-first card (no full-bleed dark scrim). */
export const posterCardSkinIdentity: PosterSkinTokens = {
  ...posterCardSkinPremium,
  root: [
    'relative mx-auto w-full overflow-hidden font-sans',
    'aspect-[9/16]',
    `rounded-[30px]`,
    'border border-[rgba(123,97,255,0.14)]',
    `shadow-[${POSTER_SHADOWS.mainCard}]`,
    `bg-[linear-gradient(180deg,${POSTER_COLORS.baseTop}_0%,${POSTER_COLORS.baseBottom}_55%,#EDE8F8_100%)]`,
    'eza-mirror-poster-reveal max-w-[460px]',
  ].join(' '),
  sceneBackdrop: 'hidden',
  globalOverlay: 'pointer-events-none absolute inset-0 z-[1] opacity-0',
  globalOverlayBottom: 'pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[20%] bg-gradient-to-t from-[rgba(237,232,248,0.5)] to-transparent',
  accentGlow:
    'pointer-events-none absolute right-[12%] top-[18%] z-[1] h-28 w-28 rounded-full blur-3xl bg-[rgba(155,132,255,0.22)]',
  contentStack: [
    'relative z-[4] grid h-full min-h-0 w-full gap-0',
    'px-4 pt-3 pb-3',
    'max-[380px]:px-3',
  ].join(' '),
  identityHeadlineZone:
    'col-span-12 flex min-h-0 flex-col justify-center text-left px-0.5',
  identityTodayLabel:
    'text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667085]',
  identityAvatarName:
    'line-clamp-2 text-[28px] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#172033] max-[380px]:text-[24px]',
  identityFamilyLabel:
    'mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7B61FF]/80',
  identityThemeLine: 'mt-1 line-clamp-2 text-[11px] leading-snug text-[#667085]',
  identityThemeTitle: 'font-semibold text-[#172033]/88',
  identityThemeSubtitle: 'font-medium',
  energyBadge:
    'inline-flex shrink-0 items-center gap-1 rounded-full border border-[rgba(123,97,255,0.16)] bg-white/65 px-2 py-0.5 text-[9px] font-semibold text-[#172033]/85',
  energyRing:
    'flex h-5 w-5 items-center justify-center rounded-full bg-[conic-gradient(#7B61FF_0deg,#7B61FF_var(--energy-deg,220deg),rgba(123,97,255,0.12)_var(--energy-deg,220deg))] text-[7px] font-bold text-[#172033]',
  sceneWindowZone: 'col-span-12 flex min-h-0 flex-1 flex-col',
  sceneWindowOuter:
    'relative h-full min-h-[200px] w-full flex-1 overflow-hidden rounded-[24px] border border-white/70 bg-white/35 shadow-[0_8px_32px_rgba(123,97,255,0.12)] aspect-[4/5] max-[380px]:min-h-[180px]',
  sceneWindowCaption:
    'pointer-events-none absolute inset-x-0 bottom-0 z-[3] bg-gradient-to-t from-[rgba(14,6,22,0.42)] to-transparent px-3 pb-2 pt-6 text-left',
  sceneWindowCaptionTitle: 'line-clamp-1 text-[10px] font-bold uppercase tracking-wide text-white/95',
  sceneWindowCaptionSub: 'line-clamp-1 text-[9px] font-medium text-white/75',
  sceneWindowGenerating:
    'absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1.5 bg-[linear-gradient(135deg,rgba(248,246,241,0.92)_0%,rgba(237,232,248,0.88)_100%)] backdrop-blur-[2px]',
  sceneWindowGeneratingText: 'text-[11px] font-semibold text-[#172033]/75',
  reflectionZone: 'col-span-12 flex min-h-0 flex-col gap-1.5',
  reflectionHeaderRow: 'flex items-start justify-between gap-2',
  reflectionHeadline:
    'line-clamp-1 text-[15px] font-bold leading-tight tracking-[-0.02em] text-[#172033]',
  reflectionStory: 'line-clamp-2 text-[12px] font-medium leading-[1.35] text-[#172033]/82',
  reflectionQuote:
    'line-clamp-1 text-center text-[10px] italic leading-snug text-[#667085]',
  insightsCompact: 'grid grid-cols-3 gap-1.5',
  insightCardCompact: [
    'flex min-h-[64px] flex-col rounded-[14px] border border-[rgba(123,97,255,0.1)]',
    'bg-white/58 px-1.5 py-1.5 backdrop-blur-sm',
  ].join(' '),
  insightLabelCompact:
    'text-[7px] font-bold uppercase tracking-[0.1em] text-[#7B61FF]/80',
  insightLineCompact: 'mt-0.5 line-clamp-2 text-[9px] font-medium leading-[1.25] text-[#172033]/88',
  relationshipBarsWrap: 'flex gap-1',
  relationshipBarTrack: 'h-1 flex-1 overflow-hidden rounded-full bg-[rgba(123,97,255,0.12)]',
  relationshipBarFill: 'h-full rounded-full bg-[linear-gradient(90deg,#9B84FF,#7B61FF)]',
  tomorrowZone:
    'col-span-12 rounded-[16px] border border-[rgba(126,158,142,0.25)] bg-[rgba(255,255,255,0.55)] px-2.5 py-2 text-center',
  tomorrowLabel: 'text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7E9E8E]',
  tomorrowText: 'mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-[#172033]/85',
  footer: [
    'col-span-12 flex items-center justify-between gap-2 pt-0.5',
    'text-[8px] font-semibold uppercase tracking-[0.12em] text-[#172033]/45',
  ].join(' '),
};

export type PosterSkinLayout = 'legacy_bleed' | 'identity_first';

export function getPosterCardSkin(
  palette: 'default_dark_scrim' | 'premium_light_editorial',
  layout: PosterSkinLayout = 'legacy_bleed'
): PosterSkinTokens {
  if (layout === 'identity_first') {
    return posterCardSkinIdentity;
  }
  return (palette === 'premium_light_editorial'
    ? posterCardSkinPremium
    : posterCardSkin) as PosterSkinTokens;
}
