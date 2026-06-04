/**
 * P4-C4 — share-only poster tokens (cinematic story; not in-app dashboard glass).
 */

import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';
import { POSTER_CARD_WIDTH_PX } from '@/lib/eza/mirror/posterCardSkin';
import type { PosterSceneToneId } from '@/lib/eza/mirror/posterSceneTone';
import { applySharePosterToneSkin } from '@/lib/eza/mirror/sharePosterToneSkin';

export const SHARE_POSTER_WIDTH_PX = POSTER_CARD_WIDTH_PX;

const SCRIM_TOP_BASE =
  'absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-[rgba(8,6,10,0.5)] via-[rgba(12,8,14,0.12)] to-transparent';
const SCRIM_BOTTOM_BASE =
  'absolute inset-x-0 bottom-0 h-[32%] bg-gradient-to-t from-[rgba(6,4,8,0.72)] via-[rgba(14,10,12,0.28)] to-transparent';

/** Minimal tokens for FullCanvasScene + share overlay typography. */
export const sharePosterSkinBase: PosterSkinTokens = {
  root: [
    'relative mx-auto w-full overflow-hidden font-sans',
    'aspect-[9/16]',
    'rounded-[30px]',
    'border border-white/18',
    'bg-[#0a0614]',
    'shadow-[0_24px_64px_-20px_rgba(0,0,0,0.55)]',
  ].join(' '),
  fullCanvasLayer: 'pointer-events-none absolute inset-0 z-0 overflow-hidden',
  fullCanvasSceneImage: 'h-full w-full',
  fullCanvasFallback: 'absolute inset-0',
  fullCanvasGenerating: [
    'pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1.5',
    'bg-[rgba(10,6,20,0.28)]',
  ].join(' '),
  fullCanvasGeneratingText:
    'text-[11px] font-semibold text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]',
  overlayScrim: 'pointer-events-none absolute inset-0 z-[1]',
  overlayTopScrim: SCRIM_TOP_BASE,
  overlayBottomScrim: SCRIM_BOTTOM_BASE,
  grain:
    'pointer-events-none absolute inset-0 z-[2] opacity-[0.018] mix-blend-overlay [background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")]',
  overlayStack: [
    'relative z-10 flex h-full min-h-0 w-full flex-col',
    'pointer-events-none',
  ].join(' '),
  shareMasthead: [
    'shrink-0 flex items-center justify-between gap-2',
    'px-6 pt-6',
    'text-[9px] font-semibold uppercase tracking-[0.14em]',
    'text-white/75',
  ].join(' '),
  shareMastheadBrand: 'drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]',
  shareMastheadDate: 'text-[9px] font-medium text-white/70 drop-shadow-sm',
  shareIdentityZone: [
    'shrink-0 flex min-h-0 flex-col justify-end text-left',
    'mx-6 mb-2 max-w-[88%]',
    'px-0 py-0',
  ].join(' '),
  shareAvatarName: [
    'line-clamp-2 text-[40px] font-extrabold leading-[0.98] tracking-[-0.03em]',
    'text-[#FFF8F0]',
    'drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)]',
  ].join(' '),
  shareMirrorMoment: [
    'mt-2 line-clamp-2 text-[16px] font-medium italic leading-[1.35] tracking-[-0.01em]',
    'text-[#F8F0E3]/96',
    'drop-shadow-[0_1px_12px_rgba(0,0,0,0.6)]',
  ].join(' '),
  shareThemeLine: 'mt-1.5 line-clamp-2 text-[12px] leading-snug text-white/82',
  shareThemeTitle: 'font-semibold text-amber-50/92',
  shareThemeSubtitle: 'font-medium text-amber-100/68',
  shareFooter: [
    'shrink-0 flex items-center justify-between gap-2',
    'px-6 pb-6 pt-1',
    'text-[8px] font-semibold uppercase tracking-[0.12em] text-white/65',
    'drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]',
  ].join(' '),
  overlayHeader: 'hidden',
  overlayIdentity: 'hidden',
  overlayFooter: 'hidden',
  overlayReflection: 'hidden',
  rhythmWhisperZone: 'hidden',
  tomorrowWhisper: 'hidden',
  footer: 'hidden',
};

export function getSharePosterSkin(toneId?: PosterSceneToneId): PosterSkinTokens {
  return toneId ? applySharePosterToneSkin(sharePosterSkinBase, toneId) : sharePosterSkinBase;
}
