/**
 * SAINA Mirror Philosophy
 *
 * A Mirror is not a conversation summary.
 * A Mirror is not an insight report.
 * A Mirror is not an AI answer.
 *
 * A Mirror is a cinematic curiosity artifact.
 *
 * The card creates curiosity.
 * The landing provides context.
 * The conversation delivers knowledge.
 *
 * Never move contextual information back onto the card.
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

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
  locale: 'tr' | 'en';
  /** Reserved — parent mirror slug when lineage ships (Stage 1+). */
  lineage?: string;
  /** Reserved — safety tier for public landing. */
  safetyTier?: 'open' | 'review' | 'restricted';
};

/** @deprecated Use MirrorSeed — kept for transitional imports. */
export type MirrorTopicDNA = MirrorSeed;

/** Safe short curiosity framing for Mirror Landing (not a chat summary). */
export type MirrorCuriosityContext = {
  text: string;
};

/**
 * Layered curiosity pipeline — each stage may grow independently.
 * Seed → Title → Core Curiosity → Context → Hooks → Landing → Questions → Discovery → Tags
 */
export type MirrorCuriosityPipeline = {
  seed: MirrorSeed;
  cardTitle: string;
  /** Title ≠ curiosity — landing / discovery / search only; never on card. */
  coreCuriosity: string;
  curiosityContext: MirrorCuriosityContext;
  hooks: string[];
  /** Landing copy anchor (Stage 2+); today mirrors curiosityContext.text. */
  landingContext: string;
  seedQuestions: string[];
  /** Stage 4+ — conversion / related-mirror signals. */
  discoverySignals: string[];
  /** Stage 4+ — collection / browse facets. */
  collectionTags: string[];
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
