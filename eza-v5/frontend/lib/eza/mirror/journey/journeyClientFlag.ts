import { MIRROR_JOURNEY_CLIENT_FLAG } from './types';

/**
 * Client mirror of EZA_MIRROR_JOURNEY_V1.
 * Only explicit true/1 enable; anything else (incl. unset) is off.
 */
export function isMirrorJourneyV1ClientEnabled(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >
): boolean {
  const raw = (env[MIRROR_JOURNEY_CLIENT_FLAG] || '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}
