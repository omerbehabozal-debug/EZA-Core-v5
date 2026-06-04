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

const PANEL_WARM =
  'shrink-0 flex min-h-0 flex-col justify-center text-left px-0.5 py-1 rounded-[18px] border border-amber-200/22 bg-[rgba(28,18,10,0.44)] px-2 py-2 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.18)]';
const PANEL_COOL =
  'shrink-0 flex min-h-0 flex-col justify-center text-left px-0.5 py-1 rounded-[18px] border border-slate-200/18 bg-[rgba(12,18,32,0.42)] px-2 py-2 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.16)]';
const PANEL_ROSE =
  'shrink-0 flex min-h-0 flex-col justify-center text-left px-0.5 py-1 rounded-[18px] border border-rose-200/20 bg-[rgba(32,14,18,0.4)] px-2 py-2 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.16)]';
const PANEL_DARK =
  'shrink-0 flex min-h-0 flex-col justify-center text-left px-0.5 py-1 rounded-[18px] border border-amber-100/14 bg-[rgba(14,12,10,0.48)] px-2 py-2 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]';
const PANEL_NEUTRAL =
  'shrink-0 flex min-h-0 flex-col justify-center text-left px-0.5 py-1 rounded-[18px] border border-white/14 bg-[rgba(14,10,22,0.42)] px-2 py-2 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.14)]';

const RHYTHM_WARM =
  'shrink-0 flex flex-col gap-0.5 rounded-[12px] border border-amber-200/18 bg-[rgba(24,14,8,0.4)] px-2 py-1.5 backdrop-blur-sm';
const RHYTHM_COOL =
  'shrink-0 flex flex-col gap-0.5 rounded-[12px] border border-slate-300/14 bg-[rgba(10,16,28,0.38)] px-2 py-1.5 backdrop-blur-sm';
const RHYTHM_ROSE =
  'shrink-0 flex flex-col gap-0.5 rounded-[12px] border border-rose-200/16 bg-[rgba(28,12,16,0.36)] px-2 py-1.5 backdrop-blur-sm';
const RHYTHM_DARK =
  'shrink-0 flex flex-col gap-0.5 rounded-[12px] border border-amber-100/12 bg-[rgba(10,8,8,0.44)] px-2 py-1.5 backdrop-blur-sm';
const RHYTHM_NEUTRAL =
  'shrink-0 flex flex-col gap-0.5 rounded-[12px] border border-white/10 bg-[rgba(12,8,20,0.36)] px-2 py-1.5 backdrop-blur-sm';

export const POSTER_TONE_SKIN_OVERRIDES: Record<PosterSceneToneId, Partial<PosterSkinTokens>> = {
  warm_gold: {
    overlayTopScrim: SCRIM_TOP_WARM,
    overlayBottomScrim: SCRIM_BOTTOM_WARM,
    overlayIdentity: PANEL_WARM,
    logoMark:
      'flex h-5 w-5 items-center justify-center rounded-full bg-amber-950/35 text-amber-50 backdrop-blur-sm border border-amber-200/25',
    logoText:
      'text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-50/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]',
    datePill:
      'text-[8px] font-medium text-amber-100/82 drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]',
    identityTodayLabel:
      'text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/75 drop-shadow-sm',
    identityAvatarName: [
      'line-clamp-2 text-[28px] font-extrabold leading-[1.02] tracking-[-0.03em]',
      'text-[#FFF8F0] max-[380px]:text-[24px]',
      'drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]',
    ].join(' '),
    identityMirrorMoment: [
      'mt-1.5 line-clamp-2 text-[13px] font-medium italic leading-[1.38] tracking-[-0.01em]',
      'text-[#F8F0E3]/98 max-[380px]:text-[12px]',
      'drop-shadow-[0_1px_12px_rgba(0,0,0,0.55)]',
    ].join(' '),
    identityThemeLine: 'mt-1 line-clamp-2 text-[11px] leading-snug text-amber-50/84',
    identityThemeTitle: 'font-semibold text-amber-50/95',
    identityThemeSubtitle: 'font-medium text-amber-100/72',
    rhythmWhisperZone: RHYTHM_WARM,
    rhythmWhisperEyebrow:
      'text-[7px] font-semibold uppercase tracking-[0.16em] text-amber-200/70',
    rhythmWhisperWord:
      'text-[12px] font-semibold tracking-[-0.01em] text-amber-50/90 drop-shadow-sm',
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
    overlayIdentity: PANEL_COOL,
    logoMark:
      'flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/40 text-slate-100 backdrop-blur-sm border border-slate-300/20',
    logoText:
      'text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-100/94 drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]',
    datePill: 'text-[8px] font-medium text-slate-200/80 drop-shadow-sm',
    identityTodayLabel:
      'text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300/78',
    identityAvatarName: [
      'line-clamp-2 text-[28px] font-extrabold leading-[1.02] tracking-[-0.03em]',
      'text-slate-50 max-[380px]:text-[24px]',
      'drop-shadow-[0_2px_12px_rgba(0,0,0,0.48)]',
    ].join(' '),
    identityMirrorMoment: [
      'mt-1.5 line-clamp-2 text-[13px] font-medium italic leading-[1.38]',
      'text-slate-100/95 max-[380px]:text-[12px]',
      'drop-shadow-[0_1px_10px_rgba(0,0,0,0.5)]',
    ].join(' '),
    identityThemeLine: 'mt-1 line-clamp-2 text-[11px] leading-snug text-slate-200/82',
    identityThemeTitle: 'font-semibold text-slate-50/94',
    identityThemeSubtitle: 'font-medium text-slate-300/72',
    rhythmWhisperZone: RHYTHM_COOL,
    rhythmWhisperEyebrow:
      'text-[7px] font-semibold uppercase tracking-[0.16em] text-slate-300/65',
    rhythmWhisperWord:
      'text-[12px] font-semibold tracking-[-0.01em] text-slate-100/88 drop-shadow-sm',
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
    overlayIdentity: PANEL_ROSE,
    logoMark:
      'flex h-5 w-5 items-center justify-center rounded-full bg-rose-950/35 text-rose-50 backdrop-blur-sm border border-rose-200/22',
    logoText:
      'text-[9px] font-semibold uppercase tracking-[0.14em] text-rose-50/94 drop-shadow-sm',
    datePill: 'text-[8px] font-medium text-rose-100/80',
    identityTodayLabel:
      'text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-200/72',
    identityAvatarName: [
      'line-clamp-2 text-[28px] font-extrabold leading-[1.02] tracking-[-0.03em]',
      'text-[#FFF5F2] max-[380px]:text-[24px]',
      'drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]',
    ].join(' '),
    identityMirrorMoment: [
      'mt-1.5 line-clamp-2 text-[13px] font-medium italic leading-[1.38]',
      'text-rose-50/96 max-[380px]:text-[12px]',
      'drop-shadow-[0_1px_10px_rgba(0,0,0,0.5)]',
    ].join(' '),
    identityThemeLine: 'mt-1 line-clamp-2 text-[11px] leading-snug text-rose-100/82',
    identityThemeTitle: 'font-semibold text-rose-50/92',
    identityThemeSubtitle: 'font-medium text-rose-200/70',
    rhythmWhisperZone: RHYTHM_ROSE,
    rhythmWhisperEyebrow:
      'text-[7px] font-semibold uppercase tracking-[0.16em] text-rose-200/68',
    rhythmWhisperWord:
      'text-[12px] font-semibold tracking-[-0.01em] text-rose-50/88',
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
    overlayIdentity: PANEL_DARK,
    logoMark:
      'flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-amber-50 backdrop-blur-sm border border-amber-200/18',
    logoText:
      'text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-50/96 drop-shadow-[0_1px_8px_rgba(0,0,0,0.55)]',
    datePill: 'text-[8px] font-medium text-amber-100/85 drop-shadow-sm',
    identityTodayLabel:
      'text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/78',
    identityAvatarName: [
      'line-clamp-2 text-[28px] font-extrabold leading-[1.02] tracking-[-0.03em]',
      'text-white max-[380px]:text-[24px]',
      'drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)]',
    ].join(' '),
    identityMirrorMoment: [
      'mt-1.5 line-clamp-2 text-[13px] font-medium italic leading-[1.38]',
      'text-[#F5F0E8]/98 max-[380px]:text-[12px]',
      'drop-shadow-[0_1px_12px_rgba(0,0,0,0.6)]',
    ].join(' '),
    identityThemeLine: 'mt-1 line-clamp-2 text-[11px] leading-snug text-amber-50/86',
    identityThemeTitle: 'font-semibold text-white/94',
    identityThemeSubtitle: 'font-medium text-amber-100/72',
    rhythmWhisperZone: RHYTHM_DARK,
    rhythmWhisperEyebrow:
      'text-[7px] font-semibold uppercase tracking-[0.16em] text-amber-200/68',
    rhythmWhisperWord:
      'text-[12px] font-semibold tracking-[-0.01em] text-amber-50/90',
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
    overlayIdentity: PANEL_NEUTRAL,
    rhythmWhisperZone: RHYTHM_NEUTRAL,
    rhythmWhisperEyebrow:
      'text-[7px] font-semibold uppercase tracking-[0.16em] text-white/55',
    rhythmWhisperWord:
      'text-[12px] font-semibold tracking-[-0.01em] text-white/78 drop-shadow-sm',
  },
};

export function applyPosterSceneToneSkin(
  base: PosterSkinTokens,
  toneId: PosterSceneToneId
): PosterSkinTokens {
  const overrides = POSTER_TONE_SKIN_OVERRIDES[toneId];
  return { ...base, ...(overrides as PosterSkinTokens) };
}
