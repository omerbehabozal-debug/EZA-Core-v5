/**
 * Lightweight image claim detection — client contract.
 * Backend/OpenAI vision is optional; tests inject detections.
 */

import { apiClient } from '@/lib/apiClient';
import type { DetectedClaim } from '@/lib/eza/mirror/narrativeAlignment/types';

export type DetectImageClaimsInput = {
  sceneImageUrl: string;
  generationId?: string | null;
};

export type DetectImageClaimsResult = {
  detectedClaims: DetectedClaim[];
  source: 'vision_api' | 'injected' | 'unavailable';
};

export type DetectImageClaimsFn = (
  input: DetectImageClaimsInput
) => Promise<DetectImageClaimsResult>;

/** Always-empty detector (dev / when vision unavailable). Causes FAIL if required claims exist. */
export const emptyImageClaimDetector: DetectImageClaimsFn = async () => ({
  detectedClaims: [],
  source: 'unavailable',
});

/** Deterministic injector for tests and fixtures. */
export function createInjectedClaimDetector(
  claims: DetectedClaim[] | ((url: string) => DetectedClaim[])
): DetectImageClaimsFn {
  return async (input) => ({
    detectedClaims: typeof claims === 'function' ? claims(input.sceneImageUrl) : claims,
    source: 'injected',
  });
}

/**
 * Call backend lightweight detector when available.
 * Fail-soft: unavailable → empty detections (publish gate will FAIL if required claims exist).
 */
export const apiImageClaimDetector: DetectImageClaimsFn = async (input) => {
  try {
    const response = await apiClient.post<{ detectedClaims?: DetectedClaim[] }>(
      '/api/standalone/mirror/detect-image-claims',
      {
        body: {
          sceneImageUrl: input.sceneImageUrl,
          generationId: input.generationId ?? undefined,
        },
        auth: true,
        timeoutMs: 45_000,
      }
    );
    if (!response.ok) {
      return { detectedClaims: [], source: 'unavailable' };
    }
    const data = (response.data ?? response) as { detectedClaims?: DetectedClaim[] };
    return {
      detectedClaims: Array.isArray(data.detectedClaims) ? data.detectedClaims : [],
      source: 'vision_api',
    };
  } catch {
    return { detectedClaims: [], source: 'unavailable' };
  }
};
