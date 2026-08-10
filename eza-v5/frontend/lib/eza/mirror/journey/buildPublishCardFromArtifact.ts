/**
 * Phase 3.8 — rebuild a publishable DailyMirrorCard from a panel artifact.
 * Prefer the live card when its sealed lineage matches the artifact identity.
 * Never borrow another Journey's live card for publish/share identity.
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import {
  isPublishableJourneyGenerationLineage,
  type JourneyGenerationLineage,
} from '@/lib/eza/mirror/journey/journeyGenerationLineage';
import {
  MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
  type PublicMirrorLanding,
  type PublicMirrorLandingSemanticSource,
} from '@/lib/eza/mirror-network/publicMirrorLanding';
import type { MirrorCuriosityBundle } from '@/lib/eza/mirror-network/types';
import type { MirrorSemanticAnchorsV1 } from '@/lib/eza/mirror/semanticAnchors/types';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

const STORY_TOPIC_IDS = new Set<StoryTopicId>([
  'vehicle',
  'travel',
  'architecture',
  'technology_ai',
  'finance',
  'health',
  'food_culture',
  'family',
  'education',
  'spiritual_reflection',
  'general_curiosity',
]);

function coerceSemanticSource(
  value: string | null | undefined
): PublicMirrorLandingSemanticSource {
  if (
    value === 'd2_interpretation' ||
    value === 'heuristic_fallback' ||
    value === 'safe_fallback'
  ) {
    return value;
  }
  return 'safe_fallback';
}

function coerceTopicCategory(value: string | null | undefined): StoryTopicId {
  const raw = (value || '').trim() as StoryTopicId;
  return STORY_TOPIC_IDS.has(raw) ? raw : 'general_curiosity';
}

function lineageMatchesArtifact(
  lineage: unknown,
  artifact: MirrorJourneyArtifact
): lineage is JourneyGenerationLineage {
  if (!isPublishableJourneyGenerationLineage(lineage)) return false;
  return (
    lineage.journeyId === artifact.journeyId &&
    lineage.journeyVersion === artifact.journeyVersion
  );
}

function landingFromArtifact(artifact: MirrorJourneyArtifact): PublicMirrorLanding {
  const snap = artifact.sealedPublicLanding;
  if (
    snap &&
    typeof snap === 'object' &&
    typeof snap.publicTitle === 'string' &&
    typeof snap.publicSummary === 'string'
  ) {
    return {
      publicTitle: snap.publicTitle,
      publicSummary: snap.publicSummary,
      continuationContext: snap.continuationContext || '',
      topicCategory: coerceTopicCategory(snap.topicCategory),
      semanticSource: coerceSemanticSource(snap.semanticSource),
      interpretationHash:
        snap.interpretationHash?.trim() ||
        artifact.sealedLineage?.interpretationHash ||
        '',
      contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
      publicLandingHash:
        snap.publicLandingHash || artifact.sealedLineage?.publicLandingHash,
      semanticAnchors: (snap.semanticAnchors as MirrorSemanticAnchorsV1 | null) ?? null,
    };
  }
  return {
    publicTitle: artifact.publicTitle?.trim() || 'Yansı',
    publicSummary: artifact.publicSummary?.trim() || '',
    continuationContext: artifact.continuationContext?.trim() || '',
    topicCategory: 'general_curiosity',
    semanticSource: 'safe_fallback',
    interpretationHash: artifact.sealedLineage?.interpretationHash || '',
    contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
    publicLandingHash: artifact.sealedLineage?.publicLandingHash,
  };
}

function curiosityBundleFromLanding(
  landing: PublicMirrorLanding
): MirrorCuriosityBundle {
  return {
    seed: {
      primaryTopic: landing.publicTitle,
      topicCategory: coerceTopicCategory(landing.topicCategory),
      mood: 'discovery',
      subtopics: [],
      curiosityHooks: landing.continuationContext
        ? [landing.continuationContext]
        : [],
      seedQuestions: [],
      locale: 'tr',
    },
    cardTitle: landing.publicTitle,
    coreCuriosity: landing.continuationContext || landing.publicSummary,
    curiosityContext: { text: landing.publicSummary },
    hooks: landing.continuationContext ? [landing.continuationContext] : [],
    landingContext: landing.publicSummary,
    seedQuestions: [],
    discoverySignals: [landing.publicTitle],
    collectionTags: ['general-curiosity'],
    semanticSource:
      landing.semanticSource === 'd2_interpretation' ||
      landing.semanticSource === 'heuristic_fallback'
        ? landing.semanticSource
        : 'safe_fallback',
    publicLanding: landing,
  };
}

/**
 * Resolve the card used for publish/share of THIS artifact only.
 */
export function buildPublishCardFromArtifact(input: {
  artifact: MirrorJourneyArtifact;
  liveCard?: DailyMirrorCardModel | null;
}): DailyMirrorCardModel | null {
  const { artifact, liveCard } = input;
  if (
    liveCard &&
    lineageMatchesArtifact(liveCard.mirrorJourneyGenerationLineage, artifact)
  ) {
    return liveCard;
  }

  if (!isPublishableJourneyGenerationLineage(artifact.sealedLineage)) {
    return null;
  }

  const landing = landingFromArtifact(artifact);
  const bundle = curiosityBundleFromLanding(landing);
  const title = landing.publicTitle || 'Yansı';

  return {
    date: new Date().toISOString().slice(0, 10),
    dayLabel: '',
    headline: title,
    characterName: '',
    personaFamilyId: 'balanced_calm',
    shortInsight: landing.publicSummary || '',
    userLine: '',
    aiLine: '',
    balanceLine: '',
    signalLevel: '',
    confidence: '',
    energyLabel: '',
    energyScore: null,
    shareEnabled: true,
    privacyText: '',
    dailyThemeTitle: title,
    mirrorV3Payload: {
      mirrorTitle: title,
      curiosityBundle: bundle,
    } as unknown as DailyMirrorCardModel['mirrorV3Payload'],
    mirrorJourneyGenerationLineage: artifact.sealedLineage,
  };
}

export function artifactMatchesLiveCard(
  artifact: MirrorJourneyArtifact,
  liveCard: DailyMirrorCardModel | null | undefined
): boolean {
  return Boolean(
    liveCard &&
      lineageMatchesArtifact(liveCard.mirrorJourneyGenerationLineage, artifact)
  );
}
