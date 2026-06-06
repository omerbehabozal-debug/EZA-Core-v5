/**
 * P4-C4 — adaptive skin token overrides per scene tone.
 */

import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';
import type { PosterSceneToneId } from '@/lib/eza/mirror/posterSceneTone';

const SCRIM_TOP_WARM =
  'absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-[rgba(18,10,6,0.62)] via-[rgba(28,16,8,0.22)] to-transparent';
const SCRIM_BOTTOM_WARM =
  'absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-[rgba(12,8,6,0.78)] via-[rgba(24,14,8,0.36)] to-transparent';

const SCRIM_TOP_COOL =
  'absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-[rgba(8,12,22,0.58)] via-[rgba(12,18,32,0.2)] to-transparent';
const SCRIM_BOTTOM_COOL =
  'absolute inset-x-0 bottom-0 h-[50%] bg-gradient-to-t from-[rgba(6,10,18,0.76)] via-[rgba(14,20,36,0.34)] to-transparent';

const SCRIM_TOP_DARK =
  'absolute inset-x-0 top-0 h-[36%] bg-gradient-to-b from-[rgba(6,6,10,0.68)] via-[rgba(14,12,18,0.24)] to-transparent';
const SCRIM_BOTTOM_DARK =
  'absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[rgba(4,4,8,0.82)] via-[rgba(12,10,16,0.38)] to-transparent';

const IDENTITY_EDITORIAL =
  'shrink-0 flex min-h-0 flex-col items-center justify-center text-center px-1 py-3 max-[380px]:py-2';

const RHYTHM_WARM = [
  'shrink-0 flex w-full flex-col gap-2.5 rounded-[26px]',
  'border border-amber-300/30 bg-[rgba(8,5,10,0.64)]',
  'px-5 py-4 backdrop-blur-2xl shadow-[0_16px_52px_rgba(0,0,0,0.34)]',
  'max-[380px]:px-4 max-[380px]:py-3.5',
].join(' ');
const RHYTHM_COOL = [
  'shrink-0 flex w-full flex-col gap-2.5 rounded-[26px]',
  'border border-slate-300/22 bg-[rgba(6,10,18,0.62)]',
  'px-5 py-4 backdrop-blur-2xl shadow-[0_16px_52px_rgba(0,0,0,0.32)]',
  'max-[380px]:px-4 max-[380px]:py-3.5',
].join(' ');
const RHYTHM_ROSE = [
  'shrink-0 flex w-full flex-col gap-2.5 rounded-[26px]',
  'border border-rose-300/24 bg-[rgba(12,6,10,0.6)]',
  'px-5 py-4 backdrop-blur-2xl shadow-[0_16px_52px_rgba(0,0,0,0.32)]',
  'max-[380px]:px-4 max-[380px]:py-3.5',
].join(' ');
const RHYTHM_DARK = [
  'shrink-0 flex w-full flex-col gap-2.5 rounded-[26px]',
  'border border-amber-200/22 bg-[rgba(4,4,8,0.68)]',
  'px-5 py-4 backdrop-blur-2xl shadow-[0_16px_52px_rgba(0,0,0,0.36)]',
  'max-[380px]:px-4 max-[380px]:py-3.5',
].join(' ');
const RHYTHM_NEUTRAL = [
  'shrink-0 flex w-full flex-col gap-2.5 rounded-[26px]',
  'border border-white/14 bg-[rgba(8,6,14,0.58)]',
  'px-5 py-4 backdrop-blur-2xl shadow-[0_16px_52px_rgba(0,0,0,0.3)]',
  'max-[380px]:px-4 max-[380px]:py-3.5',
].join(' ');

export const POSTER_TONE_SKIN_OVERRIDES: Record<PosterSceneToneId, Partial<PosterSkinTokens>> = {
  warm_gold: {
    overlayTopScrim: SCRIM_TOP_WARM,
    overlayBottomScrim: SCRIM_BOTTOM_WARM,
    overlayIdentity: IDENTITY_EDITORIAL,
    logoMark:
      'flex h-4 w-4 shrink-0 items-center justify-center text-amber-100/92 drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]',
    logoText:
      'text-[10px] font-medium uppercase tracking-[0.2em] text-amber-50/94 drop-shadow-[0_2px_12px_rgba(0,0,0,0.48)]',
    datePill:
      'text-[10px] font-medium text-amber-100/80 tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]',
    identityTodayLabel:
      'flex items-center justify-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.28em] text-amber-200/85 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]',
    identityAvatarName: [
      'line-clamp-2 text-[clamp(1.85rem,6.8vw,3.15rem)] font-bold leading-[1.04] tracking-[-0.02em]',
      'text-[#FFF8F0] font-serif max-[380px]:text-[clamp(1.65rem,7.5vw,2.35rem)]',
      'drop-shadow-[0_4px_28px_rgba(0,0,0,0.55)]',
    ].join(' '),
    identityMirrorMoment: [
      'mt-3 line-clamp-2 text-[clamp(0.9rem,2.8vw,1.125rem)] font-medium italic leading-[1.45]',
      'font-serif text-[#F8F0E3]/98 max-[380px]:text-[0.9rem]',
      'drop-shadow-[0_2px_18px_rgba(0,0,0,0.58)]',
    ].join(' '),
    identityThemeLine: 'mt-3 line-clamp-2 text-[clamp(0.75rem,2.2vw,0.875rem)] leading-snug text-amber-50/88',
    identityThemeTitle: 'font-semibold text-white/95',
    identityThemeSubtitle: 'font-medium text-amber-200/78',
    rhythmWhisperZone: RHYTHM_WARM,
    rhythmWhisperEyebrow:
      'text-[9px] font-semibold uppercase tracking-[0.24em] text-amber-300/82',
    rhythmWhisperWord: [
      'text-[clamp(1.65rem,5.5vw,2.125rem)] font-bold leading-[1.02] tracking-[-0.02em]',
      'text-amber-100 font-serif drop-shadow-[0_2px_16px_rgba(0,0,0,0.38)]',
    ].join(' '),
    tomorrowWhisper:
      'line-clamp-2 text-center text-[9px] font-medium leading-snug text-amber-100/68 drop-shadow-sm',
    footer: [
      'flex items-center justify-between gap-2 pt-0.5',
      'text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-100/62',
    ].join(' '),
  },
  cool_silver: {
    overlayTopScrim: SCRIM_TOP_COOL,
    overlayBottomScrim: SCRIM_BOTTOM_COOL,
    overlayIdentity: IDENTITY_EDITORIAL,
    logoMark:
      'flex h-4 w-4 shrink-0 items-center justify-center text-slate-100/92 drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]',
    logoText:
      'text-[10px] font-medium uppercase tracking-[0.2em] text-slate-100/94 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]',
    datePill:
      'text-[10px] font-medium text-slate-200/80 tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.42)]',
    identityTodayLabel:
      'flex items-center justify-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-300/82',
    identityAvatarName: [
      'line-clamp-2 text-[clamp(1.85rem,6.8vw,3.15rem)] font-bold leading-[1.04] tracking-[-0.02em]',
      'text-slate-50 font-serif max-[380px]:text-[clamp(1.65rem,7.5vw,2.35rem)]',
      'drop-shadow-[0_4px_28px_rgba(0,0,0,0.52)]',
    ].join(' '),
    identityMirrorMoment: [
      'mt-3 line-clamp-2 text-[clamp(0.9rem,2.8vw,1.125rem)] font-medium italic leading-[1.45]',
      'font-serif text-slate-100/96 max-[380px]:text-[0.9rem]',
      'drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]',
    ].join(' '),
    identityThemeLine:
      'mt-3 line-clamp-2 text-[clamp(0.75rem,2.2vw,0.875rem)] leading-snug text-slate-200/86',
    identityThemeTitle: 'font-semibold text-slate-50/94',
    identityThemeSubtitle: 'font-medium text-slate-300/74',
    rhythmWhisperZone: RHYTHM_COOL,
    rhythmWhisperEyebrow:
      'text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-300/78',
    rhythmWhisperWord: [
      'text-[clamp(1.65rem,5.5vw,2.125rem)] font-bold leading-[1.02] tracking-[-0.02em]',
      'text-slate-100 font-serif drop-shadow-[0_2px_16px_rgba(0,0,0,0.36)]',
    ].join(' '),
    tomorrowWhisper:
      'line-clamp-2 text-center text-[9px] font-medium leading-snug text-slate-300/62',
    footer: [
      'flex items-center justify-between gap-2 pt-0.5',
      'text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400/58',
    ].join(' '),
  },
  rose_warm: {
    overlayTopScrim: SCRIM_TOP_WARM,
    overlayBottomScrim: SCRIM_BOTTOM_WARM,
    overlayIdentity: IDENTITY_EDITORIAL,
    logoMark:
      'flex h-4 w-4 shrink-0 items-center justify-center text-rose-100/92 drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)]',
    logoText:
      'text-[10px] font-medium uppercase tracking-[0.2em] text-rose-50/94 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]',
    datePill:
      'text-[10px] font-medium text-rose-100/80 tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.42)]',
    identityTodayLabel:
      'flex items-center justify-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.28em] text-rose-200/82',
    identityAvatarName: [
      'line-clamp-2 text-[clamp(1.85rem,6.8vw,3.15rem)] font-bold leading-[1.04] tracking-[-0.02em]',
      'text-[#FFF5F2] font-serif max-[380px]:text-[clamp(1.65rem,7.5vw,2.35rem)]',
      'drop-shadow-[0_4px_28px_rgba(0,0,0,0.5)]',
    ].join(' '),
    identityMirrorMoment: [
      'mt-3 line-clamp-2 text-[clamp(0.9rem,2.8vw,1.125rem)] font-medium italic leading-[1.45]',
      'font-serif text-rose-50/96 max-[380px]:text-[0.9rem]',
      'drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]',
    ].join(' '),
    identityThemeLine:
      'mt-3 line-clamp-2 text-[clamp(0.75rem,2.2vw,0.875rem)] leading-snug text-rose-100/86',
    identityThemeTitle: 'font-semibold text-rose-50/94',
    identityThemeSubtitle: 'font-medium text-rose-200/76',
    rhythmWhisperZone: RHYTHM_ROSE,
    rhythmWhisperEyebrow:
      'text-[9px] font-semibold uppercase tracking-[0.24em] text-rose-300/78',
    rhythmWhisperWord: [
      'text-[clamp(1.65rem,5.5vw,2.125rem)] font-bold leading-[1.02] tracking-[-0.02em]',
      'text-rose-50 font-serif drop-shadow-[0_2px_16px_rgba(0,0,0,0.36)]',
    ].join(' '),
    tomorrowWhisper:
      'line-clamp-2 text-center text-[9px] font-medium leading-snug text-rose-100/65',
    footer: [
      'flex items-center justify-between gap-2 pt-0.5',
      'text-[8px] font-semibold uppercase tracking-[0.12em] text-rose-200/58',
    ].join(' '),
  },
  dark_gold: {
    overlayTopScrim: SCRIM_TOP_DARK,
    overlayBottomScrim: SCRIM_BOTTOM_DARK,
    overlayIdentity: IDENTITY_EDITORIAL,
    logoMark:
      'flex h-4 w-4 shrink-0 items-center justify-center text-amber-100/92 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]',
    logoText:
      'text-[10px] font-medium uppercase tracking-[0.2em] text-amber-50/96 drop-shadow-[0_2px_12px_rgba(0,0,0,0.52)]',
    datePill:
      'text-[10px] font-medium text-amber-100/85 tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.48)]',
    identityTodayLabel:
      'flex items-center justify-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.28em] text-amber-200/82',
    identityAvatarName: [
      'line-clamp-2 text-[clamp(1.85rem,6.8vw,3.15rem)] font-bold leading-[1.04] tracking-[-0.02em]',
      'text-white font-serif max-[380px]:text-[clamp(1.65rem,7.5vw,2.35rem)]',
      'drop-shadow-[0_4px_28px_rgba(0,0,0,0.58)]',
    ].join(' '),
    identityMirrorMoment: [
      'mt-3 line-clamp-2 text-[clamp(0.9rem,2.8vw,1.125rem)] font-medium italic leading-[1.45]',
      'font-serif text-[#F5F0E8]/98 max-[380px]:text-[0.9rem]',
      'drop-shadow-[0_2px_18px_rgba(0,0,0,0.6)]',
    ].join(' '),
    identityThemeLine:
      'mt-3 line-clamp-2 text-[clamp(0.75rem,2.2vw,0.875rem)] leading-snug text-amber-50/88',
    identityThemeTitle: 'font-semibold text-white/94',
    identityThemeSubtitle: 'font-medium text-amber-200/76',
    rhythmWhisperZone: RHYTHM_DARK,
    rhythmWhisperEyebrow:
      'text-[9px] font-semibold uppercase tracking-[0.24em] text-amber-300/78',
    rhythmWhisperWord: [
      'text-[clamp(1.65rem,5.5vw,2.125rem)] font-bold leading-[1.02] tracking-[-0.02em]',
      'text-amber-50 font-serif drop-shadow-[0_2px_16px_rgba(0,0,0,0.4)]',
    ].join(' '),
    tomorrowWhisper:
      'line-clamp-2 text-center text-[9px] font-medium leading-snug text-amber-100/65',
    footer: [
      'flex items-center justify-between gap-2 pt-0.5',
      'text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-100/60',
    ].join(' '),
  },
  neutral_silver: {
    overlayTopScrim: SCRIM_TOP_COOL,
    overlayBottomScrim: SCRIM_BOTTOM_COOL,
    overlayIdentity: IDENTITY_EDITORIAL,
    rhythmWhisperZone: RHYTHM_NEUTRAL,
    rhythmWhisperEyebrow:
      'text-[9px] font-semibold uppercase tracking-[0.24em] text-white/62',
    rhythmWhisperWord: [
      'text-[clamp(1.65rem,5.5vw,2.125rem)] font-bold leading-[1.02] tracking-[-0.02em]',
      'text-white/92 font-serif drop-shadow-[0_2px_16px_rgba(0,0,0,0.36)]',
    ].join(' '),
  },
};

export function applyPosterSceneToneSkin(
  base: PosterSkinTokens,
  toneId: PosterSceneToneId
): PosterSkinTokens {
  const overrides = POSTER_TONE_SKIN_OVERRIDES[toneId];
  return { ...base, ...(overrides as PosterSkinTokens) };
}
