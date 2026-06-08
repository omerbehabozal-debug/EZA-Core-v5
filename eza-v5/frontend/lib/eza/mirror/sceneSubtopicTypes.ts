/**
 * Scene subtopic model — privacy-safe visual world within a story topic.
 */

export type SceneSubtopicId =
  | 'travel_silk_road'
  | 'travel_samarkand'
  | 'travel_bukhara'
  | 'travel_uzbekistan'
  | 'travel_spain'
  | 'travel_andalusia'
  | 'travel_mardin'
  | 'travel_generic_journey'
  | 'arch_mosque_heritage'
  | 'arch_mardin_heritage'
  | 'arch_mardin_stone'
  | 'arch_vault_study'
  | 'arch_facade_restoration'
  | 'arch_material_study'
  | 'vehicle_suv_comparison'
  | 'vehicle_luxury_sedan_comparison'
  | 'vehicle_ev_comparison'
  | 'tech_coding_ai'
  | 'tech_product_building'
  | 'tech_startup_strategy'
  | 'topic_generic';

export interface SceneSubtopicResolution {
  primarySubtopic: SceneSubtopicId;
  secondarySubtopic?: SceneSubtopicId;
  sceneKeywords: string[];
  environmentOverride?: string;
  heroObjectOverrides?: string[];
  confidence: number;
  sourceCueTokens: string[];
}

export interface MasterPosterText {
  headline: string;
  quote: string;
}

export const MASTER_POSTER_HEADLINE_MAX = 28;
export const MASTER_POSTER_QUOTE_MAX = 70;
export const MAX_SCENE_KEYWORDS = 6;
export const MAX_SOURCE_CUE_TOKENS = 12;
