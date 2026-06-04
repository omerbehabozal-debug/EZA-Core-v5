/**
 * P4-A — Orchestrates narrative pipeline for Daily Mirror card + prompt.
 */

import { composeNarrativeCore } from '@/lib/eza/mirror/narrativeCoreEngine';
import { composeStoryTension } from '@/lib/eza/mirror/storyTensionEngine';
import { composeMirrorMoment } from '@/lib/eza/mirror/mirrorMomentEngine';
import { resolveSceneArchetype } from '@/lib/eza/mirror/sceneArchetypeEngine';
import { resolveNarrativeTheme } from '@/lib/eza/mirror/narrativeThemeResolver';
import {
  buildDailySceneConcept,
  getBehaviorFamilyLabel,
  resolveIdentityForScene,
} from '@/lib/eza/mirror/narrativeIdentityResolver';
import { buildIdentityMoodLens } from '@/lib/eza/mirror/dailyMirrorFullCanvasPrompt';
import type { ComposeNarrativePipelineInput, DailyNarrativeLayer } from '@/lib/eza/mirror/narrativeTypes';
import type { NarrativeCoreId } from '@/lib/eza/mirror/narrativeTypes';

export function composeDailyNarrativeLayer(
  input: ComposeNarrativePipelineInput
): DailyNarrativeLayer {
  const narrativeCoreId = composeNarrativeCore({
    entries: input.entries,
    lockedIntent: input.lockedIntent,
    storyTopicKey: input.storyTopicKey,
    storyVariant: input.storyVariant,
    reflectionSignals: input.reflectionSignals,
  });

  const tension = composeStoryTension(narrativeCoreId, input.lockedIntent);
  const mirrorMoment = composeMirrorMoment(narrativeCoreId, input.lockedIntent);
  const archetype = resolveSceneArchetype(narrativeCoreId, input.lockedIntent);
  const theme = resolveNarrativeTheme({
    entries: input.entries,
    storyTopicKey: input.storyTopicKey,
    narrativeCoreId,
    lockedIntent: input.lockedIntent,
  });

  const avatar = resolveIdentityForScene({
    personaFamilyId: input.personaFamilyId,
    narrativeCoreId,
    sceneArchetypeId: archetype.sceneArchetypeId,
    mirrorMoment,
    dailyThemeTitle: theme.dailyThemeTitle,
    mirrorSeed: input.mirrorSeed,
    cardDate: input.cardDate,
  });

  const identityMoodLens = buildIdentityMoodLens(avatar.id, avatar.displayName);

  return {
    narrativeCoreId,
    storyTensionTitle: tension.storyTensionTitle,
    storyTensionSummary: tension.storyTensionSummary,
    mirrorMoment,
    sceneArchetypeId: archetype.sceneArchetypeId,
    sceneArchetypeLabel: archetype.sceneArchetypeLabel,
    dailyThemeTitle: theme.dailyThemeTitle,
    dailyThemeSubtitle: theme.dailyThemeSubtitle,
    dailyAvatarId: avatar.id,
    dailyAvatarName: avatar.displayName,
    dailyAvatarEmoji: avatar.emoji,
    dailyAvatarType: avatar.avatarType,
    dailyAvatarArchetypeId: avatar.archetypeId,
    behaviorFamilyLabel: getBehaviorFamilyLabel(input.personaFamilyId),
    dailySceneConcept: buildDailySceneConcept(
      avatar.displayName,
      mirrorMoment,
      theme.dailyThemeTitle
    ),
    identityMoodLens,
  };
}

/** Legacy cards without narrative fields — minimal safe defaults. */
export function composeNarrativeLayerFromLegacy(card: {
  dailyThemeTitle?: string;
  storyTopicKey?: import('@/lib/eza/mirror/visualPromptPresets').SceneTopicKey;
}): Pick<
  DailyNarrativeLayer,
  'narrativeCoreId' | 'mirrorMoment' | 'storyTensionTitle' | 'storyTensionSummary'
> {
  const core: NarrativeCoreId = 'general_reflection';
  const tension = composeStoryTension(core);
  return {
    narrativeCoreId: core,
    storyTensionTitle: tension.storyTensionTitle,
    storyTensionSummary: tension.storyTensionSummary,
    mirrorMoment: composeMirrorMoment(core),
  };
}
