/**
 * Whitelist scene keywords per subtopic — image-prompt safe, no raw chat.
 */

import type { SceneSubtopicId } from '@/lib/eza/mirror/sceneSubtopicTypes';
import { MAX_SCENE_KEYWORDS } from '@/lib/eza/mirror/sceneSubtopicTypes';

export type SceneKeywordProfile = {
  sceneKeywords: readonly string[];
  environmentOverride?: string;
  heroObjectOverrides?: readonly string[];
};

export const SCENE_KEYWORD_REGISTRY: Record<SceneSubtopicId, SceneKeywordProfile> = {
  travel_silk_road: {
    sceneKeywords: ['samarkand', 'registan', 'blue_tiles', 'silk_road', 'historic_madrasah'],
    environmentOverride: 'Registan square at golden hour, blue tile madrasah facades, Silk Road caravan atmosphere',
    heroObjectOverrides: ['blue tile madrasah facade', 'caravan route map', 'historic Registan plaza'],
  },
  travel_samarkand: {
    sceneKeywords: ['samarkand', 'registan', 'blue_tiles', 'historic_madrasah'],
    environmentOverride: 'Samarkand Registan plaza, luminous blue ceramic tiles',
    heroObjectOverrides: ['Registan tilework', 'historic madrasah arch'],
  },
  travel_bukhara: {
    sceneKeywords: ['bukhara', 'old_city', 'timurid_heritage', 'caravanserai'],
    environmentOverride: 'Bukhara old city gate, timeworn brick and carved portal',
    heroObjectOverrides: ['old city gate', 'caravanserai courtyard light'],
  },
  travel_uzbekistan: {
    sceneKeywords: ['silk_road', 'central_asia', 'caravanserai'],
    environmentOverride: 'Central Asian Silk Road horizon, desert warmth and caravan trail',
    heroObjectOverrides: ['Silk Road route scroll', 'caravanserai silhouette'],
  },
  travel_generic_journey: {
    sceneKeywords: ['journey_map', 'train_platform', 'open_horizon'],
    environmentOverride: 'train station at golden hour, journey decision energy',
  },
  arch_mosque_heritage: {
    sceneKeywords: ['mosque_courtyard', 'minaret_silhouette', 'islamic_geometry', 'stone_portal'],
    environmentOverride: 'historic mosque courtyard, minaret silhouette at warm light',
    heroObjectOverrides: ['stone portal arch', 'geometric tile pattern', 'minaret silhouette'],
  },
  arch_facade_restoration: {
    sceneKeywords: ['historic_facade', 'stone_details', 'restoration_scaffold', 'material_samples'],
    environmentOverride: 'heritage facade study, stone facing and restoration scaffold',
    heroObjectOverrides: ['facade stone samples', 'restoration scaffold detail'],
  },
  arch_material_study: {
    sceneKeywords: ['restoration_atelier', 'archival_drawings', 'stone_samples', 'heritage_craft'],
    environmentOverride: 'restoration atelier with archival drawings and stone samples',
    heroObjectOverrides: ['archival drawings', 'lime mortar samples', 'heritage craft tools'],
  },
  vehicle_luxury_sedan_comparison: {
    sceneKeywords: ['premium_showroom', 'luxury_sedan', 'comparison_stage', 'cinematic_reflections'],
    environmentOverride: 'warm premium indoor showroom or garage studio',
    heroObjectOverrides: ['two premium executive sedans', 'comparison board', 'comfort priority cues'],
  },
  vehicle_suv_comparison: {
    sceneKeywords: ['premium_suv', 'elevated_stance', 'modern_showroom', 'cinematic_reflections'],
    environmentOverride: 'modern premium SUV showroom with elevated stance lighting',
    heroObjectOverrides: ['two premium SUVs', 'comparison plinth', 'elevated stance silhouettes'],
  },
  vehicle_ev_comparison: {
    sceneKeywords: ['electric_vehicle', 'charging_light', 'quiet_power', 'futuristic_garage'],
    environmentOverride: 'futuristic garage studio with soft charging light',
    heroObjectOverrides: ['electric vehicle silhouettes', 'charging light cues', 'quiet power mood board'],
  },
  tech_coding_ai: {
    sceneKeywords: ['developer_workspace', 'code_editor_glow', 'ai_pair_programming', 'dark_product_lab'],
    environmentOverride: 'developer workspace with code editor glow and AI pair programming mood',
    heroObjectOverrides: ['code editor screen glow', 'AI pair programming desk', 'dark product lab'],
  },
  tech_product_building: {
    sceneKeywords: ['product_roadmap_board', 'startup_whiteboard', 'wireframe_sketches', 'product_strategy_room'],
    environmentOverride: 'startup product strategy room with roadmap board',
    heroObjectOverrides: ['product roadmap board', 'wireframe sketches', 'startup whiteboard'],
  },
  tech_startup_strategy: {
    sceneKeywords: ['platform_strategy', 'product_vision', 'startup_command_center', 'ai_governance_dashboard'],
    environmentOverride: 'startup command center with platform strategy boards',
    heroObjectOverrides: ['platform strategy wall', 'product vision board', 'governance dashboard cues'],
  },
  topic_generic: {
    sceneKeywords: ['editorial_calm', 'window_light', 'reflective_threshold'],
  },
};

export function getSceneKeywordProfile(subtopic: SceneSubtopicId): SceneKeywordProfile {
  return SCENE_KEYWORD_REGISTRY[subtopic] ?? SCENE_KEYWORD_REGISTRY.topic_generic;
}

export function resolveSceneKeywords(subtopic: SceneSubtopicId): string[] {
  return [...getSceneKeywordProfile(subtopic).sceneKeywords].slice(0, MAX_SCENE_KEYWORDS);
}
