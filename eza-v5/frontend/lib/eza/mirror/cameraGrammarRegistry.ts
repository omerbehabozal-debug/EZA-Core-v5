/**
 * Camera grammar per composition — art direction, not generic portrait (Sprint 11O).
 */

import type { SceneCompositionTemplateId } from '@/lib/eza/mirror/sceneIntentTypes';

export type CameraGrammarSpec = {
  composition: SceneCompositionTemplateId;
  lens: string;
  angle: string;
  framing: string;
  blocking: string;
  depthCue: string;
};

export const CAMERA_GRAMMAR: Record<SceneCompositionTemplateId, CameraGrammarSpec> = {
  comparison_scene: {
    composition: 'comparison_scene',
    lens: '35mm cinematic lens slight wide for environmental decision',
    angle: 'low three-quarter angle asymmetric not straight-on',
    framing:
      'off-center asymmetry foreground hero sedan sharp rear sedan soft bokeh contemplative negative space between options',
    blocking: 'character small between vehicles seen from behind or profile never centered portrait',
    depthCue: 'foreground vehicle midground figure background garage depth layered parallax',
  },
  restoration_scene: {
    composition: 'restoration_scene',
    lens: '50mm natural perspective over-shoulder craft study',
    angle: 'over-shoulder from behind designer toward desk samples',
    framing: 'stone samples and sketches dominate foreground human partial at edge',
    blocking: 'hands and materials lead frame head turned away from camera',
    depthCue: 'desk foreground courtyard window deep background light geometry',
  },
  culinary_scene: {
    composition: 'culinary_scene',
    lens: '50mm intimate medium close on hands and surface',
    angle: 'slightly elevated three-quarter on prep station',
    framing: 'warm surfaces and steam in foreground figure at frame edge under thirty percent frame height',
    blocking: 'production in progress kneading arranging not idle at counter',
    depthCue: 'board foreground shelves soft background shallow depth',
  },
  travel_journey_scene: {
    composition: 'travel_journey_scene',
    lens: '28mm wide environmental journey lens',
    angle: 'eye-level wide with leading lines down platform',
    framing: 'ticket map bench foreground tracks horizon deep atmospheric distance',
    blocking: 'figure small facing luminous tracks forward movement not tourist selfie',
    depthCue: 'bench foreground platform midground vanishing tracks background haze',
  },
  exploration_scene: {
    composition: 'exploration_scene',
    lens: '32mm landscape editorial',
    angle: 'low horizon emphasis golden hour',
    framing: 'route map bench rule-of-thirds figure off-center toward open sky',
    blocking: 'leaning forward choosing direction',
    depthCue: 'near ground mid distance figure far horizon layers',
  },
  friendship_scene: {
    composition: 'friendship_scene',
    lens: '40mm environmental portrait distance',
    angle: 'asymmetric framing bridge off-center',
    framing: 'negative space between presences warm lake light emotional spacing',
    blocking: 'two implied figures never symmetrical couple portrait',
    depthCue: 'bench foreground bridge midground trees atmospheric back',
  },
  research_scene: {
    composition: 'research_scene',
    lens: '45mm desk study lens shallow depth',
    angle: 'three-quarter down onto organized desk',
    framing: 'notes and swatches primary figure leaning in secondary',
    blocking: 'analytical lean comparing columns not staring at lens',
    depthCue: 'desk sharp lamp glow bookshelf falloff',
  },
  wellness_scene: {
    composition: 'wellness_scene',
    lens: '55mm soft intimate medium',
    angle: 'gentle eye-level intimate not clinical',
    framing: 'ritual props foreground silhouette under thirty percent frame',
    blocking: 'care movement hydration gentle agency',
    depthCue: 'linen foreground curtain light background soft separation',
  },
  contemplation_scene: {
    composition: 'contemplation_scene',
    lens: '40mm threshold editorial',
    angle: 'slightly low toward garden light source',
    framing: 'door frame shadow foreground figure small against bright exterior',
    blocking: 'pause before step reflective not blank stare',
    depthCue: 'interior dark mid exterior luminous back separation strong',
  },
};

export function getCameraGrammar(
  composition: SceneCompositionTemplateId
): CameraGrammarSpec {
  return CAMERA_GRAMMAR[composition];
}

export function buildCameraGrammarPhrases(composition: SceneCompositionTemplateId): string[] {
  const c = getCameraGrammar(composition);
  return [
    `camera grammar ${c.lens}`,
    c.angle,
    c.framing,
    c.blocking,
    c.depthCue,
    'directed film still not AI mood wallpaper not centered symmetry',
  ];
}
