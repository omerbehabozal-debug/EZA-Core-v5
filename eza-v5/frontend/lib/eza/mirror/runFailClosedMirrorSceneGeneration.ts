/**
 * Fail-closed D2 Mirror scene generation orchestration.
 * Never soft-continues to V3 after prepare failure in D2_V5 mode.
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { MirrorGenerateSceneResponse } from '@/lib/eza/mirror/generateSceneApi';
import { MirrorSceneError } from '@/lib/eza/mirror/generateSceneApi';
import {
  applyDirectorPrepareToCard,
  type PrepareDirectorDraftResult,
} from '@/lib/eza/mirror/applyDirectorPrepareToCard';
import { MirrorPrepareError } from '@/lib/eza/mirror/prepareDirectorDraftApi';
import { MIRROR_V5_PROMPT_CONTRACT } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import {
  classifyScenePrompt,
  isDirectorAffectingMode,
  logMirrorSceneLineage,
  promptContainsCategory,
  resolveGenerationPipeline,
  scenePromptHash,
  type MirrorGenerationPipeline,
  type ScenePromptClassification,
} from '@/lib/eza/mirror/d2SceneGenerationGuard';

export type FailClosedPrepareFn = () => Promise<PrepareDirectorDraftResult>;

export type FailClosedGenerateFn = (args: {
  card: DailyMirrorCardModel;
  generationId: string;
  generationPipeline: MirrorGenerationPipeline;
  finalScenePromptHash: string;
}) => Promise<MirrorGenerateSceneResponse>;

export type FailClosedGenerationInput = {
  generationId: string;
  conversationId?: string | null;
  card: DailyMirrorCardModel;
  /** When true, skip prepare and require an already-pinned D2 visual. */
  reuseMappedPrompt: boolean;
  /** Explicit pipeline only — never infer LEGACY from missing data. */
  generationPipeline?: MirrorGenerationPipeline;
  /** Whether prepare should run (conversation + user messages). */
  shouldPrepare: boolean;
  prepare: FailClosedPrepareFn;
  generate: FailClosedGenerateFn;
  /** Race guard: return false if this generationId is no longer active. */
  isGenerationStillActive: (generationId: string) => boolean;
  deploymentCommit?: string | null;
};

export type FailClosedGenerationSuccess = {
  ok: true;
  card: DailyMirrorCardModel;
  result: MirrorGenerateSceneResponse;
  generationPipeline: MirrorGenerationPipeline;
  mappedPromptHash: string;
  finalScenePromptHash: string;
  promptClassification: ScenePromptClassification;
  prepareAttempt: number;
  prepareSucceeded: boolean;
  directorMode: string | null;
};

export type FailClosedGenerationFailure = {
  ok: false;
  error: MirrorSceneError;
  generationPipeline: MirrorGenerationPipeline;
  prepareAttempt: number;
  prepareSucceeded: boolean;
  directorMode: string | null;
  fallbackPath: string;
};

export type FailClosedGenerationResult =
  | FailClosedGenerationSuccess
  | FailClosedGenerationFailure;

function prepareFailedError(message = 'Director prepare başarısız oldu.'): MirrorSceneError {
  return new MirrorSceneError(message, 'prepare_failed');
}

function d2InvalidError(message: string): MirrorSceneError {
  return new MirrorSceneError(message, 'd2_prompt_invalid');
}

function staleError(): MirrorSceneError {
  return new MirrorSceneError('Stale generation ignored.', 'stale_generation');
}

async function assertValidD2Visual(
  prompt: string,
  expectedContract: string | null | undefined
): Promise<{ hash: string; classification: ScenePromptClassification }> {
  const trimmed = (prompt || '').trim();
  const classification = classifyScenePrompt(trimmed);
  const hash = await scenePromptHash(trimmed);
  if (!trimmed) {
    throw d2InvalidError('D2 scene prompt is empty.');
  }
  if (classification !== 'VISUAL_NARRATIVE') {
    throw d2InvalidError(`D2 prompt must start with VISUAL NARRATIVE (got ${classification}).`);
  }
  if (promptContainsCategory(trimmed)) {
    throw d2InvalidError('D2 prompt must not contain CATEGORY:.');
  }
  if ((expectedContract || '').trim() !== MIRROR_V5_PROMPT_CONTRACT) {
    throw d2InvalidError('D2 promptContractVersion missing or invalid.');
  }
  return { hash, classification };
}

async function runPrepareWithRetry(
  prepare: FailClosedPrepareFn
): Promise<{ prepared: PrepareDirectorDraftResult; attempt: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const prepared = await prepare();
      return { prepared, attempt };
    } catch (err) {
      lastError = err;
      if (attempt === 2) break;
    }
  }
  if (lastError instanceof MirrorPrepareError) {
    throw prepareFailedError(lastError.message);
  }
  throw prepareFailedError();
}

function requireD2PrepareSuccess(prepared: PrepareDirectorDraftResult): void {
  const mode = (prepared.directorMode || '').trim().toUpperCase();
  if (!isDirectorAffectingMode(mode)) {
    return;
  }
  if (!prepared.usedDirector) {
    throw prepareFailedError('Director prepare did not apply (usedDirector=false).');
  }
  if (!prepared.applyPrompt || !prepared.mappedPrompt?.prompt?.trim()) {
    throw prepareFailedError('Director prepare did not return a mapped prompt.');
  }
  const mapped = prepared.mappedPrompt.prompt;
  if (classifyScenePrompt(mapped) !== 'VISUAL_NARRATIVE') {
    throw d2InvalidError('Mapped prompt is not VISUAL NARRATIVE.');
  }
  if (promptContainsCategory(mapped)) {
    throw d2InvalidError('Mapped prompt contains CATEGORY:.');
  }
}

/**
 * Orchestrate prepare → validate → generate for current Mirror paths.
 * Callers must not soft-catch and continue with V3.
 */
export async function runFailClosedMirrorSceneGeneration(
  input: FailClosedGenerationInput
): Promise<FailClosedGenerationResult> {
  const {
    generationId,
    conversationId,
    reuseMappedPrompt,
    shouldPrepare,
    prepare,
    generate,
    isGenerationStillActive,
    deploymentCommit,
  } = input;

  let card = input.card;
  let prepareAttempt = 0;
  let prepareSucceeded = false;
  let directorMode: string | null = null;
  let generationPipeline = resolveGenerationPipeline({
    explicit: input.generationPipeline,
    reusePinnedD2: reuseMappedPrompt,
  });
  let fallbackPath: string | null = null;

  const fail = (
    error: MirrorSceneError,
    path: string
  ): FailClosedGenerationFailure => {
    logMirrorSceneLineage('generation_failed', {
      generationId,
      conversationId,
      prepareAttempt,
      prepareSucceeded,
      directorMode,
      generationPipeline,
      fallbackPath: path,
    });
    return {
      ok: false,
      error,
      generationPipeline,
      prepareAttempt,
      prepareSucceeded,
      directorMode,
      fallbackPath: path,
    };
  };

  if (!isGenerationStillActive(generationId)) {
    return fail(staleError(), 'stale_before_prepare');
  }

  try {
    if (shouldPrepare && !reuseMappedPrompt) {
      const { prepared, attempt } = await runPrepareWithRetry(prepare);
      prepareAttempt = attempt;
      directorMode = prepared.directorMode ?? null;

      if (!isGenerationStillActive(generationId)) {
        return fail(staleError(), 'stale_after_prepare');
      }

      const modeUpper = (prepared.directorMode || '').trim().toUpperCase();
      if (modeUpper === 'LEGACY' || modeUpper === 'SHADOW') {
        // Explicit legacy path only when backend reports LEGACY/SHADOW.
        generationPipeline = 'LEGACY_V3';
        fallbackPath = `director_${modeUpper.toLowerCase()}`;
        if (prepared.usedDirector && (prepared.applyTitle || prepared.applyPrompt || prepared.metadata)) {
          card = applyDirectorPrepareToCard(card, prepared);
        }
        prepareSucceeded = true;
      } else {
        // SOFT / FULL / unknown → D2 fail-closed
        generationPipeline = 'D2_V5';
        requireD2PrepareSuccess(prepared);
        card = applyDirectorPrepareToCard(card, prepared);
        prepareSucceeded = true;
        fallbackPath = null;
      }

      logMirrorSceneLineage('prepare_complete', {
        generationId,
        conversationId,
        prepareAttempt,
        prepareSucceeded: true,
        directorMode,
        generationPipeline,
        mappedPromptHash: prepared.mappedPrompt?.prompt
          ? await scenePromptHash(prepared.mappedPrompt.prompt)
          : null,
        promptClassification: prepared.mappedPrompt?.prompt
          ? classifyScenePrompt(prepared.mappedPrompt.prompt)
          : undefined,
        semanticSource: card.mirrorSemanticSource ?? null,
        fallbackPath,
      });
    } else if (reuseMappedPrompt) {
      generationPipeline = 'D2_V5';
      prepareSucceeded = true;
      fallbackPath = 'reuse_pinned_d2';
    } else if (!shouldPrepare && generationPipeline === 'D2_V5') {
      // No prepare opportunity — require card already holds a valid D2 visual.
      fallbackPath = 'no_prepare_require_d2_card';
    }

    if (!isGenerationStillActive(generationId)) {
      return fail(staleError(), 'stale_before_generate');
    }

    const visualPrompt = card.visual?.prompt ?? '';
    let finalScenePromptHash: string;
    let promptClassification: ScenePromptClassification;
    let mappedPromptHash: string;

    if (generationPipeline === 'D2_V5') {
      const validated = await assertValidD2Visual(
        visualPrompt,
        card.visual?.promptContract
      );
      finalScenePromptHash = validated.hash;
      promptClassification = validated.classification;
      mappedPromptHash = validated.hash;
    } else {
      // Explicit LEGACY_V3 only
      if (generationPipeline !== 'LEGACY_V3') {
        return fail(d2InvalidError('Unknown generation pipeline.'), 'invalid_pipeline');
      }
      finalScenePromptHash = await scenePromptHash(visualPrompt);
      promptClassification = classifyScenePrompt(visualPrompt);
      mappedPromptHash = finalScenePromptHash;
      fallbackPath = fallbackPath ?? 'explicit_legacy_v3';
    }

    logMirrorSceneLineage('generate_scene_request', {
      generationId,
      conversationId,
      prepareAttempt,
      prepareSucceeded,
      directorMode,
      generationPipeline,
      mappedPromptHash,
      finalScenePromptHash,
      promptClassification,
      fallbackPath,
      semanticSource: card.mirrorSemanticSource ?? null,
    });

    const result = await generate({
      card,
      generationId,
      generationPipeline,
      finalScenePromptHash,
    });

    if (!isGenerationStillActive(generationId)) {
      return fail(staleError(), 'stale_after_generate');
    }

    const responseGenId = result.generationRequestId;
    if (responseGenId && responseGenId !== generationId) {
      return fail(staleError(), 'response_generation_id_mismatch');
    }

    logMirrorSceneLineage('generate_scene_accepted', {
      generationId,
      conversationId,
      prepareAttempt,
      prepareSucceeded,
      directorMode,
      generationPipeline,
      mappedPromptHash,
      finalScenePromptHash,
      providerPromptHash: finalScenePromptHash,
      promptClassification,
      provider: result.provider,
      sceneAssetId: result.sceneImageUrl?.slice(-48) ?? null,
      fallbackPath,
    });

    void deploymentCommit;

    return {
      ok: true,
      card,
      result,
      generationPipeline,
      mappedPromptHash,
      finalScenePromptHash,
      promptClassification,
      prepareAttempt,
      prepareSucceeded,
      directorMode,
    };
  } catch (err) {
    if (err instanceof MirrorSceneError) {
      return fail(err, err.code);
    }
    if (err instanceof MirrorPrepareError) {
      return fail(prepareFailedError(err.message), 'prepare_exception');
    }
    return fail(
      new MirrorSceneError(
        err instanceof Error ? err.message : 'Mirror sahnesi şu an hazırlanamadı.',
        'generation_failed'
      ),
      'unexpected'
    );
  }
}
