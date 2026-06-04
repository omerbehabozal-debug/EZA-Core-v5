/**
 * P4-A — Mirror Moment: single emotional scene sentence (primary visual cue).
 */

import type { NarrativeCoreId } from '@/lib/eza/mirror/narrativeTypes';
import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';

const MOMENT_BY_CORE: Record<NarrativeCoreId, string> = {
  comparison: 'Standing still before choosing.',
  exploration: 'Looking beyond the familiar.',
  creation: 'Building shape from possibility.',
  care: 'Choosing yourself again.',
  uncertainty: 'Pausing before the next step.',
  planning: 'Mapping the next quiet step.',
  clarity: 'Letting detail settle into focus.',
  trust: 'Leaving space for honest connection.',
  balance: 'Resting in measured calm.',
  general_reflection: 'Allowing clarity to emerge.',
};

export function composeMirrorMoment(
  narrativeCoreId: NarrativeCoreId,
  lockedIntent?: LockedPrimaryIntentId
): string {
  if (lockedIntent === 'premium_vehicle_comparison') {
    return MOMENT_BY_CORE.comparison;
  }
  return MOMENT_BY_CORE[narrativeCoreId] ?? MOMENT_BY_CORE.general_reflection;
}
