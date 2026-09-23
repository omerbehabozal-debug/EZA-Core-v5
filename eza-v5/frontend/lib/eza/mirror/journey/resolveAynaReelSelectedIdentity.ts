/**
 * Prefer the exact READY/published Yansı when opening Ayna without a route
 * selection, so a historical FAILED slide never owns the initial viewport.
 */

import type { MirrorJourneyArtifact } from './mirrorJourneyArtifact';
import {
  artifactMatchesYansiIdentity,
  type YansiArtifactIdentity,
} from './yansiSidebarIdentity';

function isReusableReady(artifact: MirrorJourneyArtifact): boolean {
  return artifact.status === 'ready' || artifact.status === 'published';
}

/**
 * Resolve which artifact the reel should initially present.
 * Route/sidebar identity wins when it matches a listed artifact.
 * Otherwise prefer the latest READY/published product — never a failed ghost.
 */
export function resolveAynaReelSelectedIdentity(input: {
  artifacts: ReadonlyArray<MirrorJourneyArtifact>;
  routeIdentity?: YansiArtifactIdentity | null;
}): YansiArtifactIdentity | null {
  const artifacts = input.artifacts;
  if (artifacts.length === 0) return null;

  const route = input.routeIdentity ?? null;
  if (
    route &&
    artifacts.some((a) => artifactMatchesYansiIdentity(a, route))
  ) {
    return route;
  }

  const ready = [...artifacts]
    .filter(isReusableReady)
    .sort((a, b) => {
      if (a.blockIndex !== b.blockIndex) return b.blockIndex - a.blockIndex;
      if (a.journeyVersion !== b.journeyVersion) {
        return b.journeyVersion - a.journeyVersion;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  const preferred = ready[0];
  if (preferred) {
    return {
      journeyId: preferred.journeyId,
      journeyVersion: preferred.journeyVersion,
    };
  }

  return null;
}
