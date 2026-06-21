/**
 * Mirror V3 — adapt payload to scene API (OpenAI owns all poster typography).
 */

import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { SainaMirrorV3Payload } from '@/lib/eza/mirror/conversationMirrorV3/types';
import {
  buildMirrorV3ImagePrompt,
  MIRROR_V3_NEGATIVE_PROMPT,
} from '@/lib/eza/mirror/conversationMirrorV3/promptBuilderV3';
import {
  buildConversationMirrorV4QualityReport,
  shouldRegeneratePromptForTopicVisibility,
} from '@/lib/eza/mirror/conversationMirrorV3/conversationMirrorV33Quality';
import {
  buildMirrorV3IntentFingerprint,
  buildMirrorV3SeedHint,
} from '@/lib/eza/mirror/conversationMirrorV3/sceneCacheFingerprint';
import { getSeasonProfile } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';

/** Backend-accepted style preset (mirror_image_service ALLOWED_STYLE_PRESETS). */
export const MIRROR_V3_STYLE_PRESET = 'eza_mirror_professional_v1' as const;

/** Reinforce prompt when topic visibility score is below V4 target (≥ 8). */
function applyTopicVisibilityQualityGate(
  payload: SainaMirrorV3Payload,
  prompt: string
): string {
  const report = buildConversationMirrorV4QualityReport(payload, prompt);
  if (!shouldRegeneratePromptForTopicVisibility(report)) {
    return prompt;
  }

  return [
    prompt,
    '',
    'QUALITY GATE — topic visibility below target:',
    'Strengthen hero scene and concrete conversation evidence visibility.',
    'A stranger must identify the topic within 3 seconds — no generic emotional fallback.',
    `Primary evidence: ${payload.conversationEvidence[0]?.label ?? payload.selectedTopic}.`,
    `Hero scene: ${payload.sceneComposition?.evidenceFusionScene ?? payload.sceneMetaphor}.`,
  ].join('\n');
}

export function buildVisualPayloadFromMirrorV3(
  payload: SainaMirrorV3Payload,
  options?: {
    personaFamilyId?: PersonaFamilyId;
    seedHint?: string;
  }
): MirrorVisualPromptPayload {
  const prompt = applyTopicVisibilityQualityGate(
    payload,
    buildMirrorV3ImagePrompt(payload)
  );
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
    negativePrompt: MIRROR_V3_NEGATIVE_PROMPT,
    stylePreset: MIRROR_V3_STYLE_PRESET,
    seedHint,
    qualityHints: [
      '50mm editorial lens, T2.8, natural color grade, subtle film grain',
      'single motivated light source, 3-layer depth, 40% negative space for type',
      'printed poster typography integrated into scene',
      'documentary authenticity, not fantasy illustration',
      'vertical 4:5 poster 1080x1350',
      'openai composes all typography in-image',
      'logo safe zone top-left, date safe zone top-right',
    ],
    sceneIntentLabel: (payload.sceneComposition?.heroScene ?? payload.sceneMetaphor).slice(
      0,
      120
    ),
    intentFingerprint: buildMirrorV3IntentFingerprint(payload),
    renderMode: 'hybrid_middle',
    hybridTextPayload: {
      headline: payload.mirrorTitle,
      description: payload.mirrorText,
      themeTitle: payload.mirrorTitle,
      themeDescription: payload.mirrorText,
      quote: payload.closingLine ?? '',
    },
    masterPosterText: {
      headline: payload.mirrorTitle,
      quote: payload.mirrorText,
    },
    sceneKeywords: payload.visualKeywords,
    usedPromptType: 'hybrid_middle',
  };
}
