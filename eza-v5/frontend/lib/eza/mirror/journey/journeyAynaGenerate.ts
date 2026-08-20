/**
 * Phase 8.6 — Review → Ayna scene kickoff (same-tab event bridge).
 *
 * After Review confirm, StandaloneChatInner dispatches this so the Ayna panel
 * can force mirror+scene generation even when the reel hides the create CTA.
 */

export const JOURNEY_AYNA_GENERATE_EVENT = 'eza:journey-ayna-generate';

export type JourneyAynaGenerateDetail = {
  conversationId: string;
  journeyId: string;
  journeyVersion?: number;
  at: string;
};

export function requestJourneyAynaGeneration(input: {
  conversationId: string;
  journeyId: string;
  journeyVersion?: number;
}): void {
  if (typeof window === 'undefined') return;
  const conversationId = input.conversationId.trim();
  const journeyId = input.journeyId.trim().toLowerCase();
  if (!conversationId || !journeyId) return;
  window.dispatchEvent(
    new CustomEvent(JOURNEY_AYNA_GENERATE_EVENT, {
      detail: {
        conversationId,
        journeyId,
        journeyVersion: input.journeyVersion ?? 1,
        at: new Date().toISOString(),
      } satisfies JourneyAynaGenerateDetail,
    })
  );
}
