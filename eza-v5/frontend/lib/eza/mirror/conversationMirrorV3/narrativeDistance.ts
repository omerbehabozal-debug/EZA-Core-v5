/**
 * V3.1 — Narrative Distance: Topic → Meaning → Emotion → Distance → Scene.
 * Target levels 2–3: cinematic interpretation, not conversation summary.
 */

import { hashPick } from '@/lib/eza/mirror/conversationMirrorV2/topicCatalogUtils';

/** 1 = literal topic, 4 = pure atmosphere. V3.1 operates at 2–3. */
export type NarrativeDistanceLevel = 2 | 3;

export type NarrativeDistanceResult = {
  level: NarrativeDistanceLevel;
  label: string;
  sceneGuidance: string;
};

const DISTANCE_LABELS: Record<NarrativeDistanceLevel, string> = {
  2: 'Yakın yorum — duygusal anlam, sohbet özeti yok',
  3: 'Sinematik mesafe — evrensel şiir, tanıdık ama isimsiz',
};

const SCENE_GUIDANCE_BY_LEVEL: Record<NarrativeDistanceLevel, string> = {
  2: 'Interpret the emotional meaning with intimate cinematic framing. No conversation recap. No topic labels in the image text.',
  3: 'Pure cinematic metaphor — beautiful to a stranger, recognizable to the participant through feeling alone. No summary language.',
};

export function resolveNarrativeDistance(seed: string): NarrativeDistanceResult {
  const picked = hashPick(`${seed}-narrative-distance`, ['2', '3']);
  const level = (picked === '3' ? 3 : 2) as NarrativeDistanceLevel;
  return {
    level,
    label: DISTANCE_LABELS[level],
    sceneGuidance: SCENE_GUIDANCE_BY_LEVEL[level],
  };
}

/** V3.2 — narrative distance as actionable visual behavior for OpenAI. */
export function getNarrativeDistanceVisualGuidance(distance: NarrativeDistanceLevel): string {
  if (distance === 2) {
    return `Narrative distance visual behavior:
- Intimate emotional meaning.
- Prefer medium shot or near-subject composition.
- Human scale, interior detail, tactile surface, emotional legibility.
- The viewer should feel close to the decision or curiosity.`;
  }

  return `Narrative distance visual behavior:
- Universal cinematic meaning.
- Prefer wide atmospheric tableau.
- Figure, if present, should be small: max 15% of frame height.
- Atmosphere, scale and silence should carry the emotion.
- The viewer should feel distance, wonder and possibility.`;
}
