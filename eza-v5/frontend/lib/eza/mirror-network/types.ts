/**
 * SAINA Mirror Philosophy
 *
 * A Mirror is not a conversation transcript.
 * A public landing must still explain the curiosity that produced the image.
 *
 * Never move contextual information back onto the card image.
 * Never interpolate internal evidence labels into public landing copy.
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { ShareVoiceLine } from '@/lib/eza/mirror-share/types';
import type { PublicMirrorLanding } from '@/lib/eza/mirror-network/publicMirrorLanding';

export type MirrorTopicMood =
  | 'discovery'
  | 'analysis'
  | 'planning'
  | 'comparison'
  | 'reflection'
  | 'creative'
  | 'research';

/**
 * Curiosity seed metadata — mood, hooks, lineage, safety, discovery prep.
 * (Formerly MirrorTopicDNA; name widened as this grows beyond "topic".)
 */
export type MirrorSeed = {
  primaryTopic: string;
  topicCategory: StoryTopicId;
  mood: MirrorTopicMood;
  subtopics: string[];
  curiosityHooks: string[];
  /** Landing / seed only — must not appear on card or image prompt. */
  seedQuestions: string[];
  locale: 'tr' | 'en' | 'ar';
  /** Reserved — parent mirror slug when lineage ships (Stage 1+). */
  lineage?: string;
  /** Reserved — safety tier for public landing. */
  safetyTier?: 'open' | 'review' | 'restricted';
};

/** @deprecated Use MirrorSeed — kept for transitional imports. */
export type MirrorTopicDNA = MirrorSeed;

/** @deprecated Prefer PublicMirrorLanding.publicSummary — kept for API compat. */
export type MirrorCuriosityContext = {
  text: string;
};

export type MirrorCuriositySemanticSource =
  | 'd2_interpretation'
  | 'heuristic_fallback'
  | 'safe_fallback'
  | 'legacy_v3_fallback';

/**
 * Layered curiosity pipeline — each stage may grow independently.
 * Seed → Title → Core Curiosity → Context → Hooks → Landing → Questions → Discovery → Tags
 */
export type MirrorCuriosityPipeline = {
  seed: MirrorSeed;
  cardTitle: string;
  /** Title ≠ curiosity — landing / discovery / search only; never on card. */
  coreCuriosity: string;
  /**
   * @deprecated Mirror of publicLanding.publicSummary for older readers.
   * New surfaces must prefer `publicLanding`.
   */
  curiosityContext: MirrorCuriosityContext;
  hooks: string[];
  /** @deprecated Mirror of publicLanding.publicSummary. */
  landingContext: string;
  seedQuestions: string[];
  /** Stage 4+ — conversion / related-mirror signals. */
  discoverySignals: string[];
  /** Stage 4+ — collection / browse facets. */
  collectionTags: string[];
  /** Mirror Intelligence — caption layer 1; landing/card/image prompt'ta görünmez. */
  shareVoice?: ShareVoiceLine;
  /**
   * Phase 0 lineage — which semantic authority produced this bundle.
   * D2-backed mirrors must never silently keep a V3 architecture/material bundle.
   */
  semanticSource?: MirrorCuriositySemanticSource;
  /** Public landing contract v1 — title / summary / continuation. */
  publicLanding?: PublicMirrorLanding;
};

export type MirrorCuriosityBundle = MirrorCuriosityPipeline;

export type MirrorImagePromptLeakageAudit = {
  rawConversationInPrompt: boolean;
  mirrorBodyInPrompt: boolean;
  curiosityContextInPrompt: boolean;
  coreCuriosityInPrompt: boolean;
  publicSummaryInPrompt: boolean;
  seedQuestionsInPrompt: boolean;
  evidenceLabelsInPrompt: boolean;
  topicHintInPrompt: boolean;
  visualDirectionInPrompt: boolean;
  conversationSummaryInPrompt: boolean;
  userNameInPrompt: boolean;
  assistantResponseInPrompt: boolean;
  emailInPrompt: boolean;
  phoneInPrompt: boolean;
  dateInPrompt: boolean;
  locationInPrompt: boolean;
  personalEntityInPrompt: boolean;
  passed: boolean;
};
