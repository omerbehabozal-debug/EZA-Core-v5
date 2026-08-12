/**
 * Phase 5.0 — Public frozen Journey types (mirror backend PublicFrozenJourneyArtifact).
 * Display-only; no internal hashes / source ids.
 */

export type PublicFrozenStepEzaSnapshot = {
  assistantScore?: number | null;
  userScore?: number | null;
  ezaFinal?: number | null;
  outputHealth?: number | null;
  inputHealth?: number | null;
  alignmentScore?: number | null;
  redirect?: boolean | null;
  redirectBenign?: boolean | null;
  intent?: string | null;
};

export type PublicFrozenJourneyStep = {
  stepIndex: number;
  publicQuestion: string;
  publicAnswer: string;
  ezaSnapshot?: PublicFrozenStepEzaSnapshot | null;
};

export type PublicFrozenJourneyArtifact = {
  slug: string;
  journeyId: string;
  journeyVersion: number;
  publicTitle?: string | null;
  publicSummary?: string | null;
  continuationContext?: string | null;
  sceneImageUrl?: string | null;
  authorUserId: string;
  parentSlug?: string | null;
  selectedCount: number;
  steps: PublicFrozenJourneyStep[];
  publishedAt?: string | null;
  replayReady: boolean;
};

function asScore(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
}

function parseEza(raw: unknown): PublicFrozenStepEzaSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const out: PublicFrozenStepEzaSnapshot = {
    assistantScore: asScore(row.assistantScore),
    userScore: asScore(row.userScore),
    ezaFinal: asScore(row.ezaFinal),
    outputHealth: asScore(row.outputHealth),
    inputHealth: asScore(row.inputHealth),
    alignmentScore: asScore(row.alignmentScore),
    redirect: typeof row.redirect === 'boolean' ? row.redirect : null,
    redirectBenign: typeof row.redirectBenign === 'boolean' ? row.redirectBenign : null,
    intent: typeof row.intent === 'string' ? row.intent : null,
  };
  const hasAny = Object.values(out).some((v) => v != null && v !== '');
  return hasAny ? out : null;
}

function parseStep(raw: unknown): PublicFrozenJourneyStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const stepIndex = Number(row.stepIndex);
  const publicQuestion = String(row.publicQuestion || '').trim();
  const publicAnswer = String(row.publicAnswer || '').trim();
  if (!Number.isFinite(stepIndex) || stepIndex < 1 || stepIndex > 8) return null;
  if (!publicQuestion || !publicAnswer) return null;
  return {
    stepIndex: Math.trunc(stepIndex),
    publicQuestion,
    publicAnswer,
    ezaSnapshot: parseEza(row.ezaSnapshot),
  };
}

/**
 * Parse/validate public frozen JSON. Fail closed on malformed / not replay-ready.
 * Does not invent missing Q/A.
 */
export function parsePublicFrozenJourneyArtifact(
  raw: unknown
): PublicFrozenJourneyArtifact | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.replayReady !== true) return null;
  const slug = String(row.slug || '').trim().toLowerCase();
  const journeyId = String(row.journeyId || slug).trim().toLowerCase();
  const journeyVersion = Number(row.journeyVersion);
  const authorUserId = String(row.authorUserId || '').trim();
  const selectedCount = Number(row.selectedCount);
  if (!slug || !journeyId || !authorUserId) return null;
  if (!Number.isFinite(journeyVersion) || journeyVersion < 1) return null;
  if (!Number.isFinite(selectedCount) || selectedCount < 6 || selectedCount > 8) {
    return null;
  }
  if (!Array.isArray(row.steps) || row.steps.length !== selectedCount) return null;

  const steps: PublicFrozenJourneyStep[] = [];
  for (let i = 0; i < row.steps.length; i += 1) {
    const step = parseStep(row.steps[i]);
    if (!step) return null;
    if (step.stepIndex !== i + 1) return null;
    steps.push(step);
  }

  return {
    slug,
    journeyId,
    journeyVersion: Math.trunc(journeyVersion),
    publicTitle:
      typeof row.publicTitle === 'string' ? row.publicTitle.trim() || null : null,
    publicSummary:
      typeof row.publicSummary === 'string' ? row.publicSummary.trim() || null : null,
    continuationContext:
      typeof row.continuationContext === 'string'
        ? row.continuationContext.trim() || null
        : null,
    sceneImageUrl:
      typeof row.sceneImageUrl === 'string' ? row.sceneImageUrl.trim() || null : null,
    authorUserId,
    parentSlug:
      typeof row.parentSlug === 'string'
        ? row.parentSlug.trim().toLowerCase() || null
        : null,
    selectedCount: Math.trunc(selectedCount),
    steps,
    publishedAt: typeof row.publishedAt === 'string' ? row.publishedAt : null,
    replayReady: true,
  };
}
