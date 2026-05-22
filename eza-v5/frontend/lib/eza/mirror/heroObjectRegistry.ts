/**
 * Hero objects — conversation memory anchors (not characters).
 */

import type {
  ConversationVisualIntentId,
  SceneCompositionTemplateId,
} from '@/lib/eza/mirror/sceneIntentTypes';

export type HeroObjectId =
  | 'dual_executive_sedans'
  | 'comparison_priority_board'
  | 'product_pair_study'
  | 'financial_compare_notebook'
  | 'stone_material_samples'
  | 'restoration_sketch_desk'
  | 'culinary_prep_station'
  | 'travel_ticket_map'
  | 'creative_idea_wall'
  | 'friendship_bridge_table'
  | 'research_material_swatch'
  | 'wellness_ritual_props'
  | 'contemplation_threshold';

export type HeroObjectSpec = {
  id: HeroObjectId;
  label: string;
  /** Primary visual anchor — must read without text */
  objectPhrase: string;
  secondaryProps: readonly string[];
};

const HERO_BY_INTENT: Record<ConversationVisualIntentId, HeroObjectId> = {
  premium_vehicle_comparison: 'dual_executive_sedans',
  product_comparison: 'product_pair_study',
  financial_decision: 'financial_compare_notebook',
  travel_planning: 'travel_ticket_map',
  culinary_wellness: 'culinary_prep_station',
  restoration_research: 'stone_material_samples',
  creative_brainstorm: 'creative_idea_wall',
  friendship_reflection: 'friendship_bridge_table',
  deep_research: 'research_material_swatch',
  wellness_calm: 'wellness_ritual_props',
  soft_reflection: 'contemplation_threshold',
  topic_atmosphere: 'contemplation_threshold',
};

const HERO_SPECS: Record<HeroObjectId, HeroObjectSpec> = {
  dual_executive_sedans: {
    id: 'dual_executive_sedans',
    label: 'two premium options',
    objectPhrase:
      'two sculptural executive sedans as hero objects flanking midground without readable badges logos or license plates',
    secondaryProps: [
      'handwritten priority checklist on easel glow',
      'warm premium garage studio depth',
      'decision energy not showroom catalog',
    ],
  },
  comparison_priority_board: {
    id: 'comparison_priority_board',
    label: 'comparison board',
    objectPhrase:
      'soft-lit comparison board with abstract criteria columns as hero object center midground',
    secondaryProps: ['two option silhouettes on desk', 'organized decision atmosphere'],
  },
  product_pair_study: {
    id: 'product_pair_study',
    label: 'product pair',
    objectPhrase:
      'two premium product silhouettes on matte plinth as hero objects with comparison notes',
    secondaryProps: ['pros cons abstract shapes no brand text', 'editorial product study lighting'],
  },
  financial_compare_notebook: {
    id: 'financial_compare_notebook',
    label: 'finance notebook',
    objectPhrase:
      'open comparison notebook with tidy columns and soft calculator as hero objects on walnut desk',
    secondaryProps: [
      'organized analytical calm',
      'simplified option cards without readable numbers',
      'measured decision tension',
    ],
  },
  stone_material_samples: {
    id: 'stone_material_samples',
    label: 'heritage materials',
    objectPhrase:
      'stone ceramic and mortar material samples with heritage sketches as hero objects dominating desk',
    secondaryProps: [
      'restoration atelier warm window',
      'courtyard light through arch',
      'technical craft study not portrait',
    ],
  },
  restoration_sketch_desk: {
    id: 'restoration_sketch_desk',
    label: 'restoration desk',
    objectPhrase:
      'layered facade sketches and material swatches as hero objects under workshop lamp',
    secondaryProps: ['measuring tools soft dust', 'heritage detail focus'],
  },
  culinary_prep_station: {
    id: 'culinary_prep_station',
    label: 'prep station',
    objectPhrase:
      'wooden prep board with natural ingredients gentle steam recipe cards without readable text as hero objects',
    secondaryProps: [
      'morning kitchen production energy',
      'mindful hands mid-action',
      'warm editorial food craft not stock photo',
    ],
  },
  travel_ticket_map: {
    id: 'travel_ticket_map',
    label: 'journey folio',
    objectPhrase:
      'folded route map ticket folio and departure board glow as hero objects on station bench',
    secondaryProps: [
      'luminous tracks in depth',
      'journey anticipation not tourist postcard',
      'horizon discovery energy',
    ],
  },
  creative_idea_wall: {
    id: 'creative_idea_wall',
    label: 'idea wall',
    objectPhrase:
      'idea wall with sketches sticky layers and color chips as hero objects in creative workshop',
    secondaryProps: ['scattered inspiration controlled chaos', 'production energy not empty studio'],
  },
  friendship_bridge_table: {
    id: 'friendship_bridge_table',
    label: 'connection space',
    objectPhrase:
      'lakeside bench with two cups and soft bridge in midground as hero spatial object',
    secondaryProps: ['empathy atmosphere golden hour', 'connection implied not dating UI'],
  },
  research_material_swatch: {
    id: 'research_material_swatch',
    label: 'research desk',
    objectPhrase:
      'organized notes material swatches and warm desk lamp as hero objects',
    secondaryProps: ['intellectual craft shallow depth', 'detail study tension'],
  },
  wellness_ritual_props: {
    id: 'wellness_ritual_props',
    label: 'wellness ritual',
    objectPhrase:
      'linen hydration bowl gentle movement props as hero objects in calm morning light',
    secondaryProps: ['restorative ritual not spa stock', 'soft body-mind atmosphere'],
  },
  contemplation_threshold: {
    id: 'contemplation_threshold',
    label: 'quiet threshold',
    objectPhrase:
      'threshold between interior shadow and garden light as hero spatial object',
    secondaryProps: ['generous negative space', 'reflective pause not empty room'],
  },
};

const HERO_BY_COMPOSITION: Partial<Record<SceneCompositionTemplateId, HeroObjectId>> = {
  comparison_scene: 'comparison_priority_board',
  restoration_scene: 'stone_material_samples',
  culinary_scene: 'culinary_prep_station',
  travel_journey_scene: 'travel_ticket_map',
  research_scene: 'research_material_swatch',
};

export function resolveHeroObject(
  intentId: ConversationVisualIntentId,
  composition: SceneCompositionTemplateId
): HeroObjectSpec {
  const id = HERO_BY_INTENT[intentId] ?? HERO_BY_COMPOSITION[composition] ?? 'contemplation_threshold';
  return HERO_SPECS[id];
}
