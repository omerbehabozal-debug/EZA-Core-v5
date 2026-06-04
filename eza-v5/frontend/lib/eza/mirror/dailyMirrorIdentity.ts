/**
 * Daily Mirror identity layer — P4-A delegates to narrative identity resolver.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { DailyAvatarDefinition } from '@/lib/eza/mirror/dailyAvatarRegistry';
import { composeDailyNarrativeLayer } from '@/lib/eza/mirror/composeNarrativePipeline';
import { resolveMirrorIntentContext } from '@/lib/eza/mirror/mirrorIntentContext';
import { deriveReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import type { MicroMoodId, TopicStoryVariantId } from '@/lib/eza/mirror/reflectionSignals';

export type DailyMirrorIdentityLayer = {
  behaviorFamilyLabel: string;
  dailyAvatarId: string;
  dailyAvatarName: string;
  dailyAvatarEmoji: string;
  dailyAvatarType: DailyAvatarDefinition['avatarType'];
  dailyAvatarArchetypeId: DailyAvatarDefinition['archetypeId'];
  dailyThemeTitle: string;
  dailyThemeSubtitle: string;
  dailySceneConcept: string;
};

export function composeDailyMirrorIdentity(input: {
  entries: SavedBehavioralEntry[];
  mirrorSeed: string;
  cardDate: string;
  personaFamilyId: PersonaFamilyId;
  storyTopicKey: SceneTopicKey;
  storyVariant?: TopicStoryVariantId;
  microMood?: MicroMoodId;
  intentFingerprint?: string;
  reflectionSignals?: import('@/lib/eza/mirror/reflectionSignals').ReflectionSignals;
  lockedIntent?: import('@/lib/eza/mirror/intentLockSystem').LockedPrimaryIntentId;
}): DailyMirrorIdentityLayer {
  const signals =
    input.reflectionSignals ?? deriveReflectionSignals(input.entries);
  const intentCtx = resolveMirrorIntentContext({
    entries: input.entries,
    storyVariant: input.storyVariant,
    reflectionSignals: signals,
    personaFamilyId: input.personaFamilyId,
  });

  const narrative = composeDailyNarrativeLayer({
    entries: input.entries,
    mirrorSeed: input.mirrorSeed,
    cardDate: input.cardDate,
    personaFamilyId: input.personaFamilyId,
    storyTopicKey: input.storyTopicKey,
    storyVariant: input.storyVariant,
    microMood: input.microMood,
    lockedIntent: input.lockedIntent ?? intentCtx.lockedIntent,
    intentFingerprint: input.intentFingerprint,
    reflectionSignals: signals,
  });

  return {
    behaviorFamilyLabel: narrative.behaviorFamilyLabel,
    dailyAvatarId: narrative.dailyAvatarId,
    dailyAvatarName: narrative.dailyAvatarName,
    dailyAvatarEmoji: narrative.dailyAvatarEmoji,
    dailyAvatarType: narrative.dailyAvatarType,
    dailyAvatarArchetypeId: narrative.dailyAvatarArchetypeId,
    dailyThemeTitle: narrative.dailyThemeTitle,
    dailyThemeSubtitle: narrative.dailyThemeSubtitle,
    dailySceneConcept: narrative.dailySceneConcept,
  };
}
