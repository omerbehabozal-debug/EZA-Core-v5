/**
 * Emotional pacing — scene energy density (Sprint 11O).
 */

import type { ReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';
import type { TopicStoryVariantId } from '@/lib/eza/mirror/reflectionSignals';
import type { EmotionalTensionId } from '@/lib/eza/mirror/intentCompositionSystem';
import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';

export type EmotionalPacingId = 'sparse' | 'balanced' | 'active' | 'cinematic_tension';

const PACING_PHRASES: Record<EmotionalPacingId, string> = {
  sparse:
    'emotional pacing sparse calm contemplative generous negative space slow visual rhythm',
  balanced:
    'emotional pacing balanced natural editorial flow readable story beat',
  active:
    'emotional pacing active comparison energy visible directional tension',
  cinematic_tension:
    'emotional pacing cinematic tension peak decision moment layered contrast controlled drama not advertisement',
};

export function resolveEmotionalPacing(
  signals: ReflectionSignals,
  tension: EmotionalTensionId,
  storyVariant?: TopicStoryVariantId,
  lockedIntent?: LockedPrimaryIntentId
): EmotionalPacingId {
  if (lockedIntent === 'premium_vehicle_comparison') {
    return signals.comparisonIntensity >= 0.55 ? 'cinematic_tension' : 'active';
  }
  if (storyVariant === 'compare' || tension === 'active_comparison') {
    return signals.comparisonIntensity >= 0.55 ? 'cinematic_tension' : 'active';
  }
  if (tension === 'careful_selection' && signals.decisiveness >= 0.5) {
    return 'active';
  }
  if (tension === 'creative_production' || tension === 'exploratory_discovery') {
    return 'balanced';
  }
  if (signals.calmnessLevel >= 0.68 && signals.comparisonIntensity < 0.28) {
    return 'sparse';
  }
  return 'balanced';
}

export function getPacingPhrase(pacing: EmotionalPacingId): string {
  return PACING_PHRASES[pacing];
}
