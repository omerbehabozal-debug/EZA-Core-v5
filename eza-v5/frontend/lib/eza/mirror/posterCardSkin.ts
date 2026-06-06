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
import type { PosterSceneToneId } from '@/lib/eza/mirror/posterSceneTone';
import { applyPosterSceneToneSkin } from '@/lib/eza/mirror/posterSceneToneSkin';

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

/** P4-B — full-bleed scene + glass UI overlay stack. */
export const posterCardSkinIdentity: PosterSkinTokens = {
  ...posterCardSkinPremium,
  root: [
    'relative mx-auto w-full overflow-hidden font-sans',
    'aspect-[9/16]',
    'rounded-[34px]',
    'border border-amber-300/32',
    'ring-1 ring-inset ring-amber-200/14',
    'shadow-[0_32px_96px_-28px_rgba(8,4,16,0.82),0_0_0_1px_rgba(212,175,95,0.08)]',
    'bg-[#08040f]',
    'eza-mirror-poster-reveal',
    'max-w-[var(--poster-display-max-width,100%)]',
  ].join(' '),
  sceneBackdrop: 'hidden',
  globalOverlay: 'hidden',
  globalOverlayBottom: 'hidden',
  accentGlow: 'hidden',
  fullCanvasLayer: 'pointer-events-none absolute inset-0 z-0 overflow-hidden',
  fullCanvasSceneImage: 'h-full w-full',
  fullCanvasFallback: 'absolute inset-0',
  fullCanvasGenerating: [
    'pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center gap-3',
    'bg-[radial-gradient(ellipse_80%_60%_at_50%_42%,rgba(28,16,42,0.55),rgba(6,4,12,0.82))]',
    'backdrop-blur-[6px]',
  ].join(' '),
  fullCanvasGeneratingRing: [
    'relative flex h-14 w-14 items-center justify-center rounded-full',
    'border border-amber-200/25 bg-white/[0.06] shadow-[0_0_40px_rgba(212,175,95,0.18)]',
    'before:absolute before:inset-0 before:rounded-full before:border before:border-violet-300/20',
    'before:animate-ping before:opacity-30',
  ].join(' '),
  fullCanvasGeneratingTitle:
    'text-[13px] font-semibold tracking-[0.12em] text-amber-50/92 uppercase',
  fullCanvasGeneratingText:
    'text-[11px] font-medium tracking-wide text-white/72',
  fullCanvasAwaiting: [
    'pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2.5',
    'bg-[radial-gradient(ellipse_90%_70%_at_50%_38%,rgba(36,20,56,0.42),rgba(8,5,14,0.78))]',
  ].join(' '),
  fullCanvasAwaitingTitle:
    'text-[12px] font-semibold tracking-[0.14em] text-violet-100/88 uppercase',
  fullCanvasAwaitingText:
    'text-[10px] font-medium text-white/58 tracking-wide',
  overlayScrim: 'pointer-events-none absolute inset-0 z-[1]',
  overlayTopScrim:
    'absolute inset-x-0 top-0 h-[28%] bg-gradient-to-b from-[rgba(8,4,14,0.48)] via-[rgba(10,6,18,0.12)] to-transparent',
  overlayBottomScrim:
    'absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[rgba(6,4,10,0.78)] via-[rgba(10,6,16,0.28)] to-transparent',
  grain:
    'pointer-events-none absolute inset-0 z-[2] opacity-[0.022] mix-blend-overlay [background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")]',
  overlayStack: [
    'relative z-10 flex h-full min-h-0 w-full flex-col',
    'px-6 pt-5 pb-5 max-[380px]:px-4 max-[380px]:pt-4 max-[380px]:pb-4',
  ].join(' '),
  overlayHeader:
    'shrink-0 flex items-start justify-between gap-4 pt-0.5',
  overlayIdentity: [
    'shrink-0 flex min-h-0 flex-col items-center justify-center text-center',
    'px-1 py-3 max-[380px]:py-2',
  ].join(' '),
  identityHeadlineZone:
    'shrink-0 flex min-h-0 flex-col items-center justify-center text-center px-1 py-2',
  identityTodayLabel: [
    'flex items-center justify-center',
    'text-[11px] font-medium uppercase tracking-[0.28em] text-amber-100/88',
    'drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]',
    'before:mr-2.5 before:text-[10px] before:text-amber-200/75 before:content-["✦"]',
    'after:ml-2.5 after:text-[10px] after:text-amber-200/75 after:content-["✦"]',
  ].join(' '),
  identityAvatarName: [
    'line-clamp-2 text-[clamp(1.85rem,6.8vw,3.15rem)] font-bold leading-[1.04] tracking-[-0.02em]',
    'text-[#FFF8F0] font-serif',
    'drop-shadow-[0_4px_28px_rgba(0,0,0,0.55)]',
    'max-[380px]:text-[clamp(1.65rem,7.5vw,2.35rem)]',
  ].join(' '),
  identityMirrorMoment: [
    'mt-3 line-clamp-2 text-[clamp(0.9rem,2.8vw,1.125rem)] font-medium italic leading-[1.45] tracking-[-0.01em]',
    'font-serif text-[#F8F0E3]/96 max-w-[90%]',
    'drop-shadow-[0_2px_18px_rgba(0,0,0,0.58)]',
  ].join(' '),
  identityFamilyLabel:
    'mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C4B5FD]/90',
  identityThemeLine:
    'mt-3 line-clamp-2 text-[clamp(0.75rem,2.2vw,0.875rem)] leading-snug text-white/88 max-w-[92%]',
  identityThemeTitle: 'font-semibold text-white/95',
  identityThemeSubtitle: 'font-medium text-amber-200/78',
  logoMark:
    'flex h-4 w-4 shrink-0 items-center justify-center text-amber-100/92 drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]',
  logoText: [
    'text-[10px] font-medium uppercase tracking-[0.2em] text-white/92',
    'drop-shadow-[0_2px_12px_rgba(0,0,0,0.48)]',
  ].join(' '),
  datePill: [
    'text-[10px] font-medium text-white/78 tabular-nums',
    'drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]',
  ].join(' '),
  energyBadge: [
    'inline-flex shrink-0 items-center gap-1 rounded-full border border-white/22',
    'bg-white/18 px-2 py-0.5 text-[9px] font-semibold text-white/92 backdrop-blur-md',
  ].join(' '),
  energyRing:
    'flex h-5 w-5 items-center justify-center rounded-full bg-[conic-gradient(#9B84FF_0deg,#9B84FF_var(--energy-deg,220deg),rgba(255,255,255,0.15)_var(--energy-deg,220deg))] text-[7px] font-bold text-white',
  rhythmWhisperZone: [
    'shrink-0 flex w-full flex-col gap-2.5 rounded-[26px]',
    'border border-amber-300/28 bg-[rgba(6,4,10,0.62)]',
    'px-5 py-4 backdrop-blur-2xl',
    'shadow-[0_16px_52px_rgba(0,0,0,0.34)]',
    'max-[380px]:px-4 max-[380px]:py-3.5 max-[380px]:rounded-[22px]',
  ].join(' '),
  rhythmWhisperEyebrow:
    'text-[9px] font-semibold uppercase tracking-[0.24em] text-amber-300/82',
  rhythmWhisperWord: [
    'text-[clamp(1.65rem,5.5vw,2.125rem)] font-bold leading-[1.02] tracking-[-0.02em]',
    'text-amber-100 font-serif',
    'drop-shadow-[0_2px_16px_rgba(0,0,0,0.38)]',
  ].join(' '),
  insightPanelDesc:
    'text-[13px] font-medium leading-relaxed text-white/78 max-[380px]:text-[12px]',
  insightPanelScoreDivider:
    'mx-1 text-[10px] text-amber-300/55',
  insightPanelScores:
    'mt-3 flex items-center justify-center gap-4 border-t border-amber-200/12 pt-3',
  insightPanelScoreItem:
    'flex items-center gap-2 text-[12px] font-medium text-white/88 max-[380px]:text-[11px]',
  insightPanelScoreValue:
    'tabular-nums text-[13px] font-semibold text-amber-100/96 max-[380px]:text-[12px]',
  overlayReflection: 'hidden',
  reflectionZone: 'hidden',
  reflectionHeaderRow: 'hidden',
  reflectionHeadline: 'hidden',
  reflectionStory: 'hidden',
  reflectionQuote: 'hidden',
  relationshipHeroBlock: 'hidden',
  relationshipHeroEyebrow: 'hidden',
  relationshipHeroRow: 'hidden',
  relationshipHeroTitle: 'hidden',
  relationshipHeroScore: 'hidden',
  relationshipHeroRhythm: 'hidden',
  relationshipAccentTrack: 'hidden',
  relationshipAccentFill: 'hidden',
  relationshipMicroRow: 'hidden',
  relationshipMicroLabel: 'hidden',
  relationshipMicroValue: 'hidden',
  relationshipMicroSep: 'hidden',
  insightsCompact: 'hidden',
  insightCardCompact: 'hidden',
  insightLabelCompact: 'hidden',
  insightLineCompact: 'hidden',
  relationshipBarsWrap: 'hidden',
  relationshipBarTrack: 'hidden',
  relationshipBarFill: 'hidden',
  overlayFooter: 'shrink-0',
  tomorrowWhisper:
    'line-clamp-2 text-center text-[11px] font-medium leading-snug text-white/68 drop-shadow-[0_1px_10px_rgba(0,0,0,0.35)]',
  tomorrowZone: 'hidden',
  tomorrowLabel: 'hidden',
  tomorrowText: 'hidden',
  footer: [
    'flex items-center justify-between gap-2 pt-1.5',
    'text-[9px] font-medium uppercase tracking-[0.16em] text-white/52',
  ].join(' '),
  contentStack: [
    'relative z-10 flex h-full min-h-0 w-full flex-col',
    'px-4 pt-3 pb-3 max-[380px]:px-3',
  ].join(' '),
  topSafeZone: 'shrink-0 flex items-start justify-between',
};

export type PosterSkinLayout = 'legacy_bleed' | 'identity_first';

export function getPosterCardSkin(
  palette: 'default_dark_scrim' | 'premium_light_editorial',
  layout: PosterSkinLayout = 'legacy_bleed',
  sceneToneId?: PosterSceneToneId
): PosterSkinTokens {
  if (layout === 'identity_first') {
    const base = posterCardSkinIdentity;
    return sceneToneId ? applyPosterSceneToneSkin(base, sceneToneId) : base;
  }
  return (palette === 'premium_light_editorial'
    ? posterCardSkinPremium
    : posterCardSkin) as PosterSkinTokens;
}
