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

/** Where type choice was opened. List back returns to the contribution list. */
export type KatkiChooseFrom = 'reel' | 'list' | null;

export type KatkiDepthState = {
  stage: KatkiStage;
  slug: string;
  journeyVersion: number;
  selectedType: KatkiType | null;
  body: string;
  sourceNote: string;
  chooseFrom: KatkiChooseFrom;
};

export function closedKatkiDepth(): KatkiDepthState {
  return {
    stage: 'closed',
    slug: '',
    journeyVersion: 0,
    selectedType: null,
    body: '',
    sourceNote: '',
    chooseFrom: null,
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
    chooseFrom: null,
  };
}

export function openKatkiTypeChoice(state: KatkiDepthState): KatkiDepthState {
  if (state.stage === 'closed') return state;
  return { ...state, stage: 'choose', chooseFrom: 'list' };
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
    chooseFrom: 'reel',
  };
}

export function selectKatkiType(
  state: KatkiDepthState,
  type: KatkiType
): KatkiDepthState {
  if (state.stage === 'closed' || type === 'verify') return state;
  return {
    ...state,
    stage: 'compose',
    selectedType: type,
    // Changing category must not silently discard a user's draft.
    body: state.body,
    sourceNote: state.sourceNote,
  };
}

/** Composer back control that stays inside Katkılar and keeps the draft. */
export function returnKatkiToTypeChoice(state: KatkiDepthState): KatkiDepthState {
  if (state.stage !== 'compose') return state;
  return { ...state, stage: 'choose' };
}

/**
 * Internal back:
 * composer -> type choice
 * type choice opened from the list -> list
 * otherwise the panel closes
 */
export function escapeKatki(state: KatkiDepthState): KatkiDepthState {
  if (state.stage === 'compose') {
    return { ...state, stage: 'choose' };
  }
  if (state.stage === 'choose' && state.chooseFrom === 'list') {
    return { ...state, stage: 'list' };
  }
  return closedKatkiDepth();
}

export function closeKatki(): KatkiDepthState {
  return closedKatkiDepth();
}
