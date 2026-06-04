/**
 * P4-A — Daily Mirror narrative pipeline types.
 */

import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';
import type { ReflectionSignals, TopicStoryVariantId } from '@/lib/eza/mirror/reflectionSignals';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import type { DailyAvatarType } from '@/lib/eza/mirror/dailyAvatarRegistry';
import type { CharacterArchetypeId } from '@/lib/eza/mirror/ezaCharacterBible';

export type NarrativeCoreId =
  | 'comparison'
  | 'exploration'
  | 'creation'
  | 'care'
  | 'uncertainty'
  | 'planning'
  | 'clarity'
  | 'trust'
  | 'balance'
  | 'general_reflection';

export type SceneArchetypeId =
  | 'crossroads'
  | 'workshop'
  | 'threshold'
  | 'sanctuary'
  | 'ledger'
  | 'studio_flow'
  | 'quiet_mirror'
  | 'comparison_studio';

export type StoryTensionResult = {
  storyTensionTitle: string;
  storyTensionSummary: string;
};

export type DailyNarrativeLayer = {
  narrativeCoreId: NarrativeCoreId;
  storyTensionTitle: string;
  storyTensionSummary: string;
  mirrorMoment: string;
  sceneArchetypeId: SceneArchetypeId;
  sceneArchetypeLabel: string;
  dailyThemeTitle: string;
  dailyThemeSubtitle: string;
  dailyAvatarId: string;
  dailyAvatarName: string;
  dailyAvatarEmoji: string;
  dailyAvatarType: DailyAvatarType;
  dailyAvatarArchetypeId: CharacterArchetypeId;
  behaviorFamilyLabel: string;
  dailySceneConcept: string;
  identityMoodLens: string;
};

export type ComposeNarrativePipelineInput = {
  entries: import('@/lib/behavioralHistory').SavedBehavioralEntry[];
  mirrorSeed: string;
  cardDate: string;
  personaFamilyId: PersonaFamilyId;
  storyTopicKey: SceneTopicKey;
  storyVariant?: TopicStoryVariantId;
  microMood?: import('@/lib/eza/mirror/reflectionSignals').MicroMoodId;
  lockedIntent: LockedPrimaryIntentId;
  intentFingerprint?: string;
  reflectionSignals: ReflectionSignals;
};
