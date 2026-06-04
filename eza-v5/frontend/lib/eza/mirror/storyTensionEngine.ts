/**
 * P4-A — Story Tension: invisible daily tension from narrative core.
 */

import type { NarrativeCoreId } from '@/lib/eza/mirror/narrativeTypes';
import type { StoryTensionResult } from '@/lib/eza/mirror/narrativeTypes';
import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';

const TENSION_BY_CORE: Record<NarrativeCoreId, StoryTensionResult> = {
  comparison: {
    storyTensionTitle: 'Two paths. One decision.',
    storyTensionSummary: 'Two strong options weighed with calm focus before committing.',
  },
  exploration: {
    storyTensionTitle: 'A new horizon ahead.',
    storyTensionSummary: 'Curiosity toward distance and heritage beyond the familiar.',
  },
  creation: {
    storyTensionTitle: 'A form seeking shape.',
    storyTensionSummary: 'An idea moving from sketch to material with quiet debate.',
  },
  care: {
    storyTensionTitle: 'Care returning.',
    storyTensionSummary: 'Rhythm and rest seeking balance without performance.',
  },
  uncertainty: {
    storyTensionTitle: 'Direction in uncertainty.',
    storyTensionSummary: 'Planning under open outcomes with calm search for signal.',
  },
  planning: {
    storyTensionTitle: 'Quiet focus. Meaningful progress.',
    storyTensionSummary: 'Structure emerging from scattered priorities.',
  },
  clarity: {
    storyTensionTitle: 'Clarity before movement.',
    storyTensionSummary: 'Details arranged until the next step feels possible.',
  },
  trust: {
    storyTensionTitle: 'Soft connection. Honest tempo.',
    storyTensionSummary: 'Empathy and pace held without pressure.',
  },
  balance: {
    storyTensionTitle: 'Steady rhythm. Gentle balance.',
    storyTensionSummary: 'Calm observation without rush to conclude.',
  },
  general_reflection: {
    storyTensionTitle: 'Quiet focus. Meaningful progress.',
    storyTensionSummary: 'A reflective day held in soft editorial calm.',
  },
};

export function composeStoryTension(
  narrativeCoreId: NarrativeCoreId,
  lockedIntent?: LockedPrimaryIntentId
): StoryTensionResult {
  if (lockedIntent === 'premium_vehicle_comparison') {
    return TENSION_BY_CORE.comparison;
  }
  return TENSION_BY_CORE[narrativeCoreId] ?? TENSION_BY_CORE.general_reflection;
}
