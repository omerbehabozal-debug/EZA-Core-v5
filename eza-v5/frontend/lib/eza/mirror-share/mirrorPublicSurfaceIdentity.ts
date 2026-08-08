/**
 * Shared public Mirror identity — preview / discover / landing / share must agree
 * on meaning fields (title, summary, hashes), independent of scene asset churn.
 */

import type { PublicMirrorLanding } from '@/lib/eza/mirror-network/publicMirrorLanding';

export type MirrorPublicSurfaceIdentity = {
  slug: string | null;
  sceneImageUrl: string | null;
  publicTitle: string;
  publicSummary: string;
  contractVersion: string | null;
  interpretationHash: string | null;
  publicLandingHash: string | null;
  semanticSource: string | null;
};

export type ResolveMirrorPublicSurfaceIdentityInput = {
  landing: Pick<
    PublicMirrorLanding,
    'publicTitle' | 'publicSummary' | 'contractVersion' | 'interpretationHash' | 'semanticSource'
  > & { publicLandingHash?: string | null };
  slug?: string | null;
  sceneImageUrl?: string | null;
  publicLandingHash?: string | null;
};

export function resolveMirrorPublicSurfaceIdentity(
  input: ResolveMirrorPublicSurfaceIdentityInput
): MirrorPublicSurfaceIdentity {
  const { landing } = input;
  return {
    slug: input.slug?.trim() || null,
    sceneImageUrl: input.sceneImageUrl?.trim() || null,
    publicTitle: (landing.publicTitle || '').trim(),
    publicSummary: (landing.publicSummary || '').trim(),
    contractVersion: landing.contractVersion ?? null,
    interpretationHash: landing.interpretationHash ?? null,
    publicLandingHash:
      input.publicLandingHash?.trim() ||
      landing.publicLandingHash?.trim() ||
      null,
    semanticSource: landing.semanticSource ?? null,
  };
}

const MEANING_FIELDS: Array<keyof MirrorPublicSurfaceIdentity> = [
  'publicTitle',
  'publicSummary',
  'contractVersion',
  'interpretationHash',
  'publicLandingHash',
  'semanticSource',
];

/**
 * Throws when meaning fields diverge. Scene URL / slug differences are allowed
 * (Yeni Sahne may change sceneAssetId while meaning stays identical).
 */
export function assertSamePublicSurfaceIdentity(
  a: MirrorPublicSurfaceIdentity,
  b: MirrorPublicSurfaceIdentity
): void {
  for (const key of MEANING_FIELDS) {
    const left = a[key] ?? null;
    const right = b[key] ?? null;
    if (left !== right) {
      throw new Error(
        `public_surface_identity_mismatch:${key}:${String(left)}!=${String(right)}`
      );
    }
  }
}
