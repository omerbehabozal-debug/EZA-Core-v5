import { describe, expect, it } from 'vitest';
import {
  SAINA_MOBILE_MIRROR_CTA_AFTER_RESPONSE,
  SAINA_MOBILE_MIRROR_CTA_EMPTY,
  SAINA_MOBILE_MIRROR_CTA_SIGNAL_READY,
} from '@/lib/eza/sainaCopy';
import {
  getMirrorMobileCtaLabel,
  resolveMirrorMobileState,
} from '@/lib/eza/mirrorMobileState';

describe('mirrorMobileState', () => {
  it('returns empty when no assistant response or signal', () => {
    expect(
      resolveMirrorMobileState(
        { hasAssistantResponse: false, hasMirrorSignal: false },
        false
      )
    ).toBe('empty');
  });

  it('returns after_first_response when assistant replied without signal', () => {
    expect(
      resolveMirrorMobileState(
        { hasAssistantResponse: true, hasMirrorSignal: false },
        false
      )
    ).toBe('after_first_response');
  });

  it('returns signal_ready when mirror signal exists', () => {
    expect(
      resolveMirrorMobileState(
        { hasAssistantResponse: true, hasMirrorSignal: true },
        false
      )
    ).toBe('signal_ready');
  });

  it('returns panel_open when inline panel is open', () => {
    expect(
      resolveMirrorMobileState(
        { hasAssistantResponse: true, hasMirrorSignal: true },
        true
      )
    ).toBe('panel_open');
  });

  it('maps CTA labels per visible state', () => {
    expect(getMirrorMobileCtaLabel('empty')).toBe(SAINA_MOBILE_MIRROR_CTA_EMPTY);
    expect(getMirrorMobileCtaLabel('after_first_response')).toBe(
      SAINA_MOBILE_MIRROR_CTA_AFTER_RESPONSE
    );
    expect(getMirrorMobileCtaLabel('signal_ready')).toBe(
      SAINA_MOBILE_MIRROR_CTA_SIGNAL_READY
    );
  });
});
