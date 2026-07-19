import { describe, expect, it } from 'vitest';
import { applyDirectorPrepareToCard } from '@/lib/eza/mirror/applyDirectorPrepareToCard';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
    mirrorV3Payload: {
      conversationId: 'c1',
      date: '2026-07-19',
      season: 'quiet_luxury',
      topic: 'health',
      selectedTopic: 'health',
      candidateTopics: [],
      mirrorTitle: 'Tezgâh Işığı',
      mirrorText: 'body',
      sceneMetaphor: 'counter',
      emotionalTone: 'calm',
      visualKeywords: [],
      safetyLevel: 'normal',
      pipelineVersion: 'v3',
      refinementVersion: '5.0',
      storyTopicId: 'health',
      conversationEvidence: [],
      sceneComposition: {
        heroScene: 'counter',
        supportingEvidence: [],
        spatialLayout: 'center',
        depthLayers: [],
      } as never,
      meaning: 'm',
      narrativeTheme: 't',
      emotion: 'calm',
      narrativeDistance: 2,
      narrativeDistanceLabel: 'l',
      emotionalAtmosphere: 'a',
    } as never,
  };
}

describe('applyDirectorPrepareToCard title authority', () => {
  it('LLM mapped title replaces pool title and visual prompt', () => {
    const next = applyDirectorPrepareToCard(baseCard(), {
      directorEnabled: true,
      usedDirector: true,
      directorMode: 'FULL',
      applyTitle: true,
      applyPrompt: true,
      mappedPrompt: {
        title: 'Yağmur Altında Kyoto',
        topicCategory: 'travel',
        season: 'night_discovery',
        prompt: 'NEW_V5_PROMPT with TITLE',
        negativePrompt: 'neg',
        promptContract: 'saina_mirror_v5_minimal',
        titleSource: 'llm_draft_approved',
        artDirectionSource: 'llm_draft',
      },
      titleSource: 'llm_draft_approved',
      promptSource: 'director_v5_mapper',
      metadata: {
        analysisSchemaVersion: 'mirror-director-v1',
        draftSchemaVersion: 'mirror-draft-v1',
        reviewSchemaVersion: 'mirror-director-review-v1',
        analysisSource: 'llm',
        draftSource: 'llm_draft_approved',
        directorReasonCodes: [],
        revisionCount: 0,
        topicCategory: 'travel',
        contentHash: 'abc',
        titleSource: 'llm_draft_approved',
      },
    });
    expect(next.headline).toBe('Yağmur Altında Kyoto');
    expect(next.visual?.prompt).toContain('NEW_V5_PROMPT');
    expect(next.visual?.hybridTextPayload?.headline).toBe('Yağmur Altında Kyoto');
    expect(next.mirrorV3Payload?.mirrorTitle).toBe('Yağmur Altında Kyoto');
    expect(next.mirrorDirectorMetadata?.titleSource).toBe('llm_draft_approved');
  });

  it('SOFT applies title but keeps legacy prompt', () => {
    const next = applyDirectorPrepareToCard(baseCard(), {
      directorEnabled: true,
      usedDirector: true,
      directorMode: 'SOFT',
      applyTitle: true,
      applyPrompt: false,
      mappedPrompt: {
        title: 'Yağmur Altında Kyoto',
        topicCategory: 'travel',
        season: 'night_discovery',
        prompt: 'SHOULD_NOT_APPLY',
        negativePrompt: 'neg',
        promptContract: 'saina_mirror_v5_minimal',
        titleSource: 'llm_draft_approved',
        artDirectionSource: 'llm_draft',
      },
      titleSource: 'llm_draft_approved',
      promptSource: 'legacy_heuristic',
    });
    expect(next.headline).toBe('Yağmur Altında Kyoto');
    expect(next.visual?.prompt).toBe('OLD_PROMPT');
  });

  it('SHADOW does not change title or prompt', () => {
    const next = applyDirectorPrepareToCard(baseCard(), {
      directorEnabled: true,
      usedDirector: true,
      directorMode: 'SHADOW',
      directorExecuted: true,
      directorAffectedOutput: false,
      applyTitle: false,
      applyPrompt: false,
      mappedPrompt: null,
      shadowMappedPrompt: {
        title: 'Shadow Title',
        topicCategory: 'travel',
        season: 'night_discovery',
        prompt: 'SHADOW',
        negativePrompt: 'neg',
        promptContract: 'saina_mirror_v5_minimal',
        titleSource: 'llm_draft_approved',
        artDirectionSource: 'llm_draft',
      },
      titleSource: 'legacy_heuristic',
      promptSource: 'legacy_heuristic',
      metadata: {
        analysisSchemaVersion: 'mirror-director-v1',
        draftSchemaVersion: 'mirror-draft-v1',
        reviewSchemaVersion: 'mirror-director-review-v1',
        analysisSource: 'llm',
        draftSource: 'llm_draft_approved',
        directorReasonCodes: [],
        revisionCount: 0,
        topicCategory: 'travel',
        contentHash: 'shadow',
      },
    });
    expect(next.headline).toBe('Tezgâh Işığı');
    expect(next.visual?.prompt).toBe('OLD_PROMPT');
    expect(next.mirrorDirectorMetadata?.directorMode).toBe('SHADOW');
    expect(next.mirrorDirectorMetadata?.directorAffectedOutput).toBe(false);
  });

  it('usedDirector false leaves legacy title pool result intact', () => {
    const card = baseCard();
    const next = applyDirectorPrepareToCard(card, {
      directorEnabled: false,
      usedDirector: false,
    });
    expect(next.headline).toBe('Tezgâh Işığı');
    expect(next.visual?.prompt).toBe('OLD_PROMPT');
  });
});

describe('create-path wiring presence', () => {
  it('Experience calls prepare before generateMirrorScene', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(src).toContain('prepareDirectorDraft');
    expect(src).toContain('applyDirectorPrepareToCard');
    const prepareIdx = src.indexOf('prepareDirectorDraft');
    const generateIdx = src.indexOf('generateMirrorScene(visualForApi');
    expect(prepareIdx).toBeGreaterThan(0);
    expect(generateIdx).toBeGreaterThan(prepareIdx);
  });

  it('chat stream does not import prepare API', () => {
    const chat = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneChatInner.tsx'),
      'utf8'
    );
    const stream = readFileSync(join(process.cwd(), 'hooks/useStreamResponse.ts'), 'utf8');
    expect(chat).not.toMatch(/prepareDirectorDraft/);
    expect(stream).not.toMatch(/prepareDirectorDraft/);
  });
});
