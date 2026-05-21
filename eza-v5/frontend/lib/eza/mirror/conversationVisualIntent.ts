/**
 * EZA Mirror — Conversation Visual Intent (Sprint 11J).
 * Intent-first cinematic scenes from behavioral cues only — never raw chat text.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { parseStandaloneObservation } from '@/lib/standaloneObservation';
import {
  deriveReflectionSignals,
  type ReflectionSignals,
  type TopicStoryVariantId,
} from '@/lib/eza/mirror/reflectionSignals';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import {
  buildArchitectureStorytellingPhrase,
  EZA_CONTEXT_SCENE_NEGATIVE_AVOID,
  EZA_PREMIUM_STYLIZED_CHARACTER_LOCK,
} from '@/lib/eza/mirror/ezaVisualCanon';
import {
  buildCharacterBiblePhrase,
  resolveCharacterArchetype,
  type CharacterArchetypeId,
} from '@/lib/eza/mirror/ezaCharacterBible';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';

export type ConversationVisualIntentId =
  | 'premium_vehicle_comparison'
  | 'product_comparison'
  | 'financial_decision'
  | 'travel_planning'
  | 'culinary_wellness'
  | 'restoration_research'
  | 'creative_brainstorm'
  | 'friendship_reflection'
  | 'deep_research'
  | 'wellness_calm'
  | 'soft_reflection'
  | 'topic_atmosphere';

export type SceneCompositionTemplateId =
  | 'comparison_scene'
  | 'exploration_scene'
  | 'restoration_scene'
  | 'culinary_scene'
  | 'travel_journey_scene'
  | 'friendship_scene'
  | 'research_scene'
  | 'wellness_scene'
  | 'contemplation_scene';

export type SceneCharacterMode =
  | 'stylized_human'
  | 'topic_archetype'
  | 'environment_first'
  | 'mascot_allowed';

export interface ConversationVisualIntent {
  id: ConversationVisualIntentId;
  /** Safe high-level label for dev QA — no user sentences */
  label: string;
  composition: SceneCompositionTemplateId;
  characterMode: SceneCharacterMode;
  archetypeOverride?: CharacterArchetypeId;
  mizansen: string;
  supportingElements: readonly string[];
  negativeExtras: readonly string[];
}

const COMPARE_CUES = [
  'compare',
  'comparison',
  'versus',
  ' vs ',
  'which',
  'better',
  'between',
  'kıyas',
  'karşılaştır',
  'seçenek',
  'alternative',
  'choice_comparison',
];

const VEHICLE_CUES = [
  'car',
  'auto',
  'vehicle',
  'sedan',
  'suv',
  'drive',
  'driving',
  'konfor',
  'comfort',
  'bmw',
  'mercedes',
  'audi',
  'araba',
  'araç',
  'otomobil',
];

const CULINARY_CUES = [
  'recipe',
  'cook',
  'cooking',
  'kitchen',
  'gluten',
  'food',
  'meal',
  'bake',
  'tarif',
  'mutfak',
  'yemek',
  'culinary',
  'nutrition',
  'beslen',
];

const RESTORATION_CUES = [
  'restoration',
  'restore',
  'heritage',
  'material',
  'stone',
  'sketch',
  'atelier',
  'courtyard',
  'mimari',
  'restorasyon',
  'malzeme',
  'örnek',
  'facade',
];

const TRAVEL_CUES = [
  'travel',
  'trip',
  'journey',
  'route',
  'station',
  'itinerary',
  'seyahat',
  'yolculuk',
  'rota',
  'tren',
  'harita',
  'map',
];

const FRIENDSHIP_CUES = ['friend', 'friendship', 'relationship', 'empathy', 'communicat', 'bağ', 'ilişki'];

const CREATIVE_CUES = ['creative', 'brainstorm', 'idea', 'design', 'art', 'music', 'ilham', 'yarat'];

const COMPOSITION_MIZANSEN: Record<SceneCompositionTemplateId, string> = {
  comparison_scene:
    'A refined cinematic comparison scene in a warm premium studio garage, a thoughtful stylized young adult standing between two sculptural executive sedans without readable badges or logos, soft comparison board glow behind, atmosphere of careful decision-making, elegant editorial realism, emotional stillness, premium lighting, shallow depth of field, integrated human character not mascot',
  exploration_scene:
    'Cinematic open horizon with soft route map on bench, stylized traveler at golden hour contemplating direction, discovery atmosphere, warm sand and dusty blue light, journey planning mood not tourist cliché',
  restoration_scene:
    'Historic restoration atelier with stone wood and ceramic material samples on desk, architectural sketches under warm workshop light, thoughtful designer examining heritage craft, environment-first cinematic detail, stone courtyard visible through window',
  culinary_scene:
    'Warm editorial kitchen with natural morning light, mindful gluten-free baking preparation on wooden counter, soft steam gentle ingredients, caring culinary wellness atmosphere, stylized human presence at frame edge not animal mascot, no packaging text no labels',
  travel_journey_scene:
    'Cinematic train station at dawn, vintage departure hall, leather map and ticket folio on bench, stylized traveler facing luminous tracks, journey anticipation atmosphere, no signage text',
  friendship_scene:
    'Lakeside footbridge at lavender sunset, two silhouettes in soft distance suggesting connection, warm empathy atmosphere, editorial restraint, human scale not cartoon',
  research_scene:
    'Quiet research desk with organized notes material swatches and warm lamp, thoughtful figure studying details, intellectual craft atmosphere, shallow depth of field',
  wellness_scene:
    'Soft wellness morning light through linen curtains, calm hydration and gentle movement props, restorative body-mind atmosphere, minimal character silhouette',
  contemplation_scene:
    'Tranquil threshold between interior and garden light, single stylized figure in quiet reflection, editorial stillness, generous negative space',
};

const INTENT_NEGATIVE: Record<ConversationVisualIntentId, readonly string[]> = {
  premium_vehicle_comparison: [
    'random panda',
    'owl mascot',
    'generic calm portrait',
    'unrelated nature scene',
  ],
  product_comparison: ['mascot', 'random animal', 'empty portrait'],
  financial_decision: ['toy owl', 'childish finance', 'generic panda'],
  travel_planning: ['bean traveler', 'toy train'],
  culinary_wellness: ['deer mascot kitchen', 'panda cooking', 'generic wellness clipart'],
  restoration_research: ['panda architect', 'toy character', 'bean mascot'],
  creative_brainstorm: ['neon toy aesthetic', 'childish art'],
  friendship_reflection: ['dating app avatar', 'child face'],
  deep_research: ['mascot student', 'empty desk stock photo'],
  wellness_calm: ['aggressive gym', 'medical chart UI'],
  soft_reflection: ['busy dashboard', 'cluttered UI'],
  topic_atmosphere: ['generic mascot scene', 'floating character'],
};

function collectBehavioralCueBlob(entries: SavedBehavioralEntry[]): string {
  const parts: string[] = [];
  const recent = [...entries]
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, 6);

  for (const e of recent) {
    const intent = (e.vector.intent ?? '').trim().toLowerCase();
    if (intent) parts.push(intent);

    const obs = parseStandaloneObservation(e.standaloneObservation);
    if (obs?.user_pattern?.signals?.length) {
      parts.push(...obs.user_pattern.signals.map((s) => s.toLowerCase()));
    }
    if (obs?.user_pattern?.category) {
      parts.push(obs.user_pattern.category.toLowerCase());
    }
  }

  return parts.join(' ');
}

function cueMatch(blob: string, cues: readonly string[]): boolean {
  return cues.some((c) => blob.includes(c));
}

function hasCompareCue(blob: string, signals: ReflectionSignals, variant?: TopicStoryVariantId): boolean {
  return (
    cueMatch(blob, COMPARE_CUES) ||
    signals.comparisonIntensity >= 0.42 ||
    variant === 'compare'
  );
}

export interface DeriveConversationVisualIntentInput {
  entries: SavedBehavioralEntry[];
  topicKey: SceneTopicKey;
  storyVariant?: TopicStoryVariantId;
  reflectionSignals?: ReflectionSignals;
  storyTopicKey?: SceneTopicKey;
}

export function deriveConversationVisualIntent(
  input: DeriveConversationVisualIntentInput
): ConversationVisualIntent {
  const signals =
    input.reflectionSignals ?? deriveReflectionSignals(input.entries);
  const blob = collectBehavioralCueBlob(input.entries);
  const comparing = hasCompareCue(blob, signals, input.storyVariant);

  if (comparing && cueMatch(blob, VEHICLE_CUES)) {
    return pack('premium_vehicle_comparison', 'premium car comparison', 'comparison_scene', 'stylized_human');
  }

  if (comparing && (cueMatch(blob, ['product', 'phone', 'laptop', 'model', 'ürün']) || input.topicKey === 'finance')) {
    if (cueMatch(blob, VEHICLE_CUES)) {
      return pack('premium_vehicle_comparison', 'premium car comparison', 'comparison_scene', 'stylized_human');
    }
    return pack('product_comparison', 'thoughtful product comparison', 'comparison_scene', 'stylized_human');
  }

  if (comparing) {
    return pack('financial_decision', 'careful option comparison', 'comparison_scene', 'stylized_human');
  }

  if (cueMatch(blob, CULINARY_CUES) || (input.topicKey === 'health' && cueMatch(blob, ['eat', 'diet', 'recipe', 'tarif']))) {
    return pack('culinary_wellness', 'mindful culinary preparation', 'culinary_scene', 'stylized_human');
  }

  if (cueMatch(blob, RESTORATION_CUES) || input.topicKey === 'architecture') {
    return pack(
      'restoration_research',
      'heritage material study',
      'restoration_scene',
      'environment_first'
    );
  }

  if (cueMatch(blob, TRAVEL_CUES) || input.topicKey === 'travel' || signals.explorationMode >= 0.5) {
    return pack(
      'travel_planning',
      'journey planning atmosphere',
      'travel_journey_scene',
      'topic_archetype',
      'journey_traveler'
    );
  }

  if (cueMatch(blob, FRIENDSHIP_CUES) || input.topicKey === 'friendship') {
    return pack('friendship_reflection', 'gentle connection reflection', 'friendship_scene', 'stylized_human');
  }

  if (cueMatch(blob, CREATIVE_CUES) || input.topicKey === 'creativity') {
    return pack(
      'creative_brainstorm',
      'creative ideation atmosphere',
      'research_scene',
      'topic_archetype',
      'creative_spirit'
    );
  }

  if (signals.detailFocus >= 0.52 || input.storyVariant === 'craft' || input.storyVariant === 'clarify') {
    return pack('deep_research', 'focused study atmosphere', 'research_scene', 'stylized_human');
  }

  if (
    input.topicKey === 'health' &&
    (signals.calmnessLevel >= 0.55 || input.storyVariant === 'nourish' || input.storyVariant === 'stillness')
  ) {
    return pack(
      'wellness_calm',
      'soft wellness calm',
      'wellness_scene',
      'mascot_allowed',
      'compassionate_deer'
    );
  }

  if (
    input.entries.length >= 2 &&
    signals.calmnessLevel >= 0.62 &&
    !comparing &&
    signals.comparisonIntensity < 0.25
  ) {
    return pack('soft_reflection', 'quiet reflective calm', 'contemplation_scene', 'stylized_human');
  }

  if (input.topicKey === 'finance' && !comparing) {
    return pack('financial_decision', 'careful financial reflection', 'research_scene', 'stylized_human');
  }

  return pack('topic_atmosphere', `${input.topicKey} day atmosphere`, mapTopicComposition(input.topicKey), 'topic_archetype');
}

function mapTopicComposition(topic: SceneTopicKey): SceneCompositionTemplateId {
  const map: Record<SceneTopicKey, SceneCompositionTemplateId> = {
    finance: 'research_scene',
    health: 'wellness_scene',
    friendship: 'friendship_scene',
    travel: 'travel_journey_scene',
    architecture: 'restoration_scene',
    creativity: 'research_scene',
    general: 'contemplation_scene',
  };
  return map[topic];
}

function pack(
  id: ConversationVisualIntentId,
  label: string,
  composition: SceneCompositionTemplateId,
  characterMode: SceneCharacterMode,
  archetypeOverride?: CharacterArchetypeId
): ConversationVisualIntent {
  const mizansen = COMPOSITION_MIZANSEN[composition];
  const supporting = [
    'cinematic film still',
    '9:16 vertical composition',
    'left overlay zone kept clean',
    'no text no typography no UI no chat',
    'not a mascot scene unless calm wellness',
  ];
  return {
    id,
    label,
    composition,
    characterMode,
    archetypeOverride,
    mizansen,
    supportingElements: supporting,
    negativeExtras: [...INTENT_NEGATIVE[id], ...EZA_CONTEXT_SCENE_NEGATIVE_AVOID.slice(0, 6)],
  };
}

const STYLIZED_HUMAN_PHRASE = [
  'premium stylized cinematic young adult human character',
  'mature editorial proportions natural fabric',
  'thoughtful expression integrated in scene',
  'not animal mascot not plush not floating portrait',
  EZA_PREMIUM_STYLIZED_CHARACTER_LOCK,
].join(', ');

export function buildConversationScenePromptBlock(intent: ConversationVisualIntent): string {
  return [intent.mizansen, ...intent.supportingElements].join(', ');
}

export function resolveSceneCharacterPhrase(
  intent: ConversationVisualIntent,
  topicKey: SceneTopicKey,
  personaFamilyId: PersonaFamilyId,
  characterName: string
): string {
  if (intent.characterMode === 'stylized_human') {
    const name = characterName.trim();
    return name
      ? `${STYLIZED_HUMAN_PHRASE}, behavior-inspired presence: ${name}`
      : STYLIZED_HUMAN_PHRASE;
  }

  if (intent.characterMode === 'environment_first' && topicKey === 'architecture') {
    return buildArchitectureStorytellingPhrase(characterName);
  }

  if (intent.characterMode === 'environment_first') {
    return [
      'minimal human presence small in frame',
      'environment and materials dominate the scene',
      'thoughtful scale not portrait',
      EZA_PREMIUM_STYLIZED_CHARACTER_LOCK,
    ].join(', ');
  }

  const archetype =
    intent.archetypeOverride ??
    resolveCharacterArchetype(topicKey, personaFamilyId);

  if (intent.characterMode === 'mascot_allowed') {
    return buildCharacterBiblePhrase(archetype, characterName);
  }

  if (archetype === 'calm_panda' && intent.id !== 'soft_reflection' && intent.id !== 'wellness_calm') {
    return STYLIZED_HUMAN_PHRASE;
  }

  return buildCharacterBiblePhrase(archetype, characterName);
}

export function shouldSuppressPandaFallback(intent: ConversationVisualIntent): boolean {
  return intent.characterMode !== 'mascot_allowed' && intent.id !== 'wellness_calm';
}
