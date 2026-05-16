import type { PipelineGovernance, StandaloneFeedbackContext } from '@/lib/types';

export function feedbackContextFromGovernance(
  governance?: PipelineGovernance | null,
  opts?: {
    riskLevel?: string | null;
    safety?: string | null;
    ezaScore?: number | null;
    assistantScore?: number | null;
  }
): StandaloneFeedbackContext | null {
  const eventId = governance?.event_id;
  if (!eventId) {
    return null;
  }
  const score = opts?.ezaScore ?? opts?.assistantScore ?? undefined;
  const label = opts?.safety ?? opts?.riskLevel ?? undefined;
  return {
    eventId,
    originalLabel: label,
    originalScore: score,
  };
}

export function parseGovernance(payload: unknown): PipelineGovernance | null {
  if (!payload || typeof payload !== 'object') return null;
  const g = payload as PipelineGovernance;
  return {
    event_id: g.event_id ?? null,
    event_logging_enabled: Boolean(g.event_logging_enabled),
  };
}
