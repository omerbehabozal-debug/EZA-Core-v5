/**
 * Owner-facing public preview — same title/summary contract as Keşfet + /m landing.
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { resolvePublishCuriosityBundle } from '@/lib/eza/mirror-share/publishMirrorToNetwork';
import {
  pickVisibleLandingSummary,
  pickVisibleLandingTitle,
} from '@/lib/eza/mirror-network/publicMirrorLanding';

export type MirrorPublicPreviewContent = {
  title: string;
  summary: string;
  sceneImageUrl: string | null;
};

export function resolveMirrorPublicPreview(
  card: DailyMirrorCardModel,
  sceneImageUrl?: string | null
): MirrorPublicPreviewContent {
  let title = card.headline?.trim() || card.dailyThemeTitle?.trim() || 'Ayna';
  let summary =
    card.storyTensionSummary?.trim() ||
    card.shortInsight?.trim() ||
    card.quote?.trim() ||
    card.mirrorStory?.trim() ||
    '';

  try {
    const { bundle } = resolvePublishCuriosityBundle(card);
    const landing = bundle.publicLanding;
    title = pickVisibleLandingTitle({
      publicTitle: landing?.publicTitle ?? bundle.cardTitle,
      cardTitle: bundle.cardTitle,
    });
    summary = pickVisibleLandingSummary({
      publicSummary: landing?.publicSummary ?? null,
      curiosityContext: bundle.curiosityContext?.text ?? null,
      landingContext: bundle.landingContext ?? null,
    });
  } catch {
    // Card may lack D2/V3 during edge states — fall back to local card fields.
  }

  const scene =
    sceneImageUrl?.trim() ||
    card.visual?.sceneImageUrl?.trim() ||
    null;

  return {
    title,
    summary,
    sceneImageUrl: scene,
  };
}
