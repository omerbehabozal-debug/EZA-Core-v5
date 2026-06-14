import {
  SAINA_MOBILE_MIRROR_CTA_AFTER_RESPONSE,
  SAINA_MOBILE_MIRROR_CTA_EMPTY,
  SAINA_MOBILE_MIRROR_CTA_SIGNAL_READY,
} from '@/lib/eza/sainaCopy';

export type MirrorMobileState =
  | 'empty'
  | 'after_first_response'
  | 'signal_ready'
  | 'panel_open';

export type MirrorMobileContext = {
  /** At least one assistant message in the active chat. */
  hasAssistantResponse: boolean;
  /** Behavioral entry, observation, or mirror cue captured in the chat. */
  hasMirrorSignal: boolean;
};

export const DEFAULT_MIRROR_MOBILE_CONTEXT: MirrorMobileContext = {
  hasAssistantResponse: false,
  hasMirrorSignal: false,
};

export function resolveMirrorMobileState(
  context: MirrorMobileContext,
  panelOpen: boolean
): MirrorMobileState {
  if (panelOpen) return 'panel_open';
  if (context.hasMirrorSignal) return 'signal_ready';
  if (context.hasAssistantResponse) return 'after_first_response';
  return 'empty';
}

export function getMirrorMobileCtaLabel(state: Exclude<MirrorMobileState, 'panel_open'>): string {
  switch (state) {
    case 'signal_ready':
      return SAINA_MOBILE_MIRROR_CTA_SIGNAL_READY;
    case 'after_first_response':
      return SAINA_MOBILE_MIRROR_CTA_AFTER_RESPONSE;
    case 'empty':
    default:
      return SAINA_MOBILE_MIRROR_CTA_EMPTY;
  }
}
