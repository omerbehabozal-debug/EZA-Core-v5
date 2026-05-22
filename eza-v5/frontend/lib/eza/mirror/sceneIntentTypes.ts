/** Shared scene intent types (avoids circular imports between mirror modules). */

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
