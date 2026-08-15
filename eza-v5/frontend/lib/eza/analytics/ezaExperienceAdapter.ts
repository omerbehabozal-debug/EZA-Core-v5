/**
 * EZA Observation — Experience Event Adapter
 *
 * EZA observes. SAINA decides.
 * Fire-and-forget POST to /api/eza/experience-events when enabled.
 * Never affects UX; never receives actions or recommendations.
 */

import { apiClient } from '@/lib/apiClient';
import { MIRROR_GUEST_TOKEN_KEY } from '@/lib/eza/mirror-network/sohbetTypes';

const SESSION_STORAGE_KEY = 'eza_experience_session_id';
const PRODUCT_ID = 'saina';

/** Sprint allowlist — product-specific event names sent to observation layer. */
export const EXPERIENCE_EVENT_ALLOWLIST = new Set([
  'mirror_birth_suggested',
  'mirror_birth_accepted',
  'mirror_created',
  'mirror_share_opened',
  'mirror_shared',
  'landing_viewed',
  'landing_cta_clicked',
  'guest_conversation_started',
  'second_user_message_sent',
  'branch_suggestion_shown',
  'branch_opened',
  'guest_tree_claimed',
  'relationship_pattern_viewed',
]);

export type ExperienceTrackPayload = {
  conversationId?: string | null;
  mirrorId?: string | null;
  rootMirrorId?: string | null;
  parentMirrorId?: string | null;
  guestToken?: string | null;
  sessionId?: string | null;
  productVersion?: string | null;
  context?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
};

/** Default false — observation ingest is opt-in via env on staging/prod. */
export function isExperienceEventLoggingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EXPERIENCE_EVENT_LOGGING_ENABLED === 'true';
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return `sess-${Date.now()}`;
  }
}

function resolveGuestToken(explicit?: string | null): string | null {
  if (explicit) return explicit;
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(MIRROR_GUEST_TOKEN_KEY);
  } catch {
    return null;
  }
}

function hasAuthToken(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem('eza_token'));
  } catch {
    return false;
  }
}

async function postExperienceEvent(
  eventType: string,
  payload: ExperienceTrackPayload = {}
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isExperienceEventLoggingEnabled()) return;
  if (!EXPERIENCE_EVENT_ALLOWLIST.has(eventType)) return;

  const sessionId = payload.sessionId ?? getOrCreateSessionId();
  const guestToken = resolveGuestToken(payload.guestToken);

  try {
    await apiClient.post('/api/eza/experience-events', {
      auth: hasAuthToken(),
      body: {
        productId: PRODUCT_ID,
        productVersion: payload.productVersion ?? undefined,
        eventType,
        sessionId,
        guestToken: guestToken ?? undefined,
        conversationId: payload.conversationId ?? undefined,
        mirrorId: payload.mirrorId ?? undefined,
        rootMirrorId: payload.rootMirrorId ?? undefined,
        parentMirrorId: payload.parentMirrorId ?? undefined,
        context: payload.context ?? undefined,
        metrics: payload.metrics ?? undefined,
      },
    });
  } catch {
    // Observation must never break product UX.
  }
}

export const ezaExperience = {
  /**
   * Track a product experience event (fire-and-forget).
   * EZA observes only — never returns UX actions.
   */
  track(eventType: string, payload: ExperienceTrackPayload = {}): void {
    void postExperienceEvent(eventType, payload);
  },
};

export { postExperienceEvent };
