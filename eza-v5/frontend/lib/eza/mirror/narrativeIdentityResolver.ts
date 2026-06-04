/**
 * P4-A — Identity as scene result (archetype + moment affinity, not seed-first mascot).
 */

import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import {
  getBehaviorFamilyLabel,
  getDailyAvatarPool,
  type DailyAvatarDefinition,
} from '@/lib/eza/mirror/dailyAvatarRegistry';
import type { NarrativeCoreId, SceneArchetypeId } from '@/lib/eza/mirror/narrativeTypes';

const ARCHETYPE_AVATAR_PREFERENCE: Record<SceneArchetypeId, readonly string[]> = {
  crossroads: ['still_lake', 'decision_penguin', 'balance_scales', 'clear_lock'],
  comparison_studio: ['still_lake', 'decision_penguin', 'balance_scales'],
  workshop: ['idea_architect', 'creative_chameleon', 'thoughtful_hedgehog'],
  studio_flow: ['creative_chameleon', 'idea_architect', 'sprouting_seedling'],
  threshold: ['horizon_explorer', 'pathfinder', 'stargazer', 'curious_fox'],
  sanctuary: ['gentle_deer', 'compassionate_deer', 'calm_panda', 'still_lake'],
  ledger: ['clear_lock', 'reference_keeper', 'decision_penguin'],
  quiet_mirror: ['still_lake', 'quiet_observer', 'calm_panda', 'harmony_circle'],
};

const CORE_AVATAR_PREFERENCE: Partial<Record<NarrativeCoreId, readonly string[]>> = {
  comparison: ['still_lake', 'decision_penguin', 'balance_scales'],
  exploration: ['horizon_explorer', 'pathfinder', 'stargazer'],
  creation: ['idea_architect', 'creative_chameleon', 'thoughtful_hedgehog'],
  care: ['gentle_deer', 'compassionate_deer', 'still_lake'],
  uncertainty: ['clear_lock', 'reference_keeper', 'still_lake'],
};

function hashPickIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h + seed.charCodeAt(i) * (i + 19)) | 0;
  }
  return Math.abs(h) % length;
}

function pickFromPreferences(
  pool: DailyAvatarDefinition[],
  preferences: readonly string[],
  seed: string
): DailyAvatarDefinition {
  const preferred = preferences
    .map((id) => pool.find((a) => a.id === id))
    .filter((a): a is DailyAvatarDefinition => Boolean(a));

  if (preferred.length) {
    return preferred[hashPickIndex(seed, preferred.length)]!;
  }
  return pool[hashPickIndex(seed, pool.length)]!;
}

export function resolveIdentityForScene(input: {
  personaFamilyId: PersonaFamilyId;
  narrativeCoreId: NarrativeCoreId;
  sceneArchetypeId: SceneArchetypeId;
  mirrorMoment: string;
  dailyThemeTitle: string;
  mirrorSeed: string;
  cardDate: string;
}): DailyAvatarDefinition {
  const pool = getDailyAvatarPool(input.personaFamilyId);
  const prefs = [
    ...ARCHETYPE_AVATAR_PREFERENCE[input.sceneArchetypeId],
    ...(CORE_AVATAR_PREFERENCE[input.narrativeCoreId] ?? []),
  ];
  const seed = [
    input.mirrorSeed,
    input.cardDate,
    input.sceneArchetypeId,
    input.narrativeCoreId,
    input.mirrorMoment.slice(0, 24),
    input.dailyThemeTitle,
  ].join('|');

  return pickFromPreferences(pool, prefs, seed);
}

export function buildDailySceneConcept(
  avatarName: string,
  mirrorMoment: string,
  themeTitle: string
): string {
  return `${avatarName} — ${mirrorMoment.replace(/\.$/, '')} (${themeTitle}).`;
}

export { getBehaviorFamilyLabel };
