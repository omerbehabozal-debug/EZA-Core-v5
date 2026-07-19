/**
 * Guards automatic mirror scene generation (create-path).
 * Prevents remount / conversationTexts drift from re-burning visual quota.
 */

export type AutoGenerateMirrorSceneInput = {
  allowAuto: boolean;
  isAuthReady: boolean;
  canCreateVisual: boolean;
  dailyStatus: string;
  sceneImageStatus: string;
  hasVisualPrompt: boolean;
  autoKey: string;
  sceneAutoKey: string | null;
  /** Existing durable scene for this conversation (archive or cache). */
  existingPersistableSceneUrl: string | null;
};

/**
 * Returns true only when we should call generate-scene automatically.
 * Explicit user update/retry/new-scene sets allowAuto=true after clearing scene state.
 */
export function shouldAutoGenerateMirrorScene(
  input: AutoGenerateMirrorSceneInput
): boolean {
  if (!input.allowAuto) return false;
  if (!input.isAuthReady || !input.canCreateVisual) return false;
  if (input.dailyStatus !== 'ready') return false;
  if (!input.hasVisualPrompt) return false;
  if (input.sceneImageStatus !== 'idle') return false;

  const key = input.sceneAutoKey;
  if (
    key === input.autoKey ||
    key === `${input.autoKey}:complete` ||
    key === `${input.autoKey}:hydrate` ||
    key?.endsWith(':cooldown') ||
    key?.endsWith(':rate_limited') ||
    key?.endsWith(':quota') ||
    key?.endsWith(':failed')
  ) {
    return false;
  }

  // allowAuto already required above; existing URL alone never blocks an armed create/update.
  return true;
}

/**
 * Prefer restoring an existing conversation scene instead of generating.
 */
export function shouldHydrateExistingMirrorScene(input: {
  allowAuto: boolean;
  existingPersistableSceneUrl: string | null;
}): boolean {
  return Boolean(input.existingPersistableSceneUrl) && !input.allowAuto;
}
