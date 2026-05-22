/**
 * Intent → cinematic composition mathematics (depth, light, tension).
 */

import type {
  ConversationVisualIntentId,
  SceneCompositionTemplateId,
} from '@/lib/eza/mirror/sceneIntentTypes';
import type { ReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';
import type { TopicStoryVariantId } from '@/lib/eza/mirror/reflectionSignals';

export type EmotionalTensionId =
  | 'active_comparison'
  | 'careful_selection'
  | 'analytical_weighing'
  | 'creative_production'
  | 'exploratory_discovery'
  | 'gentle_preparation'
  | 'reflective_pause';

export type CompositionDepthSpec = {
  foreground: string;
  midground: string;
  background: string;
  lightDirection: string;
  atmosphereSeparation: string;
};

export type IntentCompositionSpec = {
  templateId: SceneCompositionTemplateId;
  tensionDefault: EmotionalTensionId;
  subjectAction: string;
  depth: CompositionDepthSpec;
  avoidFlatPortrait: readonly string[];
};

const DEPTH_DEFAULT: CompositionDepthSpec = {
  foreground: 'foreground hero objects sharp tactile detail',
  midground: 'midground human figure smaller scale engaged in action',
  background: 'background environment soft atmospheric depth cinematic falloff',
  lightDirection: 'key light from window left warm rim on subject',
  atmosphereSeparation: 'clear separation between subject objects and environment haze',
};

const SPECS: Record<SceneCompositionTemplateId, IntentCompositionSpec> = {
  comparison_scene: {
    templateId: 'comparison_scene',
    tensionDefault: 'active_comparison',
    subjectAction:
      'stylized young adult seen from behind or three-quarter studying two options pausing before decision not posing for camera',
    depth: {
      foreground: 'foreground car silhouettes or option plinths crisp edge light',
      midground: 'midground figure between options leaning toward comparison board',
      background: 'background premium garage or studio with soft practical lamps',
      lightDirection: 'warm key from left windows golden rim on metal surfaces',
      atmosphereSeparation: 'depth haze between cars and back wall film still separation',
    },
    avoidFlatPortrait: ['centered face portrait', 'idle standing', 'empty background'],
  },
  restoration_scene: {
    templateId: 'restoration_scene',
    tensionDefault: 'analytical_weighing',
    subjectAction:
      'designer hands adjusting stone sample or tracing sketch absorbed in material study not looking at viewer',
    depth: {
      foreground: 'foreground material samples and mortar tools in sharp focus',
      midground: 'midground desk sketches and measuring tools',
      background: 'background stone courtyard through workshop window soft depth',
      lightDirection: 'warm workshop side light dust particles in beam',
      atmosphereSeparation: 'layered craft atmosphere heritage editorial',
    },
    avoidFlatPortrait: ['architect portrait', 'empty office', 'toy character'],
  },
  culinary_scene: {
    templateId: 'culinary_scene',
    tensionDefault: 'gentle_preparation',
    subjectAction:
      'hands kneading arranging ingredients recipe preparation in motion caring focus not selfie',
    depth: {
      foreground: 'foreground cutting board ingredients steam detail',
      midground: 'midground counter workflow and bowl arrangement',
      background: 'background soft kitchen shelves morning window bokeh',
      lightDirection: 'soft morning window key warm fill from counter',
      atmosphereSeparation: 'steam layer separates foreground from background',
    },
    avoidFlatPortrait: ['chef portrait', 'empty kitchen stock', 'mascot animal'],
  },
  travel_journey_scene: {
    templateId: 'travel_journey_scene',
    tensionDefault: 'exploratory_discovery',
    subjectAction:
      'traveler mid-step or seated on bench studying map ticket folio departure energy not tourist selfie',
    depth: {
      foreground: 'foreground map ticket bench leather texture',
      midground: 'midground figure silhouette toward luminous tracks',
      background: 'background departure hall tracks horizon depth',
      lightDirection: 'dawn cool ambient warm platform practicals',
      atmosphereSeparation: 'atmospheric perspective down platform film still',
    },
    avoidFlatPortrait: ['walking away centered portrait', 'bean traveler'],
  },
  exploration_scene: {
    templateId: 'exploration_scene',
    tensionDefault: 'exploratory_discovery',
    subjectAction: 'figure at horizon line contemplating route open landscape decision',
    depth: {
      ...DEPTH_DEFAULT,
      background: 'background open horizon route map on bench golden hour',
    },
    avoidFlatPortrait: ['stock landscape only'],
  },
  friendship_scene: {
    templateId: 'friendship_scene',
    tensionDefault: 'reflective_pause',
    subjectAction:
      'two implied presences across bridge or shared bench moment empathy not confrontation',
    depth: {
      foreground: 'foreground bench cups soft detail',
      midground: 'midground bridge silhouette lavender light',
      background: 'background lake trees atmospheric depth',
      lightDirection: 'sunset warm key long shadows',
      atmosphereSeparation: 'mist on water separates planes',
    },
    avoidFlatPortrait: ['dating app pose', 'single centered face'],
  },
  research_scene: {
    templateId: 'research_scene',
    tensionDefault: 'analytical_weighing',
    subjectAction:
      'figure leaning over desk comparing notes material swatches intellectual focus',
    depth: {
      foreground: 'foreground swatches notes lamp base sharp',
      midground: 'midground desk organization',
      background: 'background bookshelf soft blur warm study',
      lightDirection: 'desk lamp key soft ambient fill',
      atmosphereSeparation: 'shallow depth of field editorial study',
    },
    avoidFlatPortrait: ['student stock photo', 'empty desk'],
  },
  wellness_scene: {
    templateId: 'wellness_scene',
    tensionDefault: 'gentle_preparation',
    subjectAction: 'minimal silhouette ritual movement hydration calm agency not passive slouch',
    depth: {
      foreground: 'foreground ritual props linen bowl',
      midground: 'midground soft figure silhouette',
      background: 'background curtain window light',
      lightDirection: 'diffused morning key gentle rim',
      atmosphereSeparation: 'soft haze restorative not clinical',
    },
    avoidFlatPortrait: ['gym bro', 'medical chart'],
  },
  contemplation_scene: {
    templateId: 'contemplation_scene',
    tensionDefault: 'reflective_pause',
    subjectAction:
      'single figure at threshold looking into light quiet decision not blank stare at camera',
    depth: {
      foreground: 'foreground door frame shadow detail',
      midground: 'midground figure small in frame',
      background: 'background garden light generous space',
      lightDirection: 'backlit threshold warm interior cool exterior',
      atmosphereSeparation: 'strong interior exterior separation editorial still',
    },
    avoidFlatPortrait: ['centered portrait', 'wallpaper composition'],
  },
};

const TENSION_PHRASES: Record<EmotionalTensionId, string> = {
  active_comparison: 'visible decision tension weighing two paths energy in the room',
  careful_selection: 'careful selection moment paused before commitment',
  analytical_weighing: 'organized analytical focus comparing criteria quietly',
  creative_production: 'creative production energy ideas taking physical form',
  exploratory_discovery: 'exploratory discovery forward-looking journey energy',
  gentle_preparation: 'gentle preparation ritual mindful hands in progress',
  reflective_pause: 'reflective pause stillness with inner momentum not emptiness',
};

export function resolveEmotionalTension(
  intentId: ConversationVisualIntentId,
  signals: ReflectionSignals,
  storyVariant?: TopicStoryVariantId
): EmotionalTensionId {
  const spec = SPECS[mapIntentToComposition(intentId)] ?? SPECS.contemplation_scene;

  if (storyVariant === 'compare' || signals.comparisonIntensity >= 0.5) {
    return intentId.includes('comparison') || intentId === 'financial_decision'
      ? 'active_comparison'
      : 'careful_selection';
  }
  if (signals.decisiveness >= 0.55) return 'careful_selection';
  if (signals.explorationMode >= 0.55) return 'exploratory_discovery';
  if (signals.detailFocus >= 0.52) return 'analytical_weighing';
  if (storyVariant === 'craft' || storyVariant === 'clarify') return 'analytical_weighing';
  if (storyVariant === 'nourish' || storyVariant === 'flow') return 'gentle_preparation';
  if (signals.calmnessLevel >= 0.65 && signals.comparisonIntensity < 0.3) {
    return 'reflective_pause';
  }
  return spec.tensionDefault;
}

function mapIntentToComposition(intentId: ConversationVisualIntentId): SceneCompositionTemplateId {
  const map: Record<ConversationVisualIntentId, SceneCompositionTemplateId> = {
    premium_vehicle_comparison: 'comparison_scene',
    product_comparison: 'comparison_scene',
    financial_decision: 'research_scene',
    travel_planning: 'travel_journey_scene',
    culinary_wellness: 'culinary_scene',
    restoration_research: 'restoration_scene',
    creative_brainstorm: 'research_scene',
    friendship_reflection: 'friendship_scene',
    deep_research: 'research_scene',
    wellness_calm: 'wellness_scene',
    soft_reflection: 'contemplation_scene',
    topic_atmosphere: 'contemplation_scene',
  };
  return map[intentId];
}

export function getIntentCompositionSpec(
  composition: SceneCompositionTemplateId
): IntentCompositionSpec {
  return SPECS[composition];
}

export function getTensionPhrase(tension: EmotionalTensionId): string {
  return TENSION_PHRASES[tension];
}

export function buildDepthLayerPhrases(depth: CompositionDepthSpec): string[] {
  return [
    depth.foreground,
    depth.midground,
    depth.background,
    depth.lightDirection,
    depth.atmosphereSeparation,
  ];
}
