/**
 * D2 scene generation guard — fail-closed for SOFT/FULL director paths.
 * Prevents V3 CATEGORY / soft-fail visuals from reaching the image provider.
 *
 * LEGACY_V3 is never inferred from missing data, director mode, or prepare
 * SHADOW/LEGACY responses. Callers must pass `explicit: 'LEGACY_V3'` (e.g. Daily
 * path without conversationId). Conversation create paths must stay on D2_V5.
 */

import { djb2Hex, sha256Hex } from '@/lib/eza/mirror/mirrorLineageHash';

export type MirrorGenerationPipeline = 'D2_V5' | 'LEGACY_V3';

export type ScenePromptClassification = 'VISUAL_NARRATIVE' | 'CATEGORY' | 'OTHER';

export type D2ScenePromptValidation =
  | { ok: true; classification: 'VISUAL_NARRATIVE'; promptHash: string }
  | {
      ok: false;
      reason:
        | 'empty_prompt'
        | 'missing_visual_narrative'
        | 'contains_category'
        | 'hash_mismatch';
      classification: ScenePromptClassification;
      promptHash: string;
    };

export function classifyScenePrompt(prompt: string): ScenePromptClassification {
  const trimmed = (prompt || '').trim();
  if (/^VISUAL NARRATIVE:/im.test(trimmed) || trimmed.startsWith('VISUAL NARRATIVE:')) {
    return 'VISUAL_NARRATIVE';
  }
  if (/\bCATEGORY\s*:/i.test(trimmed)) {
    return 'CATEGORY';
  }
  return 'OTHER';
}

export function promptContainsCategory(prompt: string): boolean {
  return /\bCATEGORY\s*:/i.test(prompt || '');
}

/** Sync hash for guards/tests; prefer sha256Hex at async boundaries. */
export function scenePromptHashSync(prompt: string): string {
  return djb2Hex((prompt || '').trim());
}

export async function scenePromptHash(prompt: string): Promise<string> {
  return sha256Hex((prompt || '').trim());
}

export function validateD2ScenePrompt(
  prompt: string,
  options?: { expectedHash?: string | null }
): D2ScenePromptValidation {
  const trimmed = (prompt || '').trim();
  const classification = classifyScenePrompt(trimmed);
  const promptHash = scenePromptHashSync(trimmed);

  if (!trimmed) {
    return { ok: false, reason: 'empty_prompt', classification, promptHash };
  }
  if (classification !== 'VISUAL_NARRATIVE') {
    return {
      ok: false,
      reason: 'missing_visual_narrative',
      classification,
      promptHash,
    };
  }
  if (promptContainsCategory(trimmed)) {
    return { ok: false, reason: 'contains_category', classification, promptHash };
  }
  if (options?.expectedHash && options.expectedHash !== promptHash) {
    return { ok: false, reason: 'hash_mismatch', classification, promptHash };
  }
  return { ok: true, classification: 'VISUAL_NARRATIVE', promptHash };
}

export function isDirectorAffectingMode(mode: string | null | undefined): boolean {
  const m = (mode || '').trim().toUpperCase();
  return m === 'SOFT' || m === 'FULL';
}

export function resolveGenerationPipeline(input: {
  explicit?: MirrorGenerationPipeline | null;
  directorMode?: string | null;
  reusePinnedD2?: boolean;
}): MirrorGenerationPipeline {
  if (input.explicit === 'LEGACY_V3' || input.explicit === 'D2_V5') {
    return input.explicit;
  }
  if (input.reusePinnedD2) return 'D2_V5';
  if (isDirectorAffectingMode(input.directorMode)) return 'D2_V5';
  // Default for conversation Mirror create path: D2 (fail-closed). Explicit LEGACY only.
  return 'D2_V5';
}

/**
 * Conversation Mirror paths must stay on D2_V5.
 * LEGACY_V3 is never inferred — only an explicit caller choice is allowed.
 */
export function assertConversationPipelineIsD2(
  pipeline: MirrorGenerationPipeline | null | undefined
): asserts pipeline is 'D2_V5' {
  if (pipeline !== 'D2_V5') {
    throw new Error(
      `Conversation Mirror requires D2_V5 (got ${pipeline ?? 'unset'}); LEGACY_V3 is never inferred.`
    );
  }
}

export type MirrorSceneLineageLog = {
  generationId: string;
  conversationId?: string | null;
  prepareAttempt?: number;
  prepareSucceeded?: boolean;
  directorMode?: string | null;
  generationPipeline: MirrorGenerationPipeline;
  semanticSource?: string | null;
  mappedPromptHash?: string | null;
  finalScenePromptHash?: string | null;
  providerPromptHash?: string | null;
  promptClassification?: ScenePromptClassification;
  fallbackPath?: string | null;
  provider?: string | null;
  sceneAssetId?: string | null;
};

export function logMirrorSceneLineage(
  event: string,
  payload: MirrorSceneLineageLog
): void {
  // Safe metadata only — never log full prompt / conversation text.
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info(`[mirror-scene-lineage] ${event}`, payload);
  }
}
