/**
 * Landing surface contract — public title + public summary.
 * continuationContext is never rendered here.
 */

import type {
  MirrorLandingSurface,
  MirrorNetworkPublicApiResponse,
} from '@/lib/eza/mirror-network/publicTypes';
import {
  pickVisibleLandingSummary,
  pickVisibleLandingTitle,
} from '@/lib/eza/mirror-network/publicMirrorLanding';

const MONTHS_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

export function formatMirrorLandingDate(cardDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cardDate.trim());
  if (!match) return cardDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthLabel = MONTHS_TR[month - 1];
  if (!monthLabel) return cardDate;
  return `${day} ${monthLabel} ${year}`;
}

export function pickMirrorLandingSurface(
  payload: MirrorNetworkPublicApiResponse
): MirrorLandingSurface {
  const summary = pickVisibleLandingSummary({
    publicSummary: payload.publicSummary,
    curiosityContext: payload.curiosityContext,
    landingContext: payload.landingContext,
  });
  const title = pickVisibleLandingTitle({
    publicTitle: payload.publicTitle,
    cardTitle: payload.cardTitle,
  });

  return {
    slug: payload.slug,
    cardTitle: title,
    cardDate: payload.cardDate,
    dayLabel: formatMirrorLandingDate(payload.cardDate),
    sceneImageUrl: payload.sceneImageUrl?.trim() || null,
    curiosityContext: summary,
    publicSummary: summary,
  };
}

/** Dev guard — ensure forbidden landing fields are not passed to UI. */
export function assertMirrorLandingSurfaceClean(surface: MirrorLandingSurface): void {
  const record = surface as Record<string, unknown>;
  const forbidden = [
    'coreCuriosity',
    'hooks',
    'seedQuestions',
    'discoverySignals',
    'collectionTags',
    'seed',
    'tags',
    'continuationContext',
  ];
  for (const key of forbidden) {
    if (key in record) {
      throw new Error(`mirror_landing_forbidden_field:${key}`);
    }
  }
}
