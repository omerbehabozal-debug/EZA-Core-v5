/**
 * Mirror V2 — debug trace types for end-to-end pipeline visibility.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { SainaMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/types';
import type { ConversationMirrorMessage } from '@/lib/eza/mirror/conversationMirrorEntries';

export type MirrorDebugRawMessage = {
  index: number;
  role: 'user' | 'system';
  text: string;
  savedAt?: string;
  interactionId?: string;
  mirrorCueHints?: string[];
  engagementScore?: number;
};

export type MirrorDebugSignal = {
  signal: string;
  score: number;
  sourceMessages: number[];
};

export type MirrorDebugCandidateTopic = {
  topic: string;
  weight: number;
  messageCount?: number;
  depthScore?: number;
  storyTopicId: StoryTopicId;
  clusterId: string;
};

export type MirrorDebugTopicSelection = {
  selectedTopic: string;
  primaryStoryTopicId: StoryTopicId;
  method: 'single_candidate' | 'dominance' | 'weighted_roll' | 'fallback';
  dominantRatio: number | null;
  conversationConsistency: 'high' | 'medium' | 'low';
  reasonLines: string[];
};

export type MirrorDebugStoryEngine = {
  selectedTopic: string;
  narrativeTheme: string;
  emotionalTone: string;
  archetype: string;
  storyTopicKey: string;
  relationshipMode: string;
  storyTone: string;
  mirrorTitleCandidates: string[];
  selectedMirrorTitle: string;
  mirrorTitleReason: string;
  sceneMetaphorCandidates: string[];
  selectedSceneMetaphor: string;
  sceneMetaphorReason: string;
  usedSelectedTopicCopy: boolean;
  storyLine?: string;
};

export type MirrorDebugRedFlag = {
  severity: 'warning' | 'critical';
  title: string;
  conversationTopic: string;
  mirrorTitle: string;
  reason: string;
};

export type MirrorDebugQualityEvaluation = {
  alignmentScore: number;
  reasonLines: string[];
  redFlags: MirrorDebugRedFlag[];
};

export type MirrorV2DebugTrace = {
  generatedAt: string;
  seed: string;
  conversationId: string;
  rawConversation: MirrorDebugRawMessage[];
  signals: MirrorDebugSignal[];
  candidateTopics: MirrorDebugCandidateTopic[];
  topicSelection: MirrorDebugTopicSelection;
  storyEngine: MirrorDebugStoryEngine;
  payload: SainaMirrorPayload;
  openAiPrompt: string;
  quality: MirrorDebugQualityEvaluation;
};

export type BuildMirrorDebugTraceOptions = {
  conversationId: string;
  date?: Date;
  season?: SainaMirrorPayload['season'];
  seed?: string;
  /** Optional full chat messages for richer RAW CONVERSATION display. */
  conversationMessages?: ConversationMirrorMessage[];
};

export type BuildMirrorDebugTraceInput = {
  entries: SavedBehavioralEntry[];
  options: BuildMirrorDebugTraceOptions;
};
