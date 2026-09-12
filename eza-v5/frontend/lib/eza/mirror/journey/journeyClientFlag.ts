/**
 * Client mirror of EZA_MIRROR_JOURNEY_V1.
 * Only explicit true/1 enable; anything else (incl. unset) is off.
 * Must stay aligned with backend parse_strict_env_bool for true/1/false/0/unset.
 *
 * Production browser path MUST reference process.env.NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1
 * statically so Next.js can inline the Vercel build-time value. Dynamic
 * env[MIRROR_JOURNEY_CLIENT_FLAG] is not inlined and stays off in the client bundle.
 */
export function isMirrorJourneyV1ClientEnabled(
  env?: Record<string, string | undefined>
): boolean {
  if (env) {
    return parseMirrorJourneyV1Flag(env.NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1);
  }
  return parseMirrorJourneyV1Flag(process.env.NEXT_PUBLIC_EZA_MIRROR_JOURNEY_V1);
}

/**
 * Phase 8.8F — Saina Yansı invitation uses the canonical 8 eligible Q/A window.
 * Publish identity remains fail-closed behind isMirrorJourneyV1ClientEnabled.
 */
export function isSainaYansiInvitationEnabled(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >
): boolean {
  if (env.NEXT_PUBLIC_EZA_YANSI_INVITATION === '0' || env.NEXT_PUBLIC_EZA_YANSI_INVITATION === 'false') {
    return false;
  }
  return true;
}

/** Shared true/1 semantics used by FE flag + Phase 8.6 parity tests. */
export function parseMirrorJourneyV1Flag(raw: string | undefined | null): boolean {
  const value = (raw || '').trim().toLowerCase();
  return value === 'true' || value === '1';
}
