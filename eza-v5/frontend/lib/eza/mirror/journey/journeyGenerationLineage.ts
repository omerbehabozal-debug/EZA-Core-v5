/**
 * Phase 3.6 — authoritative JourneyGenerationLineage on the generated artifact.
 * Publish reads this snapshot only — never the live Review 8 draft.
 */

export const JOURNEY_GENERATION_LINEAGE_VERSION =
  'journey_generation_lineage_v1' as const;

export type JourneyGenerationLineageSelectedStep = {
  stepIndex: number;
  sourceOrder: number;
  sourceUserMessageId: string;
  sourceAssistantMessageId: string;
  publicQuestion: string;
  publicAnswer: string;
};

/**
 * Server-authoritative generation lineage + frozen selectedSteps snapshot.
 * Once sealed on a Mirror card, must not mutate when Review drafts change.
 */
export type JourneyGenerationLineage = {
  contractVersion: typeof JOURNEY_GENERATION_LINEAGE_VERSION;
  journeyId: string;
  journeyVersion: number;
  sourceConversationId: string;
  parentJourneyId?: string | null;
  windowIndex: number;
  windowStart: number;
  windowEnd: number;
  /** Phase 3.7 aliases — same values as window* */
  blockIndex?: number;
  blockStart?: number;
  blockEnd?: number;
  windowHash: string;
  sourceBlockHash?: string | null;
  scopedInputHash: string;
  selectedStepsHash: string;
  selectedCount?: number;
  interpretationHash: string;
  anchorsHash?: string | null;
  publicLandingHash: string;
  mappedPromptHash: string;
  generationId: string;
  sceneAssetId?: string | null;
  /** Frozen 6–8 Q/A used for this generation — publish authority. */
  selectedSteps: JourneyGenerationLineageSelectedStep[];
  sealedAt: string;
};

export type JourneyGenerationLineagePartial = Partial<JourneyGenerationLineage> & {
  contractVersion?: string;
  selectedSteps?: JourneyGenerationLineageSelectedStep[];
};

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function cloneJourneyGenerationLineage(
  lineage: JourneyGenerationLineage
): JourneyGenerationLineage {
  return {
    ...lineage,
    selectedSteps: lineage.selectedSteps.map((s) => ({ ...s })),
  };
}

/** True when lineage has every field required for Journey V1 publish. */
export function isPublishableJourneyGenerationLineage(
  raw: unknown
): raw is JourneyGenerationLineage {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as JourneyGenerationLineagePartial;
  const steps = row.selectedSteps;
  if (!Array.isArray(steps) || steps.length < 6 || steps.length > 8) return false;
  return Boolean(
    asTrimmed(row.journeyId) &&
      Number(row.journeyVersion) >= 1 &&
      asTrimmed(row.sourceConversationId) &&
      typeof row.windowIndex === 'number' &&
      typeof row.windowStart === 'number' &&
      typeof row.windowEnd === 'number' &&
      asTrimmed(row.windowHash) &&
      asTrimmed(row.scopedInputHash) &&
      asTrimmed(row.selectedStepsHash) &&
      asTrimmed(row.interpretationHash) &&
      asTrimmed(row.publicLandingHash) &&
      asTrimmed(row.mappedPromptHash) &&
      asTrimmed(row.generationId)
  );
}

export function readJourneyGenerationLineage(
  card: { mirrorJourneyGenerationLineage?: JourneyGenerationLineagePartial | null } | null | undefined
): JourneyGenerationLineage | null {
  const raw = card?.mirrorJourneyGenerationLineage;
  if (!isPublishableJourneyGenerationLineage(raw)) return null;
  return cloneJourneyGenerationLineage(raw);
}

/**
 * Merge server prepare lineage + local seal fields without mutating prior seal
 * when the same generationId is already attached.
 */
export function sealJourneyGenerationLineage(input: {
  existing?: JourneyGenerationLineagePartial | null;
  prepareLineage?: Record<string, unknown> | null;
  selectedSteps?: JourneyGenerationLineageSelectedStep[] | null;
  interpretationHash?: string | null;
  anchorsHash?: string | null;
  publicLandingHash?: string | null;
  mappedPromptHash?: string | null;
  generationId?: string | null;
  sceneAssetId?: string | null;
  sealedAt?: string;
}): JourneyGenerationLineagePartial {
  const prep = input.prepareLineage && typeof input.prepareLineage === 'object'
    ? input.prepareLineage
    : {};
  const existing = input.existing && typeof input.existing === 'object' ? input.existing : {};
  const existingGen = asTrimmed(existing.generationId);
  const nextGen = asTrimmed(input.generationId) || asTrimmed(prep.generationId);
  // Immutable: once sealed for generationId G, do not overwrite with a different G
  // unless caller intentionally provides a new prepare lineage for a new generation.
  if (
    existingGen &&
    nextGen &&
    existingGen === nextGen &&
    isPublishableJourneyGenerationLineage(existing)
  ) {
    return cloneJourneyGenerationLineage(existing);
  }

  const steps =
    Array.isArray(input.selectedSteps) &&
    input.selectedSteps.length >= 6 &&
    input.selectedSteps.length <= 8
      ? input.selectedSteps.map((s) => ({ ...s }))
      : Array.isArray(existing.selectedSteps) &&
          existing.selectedSteps.length >= 6 &&
          existing.selectedSteps.length <= 8
        ? existing.selectedSteps.map((s) => ({ ...s }))
        : [];

  const windowIndex =
    typeof prep.windowIndex === 'number'
      ? prep.windowIndex
      : existing.windowIndex;
  const windowStart =
    typeof prep.windowStart === 'number'
      ? prep.windowStart
      : existing.windowStart;
  const windowEnd =
    typeof prep.windowEnd === 'number' ? prep.windowEnd : existing.windowEnd;

  return {
    contractVersion: JOURNEY_GENERATION_LINEAGE_VERSION,
    journeyId: asTrimmed(prep.journeyId) || asTrimmed(existing.journeyId),
    journeyVersion: Number(prep.journeyVersion ?? existing.journeyVersion ?? 0) || undefined,
    sourceConversationId:
      asTrimmed(prep.sourceConversationId) || asTrimmed(existing.sourceConversationId),
    parentJourneyId:
      (prep.parentJourneyId as string | null | undefined) ??
      existing.parentJourneyId ??
      null,
    windowIndex,
    windowStart,
    windowEnd,
    blockIndex:
      typeof prep.blockIndex === 'number'
        ? prep.blockIndex
        : existing.blockIndex ?? windowIndex,
    blockStart:
      typeof prep.blockStart === 'number'
        ? prep.blockStart
        : existing.blockStart ?? windowStart,
    blockEnd:
      typeof prep.blockEnd === 'number'
        ? prep.blockEnd
        : existing.blockEnd ?? windowEnd,
    windowHash: asTrimmed(prep.windowHash) || asTrimmed(existing.windowHash),
    sourceBlockHash:
      asTrimmed(prep.sourceBlockHash) || asTrimmed(existing.sourceBlockHash) || null,
    scopedInputHash:
      asTrimmed(prep.scopedInputHash) || asTrimmed(existing.scopedInputHash),
    selectedStepsHash:
      asTrimmed(prep.selectedStepsHash) || asTrimmed(existing.selectedStepsHash),
    selectedCount:
      typeof prep.selectedCount === 'number'
        ? prep.selectedCount
        : existing.selectedCount ?? (steps.length || undefined),
    interpretationHash:
      asTrimmed(input.interpretationHash) ||
      asTrimmed(prep.interpretationHash) ||
      asTrimmed(existing.interpretationHash),
    anchorsHash:
      asTrimmed(input.anchorsHash) ||
      asTrimmed(prep.anchorsHash) ||
      asTrimmed(existing.anchorsHash) ||
      null,
    publicLandingHash:
      asTrimmed(input.publicLandingHash) ||
      asTrimmed(prep.publicLandingHash) ||
      asTrimmed(existing.publicLandingHash),
    mappedPromptHash:
      asTrimmed(input.mappedPromptHash) ||
      asTrimmed(prep.mappedPromptHash) ||
      asTrimmed(existing.mappedPromptHash),
    generationId: nextGen || asTrimmed(existing.generationId),
    sceneAssetId:
      asTrimmed(input.sceneAssetId) ||
      asTrimmed(prep.sceneAssetId) ||
      asTrimmed(existing.sceneAssetId) ||
      null,
    selectedSteps: steps,
    sealedAt: input.sealedAt || existing.sealedAt || new Date().toISOString(),
  };
}
