/**
 * Phase 8.6 — Review → Ayna scene kickoff (same-tab event bridge).
 *
 * After Review confirm, StandaloneChatInner dispatches this so the Ayna panel
 * can force mirror+scene generation even when the reel hides the create CTA.
 *
 * The CustomEvent is lost if the Ayna panel is unmounted (mobile closed rail,
 * or desktop column not yet opened). Persist a one-shot pending payload so
 * ObservationExperience can consume it on mount. Keep the payload until
 * generate-scene actually starts — consuming on the first effect run loses
 * the kick across React Strict Mode remount and the 1.6s reveal delay.
 */

export const JOURNEY_AYNA_GENERATE_EVENT = 'eza:journey-ayna-generate';

export const JOURNEY_AYNA_GENERATE_PENDING_KEY = 'eza:journey-ayna-generate-pending';

export type JourneyAynaGenerateDetail = {
  conversationId: string;
  journeyId: string;
  journeyVersion?: number;
  at: string;
};

function buildDetail(input: {
  conversationId: string;
  journeyId: string;
  journeyVersion?: number;
}): JourneyAynaGenerateDetail | null {
  const conversationId = input.conversationId.trim();
  const journeyId = input.journeyId.trim().toLowerCase();
  if (!conversationId || !journeyId) return null;
  return {
    conversationId,
    journeyId,
    journeyVersion: input.journeyVersion ?? 1,
    at: new Date().toISOString(),
  };
}

function persistPending(detail: JourneyAynaGenerateDetail): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      JOURNEY_AYNA_GENERATE_PENDING_KEY,
      JSON.stringify(detail)
    );
  } catch {
    // Private mode / quota — event dispatch is the remaining path.
  }
}

function readStoredPending(): JourneyAynaGenerateDetail | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(JOURNEY_AYNA_GENERATE_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JourneyAynaGenerateDetail>;
    const conversationId =
      typeof parsed.conversationId === 'string' ? parsed.conversationId.trim() : '';
    const journeyId =
      typeof parsed.journeyId === 'string' ? parsed.journeyId.trim().toLowerCase() : '';
    if (!conversationId || !journeyId) return null;
    return {
      conversationId,
      journeyId,
      journeyVersion:
        typeof parsed.journeyVersion === 'number' && parsed.journeyVersion >= 1
          ? parsed.journeyVersion
          : 1,
      at: typeof parsed.at === 'string' ? parsed.at : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function readPendingJourneyAynaGeneration(
  conversationId: string
): JourneyAynaGenerateDetail | null {
  const wanted = conversationId.trim();
  if (!wanted) return null;
  const stored = readStoredPending();
  if (!stored || stored.conversationId !== wanted) return null;
  return stored;
}

export function consumePendingJourneyAynaGeneration(
  conversationId: string
): JourneyAynaGenerateDetail | null {
  const detail = readPendingJourneyAynaGeneration(conversationId);
  if (!detail || typeof window === 'undefined') return null;
  try {
    window.sessionStorage.removeItem(JOURNEY_AYNA_GENERATE_PENDING_KEY);
  } catch {
    // ignore
  }
  return detail;
}

export function requestJourneyAynaGeneration(input: {
  conversationId: string;
  journeyId: string;
  journeyVersion?: number;
}): void {
  if (typeof window === 'undefined') return;
  const detail = buildDetail(input);
  if (!detail) return;
  persistPending(detail);
  window.dispatchEvent(
    new CustomEvent(JOURNEY_AYNA_GENERATE_EVENT, {
      detail,
    })
  );
}
