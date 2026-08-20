import { MIRROR_JOURNEY_CLIENT_FLAG } from './types';

/**
 * Client mirror of EZA_MIRROR_JOURNEY_V1.
 * Only explicit true/1 enable; anything else (incl. unset) is off.
 * Must stay aligned with backend parse_strict_env_bool for true/1/false/0/unset.
 */
export function isMirrorJourneyV1ClientEnabled(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >
): boolean {
  return parseMirrorJourneyV1Flag(env[MIRROR_JOURNEY_CLIENT_FLAG]);
}

/** Shared true/1 semantics used by FE flag + Phase 8.6 parity tests. */
export function parseMirrorJourneyV1Flag(raw: string | undefined | null): boolean {
  const value = (raw || '').trim().toLowerCase();
  return value === 'true' || value === '1';
}
