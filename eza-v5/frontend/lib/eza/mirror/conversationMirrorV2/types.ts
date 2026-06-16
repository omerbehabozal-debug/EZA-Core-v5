/**
 * SAINA Conversation Mirror V2 — cinematic personal poster pipeline.
 */

export type SainaMirrorSeason =
  | 'bright_cinematic'
  | 'night_discovery'
  | 'editorial_magazine'
  | 'film_poster'
  | 'quiet_luxury'
  | 'golden_hour';

export type SainaMirrorEmotionalTone =
  | 'curious'
  | 'decisive'
  | 'reflective'
  | 'hopeful'
  | 'uncertain'
  | 'focused'
  | 'nostalgic'
  | 'calm'
  | 'careful';

export type SainaMirrorSafetyLevel = 'normal' | 'sensitive' | 'restricted';

export type ConversationMirrorCandidateTopic = {
  topic: string;
  weight: number;
  messageCount?: number;
  depthScore?: number;
  source: 'active_conversation';
};

export type SainaMirrorPayload = {
  conversationId: string;
  date: string;

  season: SainaMirrorSeason;

  topic: string;
  selectedTopic: string;
  candidateTopics: ConversationMirrorCandidateTopic[];
  topicSummary: string;

  emotionalTone: SainaMirrorEmotionalTone;

  mirrorTitle: string;
  mirrorText: string;

  visiblePattern?: string;
  closingLine?: string;

  sceneMetaphor: string;
  visualKeywords: string[];

  safetyLevel: SainaMirrorSafetyLevel;
};

export const MIRROR_V2_ASPECT = {
  width: 1080,
  height: 1350,
  ratio: '4:5',
} as const;

export const MIRROR_PIPELINE_VERSION = 'v2' as const;
