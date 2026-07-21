/**
 * Mirror benchmark mode — Style Lens must stay on cinematic_no_character.
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
import { applyStyleLensToVisual } from '@/lib/eza/mirror/styleLensPrompt';
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

  it('does not rotate to curious_panda under benchmark', () => {
    enableMirrorBenchmarkMode();
    const session = createDefaultStyleLensSession({
      date: '2026-07-19',
      visual: { intentFingerprint: 'fp' } as MirrorVisualPromptPayload,
    });
    const next = advanceStyleLensSession(session);
    expect(next.selectedStyleLensId).toBe('cinematic_no_character');
  });

  it('applyStyleLens does not inject panda/human for cinematic_no_character', () => {
    const visual: MirrorVisualPromptPayload = {
      characterId: 'saina',
      characterName: 'SAINA',
      personaFamilyId: 'balanced_calm',
      topicLabel: 'travel',
      atmosphereLabel: 'x',
      emotionLabel: 'calm',
      prompt:
        'Create a natural cinematic scene with no text. do not depict a panda, fox, animal doctor mascot, cartoon animal, or literal character costume. CATEGORY:\ntravel\nVISUAL NARRATIVE:\nKyoto Pontocho rain.',
      negativePrompt: 'text',
      stylePreset: 'eza_mirror_professional_v1',
      promptContract: 'saina_mirror_v5_minimal',
      seedHint: 'seed',
      qualityHints: [],
      sceneIntentLabel: 'travel',
      intentFingerprint: 'fp',
    };
    const out = applyStyleLensToVisual(visual, 'cinematic_no_character', 0);
    expect(out.prompt.toLowerCase()).toContain('no central character');
    expect(out.prompt.toLowerCase()).not.toContain('anthropomorphic curious panda');
    expect(out.prompt.toLowerCase()).not.toContain('cinematic real human subject');
    // stripMascotAvoidForLens only applies to mascot lenses — avoidance remains.
    expect(out.prompt).toContain('do not depict a panda');
  });
});
