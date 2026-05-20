/**
 * Daily Mirror scene image — UI/runtime merge helpers.
 */

import type {
  DailyMirrorCardModel,
  MirrorSceneImageStatus,
} from '@/lib/eza/mirror/types';

export function mergeDailyCardSceneVisual(
  card: DailyMirrorCardModel,
  sceneImageUrl: string | null,
  sceneImageStatus: MirrorSceneImageStatus
): DailyMirrorCardModel {
  if (!card.visual) {
    if (!sceneImageUrl && sceneImageStatus === 'idle') {
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
      },
    };
  }

  return {
    ...card,
    visual: {
      ...card.visual,
      sceneImageUrl,
      sceneImageStatus,
    },
  };
}
