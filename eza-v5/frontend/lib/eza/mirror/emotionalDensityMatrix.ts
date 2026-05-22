/**
 * Emotional density matrix — object count & camera energy by intent (Sprint 12A).
 */

import type { ConversationVisualIntentId } from '@/lib/eza/mirror/sceneIntentTypes';
import type { EmotionalTensionId } from '@/lib/eza/mirror/intentCompositionSystem';
import type { ReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';

export type EmotionalDensityLevel = 'sparse' | 'medium' | 'medium_high' | 'high';

export type DensitySpec = {
  level: EmotionalDensityLevel;
  objectCount: string;
  cameraEnergy: string;
};

const BY_INTENT: Record<ConversationVisualIntentId, DensitySpec> = {
  premium_vehicle_comparison: {
    level: 'high',
    objectCount: '5 to 8 story objects',
    cameraEnergy: 'active comparison energy dual composition',
  },
  product_comparison: {
    level: 'high',
    objectCount: '5 to 7 objects',
    cameraEnergy: 'active selection tension',
  },
  financial_decision: {
    level: 'medium',
    objectCount: '4 to 6 objects',
    cameraEnergy: 'organized analytical calm',
  },
  restoration_research: {
    level: 'medium',
    objectCount: '4 to 6 material objects',
    cameraEnergy: 'layered craft intelligence',
  },
  travel_planning: {
    level: 'medium_high',
    objectCount: '5 to 7 journey objects',
    cameraEnergy: 'directional forward movement',
  },
  culinary_wellness: {
    level: 'medium',
    objectCount: '3 to 5 prep objects',
    cameraEnergy: 'intimate production warmth',
  },
  creative_brainstorm: {
    level: 'medium_high',
    objectCount: '5 to 7 idea objects',
    cameraEnergy: 'workshop creative energy',
  },
  friendship_reflection: {
    level: 'medium',
    objectCount: '3 to 5 connection objects',
    cameraEnergy: 'warm human spacing tension',
  },
  deep_research: {
    level: 'medium',
    objectCount: '4 to 6 study objects',
    cameraEnergy: 'focused detail energy',
  },
  wellness_calm: {
    level: 'medium',
    objectCount: '3 to 5 ritual objects',
    cameraEnergy: 'intimate calm not empty',
  },
  soft_reflection: {
    level: 'sparse',
    objectCount: '2 to 4 objects',
    cameraEnergy: 'calm reflective not empty space',
  },
  topic_atmosphere: {
    level: 'sparse',
    objectCount: '2 to 4 objects',
    cameraEnergy: 'editorial pause with momentum',
  },
};

export function resolveEmotionalDensity(
  intentId: ConversationVisualIntentId,
  tension: EmotionalTensionId,
  signals: ReflectionSignals
): DensitySpec {
  const base = BY_INTENT[intentId] ?? BY_INTENT.topic_atmosphere;
  if (tension === 'active_comparison' || signals.comparisonIntensity >= 0.5) {
    return BY_INTENT.premium_vehicle_comparison;
  }
  if (signals.calmnessLevel >= 0.68 && signals.comparisonIntensity < 0.25) {
    return BY_INTENT.soft_reflection;
  }
  return base;
}

export function buildDensityPhrases(spec: DensitySpec): string[] {
  return [
    `emotional density ${spec.level}`,
    spec.objectCount,
    spec.cameraEnergy,
  ];
}
