/**
 * PR D1 — conversation context is evidence-only and does not drive visuals.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyDirectorPrepareToCard } from '@/lib/eza/mirror/applyDirectorPrepareToCard';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

function baseCard(): DailyMirrorCardModel {
  return {
    date: '2026-07-19',
    dayLabel: 'Pazar',
    headline: 'Tezgâh Işığı',
    characterName: 'SAINA',
    personaFamilyId: 'balanced_calm',
    shortInsight: 'x',
    userLine: '',
    aiLine: '',
    balanceLine: '',
    signalLevel: '',
    confidence: 'Sinematik ayna',
    energyLabel: '',
    energyScore: null,
    shareEnabled: true,
    privacyText: '',
    visual: {
      characterId: 'saina',
      characterName: 'SAINA',
      personaFamilyId: 'balanced_calm',
      topicLabel: 'health',
      atmosphereLabel: 'x',
      emotionLabel: 'calm',
      prompt: 'OLD_PROMPT',
      negativePrompt: 'old',
      stylePreset: 'eza_mirror_professional_v1',
      promptContract: 'saina_mirror_v5_minimal',
      seedHint: 'seed',
      qualityHints: [],
      sceneIntentLabel: 'health',
      intentFingerprint: 'fp',
      hybridTextPayload: { headline: 'Tezgâh Işığı', description: '' },
      masterPosterText: { headline: 'Tezgâh Işığı' },
    },
  };
}

describe('PR D1 conversation context integration', () => {
  it('applyDirectorPrepareToCard ignores conversationContext for prompt/title', () => {
    const card = baseCard();
    const next = applyDirectorPrepareToCard(card, {
      directorEnabled: true,
      usedDirector: true,
      applyTitle: false,
      applyPrompt: false,
      conversationContext: {
        version: 'mirror-conversation-context-v1',
        creativeAuthority: 'none',
        conversationArc: { openingIntent: 'Kyoto walk' },
      },
      titleSource: 'legacy_heuristic',
      promptSource: 'legacy_heuristic',
    });
    expect(next.visual?.prompt).toBe('OLD_PROMPT');
    expect(next.headline).toBe('Tezgâh Işığı');
  });

  it('Experience prepare path still calls prepareDirectorDraft without D2 fields', () => {
    const experienceSrc = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(experienceSrc).toContain('prepareDirectorDraft');
    expect(experienceSrc).not.toContain('visualThesis');
    expect(experienceSrc).not.toContain('MirrorInterpretation');
  });

  it('applyDirectorPrepare source does not map conversationContext into visual', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/applyDirectorPrepareToCard.ts'),
      'utf8'
    );
    expect(src).toContain('conversationContext?');
    expect(src).not.toMatch(/conversationContext[\s\S]{0,80}prompt/);
  });
});
