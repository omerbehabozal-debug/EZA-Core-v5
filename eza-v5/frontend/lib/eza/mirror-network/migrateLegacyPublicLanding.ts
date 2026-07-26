/**
 * Legacy public landing migration helpers.
 *
 * Strategy:
 * 1. If D2 interpretation is available → rebuild public landing v1
 * 2. Else → safe neutral fallback (never evidence labels)
 * 3. Audit metadata retained on the returned payload
 */

import type { MirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import { isMirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import {
  buildPublicMirrorLandingFromInterpretation,
  buildSafePublicMirrorLandingFallback,
  isLegacyAntiSummaryLandingCopy,
  MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
  type PublicMirrorLanding,
} from '@/lib/eza/mirror-network/publicMirrorLanding';

export type LegacyLandingMigrationResult = {
  migrated: boolean;
  reason: 'd2_rebuild' | 'safe_fallback' | 'already_v1' | 'not_legacy';
  publicLanding: PublicMirrorLanding;
  previousSummary?: string;
  audit: {
    contractVersion: typeof MIRROR_PUBLIC_LANDING_CONTRACT_VERSION;
    migratedAt: string;
    previousHadAntiSummaryTemplate: boolean;
  };
};

export function migrateLegacyPublicLanding(input: {
  curiosityContext?: string | null;
  landingContext?: string | null;
  publicLanding?: PublicMirrorLanding | null;
  cardTitle?: string | null;
  finalInterpretation?: MirrorInterpretationV1 | null;
}): LegacyLandingMigrationResult {
  const previous =
    input.curiosityContext?.trim() || input.landingContext?.trim() || '';
  const hadAntiSummary = isLegacyAntiSummaryLandingCopy(previous);

  if (
    input.publicLanding?.contractVersion === MIRROR_PUBLIC_LANDING_CONTRACT_VERSION &&
    !hadAntiSummary
  ) {
    return {
      migrated: false,
      reason: 'already_v1',
      publicLanding: input.publicLanding,
      previousSummary: previous || undefined,
      audit: {
        contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
        migratedAt: new Date().toISOString(),
        previousHadAntiSummaryTemplate: false,
      },
    };
  }

  if (isMirrorInterpretationV1(input.finalInterpretation)) {
    const publicLanding = buildPublicMirrorLandingFromInterpretation(
      input.finalInterpretation
    );
    return {
      migrated: true,
      reason: 'd2_rebuild',
      publicLanding,
      previousSummary: previous || undefined,
      audit: {
        contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
        migratedAt: new Date().toISOString(),
        previousHadAntiSummaryTemplate: hadAntiSummary,
      },
    };
  }

  if (!hadAntiSummary && previous) {
    return {
      migrated: false,
      reason: 'not_legacy',
      publicLanding: buildSafePublicMirrorLandingFallback({
        title: input.cardTitle || undefined,
      }),
      previousSummary: previous,
      audit: {
        contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
        migratedAt: new Date().toISOString(),
        previousHadAntiSummaryTemplate: false,
      },
    };
  }

  const publicLanding = buildSafePublicMirrorLandingFallback({
    title: input.cardTitle || undefined,
  });
  return {
    migrated: true,
    reason: 'safe_fallback',
    publicLanding,
    previousSummary: previous || undefined,
    audit: {
      contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
      migratedAt: new Date().toISOString(),
      previousHadAntiSummaryTemplate: hadAntiSummary,
    },
  };
}
