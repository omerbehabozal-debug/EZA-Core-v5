/**
 * PR D2 — Interpretation is creative authority via mappedPrompt only.
 * applyDirectorPrepare must not invent visuals from finalInterpretation fields.
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

describe('PR D2 interpretation integration', () => {
  it('applies mappedPrompt from interpretation path; ignores finalInterpretation body', () => {
    const card = baseCard();
    const next = applyDirectorPrepareToCard(card, {
      directorEnabled: true,
      usedDirector: true,
      applyTitle: true,
      applyPrompt: true,
      directorMode: 'FULL',
      directorAffectedOutput: true,
      titleSource: 'interpretation_llm',
      promptSource: 'interpretation_v5_mapper',
      mappedPrompt: {
        title: 'Yağmur Altında Kyoto',
        topicCategory: 'travel',
        season: 'editorial_magazine',
        prompt:
          'Create a natural cinematic scene with no text, no typography. VISUAL NARRATIVE: Kyoto lane.',
        negativePrompt: 'text, typography',
        promptContract: 'saina_mirror_v5_minimal',
        titleSource: 'interpretation_llm',
        artDirectionSource: 'interpretation_v1',
      },
      finalInterpretation: {
        title: 'SHOULD_NOT_PAINT',
        visualNarrative: 'SHOULD_NOT_BECOME_PROMPT',
        imageIntent: 'ignored',
      },
    });
    expect(next.headline).toBe('Yağmur Altında Kyoto');
    expect(next.visual?.prompt).toContain('VISUAL NARRATIVE');
    expect(next.visual?.prompt).not.toContain('SHOULD_NOT_BECOME_PROMPT');
    expect(next.visual?.prompt).not.toContain('SHOULD_NOT_PAINT');
  });

  it('applyDirectorPrepare does not read finalInterpretation into prompt', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/applyDirectorPrepareToCard.ts'),
      'utf8'
    );
    expect(src).toContain('finalInterpretation?');
    expect(src).not.toMatch(/finalInterpretation[\s\S]{0,120}prompt\s*=/);
  });

  it('D0 text-free still respected in DraftSource types for interpretation', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/eza/mirror/director/mirrorDraftTypes.ts'),
      'utf8'
    );
    expect(src).toContain('interpretation_llm');
    expect(src).toContain('interpretation_heuristic');
  });
});
