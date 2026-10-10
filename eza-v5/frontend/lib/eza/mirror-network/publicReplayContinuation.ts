/** Public source prefix is metadata, never personal archive turns. */
export type PublicReplaySelection = { slug: string; journeyVersion: number; completedStepCount: number };
export type PublicReplayContext = PublicReplaySelection & {
  publicTitle: string;
  authorUserId: string;
  steps: { stepIndex: number; publicQuestion: string; publicAnswer: string }[];
};

export function parsePublicReplayContext(value: unknown, expected?: PublicReplaySelection): PublicReplayContext | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as PublicReplayContext;
  if (typeof candidate.slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(candidate.slug)
    || !Number.isInteger(candidate.journeyVersion) || candidate.journeyVersion < 1
    || !Number.isInteger(candidate.completedStepCount) || candidate.completedStepCount < 0 || candidate.completedStepCount > 8
    || typeof candidate.authorUserId !== 'string' || !candidate.authorUserId.trim()
    || typeof candidate.publicTitle !== 'string' || !Array.isArray(candidate.steps)
    || candidate.steps.length !== candidate.completedStepCount) return null;
  if (expected && (candidate.slug !== expected.slug || candidate.journeyVersion !== expected.journeyVersion
    || candidate.completedStepCount !== expected.completedStepCount)) return null;
  if (candidate.steps.some((step, index) => !step || step.stepIndex !== index + 1
    || typeof step.publicQuestion !== 'string' || !step.publicQuestion.trim()
    || typeof step.publicAnswer !== 'string' || !step.publicAnswer.trim())) return null;
  return { ...replaySelection(candidate), publicTitle: candidate.publicTitle, authorUserId: candidate.authorUserId,
    steps: candidate.steps.map(({ stepIndex, publicQuestion, publicAnswer }) => ({ stepIndex, publicQuestion, publicAnswer })) };
}

export function replaySelection(context: PublicReplayContext): PublicReplaySelection {
  return { slug: context.slug, journeyVersion: context.journeyVersion, completedStepCount: context.completedStepCount };
}

export function publicReplayMessages(context: PublicReplayContext) {
  return context.steps.flatMap((step) => [
    { id: `public:${context.slug}:${context.journeyVersion}:${step.stepIndex}:user`, text: step.publicQuestion, isUser: true },
    { id: `public:${context.slug}:${context.journeyVersion}:${step.stepIndex}:assistant`, text: step.publicAnswer, isUser: false },
  ]);
}
