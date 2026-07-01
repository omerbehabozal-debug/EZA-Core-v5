import { describe, expect, it } from 'vitest';
import { shouldSkipShareLinkPrepare } from '@/lib/eza/mirror-share/shareLinkPrepareIntent';

describe('shareLinkPrepareIntent', () => {
  it('blocks duplicate initial publish while in flight', () => {
    expect(shouldSkipShareLinkPrepare({ inFlight: true })).toBe(true);
  });

  it('allows scene refresh publish while initial publish is in flight', () => {
    expect(
      shouldSkipShareLinkPrepare({ inFlight: true, refreshScene: true })
    ).toBe(false);
  });

  it('allows publish when not in flight', () => {
    expect(shouldSkipShareLinkPrepare({ inFlight: false, refreshScene: true })).toBe(
      false
    );
  });
});
