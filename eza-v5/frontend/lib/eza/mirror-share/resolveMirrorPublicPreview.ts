/**
 * Owner-facing public preview — same title/summary contract as Keşfet + /m landing.
 *
 * Never fall back to V3 storyTension / shortInsight / quote / mirrorStory / headline
 * when D2 meaning is expected. Missing D2 landing → safe unavailable copy only.
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { isMirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import { buildCuriosityFromInterpretation } from '@/lib/eza/mirror-network/buildCuriosityFromInterpretation';
import {
  buildSafePublicMirrorLandingFallback,
  pickVisibleLandingSummary,
  pickVisibleLandingTitle,
  safePublicLandingCopy,
  type PublicMirrorLanding,
  type PublicMirrorLandingSemanticSource,
} from '@/lib/eza/mirror-network/publicMirrorLanding';

export type MirrorPublicPreviewContent = {
  title: string;
  summary: string;
  sceneImageUrl: string | null;
};

const D2_OR_HEURISTIC: ReadonlySet<PublicMirrorLandingSemanticSource | string> = new Set([
  'd2_interpretation',
  'heuristic_fallback',
]);

function cardLocale(card: DailyMirrorCardModel): string {
  const fromSeed = card.mirrorV3Payload?.curiosityBundle?.seed?.locale;
  if (typeof fromSeed === 'string' && fromSeed.trim()) return fromSeed;
  return 'tr';
}

function landingFromInterpretation(card: DailyMirrorCardModel): PublicMirrorLanding | null {
  if (!isMirrorInterpretationV1(card.mirrorFinalInterpretation)) return null;
  const locale = cardLocale(card);
  return buildCuriosityFromInterpretation(card.mirrorFinalInterpretation, { locale })
    .publicLanding;
}

function isSemanticLanding(
  landing: PublicMirrorLanding | null | undefined
): landing is PublicMirrorLanding {
  if (!landing) return false;
  return D2_OR_HEURISTIC.has(landing.semanticSource);
}

function safeUnavailable(
  card: DailyMirrorCardModel,
  sceneImageUrl?: string | null
): MirrorPublicPreviewContent {
  const copy = safePublicLandingCopy(cardLocale(card));
  const fallback = buildSafePublicMirrorLandingFallback({
    locale: cardLocale(card),
  });
  return {
    title: copy.title || fallback.publicTitle,
    summary: copy.summary || fallback.publicSummary,
    sceneImageUrl:
      sceneImageUrl?.trim() ||
      card.visual?.sceneImageUrl?.trim() ||
      null,
  };
}

export function resolveMirrorPublicPreview(
  card: DailyMirrorCardModel,
  sceneImageUrl?: string | null
): MirrorPublicPreviewContent {
  const locale = cardLocale(card);
  const scene =
    sceneImageUrl?.trim() ||
    card.visual?.sceneImageUrl?.trim() ||
    null;

  // 1) Published Discover payload wins — matches Keşfet after remount.
  const publishedTitle = card.mirrorShare?.publicTitle?.trim() || '';
  const publishedSummary = card.mirrorShare?.publicSummary?.trim() || '';
  if (publishedTitle || publishedSummary) {
    return {
      title: pickVisibleLandingTitle({
        publicTitle: publishedTitle || null,
        cardTitle: null,
        locale,
      }),
      summary: pickVisibleLandingSummary({
        publicSummary: publishedSummary || null,
        curiosityContext: null,
        landingContext: null,
        locale,
      }),
      sceneImageUrl: scene,
    };
  }

  // 2) Live D2 interpretation → public landing.
  const fromInterp = landingFromInterpretation(card);
  if (fromInterp) {
    return {
      title: pickVisibleLandingTitle({
        publicTitle: fromInterp.publicTitle,
        cardTitle: null,
        locale,
      }),
      summary: pickVisibleLandingSummary({
        publicSummary: fromInterp.publicSummary,
        curiosityContext: null,
        landingContext: null,
        locale,
      }),
      sceneImageUrl: scene,
    };
  }

  // 3) Existing curiosityBundle publicLanding with d2/heuristic semantic.
  const bundleLanding = card.mirrorV3Payload?.curiosityBundle?.publicLanding;
  if (isSemanticLanding(bundleLanding)) {
    return {
      title: pickVisibleLandingTitle({
        publicTitle: bundleLanding.publicTitle,
        cardTitle: null,
        locale,
      }),
      summary: pickVisibleLandingSummary({
        publicSummary: bundleLanding.publicSummary,
        curiosityContext: null,
        landingContext: null,
        locale,
      }),
      sceneImageUrl: scene,
    };
  }

  // 4) Semantic source claims D2/heuristic but no landing → safe only (never V3).
  const semantic = card.mirrorSemanticSource;
  if (semantic === 'd2_interpretation' || semantic === 'heuristic_fallback') {
    return safeUnavailable(card, scene);
  }

  // No D2 meaning available — safe unavailable (never storyTension / insight / quote / V3 headline).
  return safeUnavailable(card, scene);
}
