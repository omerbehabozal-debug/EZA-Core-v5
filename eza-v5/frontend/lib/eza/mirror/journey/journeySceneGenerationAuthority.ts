/**
 * Module-level scene-generation authority for one exact Journey.
 *
 * React refs die on remount. This registry does not. A second kick or a
 * late completion cannot start or apply another scene for the same
 * sourceConversationId + journeyId + journeyVersion while a runner owns it.
 *
 * Independent journeys (A/B/C, later windows) use different keys.
 */

export type JourneySceneGenerationIdentity = {
  sourceConversationId: string;
  journeyId: string;
  journeyVersion?: number;
};

type Slot = {
  generationId: string;
  runnerAcquired: boolean;
};

const slots = new Map<string, Slot>();

function normalizeVersion(version: number | undefined): number {
  return typeof version === 'number' && version >= 1 ? version : 1;
}

export function journeySceneGenerationKey(
  input: JourneySceneGenerationIdentity
): string {
  const conversationId = input.sourceConversationId.trim();
  const journeyId = input.journeyId.trim().toLowerCase();
  const version = normalizeVersion(input.journeyVersion);
  return `${conversationId}::${journeyId}::v${version}`;
}

function usableIdentity(input: JourneySceneGenerationIdentity): boolean {
  return Boolean(
    input.sourceConversationId.trim() && input.journeyId.trim()
  );
}

function newGenerationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `scene-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** True once handleGenerate has taken the single runner for this Journey. */
export function isJourneySceneGenerationRunnerActive(
  input: JourneySceneGenerationIdentity
): boolean {
  if (!usableIdentity(input)) return false;
  const slot = slots.get(journeySceneGenerationKey(input));
  return Boolean(slot?.runnerAcquired);
}

/**
 * First caller becomes the only runner and receives the generationId.
 * A remount/re-kick while that runner is active receives null and must wait.
 */
export function acquireJourneySceneGenerationRunner(
  input: JourneySceneGenerationIdentity
): { generationId: string } | null {
  if (!usableIdentity(input)) return null;
  const key = journeySceneGenerationKey(input);
  const existing = slots.get(key);
  if (existing?.runnerAcquired) return null;
  if (existing) {
    existing.runnerAcquired = true;
    return { generationId: existing.generationId };
  }
  const generationId = newGenerationId();
  slots.set(key, { generationId, runnerAcquired: true });
  return { generationId };
}

export function journeySceneGenerationOwns(
  input: JourneySceneGenerationIdentity,
  generationId: string
): boolean {
  if (!usableIdentity(input)) return false;
  const wanted = generationId.trim();
  if (!wanted) return false;
  const slot = slots.get(journeySceneGenerationKey(input));
  return Boolean(slot?.runnerAcquired && slot.generationId === wanted);
}

/**
 * Drop the slot. Pass generationId to release only that runner.
 * Omit it when a failed pre-READY attempt is explicitly retried.
 */
export function releaseJourneySceneGeneration(
  input: JourneySceneGenerationIdentity,
  generationId?: string
): void {
  if (!usableIdentity(input)) return;
  const key = journeySceneGenerationKey(input);
  const slot = slots.get(key);
  if (!slot) return;
  if (generationId && slot.generationId !== generationId.trim()) return;
  slots.delete(key);
}

export function clearJourneySceneGenerationAuthorityForTests(): void {
  slots.clear();
}
