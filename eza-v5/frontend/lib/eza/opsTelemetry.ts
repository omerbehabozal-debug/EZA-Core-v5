/**
 * Phase 8.8 — privacy-safe frontend operational telemetry.
 * Never sends Error.message, URLs, tokens, response bodies, or conversation text.
 */

import { buildApiUrl } from '@/lib/apiUrl';

export type OpsClientEvent =
  | 'discover_load_failed'
  | 'public_yansi_load_failed'
  | 'frozen_replay_load_failed'
  | 'sohbet_session_create_failed'
  | 'ayna_generation_failed'
  | 'yansi_publish_failed'
  | 'share_route_load_failed'
  | 'auth_login_failed'
  | 'auth_register_failed'
  | 'social_auth_failed'
  | 'guest_claim_failed'
  | 'journey_rebind_failed';

const ALLOWED = new Set<string>([
  'discover_load_failed',
  'public_yansi_load_failed',
  'frozen_replay_load_failed',
  'sohbet_session_create_failed',
  'ayna_generation_failed',
  'yansi_publish_failed',
  'share_route_load_failed',
  'auth_login_failed',
  'auth_register_failed',
  'social_auth_failed',
  'guest_claim_failed',
  'journey_rebind_failed',
]);

function isSafeCode(code: string | undefined): code is string {
  if (!code || code.length > 64) return false;
  return /^[A-Z][A-Z0-9_]*$/.test(code);
}

/**
 * Best-effort ops signal. Never throws. Never attaches Error objects.
 */
export function reportOpsFailure(
  event: OpsClientEvent,
  code?: string
): void {
  if (typeof window === 'undefined') return;
  if (!ALLOWED.has(event)) return;
  const safeCode = isSafeCode(code) ? code : undefined;
  try {
    const pending = fetch(buildApiUrl('/api/ops/client-event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        event,
        code: safeCode,
        outcome: 'failure',
      }),
      keepalive: true,
    });
    if (pending && typeof pending.catch === 'function') {
      void pending.catch(() => {
        /* ignore */
      });
    }
  } catch {
    /* ignore */
  }
}
