import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  advanceStyleLensSession,
  createDefaultStyleLensSession,
  resetStyleLensSessionForCard,
  resolveStyleLensSessionForCard,
  sessionMatchesCard,
  MIRROR_STYLE_LENS_STORAGE_KEY,
} from '@/lib/eza/mirror/mirrorSceneStyleLens';
import {
  DEFAULT_STYLE_LENS_ID,
  getNextStyleLensId,
} from '@/lib/eza/mirror/styleLensRegistry';

const cardA = {
  date: '2026-06-04',
  visual: { intentFingerprint: 'fp-italy-travel' },
};

const cardB = {
  date: '2026-06-04',
  visual: { intentFingerprint: 'fp-updated-data' },
};

describe('mirrorSceneStyleLens', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
    });
    localStorage.removeItem(MIRROR_STYLE_LENS_STORAGE_KEY);
  });

  it('defaults to premium_human', () => {
    const session = createDefaultStyleLensSession(cardA);
    expect(session.selectedStyleLensId).toBe(DEFAULT_STYLE_LENS_ID);
    expect(session.sceneVariationIndex).toBe(0);
  });

  it('advances Plus cycle on new scene', () => {
    let session = createDefaultStyleLensSession(cardA);
    saveAndLoad(session);
    session = advanceStyleLensSession(session);
    expect(session.selectedStyleLensId).toBe('curious_panda');
    expect(session.sceneVariationIndex).toBe(1);
    session = advanceStyleLensSession(session);
    expect(session.selectedStyleLensId).toBe('cinematic_no_character');
  });

  it('resets to premium_human when intent fingerprint changes', () => {
    let session = createDefaultStyleLensSession(cardA);
    localStorage.setItem(MIRROR_STYLE_LENS_STORAGE_KEY, JSON.stringify(session));
    session = advanceStyleLensSession(session);
    expect(session.selectedStyleLensId).toBe('curious_panda');

    const resolved = resolveStyleLensSessionForCard(cardB);
    expect(resolved.selectedStyleLensId).toBe('premium_human');
    expect(resolved.intentFingerprint).toBe('fp-updated-data');
  });

  it('resetStyleLensSessionForCard clears advanced lens', () => {
    let session = createDefaultStyleLensSession(cardA);
    session = advanceStyleLensSession(session);
    const reset = resetStyleLensSessionForCard(cardA);
    expect(reset.selectedStyleLensId).toBe('premium_human');
    expect(reset.sceneVariationIndex).toBe(0);
  });
});

function saveAndLoad(session: ReturnType<typeof createDefaultStyleLensSession>) {
  localStorage.setItem(MIRROR_STYLE_LENS_STORAGE_KEY, JSON.stringify(session));
  expect(sessionMatchesCard(session, cardA)).toBe(true);
  expect(getNextStyleLensId('premium_human')).toBe('curious_panda');
}
