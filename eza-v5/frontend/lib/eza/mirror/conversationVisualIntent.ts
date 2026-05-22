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
import type {
  ConversationVisualIntentId as IntentId,
  SceneCompositionTemplateId as CompositionId,
  SceneCharacterMode as CharMode,
} from '@/lib/eza/mirror/sceneIntentTypes';

export type {
  ConversationVisualIntentId,
  SceneCompositionTemplateId,
  SceneCharacterMode,
} from '@/lib/eza/mirror/sceneIntentTypes';

export interface ConversationVisualIntent {
  id: IntentId;
  /** Safe high-level label for dev QA — no user sentences */
  label: string;
  composition: CompositionId;
  characterMode: CharMode;
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

const COMPOSITION_MIZANSEN: Record<CompositionId, string> = {
  comparison_scene:
    'cinematic decision moment premium garage studio two executive sedans as story anchors comparison board glow human studying options from behind not portrait',
  exploration_scene:
    'open horizon route map on bench golden hour traveler leaning forward choosing direction discovery energy film still',
  restoration_scene:
    'heritage restoration atelier stone samples sketches mortar tools designer hands mid-study courtyard light through window craft intelligence',
  culinary_scene:
    'warm kitchen production moment hands preparing natural ingredients steam wooden board recipe cards without text mindful culinary craft',
  travel_journey_scene:
    'dawn train platform ticket folio route map on bench figure toward luminous tracks journey decision energy editorial travel still',
  friendship_scene:
    'lakeside bridge shared bench two presences empathy connection golden hour not confrontation editorial human scale',
  research_scene:
    'organized desk comparison notes material swatches lamp figure leaning in analytical focus intellectual craft shallow depth',
  wellness_scene:
    'morning ritual hydration gentle movement linen light restorative agency calm energy not spa stock photo',
  contemplation_scene:
    'threshold interior to garden light figure pausing before step reflective momentum generous space editorial still',
};

const INTENT_NEGATIVE: Record<IntentId, readonly string[]> = {
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

  if (
    input.topicKey === 'finance' &&
    !comparing &&
    (cueMatch(blob, ['budget', 'bütçe', 'risk', 'spend', 'saving', 'invest']) ||
      signals.detailFocus >= 0.4)
  ) {
    return pack('financial_decision', 'organized financial decision study', 'research_scene', 'stylized_human');
  }

  return pack('topic_atmosphere', `${input.topicKey} day atmosphere`, mapTopicComposition(input.topicKey), 'topic_archetype');
}

function mapTopicComposition(topic: SceneTopicKey): CompositionId {
  const map: Record<SceneTopicKey, CompositionId> = {
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
  id: IntentId,
  label: string,
  composition: CompositionId,
  characterMode: CharMode,
  archetypeOverride?: CharacterArchetypeId
): ConversationVisualIntent {
  const mizansen = COMPOSITION_MIZANSEN[composition];
  const supporting = [
    'editorial campaign key visual film still not generic AI art',
    '9:16 vertical composition foreground midground depth separation',
    'left and top overlay safe zones kept uncluttered',
    'no readable text no logos no UI no chat bubbles no screenshots',
    'hero objects carry topic memory human is participant not wallpaper subject',
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
  'premium stylized cinematic young adult human',
  'caught mid-action thinking preparing comparing not posing',
  'mature editorial proportions natural fabric',
  'integrated in scene scale not dominant portrait',
  'not animal mascot not plush not centered wallpaper face',
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
