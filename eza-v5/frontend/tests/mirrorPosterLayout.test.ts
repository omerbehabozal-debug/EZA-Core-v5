import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import {
  buildMirrorLayoutDebug,
  resolveCardRenderMode,
  resolveEffectiveRenderMode,
  resolveUsedLayout,
  shouldUseHybridPosterLayout,
} from '@/lib/eza/mirror/mirrorPosterLayout';
import { resolveMirrorRenderMode } from '@/lib/eza/mirror/mirrorRenderMode';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const posterSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorPosterCard.tsx'),
  'utf8'
);

const experienceSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
  'utf8'
);

function makeEntry(id: string): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    savedAt: new Date().toISOString(),
    vector: {
      input_risk: 0.1,
      output_risk: 0.1,
      input_health: 0.9,
      output_health: 0.9,
      alignment_score: 82,
      eza_final: 78,
      intent: 'gluten free dessert recipe',
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0 },
    mirrorCueHints: ['gluten', 'recipe'],
    standaloneObservation: {
      user_pattern: { category: 'ideation_creation', confidence: 0.85, signals: ['gluten'] },
      ai_behavior: { category: 'explanatory', confidence: 0.8, signals: [] },
      relationship_balance: { category: 'creative_flow', confidence: 0.8, signals: [] },
    },
  };
}

const ENTRIES = [makeEntry('a'), makeEntry('b'), makeEntry('c')];

const hybridCard: DailyMirrorCardModel = {
  date: '2026-05-21',
  dayLabel: 'Bugün',
  headline: 'Test',
  characterName: 'Yaratıcı',
  personaFamilyId: 'ideation_creation',
  shortInsight: 'Insight',
  userLine: 'u',
  aiLine: 'a',
  balanceLine: 'b',
  signalLevel: 'low',
  confidence: 'medium',
  energyLabel: 'Ritim',
  energyScore: 50,
  shareEnabled: true,
  privacyText: 'privacy',
  renderMode: 'hybrid_middle',
  visual: {
    characterId: 'c1',
    characterName: 'Yaratıcı',
    personaFamilyId: 'ideation_creation',
    topicLabel: 'topic',
    atmosphereLabel: 'calm',
    emotionLabel: 'steady',
    prompt: 'hybrid prompt',
    negativePrompt: 'neg',
    stylePreset: 'preset',
    seedHint: 'seed',
    renderMode: 'hybrid_middle',
    sceneImageUrl: null,
    sceneImageStatus: 'idle',
  },
};

describe('mirrorPosterLayout', () => {
  it('hybrid mode + no sceneImageUrl uses hybrid layout (not scene_only)', () => {
    expect(shouldUseHybridPosterLayout('hybrid_middle', false)).toBe(true);
    expect(resolveUsedLayout({
      renderMode: 'hybrid_middle',
      explicitHybridFallback: false,
      sceneImageUrl: null,
      sceneImageStatus: 'idle',
    })).toBe('hybrid_middle_placeholder');
  });

  it('hybrid mode + no sceneImageUrl does not enable frontend middle overlays', () => {
    const debug = buildMirrorLayoutDebug({
      card: hybridCard,
      explicitHybridFallback: false,
    });
    expect(debug.frontendMiddleOverlayHidden).toBe(true);
    expect(debug.usedLayout).toBe('hybrid_middle_placeholder');
    expect(debug.sceneImageUrl).toBeNull();
    expect(debug.sceneImageStatus).toBe('idle');
  });

  it('scene_only mode + no sceneImageUrl keeps frontend overlay path', () => {
    expect(
      resolveUsedLayout({
        renderMode: 'scene_only',
        explicitHybridFallback: false,
        sceneImageUrl: null,
        sceneImageStatus: 'idle',
      })
    ).toBe('scene_only_placeholder');
    expect(shouldUseHybridPosterLayout('scene_only', false)).toBe(false);
  });

  it('explicit hybrid fallback switches to scene_only effective mode', () => {
    expect(resolveEffectiveRenderMode(hybridCard, true)).toBe('scene_only');
    expect(
      resolveUsedLayout({
        renderMode: 'scene_only',
        explicitHybridFallback: true,
        sceneImageUrl: null,
        sceneImageStatus: 'idle',
      })
    ).toBe('scene_only_placeholder');
  });

  it('missing sceneImageUrl alone must not imply scene_only layout', () => {
    expect(resolveCardRenderMode(hybridCard)).toBe('hybrid_middle');
    expect(
      shouldUseHybridPosterLayout(resolveCardRenderMode(hybridCard), false)
    ).toBe(true);
  });
});

describe('buildMirrorState renderMode persistence', () => {
  const prev = process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER;
    } else {
      process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER = prev;
    }
  });

  it('Bugünün Aynasını Aç flow preserves hybrid_middle on card and visual', () => {
    process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER = 'true';
    const state = buildMirrorState(ENTRIES, { seed: 'open-mirror-hybrid' });
    expect(state.dailyMirrorCard.renderMode).toBe('hybrid_middle');
    expect(state.dailyMirrorCard.visual?.renderMode).toBe('hybrid_middle');
    expect(state.dailyMirrorCard.visual?.sceneImageStatus).toBe('idle');
    expect(state.dailyMirrorCard.visual?.sceneImageUrl ?? null).toBeNull();
  });

  it('renderMode change is detectable vs effective mode', () => {
    const staleCard = { ...hybridCard, renderMode: 'scene_only' as const };
    expect(resolveCardRenderMode(staleCard)).toBe('scene_only');
    process.env.NEXT_PUBLIC_EZA_MIRROR_HYBRID_POSTER = 'true';
    expect(resolveMirrorRenderMode()).toBe('hybrid_middle');
    expect(resolveCardRenderMode(staleCard)).not.toBe(resolveMirrorRenderMode());
  });
});

describe('DailyMirrorPosterCard hybrid initial render wiring', () => {
  it('uses renderMode-driven layout helpers, not sceneImageUrl gate', () => {
    expect(posterSrc).toContain('shouldUseHybridPosterLayout');
    expect(posterSrc).toContain('resolveCardRenderMode');
    expect(posterSrc).toContain('identity_first');
    expect(posterSrc).toContain('identity_hybrid');
    expect(posterSrc).toContain('isHybridMiddle');
    expect(posterSrc).toContain('v10-full-canvas');
    expect(posterSrc).toContain('FullCanvasScene');
    expect(posterSrc).not.toMatch(/!card\.visual\?\.sceneImageUrl[\s\S]*?isHybridMiddle/);
  });

  it('passes renderMode to scene for hybrid placeholder', () => {
    expect(posterSrc).toMatch(/renderMode=\{effectiveRenderMode\}/);
  });

  it('StandaloneObservationExperience renders poster with renderMode from card', () => {
    expect(experienceSrc).toContain('DailyMirrorPosterCard');
    expect(experienceSrc).toContain('cardForRender');
  });
});
