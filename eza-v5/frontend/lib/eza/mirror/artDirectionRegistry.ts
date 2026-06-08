/**
 * Subtopic art direction registry — premium editorial visual language.
 * Registry-only; no raw chat.
 */

import type { SceneSubtopicId } from '@/lib/eza/mirror/sceneSubtopicTypes';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

export type ArtDirectionProfile = {
  lighting: string;
  lens: string;
  composition: string;
  mood: string;
  qualityFilters: readonly string[];
  negativeExtras: readonly string[];
  forbiddenEnvironments?: readonly string[];
};

const TRAVEL_SILK_ROAD: ArtDirectionProfile = {
  lighting: 'golden hour warm desert key light',
  lens: '35mm editorial travel lens',
  composition: 'architectural depth, negative space upper third for headline',
  mood: 'cinematic travel editorial',
  qualityFilters: ['premium magazine cover', 'layered plaza depth'],
  negativeExtras: ['stock postcard', 'tourist crowd', 'oversaturated HDR', 'airplane window cliché'],
};

const TRAVEL_SAMARKAND: ArtDirectionProfile = {
  lighting: 'warm Registan plaza light',
  lens: '35mm editorial travel lens',
  composition: 'blue tile facade depth, headline negative space',
  mood: 'editorial travel discovery',
  qualityFilters: ['premium travel editorial', 'ceramic tile richness'],
  negativeExtras: ['generic monument postcard', 'tourist crowd', 'HDR oversaturation'],
};

const TRAVEL_BUKHARA: ArtDirectionProfile = {
  lighting: 'warm stone evening light',
  lens: '40mm heritage travel lens',
  composition: 'old city texture, caravanserai depth',
  mood: 'caravanserai atmosphere',
  qualityFilters: ['timeworn brick editorial', 'intimate heritage scale'],
  negativeExtras: ['stock old town postcard', 'crowded bazaar chaos'],
};

const TRAVEL_UZBEKISTAN: ArtDirectionProfile = {
  ...TRAVEL_SILK_ROAD,
  composition: 'Silk Road horizon depth, headline negative space',
  mood: 'cinematic Central Asia editorial',
};

const TRAVEL_GENERIC: ArtDirectionProfile = {
  lighting: 'golden hour platform light',
  lens: '35mm journey editorial lens',
  composition: 'open horizon depth, clean upper overlay space',
  mood: 'thoughtful journey editorial',
  qualityFilters: ['premium travel magazine', 'calm departure energy'],
  negativeExtras: ['stock airport photo', 'suitcase cliché montage'],
};

const TRAVEL_SPAIN: ArtDirectionProfile = {
  lighting: 'warm Iberian golden hour',
  lens: '35mm editorial travel lens',
  composition: 'plaza stone depth, headline negative space',
  mood: 'Iberian journey editorial',
  qualityFilters: ['premium travel magazine', 'warm stone texture'],
  negativeExtras: ['stock flamenco postcard', 'tourist crowd', 'HDR oversaturation'],
};

const TRAVEL_ANDALUSIA: ArtDirectionProfile = {
  lighting: 'warm Andalusian courtyard light',
  lens: '35mm Moorish heritage lens',
  composition: 'Moorish arch depth, ceramic tile richness',
  mood: 'Andalusian discovery editorial',
  qualityFilters: ['Moorish arch editorial', 'ceramic tile warmth'],
  negativeExtras: ['stock Alhambra postcard', 'tourist crowd chaos'],
};

const TRAVEL_MARDIN: ArtDirectionProfile = {
  lighting: 'Mesopotamian plateau dusk glow',
  lens: '40mm terrace city lens',
  composition: 'limestone terrace depth, plateau horizon',
  mood: 'terrace city travel editorial',
  qualityFilters: ['limestone terrace richness', 'plateau horizon depth'],
  negativeExtras: ['stock old town postcard', 'war imagery', 'crowded bazaar chaos'],
};

const ARCH_MOSQUE: ArtDirectionProfile = {
  lighting: 'soft courtyard light',
  lens: '28mm museum-grade architectural lens',
  composition: 'symmetry and depth, stone texture detail',
  mood: 'reverent heritage atmosphere',
  qualityFilters: ['museum-grade architectural photography', 'islamic geometry clarity'],
  negativeExtras: ['BIM render', 'CAD wireframe', 'sterile whitebox', 'drone overview stock'],
};

const ARCH_FACADE: ArtDirectionProfile = {
  lighting: 'diffused restoration atelier light',
  lens: '50mm craft photography lens',
  composition: 'stone and marble detail, refined scaffold backdrop',
  mood: 'restoration craft photography',
  qualityFilters: ['heritage material study', 'tactile stone surface'],
  negativeExtras: ['construction site chaos', 'hard hat clutter', 'BIM render'],
};

const ARCH_MATERIAL: ArtDirectionProfile = {
  lighting: 'soft atelier window light',
  lens: '50mm macro craft lens',
  composition: 'material samples and archival drawings layout',
  mood: 'heritage craft study',
  qualityFilters: ['restoration atelier editorial', 'material texture fidelity'],
  negativeExtras: ['CAD wireframe', 'sterile lab render'],
};

const ARCH_MARDIN_HERITAGE: ArtDirectionProfile = {
  lighting: 'warm limestone terrace light',
  lens: '28mm heritage city lens',
  composition: 'terrace stone depth, courtyard alley texture',
  mood: 'Mardin heritage editorial',
  qualityFilters: ['limestone terrace photography', 'courtyard alley depth'],
  negativeExtras: ['BIM render', 'drone war imagery', 'sterile whitebox'],
};

const ARCH_MARDIN_STONE: ArtDirectionProfile = {
  ...ARCH_FACADE,
  composition: 'limestone facing and stone carving detail',
  mood: 'Mardin stone craft study',
  qualityFilters: ['limestone facing editorial', 'stone carving fidelity'],
};

const ARCH_VAULT: ArtDirectionProfile = {
  ...ARCH_MATERIAL,
  composition: 'vault section and tonoz restoration study layout',
  mood: 'vault structure craft study',
  qualityFilters: ['vault section editorial', 'heritage structural study'],
};

const VEHICLE_SUV: ArtDirectionProfile = {
  lighting: 'controlled studio key with soft rim',
  lens: '24mm low-angle automotive lens',
  composition: 'elevated stance comparison, luxury product framing',
  mood: 'premium automotive studio',
  qualityFilters: ['luxury product photography', 'controlled reflections'],
  negativeExtras: ['outdoor road scene', 'highway sunset', 'racing poster', 'dealership banner'],
  forbiddenEnvironments: ['highway', 'city street', 'outdoor road', 'landscape'],
};

const VEHICLE_LUXURY: ArtDirectionProfile = {
  lighting: 'warm indoor showroom key, controlled reflections',
  lens: '35mm executive automotive editorial lens',
  composition: 'dual sedan comparison stage, indoor premium framing',
  mood: 'executive automotive editorial',
  qualityFilters: ['indoor premium showroom', 'cinematic reflection control'],
  negativeExtras: ['highway sunset', 'outdoor road scene', 'racing poster', 'open landscape'],
  forbiddenEnvironments: ['highway', 'city street', 'outdoor road', 'pier', 'skyline'],
};

const VEHICLE_EV: ArtDirectionProfile = {
  lighting: 'soft charging glow, calm garage ambient',
  lens: '28mm futuristic garage lens',
  composition: 'quiet power stance, minimal EV silhouettes',
  mood: 'futuristic but calm garage',
  qualityFilters: ['charging light editorial', 'quiet electric power'],
  negativeExtras: ['sci-fi neon cliché', 'cyberpunk garage', 'matrix rain'],
};

const TECH_PRODUCT: ArtDirectionProfile = {
  lighting: 'warm screen glow with soft fill',
  lens: '35mm founder workspace lens',
  composition: 'strategy board atmosphere, product lab depth',
  mood: 'cinematic startup product lab',
  qualityFilters: ['premium founder workspace', 'roadmap board presence'],
  negativeExtras: ['cyberpunk', 'neon', 'robot', 'AI brain wallpaper', 'matrix rain'],
};

const TECH_CODING: ArtDirectionProfile = {
  lighting: 'subtle code editor glow, dark product lab ambient',
  lens: '40mm developer desk lens',
  composition: 'AI pair programming mood, focused desk depth',
  mood: 'developer workspace editorial',
  qualityFilters: ['code editor glow', 'pair programming calm'],
  negativeExtras: ['matrix rain', 'robot', 'hologram brain', 'cyberpunk neon'],
};

const TECH_STRATEGY: ArtDirectionProfile = {
  lighting: 'soft command center ambient, board accent light',
  lens: '35mm strategy room lens',
  composition: 'product vision board depth, governance cues in background',
  mood: 'startup command center',
  qualityFilters: ['platform vision board', 'measured strategy atmosphere'],
  negativeExtras: ['surveillance dystopia', 'war room chaos', 'cyberpunk HUD'],
};

const TOPIC_GENERIC: ArtDirectionProfile = {
  lighting: 'premium soft window light',
  lens: '50mm calm editorial lens',
  composition: 'clean negative space upper third',
  mood: 'calm editorial scene',
  qualityFilters: ['premium soft light', 'uncluttered editorial frame'],
  negativeExtras: ['stock photo aesthetic', 'AI wallpaper', 'generic inspirational scene'],
};

const TOPIC_FALLBACK: Partial<Record<StoryTopicId, ArtDirectionProfile>> = {
  travel: TRAVEL_GENERIC,
  architecture: ARCH_MOSQUE,
  vehicle: VEHICLE_LUXURY,
  technology_ai: TECH_PRODUCT,
};

export const ART_DIRECTION_REGISTRY: Record<SceneSubtopicId, ArtDirectionProfile> = {
  travel_silk_road: TRAVEL_SILK_ROAD,
  travel_samarkand: TRAVEL_SAMARKAND,
  travel_bukhara: TRAVEL_BUKHARA,
  travel_uzbekistan: TRAVEL_UZBEKISTAN,
  travel_spain: TRAVEL_SPAIN,
  travel_andalusia: TRAVEL_ANDALUSIA,
  travel_mardin: TRAVEL_MARDIN,
  travel_generic_journey: TRAVEL_GENERIC,
  arch_mosque_heritage: ARCH_MOSQUE,
  arch_mardin_heritage: ARCH_MARDIN_HERITAGE,
  arch_mardin_stone: ARCH_MARDIN_STONE,
  arch_vault_study: ARCH_VAULT,
  arch_facade_restoration: ARCH_FACADE,
  arch_material_study: ARCH_MATERIAL,
  vehicle_suv_comparison: VEHICLE_SUV,
  vehicle_luxury_sedan_comparison: VEHICLE_LUXURY,
  vehicle_ev_comparison: VEHICLE_EV,
  tech_coding_ai: TECH_CODING,
  tech_product_building: TECH_PRODUCT,
  tech_startup_strategy: TECH_STRATEGY,
  topic_generic: TOPIC_GENERIC,
};

export function getArtDirectionProfile(subtopic: SceneSubtopicId): ArtDirectionProfile {
  return ART_DIRECTION_REGISTRY[subtopic] ?? TOPIC_GENERIC;
}

export function getTopicArtDirectionFallback(topic: StoryTopicId): ArtDirectionProfile {
  return TOPIC_FALLBACK[topic] ?? TOPIC_GENERIC;
}
