/**
 * Mirror V2 — adapt payload to V1 MirrorVisualPromptPayload for scene API compatibility.
 */

import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { SainaMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/types';
import {
  buildMirrorV2ImagePrompt,
  MIRROR_V2_NEGATIVE_PROMPT,
} from '@/lib/eza/mirror/conversationMirrorV2/promptBuilder';
import { getSeasonProfile } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';

export function buildVisualPayloadFromMirrorV2(
  payload: SainaMirrorPayload,
  options?: {
    personaFamilyId?: PersonaFamilyId;
    seedHint?: string;
  }
): MirrorVisualPromptPayload {
  const prompt = buildMirrorV2ImagePrompt(payload);
  const season = getSeasonProfile(payload.season);
  const seedHint = options?.seedHint ?? `v2-${payload.conversationId}-${payload.season}`;

  return {
    characterId: 'saina-mirror-v2',
    characterName: 'SAINA Mirror',
    personaFamilyId: options?.personaFamilyId ?? 'balanced_calm',
    topicLabel: payload.topic,
    atmosphereLabel: season.labelTr,
    emotionLabel: payload.emotionalTone,
    prompt,
    negativePrompt: MIRROR_V2_NEGATIVE_PROMPT,
    stylePreset: `saina_mirror_v2_${payload.season}`,
    seedHint,
    qualityHints: [
      'vertical 4:5 poster 1080x1350',
      'premium cinematic editorial',
      'low text density',
      'logo safe zone top-left',
      'date safe zone top-right',
    ],
    sceneIntentLabel: payload.sceneMetaphor.slice(0, 120),
    intentFingerprint: `v2:${payload.season}:${payload.emotionalTone}:${payload.topic}`,
    renderMode: 'hybrid_middle',
    hybridTextPayload: {
      headline: payload.mirrorTitle,
      description: payload.mirrorText,
      themeTitle: payload.topic,
      themeDescription: payload.topicSummary,
      quote: payload.closingLine ?? payload.mirrorText,
    },
    masterPosterText: {
      headline: payload.mirrorTitle,
      quote: payload.mirrorText,
    },
    sceneKeywords: payload.visualKeywords,
    usedPromptType: 'hybrid_middle',
  };
}
