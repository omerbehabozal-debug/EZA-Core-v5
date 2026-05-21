/**
 * EZA Mirror — professional visual style contract (re-exports EZA Visual Canon).
 * UI typography and metrics stay on the frontend card — never in the AI image.
 */

export {
  DEFAULT_ATMOSPHERE_LABEL,
  DEFAULT_EMOTION_LABEL,
} from '@/lib/eza/mirror/visualPromptPresets';

export {
  EZA_ARCHITECTURE_STYLE_CONTRACT,
  EZA_ARCHITECTURE_STORYTELLING_CORE,
  EZA_GLOBAL_STYLE_LOCK,
  EZA_PREMIUM_STYLIZED_CHARACTER_LOCK,
  EZA_STYLIZED_NEGATIVE_AVOID,
  EZA_VISUAL_STYLE_CONTRACT,
  STANDARD_NEGATIVE_PROMPT,
  PROMPT_COMPOSITION_RULES,
  VISUAL_QUALITY_HINTS,
  STYLE_PRESET,
  buildArchitectureScenePhrase,
  buildArchitectureStorytellingPhrase,
  ARCHITECTURE_QUALITY_HINTS,
  buildMirrorNegativePrompt,
  buildVisualCanonLayers,
} from '@/lib/eza/mirror/ezaVisualCanon';

export { buildCharacterBiblePhrase, resolveCharacterArchetype } from '@/lib/eza/mirror/ezaCharacterBible';

import { buildCharacterBiblePhrase, resolveCharacterArchetype } from '@/lib/eza/mirror/ezaCharacterBible';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';

/** @deprecated Use buildCharacterBiblePhrase — kept for importers. */
export function buildCharacterPresencePhrase(
  characterName: string,
  topicKey: SceneTopicKey = 'general',
  personaFamilyId?: PersonaFamilyId
): string {
  const archetype = resolveCharacterArchetype(topicKey, personaFamilyId);
  return buildCharacterBiblePhrase(archetype, characterName);
}
