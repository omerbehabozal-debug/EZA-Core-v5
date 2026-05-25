/**
 * Daily Mirror scene image — UI/runtime merge helpers.
 */

import type {
  DailyMirrorCardModel,
  MirrorSceneImageStatus,
} from '@/lib/eza/mirror/types';

export type DailyCardSceneVisualExtras = {
  imageProvider?: string;
  hybridOcrProbe?: string;
  hybridFallbackReason?: string;
};

export function mergeDailyCardSceneVisual(
  card: DailyMirrorCardModel,
  sceneImageUrl: string | null,
  sceneImageStatus: MirrorSceneImageStatus,
  extras?: DailyCardSceneVisualExtras
): DailyMirrorCardModel {
  if (!card.visual) {
    if (!sceneImageUrl && sceneImageStatus === 'idle' && !extras) {
      return card;
    }
    return {
      ...card,
      visual: {
        characterId: '',
        characterName: card.characterName,
        personaFamilyId: card.personaFamilyId,
        topicLabel: '',
        atmosphereLabel: '',
        emotionLabel: '',
        prompt: '',
        negativePrompt: '',
        stylePreset: '',
        seedHint: '',
        qualityHints: [],
        sceneImageUrl,
        sceneImageStatus,
        ...extras,
      },
    };
  }

  return {
    ...card,
    visual: {
      ...card.visual,
      sceneImageUrl,
      sceneImageStatus,
      ...(extras?.imageProvider ? { imageProvider: extras.imageProvider } : {}),
      ...(extras?.hybridOcrProbe ? { hybridOcrProbe: extras.hybridOcrProbe } : {}),
      ...(extras?.hybridFallbackReason
        ? { hybridFallbackReason: extras.hybridFallbackReason, hybridTextRisk: true }
        : {}),
    },
  };
}
