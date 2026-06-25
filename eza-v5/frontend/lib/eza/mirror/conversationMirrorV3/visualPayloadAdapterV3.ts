/**
 * Mirror V5 — adapt payload to scene API (minimal OpenAI render prompt).
 */

import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import { buildMirrorRenderBrief } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorRenderBrief';
import {
  buildOpenAIRenderPromptFromPayload,
  MIRROR_V5_NEGATIVE_PROMPT,
} from '@/lib/eza/mirror/conversationMirrorV3/buildOpenAIRenderPrompt';
import { MIRROR_V5_PROMPT_CONTRACT } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import {
  buildMirrorV3IntentFingerprint,
  buildMirrorV3SeedHint,
} from '@/lib/eza/mirror/conversationMirrorV3/sceneCacheFingerprint';
import { getSeasonProfile } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';

/** Backend-accepted style preset (mirror_image_service ALLOWED_STYLE_PRESETS). */
export const MIRROR_V3_STYLE_PRESET = 'eza_mirror_professional_v1' as const;

export function buildVisualPayloadFromMirrorV3(
  payload: SainaMirrorV3Payload,
  options?: {
    personaFamilyId?: PersonaFamilyId;
    seedHint?: string;
  }
): MirrorVisualPromptPayload {
  const renderBrief = buildMirrorRenderBrief(payload);
  const { prompt } = buildOpenAIRenderPromptFromPayload(renderBrief);
  const season = getSeasonProfile(payload.season);
  const seedHint = buildMirrorV3SeedHint(payload, options?.seedHint);

  return {
    characterId: 'saina-mirror-v3',
    characterName: 'SAINA Mirror',
    personaFamilyId: options?.personaFamilyId ?? 'balanced_calm',
    topicLabel: payload.topic,
    atmosphereLabel: season.labelTr,
    emotionLabel: payload.emotionalTone,
    prompt,
    negativePrompt: MIRROR_V5_NEGATIVE_PROMPT,
    stylePreset: MIRROR_V3_STYLE_PRESET,
    promptContract: MIRROR_V5_PROMPT_CONTRACT,
    seedHint,
    qualityHints: [],
    sceneIntentLabel: renderBrief.topicCategory,
    intentFingerprint: buildMirrorV3IntentFingerprint(payload),
    renderMode: 'hybrid_middle',
    hybridTextPayload: {
      headline: payload.mirrorTitle,
      description: '',
      themeTitle: payload.mirrorTitle,
      themeDescription: '',
      quote: '',
    },
    masterPosterText: {
      headline: payload.mirrorTitle,
      quote: '',
    },
    sceneKeywords: payload.visualKeywords,
    usedPromptType: 'hybrid_middle',
  };
}

export { buildMirrorRenderBrief };
export type { MirrorRenderBrief } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
