/**
 * Prefer the exact READY/published Yansı when opening Ayna without a route
 * selection, so a historical FAILED slide never owns the initial viewport.
 *
 * Also suppress obsolete FAILED products superseded by a READY/published
 * artifact on the same Journey window / product lineage.
 */

import type { MirrorJourneyArtifact } from './mirrorJourneyArtifact';
import {
  artifactMatchesYansiIdentity,
  type YansiArtifactIdentity,
} from './yansiSidebarIdentity';

function isReusableReady(artifact: MirrorJourneyArtifact): boolean {
  return artifact.status === 'ready' || artifact.status === 'published';
}

function windowKey(artifact: MirrorJourneyArtifact): string {
  const lineage = artifact.sealedLineage;
  if (
    lineage &&
    typeof lineage.windowStart === 'number' &&
    typeof lineage.windowEnd === 'number'
  ) {
    return `w:${lineage.windowStart}-${lineage.windowEnd}`;
  }
  return `b:${artifact.blockIndex}`;
}

/**
 * Same logical Journey window/product as a READY artifact?
 * Uses blockIndex, journeyId, selectedStepsHash, and sealed window bounds.
 */
export function isFailedSupersededByReady(
  failed: MirrorJourneyArtifact,
  readyArtifacts: ReadonlyArray<MirrorJourneyArtifact>
): boolean {
  if (failed.status !== 'failed') return false;
  for (const ready of readyArtifacts) {
    if (ready.journeyId === failed.journeyId) return true;
    if (ready.blockIndex === failed.blockIndex) return true;
    if (
      failed.selectedStepsHash &&
      ready.selectedStepsHash &&
      failed.selectedStepsHash === ready.selectedStepsHash
    ) {
      return true;
    }
    if (windowKey(failed) === windowKey(ready) && windowKey(failed).startsWith('w:')) {
      return true;
    }
  }
  return false;
}

/**
 * Active Ayna reel list: keep generating/ready/published; keep independent
 * failed products; drop failed attempts superseded by READY on the same window.
 * Exact route identity may still include a failed artifact for deep-link.
 */
export function listAynaReelArtifacts(input: {
  artifacts: ReadonlyArray<MirrorJourneyArtifact>;
  routeIdentity?: YansiArtifactIdentity | null;
}): MirrorJourneyArtifact[] {
  const route = input.routeIdentity ?? null;
  const readyArtifacts = input.artifacts.filter(isReusableReady);

  return input.artifacts.filter((artifact) => {
    if (artifact.status !== 'failed') return true;
    if (route && artifactMatchesYansiIdentity(artifact, route)) return true;
    if (isFailedSupersededByReady(artifact, readyArtifacts)) return false;
    return true;
  });
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
  const artifacts = listAynaReelArtifacts(input);
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

/** User-facing copy for known internal generation failure codes. */
export function resolveAynaGenerationErrorCopy(
  generationError: string | null | undefined
): string | null {
  const raw = (generationError || '').trim();
  if (!raw) return null;
  if (raw === 'legacy_incompatible_sealed_selection') {
    return 'Bu Yansı için kayıtlı seçim bulunamadı. Tekrar deneyebilirsin.';
  }
  if (raw.startsWith('Scoped message')) {
    return 'Yansı içeriği doğrulanamadı. Tekrar deneyebilirsin.';
  }
  // Avoid leaking raw internal identifiers as primary UI.
  if (/^[a-z0-9_.:-]+$/i.test(raw) && !raw.includes(' ')) {
    return 'Yansı oluşturulamadı. Tekrar deneyebilirsin.';
  }
  return raw;
}
