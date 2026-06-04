/**
 * P4-A — Scene Archetype: composition type for OpenAI from narrative + intent.
 */

import type { NarrativeCoreId, SceneArchetypeId } from '@/lib/eza/mirror/narrativeTypes';
import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';

export type SceneArchetypeResult = {
  sceneArchetypeId: SceneArchetypeId;
  sceneArchetypeLabel: string;
};

const LABELS: Record<SceneArchetypeId, string> = {
  crossroads: 'Crossroads',
  workshop: 'Workshop',
  threshold: 'Threshold',
  sanctuary: 'Sanctuary',
  ledger: 'Ledger',
  studio_flow: 'Studio flow',
  quiet_mirror: 'Quiet mirror',
  comparison_studio: 'Comparison studio',
};

const PHRASES: Record<SceneArchetypeId, string> = {
  crossroads: 'crossroads decision threshold, two possible paths, calm pause before movement',
  workshop: 'material study workshop, form and surface in quiet debate, craft atmosphere',
  threshold: 'journey threshold, horizon and route, exploratory editorial light',
  sanctuary: 'restorative sanctuary space, gentle wellness rhythm, soft calm light',
  ledger: 'calm planning table, symbolic balance, thoughtful financial mood',
  studio_flow: 'creative studio flow, inspiration and production, soft sunset light',
  quiet_mirror: 'quiet reflective editorial space, soft neutral light, calm thought mood',
  comparison_studio:
    'premium comparison studio, two parallel choices, warm restrained showroom light',
};

export function resolveSceneArchetype(
  narrativeCoreId: NarrativeCoreId,
  lockedIntent?: LockedPrimaryIntentId
): SceneArchetypeResult {
  let id: SceneArchetypeId;

  if (lockedIntent === 'premium_vehicle_comparison') {
    id = 'comparison_studio';
  } else {
    switch (narrativeCoreId) {
      case 'comparison':
        id = 'crossroads';
        break;
      case 'creation':
        id = 'workshop';
        break;
      case 'exploration':
        id = 'threshold';
        break;
      case 'care':
        id = 'sanctuary';
        break;
      case 'uncertainty':
        id = 'ledger';
        break;
      case 'planning':
      case 'clarity':
        id = 'quiet_mirror';
        break;
      case 'trust':
      case 'balance':
        id = 'sanctuary';
        break;
      default:
        id = 'quiet_mirror';
    }
  }

  return {
    sceneArchetypeId: id,
    sceneArchetypeLabel: LABELS[id],
  };
}

export function getSceneArchetypePhrase(archetypeId: SceneArchetypeId): string {
  return PHRASES[archetypeId];
}
