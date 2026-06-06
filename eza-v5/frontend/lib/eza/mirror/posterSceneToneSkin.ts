/**
 * P4-C4 — adaptive skin token overrides per scene tone.
 */

import type { PosterSkinTokens } from '@/lib/eza/mirror/posterCardSkin';
import type { PosterSceneToneId } from '@/lib/eza/mirror/posterSceneTone';
import { POSTER_RHYTHM_GLASS } from '@/lib/eza/mirror/posterEditorialMathematics';

const SCRIM_TOP_WARM =
  'absolute inset-x-0 top-0 h-[36%] bg-gradient-to-b from-[rgba(14,8,4,0.68)] via-[rgba(22,12,6,0.28)] to-transparent';
const SCRIM_BOTTOM_WARM =
  'absolute inset-x-0 bottom-0 h-[54%] bg-gradient-to-t from-[rgba(8,5,4,0.9)] via-[rgba(18,10,6,0.44)] to-transparent';

const SCRIM_TOP_COOL =
  'absolute inset-x-0 top-0 h-[36%] bg-gradient-to-b from-[rgba(6,10,20,0.66)] via-[rgba(10,16,30,0.26)] to-transparent';
const SCRIM_BOTTOM_COOL =
  'absolute inset-x-0 bottom-0 h-[54%] bg-gradient-to-t from-[rgba(4,8,16,0.88)] via-[rgba(12,18,34,0.42)] to-transparent';

const SCRIM_TOP_DARK =
  'absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-[rgba(4,4,8,0.74)] via-[rgba(10,8,14,0.28)] to-transparent';
const SCRIM_BOTTOM_DARK =
  'absolute inset-x-0 bottom-0 h-[56%] bg-gradient-to-t from-[rgba(2,2,6,0.92)] via-[rgba(8,6,12,0.44)] to-transparent';

const IDENTITY_EDITORIAL = [
  'relative shrink-0 flex min-h-0 flex-col items-center justify-center text-center',
  'px-1 py-3 max-[380px]:py-2',
  'before:pointer-events-none before:absolute before:inset-x-[-8%] before:inset-y-[-10%]',
  'before:rounded-[36px] before:bg-[radial-gradient(ellipse_90%_74%_at_50%_40%,rgba(4,2,8,0.52),transparent_72%)]',
  'before:backdrop-blur-[3px]',
].join(' ');

const RHYTHM_PANEL_BASE = [
  'shrink-0 flex w-full flex-col gap-2.5 rounded-[26px] px-5 py-4',
  POSTER_RHYTHM_GLASS,
  'shadow-[0_16px_52px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.07)]',
  'max-[380px]:px-4 max-[380px]:py-3.5',
].join(' ');

const RHYTHM_WARM = [RHYTHM_PANEL_BASE, 'border border-amber-200/24'].join(' ');
const RHYTHM_COOL = [RHYTHM_PANEL_BASE, 'border border-slate-200/20'].join(' ');
const RHYTHM_ROSE = [RHYTHM_PANEL_BASE, 'border border-rose-200/22'].join(' ');
const RHYTHM_DARK = [RHYTHM_PANEL_BASE, 'border border-amber-100/18'].join(' ');
const RHYTHM_NEUTRAL = [RHYTHM_PANEL_BASE, 'border border-white/12'].join(' ');

/** Tone overrides — scrims + panel borders only; text colors stay on base identity skin. */
export const POSTER_TONE_SKIN_OVERRIDES: Record<PosterSceneToneId, Partial<PosterSkinTokens>> = {
  warm_gold: {
    overlayTopScrim: SCRIM_TOP_WARM,
    overlayBottomScrim: SCRIM_BOTTOM_WARM,
    overlayIdentity: IDENTITY_EDITORIAL,
    rhythmWhisperZone: RHYTHM_WARM,
  },
  cool_silver: {
    overlayTopScrim: SCRIM_TOP_COOL,
    overlayBottomScrim: SCRIM_BOTTOM_COOL,
    overlayIdentity: IDENTITY_EDITORIAL,
    rhythmWhisperZone: RHYTHM_COOL,
  },
  rose_warm: {
    overlayTopScrim: SCRIM_TOP_WARM,
    overlayBottomScrim: SCRIM_BOTTOM_WARM,
    overlayIdentity: IDENTITY_EDITORIAL,
    rhythmWhisperZone: RHYTHM_ROSE,
  },
  dark_gold: {
    overlayTopScrim: SCRIM_TOP_DARK,
    overlayBottomScrim: SCRIM_BOTTOM_DARK,
    overlayIdentity: IDENTITY_EDITORIAL,
    rhythmWhisperZone: RHYTHM_DARK,
  },
  neutral_silver: {
    overlayTopScrim: SCRIM_TOP_COOL,
    overlayBottomScrim: SCRIM_BOTTOM_COOL,
    overlayIdentity: IDENTITY_EDITORIAL,
    rhythmWhisperZone: RHYTHM_NEUTRAL,
  },
};

export function applyPosterSceneToneSkin(
  base: PosterSkinTokens,
  toneId: PosterSceneToneId
): PosterSkinTokens {
  const overrides = POSTER_TONE_SKIN_OVERRIDES[toneId];
  return { ...base, ...(overrides as PosterSkinTokens) };
}
