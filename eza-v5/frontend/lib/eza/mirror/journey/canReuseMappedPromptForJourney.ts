/**
 * Journey V1 mapped-prompt reuse gate (Phase 3.5).
 *
 * Reuse is allowed only when pinned prompt lineage matches the active scoped window.
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { hasPinnedMappedMirrorPrompt } from '@/lib/eza/mirror/pinnedMappedMirrorPrompt';
import type { JourneySemanticScopePayload } from '@/lib/eza/mirror/journey/scopedJourneyMeaning';

export const JOURNEY_MAPPER_VERSION_V5 = 'interpretation-to-v5-v8';

export type MirrorJourneyPromptLineage = {
  semanticScope: 'journey_window_v1';
  journeyId: string;
  journeyVersion: number;
  windowHash: string;
  scopedInputHash: string;
  interpretationHash?: string | null;
  mapperVersion?: string | null;
};

export function readJourneyPromptLineage(
  card: DailyMirrorCardModel | null | undefined
): MirrorJourneyPromptLineage | null {
  const raw = card?.mirrorJourneyLineage;
  if (!raw || typeof raw !== 'object') return null;
  const journeyId = String(raw.journeyId || '').trim().toLowerCase();
  const windowHash = String(raw.windowHash || '').trim();
  const scopedInputHash = String(raw.scopedInputHash || '').trim();
  const journeyVersion = Number(raw.journeyVersion);
  if (
    raw.semanticScope !== 'journey_window_v1' ||
    !journeyId ||
    !windowHash ||
    !scopedInputHash ||
    !Number.isFinite(journeyVersion) ||
    journeyVersion < 1
  ) {
    return null;
  }
  return {
    semanticScope: 'journey_window_v1',
    journeyId,
    journeyVersion,
    windowHash,
    scopedInputHash,
    interpretationHash: raw.interpretationHash ?? null,
    mapperVersion: raw.mapperVersion ?? null,
  };
}

export function canReuseMappedPromptForJourney(input: {
  card: DailyMirrorCardModel | null | undefined;
  scope: JourneySemanticScopePayload | null | undefined;
  interpretationHash?: string | null;
  mapperVersion?: string | null;
}): boolean {
  const { card, scope } = input;
  if (!scope || scope.semanticScope !== 'journey_window_v1') return false;
  if (!hasPinnedMappedMirrorPrompt(card)) return false;
  const lineage = readJourneyPromptLineage(card);
  if (!lineage) return false;

  if (lineage.journeyId !== scope.journeyId.trim().toLowerCase()) return false;
  if (lineage.journeyVersion !== scope.journeyVersion) return false;
  if (lineage.windowHash !== scope.windowHash) return false;
  if (lineage.scopedInputHash !== scope.scopedInputHash) return false;

  const mapper =
    input.mapperVersion?.trim() ||
    lineage.mapperVersion?.trim() ||
    JOURNEY_MAPPER_VERSION_V5;
  if (lineage.mapperVersion && lineage.mapperVersion !== mapper) return false;

  const interp =
    input.interpretationHash?.trim() ||
    lineage.interpretationHash?.trim() ||
    '';
  if (interp && lineage.interpretationHash && lineage.interpretationHash !== interp) {
    return false;
  }

  // Legacy / full-conversation pins never carry journey_window_v1 lineage.
  return true;
}
