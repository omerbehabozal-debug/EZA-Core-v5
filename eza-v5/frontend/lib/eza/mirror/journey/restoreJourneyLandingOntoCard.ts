/**
 * Remount/hydrate: restore canonical READY/published Journey landing onto a
 * thin card rebuilt from conversation entries (no D2). Prevents SAFE fallback
 * when sealed artifact metadata still exists.
 *
 * Does not re-run D2, regenerate copy, or create a second artifact.
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { listJourneyArtifactsForConversation } from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import {
  MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
  type PublicMirrorLanding,
  type PublicMirrorLandingSemanticSource,
} from '@/lib/eza/mirror-network/publicMirrorLanding';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { MirrorSemanticAnchorsV1 } from '@/lib/eza/mirror/semanticAnchors/types';

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

function coerceTopicCategory(value: string | null | undefined): StoryTopicId {
  const raw = (value || '').trim() as StoryTopicId;
  return STORY_TOPIC_IDS.has(raw) ? raw : 'general_curiosity';
}

/**
 * Preview contract (`resolveMirrorPublicPreview`) only treats d2/heuristic
 * bundle landings as semantic. Canonical sealed READY titles must surface
 * through that path without re-running D2.
 */
function previewSemanticSource(
  raw: string | null | undefined
): Extract<PublicMirrorLandingSemanticSource, 'd2_interpretation' | 'heuristic_fallback'> {
  return raw === 'heuristic_fallback' ? 'heuristic_fallback' : 'd2_interpretation';
}

export function artifactHasCanonicalLanding(
  artifact: MirrorJourneyArtifact | null | undefined
): boolean {
  if (!artifact) return false;
  if (artifact.status !== 'ready' && artifact.status !== 'published') return false;
  const snap = artifact.sealedPublicLanding;
  const title =
    (typeof snap?.publicTitle === 'string' && snap.publicTitle.trim()) ||
    artifact.publicTitle?.trim() ||
    '';
  const summary =
    (typeof snap?.publicSummary === 'string' && snap.publicSummary.trim()) ||
    artifact.publicSummary?.trim() ||
    '';
  return Boolean(title || summary);
}

export function landingFromCanonicalJourneyArtifact(
  artifact: MirrorJourneyArtifact
): PublicMirrorLanding | null {
  if (!artifactHasCanonicalLanding(artifact)) return null;
  const snap = artifact.sealedPublicLanding;
  const publicTitle =
    (typeof snap?.publicTitle === 'string' && snap.publicTitle.trim()) ||
    artifact.publicTitle?.trim() ||
    '';
  const publicSummary =
    (typeof snap?.publicSummary === 'string' && snap.publicSummary.trim()) ||
    artifact.publicSummary?.trim() ||
    '';
  if (!publicTitle && !publicSummary) return null;

  const continuationContext =
    (typeof snap?.continuationContext === 'string' && snap.continuationContext.trim()) ||
    artifact.continuationContext?.trim() ||
    '';

  return {
    publicTitle: publicTitle || publicSummary.slice(0, 48),
    publicSummary: publicSummary || publicTitle,
    continuationContext,
    topicCategory: coerceTopicCategory(snap?.topicCategory),
    semanticSource: previewSemanticSource(snap?.semanticSource),
    interpretationHash:
      snap?.interpretationHash?.trim() ||
      artifact.sealedLineage?.interpretationHash ||
      '',
    contractVersion: MIRROR_PUBLIC_LANDING_CONTRACT_VERSION,
    publicLandingHash:
      snap?.publicLandingHash || artifact.sealedLineage?.publicLandingHash,
    semanticAnchors: (snap?.semanticAnchors as MirrorSemanticAnchorsV1 | null) ?? null,
  };
}

/**
 * Prefer the currently displayed READY/published Yansı for this conversation.
 * Order matches `listJourneyArtifactsForConversation` (blockIndex → version → createdAt).
 * When several exist: preferred journey identity, then scene URL match, else latest.
 */
export function selectJourneyArtifactForRemountLanding(input: {
  artifacts: readonly MirrorJourneyArtifact[];
  sourceConversationId: string;
  preferredJourneyId?: string | null;
  preferredJourneyVersion?: number | null;
  sceneImageUrl?: string | null;
}): MirrorJourneyArtifact | null {
  const conv = input.sourceConversationId.trim();
  if (!conv) return null;

  const candidates = input.artifacts.filter(
    (a) =>
      a.sourceConversationId === conv && artifactHasCanonicalLanding(a)
  );
  if (candidates.length === 0) return null;

  const preferredId = input.preferredJourneyId?.trim() || '';
  if (preferredId) {
    const version = input.preferredJourneyVersion;
    const byId = candidates.filter((a) => a.journeyId === preferredId);
    if (byId.length > 0) {
      if (typeof version === 'number' && Number.isFinite(version)) {
        const exact = byId.find((a) => a.journeyVersion === version);
        if (exact) return exact;
      }
      return byId[byId.length - 1] ?? null;
    }
  }

  const scene = input.sceneImageUrl?.trim() || '';
  if (scene) {
    const byScene = candidates.find((a) => a.sceneImageUrl?.trim() === scene);
    if (byScene) return byScene;
  }

  return candidates[candidates.length - 1] ?? null;
}

function cardHasPublishedShareLanding(card: DailyMirrorCardModel): boolean {
  return Boolean(
    card.mirrorShare?.publicTitle?.trim() || card.mirrorShare?.publicSummary?.trim()
  );
}

/**
 * Overlay sealed Journey landing onto a remounted card.
 * Priority A: leave published/share landing untouched.
 * Does not invent titles from conversation/headline.
 */
export function restoreJourneyLandingOntoCard(
  card: DailyMirrorCardModel,
  artifact: MirrorJourneyArtifact | null | undefined
): DailyMirrorCardModel {
  if (!artifact || !artifactHasCanonicalLanding(artifact)) return card;
  // A — published Discover / share landing already on the card wins.
  if (cardHasPublishedShareLanding(card)) return card;

  const landing = landingFromCanonicalJourneyArtifact(artifact);
  if (!landing) return card;

  const existingBundle = card.mirrorV3Payload?.curiosityBundle;
  const curiosityBundle = {
    ...(existingBundle && typeof existingBundle === 'object' ? existingBundle : {}),
    seed: {
      ...(existingBundle?.seed && typeof existingBundle.seed === 'object'
        ? existingBundle.seed
        : {
            primaryTopic: landing.publicTitle,
            topicCategory: landing.topicCategory,
            mood: 'discovery',
            subtopics: [] as string[],
            curiosityHooks: [] as string[],
            seedQuestions: [] as string[],
            locale: 'tr',
          }),
      primaryTopic: landing.publicTitle,
      topicCategory: landing.topicCategory,
      locale:
        typeof existingBundle?.seed?.locale === 'string'
          ? existingBundle.seed.locale
          : 'tr',
    },
    cardTitle: landing.publicTitle,
    curiosityContext: { text: landing.publicSummary },
    landingContext: landing.publicSummary,
    semanticSource: landing.semanticSource,
    publicLanding: landing,
  };

  const mirrorV3Payload = card.mirrorV3Payload
    ? {
        ...card.mirrorV3Payload,
        mirrorTitle: landing.publicTitle,
        curiosityBundle: curiosityBundle as NonNullable<
          DailyMirrorCardModel['mirrorV3Payload']
        >['curiosityBundle'],
      }
    : ({
        mirrorTitle: landing.publicTitle,
        curiosityBundle,
      } as DailyMirrorCardModel['mirrorV3Payload']);

  return {
    ...card,
    mirrorSemanticSource: landing.semanticSource,
    mirrorV3Payload,
    mirrorJourneyGenerationLineage:
      artifact.sealedLineage ?? card.mirrorJourneyGenerationLineage,
  };
}

/**
 * Remount entry: list conversation artifacts, pick canonical READY/published,
 * overlay landing onto the thin rebuilt card.
 */
export function restoreRemountCardLandingFromJourneyArtifacts(input: {
  card: DailyMirrorCardModel;
  ownerUserId: string | null | undefined;
  conversationId: string | null | undefined;
  preferredJourneyId?: string | null;
  preferredJourneyVersion?: number | null;
  sceneImageUrl?: string | null;
  artifacts?: readonly MirrorJourneyArtifact[];
}): DailyMirrorCardModel {
  const conv = (input.conversationId || '').trim();
  const owner = (input.ownerUserId || '').trim();
  if (!conv) return input.card;

  const artifacts =
    input.artifacts ??
    (owner ? listJourneyArtifactsForConversation(owner, conv) : []);

  const selected = selectJourneyArtifactForRemountLanding({
    artifacts,
    sourceConversationId: conv,
    preferredJourneyId: input.preferredJourneyId,
    preferredJourneyVersion: input.preferredJourneyVersion,
    sceneImageUrl: input.sceneImageUrl,
  });

  return restoreJourneyLandingOntoCard(input.card, selected);
}
