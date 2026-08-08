/**
 * Fail-closed D2 Mirror scene generation — regression suite.
 */

import { describe, expect, it, vi } from 'vitest';
import { MIRROR_V5_PROMPT_CONTRACT } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { MirrorPrepareError } from '@/lib/eza/mirror/prepareDirectorDraftApi';
import { MirrorSceneError } from '@/lib/eza/mirror/generateSceneApi';
import { scenePromptHash } from '@/lib/eza/mirror/d2SceneGenerationGuard';
import { runFailClosedMirrorSceneGeneration } from '@/lib/eza/mirror/runFailClosedMirrorSceneGeneration';
import type { PrepareDirectorDraftResult } from '@/lib/eza/mirror/applyDirectorPrepareToCard';

const V3_CATEGORY_PROMPT = `CATEGORY: architecture
soft architectural daylight, modern atrium`;

const D2_PROMPT = `VISUAL NARRATIVE:
A quiet yellow-stone courtyard at dusk with a wooden chair and clothesline.
Distant minaret silhouette beyond the terrace edge.`;

function baseCard(prompt: string): DailyMirrorCardModel {
  return {
    date: '2026-07-25',
    headline: 'Test',
    dailyThemeTitle: 'Test',
    dailyThemeDescription: '',
    observation: '',
    suggestion: '',
    visual: {
      characterId: 'balanced_calm',
      characterName: 'Sakin',
      personaFamilyId: 'balanced_calm',
      topicLabel: 'place',
      atmosphereLabel: 'dusk',
      emotionLabel: 'calm',
      prompt,
      negativePrompt: 'text, letters',
      stylePreset: 'eza_mirror_professional_v1',
      seedHint: 'seed-test',
      qualityHints: [],
      promptContract:
        prompt.includes('VISUAL NARRATIVE')
          ? MIRROR_V5_PROMPT_CONTRACT
          : undefined,
    },
  } as DailyMirrorCardModel;
}

function d2PrepareResult(overrides?: Partial<PrepareDirectorDraftResult>): PrepareDirectorDraftResult {
  return {
    directorEnabled: true,
    usedDirector: true,
    directorMode: 'FULL',
    applyTitle: true,
    applyPrompt: true,
    mappedPrompt: {
      title: 'Mardin Terrace',
      topicCategory: 'place_memory',
      season: 'amber_hour',
      prompt: D2_PROMPT,
      negativePrompt: 'text',
      promptContract: MIRROR_V5_PROMPT_CONTRACT,
      titleSource: 'interpretation_v5_mapper',
      artDirectionSource: 'interpretation_v5_mapper',
    },
    metadata: {
      promptSource: 'interpretation_v5_mapper',
    } as PrepareDirectorDraftResult['metadata'],
    ...overrides,
  };
}

describe('runFailClosedMirrorSceneGeneration', () => {
  it('1. prepare success — generate once with VISUAL NARRATIVE, no CATEGORY, equal hashes', async () => {
    const generate = vi.fn(async ({ finalScenePromptHash, generationPipeline }) => {
      expect(generationPipeline).toBe('D2_V5');
      const expected = await scenePromptHash(D2_PROMPT);
      expect(finalScenePromptHash).toBe(expected);
      return {
        sceneImageUrl: 'https://cdn.example/mardin.png',
        provider: 'mock' as const,
        cached: false,
        generatedAt: '2026-07-25T00:00:00Z',
        generationRequestId: 'gen-1',
      };
    });
    const prepare = vi.fn(async () => d2PrepareResult());

    const out = await runFailClosedMirrorSceneGeneration({
      generationId: 'gen-1',
      conversationId: 'conv-1',
      card: baseCard(V3_CATEGORY_PROMPT),
      reuseMappedPrompt: false,
      shouldPrepare: true,
      generationPipeline: 'D2_V5',
      prepare,
      generate,
      isGenerationStillActive: () => true,
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(out.promptClassification).toBe('VISUAL_NARRATIVE');
    expect(out.mappedPromptHash).toBe(out.finalScenePromptHash);
    expect(out.card.visual?.prompt).toContain('VISUAL NARRATIVE:');
    expect(out.card.visual?.prompt).not.toMatch(/CATEGORY\s*:/i);
  });

  it('2. prepare first fails, retry succeeds — only D2 prompt reaches provider', async () => {
    const prepare = vi
      .fn()
      .mockRejectedValueOnce(new MirrorPrepareError('boom', 'prepare_http_error'))
      .mockResolvedValueOnce(d2PrepareResult());
    const generate = vi.fn(async ({ card }) => {
      expect(card.visual?.prompt).toContain('VISUAL NARRATIVE:');
      expect(card.visual?.prompt).not.toMatch(/CATEGORY\s*:/i);
      return {
        sceneImageUrl: 'https://cdn.example/ok.png',
        provider: 'mock' as const,
        cached: false,
        generatedAt: '2026-07-25T00:00:00Z',
        generationRequestId: 'gen-2',
      };
    });

    const out = await runFailClosedMirrorSceneGeneration({
      generationId: 'gen-2',
      conversationId: 'conv-1',
      card: baseCard(V3_CATEGORY_PROMPT),
      reuseMappedPrompt: false,
      shouldPrepare: true,
      generationPipeline: 'D2_V5',
      prepare,
      generate,
      isGenerationStillActive: () => true,
    });

    expect(out.ok).toBe(true);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('3. prepare fails twice — provider not called, controlled error', async () => {
    const prepare = vi
      .fn()
      .mockRejectedValue(new MirrorPrepareError('down', 'prepare_http_error'));
    const generate = vi.fn();

    const out = await runFailClosedMirrorSceneGeneration({
      generationId: 'gen-3',
      conversationId: 'conv-1',
      card: baseCard(V3_CATEGORY_PROMPT),
      reuseMappedPrompt: false,
      shouldPrepare: true,
      generationPipeline: 'D2_V5',
      prepare,
      generate,
      isGenerationStillActive: () => true,
    });

    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toBeInstanceOf(MirrorSceneError);
    expect(out.error.code).toBe('prepare_failed');
    expect(generate).not.toHaveBeenCalled();
    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it('4. existing V3 card visual is not used after prepare failure', async () => {
    const prepare = vi.fn().mockRejectedValue(new MirrorPrepareError('fail'));
    const generate = vi.fn();

    const out = await runFailClosedMirrorSceneGeneration({
      generationId: 'gen-4',
      conversationId: 'conv-1',
      card: baseCard(V3_CATEGORY_PROMPT),
      reuseMappedPrompt: false,
      shouldPrepare: true,
      generationPipeline: 'D2_V5',
      prepare,
      generate,
      isGenerationStillActive: () => true,
    });

    expect(out.ok).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });

  it('5. legacy mode — V3 usable only when explicitly LEGACY_V3', async () => {
    const prepare = vi.fn(async () =>
      d2PrepareResult({
        directorMode: 'LEGACY',
        usedDirector: false,
        applyPrompt: false,
        applyTitle: false,
        mappedPrompt: null,
      })
    );
    const generate = vi.fn(async ({ generationPipeline, card }) => {
      expect(generationPipeline).toBe('LEGACY_V3');
      expect(card.visual?.prompt).toContain('CATEGORY:');
      return {
        sceneImageUrl: 'https://cdn.example/legacy.png',
        provider: 'mock' as const,
        cached: false,
        generatedAt: '2026-07-25T00:00:00Z',
        generationRequestId: 'gen-5',
      };
    });

    const out = await runFailClosedMirrorSceneGeneration({
      generationId: 'gen-5',
      conversationId: 'conv-1',
      card: baseCard(V3_CATEGORY_PROMPT),
      reuseMappedPrompt: false,
      shouldPrepare: true,
      generationPipeline: 'LEGACY_V3',
      prepare,
      generate,
      isGenerationStillActive: () => true,
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.generationPipeline).toBe('LEGACY_V3');
  });

  it('5b. D2_V5 never demotes to LEGACY_V3 when prepare returns LEGACY', async () => {
    const prepare = vi.fn(async () =>
      d2PrepareResult({
        directorMode: 'LEGACY',
        usedDirector: false,
        applyPrompt: false,
        applyTitle: false,
        mappedPrompt: null,
      })
    );
    const generate = vi.fn();

    const out = await runFailClosedMirrorSceneGeneration({
      generationId: 'gen-5b',
      conversationId: 'conv-1',
      card: baseCard(V3_CATEGORY_PROMPT),
      reuseMappedPrompt: false,
      shouldPrepare: true,
      generationPipeline: 'D2_V5',
      prepare,
      generate,
      isGenerationStillActive: () => true,
    });

    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.code).toBe('d2_pipeline_required');
    expect(out.fallbackPath).toBe('director_legacy_not_allowed');
    expect(generate).not.toHaveBeenCalled();
  });

  it('5c. D2_V5 never demotes when prepare returns SHADOW', async () => {
    const prepare = vi.fn(async () =>
      d2PrepareResult({
        directorMode: 'SHADOW',
        usedDirector: false,
        applyPrompt: false,
        applyTitle: false,
        mappedPrompt: null,
      })
    );
    const generate = vi.fn();

    const out = await runFailClosedMirrorSceneGeneration({
      generationId: 'gen-5c',
      conversationId: 'conv-1',
      card: baseCard(V3_CATEGORY_PROMPT),
      reuseMappedPrompt: false,
      shouldPrepare: true,
      generationPipeline: 'D2_V5',
      prepare,
      generate,
      isGenerationStillActive: () => true,
    });

    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.code).toBe('d2_pipeline_required');
    expect(generate).not.toHaveBeenCalled();
  });

  it('6. race — stale generation cannot accept scene', async () => {
    let active = 'gen-old';
    const prepare = vi.fn(async () => {
      active = 'gen-new';
      return d2PrepareResult();
    });
    const generate = vi.fn();

    const out = await runFailClosedMirrorSceneGeneration({
      generationId: 'gen-old',
      conversationId: 'conv-1',
      card: baseCard(V3_CATEGORY_PROMPT),
      reuseMappedPrompt: false,
      shouldPrepare: true,
      generationPipeline: 'D2_V5',
      prepare,
      generate,
      isGenerationStillActive: (id) => id === active,
    });

    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.code).toBe('stale_generation');
    expect(generate).not.toHaveBeenCalled();
  });

  it('7. hash / prefix — D2 mode rejects CATEGORY card without prepare', async () => {
    const generate = vi.fn();
    const out = await runFailClosedMirrorSceneGeneration({
      generationId: 'gen-7',
      conversationId: 'conv-1',
      card: baseCard(V3_CATEGORY_PROMPT),
      reuseMappedPrompt: false,
      shouldPrepare: false,
      generationPipeline: 'D2_V5',
      prepare: vi.fn(),
      generate,
      isGenerationStillActive: () => true,
    });

    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.code).toBe('d2_prompt_invalid');
    expect(generate).not.toHaveBeenCalled();
  });

  it('8. CATEGORY prompt in D2 mode after soft prepare claim is blocked', async () => {
    const prepare = vi.fn(async () =>
      d2PrepareResult({
        mappedPrompt: {
          title: 'Bad',
          topicCategory: 'architecture',
          season: 'amber_hour',
          prompt: V3_CATEGORY_PROMPT,
          negativePrompt: 'text',
          promptContract: MIRROR_V5_PROMPT_CONTRACT,
          titleSource: 'interpretation_v5_mapper',
          artDirectionSource: 'interpretation_v5_mapper',
        },
      })
    );
    const generate = vi.fn();

    const out = await runFailClosedMirrorSceneGeneration({
      generationId: 'gen-8',
      conversationId: 'conv-1',
      card: baseCard(V3_CATEGORY_PROMPT),
      reuseMappedPrompt: false,
      shouldPrepare: true,
      generationPipeline: 'D2_V5',
      prepare,
      generate,
      isGenerationStillActive: () => true,
    });

    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error.code).toBe('d2_prompt_invalid');
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('Experience soft-fail removed', () => {
  it('does not soft-continue to V3 after prepare catch', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const src = readFileSync(
      join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
      'utf8'
    );
    expect(src).not.toMatch(/Soft-fail to legacy/);
    expect(src).toContain('runFailClosedMirrorSceneGeneration');
    expect(src).toContain('activeGenerationIdRef');
  });
});
