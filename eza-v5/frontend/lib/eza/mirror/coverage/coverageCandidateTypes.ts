/**
 * Coverage candidate types — P5.2A foundation (queue implementation deferred to 5.3).
 * Privacy-safe: no raw chat, no user IDs.
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { SceneSubtopicId } from '@/lib/eza/mirror/sceneSubtopicTypes';

export type CoverageCandidateStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'promoted';

export type CoverageCandidateSource =
  | 'registry_miss'
  | 'low_confidence'
  | 'llm_fallback';

/** Future candidate queue entry — not wired in 5.2A. */
export type CoverageCandidate = {
  id: string;
  fingerprint: string;
  normalizedCueTokens: string[];
  suggestedTopic: StoryTopicId;
  suggestedSubtopic: SceneSubtopicId | 'topic_generic';
  confidence: number;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  source: CoverageCandidateSource;
  status: CoverageCandidateStatus;
  observationCategory?: string;
  intentKeywords?: string[];
  nearMissCanonical?: string;
  conflictWith?: string[];
  reviewedAt?: string;
  reviewedBy?: 'human' | 'system';
  rejectionReason?: string;
  promotionDraftId?: string;
};

export type CoveragePromotionDraft = {
  id: string;
  cueRuleToken: string;
  topic: StoryTopicId;
  subtopic?: SceneSubtopicId;
  patterns: string[];
  priority: number;
  sourceCandidateId: string;
};
