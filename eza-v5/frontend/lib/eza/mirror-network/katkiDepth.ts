/**
 * Desktop Katkılar depth. Local to one frozen Yansı.
 * URL depth stays reel | chat. These stages never coexist with chat.
 */

export const KATKI_TYPES = [
  'verify',
  'correction',
  'additional_information',
  'different_perspective',
] as const;

export type KatkiType = (typeof KATKI_TYPES)[number];

export type KatkiStage = 'closed' | 'list' | 'choose' | 'compose';

export type KatkiDepthState = {
  stage: KatkiStage;
  slug: string;
  journeyVersion: number;
  selectedType: KatkiType | null;
  body: string;
  sourceNote: string;
};

export function closedKatkiDepth(): KatkiDepthState {
  return {
    stage: 'closed',
    slug: '',
    journeyVersion: 0,
    selectedType: null,
    body: '',
    sourceNote: '',
  };
}

export function katkiOwnsWheel(stage: KatkiStage): boolean {
  return stage !== 'closed';
}

export function openKatkiList(
  slug: string,
  journeyVersion: number
): KatkiDepthState {
  return {
    stage: 'list',
    slug: slug.trim().toLowerCase(),
    journeyVersion,
    selectedType: null,
    body: '',
    sourceNote: '',
  };
}

export function openKatkiTypeChoice(state: KatkiDepthState): KatkiDepthState {
  if (state.stage === 'closed') return state;
  return { ...state, stage: 'choose' };
}

/** Reel zero-state entry. Opens type choice without passing through an empty list. */
export function openKatkiChoose(slug: string, journeyVersion: number): KatkiDepthState {
  return {
    stage: 'choose',
    slug: slug.trim().toLowerCase(),
    journeyVersion,
    selectedType: null,
    body: '',
    sourceNote: '',
  };
}

export function selectKatkiType(
  state: KatkiDepthState,
  type: KatkiType
): KatkiDepthState {
  if (state.stage === 'closed') return state;
  const same = state.selectedType === type;
  return {
    ...state,
    stage: 'compose',
    selectedType: type,
    body: same ? state.body : '',
    sourceNote: same ? state.sourceNote : '',
  };
}

/** Composer back control that stays inside Katkılar and keeps the draft. */
export function returnKatkiToTypeChoice(state: KatkiDepthState): KatkiDepthState {
  if (state.stage !== 'compose') return state;
  return { ...state, stage: 'choose' };
}

/**
 * Escape/back hierarchy:
 * composer or type choice -> Katkılar list
 * Katkılar list -> Reel
 */
export function escapeKatki(state: KatkiDepthState): KatkiDepthState {
  if (state.stage === 'compose' || state.stage === 'choose') {
    return { ...state, stage: 'list' };
  }
  return closedKatkiDepth();
}
