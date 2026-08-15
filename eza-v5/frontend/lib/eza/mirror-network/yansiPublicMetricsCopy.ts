/**
 * Phase 6.2 — compact public social-proof copy.
 *
 * Displays only STARTED sessions and direct child Yansı count.
 * Never formats completion/skip/depth, views, or Discover/impact counts.
 */

import {
  YANSI_PUBLIC_METRIC_CHILD,
  YANSI_PUBLIC_METRIC_EXPERIENCE,
} from '@/lib/eza/mirror/copy';

export type YansiPublicSocialProofInput = {
  experienceStartedCount: number;
  directChildYansiCount: number;
};

export type YansiPublicSocialProofCopy = {
  visible: string;
  sr: string;
};

function formatTrCount(n: number): string {
  return Math.trunc(n).toLocaleString('tr-TR');
}

export function parseYansiPublicSocialProofInput(
  raw: unknown
): YansiPublicSocialProofInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const started = row.experienceStartedCount;
  const children = row.directChildYansiCount;
  if (typeof started !== 'number' || typeof children !== 'number') return null;
  if (!Number.isInteger(started) || !Number.isInteger(children)) return null;
  if (started < 0 || children < 0) return null;
  return {
    experienceStartedCount: started,
    directChildYansiCount: children,
  };
}

export function formatYansiPublicSocialProof(
  input: YansiPublicSocialProofInput
): YansiPublicSocialProofCopy | null {
  const started = input.experienceStartedCount;
  const children = input.directChildYansiCount;
  if (!Number.isFinite(started) || !Number.isFinite(children)) return null;
  if (!Number.isInteger(started) || !Number.isInteger(children)) return null;
  if (started < 0 || children < 0) return null;
  if (started === 0 && children === 0) return null;

  const experience = `${formatTrCount(started)} ${YANSI_PUBLIC_METRIC_EXPERIENCE}`;
  if (children === 0) {
    return { visible: experience, sr: experience };
  }
  const yansi = `${formatTrCount(children)} ${YANSI_PUBLIC_METRIC_CHILD}`;
  return {
    visible: `${experience} · ${yansi}`,
    sr: `${experience}, ${yansi}`,
  };
}
