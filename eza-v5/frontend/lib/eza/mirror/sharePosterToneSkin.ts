/**
 * P4-C4 — adaptive tone overrides for share poster (warm cream / cool pearl).
 */

import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';
import type { PosterSceneToneId } from '@/lib/eza/mirror/posterSceneTone';

const SCRIM_TOP_WARM =
  'absolute inset-x-0 top-0 h-[20%] bg-gradient-to-b from-[rgba(16,8,4,0.48)] via-[rgba(24,14,8,0.1)] to-transparent';
const SCRIM_BOTTOM_WARM =
  'absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-[rgba(8,5,4,0.78)] via-[rgba(20,12,8,0.3)] to-transparent';

const SCRIM_TOP_COOL =
  'absolute inset-x-0 top-0 h-[20%] bg-gradient-to-b from-[rgba(6,10,18,0.46)] via-[rgba(10,16,28,0.1)] to-transparent';
const SCRIM_BOTTOM_COOL =
  'absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-[rgba(4,8,14,0.76)] via-[rgba(12,18,32,0.28)] to-transparent';

const SCRIM_TOP_DARK =
  'absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-[rgba(4,4,8,0.55)] via-[rgba(10,8,12,0.14)] to-transparent';
const SCRIM_BOTTOM_DARK =
  'absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-[rgba(2,2,6,0.82)] via-[rgba(10,8,10,0.34)] to-transparent';

export const SHARE_POSTER_TONE_OVERRIDES: Record<PosterSceneToneId, Partial<PosterSkinTokens>> = {
  warm_gold: {
    root: 'relative mx-auto w-full overflow-hidden font-sans aspect-[9/16] rounded-[30px] border border-amber-200/15 bg-[#0a0614] shadow-[0_24px_64px_-20px_rgba(0,0,0,0.55)]',
    overlayTopScrim: SCRIM_TOP_WARM,
    overlayBottomScrim: SCRIM_BOTTOM_WARM,
    shareMasthead: [
      'shrink-0 flex items-center justify-between gap-2 px-6 pt-6',
      'text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-50/78',
    ].join(' '),
    shareMastheadDate: 'text-[9px] font-medium text-amber-100/72 drop-shadow-sm',
    shareAvatarName: [
      'line-clamp-2 text-[40px] font-extrabold leading-[0.98] tracking-[-0.03em]',
      'text-[#FFF8F0]',
      'drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)]',
    ].join(' '),
    shareMirrorMoment: [
      'mt-2 line-clamp-2 text-[16px] font-medium italic leading-[1.35]',
      'text-[#F8F0E3]/98',
      'drop-shadow-[0_1px_12px_rgba(0,0,0,0.6)]',
    ].join(' '),
    shareThemeLine: 'mt-1.5 line-clamp-2 text-[12px] leading-snug text-amber-50/84',
    shareThemeTitle: 'font-semibold text-amber-50/95',
    shareThemeSubtitle: 'font-medium text-amber-100/70',
    shareFooter: [
      'shrink-0 flex items-center justify-between gap-2 px-6 pb-6 pt-1',
      'text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-100/68',
      'drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]',
    ].join(' '),
  },
  cool_silver: {
    overlayTopScrim: SCRIM_TOP_COOL,
    overlayBottomScrim: SCRIM_BOTTOM_COOL,
    shareMasthead: [
      'shrink-0 flex items-center justify-between gap-2 px-6 pt-6',
      'text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-200/76',
    ].join(' '),
    shareAvatarName: [
      'line-clamp-2 text-[40px] font-extrabold leading-[0.98] tracking-[-0.03em]',
      'text-slate-50',
      'drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]',
    ].join(' '),
    shareMirrorMoment: [
      'mt-2 line-clamp-2 text-[16px] font-medium italic leading-[1.35]',
      'text-slate-100/96',
      'drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)]',
    ].join(' '),
    shareThemeLine: 'mt-1.5 line-clamp-2 text-[12px] leading-snug text-slate-200/80',
    shareThemeTitle: 'font-semibold text-slate-50/94',
    shareThemeSubtitle: 'font-medium text-slate-300/68',
    shareFooter: [
      'shrink-0 flex items-center justify-between gap-2 px-6 pb-6 pt-1',
      'text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-300/62',
    ].join(' '),
  },
  rose_warm: {
    overlayTopScrim: SCRIM_TOP_WARM,
    overlayBottomScrim: SCRIM_BOTTOM_WARM,
    shareAvatarName: [
      'line-clamp-2 text-[40px] font-extrabold leading-[0.98] tracking-[-0.03em]',
      'text-[#FFF5F2]',
      'drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]',
    ].join(' '),
    shareMirrorMoment: [
      'mt-2 line-clamp-2 text-[16px] font-medium italic leading-[1.35]',
      'text-rose-50/96',
    ].join(' '),
    shareThemeTitle: 'font-semibold text-rose-50/92',
    shareThemeSubtitle: 'font-medium text-rose-100/68',
  },
  dark_gold: {
    root: 'relative mx-auto w-full overflow-hidden font-sans aspect-[9/16] rounded-[30px] border border-amber-100/12 bg-[#060508] shadow-[0_24px_64px_-20px_rgba(0,0,0,0.6)]',
    overlayTopScrim: SCRIM_TOP_DARK,
    overlayBottomScrim: SCRIM_BOTTOM_DARK,
    shareMasthead: [
      'shrink-0 flex items-center justify-between gap-2 px-6 pt-6',
      'text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-50/72',
    ].join(' '),
    shareAvatarName: [
      'line-clamp-2 text-[40px] font-extrabold leading-[0.98] tracking-[-0.03em]',
      'text-[#F5F0E8]',
      'drop-shadow-[0_2px_18px_rgba(0,0,0,0.62)]',
    ].join(' '),
    shareMirrorMoment: [
      'mt-2 line-clamp-2 text-[16px] font-medium italic leading-[1.35]',
      'text-amber-50/94',
    ].join(' '),
    shareThemeTitle: 'font-semibold text-amber-50/90',
    shareFooter: [
      'shrink-0 flex items-center justify-between gap-2 px-6 pb-6 pt-1',
      'text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-100/60',
    ].join(' '),
  },
  neutral_silver: {
    overlayTopScrim: SCRIM_TOP_COOL,
    overlayBottomScrim: SCRIM_BOTTOM_COOL,
  },
};

export function applySharePosterToneSkin(
  base: PosterSkinTokens,
  toneId: PosterSceneToneId
): PosterSkinTokens {
  const overrides = SHARE_POSTER_TONE_OVERRIDES[toneId];
  return { ...base, ...(overrides as PosterSkinTokens) };
}
