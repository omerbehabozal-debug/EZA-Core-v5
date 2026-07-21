/**
 * Mirror benchmark mode + retired Style Lens injection.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enableMirrorBenchmarkMode,
  disableMirrorBenchmarkMode,
  isMirrorBenchmarkMode,
  MIRROR_BENCHMARK_NEUTRAL_LENS_ID,
} from '@/lib/eza/mirror/mirrorBenchmarkMode';
import {
  advanceStyleLensSession,
  createDefaultStyleLensSession,
  resolveLensForGeneration,
} from '@/lib/eza/mirror/mirrorSceneStyleLens';
import {
  applyStyleLensToVisual,
  withSceneVariationSeed,
} from '@/lib/eza/mirror/styleLensPrompt';
import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';

describe('mirrorBenchmarkMode style lens', () => {
  beforeEach(() => {
    disableMirrorBenchmarkMode();
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.stubGlobal('window', {
      localStorage: globalThis.localStorage,
      location: { search: '' },
    });
  });

  it('forces cinematic_no_character when benchmark enabled', () => {
    enableMirrorBenchmarkMode();
    expect(isMirrorBenchmarkMode()).toBe(true);
    const session = createDefaultStyleLensSession({
      date: '2026-07-19',
      visual: { intentFingerprint: 'fp' } as MirrorVisualPromptPayload,
    });
    expect(session.selectedStyleLensId).toBe(MIRROR_BENCHMARK_NEUTRAL_LENS_ID);
    const resolved = resolveLensForGeneration(true, session);
    expect(resolved.lensId).toBe('cinematic_no_character');
  });

  it('advance bumps variation only (no panda rotation)', () => {
    enableMirrorBenchmarkMode();
    const session = createDefaultStyleLensSession({
      date: '2026-07-19',
      visual: { intentFingerprint: 'fp' } as MirrorVisualPromptPayload,
    });
    const next = advanceStyleLensSession(session);
    expect(next.selectedStyleLensId).toBe('cinematic_no_character');
    expect(next.sceneVariationIndex).toBe(1);
  });

  it('never injects panda/human into generate prompt', () => {
    const visual: MirrorVisualPromptPayload = {
      characterId: 'saina',
      characterName: 'SAINA',
      personaFamilyId: 'balanced_calm',
      topicLabel: 'travel',
      atmosphereLabel: 'x',
      emotionLabel: 'calm',
      prompt:
        'Create a natural editorial scene with no text. CATEGORY:\ntravel\nVISUAL NARRATIVE:\nMardin stone terrace.',
      negativePrompt: 'text',
      stylePreset: 'eza_mirror_professional_v1',
      promptContract: 'saina_mirror_v5_minimal',
      seedHint: 'seed',
      qualityHints: [],
      sceneIntentLabel: 'travel',
      intentFingerprint: 'fp',
    };
    for (const lens of ['curious_panda', 'premium_human', 'cinematic_no_character'] as const) {
      const out = applyStyleLensToVisual(visual, lens, 0);
      expect(out.prompt).toBe(visual.prompt);
      expect(out.prompt.toLowerCase()).not.toContain('anthropomorphic curious panda');
      expect(out.prompt.toLowerCase()).not.toContain('cinematic real human subject');
    }
    const varied = withSceneVariationSeed(visual, 2);
    expect(varied.prompt).toBe(visual.prompt);
    expect(varied.seedHint).toContain('scene_var:2');
  });
});
