/**
 * EZA Mirror — character bible & archetype → prompt phrases.
 */

import { EZA_PREMIUM_STYLIZED_CHARACTER_LOCK } from '@/lib/eza/mirror/ezaVisualCanon';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';

export type CharacterArchetypeId =
  | 'compassionate_deer'
  | 'calm_panda'
  | 'bridge_builder'
  | 'wise_owl'
  | 'journey_traveler'
  | 'creative_spirit';

export interface CharacterArchetypeEntry {
  id: CharacterArchetypeId;
  displayName: string;
  usage: string;
  visual: string[];
  avoid: string[];
}

export const CHARACTER_ARCHETYPES: Record<CharacterArchetypeId, CharacterArchetypeEntry> = {
  compassionate_deer: {
    id: 'compassionate_deer',
    displayName: 'Şefkatli Geyik',
    usage: 'health, self-care, sensitivity, body-mind balance',
    visual: [
      'elegant deer character with soft expressive eyes',
      'cream and lavender natural fabric',
      'wellness and nature atmosphere',
      'calm grounded posture',
      'premium editorial animal portrait',
    ],
    avoid: [
      'doctor costume caricature',
      'child plush toy deer',
      'overly cute mascot deer',
    ],
  },
  calm_panda: {
    id: 'calm_panda',
    displayName: 'Sakin Panda',
    usage: 'slowing down, balance, mindfulness, inner peace',
    visual: [
      'premium fabric-textured calm panda',
      'deep green and cream tones',
      'tea nature zen atmosphere without cliché',
      'peaceful mature expression',
      'editorial collectible character',
    ],
    avoid: ['child panda toy', 'sticker panda', 'plastic toy panda', 'chibi panda'],
  },
  bridge_builder: {
    id: 'bridge_builder',
    displayName: 'Köprü Kurucu',
    usage: 'friendship, communication, connection, repairing bonds',
    visual: [
      'warm refined human bridge-builder character',
      'mature young adult refined facial structure',
      'calm emotional expression premium editorial design',
      'lavender and peach sunset tones',
      'park bridge lakeside empathy mood',
      'not childlike face not generic avatar not cartoon child',
    ],
    avoid: [
      'cartoon human avatar',
      'child face proportions',
      'Pixar child character',
      'anime child face',
      'generic dating app avatar',
      'bean character',
    ],
  },
  wise_owl: {
    id: 'wise_owl',
    displayName: 'Bilgeli Baykuş',
    usage: 'decisions, finance, strategy, direction',
    visual: [
      'academic but modern owl character',
      'quality coat fabric notebook props',
      'city terrace or quiet library mood',
      'green gold cream tones',
      'calm strategic atmosphere',
    ],
    avoid: ['comic owl mascot', 'toy bird', 'dark harsh finance mood', 'cheap mascot owl'],
  },
  journey_traveler: {
    id: 'journey_traveler',
    displayName: 'Keşif Yolcusu',
    usage: 'travel, culture, learning, new places',
    visual: [
      'premium stylized cinematic traveler character',
      'warm golden hour nostalgic journey atmosphere',
      'refined adult explorer silhouette stylized not photorealistic',
      'expressive but subtle warm eyes',
      'layered travel clothing natural fabric textures',
      'scarf coat small leather backpack',
      'cinematic train station or old city atmospheric background',
      'not round bean head not felt toy skin',
      'not photorealistic portrait not real human photo',
    ],
    avoid: [
      'simple bean traveler',
      'round blob character',
      'felt toy skin',
      'toy traveler',
      'child train toy',
      'plastic toy figure',
      'sticker tourist',
      'simplified mascot explorer',
    ],
  },
  creative_spirit: {
    id: 'creative_spirit',
    displayName: 'Yaratıcı Ruh',
    usage: 'art, music, ideas, design',
    visual: [
      'colorful but premium creative character',
      'art studio music corner quality materials',
      'soft sunset window light',
      'calm inspired expression',
      'editorial creative atmosphere',
    ],
    avoid: ['bright childish drawing style', 'cheap sticker art', 'neon toy aesthetic'],
  },
};

/** Primary archetype per scene topic. */
export const TOPIC_TO_ARCHETYPE: Record<SceneTopicKey, CharacterArchetypeId> = {
  health: 'compassionate_deer',
  finance: 'wise_owl',
  friendship: 'bridge_builder',
  travel: 'journey_traveler',
  architecture: 'calm_panda',
  creativity: 'creative_spirit',
  general: 'calm_panda',
};

/** Optional persona bias when topic is general or ambiguous. */
export const PERSONA_TO_ARCHETYPE: Partial<Record<PersonaFamilyId, CharacterArchetypeId>> = {
  balanced_calm: 'calm_panda',
  sensitive_careful: 'bridge_builder',
  decision_direction: 'wise_owl',
  planning_structure: 'wise_owl',
  fast_practical: 'wise_owl',
  curiosity_exploration: 'journey_traveler',
  ideation_creation: 'creative_spirit',
  deep_thinking: 'calm_panda',
  clarity_simplification: 'wise_owl',
  trust_verification: 'journey_traveler',
};

export function resolveCharacterArchetype(
  topicKey: SceneTopicKey,
  personaFamilyId?: PersonaFamilyId
): CharacterArchetypeId {
  if (personaFamilyId && PERSONA_TO_ARCHETYPE[personaFamilyId]) {
    const biased = PERSONA_TO_ARCHETYPE[personaFamilyId]!;
    if (topicKey === 'general') {
      return biased;
    }
  }
  return TOPIC_TO_ARCHETYPE[topicKey];
}

export function buildCharacterBiblePhrase(
  archetypeId: CharacterArchetypeId,
  behaviorCharacterName: string
): string {
  const entry = CHARACTER_ARCHETYPES[archetypeId];
  const name = behaviorCharacterName.trim();
  const presence = name
    ? `behavior-inspired presence: ${name}, same EZA canon character family`
    : 'EZA canon character';
  const closing =
    archetypeId === 'journey_traveler'
      ? 'single refined adult traveler in scene, not a toy explorer'
      : 'single mature premium editorial character in scene';
  return [
    `EZA character archetype: ${entry.displayName}`,
    ...entry.visual,
    EZA_PREMIUM_STYLIZED_CHARACTER_LOCK,
    `avoid: ${entry.avoid.join(', ')}`,
    presence,
    closing,
  ].join(', ');
}
